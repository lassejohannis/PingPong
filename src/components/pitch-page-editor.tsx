"use client";

import { useState, useCallback, useEffect } from "react";
import { LogoUpload } from "./logo-upload";
import { SuggestedQuestionsEditor } from "./suggested-questions-editor";
import { PitchPreview } from "./pitch-preview";

interface PitchPageEditorProps {
  projectId: string;
  projectSlug: string;
  companyName: string;
  settings: Record<string, unknown>;
  defaultQuestions: string[];
}

export function PitchPageEditor({
  projectId,
  projectSlug,
  companyName,
  settings,
  defaultQuestions,
}: PitchPageEditorProps) {
  const [headline, setHeadline] = useState(
    (settings.default_headline as string) ?? `How ${companyName} can help`
  );
  const [openingMessage, setOpeningMessage] = useState(
    (settings.opening_message as string) ?? ""
  );
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>(
    (settings.suggested_questions as string[]) ?? defaultQuestions
  );
  const [calendarLink, setCalendarLink] = useState(
    (settings.calendar_link as string) ?? ""
  );
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!isSaving) return;
    const handle = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", handle);
    return () => window.removeEventListener("beforeunload", handle);
  }, [isSaving]);
  const [logoUrl, setLogoUrl] = useState((settings.logo_url as string) ?? null);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/project/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          updates: {
            default_headline: headline.trim(),
            opening_message: openingMessage.trim() || null,
            suggested_questions: suggestedQuestions,
            calendar_link: calendarLink.trim() || null,
          },
        }),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } finally {
      setIsSaving(false);
    }
  }, [projectId, headline, openingMessage, suggestedQuestions, calendarLink]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Pitch Page</h1>
        <p className="text-sm text-[#888] mt-1">Customize what prospects see when they open your pitch link.</p>
      </div>

      {/* Preview — full width at the top */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Live Preview</h2>
          <p className="text-[10px] text-[#444]">Updates as you type</p>
        </div>
        <PitchPreview
          headline={headline}
          openingMessage={openingMessage}
          suggestedQuestions={suggestedQuestions}
          logoUrl={logoUrl}
          companyName={companyName}
        />
      </div>

      {/* Settings */}
      <div className="space-y-5">
        {/* Branding */}
        <div className="bg-[#111] border border-[#262626] rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-white">Branding</h2>
          <LogoUpload
            projectId={projectId}
            currentLogoUrl={(settings.logo_url as string) ?? null}
            onLogoChange={setLogoUrl}
          />
        </div>

        {/* Content */}
        <div className="bg-[#111] border border-[#262626] rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-white">Content</h2>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-[#ccc]">Headline</label>
            <input
              type="text"
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              placeholder={`How ${companyName} can help`}
              className="w-full rounded-lg bg-[#0d0d0d] border border-[#333] text-white placeholder:text-[#555] px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-colors"
            />
            <p className="text-xs text-[#555]">Shown at the top of the pitch page. Per-lead headlines override this.</p>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-[#ccc]">
              Opening Message <span className="text-[#444] font-normal">(optional)</span>
            </label>
            <textarea
              value={openingMessage}
              onChange={(e) => setOpeningMessage(e.target.value)}
              placeholder={`Leave empty for auto-generated: "Hey! I can walk you through how ${companyName} can help..."`}
              rows={3}
              className="w-full rounded-lg bg-[#0d0d0d] border border-[#333] text-white placeholder:text-[#555] px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-colors resize-none"
            />
            <p className="text-xs text-[#555]">The first message the AI sends. Leave empty to auto-generate per prospect.</p>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-[#ccc]">Suggested Questions</label>
            <SuggestedQuestionsEditor
              questions={suggestedQuestions}
              onChange={setSuggestedQuestions}
            />
            <p className="text-xs text-[#555]">Shown as quick-reply buttons on the first visit.</p>
          </div>
        </div>

        {/* Settings */}
        <div className="bg-[#111] border border-[#262626] rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-white">Settings</h2>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-[#ccc]">
              Calendar link <span className="text-[#444] font-normal">(optional)</span>
            </label>
            <input
              type="url"
              value={calendarLink}
              onChange={(e) => setCalendarLink(e.target.value)}
              placeholder="https://cal.com/yourname"
              className="w-full rounded-lg bg-[#0d0d0d] border border-[#333] text-white placeholder:text-[#555] px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-colors"
            />
            <p className="text-xs text-[#555]">The AI will share this link when a prospect wants to book a call.</p>
          </div>
        </div>

        {/* Save */}
        <div className="flex items-center justify-end gap-3">
          {saved && <span className="text-xs text-emerald-400">Saved!</span>}
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="rounded-lg bg-violet-600 hover:bg-violet-700 text-white px-5 py-2.5 text-sm font-medium disabled:opacity-40 transition-colors"
          >
            {isSaving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
