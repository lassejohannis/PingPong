"use client";

import { useState } from "react";

type Props = {
  pitchUrl: string;
  ogImageUrl: string;
  prospectName: string;
  headline?: string;
  productName?: string;
};

export function EmailEmbedButton({
  pitchUrl,
  ogImageUrl,
  prospectName,
  headline,
  productName,
}: Props) {
  const [state, setState] = useState<
    "idle" | "loading" | "copied" | "fallback"
  >("idle");

  async function handleCopy() {
    setState("loading");

    // Fetch the OG image and encode as base64 so it embeds inline in Gmail
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
      // If fetch fails, fall back to URL
    }

    const title = headline || `A personalised pitch for ${prospectName}`;
    const subtitle = productName
      ? `${productName} prepared this interactive pitch for you`
      : "An interactive AI-powered pitch prepared just for you";

    const html = `<div style="margin:16px 0;max-width:600px;">
  <a href="${pitchUrl}" style="text-decoration:none;color:inherit;display:block;">
    <div style="border:1px solid #e0e0e0;border-radius:12px;overflow:hidden;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
      <img src="${imgSrc}" alt="Pitch preview" width="600" style="display:block;width:100%;border-bottom:1px solid #e0e0e0;" />
      <div style="padding:16px 20px;">
        <div style="font-size:16px;font-weight:600;color:#111111;line-height:1.3;margin-bottom:4px;">${title}</div>
        <div style="font-size:13px;color:#666666;line-height:1.4;">${subtitle}</div>
      </div>
    </div>
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
