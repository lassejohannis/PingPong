"use client";

import { useState, useEffect } from "react";

type Lead = {
  slug: string;
  prospect_name: string;
  headline: string;
  contact_email: string | null;
};

type Props = {
  projectId: string;
  projectSlug: string;
  productName: string;
  leads: Lead[];
  appUrl: string;
  gmailEmail: string | null;
};

const TONE_BUTTONS = [
  { label: "More Salesy", instruction: "Make it more persuasive and sales-focused, with urgency" },
  { label: "Shorter", instruction: "Make it significantly shorter and more concise" },
  { label: "More Formal", instruction: "Make the tone more formal and professional" },
  { label: "More Casual", instruction: "Make the tone more casual and friendly" },
  { label: "Longer", instruction: "Add more detail and context about the product's value" },
];

export function CampaignBuilder({ projectId, projectSlug, productName, leads, appUrl, gmailEmail }: Props) {
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const gmailError = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("gmail_error") : null;
  const [selectedLeadIndex, setSelectedLeadIndex] = useState(0);
  const [generating, setGenerating] = useState(true);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ sent: number; failed: number; errors?: Array<{ email: string; error: string }> } | null>(null);
  const [previewMode, setPreviewMode] = useState<"rendered" | "html">("rendered");

  useEffect(() => {
    async function generateInitial() {
      setGenerating(true);
      try {
        const res = await fetch("/api/email/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId }),
        });
        const data = await res.json();
        if (data.subject) setSubject(data.subject);
        if (data.bodyHtml) setBodyHtml(data.bodyHtml);
      } catch {
        setSubject(`A personalised pitch for {{prospect_name}}`);
        setBodyHtml(
          `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#111;font-size:15px;line-height:1.6;"><p>Hi {{prospect_name}} team,</p><p>I wanted to share something we built specifically for companies like yours.</p><a href="{{pitch_link_url}}" style="display:block;text-decoration:none;margin:24px 0;"><img src="{{og_image_url}}" alt="Watch your personalised pitch" width="600" style="border-radius:8px;border:1px solid #e5e7eb;display:block;" /></a><a href="{{pitch_link_url}}" style="display:inline-block;background:#000;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-size:14px;font-family:Arial,sans-serif;">Watch your personalised pitch →</a></div>`
        );
      } finally {
        setGenerating(false);
      }
    }
    generateInitial();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const leadsWithEmail = leads.filter((l) => l.contact_email);
  const leadsWithoutEmail = leads.length - leadsWithEmail.length;
  const selectedLead = leads[selectedLeadIndex];

  function interpolate(lead: Lead) {
    const pitchUrl = `${appUrl}/p/${lead.slug}`;
    const ogImageUrl = `${appUrl}/api/og/pitch?${new URLSearchParams({
      prospect: lead.prospect_name,
      product: productName,
      headline: lead.headline,
    })}`;
    return {
      subject: subject.replace(/\{\{prospect_name\}\}/g, lead.prospect_name),
      html: bodyHtml
        .replace(/\{\{prospect_name\}\}/g, lead.prospect_name)
        .replace(/\{\{pitch_link_url\}\}/g, pitchUrl)
        .replace(/\{\{og_image_url\}\}/g, ogImageUrl),
    };
  }

  async function handleToneAdjust(instruction: string) {
    setGenerating(true);
    try {
      const res = await fetch("/api/email/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, toneInstruction: instruction, existingTemplate: { subject, bodyHtml } }),
      });
      const data = await res.json();
      if (data.subject) setSubject(data.subject);
      if (data.bodyHtml) setBodyHtml(data.bodyHtml);
    } finally {
      setGenerating(false);
    }
  }

  async function handleSend() {
    setSending(true);
    setSendResult(null);
    try {
      const res = await fetch("/api/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, subject, bodyHtml }),
      });
      const data = await res.json();
      setSendResult({ sent: data.sent, failed: data.failed, errors: data.errors });
    } finally {
      setSending(false);
    }
  }

  const preview = selectedLead ? interpolate(selectedLead) : null;
  const returnTo = `/dashboard/${projectSlug}/campaign`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Mail Campaign</h1>
        <p className="text-sm text-gray-500 mt-1">
          AI-generated email with a personalised pitch link for each lead.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left: editor */}
        <div className="lg:col-span-2 space-y-4">
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Adjust tone</p>
            <div className="flex flex-wrap gap-2">
              {TONE_BUTTONS.map((btn) => (
                <button
                  key={btn.label}
                  onClick={() => handleToneAdjust(btn.instruction)}
                  disabled={generating}
                  className="rounded-full border px-3 py-1 text-xs font-medium hover:bg-gray-50 transition-colors disabled:opacity-40"
                >
                  {btn.label}
                </button>
              ))}
            </div>
            {generating && (
              <p className="text-xs text-gray-400 mt-2 animate-pulse">
                {subject ? "Rewriting with Claude…" : "Generating email with Claude…"}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Subject</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full border rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Email body (HTML)</label>
            <textarea
              value={bodyHtml}
              onChange={(e) => setBodyHtml(e.target.value)}
              rows={18}
              className="w-full border rounded-md px-3 py-2 text-sm font-mono outline-none focus:ring-2 focus:ring-black resize-y"
            />
            <p className="text-xs text-gray-400">
              Tokens:{" "}
              <code className="bg-gray-100 px-1 rounded">{"{{prospect_name}}"}</code>{" "}
              <code className="bg-gray-100 px-1 rounded">{"{{pitch_link_url}}"}</code>{" "}
              <code className="bg-gray-100 px-1 rounded">{"{{og_image_url}}"}</code>
            </p>
          </div>
        </div>

        {/* Right: preview */}
        <div className="lg:col-span-3 space-y-4">
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium shrink-0">Preview for:</label>
            <select
              value={selectedLeadIndex}
              onChange={(e) => setSelectedLeadIndex(Number(e.target.value))}
              className="border rounded-md px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-black flex-1"
            >
              {leads.map((lead, i) => (
                <option key={lead.slug} value={i}>
                  {lead.prospect_name}{lead.contact_email ? "" : " (no email)"}
                </option>
              ))}
            </select>
            <div className="flex rounded-md border overflow-hidden text-xs">
              <button
                onClick={() => setPreviewMode("rendered")}
                className={`px-3 py-1.5 ${previewMode === "rendered" ? "bg-black text-white" : "hover:bg-gray-50"}`}
              >
                Preview
              </button>
              <button
                onClick={() => setPreviewMode("html")}
                className={`px-3 py-1.5 border-l ${previewMode === "html" ? "bg-black text-white" : "hover:bg-gray-50"}`}
              >
                HTML
              </button>
            </div>
          </div>

          {leadsWithoutEmail > 0 && (
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
              {leadsWithoutEmail} lead{leadsWithoutEmail !== 1 ? "s" : ""} have no email address and will be skipped.
            </p>
          )}

          {preview && (
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-gray-50 border-b px-4 py-3">
                <p className="text-xs text-gray-400">Subject</p>
                <p className="text-sm font-medium">{preview.subject}</p>
              </div>
              <div className="p-4 max-h-[500px] overflow-y-auto">
                {previewMode === "rendered" ? (
                  <div className="text-sm" dangerouslySetInnerHTML={{ __html: preview.html }} />
                ) : (
                  <pre className="text-xs font-mono text-gray-700 whitespace-pre-wrap break-all">
                    {preview.html}
                  </pre>
                )}
              </div>
            </div>
          )}

          {leads.length === 0 && (
            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <p className="text-sm text-gray-500">No leads yet.</p>
              <p className="text-xs text-gray-400 mt-1">
                Add leads on the{" "}
                <a href={`/dashboard/${projectSlug}`} className="underline">Leads page</a>{" "}
                before sending a campaign.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t pt-4 flex items-center justify-between gap-4 flex-wrap">
        {gmailEmail ? (
          <p className="text-sm text-gray-500">
            Sending from <strong>{gmailEmail}</strong>
          </p>
        ) : (
          <div className="flex flex-col gap-1">
            <a
              href={`/api/auth/google?returnTo=${encodeURIComponent(returnTo)}`}
              className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              Connect Gmail to send
            </a>
            {gmailError && (
              <p className="text-xs text-red-500">{gmailError}</p>
            )}
          </div>
        )}
        <div className="flex items-center gap-4">
          {sendResult && (
            <div className="text-sm text-gray-600 max-w-sm">
              <span>{sendResult.sent} sent</span>
              {sendResult.failed > 0 && <span className="text-red-500 ml-1">, {sendResult.failed} failed</span>}
              {sendResult.errors && sendResult.errors.length > 0 && (
                <p className="text-xs text-red-500 mt-1 break-words">{sendResult.errors[0].error}</p>
              )}
            </div>
          )}
          <button
            onClick={handleSend}
            disabled={sending || leadsWithEmail.length === 0 || generating || !gmailEmail}
            className="rounded-md bg-black text-white px-5 py-2 text-sm font-medium hover:bg-gray-800 disabled:opacity-40 transition-colors"
          >
            {sending
              ? "Sending…"
              : `Send to ${leadsWithEmail.length} lead${leadsWithEmail.length !== 1 ? "s" : ""}`}
          </button>
        </div>
      </div>
    </div>
  );
}
