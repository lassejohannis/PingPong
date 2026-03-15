"use client";

import { useState } from "react";

type Props = {
  pitchUrl: string;
  ogImageUrl: string;
  prospectName: string;
};

export function EmailEmbedButton({ pitchUrl, ogImageUrl, prospectName }: Props) {
  const [state, setState] = useState<"idle" | "loading" | "copied" | "fallback">("idle");

  async function handleCopy() {
    setState("loading");

    // Fetch the image in the browser (works even on localhost),
    // then encode as base64 so it embeds inline in Gmail without
    // needing an external request from Gmail's servers.
    let imgSrc = ogImageUrl;
    try {
      const res = await fetch(ogImageUrl);
      const blob = await res.blob();
      imgSrc = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch {
      // If fetch fails, fall back to URL — still useful when deployed
    }

    const html =
      `<a href="${pitchUrl}" style="display:block;text-decoration:none;margin:16px 0;">` +
      `<img src="${imgSrc}" alt="Personalised pitch for ${prospectName}" width="600" ` +
      `style="border-radius:8px;border:1px solid #e5e7eb;display:block;max-width:100%;" />` +
      `</a>`;

    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": new Blob([html], { type: "text/html" }),
          "text/plain": new Blob([pitchUrl], { type: "text/plain" }),
        }),
      ]);
      setState("copied");
    } catch {
      // Browser blocked ClipboardItem — copy plain URL as fallback
      try {
        await navigator.clipboard.writeText(pitchUrl);
        setState("fallback");
      } catch {
        setState("idle");
      }
    }
    setTimeout(() => setState("idle"), 4000);
  }

  return (
    <div className="space-y-1.5">
      <button
        onClick={handleCopy}
        disabled={state === "loading"}
        className="w-full flex items-center justify-center gap-2 rounded-lg border border-violet-500/40 bg-violet-500/10 text-violet-300 hover:bg-violet-500/20 hover:border-violet-500/60 px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-60"
      >
        {state === "loading" ? (
          <>
            <div className="w-4 h-4 border-2 border-violet-400/30 border-t-violet-400 rounded-full animate-spin" />
            Preparing image…
          </>
        ) : state === "copied" ? (
          <>
            <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-emerald-400">Copied! Paste into Gmail</span>
          </>
        ) : state === "fallback" ? (
          <>
            <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-emerald-400">Link copied (upgrade browser for image)</span>
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            Copy as email thumbnail
          </>
        )}
      </button>
      {state === "copied" && (
        <p className="text-xs text-[#555] text-center">
          Paste (Cmd+V) into Gmail compose — the image will appear inline
        </p>
      )}
    </div>
  );
}
