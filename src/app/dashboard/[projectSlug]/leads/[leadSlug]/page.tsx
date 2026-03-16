import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ProspectResearchTrigger } from "@/components/prospect-research";
import { LeadLogoUpload } from "@/components/lead-logo-upload";
import { EmailEmbedButton } from "@/components/email-embed-button";
import { LeadCopyButton } from "@/components/lead-copy-button";
import { CollapsibleSection } from "@/components/ui/collapsible-section";
import ConversationCard from "./conversation-card";
import type { ProspectProfile } from "@/lib/ai/prospect-research";
import type { ConversationReport } from "@/app/api/research/report/route";

const FIT_COLORS = {
  high: "text-emerald-400 bg-emerald-950/60 border-emerald-800/40",
  medium: "text-yellow-400 bg-yellow-950/60 border-yellow-800/40",
  low: "text-red-400 bg-red-950/60 border-red-800/40",
};

const INTEREST_COLORS = {
  HOT: "bg-red-950/60 text-red-400 border-red-800/40",
  WARM: "bg-yellow-950/60 text-yellow-400 border-yellow-800/40",
  NOT_A_FIT: "bg-[#1a1a1a] text-[#888] border-[#333]",
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
    project_id: string;
    status: string;
    prospect_name: string;
    first_name: string | null;
    last_name: string | null;
    prospect_url: string | null;
    prospect_context: string | null;
    prospect_logo: string | null;
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

  const { data: project } = await supabase
    .from("projects")
    .select("company_name, settings, user_id")
    .eq("id", lead.project_id)
    .single();

  const projectSettings = (
    project?.settings && typeof project.settings === "object" && !Array.isArray(project.settings)
      ? project.settings
      : {}
  ) as Record<string, unknown>;
  const productName = (projectSettings.product_name as string) || project?.company_name || "";

  // Fetch the seller's company name from the users table for the Gmail embed label
  let sellerCompanyName = productName;
  if (project?.user_id) {
    const { data: userProfile } = await supabase
      .from("users")
      .select("company_name")
      .eq("id", project.user_id)
      .single();
    if (userProfile?.company_name) sellerCompanyName = userProfile.company_name;
  }

  let profile: ProspectProfile | null = null;
  if (lead.prospect_context) {
    try { profile = JSON.parse(lead.prospect_context); } catch { /* ignore */ }
  }

  async function updateContact(formData: FormData) {
    "use server";
    const supabase2 = await createClient();
    const email = (formData.get("contact_email") as string).trim() || null;
    const firstName = (formData.get("first_name") as string).trim() || null;
    const lastName = (formData.get("last_name") as string).trim() || null;
    await (supabase2.from("pitch_links") as ReturnType<typeof supabase2.from>)
      .update({ contact_email: email, first_name: firstName, last_name: lastName } as Record<string, unknown>)
      .eq("slug", leadSlug);
    revalidatePath(`/dashboard/${projectSlug}/leads/${leadSlug}`);
  }

  type ConvRow = {
    id: string;
    messages: { role: string; content: string }[];
    qualification: string | null;
    feedback: string | null;
    created_at: string;
    updated_at: string;
  };
  const { data: conversations } = await supabase
    .from("conversations")
    .select("id, messages, qualification, feedback, created_at, updated_at")
    .eq("pitch_link_id", lead.id)
    .order("updated_at", { ascending: false })
    .limit(1)
    .returns<ConvRow[]>();

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const pitchUrl = `${appUrl}/p/${lead.slug}`;
  const ogImageUrl = `${appUrl}/api/og/pitch?${new URLSearchParams({
    headline: lead.prospect_name,
    ...(lead.prospect_logo ? { logo: lead.prospect_logo } : {}),
  })}`;

  return (
    <div className="space-y-6 w-full">
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

      {/* Two-column grid */}
      <div className="grid grid-cols-2 gap-5 items-start">

        {/* ── LEFT COLUMN ── */}
        <div className="space-y-5">

          {/* Logo & company */}
          <div className="bg-[#111] border border-[#262626] rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-4">
              <LeadLogoUpload pitchLinkId={lead.id} currentLogoUrl={lead.prospect_logo} />
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl font-bold text-white">{lead.prospect_name}</h1>
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
                {lead.prospect_url && (
                  <a
                    href={lead.prospect_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-[#888] hover:text-violet-400 transition-colors block truncate"
                  >
                    {lead.prospect_url}
                  </a>
                )}
                <div className="flex items-center gap-2 pt-0.5">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${
                      lead.status === "active"
                        ? "bg-emerald-950/60 text-emerald-400 border-emerald-800/40"
                        : "bg-[#1a1a1a] text-[#888] border-[#333]"
                    }`}
                  >
                    {lead.status}
                  </span>
                  <span className="text-xs text-[#555]">
                    {new Date(lead.created_at).toLocaleDateString()}
                  </span>
                  {lead.prospect_url && !profile && (
                    <ProspectResearchTrigger
                      pitchLinkId={lead.id}
                      prospectName={lead.prospect_name}
                      hasUrl={!!lead.prospect_url}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Contact form */}
          <form action={updateContact} className="bg-[#111] border border-[#262626] rounded-xl p-5 space-y-4">
            <h2 className="text-sm font-semibold text-white">Contact details</h2>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#888]">First name</label>
                <input
                  name="first_name"
                  type="text"
                  defaultValue={lead.first_name ?? ""}
                  placeholder="Jane"
                  className="w-full rounded-lg bg-[#0d0d0d] border border-[#333] text-white placeholder:text-[#555] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-colors"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#888]">Last name</label>
                <input
                  name="last_name"
                  type="text"
                  defaultValue={lead.last_name ?? ""}
                  placeholder="Smith"
                  className="w-full rounded-lg bg-[#0d0d0d] border border-[#333] text-white placeholder:text-[#555] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-colors"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#888]">Email</label>
              <input
                name="contact_email"
                type="email"
                defaultValue={lead.contact_email ?? ""}
                placeholder="jane@prospect.com"
                className="w-full rounded-lg bg-[#0d0d0d] border border-[#333] text-white placeholder:text-[#555] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-colors"
              />
            </div>

            <button
              type="submit"
              className="rounded-lg border border-[#333] text-[#ccc] hover:text-white hover:border-violet-500/40 px-4 py-2 text-sm font-medium transition-colors"
            >
              Save
            </button>
          </form>

          {/* Prospect Research — collapsible */}
          {profile && (
            <CollapsibleSection title="Prospect Research" subtitle="AI-generated">
              <div className="space-y-4 pt-1">
                <div className="space-y-1">
                  <p className="text-xs text-[#555] uppercase tracking-wide">Summary</p>
                  <p className="text-sm text-[#ccc]">{profile.company_summary}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-[#555] uppercase tracking-wide">Industry</p>
                  <p className="text-sm text-[#ccc]">{profile.industry}</p>
                </div>

                <div className="space-y-2">
                  <p className="text-xs text-[#555] uppercase tracking-wide">Pain Points</p>
                  <ul className="space-y-1">
                    {profile.pain_points.map((pt, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-[#ccc]">
                        <span className="text-violet-400 mt-0.5">•</span>{pt}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="space-y-2">
                  <p className="text-xs text-[#555] uppercase tracking-wide">Likely Objections</p>
                  <ul className="space-y-1">
                    {profile.potential_objections.map((obj, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-[#ccc]">
                        <span className="text-yellow-400 mt-0.5">⚠</span>{obj}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="bg-[#0d0d0d] border border-[#262626] rounded-lg p-3 space-y-1">
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
            </CollapsibleSection>
          )}
        </div>

        {/* ── RIGHT COLUMN ── */}
        <div className="space-y-5">

          {/* AI Agent preview */}
          <div className="bg-[#111] border border-[#262626] rounded-xl overflow-hidden">
            <div className="border-b border-[#262626] px-4 py-3 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-white">AI Agent</h2>
                <p className="text-xs text-[#555] mt-0.5">
                  Prospect view — {lead.prospect_name} will see this
                </p>
              </div>
              <div className="flex items-center gap-2">
                <LeadCopyButton url={pitchUrl} />
                <EmailEmbedButton
                  pitchUrl={pitchUrl}
                  ogImageUrl={ogImageUrl}
                  prospectName={lead.prospect_name}
                  headline={lead.headline || undefined}
                  productName={productName}
                  companyName={sellerCompanyName}
                />
                <a
                  href={pitchUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs border border-[#333] text-[#888] hover:text-white hover:border-violet-500/40 rounded-lg px-3 py-1.5 transition-colors"
                >
                  Open
                </a>
              </div>
            </div>
            <div className="px-4 py-4 space-y-3">
              <p className="text-sm text-[#444] text-center">
                {profile
                  ? `AI ready — opens with: "${profile.personalized_opener.slice(0, 55)}…"`
                  : "AI agent ready — open the pitch link to start"}
              </p>
              <div className="rounded-lg overflow-hidden border border-[#222]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={ogImageUrl} alt="Pitch preview thumbnail" className="w-full" />
              </div>
            </div>
          </div>

          {/* Conversations — collapsible */}
          <CollapsibleSection title="Conversations">
            {!conversations || conversations.length === 0 ? (
              <div className="border-2 border-dashed border-[#262626] rounded-xl p-8 text-center mt-1">
                <p className="text-sm text-[#444]">No conversations yet.</p>
                <p className="text-xs text-[#333] mt-1">
                  When {lead.prospect_name} opens the pitch link a conversation will appear here.
                </p>
              </div>
            ) : (
              <div className="space-y-3 pt-1">
                {conversations.map((conv) => {
                  const userMsgs = conv.messages?.filter((m) => m.role === "user").length ?? 0;
                  let report: ConversationReport | null = null;
                  if (conv.feedback) {
                    try { report = JSON.parse(conv.feedback); } catch { /* ignore */ }
                  }
                  return (
                    <ConversationCard
                      key={conv.id}
                      conv={conv}
                      userMsgs={userMsgs}
                      report={report}
                      interestColors={INTEREST_COLORS}
                    />
                  );
                })}
              </div>
            )}
          </CollapsibleSection>

        </div>
      </div>
    </div>
  );
}

