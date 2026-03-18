"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { LogoUpload } from "./logo-upload";
import { SuggestedQuestionsEditor } from "./suggested-questions-editor";
import { PitchPreview } from "./pitch-preview";

interface PitchPageEditorProps {
  projectId: string;
  projectSlug: string;
  companyName: string;
  settings: Record<string, unknown>;
  defaultQuestions: string[];
  presentationDocId: string | null;
  presentationDocName: string | null;
}

export function PitchPageEditor({
  projectId,
  projectSlug,
  companyName,
  settings,
  defaultQuestions,
  presentationDocId: initialPresentationDocId,
  presentationDocName: initialPresentationDocName,
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
  const [calendarBookingEnabled, setCalendarBookingEnabled] = useState(
    (settings.calendar_booking_enabled as boolean) ?? false
  );
  const [requireEmailGate, setRequireEmailGate] = useState(
    (settings.require_email_gate as boolean) ?? false
  );
  const [emailGateInfoText, setEmailGateInfoText] = useState(
    (settings.email_gate_info_text as string) ?? ""
  );
  const [presentationDocName, setPresentationDocName] = useState<string | null>(initialPresentationDocName);
  const [isUploadingPdf, setIsUploadingPdf] = useState(false);
  const [pdfUploadError, setPdfUploadError] = useState<string | null>(null);
  const [pdfUploadDone, setPdfUploadDone] = useState(false);
  const pdfInputRef = useRef<HTMLInputElement>(null);

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
            calendar_booking_enabled: calendarBookingEnabled,
            require_email_gate: requireEmailGate,
            email_gate_info_text: emailGateInfoText.trim() || null,
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
  }, [projectId, headline, openingMessage, suggestedQuestions, calendarLink, calendarBookingEnabled, requireEmailGate, emailGateInfoText]);

  const handlePdfUpload = useCallback(async (file: File) => {
    if (!file) return;
    setIsUploadingPdf(true);
    setPdfUploadError(null);
    setPdfUploadDone(false);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("projectId", projectId);
      const uploadRes = await fetch("/api/project/documents", { method: "POST", body: formData });
      if (!uploadRes.ok) {
        const data = await uploadRes.json();
        throw new Error(data.error || "Upload failed");
      }
      const { document } = await uploadRes.json();

      await fetch("/api/project/documents/set-presentation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, documentId: document.id }),
      });

      setPresentationDocName(document.file_name);
      setPdfUploadDone(true);
      setTimeout(() => setPdfUploadDone(false), 3000);
    } catch (err) {
      setPdfUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploadingPdf(false);
    }
  }, [projectId]);

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

          {/* Pitch Deck PDF */}
          <div className="space-y-2 pt-2 border-t border-[#1e1e1e]">
            <label className="text-sm font-medium text-[#ccc]">Pitch Deck</label>

            {presentationDocName && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#0d0d0d] border border-[#262626]">
                <div className="w-6 h-6 rounded bg-red-500/20 border border-red-500/30 flex items-center justify-center shrink-0">
                  <span className="text-[9px] font-bold text-red-400">PDF</span>
                </div>
                <span className="text-xs text-[#ccc] truncate flex-1">{presentationDocName}</span>
                <button
                  onClick={() => pdfInputRef.current?.click()}
                  className="text-[10px] text-[#555] hover:text-violet-400 transition-colors shrink-0"
                >
                  Replace
                </button>
              </div>
            )}

            <input
              ref={pdfInputRef}
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handlePdfUpload(file);
                e.target.value = "";
              }}
            />

            {!presentationDocName && (
              <button
                onClick={() => pdfInputRef.current?.click()}
                disabled={isUploadingPdf}
                className="w-full flex items-center justify-center gap-2 border border-dashed border-[#333] hover:border-violet-500/40 rounded-lg py-3 text-sm text-[#555] hover:text-violet-400 transition-colors disabled:opacity-40"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                </svg>
                {isUploadingPdf ? "Uploading…" : "Upload PDF"}
              </button>
            )}

            {isUploadingPdf && <p className="text-xs text-violet-400">Uploading…</p>}
            {pdfUploadDone && <p className="text-xs text-emerald-400">Uploaded! Go to Agent Tuning → Documents to process it into slides.</p>}
            {pdfUploadError && <p className="text-xs text-red-400">{pdfUploadError}</p>}
          </div>
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

          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-[#ccc]">AI Calendar Booking</label>
              <p className="text-xs text-[#555]">Let the AI check your availability and book meetings directly during the pitch.</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={calendarBookingEnabled}
              onClick={() => setCalendarBookingEnabled(!calendarBookingEnabled)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${calendarBookingEnabled ? "bg-violet-600" : "bg-[#333]"}`}
            >
              <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg transition-transform ${calendarBookingEnabled ? "translate-x-5" : "translate-x-0"}`} />
            </button>
          </div>

          <div className="space-y-1.5 border-t border-[#262626] pt-4">
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

          <div className="space-y-3 pt-2 border-t border-[#262626]">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-[#ccc]">Email Gate</label>
                <p className="text-xs text-[#555]">Require prospects to enter their email before starting.</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={requireEmailGate}
                onClick={() => setRequireEmailGate(!requireEmailGate)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                  requireEmailGate ? "bg-violet-600" : "bg-[#333]"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg transition-transform ${
                    requireEmailGate ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {requireEmailGate && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-[#ccc]">
                  Info text <span className="text-[#444] font-normal">(optional)</span>
                </label>
                <textarea
                  value={emailGateInfoText}
                  onChange={(e) => setEmailGateInfoText(e.target.value)}
                  placeholder="We collect your email so we can follow up with relevant information."
                  rows={2}
                  className="w-full rounded-lg bg-[#0d0d0d] border border-[#333] text-white placeholder:text-[#555] px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-colors resize-none"
                />
                <p className="text-xs text-[#555]">Shown below the email input. Leave empty for the default message.</p>
              </div>
            )}
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
