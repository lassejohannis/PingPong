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
  requireEmailGate: boolean;
  emailGateInfoText: string | null;
  calendarEnabled: boolean;
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
  requireEmailGate,
  emailGateInfoText,
  calendarEnabled,
}: PitchClientProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [slidesVisible, setSlidesVisible] = useState(false);
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
  const [visitorEmail, setVisitorEmail] = useState("");
  const [emailGateCompleted, setEmailGateCompleted] = useState(!requireEmailGate);
  const [isLimitReached, setIsLimitReached] = useState(false);

  const voiceActiveRef = useRef(false);
  const slidesViewedRef = useRef<Set<number>>(new Set());
  const visitorEmailRef = useRef(visitorEmail);
  const messagesRef = useRef(messages);
  const hasSavedRef = useRef(false);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    visitorEmailRef.current = visitorEmail;
  }, [visitorEmail]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const saveConversation = useCallback(async () => {
    if (hasSavedRef.current) return;
    const currentMessages = messagesRef.current;
    if (!currentMessages.some((m) => m.role === "user")) return;
    hasSavedRef.current = true;
    try {
      await fetch("/api/conversations/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          messages: currentMessages,
          slidesViewed: Array.from(slidesViewedRef.current),
          visitorEmail: visitorEmailRef.current || undefined,
        }),
      });
    } catch {
      hasSavedRef.current = false; // allow beforeunload to retry
    }
  }, [slug]);

  const conversation = useConversation({
    clientTools: {
      show_slide: async ({ slide_index }: { slide_index: number; reason?: string }) => {
        setCurrentSlide(slide_index);
        slidesViewedRef.current.add(slide_index);
        setSlidesVisible(true);
        return `Slide ${slide_index} is now displayed.`;
      },
      check_availability: async () => {
        if (!calendarEnabled) return "Calendar booking is not available.";
        const res = await fetch("/api/calendar/availability");
        const data = await res.json();
        return data.slotsText;
      },
      book_meeting: async ({ slot_time, attendee_name, attendee_email }: { slot_time: string; attendee_name: string; attendee_email: string }) => {
        if (!calendarEnabled) return "Calendar booking is not available.";
        const email = attendee_email || visitorEmailRef.current;
        if (!email) return "I need your email address to book the meeting. Could you share it with me?";
        const res = await fetch("/api/calendar/book", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ start: slot_time, attendeeName: attendee_name, attendeeEmail: email }),
        });
        const data = await res.json();
        return data.success ? data.message : (data.error || "Booking failed. Please try again.");
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
    onDisconnect: () => { setOrbState("idle"); saveConversation(); },
    onError: () => { setOrbState("idle"); setIsVoiceConnecting(false); },
  });

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (hasSavedRef.current) return;
      const currentMessages = messagesRef.current;
      const hasUserMessages = currentMessages.some(m => m.role === "user");
      if (!hasUserMessages) return;
      const payload = JSON.stringify({
        slug,
        messages: currentMessages,
        slidesViewed: Array.from(slidesViewedRef.current),
        visitorEmail: visitorEmailRef.current || undefined,
      });
      navigator.sendBeacon("/api/conversations/save", new Blob([payload], { type: "application/json" }));
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [slug]);

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
    await saveConversation();
  }, [conversation, saveConversation]);

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
            calendarEnabled,
            visitorEmail: visitorEmailRef.current || undefined,
          }),
        });

        if (!response.ok) throw new Error("Chat request failed");

        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let assistantText = "";
        let shouldSave = false;

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
              } else if (data.type === "booking_confirmed") {
                // booking confirmation is relayed through the assistant text, no extra UI needed
              } else if (data.type === "limit_reached" || data.type === "conversation_ended") {
                setIsLimitReached(true);
                shouldSave = true;
              } else if (data.type === "error") {
                const errorMsg = data.error_type === "rate_limit"
                  ? "The agent is currently busy. Please try again in a moment."
                  : "Something went wrong. Please try again.";
                setMessages((prev) => {
                  const updated = [...prev];
                  updated[updated.length - 1] = { role: "assistant", content: errorMsg };
                  return updated;
                });
              }
            } catch { /* skip malformed */ }
          }
        }
        if (shouldSave) await saveConversation();
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
    [messages, isStreaming, systemPrompt, slides, calendarEnabled, saveConversation]
  );

  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); sendMessage(input); };

  const slide = slides[currentSlide];
  const displayName = prospectName || "";

  // ===================== EMAIL GATE SCREEN =====================
  if (!emailGateCompleted) {
    const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(visitorEmail);
    return (
      <div className="min-h-screen flex flex-col bg-black text-white">
        <main className="flex-1 flex flex-col items-center justify-center gap-6 px-6">
          {prospectLogo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={prospectLogo} alt={displayName} className="w-20 h-20 rounded-2xl object-cover shadow-xl" />
          )}
          {displayName && (
            <h1 className="text-3xl font-bold text-white text-center tracking-tight">{displayName}</h1>
          )}
          <div className="w-full max-w-sm space-y-4">
            <h2 className="text-lg font-semibold text-white text-center">Before we begin</h2>
            <p className="text-sm text-white/50 text-center leading-relaxed">
              {emailGateInfoText || "We collect your email so we can follow up with relevant information."}
            </p>
            <form
              onSubmit={(e) => { e.preventDefault(); if (isValidEmail) setEmailGateCompleted(true); }}
              className="space-y-3"
            >
              <input
                type="email"
                value={visitorEmail}
                onChange={(e) => setVisitorEmail(e.target.value)}
                placeholder="your@email.com"
                required
                className="w-full rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/25 px-4 py-3 text-sm outline-none focus:border-white/30 transition-colors"
              />
              <button
                type="submit"
                disabled={!isValidEmail}
                className="w-full px-6 py-3 bg-white text-black rounded-full text-sm font-semibold hover:bg-white/90 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                Continue
              </button>
            </form>
          </div>
        </main>
      </div>
    );
  }

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
            onClick={() => { saveConversation(); setVoiceEnded(false); setVoiceStarted(false); setMode("voice"); }}
            className="px-5 py-2.5 rounded-lg border border-white/15 text-white/60 hover:border-white/30 hover:text-white text-sm transition-colors"
          >
            New session
          </button>
          <button
            onClick={() => { saveConversation(); setVoiceEnded(false); setMode("text"); }}
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
          {/* Agent orb — centered when no slides, slides left when slides appear */}
          <div
            style={{
              width: slidesVisible ? "30%" : "100%",
              transition: "width 700ms cubic-bezier(0.4, 0, 0.2, 1)",
            }}
            className="shrink-0 flex flex-col items-center justify-center gap-4 px-6"
          >
            <div
              style={{
                width: slidesVisible ? "160px" : "220px",
                height: slidesVisible ? "160px" : "220px",
                transition: "width 700ms cubic-bezier(0.4, 0, 0.2, 1), height 700ms cubic-bezier(0.4, 0, 0.2, 1)",
              }}
            >
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

          {/* Slide panel — slides in from right when first slide is triggered */}
          <div
            style={{
              width: slidesVisible ? "70%" : "0%",
              opacity: slidesVisible ? 1 : 0,
              transition: "width 700ms cubic-bezier(0.4, 0, 0.2, 1), opacity 500ms ease-in-out",
              overflow: "hidden",
            }}
            className="flex flex-col items-center justify-center p-6 gap-3"
          >
            {slide && (
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

              {isLimitReached && (
                <div className="px-4 py-3 bg-violet-500/10 border-t border-violet-500/20 text-center">
                  <p className="text-xs text-violet-400">
                    {calendarEnabled ? "Session complete — the agent can book a call for you above." : "Session complete — reach out to continue the conversation."}
                  </p>
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
                  disabled={isStreaming || isLimitReached}
                />
                <button
                  type="submit"
                  disabled={isStreaming || !input.trim() || isLimitReached}
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

            {isLimitReached && (
              <div className="px-4 py-3 bg-violet-500/10 border-t border-violet-500/20 text-center">
                <p className="text-xs text-violet-400">
                  {calendarEnabled ? "Session complete — the agent can book a call for you above." : "Session complete — reach out to continue the conversation."}
                </p>
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
                disabled={isStreaming || isLimitReached}
              />
              <button
                type="submit"
                disabled={isStreaming || !input.trim() || isLimitReached}
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
