"use client";

import { useState } from "react";

type Props = {
  pitchUrl: string;
  ogImageUrl: string;
  prospectName: string;
  headline?: string;
  productName?: string;
  companyName?: string;
};

export function EmailEmbedButton({
  pitchUrl,
  ogImageUrl,
  prospectName,
  headline,
  productName,
  companyName,
}: Props) {
  const [state, setState] = useState<
    "idle" | "loading" | "copied" | "fallback"
  >("idle");

  async function handleCopy() {
    setState("loading");

    // On localhost the OG image isn't publicly reachable, so fetch + base64 encode it.
    // In production (https) the URL is public — Gmail loads it directly, no base64 needed.
    let imgSrc = ogImageUrl;
    if (ogImageUrl.startsWith("http://")) {
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
        // fall back to URL
      }
    }

    const label = companyName || productName || "PitchLink";

    // Loom-style: "ProductName — Watch Pitch" + clickable thumbnail
    const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;margin:8px 0;">
  <p style="margin:0 0 8px 0;"><strong>${label}</strong> — <a href="${pitchUrl}" style="color:#1a73e8;">Watch Pitch</a></p>
  <a href="${pitchUrl}" style="display:inline-block;text-decoration:none;">
    <img src="${imgSrc}" alt="Watch personalised pitch" width="320" style="display:block;border-radius:8px;border:1px solid #e0e0e0;" />
  </a>
</div>`;

    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": new Blob([html], { type: "text/html" }),
          "text/plain": new Blob([pitchUrl], { type: "text/plain" }),
        }),
      ]);
      setState("copied");
    } catch {
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
    <button
      onClick={handleCopy}
      disabled={state === "loading"}
      title="Copy as Gmail card"
      className="flex items-center gap-1.5 text-xs text-[#555] hover:text-violet-400 transition-colors px-2 py-1 rounded-md hover:bg-violet-500/10"
    >
      {state === "loading" ? (
        <>
          <div className="w-3.5 h-3.5 border-2 border-violet-400/30 border-t-violet-400 rounded-full animate-spin" />
          <span>Preparing…</span>
        </>
      ) : state === "copied" ? (
        <>
          <svg
            className="w-3.5 h-3.5 text-emerald-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
          <span className="text-emerald-400">Copied!</span>
        </>
      ) : state === "fallback" ? (
        <>
          <svg
            className="w-3.5 h-3.5 text-emerald-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
          <span className="text-emerald-400">Link copied</span>
        </>
      ) : (
        <>
          <svg
            className="w-3.5 h-3.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
            />
          </svg>
          <span>Copy for Gmail</span>
        </>
      )}
    </button>
  );
}
