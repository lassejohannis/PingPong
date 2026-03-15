"use client";

import { useState } from "react";

interface SuggestedQuestionsEditorProps {
  questions: string[];
  onChange: (questions: string[]) => void;
}

export function SuggestedQuestionsEditor({ questions, onChange }: SuggestedQuestionsEditorProps) {
  const [newQuestion, setNewQuestion] = useState("");

  const handleAdd = () => {
    if (!newQuestion.trim()) return;
    onChange([...questions, newQuestion.trim()]);
    setNewQuestion("");
  };

  const handleRemove = (index: number) => {
    onChange(questions.filter((_, i) => i !== index));
  };

  const handleMove = (index: number, direction: -1 | 1) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= questions.length) return;
    const updated = [...questions];
    [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
    onChange(updated);
  };

  return (
    <div className="space-y-3">
      {/* Question list */}
      {questions.map((q, i) => (
        <div key={i} className="flex items-center gap-2 group">
          <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => handleMove(i, -1)}
              disabled={i === 0}
              className="text-[#444] hover:text-white disabled:opacity-20 transition-colors"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
            </button>
            <button
              onClick={() => handleMove(i, 1)}
              disabled={i === questions.length - 1}
              className="text-[#444] hover:text-white disabled:opacity-20 transition-colors"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
          <div className="flex-1 bg-[#0d0d0d] border border-[#222] rounded-lg px-3 py-2 text-sm text-[#ccc]">
            {q}
          </div>
          <button
            onClick={() => handleRemove(i)}
            className="text-[#333] hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}

      {/* Add question */}
      <div className="flex gap-2">
        <input
          type="text"
          value={newQuestion}
          onChange={(e) => setNewQuestion(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          placeholder="Add a suggested question..."
          className="flex-1 rounded-lg bg-[#0d0d0d] border border-[#333] text-white placeholder:text-[#555] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
        />
        <button
          onClick={handleAdd}
          disabled={!newQuestion.trim()}
          className="px-3 py-2 rounded-lg border border-[#333] text-[#888] hover:text-white hover:border-violet-500/40 disabled:opacity-30 text-sm transition-colors"
        >
          Add
        </button>
      </div>
    </div>
  );
}
