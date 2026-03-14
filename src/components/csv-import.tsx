"use client";

import { createClient } from "@/lib/supabase/client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  projectId: string;
  projectSlug: string;
};

export function CsvImport({ projectId, projectSlug }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ imported: number; failed: number } | null>(null);
  const router = useRouter();

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setResult(null);

    const text = await file.text();
    const lines = text.trim().split("\n");
    if (lines.length < 2) {
      setLoading(false);
      return;
    }

    // Parse headers (lowercase, trimmed)
    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/"/g, ""));

    const supabase = createClient();
    let imported = 0;
    let failed = 0;

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(",").map((v) => v.trim().replace(/"/g, ""));
      const row: Record<string, string> = {};
      headers.forEach((h, idx) => {
        row[h] = values[idx] ?? "";
      });

      const companyName = row["company_name"] || row["company"] || row["name"] || "";
      if (!companyName) { failed++; continue; }

      const slug =
        companyName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") +
        "-" +
        Math.random().toString(36).slice(2, 6);

      const { error } = await supabase.from("pitch_links").insert({
        project_id: projectId,
        prospect_name: companyName,
        prospect_url: row["website"] || row["url"] || row["prospect_url"] || null,
        contact_email: row["email"] || row["contact_email"] || null,
        headline: row["notes"] || row["headline"] || companyName,
        slug,
        status: "active",
      });

      if (error) { failed++; } else { imported++; }
    }

    setResult({ imported, failed });
    setLoading(false);
    if (imported > 0) router.refresh();

    // Reset input
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div>
      <input
        ref={fileRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={handleFile}
      />
      <button
        onClick={() => fileRef.current?.click()}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
        {loading ? "Importing..." : "Import CSV"}
      </button>

      {result && (
        <p className="text-xs text-gray-500 mt-1.5">
          {result.imported} imported{result.failed > 0 ? `, ${result.failed} failed` : ""}
        </p>
      )}

      <p className="text-xs text-gray-400 mt-1">
        Expected columns: <code>company_name, website, email, notes</code>
      </p>
    </div>
  );
}
