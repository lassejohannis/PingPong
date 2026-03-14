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
      {/* Company-agnostic pitch link */}
      <div className="border rounded-lg p-4 bg-gray-50 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium">Generic product pitch</p>
          <p className="text-xs text-gray-400 mt-0.5 truncate">{agnosticUrl}</p>
        </div>
        <CopyButton text={agnosticUrl} label="Copy agnostic pitch link" />
      </div>

      {/* Leads header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h2 className="text-lg font-semibold">Leads</h2>
        <div className="flex items-center gap-3">
          <CsvImport
            projectId={project.id}
            projectSlug={projectSlug}
          />
          <Link
            href={`/dashboard/${projectSlug}/campaign`}
            className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            Mail Campaign
          </Link>
          <Link
            href={`/dashboard/${projectSlug}/links/new`}
            className="rounded-md bg-black text-white px-4 py-2 text-sm font-medium hover:bg-gray-800 transition-colors"
          >
            Add lead
          </Link>
        </div>
      </div>

      {leads && leads.length > 0 ? (
        <div className="grid gap-3">
          {leads.map((lead) => (
            <Link
              key={lead.id}
              href={`/dashboard/${projectSlug}/leads/${lead.slug}`}
              className="flex items-center justify-between border rounded-lg p-4 hover:border-black transition-colors"
            >
              <div className="min-w-0">
                <h3 className="font-medium">{lead.prospect_name}</h3>
                <div className="flex gap-3 mt-0.5">
                  {lead.prospect_url && (
                    <p className="text-sm text-gray-400 truncate">{lead.prospect_url}</p>
                  )}
                  {lead.contact_email && (
                    <p className="text-sm text-gray-400">{lead.contact_email}</p>
                  )}
                </div>
              </div>
              <span
                className={`shrink-0 text-xs px-2 py-0.5 rounded font-medium ${
                  lead.status === "active"
                    ? "bg-green-100 text-green-700"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                {lead.status}
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <div className="border-2 border-dashed rounded-lg p-12 text-center">
          <p className="text-sm text-gray-500">No leads yet.</p>
          <p className="text-xs text-gray-400 mt-1">
            Add leads manually or import a CSV.
          </p>
        </div>
      )}
    </div>
  );
}
