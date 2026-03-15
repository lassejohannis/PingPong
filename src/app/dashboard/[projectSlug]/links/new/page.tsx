import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function NewLeadPage({
  params,
}: {
  params: Promise<{ projectSlug: string }>;
}) {
  const { projectSlug } = await params;
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("slug", projectSlug)
    .single();

  if (!project) redirect("/dashboard");

  async function createLead(formData: FormData) {
    "use server";
    const supabase2 = await createClient();

    const prospectName = formData.get("prospect_name") as string;
    const prospectUrl = formData.get("prospect_url") as string;
    const contactEmail = formData.get("contact_email") as string;
    const notes = formData.get("notes") as string;

    const slug =
      prospectName.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") +
      "-" + Math.random().toString(36).slice(2, 6);

    const { data: lead, error } = await supabase2
      .from("pitch_links")
      .insert({
        project_id: project!.id,
        prospect_name: prospectName,
        prospect_url: prospectUrl || null,
        contact_email: contactEmail || null,
        headline: notes || prospectName,
        slug,
        status: "active",
      })
      .select("slug")
      .single();

    if (error) throw new Error(error.message);
    redirect(`/dashboard/${projectSlug}/leads/${lead.slug}`);
  }

  return (
    <div className="max-w-lg mx-auto space-y-8 pt-4">
      <Link href={`/dashboard/${projectSlug}`} className="inline-flex items-center gap-1.5 text-sm text-[#555] hover:text-white transition-colors">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Leads
      </Link>
      <div>
        <h1 className="text-2xl font-bold text-white">Add Lead</h1>
        <p className="text-sm text-[#888] mt-1">
          Enter the prospect&apos;s details to generate a personalised pitch link.
        </p>
      </div>

      <form action={createLead} className="space-y-5">
        <div className="space-y-1.5">
          <label htmlFor="prospect_name" className="text-sm font-medium text-[#ccc]">
            Company name <span className="text-red-400">*</span>
          </label>
          <input
            id="prospect_name" name="prospect_name" type="text" required
            placeholder="Prospect Corp"
            className="w-full rounded-lg bg-[#111] border border-[#2a2a2a] text-white placeholder:text-[#555] px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-colors"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="contact_email" className="text-sm font-medium text-[#ccc]">
            Contact email
          </label>
          <input
            id="contact_email" name="contact_email" type="email"
            placeholder="jane@prospect.com"
            className="w-full rounded-lg bg-[#111] border border-[#2a2a2a] text-white placeholder:text-[#555] px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-colors"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="prospect_url" className="text-sm font-medium text-[#ccc]">
            Company website
          </label>
          <input
            id="prospect_url" name="prospect_url" type="url"
            placeholder="https://prospect.com"
            className="w-full rounded-lg bg-[#111] border border-[#2a2a2a] text-white placeholder:text-[#555] px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-colors"
          />
          <p className="text-xs text-[#555]">The AI crawls this to personalise the pitch automatically.</p>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="notes" className="text-sm font-medium text-[#ccc]">Notes</label>
          <input
            id="notes" name="notes" type="text"
            placeholder="e.g. Met at SaaStr 2025, interested in enterprise plan"
            className="w-full rounded-lg bg-[#111] border border-[#2a2a2a] text-white placeholder:text-[#555] px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-colors"
          />
        </div>

        <button
          type="submit"
          className="w-full rounded-lg bg-violet-600 hover:bg-violet-700 text-white px-4 py-2.5 text-sm font-medium transition-colors"
        >
          Create lead
        </button>
      </form>
    </div>
  );
}
