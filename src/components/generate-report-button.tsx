"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function GenerateReportButton({ conversationId }: { conversationId: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function generate() {
    setLoading(true);
    try {
      await fetch("/api/research/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId }),
      });
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={generate}
      disabled={loading}
      className="text-xs border border-[#333] text-[#888] hover:text-white hover:border-violet-500/40 rounded-lg px-3 py-1 transition-colors disabled:opacity-50"
    >
      {loading ? "Generating…" : "Generate report"}
    </button>
  );
}
