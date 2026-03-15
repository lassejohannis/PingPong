"use client";

import { useRef, useState } from "react";

type Props = {
  pitchLinkId: string;
  currentLogoUrl: string | null;
};

export function LeadLogoUpload({ pitchLinkId, currentLogoUrl }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(currentLogoUrl);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setUploading(true);
    setError(null);

    const fd = new FormData();
    fd.append("file", file);
    fd.append("pitchLinkId", pitchLinkId);

    const res = await fetch("/api/lead/logo", { method: "POST", body: fd });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error ?? "Upload failed");
    } else {
      setPreview(data.logoUrl);
    }
    setUploading(false);
  }

  return (
    <div className="shrink-0">
      <div
        onClick={() => fileRef.current?.click()}
        className="relative w-14 h-14 rounded-xl bg-[#0d0d0d] border border-[#333] hover:border-violet-500/50 flex items-center justify-center cursor-pointer overflow-hidden transition-colors group"
        title={preview ? "Change logo" : "Upload logo"}
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="Lead logo" className="w-full h-full object-cover" />
        ) : (
          <svg className="w-5 h-5 text-[#333] group-hover:text-[#555] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        )}
        {uploading && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          </div>
        )}
      </div>
      {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
      <input
        ref={fileRef}
        type="file"
        accept=".png,.jpg,.jpeg,.svg,.webp"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
      />
    </div>
  );
}
