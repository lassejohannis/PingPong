"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useConversation } from "@elevenlabs/react";
import { VoicePoweredOrb } from "@/components/ui/voice-powered-orb";

interface Slide {
  index: number;
  title: string;
  description: string;
  image_url: string;
}

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface PitchClientProps {
  slug: string;
  systemPrompt: string;
  prospectContext: string | null;
  slides: Slide[];
  prospectName: string;
  prospectLogo: string | null;
  headline: string;
  openingMessage: string;
  suggestedQuestions: string[];
}

export default function PitchClient({
  slug,
  systemPrompt,
  prospectContext,
  slides,
  prospectName,
  prospectLogo,
  headline,
  openingMessage,
  suggestedQuestions,
}: PitchClientProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: openingMessage },
  ]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [mode, setMode] = useState<"text" | "voice">("voice");
  const [voiceStarted, setVoiceStarted] = useState(false);
  const [voiceEnded, setVoiceEnded] = useState(false);
  const [orbState, setOrbState] = useState<"idle" | "listening" | "speaking">("idle");
  const [isVoiceConnecting, setIsVoiceConnecting] = useState(false);

  const voiceActiveRef = useRef(false);
  const slidesViewedRef = useRef<Set<number>>(new Set());

  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const conversation = useConversation({
    clientTools: {
      show_slide: async ({ slide_index }: { slide_index: number; reason?: string }) => {
        setCurrentSlide(slide_index);
        slidesViewedRef.current.add(slide_index);
        return `Slide ${slide_index} is now displayed.`;
      },
    },
    onMessage: (props: { message: string; source: string }) => {
      if (!voiceActiveRef.current) return;
      const role = props.source === "user" ? "user" : "assistant";
      setMessages((prev) => [...prev, { role, content: props.message }]);
    },
    onModeChange: (props: { mode: string }) => {
      if (!voiceActiveRef.current) return;
      if (props.mode === "speaking") setOrbState("speaking");
      else if (props.mode === "listening") setOrbState("listening");
      else setOrbState("idle");
    },
    onConnect: () => { setIsVoiceConnecting(false); setOrbState("listening"); },
    onDisconnect: () => { setOrbState("idle"); },
    onError: () => { setOrbState("idle"); setIsVoiceConnecting(false); },
  });

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const connectingRef = useRef(false);

  const handleStartVoice = useCallback(async () => {
    if (connectingRef.current) return;
    connectingRef.current = true;
    voiceActiveRef.current = true;
    setIsVoiceConnecting(true);
    setMode("voice");
    try {
      const res = await fetch("/api/elevenlabs/signed-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, prospectContext, conversationHistory: messages }),
      });
      if (!res.ok) throw new Error("Failed to get signed URL");
      const { signedUrl, overrides } = await res.json();
      await conversation.startSession({ signedUrl, overrides });
    } catch (err) {
      console.error("Failed to start voice session:", err);
      voiceActiveRef.current = false;
      setVoiceStarted(false);
      setMode("text");
    } finally {
      setIsVoiceConnecting(false);
      connectingRef.current = false;
    }
  }, [slug, conversation]);

  const handleEnd = useCallback(async () => {
    voiceActiveRef.current = false;
    setVoiceStarted(false);
    setVoiceEnded(true);
    setOrbState("idle");
    setIsStreaming(false);
    try { await conversation.endSession(); } catch { /* ignore */ }
    const hasUserMessages = messages.some((m) => m.role === "user");
    if (hasUserMessages) {
      try {
        await fetch("/api/conversations/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            slug,
            messages,
            slidesViewed: Array.from(slidesViewedRef.current),
          }),
        });
      } catch { /* not critical */ }
    }
  }, [conversation, messages, slug]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isStreaming) return;

      const userMessage: Message = { role: "user", content: text.trim() };
      const updatedMessages = [...messages, userMessage];
      setMessages(updatedMessages);
      setInput("");
      setIsStreaming(true);

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: updatedMessages.map((m) => ({ role: m.role, content: m.content })),
            systemPrompt,
            prospectContext,
            slides: slides.map((s) => ({ index: s.index, title: s.title, description: s.description })),
          }),
        });

        if (!response.ok) throw new Error("Chat request failed");

        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let assistantText = "";

        setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value);
          for (const line of chunk.split("\n")) {
            if (!line.startsWith("data: ")) continue;
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === "text_delta") {
                assistantText += data.text;
                setMessages((prev) => {
                  const updated = [...prev];
                  updated[updated.length - 1] = { role: "assistant", content: assistantText };
                  return updated;
                });
              } else if (data.type === "slide_change") {
                setCurrentSlide(data.slide_index);
              }
            } catch { /* skip malformed */ }
          }
        }
      } catch {
        setMessages((prev) => [
          ...prev.slice(0, -1),
          { role: "assistant", content: "Sorry, something went wrong. Please try again." },
        ]);
      } finally {
        setIsStreaming(false);
        inputRef.current?.focus();
      }
    },
    [messages, isStreaming, systemPrompt, slides]
  );

  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); sendMessage(input); };

  const slide = slides[currentSlide];
  const displayName = prospectName || "";

  // ===================== VOICE START SCREEN =====================
  if (mode === "voice" && !voiceStarted && !voiceEnded) {
    return (
      <div className="min-h-screen flex flex-col bg-black text-white">
        <header className="px-6 py-4 flex items-center justify-end">
          <button
            onClick={() => setMode("text")}
            className="inline-flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
            Text mode
          </button>
        </header>

        <main className="flex-1 flex flex-col items-center justify-center gap-6 px-6">
          {prospectLogo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={prospectLogo} alt={displayName} className="w-20 h-20 rounded-2xl object-cover shadow-xl" />
          )}
          {displayName && (
            <h1 className="text-4xl font-bold text-white text-center tracking-tight">{displayName}</h1>
          )}
          <button
            onClick={() => { setVoiceStarted(true); handleStartVoice(); }}
            className="mt-2 px-10 py-3.5 bg-white text-black rounded-full text-sm font-semibold hover:bg-white/90 active:scale-95 transition-all"
          >
            Start
          </button>
        </main>
      </div>
    );
  }

  // ===================== ENDED CONVERSATION SCREEN =====================
  if (voiceEnded) {
    return (
      <div className="min-h-screen flex flex-col bg-black text-white">
        <header className="px-6 py-4 flex items-center justify-between border-b border-white/8">
          <div className="flex items-center gap-3">
            {prospectLogo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={prospectLogo} alt={displayName} className="h-6 w-6 rounded-lg object-cover" />
            )}
            {displayName && <span className="text-sm font-medium text-white/70">{displayName}</span>}
          </div>
          <span className="text-xs text-white/25 tracking-wide uppercase">Conversation ended</span>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="max-w-xl mx-auto px-6 py-8 space-y-3">
            {messages.filter((m) => m.content).map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <span
                  className={`inline-block px-4 py-2.5 rounded-2xl text-sm max-w-[80%] leading-relaxed ${
                    msg.role === "user"
                      ? "bg-white text-black"
                      : "bg-white/8 text-white/85"
                  }`}
                >
                  {msg.content}
                </span>
              </div>
            ))}
          </div>
        </main>

        <footer className="border-t border-white/8 px-6 py-5 flex justify-center gap-3">
          <button
            onClick={() => { setVoiceEnded(false); setVoiceStarted(false); setMode("voice"); }}
            className="px-5 py-2.5 rounded-lg border border-white/15 text-white/60 hover:border-white/30 hover:text-white text-sm transition-colors"
          >
            New session
          </button>
          <button
            onClick={() => { setVoiceEnded(false); setMode("text"); }}
            className="px-5 py-2.5 rounded-lg bg-white/10 text-white/80 hover:bg-white/15 text-sm transition-colors"
          >
            Continue in text
          </button>
        </footer>
      </div>
    );
  }

  // ===================== ACTIVE VOICE MODE =====================
  if (mode === "voice") {
    return (
      <div className="min-h-screen flex flex-col bg-black text-white">
        <header className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {prospectLogo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={prospectLogo} alt={displayName} className="h-7 w-7 rounded-lg object-cover" />
            )}
            {displayName && <span className="text-sm font-medium text-white/70">{displayName}</span>}
          </div>
          <button
            onClick={handleEnd}
            className="inline-flex items-center gap-1.5 text-xs text-red-400/70 hover:text-red-400 border border-red-500/20 hover:border-red-500/40 px-3 py-1.5 rounded-lg transition-colors"
          >
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 6h12v12H6z" />
            </svg>
            End
          </button>
        </header>

        <main className="flex-1 min-h-0 flex overflow-hidden">
          {/* Left — agent orb (30%) */}
          <div className="w-[30%] shrink-0 flex flex-col items-center justify-center gap-4 px-6">
            <div className="w-40 h-40">
              <VoicePoweredOrb
                enableVoiceControl={orbState !== "idle"}
                externalIntensity={orbState === "speaking" ? 0.4 : orbState === "listening" ? 0.08 : 0}
                hue={orbState === "speaking" ? 280 : orbState === "listening" ? 120 : 0}
                className="rounded-full overflow-hidden"
              />
            </div>
            <p className="text-white/40 text-xs tracking-wide uppercase">
              {isVoiceConnecting ? "Connecting…" : orbState === "speaking" ? "Speaking" : orbState === "listening" ? "Listening" : "Ready"}
            </p>
          </div>

          {/* Right — slide (70%) */}
          <div className="flex-1 min-w-0 flex flex-col items-center justify-center p-6 gap-3">
            {slide ? (
              <>
                <div className="w-full aspect-video rounded-xl overflow-hidden border border-white/10">
                  {slide.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={slide.image_url} alt={slide.title} className="w-full h-full object-contain bg-black" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-white/5">
                      <p className="text-sm text-white/50 text-center px-4">{slide.title}</p>
                    </div>
                  )}
                </div>
                {slides.length > 1 && (
                  <div className="flex gap-1.5 justify-center">
                    {slides.map((_, i) => (
                      <div
                        key={i}
                        className={`rounded-full transition-all duration-200 ${
                          i === currentSlide ? "w-4 h-1.5 bg-white/60" : "w-1.5 h-1.5 bg-white/20"
                        }`}
                      />
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="w-full aspect-video rounded-xl border border-white/8 flex items-center justify-center bg-white/3">
                <p className="text-white/20 text-sm">Slides will appear here</p>
              </div>
            )}
          </div>
        </main>
      </div>
    );
  }

  // ===================== TEXT MODE =====================
  return (
    <div className="min-h-screen flex flex-col bg-black text-white">
      {/* Header */}
      <header className="border-b border-white/8 px-6 py-3 flex items-center gap-3 bg-black/90 backdrop-blur z-10 shrink-0">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {prospectLogo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={prospectLogo} alt={displayName} className="h-7 w-7 rounded-lg object-cover shrink-0" />
          )}
          {displayName && <span className="text-sm font-medium text-white/70 truncate">{displayName}</span>}
        </div>
        <button
          onClick={() => { setVoiceStarted(true); handleStartVoice(); }}
          className="inline-flex items-center gap-1.5 text-xs text-white/50 hover:text-white border border-white/12 hover:border-white/25 px-3 py-1.5 rounded-lg transition-colors shrink-0"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          </svg>
          Voice mode
        </button>
      </header>

      {/* Main — split layout when slides exist, full chat otherwise */}
      <main className="flex-1 min-h-0 flex overflow-hidden">
        {slides.length > 0 ? (
          <>
            {/* Slide panel */}
            <div className="flex-1 min-w-0 flex flex-col items-center justify-center p-6 gap-4">
              <div className="w-full max-w-3xl">
                <div className="w-full aspect-video rounded-xl overflow-hidden border border-white/10">
                  {slide?.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={slide.image_url} alt={slide.title} className="w-full h-full object-contain bg-black" />
                  ) : slide ? (
                    <div className="w-full h-full flex items-center justify-center bg-white/5">
                      <div className="text-center px-8">
                        <p className="text-xl font-semibold text-white">{slide.title}</p>
                        <p className="text-white/50 text-sm mt-2">{slide.description}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-white/5">
                      <p className="text-white/25 text-sm">Waiting for first slide…</p>
                    </div>
                  )}
                </div>
                {slides.length > 1 && (
                  <div className="flex gap-2 justify-center mt-4">
                    {slides.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setCurrentSlide(i)}
                        className={`rounded-full transition-all duration-200 ${
                          i === currentSlide ? "w-5 h-1.5 bg-white/70" : "w-1.5 h-1.5 bg-white/25 hover:bg-white/50"
                        }`}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Chat sidebar */}
            <div className="w-80 shrink-0 border-l border-white/8 flex flex-col">
              <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
                {messages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <span
                      className={`inline-block px-3 py-2.5 rounded-2xl text-sm max-w-[90%] leading-relaxed ${
                        msg.role === "user" ? "bg-white text-black" : "bg-white/8 text-white/85"
                      }`}
                    >
                      {msg.content || (isStreaming ? "…" : "")}
                    </span>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>

              {messages.length <= 1 && suggestedQuestions.length > 0 && (
                <div className="px-3 pb-3 flex flex-col gap-1.5">
                  {suggestedQuestions.slice(0, 4).map((q, i) => (
                    <button
                      key={i}
                      onClick={() => sendMessage(q)}
                      className="text-left text-xs px-3 py-2 rounded-lg border border-white/10 text-white/55 hover:border-white/25 hover:text-white/80 transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}

              <form onSubmit={handleSubmit} className="border-t border-white/8 p-3 flex gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask anything…"
                  className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/25 focus:outline-none focus:border-white/25 transition-colors"
                  disabled={isStreaming}
                />
                <button
                  type="submit"
                  disabled={isStreaming || !input.trim()}
                  className="px-4 py-2 bg-white text-black rounded-lg text-sm font-medium hover:bg-white/90 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  →
                </button>
              </form>
            </div>
          </>
        ) : (
          /* No slides — full-width centered chat */
          <div className="flex-1 flex flex-col max-w-2xl mx-auto w-full">
            <div className="flex-1 overflow-y-auto p-6 space-y-3 min-h-0">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <span
                    className={`inline-block px-4 py-3 rounded-2xl text-sm max-w-[80%] leading-relaxed ${
                      msg.role === "user" ? "bg-white text-black" : "bg-white/8 text-white/85"
                    }`}
                  >
                    {msg.content || (isStreaming ? "…" : "")}
                  </span>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            {messages.length <= 1 && suggestedQuestions.length > 0 && (
              <div className="px-6 py-3 flex gap-2 overflow-x-auto">
                {suggestedQuestions.map((q, i) => (
                  <button
                    key={i}
                    onClick={() => sendMessage(q)}
                    className="text-xs px-4 py-2 rounded-lg border border-white/12 text-white/55 hover:border-white/25 hover:text-white/80 whitespace-nowrap transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}

            <form onSubmit={handleSubmit} className="border-t border-white/8 px-6 py-4 flex gap-3">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={displayName ? `Ask about ${displayName}…` : "Ask anything…"}
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/25 focus:outline-none focus:border-white/25 transition-colors"
                disabled={isStreaming}
              />
              <button
                type="submit"
                disabled={isStreaming || !input.trim()}
                className="px-6 py-3 bg-white text-black rounded-xl text-sm font-medium hover:bg-white/90 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                →
              </button>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
