import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ProspectResearchTrigger } from "@/components/prospect-research";
import type { ProspectProfile } from "@/lib/ai/prospect-research";

const FIT_COLORS = {
  high: "text-emerald-400 bg-emerald-950/60 border-emerald-800/40",
  medium: "text-yellow-400 bg-yellow-950/60 border-yellow-800/40",
  low: "text-red-400 bg-red-950/60 border-red-800/40",
};

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ projectSlug: string; leadSlug: string }>;
}) {
  const { projectSlug, leadSlug } = await params;
  const supabase = await createClient();

  type LeadRow = {
    id: string;
    slug: string;
    status: string;
    prospect_name: string;
    prospect_url: string | null;
    prospect_context: string | null;
    headline: string;
    contact_email: string | null;
    created_at: string;
  };

  const { data: lead } = (await supabase
    .from("pitch_links")
    .select("*")
    .eq("slug", leadSlug)
    .single()) as unknown as { data: LeadRow | null };

  if (!lead) redirect(`/dashboard/${projectSlug}`);

  // Parse profile if exists
  let profile: ProspectProfile | null = null;
  if ((lead as LeadRow).prospect_context) {
    try {
      profile = JSON.parse((lead as LeadRow).prospect_context!);
    } catch { /* ignore */ }
  }

  async function updateEmail(formData: FormData) {
    "use server";
    const supabase2 = await createClient();
    const email = (formData.get("contact_email") as string).trim() || null;
    await (supabase2.from("pitch_links") as ReturnType<typeof supabase2.from>)
      .update({ contact_email: email } as Record<string, unknown>)
      .eq("slug", leadSlug);
    revalidatePath(`/dashboard/${projectSlug}/leads/${leadSlug}`);
  }

  const pitchUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/p/${(lead as LeadRow).slug}`;
  const typedLead = lead as LeadRow;

  return (
    <div className="space-y-8 max-w-3xl">
      {/* Back */}
      <Link
        href={`/dashboard/${projectSlug}`}
        className="inline-flex items-center gap-1.5 text-sm text-[#555] hover:text-white transition-colors"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Leads
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-6">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white">{typedLead.prospect_name}</h1>
            {profile && (
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${
                  FIT_COLORS[profile.fit_score] ?? FIT_COLORS.medium
                }`}
              >
                {profile.fit_score} fit
              </span>
            )}
          </div>
          {typedLead.prospect_url && (
            <a
              href={typedLead.prospect_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-[#666] hover:text-violet-400 transition-colors"
            >
              {typedLead.prospect_url}
            </a>
          )}
          {typedLead.headline && typedLead.headline !== typedLead.prospect_name && (
            <p className="text-sm text-[#555]">{typedLead.headline}</p>
          )}
        </div>

        <div className="shrink-0 text-right space-y-1">
          <p className="text-xs text-[#555]">Pitch link</p>
          <code className="text-xs bg-[#111] border border-[#222] text-[#888] px-2 py-1 rounded-md block">
            {pitchUrl}
          </code>
          <a
            href={pitchUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-[#555] hover:text-violet-400 transition-colors"
          >
            Open in new tab
          </a>
        </div>
      </div>

      {/* Status + date */}
      <div className="flex items-center gap-3">
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${
            typedLead.status === "active"
              ? "bg-emerald-950/60 text-emerald-400 border-emerald-800/40"
              : "bg-[#1a1a1a] text-[#666] border-[#2a2a2a]"
          }`}
        >
          {typedLead.status}
        </span>
        <span className="text-xs text-[#555]">
          Created {new Date(typedLead.created_at).toLocaleDateString()}
        </span>
        {/* Auto-trigger research if URL exists but no profile */}
        {typedLead.prospect_url && !profile && (
          <ProspectResearchTrigger
            pitchLinkId={typedLead.id}
            prospectName={typedLead.prospect_name}
            hasUrl={!!typedLead.prospect_url}
          />
        )}
      </div>

      {/* Contact email */}
      <form action={updateEmail} className="flex items-center gap-3">
        <label className="text-sm font-medium text-[#ccc] shrink-0">Contact email</label>
        <input
          name="contact_email"
          type="email"
          defaultValue={typedLead.contact_email ?? ""}
          placeholder="jane@prospect.com"
          className="rounded-lg bg-[#111] border border-[#2a2a2a] text-white placeholder:text-[#555] px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-colors flex-1 max-w-xs"
        />
        <button
          type="submit"
          className="rounded-lg border border-[#2a2a2a] text-[#aaa] hover:text-white hover:border-[#444] px-3 py-1.5 text-sm font-medium transition-colors"
        >
          Save
        </button>
      </form>

      {/* Prospect Profile */}
      {profile && (
        <div className="bg-[#111] border border-[#1e1e1e] rounded-xl p-5 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Prospect Research</h2>
            <span className="text-xs text-[#555]">AI-generated</span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-xs text-[#555] uppercase tracking-wide">Summary</p>
              <p className="text-sm text-[#ccc]">{profile.company_summary}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-[#555] uppercase tracking-wide">Industry</p>
              <p className="text-sm text-[#ccc]">{profile.industry}</p>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs text-[#555] uppercase tracking-wide">Pain Points</p>
            <ul className="space-y-1">
              {profile.pain_points.map((pt, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-[#ccc]">
                  <span className="text-violet-400 mt-0.5">•</span>
                  {pt}
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-1">
            <p className="text-xs text-[#555] uppercase tracking-wide">Why Relevant</p>
            <p className="text-sm text-[#ccc]">{profile.relevance_mapping}</p>
          </div>

          <div className="space-y-2">
            <p className="text-xs text-[#555] uppercase tracking-wide">Likely Objections</p>
            <ul className="space-y-1">
              {profile.potential_objections.map((obj, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-[#ccc]">
                  <span className="text-yellow-400 mt-0.5">⚠</span>
                  {obj}
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-[#0d0d0d] border border-[#1e1e1e] rounded-lg p-3 space-y-1">
            <p className="text-xs text-[#555] uppercase tracking-wide">Personalised Opener</p>
            <p className="text-sm text-violet-300 italic">&ldquo;{profile.personalized_opener}&rdquo;</p>
          </div>

          <div className="flex items-start gap-2">
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border shrink-0 ${
                FIT_COLORS[profile.fit_score] ?? FIT_COLORS.medium
              }`}
            >
              {profile.fit_score} fit
            </span>
            <p className="text-sm text-[#888]">{profile.fit_reasoning}</p>
          </div>
        </div>
      )}

      {/* Agent preview link */}
      <div className="bg-[#111] border border-[#1e1e1e] rounded-xl overflow-hidden">
        <div className="border-b border-[#1e1e1e] px-4 py-3 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-white">AI Agent</h2>
            <p className="text-xs text-[#555] mt-0.5">
              Prospect view — this is what {typedLead.prospect_name} will see
            </p>
          </div>
          <a
            href={pitchUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs border border-[#2a2a2a] text-[#888] hover:text-white hover:border-[#444] rounded-lg px-3 py-1.5 transition-colors"
          >
            Open pitch
          </a>
        </div>
        <div className="h-24 flex items-center justify-center gap-3 px-4">
          <svg className="w-4 h-4 text-[#333]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <p className="text-sm text-[#444]">
            {profile
              ? `AI is ready — opens with: "${profile.personalized_opener.slice(0, 60)}…"`
              : "AI agent ready — open the pitch link to start"}
          </p>
        </div>
      </div>
    </div>
  );
}
