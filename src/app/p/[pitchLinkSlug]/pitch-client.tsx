"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useConversation } from "@elevenlabs/react";

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
  const [mode, setMode] = useState<"text" | "voice">("text");
  const [orbState, setOrbState] = useState<"idle" | "listening" | "speaking">("idle");
  const [isVoiceConnecting, setIsVoiceConnecting] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // --- ElevenLabs Conversational AI ---
  const conversation = useConversation({
    clientTools: {
      show_slide: async ({ slide_index }: { slide_index: number; reason?: string }) => {
        setCurrentSlide(slide_index);
        return `Slide ${slide_index} is now displayed.`;
      },
    },
    onMessage: (props: { message: string; source: string }) => {
      const role = props.source === "user" ? "user" : "assistant";
      setMessages((prev) => [...prev, { role, content: props.message }]);
    },
    onModeChange: (props: { mode: string }) => {
      if (props.mode === "speaking") {
        setOrbState("speaking");
      } else if (props.mode === "listening") {
        setOrbState("listening");
      } else {
        setOrbState("idle");
      }
    },
    onConnect: () => {
      setIsVoiceConnecting(false);
      setOrbState("listening");
    },
    onDisconnect: (details: { reason: string; message?: string }) => {
      console.log("ElevenLabs disconnected:", details);
      setOrbState("idle");
    },
    onStatusChange: (props: { status: string }) => {
      console.log("ElevenLabs status:", props.status);
    },
    onError: (message: string, context?: unknown) => {
      console.error("ElevenLabs error:", message, context);
      setOrbState("idle");
      setIsVoiceConnecting(false);
    },
  });

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // --- Voice Mode: start/stop ElevenLabs session ---
  const connectingRef = useRef(false);

  const handleStartVoice = useCallback(async () => {
    if (connectingRef.current) return;
    connectingRef.current = true;
    setIsVoiceConnecting(true);
    setMode("voice");
    try {
      const res = await fetch(`/api/elevenlabs/signed-url?slug=${encodeURIComponent(slug)}`);
      if (!res.ok) throw new Error("Failed to get signed URL");
      const { signedUrl, overrides } = await res.json();

      await conversation.startSession({
        signedUrl,
        overrides,
      });
    } catch (err) {
      console.error("Failed to start voice session:", err);
      setMode("text");
    } finally {
      setIsVoiceConnecting(false);
      connectingRef.current = false;
    }
  }, [slug, conversation]);

  const handleStopVoice = useCallback(async () => {
    setMode("text");
    await conversation.endSession();
    setOrbState("idle");
  }, [conversation]);

  // --- Text Mode: streaming chat via /api/chat ---
  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isStreaming) return;

      const userMessage: Message = { role: "user", content: text.trim() };
      const updatedMessages = [...messages, userMessage];
      setMessages(updatedMessages);
      setInput("");
      setIsStreaming(true);

      const apiMessages = updatedMessages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: apiMessages,
            systemPrompt,
            slides: slides.map((s) => ({
              index: s.index,
              title: s.title,
              description: s.description,
            })),
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
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            try {
              const data = JSON.parse(line.slice(6));

              switch (data.type) {
                case "text_delta":
                  assistantText += data.text;
                  setMessages((prev) => {
                    const updated = [...prev];
                    updated[updated.length - 1] = {
                      role: "assistant",
                      content: assistantText,
                    };
                    return updated;
                  });
                  break;

                case "slide_change":
                  setCurrentSlide(data.slide_index);
                  break;
              }
            } catch {
              // Skip malformed SSE lines
            }
          }
        }
      } catch (error) {
        console.error("Chat error:", error);
        setMessages((prev) => [
          ...prev.slice(0, -1),
          {
            role: "assistant",
            content: "Sorry, something went wrong. Please try again.",
          },
        ]);
      } finally {
        setIsStreaming(false);
        inputRef.current?.focus();
      }
    },
    [messages, isStreaming, systemPrompt, slides]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const slide = slides[currentSlide];

  // ===================== VOICE MODE =====================
  if (mode === "voice") {
    return (
      <div className="min-h-screen flex flex-col bg-black text-white">
        <header className="border-b border-white/10 px-6 py-3 flex items-center gap-3 bg-black/80 backdrop-blur z-10">
          {prospectLogo && (
            <img src={prospectLogo} alt={prospectName} className="h-8 w-8 rounded" />
          )}
          <h1 className="font-semibold text-sm truncate flex-1">{headline}</h1>
          <button
            onClick={handleStopVoice}
            className="text-xs px-3 py-1.5 rounded-full border border-white/20 text-white/70 hover:bg-white/10 transition"
          >
            Switch to Text
          </button>
        </header>

        <main className="flex-1 flex flex-col items-center justify-center relative">
          {/* Animated orb */}
          <div className="relative flex items-center justify-center">
            <div
              className={`w-48 h-48 rounded-full transition-all duration-500 ${
                orbState === "speaking"
                  ? "bg-gradient-to-br from-blue-500 to-purple-600 shadow-[0_0_80px_rgba(99,102,241,0.5)]"
                  : orbState === "listening"
                  ? "bg-gradient-to-br from-green-400 to-emerald-600 shadow-[0_0_60px_rgba(52,211,153,0.4)]"
                  : "bg-gradient-to-br from-white/20 to-white/5 shadow-[0_0_40px_rgba(255,255,255,0.1)]"
              }`}
              style={{
                animation:
                  orbState === "speaking"
                    ? "orbPulse 1s ease-in-out infinite"
                    : orbState === "listening"
                    ? "orbPulse 2s ease-in-out infinite"
                    : "orbPulse 4s ease-in-out infinite",
              }}
            />
            <div
              className={`absolute w-32 h-32 rounded-full blur-xl transition-all duration-500 ${
                orbState === "speaking"
                  ? "bg-blue-400/40"
                  : orbState === "listening"
                  ? "bg-green-400/30"
                  : "bg-white/10"
              }`}
            />
          </div>

          <p className="mt-8 text-white/50 text-sm">
            {isVoiceConnecting
              ? "Connecting..."
              : orbState === "speaking"
              ? "Speaking..."
              : orbState === "listening"
              ? "Listening..."
              : "Ready"}
          </p>

          {messages.length > 1 && messages[messages.length - 1].role === "assistant" && (
            <p className="mt-6 text-white/40 text-xs max-w-lg text-center line-clamp-3">
              {messages[messages.length - 1].content}
            </p>
          )}

          {slide && (
            <div className="absolute bottom-6 right-6 w-48 aspect-video">
              {slide.image_url ? (
                <img
                  src={slide.image_url}
                  alt={slide.title}
                  className="w-full h-full object-contain rounded-lg opacity-50"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-white/5 rounded-lg">
                  <p className="text-xs text-white/30 text-center px-2">{slide.title}</p>
                </div>
              )}
              <div className="flex gap-1 justify-center mt-1">
                {slides.map((_, i) => (
                  <div
                    key={i}
                    className={`w-1 h-1 rounded-full ${
                      i === currentSlide ? "bg-white/60" : "bg-white/20"
                    }`}
                  />
                ))}
              </div>
            </div>
          )}
        </main>

        <style jsx>{`
          @keyframes orbPulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.08); }
          }
        `}</style>
      </div>
    );
  }

  // ===================== TEXT MODE =====================
  return (
    <div className="min-h-screen flex flex-col bg-black text-white">
      <header className="border-b border-white/10 px-6 py-3 flex items-center gap-3 bg-black/80 backdrop-blur">
        {prospectLogo && (
          <img src={prospectLogo} alt={prospectName} className="h-8 w-8 rounded" />
        )}
        <h1 className="font-semibold text-sm truncate flex-1">{headline}</h1>
        <button
          onClick={handleStartVoice}
          className="text-xs px-3 py-1.5 rounded-full border border-white/20 text-white/70 hover:bg-white/10 transition"
        >
          Voice Mode
        </button>
      </header>

      <main className="flex-1 relative flex items-center justify-center p-4">
        {slide ? (
          <div className="relative w-full max-w-5xl aspect-video">
            {slide.image_url ? (
              <img
                src={slide.image_url}
                alt={slide.title}
                className="w-full h-full object-contain rounded-lg"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-white/5 rounded-lg">
                <div className="text-center">
                  <p className="text-2xl font-bold">{slide.title}</p>
                  <p className="text-white/50 mt-2">{slide.description}</p>
                </div>
              </div>
            )}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
              {slides.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentSlide(i)}
                  className={`w-2 h-2 rounded-full transition-all ${
                    i === currentSlide ? "bg-white w-6" : "bg-white/30 hover:bg-white/50"
                  }`}
                />
              ))}
            </div>
          </div>
        ) : (
          <p className="text-white/50">No slides available</p>
        )}

        <div className="absolute right-4 top-4 bottom-4 w-96 flex flex-col bg-black/80 backdrop-blur-lg border border-white/10 rounded-xl overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`text-sm ${msg.role === "user" ? "text-right" : "text-left"}`}
              >
                <span
                  className={`inline-block px-3 py-2 rounded-2xl max-w-[85%] ${
                    msg.role === "user"
                      ? "bg-blue-600 text-white"
                      : "bg-white/10 text-white/90"
                  }`}
                >
                  {msg.content || (isStreaming ? "..." : "")}
                </span>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
        </div>
      </main>

      {messages.length <= 1 && suggestedQuestions.length > 0 && (
        <div className="px-6 py-2 flex gap-2 overflow-x-auto">
          {suggestedQuestions.map((q, i) => (
            <button
              key={i}
              onClick={() => sendMessage(q)}
              className="text-sm px-4 py-2 rounded-full border border-white/20 text-white/70 hover:bg-white/10 hover:text-white whitespace-nowrap transition"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="border-t border-white/10 px-6 py-4 flex gap-3 items-center"
      >
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={`Ask anything about ${prospectName}...`}
          className="flex-1 bg-white/5 border border-white/10 rounded-full px-5 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-white/30"
          disabled={isStreaming}
        />
        <button
          type="submit"
          disabled={isStreaming || !input.trim()}
          className="px-6 py-3 bg-white text-black rounded-full text-sm font-medium hover:bg-white/90 disabled:opacity-30 disabled:cursor-not-allowed transition"
        >
          Send
        </button>
      </form>
    </div>
  );
}
