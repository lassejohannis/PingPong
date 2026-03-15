import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { CopyButton } from "@/components/copy-button";
import { CsvImport } from "@/components/csv-import";

export default async function LeadsPage({
  params,
}: {
  params: Promise<{ projectSlug: string }>;
}) {
  const { projectSlug } = await params;
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id, company_name")
    .eq("slug", projectSlug)
    .single();

  if (!project) return null;

  type LeadRow = {
    id: string; slug: string; status: string; prospect_name: string;
    prospect_url: string | null; contact_email: string | null;
  };
  const { data: leads } = await supabase
    .from("pitch_links")
    .select("id, slug, status, prospect_name, prospect_url, contact_email")
    .eq("project_id", project.id)
    .order("created_at", { ascending: false })
    .returns<LeadRow[]>();

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const agnosticUrl = `${appUrl}/p/${projectSlug}`;

  return (
    <div className="space-y-6">
      {/* Generic pitch link */}
      <div className="bg-[#111] border border-[#222] rounded-xl p-4 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-white">Generic product pitch</p>
          <p className="text-xs text-[#555] mt-0.5 truncate">{agnosticUrl}</p>
        </div>
        <CopyButton text={agnosticUrl} label="Copy agnostic pitch link" />
      </div>

      {/* Leads header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h2 className="text-lg font-semibold text-white">Leads</h2>
        <div className="flex items-center gap-3">
          <CsvImport projectId={project.id} projectSlug={projectSlug} />
          <Link
            href={`/dashboard/${projectSlug}/campaign`}
            className="rounded-lg border border-[#2a2a2a] text-[#aaa] hover:text-white hover:border-[#444] px-4 py-2 text-sm font-medium transition-colors"
          >
            Mail Campaign
          </Link>
          <Link
            href={`/dashboard/${projectSlug}/links/new`}
            className="rounded-lg bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 text-sm font-medium transition-colors"
          >
            Add lead
          </Link>
        </div>
      </div>

      {leads && leads.length > 0 ? (
        <div className="grid gap-2">
          {leads.map((lead) => (
            <Link
              key={lead.id}
              href={`/dashboard/${projectSlug}/leads/${lead.slug}`}
              className="flex items-center justify-between bg-[#111] border border-[#222] hover:border-violet-500/50 rounded-xl p-4 transition-colors group"
            >
              <div className="min-w-0">
                <h3 className="font-medium text-white group-hover:text-violet-300 transition-colors">{lead.prospect_name}</h3>
                <div className="flex gap-3 mt-0.5">
                  {lead.prospect_url && (
                    <p className="text-sm text-[#555] truncate">{lead.prospect_url}</p>
                  )}
                  {lead.contact_email && (
                    <p className="text-sm text-[#555]">{lead.contact_email}</p>
                  )}
                </div>
              </div>
              <span
                className={`shrink-0 text-xs px-2 py-0.5 rounded-md font-medium ${
                  lead.status === "active"
                    ? "bg-emerald-950/60 text-emerald-400 border border-emerald-800/40"
                    : "bg-[#1a1a1a] text-[#666] border border-[#2a2a2a]"
                }`}
              >
                {lead.status}
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <div className="border-2 border-dashed border-[#1e1e1e] rounded-xl p-12 text-center">
          <p className="text-sm text-[#555]">No leads yet.</p>
          <p className="text-xs text-[#444] mt-1">Add leads manually or import a CSV.</p>
        </div>
      )}
    </div>
  );
}
