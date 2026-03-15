"use client";

import { useEffect, useRef, useState } from "react";

type Message = {
  role: "user" | "assistant";
  content: string;
  slide_shown?: number;
};

type Slide = {
  slide_index: number;
  title: string;
  description: string | null;
  image_url: string;
};

type Props = {
  pitchLinkId: string;
  prospectName: string;
  productName: string;
  slides: Slide[];
};

export function PitchChat({ pitchLinkId, prospectName, productName, slides }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [started, setStarted] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [currentSlide, setCurrentSlide] = useState<number | null>(
    slides.length > 0 ? 0 : null
  );
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function startConversation() {
    setStarted(true);
    setLoading(true);

    const openingMessage: Message = {
      role: "user",
      content: `Hi, I'm from ${prospectName}. I received a link to your pitch — can you tell me about ${productName}?`,
    };

    await sendMessage(openingMessage, []);
  }

  async function sendMessage(userMsg: Message, history: Message[]) {
    const newHistory = [...history, userMsg];

    if (userMsg.role === "user" && history.length > 0) {
      setMessages((prev) => [...prev, userMsg]);
    }

    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pitchLinkId,
          messages: newHistory.map(({ role, content }) => ({ role, content })),
          conversationId,
        }),
      });

      if (!res.ok) throw new Error("Chat request failed");

      const data = await res.json() as {
        text: string;
        showSlide: number | null;
        conversationId: string;
      };

      if (data.conversationId) setConversationId(data.conversationId);
      if (data.showSlide !== null && data.showSlide !== undefined) {
        setCurrentSlide(data.showSlide);
      }

      const assistantMsg: Message = {
        role: "assistant",
        content: data.text,
        ...(data.showSlide !== null ? { slide_shown: data.showSlide ?? undefined } : {}),
      };

      if (history.length === 0) {
        // First turn — show both opening user message and response
        setMessages([userMsg, assistantMsg]);
      } else {
        setMessages((prev) => [...prev, assistantMsg]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, something went wrong. Please try again." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function handleSend() {
    const text = input.trim();
    if (!text || loading) return;

    setInput("");
    const userMsg: Message = { role: "user", content: text };
    await sendMessage(userMsg, messages);
  }

  const currentSlideData = slides.find((s) => s.slide_index === currentSlide);

  return (
    <div className="flex h-[calc(100vh-56px)] overflow-hidden">
      {/* Slide panel */}
      {slides.length > 0 && (
        <div className="w-[55%] bg-[#080808] border-r border-[#222] flex flex-col">
          {currentSlideData ? (
            <>
              <div className="flex-1 flex items-center justify-center p-6">
                <img
                  src={currentSlideData.image_url}
                  alt={currentSlideData.title}
                  className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                />
              </div>
              <div className="border-t border-[#222] px-5 py-3">
                <p className="text-sm font-medium text-white">{currentSlideData.title}</p>
                {currentSlideData.description && (
                  <p className="text-xs text-[#555] mt-0.5">{currentSlideData.description}</p>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center space-y-2">
                <div className="w-16 h-16 rounded-2xl bg-violet-600/20 border border-violet-500/20 flex items-center justify-center mx-auto">
                  <svg className="w-8 h-8 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7" />
                  </svg>
                </div>
                <p className="text-sm text-[#444]">Slides will appear here</p>
              </div>
            </div>
          )}

          {/* Slide nav */}
          {slides.length > 1 && (
            <div className="border-t border-[#222] p-3 flex gap-1.5 overflow-x-auto">
              {slides.map((s) => (
                <button
                  key={s.slide_index}
                  onClick={() => setCurrentSlide(s.slide_index)}
                  className={`shrink-0 w-14 h-9 rounded overflow-hidden border-2 transition-colors ${
                    currentSlide === s.slide_index
                      ? "border-violet-500"
                      : "border-[#333] hover:border-violet-500/40"
                  }`}
                >
                  <img
                    src={s.image_url}
                    alt={s.title}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Chat panel */}
      <div className={`flex flex-col ${slides.length > 0 ? "w-[45%]" : "w-full max-w-2xl mx-auto"} bg-[#0a0a0a]`}>
        {!started ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-6 px-8">
            <div className="w-16 h-16 rounded-2xl bg-violet-600/20 border border-violet-500/20 flex items-center justify-center">
              <svg className="w-8 h-8 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            </div>
            <div className="text-center space-y-2">
              <h2 className="text-lg font-semibold text-white">
                Your personalised pitch for {prospectName}
              </h2>
              <p className="text-sm text-[#888]">
                Our AI will walk you through {productName}, answer questions, and show you the most relevant parts for your situation.
              </p>
            </div>
            <button
              onClick={startConversation}
              className="rounded-xl bg-violet-600 hover:bg-violet-700 text-white px-8 py-3 text-sm font-semibold transition-colors"
            >
              Start pitch
            </button>
          </div>
        ) : (
          <>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {msg.role === "assistant" && (
                    <div className="w-7 h-7 rounded-full bg-violet-600/20 border border-violet-500/30 flex items-center justify-center shrink-0 mr-2 mt-0.5">
                      <svg className="w-3.5 h-3.5 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                  )}
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-violet-600 text-white rounded-br-sm"
                        : "bg-[#111] text-[#ddd] border border-[#262626] rounded-bl-sm"
                    }`}
                  >
                    {msg.content}
                    {msg.slide_shown !== undefined && (
                      <button
                        onClick={() => setCurrentSlide(msg.slide_shown!)}
                        className="mt-1.5 flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300 transition-colors"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7" />
                        </svg>
                        View slide {(msg.slide_shown ?? 0) + 1}
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex justify-start">
                  <div className="w-7 h-7 rounded-full bg-violet-600/20 border border-violet-500/30 flex items-center justify-center shrink-0 mr-2 mt-0.5">
                    <svg className="w-3.5 h-3.5 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <div className="bg-[#111] border border-[#262626] rounded-2xl rounded-bl-sm px-4 py-3">
                    <div className="flex gap-1">
                      <span className="w-1.5 h-1.5 bg-[#444] rounded-full animate-bounce [animation-delay:0ms]" />
                      <span className="w-1.5 h-1.5 bg-[#444] rounded-full animate-bounce [animation-delay:150ms]" />
                      <span className="w-1.5 h-1.5 bg-[#444] rounded-full animate-bounce [animation-delay:300ms]" />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="border-t border-[#222] p-3">
              <div className="flex gap-2">
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                  placeholder="Ask a question..."
                  disabled={loading}
                  className="flex-1 rounded-xl bg-[#111] border border-[#333] text-white placeholder:text-[#444] px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-colors disabled:opacity-50"
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || loading}
                  className="rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white px-4 py-2.5 text-sm font-medium transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
