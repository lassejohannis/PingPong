"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { ProspectProfile } from "@/lib/ai/prospect-research";

type Props = {
  pitchLinkId: string;
  prospectName: string;
  hasUrl: boolean;
};

export function ProspectResearchTrigger({ pitchLinkId, prospectName, hasUrl }: Props) {
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const router = useRouter();

  useEffect(() => {
    if (!hasUrl) return;
    setStatus("loading");
    fetch("/api/research/prospect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pitchLinkId }),
    })
      .then((r) => r.json())
      .then((data: { profile?: ProspectProfile; error?: string }) => {
        if (data.error) {
          setStatus("error");
        } else {
          setStatus("done");
          router.refresh();
        }
      })
      .catch(() => setStatus("error"));
  }, [pitchLinkId, hasUrl, router]);

  if (!hasUrl) return null;

  return (
    <div className="flex items-center gap-2 text-xs">
      {status === "loading" && (
        <>
          <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
          <span className="text-[#888]">Researching {prospectName}…</span>
        </>
      )}
      {status === "done" && (
        <>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span className="text-emerald-500">Research complete</span>
        </>
      )}
      {status === "error" && (
        <span className="text-red-500">Research failed — check your API key</span>
      )}
    </div>
  );
}
