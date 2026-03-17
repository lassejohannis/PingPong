"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useConversation } from "@elevenlabs/react";
import { VoicePoweredOrb } from "@/components/ui/voice-powered-orb";
import type { AgentKnowledge } from "@/lib/ai/knowledge-questions";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface PendingChange {
  questionId: string;
  newAnswer: string;
  reason: string;
  rejected?: boolean;
}

interface BriefingChatProps {
  projectId: string;
  knowledge: AgentKnowledge | null;
  productName: string;
  onKnowledgeUpdate: (knowledge: AgentKnowledge, systemPrompt: string) => void;
  onActiveChange: (active: boolean) => void;
  onPendingCountChange: (count: number) => void;
  isProcessing: boolean;
}

export function BriefingChat({
  projectId, knowledge, productName,
  onKnowledgeUpdate, onActiveChange, onPendingCountChange, isProcessing,
}: BriefingChatProps) {
  const [isActive, setIsActive] = useState(false);
  const [mode, setMode] = useState<"interview" | "test">("interview");
  const [inputMode, setInputMode] = useState<"text" | "voice">("text");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<PendingChange[]>([]);
  const [showCheckpoint, setShowCheckpoint] = useState(false);
  const [checkpointSummary, setCheckpointSummary] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [pendingModeSwitch, setPendingModeSwitch] = useState<"interview" | "test" | null>(null);

  // Voice state
  const [orbState, setOrbState] = useState<"idle" | "listening" | "speaking">("idle");
  const [isVoiceConnecting, setIsVoiceConnecting] = useState(false);
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const connectingRef = useRef(false);
  const pendingChangesRef = useRef(pendingChanges);
  const isEndingSessionRef = useRef(false);

  // Keep ref in sync and notify parent of pending count changes
  useEffect(() => {
    pendingChangesRef.current = pendingChanges;
    onPendingCountChange(pendingChanges.length);
  }, [pendingChanges, onPendingCountChange]);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // --- ElevenLabs Voice ---
  const conversation = useConversation({
    clientTools: {
      propose_knowledge_update: async ({ question_id, new_answer, reason }: {
        question_id: string;
        new_answer: string;
        reason: string;
      }) => {
        setPendingChanges((prev) => [
          ...prev,
          { questionId: question_id, newAnswer: new_answer, reason },
        ]);
        return `Noted: ${reason}`;
      },
    },
    onMessage: (props: { message: string; source: string }) => {
      const role = props.source === "user" ? "user" : "assistant";
      setMessages((prev) => [...prev, { role, content: props.message }]);
    },
    onModeChange: (props: { mode: string }) => {
      if (props.mode === "speaking") setOrbState("speaking");
      else if (props.mode === "listening") setOrbState("listening");
      else setOrbState("idle");
    },
    onConnect: () => {
      setIsVoiceConnecting(false);
      setIsVoiceActive(true);
      setOrbState("listening");
    },
    onDisconnect: () => {
      setOrbState("idle");
      setIsVoiceActive(false);
      connectingRef.current = false;
    },
    onError: (message: string) => {
      console.error("Voice briefing error:", message);
      setOrbState("idle");
      setIsVoiceConnecting(false);
      setIsVoiceActive(false);
      connectingRef.current = false;
    },
  });

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // --- Voice handlers ---
  const handleStartVoice = useCallback(async () => {
    if (connectingRef.current || isVoiceActive) return;
    connectingRef.current = true;
    setIsVoiceConnecting(true);

    try {
      const res = await fetch("/api/project/briefing-voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          mode,
          conversationHistory: messages.length > 0 ? messages : undefined,
        }),
      });

      if (!res.ok) throw new Error("Failed to get voice session");

      const { signedUrl, overrides } = await res.json();
      await conversation.startSession({ signedUrl, overrides });
    } catch (err) {
      console.error("Failed to start voice:", err);
      setIsVoiceConnecting(false);
      connectingRef.current = false;
    }
  }, [projectId, mode, messages, conversation, isVoiceActive]);

  const handleStopVoice = useCallback(async () => {
    await conversation.endSession();
    setIsVoiceActive(false);
    setOrbState("idle");
    connectingRef.current = false;
  }, [conversation]);

  // --- Text chat handler ---
  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isStreaming) return;

      const userMessage: Message = { role: "user", content: text.trim() };
      const updatedMessages = [...messages, userMessage];
      setMessages(updatedMessages);
      setInput("");
      setIsStreaming(true);

      try {
        const response = await fetch("/api/project/briefing-chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId,
            mode,
            messages: updatedMessages.map((m) => ({ role: m.role, content: m.content })),
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
                    updated[updated.length - 1] = { role: "assistant", content: assistantText };
                    return updated;
                  });
                  break;

                case "knowledge_update":
                  setPendingChanges((prev) => [
                    ...prev,
                    {
                      questionId: data.questionId,
                      newAnswer: data.newAnswer,
                      reason: data.reason,
                    },
                  ]);
                  break;

                case "checkpoint":
                  setCheckpointSummary(data.summary);
                  setShowCheckpoint(true);
                  break;

                case "error":
                  setMessages((prev) => {
                    const errorMsg = data.error_type === "rate_limit"
                      ? "The agent is currently busy. Please try again in a moment."
                      : "Something went wrong. Please try again.";
                    const updated = [...prev];
                    updated[updated.length - 1] = { role: "assistant", content: errorMsg };
                    return updated;
                  });
                  break;
              }
            } catch {
              // Skip malformed SSE
            }
          }
        }
      } catch (error) {
        console.error("Briefing chat error:", error);
        setMessages((prev) => [
          ...prev.slice(0, -1),
          { role: "assistant", content: "Something went wrong. Please try again." },
        ]);
      } finally {
        setIsStreaming(false);
        inputRef.current?.focus();
      }
    },
    [messages, isStreaming, projectId, mode]
  );

  // --- Session end ---
  const endSession = useCallback(() => {
    isEndingSessionRef.current = false;
    setIsActive(false);
    onActiveChange(false);
    setMessages([]);
    setInputMode("text");
  }, [onActiveChange]);

  // --- Checkpoint / Save ---
  const handleSaveChanges = useCallback(async () => {
    if (pendingChanges.length === 0) return;
    setIsSaving(true);
    try {
      const res = await fetch("/api/project/apply-knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          changes: pendingChanges
            .filter((c) => !c.rejected)
            .map((c) => ({
              questionId: c.questionId,
              newAnswer: c.newAnswer,
            })),
        }),
      });
      if (res.ok) {
        const result = await res.json();
        onKnowledgeUpdate(result.knowledge, result.systemPrompt);
      }
      setPendingChanges([]);
      setShowCheckpoint(false);
      if (isEndingSessionRef.current) endSession();
    } catch (err) {
      console.error("Failed to save changes:", err);
    } finally {
      setIsSaving(false);
    }
  }, [projectId, pendingChanges, endSession]);

  const handleDismissCheckpoint = () => {
    setShowCheckpoint(false);
    if (pendingModeSwitch) {
      setPendingChanges([]);
      setMode(pendingModeSwitch);
      setMessages([]);
      setPendingModeSwitch(null);
    } else if (isEndingSessionRef.current) {
      setPendingChanges([]);
      endSession();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleStart = () => {
    setIsActive(true);
    onActiveChange(true);
    setMessages([]);
    setPendingChanges([]);
  };

  const handleEnd = async () => {
    if (isVoiceActive) {
      await handleStopVoice();
    }

    // Use ref to avoid stale closure — tool calls may have fired during the await
    if (pendingChangesRef.current.length > 0) {
      isEndingSessionRef.current = true;
      setCheckpointSummary("Session ending — save remaining changes?");
      setShowCheckpoint(true);
      return;
    }
    endSession();
  };

  const handleModeSwitch = (newMode: "interview" | "test") => {
    if (newMode === mode) return;
    if (isVoiceActive) return; // Block mode switch during voice
    if (pendingChanges.length > 0) {
      setCheckpointSummary(`Switching to ${newMode} mode — save your changes first?`);
      setShowCheckpoint(true);
      setPendingModeSwitch(newMode);
      return;
    }
    setMode(newMode);
    setMessages([]);
  };

  const handleInputModeSwitch = async (newInputMode: "text" | "voice") => {
    if (newInputMode === inputMode) return;
    // Stop voice if switching away
    if (inputMode === "voice" && isVoiceActive) {
      await handleStopVoice();
    }
    setInputMode(newInputMode);
  };

  // Inactive state
  if (!isActive) {
    return (
      <div className="bg-[#111] border border-[#262626] rounded-xl p-6 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-white">Agent Briefing</h2>
          <p className="text-xs text-[#555] mt-0.5">
            Interview the AI or test it as a prospect to refine its knowledge.
          </p>
        </div>
        <button
          onClick={handleStart}
          disabled={isProcessing}
          title={isProcessing ? "Wait for document processing to finish" : undefined}
          className="rounded-lg bg-violet-600 hover:bg-violet-700 text-white px-4 py-2.5 text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Start Briefing
        </button>
      </div>
    );
  }

  const orbLabel = orbState === "speaking"
    ? "Speaking..."
    : orbState === "listening"
    ? "Listening..."
    : isVoiceConnecting
    ? "Connecting..."
    : "Ready";

  return (
    <div className="bg-[#111] border border-[#262626] rounded-xl overflow-hidden">
      {/* Header with toggles */}
      <div className="border-b border-[#262626] px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-white">Agent Briefing</h2>

          {/* Interview / Test toggle */}
          <div className="flex bg-[#0d0d0d] rounded-lg p-0.5 border border-[#222]">
            <button
              onClick={() => handleModeSwitch("interview")}
              disabled={isVoiceActive}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${
                mode === "interview"
                  ? "bg-violet-600 text-white"
                  : "text-[#888] hover:text-white"
              } disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              Interview
            </button>
            <button
              onClick={() => handleModeSwitch("test")}
              disabled={isVoiceActive}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${
                mode === "test"
                  ? "bg-violet-600 text-white"
                  : "text-[#888] hover:text-white"
              } disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              Test
            </button>
          </div>

          {/* Text / Voice toggle */}
          <div className="flex bg-[#0d0d0d] rounded-lg p-0.5 border border-[#222]">
            <button
              onClick={() => handleInputModeSwitch("text")}
              className={`px-2 py-1 text-xs rounded-md transition-colors ${
                inputMode === "text"
                  ? "bg-[#222] text-white"
                  : "text-[#888] hover:text-white"
              }`}
              title="Text mode"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            </button>
            <button
              onClick={() => handleInputModeSwitch("voice")}
              className={`px-2 py-1 text-xs rounded-md transition-colors ${
                inputMode === "voice"
                  ? "bg-[#222] text-white"
                  : "text-[#888] hover:text-white"
              }`}
              title="Voice mode"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </button>
          </div>

          {pendingChanges.length > 0 && (
            <span className="text-[10px] bg-violet-500/20 text-violet-400 px-2 py-0.5 rounded-full">
              {pendingChanges.length} pending
            </span>
          )}
        </div>

        <button
          onClick={handleEnd}
          className="text-xs text-[#555] hover:text-white transition-colors"
        >
          End Session
        </button>
      </div>

      {/* Content area */}
      <div className="h-[420px] flex flex-col">
        {inputMode === "voice" ? (
          /* --- Voice Mode UI --- */
          <div className="flex-1 flex flex-col items-center justify-center gap-6 p-5">
            {/* Orb */}
            <div className="relative w-32 h-32">
              <VoicePoweredOrb
                enableVoiceControl={isVoiceActive}
                externalIntensity={orbState === "speaking" ? 0.4 : orbState === "listening" ? 0.08 : 0}
                hue={orbState === "speaking" ? 280 : orbState === "listening" ? 120 : 0}
                className={`rounded-full overflow-hidden ${isVoiceConnecting ? "opacity-50" : ""}`}
              />
              {pendingChanges.length > 0 && (
                <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-violet-600 text-white text-[10px] font-bold flex items-center justify-center border-2 border-[#111] z-10">
                  {pendingChanges.length}
                </div>
              )}
            </div>

            {/* Status */}
            <p className="text-sm text-[#888]">{orbLabel}</p>

            {/* Start/Stop button */}
            {!isVoiceActive && !isVoiceConnecting ? (
              <button
                onClick={handleStartVoice}
                className="px-6 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium transition-colors"
              >
                Start Voice
              </button>
            ) : isVoiceConnecting ? (
              <button
                disabled
                className="px-6 py-2.5 rounded-lg bg-[#222] text-[#888] text-sm font-medium cursor-not-allowed"
              >
                Connecting...
              </button>
            ) : (
              <button
                onClick={handleStopVoice}
                className="px-6 py-2.5 rounded-lg bg-red-600/20 hover:bg-red-600/30 text-red-400 text-sm font-medium border border-red-500/30 transition-colors"
              >
                Stop Voice
              </button>
            )}

            {/* Recent transcript snippet */}
            {messages.length > 0 && (
              <div className="w-full max-w-md">
                <p className="text-xs text-[#555] text-center truncate">
                  {messages[messages.length - 1].role === "user" ? "You: " : "Agent: "}
                  {messages[messages.length - 1].content}
                </p>
              </div>
            )}
          </div>
        ) : (
          /* --- Text Mode UI --- */
          <div className="flex-1 p-5 space-y-4 overflow-y-auto">
            {messages.length === 0 && (
              <div className="flex gap-3">
                <div className="w-7 h-7 rounded-full bg-violet-600/20 border border-violet-500/30 flex items-center justify-center shrink-0 mt-0.5">
                  <svg className="w-3.5 h-3.5 text-violet-400" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z" />
                  </svg>
                </div>
                <div className="bg-[#1a1a1a] border border-[#222] rounded-xl px-4 py-3 text-sm max-w-lg text-[#ccc]">
                  {mode === "interview" ? (
                    <>Ready to learn about <span className="text-white font-medium">{productName}</span>. Send a message to start the interview.</>
                  ) : (
                    <>I&apos;m your sales agent for <span className="text-white font-medium">{productName}</span>. Ask me anything like a prospect would. Correct me if I get something wrong.</>
                  )}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}>
                {msg.role === "assistant" && (
                  <div className="w-7 h-7 rounded-full bg-violet-600/20 border border-violet-500/30 flex items-center justify-center shrink-0 mt-0.5">
                    <svg className="w-3.5 h-3.5 text-violet-400" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z" />
                    </svg>
                  </div>
                )}
                <div
                  className={`rounded-xl px-4 py-3 text-sm max-w-lg ${
                    msg.role === "user"
                      ? "bg-violet-600 text-white"
                      : "bg-[#1a1a1a] border border-[#222] text-[#ccc]"
                  }`}
                >
                  {msg.content || (isStreaming ? "..." : "")}
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
        )}

        {/* Checkpoint dialog (shared between text and voice) */}
        {showCheckpoint && (
          <div className="border-t border-[#262626] bg-[#0d0d0d] p-4 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-violet-400" />
              <p className="text-sm font-medium text-white">Checkpoint</p>
            </div>
            <p className="text-xs text-[#888]">{checkpointSummary}</p>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {pendingChanges.map((change, i) => (
                <div
                  key={i}
                  className={`flex items-start gap-3 border rounded-lg px-3 py-2 text-xs transition-colors ${
                    change.rejected
                      ? "bg-[#0a0a0a] border-[#222] opacity-50"
                      : "bg-[#111] border-[#222]"
                  }`}
                >
                  <button
                    onClick={() => {
                      setPendingChanges((prev) =>
                        prev.map((c, j) => j === i ? { ...c, rejected: !c.rejected } : c)
                      );
                    }}
                    className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                      change.rejected
                        ? "border-[#333] bg-[#111]"
                        : "border-emerald-500 bg-emerald-500/20 text-emerald-400"
                    }`}
                  >
                    {!change.rejected && (
                      <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-[#888]">{change.reason}</p>
                    <p className={`mt-1 ${change.rejected ? "text-[#555] line-through" : "text-emerald-400"}`}>
                      {change.newAnswer.slice(0, 120)}{change.newAnswer.length > 120 ? "..." : ""}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSaveChanges}
                disabled={isSaving || pendingChanges.every((c) => c.rejected)}
                className="text-xs px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium disabled:opacity-50 transition-colors"
              >
                {isSaving ? "Saving..." : `Save ${pendingChanges.filter((c) => !c.rejected).length} Change(s)`}
              </button>
              <button
                onClick={handleDismissCheckpoint}
                className="text-xs px-3 py-1.5 rounded-lg border border-[#333] text-[#888] hover:text-white transition-colors"
              >
                Discard All
              </button>
            </div>
          </div>
        )}

        {/* Text input (only in text mode) */}
        {inputMode === "text" && (
          <form onSubmit={handleSubmit} className="border-t border-[#222] p-3">
            <div className="flex gap-2 items-center">
              <textarea
                ref={inputRef}
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage(input);
                  }
                }}
                placeholder={
                  mode === "interview"
                    ? "Answer the AI's questions…"
                    : "Ask like a prospect…"
                }
                disabled={isStreaming || showCheckpoint}
                className="flex-1 bg-[#0d0d0d] border border-[#222] rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-[#444] outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent disabled:opacity-50 transition-colors resize-none"
              />
              <button
                type="submit"
                disabled={isStreaming || showCheckpoint || !input.trim()}
                className="px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-medium disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                Send
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
