"use client";

import { useState, useCallback } from "react";
import {
  getAllQuestions,
  getKnowledgeScore,
  QUALITY_COLORS,
  type AgentKnowledge,
  type KnowledgeQuestion,
  type KnowledgeCategory,
  type KnowledgeQuality,
} from "@/lib/ai/knowledge-questions";

interface KnowledgeOverviewProps {
  projectId: string;
  knowledge: AgentKnowledge | null;
  systemPrompt: string | null;
  customQuestions: KnowledgeQuestion[];
  onCustomQuestionsChange: (questions: KnowledgeQuestion[]) => void;
}

const QUALITY_LABELS: Record<KnowledgeQuality, string> = {
  empty: "Not answered",
  basic: "Basic",
  good: "Good",
  excellent: "Excellent",
};

const CATEGORY_OPTIONS: KnowledgeCategory[] = ["Product", "Audience", "Sales", "Company", "Custom"];

export function KnowledgeOverview({
  projectId,
  knowledge,
  systemPrompt,
  customQuestions,
  onCustomQuestionsChange,
}: KnowledgeOverviewProps) {
  const [showPrompt, setShowPrompt] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newQuestion, setNewQuestion] = useState("");
  const [newCategory, setNewCategory] = useState<KnowledgeCategory>("Custom");
  const [isSaving, setIsSaving] = useState(false);

  const allQuestions = getAllQuestions(customQuestions);
  const score = knowledge ? getKnowledgeScore(knowledge, allQuestions) : 0;
  const categories = [...new Set(allQuestions.map((q) => q.category))];

  const handleAddQuestion = useCallback(async () => {
    if (!newQuestion.trim()) return;
    setIsSaving(true);

    const id = `custom_${Date.now()}`;
    const question: KnowledgeQuestion = {
      id,
      category: newCategory,
      question: newQuestion.trim(),
      isCustom: true,
    };

    const updated = [...customQuestions, question];

    try {
      await fetch("/api/project/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          updates: { custom_questions: updated },
        }),
      });
      onCustomQuestionsChange(updated);
      setNewQuestion("");
      setShowAddForm(false);
    } finally {
      setIsSaving(false);
    }
  }, [projectId, newQuestion, newCategory, customQuestions, onCustomQuestionsChange]);

  const handleDeleteQuestion = useCallback(async (questionId: string) => {
    const updated = customQuestions.filter((q) => q.id !== questionId);

    await fetch("/api/project/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId,
        updates: { custom_questions: updated },
      }),
    });
    onCustomQuestionsChange(updated);
  }, [projectId, customQuestions, onCustomQuestionsChange]);

  return (
    <div className="bg-[#111] border border-[#1e1e1e] rounded-xl p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-white">Knowledge Base</h2>
          <p className="text-xs text-[#555] mt-0.5">
            Quality score: {score}% — {allQuestions.length} questions
          </p>
        </div>
        <div className="flex items-center gap-2">
          {systemPrompt && (
            <button
              onClick={() => setShowPrompt(!showPrompt)}
              className="text-xs px-3 py-1.5 rounded-lg border border-[#2a2a2a] text-[#888] hover:text-white hover:border-[#444] transition-colors"
            >
              {showPrompt ? "Hide Prompt" : "View Prompt"}
            </button>
          )}
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="text-xs px-3 py-1.5 rounded-lg border border-[#2a2a2a] text-[#888] hover:text-white hover:border-[#444] transition-colors"
          >
            + Add Question
          </button>
        </div>
      </div>

      {/* Quality progress bar */}
      <div className="w-full bg-[#1a1a1a] rounded-full h-1.5">
        <div
          className="bg-violet-500 h-1.5 rounded-full transition-all duration-500"
          style={{ width: `${score}%` }}
        />
      </div>

      {/* Add question form */}
      {showAddForm && (
        <div className="bg-[#0d0d0d] border border-[#222] rounded-lg p-4 space-y-3">
          <div className="flex gap-3">
            <input
              type="text"
              value={newQuestion}
              onChange={(e) => setNewQuestion(e.target.value)}
              placeholder="What should the agent know? e.g. 'What is our onboarding process?'"
              className="flex-1 rounded-lg bg-[#111] border border-[#2a2a2a] text-white placeholder:text-[#555] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              onKeyDown={(e) => e.key === "Enter" && handleAddQuestion()}
            />
            <select
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value as KnowledgeCategory)}
              className="rounded-lg bg-[#111] border border-[#2a2a2a] text-white px-3 py-2 text-sm outline-none"
            >
              {CATEGORY_OPTIONS.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleAddQuestion}
              disabled={!newQuestion.trim() || isSaving}
              className="text-xs px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white font-medium disabled:opacity-40 transition-colors"
            >
              {isSaving ? "Adding..." : "Add"}
            </button>
            <button
              onClick={() => { setShowAddForm(false); setNewQuestion(""); }}
              className="text-xs px-3 py-1.5 text-[#555] hover:text-white transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* System prompt preview */}
      {showPrompt && systemPrompt && (
        <div className="space-y-2">
          <h3 className="text-xs font-medium text-[#666] uppercase tracking-wider">Generated System Prompt</h3>
          <textarea
            readOnly
            value={systemPrompt}
            className="w-full h-64 rounded-lg bg-[#0d0d0d] border border-[#222] text-[#ccc] text-xs font-mono p-4 resize-none outline-none"
          />
        </div>
      )}

      {/* Questions by category */}
      <div className="space-y-4">
        {categories.map((category) => (
          <div key={category}>
            <h3 className="text-xs font-medium text-[#666] uppercase tracking-wider mb-2">{category}</h3>
            <div className="space-y-2">
              {allQuestions
                .filter((q) => q.category === category)
                .map((q) => {
                  const entry = knowledge?.[q.id];
                  const quality: KnowledgeQuality = entry?.quality || "empty";
                  const hasAnswer = !!entry?.answer;
                  return (
                    <div
                      key={q.id}
                      className={`rounded-lg border px-4 py-3 group ${
                        hasAnswer
                          ? "border-[#222] bg-[#0d0d0d]"
                          : "border-[#1a1a1a] bg-[#0a0a0a]"
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <div
                          className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${QUALITY_COLORS[quality]}`}
                          title={QUALITY_LABELS[quality]}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm text-[#ccc]">{q.question}</p>
                            {hasAnswer && (
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ${
                                quality === "excellent" ? "bg-emerald-500/20 text-emerald-400" :
                                quality === "good" ? "bg-green-500/20 text-green-400" :
                                quality === "basic" ? "bg-yellow-500/20 text-yellow-400" :
                                "bg-[#222] text-[#555]"
                              }`}>
                                {QUALITY_LABELS[quality]}
                              </span>
                            )}
                            {entry?.needsReview && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 shrink-0">
                                Needs review
                              </span>
                            )}
                            {entry?.sourceType === "briefing" && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-500/20 text-violet-400 shrink-0">
                                From briefing
                              </span>
                            )}
                            {q.isCustom && (
                              <button
                                onClick={() => handleDeleteQuestion(q.id)}
                                className="text-[#333] hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all shrink-0"
                                title="Remove question"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            )}
                          </div>
                          {hasAnswer && (
                            <p className="text-xs text-[#888] mt-1 line-clamp-2">
                              {entry!.answer}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
