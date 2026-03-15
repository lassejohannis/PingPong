import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { NewLeadForm } from "./form";

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
    const firstName = (formData.get("first_name") as string) || null;
    const lastName = (formData.get("last_name") as string) || null;
    const prospectUrl = formData.get("prospect_url") as string;
    const contactEmail = formData.get("contact_email") as string;
    const notes = formData.get("notes") as string;

    const slug =
      prospectName.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") +
      "-" + Math.random().toString(36).slice(2, 6);

    const { data: lead, error } = await (supabase2.from("pitch_links") as ReturnType<typeof supabase2.from>)
      .insert({
        project_id: project!.id,
        prospect_name: prospectName,
        first_name: firstName,
        last_name: lastName,
        prospect_url: prospectUrl || null,
        contact_email: contactEmail || null,
        headline: notes || prospectName,
        slug,
        status: "active",
      } as Record<string, unknown>)
      .select("slug")
      .single();

    if (error) throw new Error((error as { message: string }).message);
    redirect(`/dashboard/${projectSlug}/leads/${(lead as { slug: string }).slug}`);
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

      <NewLeadForm action={createLead} />
    </div>
  );
}
