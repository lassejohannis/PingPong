"use client";

import { useState } from "react";

interface Suggestion {
  questionId: string;
  newAnswer: string;
  reason: string;
  rejected?: boolean;
}

interface SynthesizeConversationsProps {
  projectId: string;
  reportCount: number;
}

export function SynthesizeConversations({
  projectId,
  reportCount,
}: SynthesizeConversationsProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversationCount, setConversationCount] = useState<number | null>(null);

  const handleSynthesize = async () => {
    setIsLoading(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/research/synthesize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error);
        return;
      }
      setSuggestions(
        data.suggestions.map((s: Omit<Suggestion, "rejected">) => ({ ...s, rejected: false }))
      );
      setConversationCount(data.conversationCount);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleApply = async () => {
    const accepted = suggestions.filter((s) => !s.rejected);
    if (accepted.length === 0) return;
    setIsSaving(true);
    try {
      const res = await fetch("/api/project/apply-knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          changes: accepted.map((s) => ({
            questionId: s.questionId,
            newAnswer: s.newAnswer,
          })),
        }),
      });
      if (res.ok) {
        setSaved(true);
        setSuggestions([]);
      } else {
        const data = await res.json();
        setError(data.error ?? "Failed to apply updates.");
      }
    } catch {
      setError("Something went wrong while saving.");
    } finally {
      setIsSaving(false);
    }
  };

  const toggleRejected = (index: number) => {
    setSuggestions((prev) =>
      prev.map((s, i) => (i === index ? { ...s, rejected: !s.rejected } : s))
    );
  };

  // After save — show confirmation
  if (saved) {
    return (
      <div className="bg-[#111] border border-[#262626] rounded-xl p-5">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400" />
          <p className="text-sm font-semibold text-white">Agent Learning</p>
        </div>
        <p className="text-xs text-emerald-400 mt-1">Applied! Knowledge base updated successfully.</p>
      </div>
    );
  }

  // Suggestions view
  if (suggestions.length > 0) {
    const acceptedCount = suggestions.filter((s) => !s.rejected).length;

    return (
      <div className="bg-[#111] border border-[#262626] rounded-xl p-5 space-y-4">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-violet-400" />
            <h2 className="text-sm font-semibold text-white">
              Agent Learning — {conversationCount} conversation{conversationCount !== 1 ? "s" : ""} analyzed
            </h2>
          </div>
          <p className="text-xs text-[#555] mt-0.5 ml-4">
            {acceptedCount} suggested improvement{acceptedCount !== 1 ? "s" : ""}
          </p>
        </div>

        {/* Suggestions list */}
        <div className="space-y-2 max-h-72 overflow-y-auto">
          {suggestions.map((suggestion, i) => (
            <div
              key={i}
              className={`flex items-start gap-3 border rounded-lg px-3 py-2 text-xs transition-colors ${
                suggestion.rejected
                  ? "bg-[#0a0a0a] border-[#222] opacity-50"
                  : "bg-[#0d0d0d] border-[#222]"
              }`}
            >
              <button
                onClick={() => toggleRejected(i)}
                className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                  suggestion.rejected
                    ? "border-[#333] bg-[#111]"
                    : "border-emerald-500 bg-emerald-500/20 text-emerald-400"
                }`}
              >
                {!suggestion.rejected && (
                  <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={3}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                )}
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-[#888]">{suggestion.reason}</p>
                <p
                  className={`mt-1 ${
                    suggestion.rejected ? "text-[#555] line-through" : "text-emerald-400"
                  }`}
                >
                  {suggestion.newAnswer.slice(0, 140)}
                  {suggestion.newAnswer.length > 140 ? "..." : ""}
                </p>
              </div>
            </div>
          ))}
        </div>

        {error && <p className="text-xs text-red-400">{error}</p>}

        {/* Action buttons */}
        <div className="flex gap-2">
          <button
            onClick={handleApply}
            disabled={isSaving || acceptedCount === 0}
            className="text-xs px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium disabled:opacity-50 transition-colors"
          >
            {isSaving ? "Applying..." : `Apply ${acceptedCount} Update${acceptedCount !== 1 ? "s" : ""}`}
          </button>
          <button
            onClick={() => setSuggestions([])}
            className="text-xs px-3 py-1.5 rounded-lg border border-[#333] text-[#888] hover:text-white transition-colors"
          >
            Dismiss
          </button>
        </div>
      </div>
    );
  }

  // Default / idle view
  return (
    <div className="bg-[#111] border border-[#262626] rounded-xl p-5 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-white">Agent Learning</h2>
          <p className="text-xs text-[#555] mt-0.5">
            Analyze {reportCount} report{reportCount !== 1 ? "s" : ""} to find patterns and suggest
            knowledge improvements.
          </p>
        </div>
        <button
          onClick={handleSynthesize}
          disabled={isLoading || reportCount < 2}
          className="shrink-0 text-xs px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? "Analyzing..." : "Synthesize"}
        </button>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      {reportCount < 2 && (
        <p className="text-xs text-[#444]">Need at least 2 reports to synthesize.</p>
      )}
    </div>
  );
}
