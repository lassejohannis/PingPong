import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

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
      prospectName
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") +
      "-" +
      Math.random().toString(36).slice(2, 6);

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
      <div>
        <h1 className="text-2xl font-bold">Add Lead</h1>
        <p className="text-sm text-gray-500 mt-1">
          Enter the prospect&apos;s details to generate a personalised pitch link.
        </p>
      </div>

      <form action={createLead} className="space-y-5">
        <div className="space-y-1.5">
          <label htmlFor="prospect_name" className="text-sm font-medium">
            Company name <span className="text-red-500">*</span>
          </label>
          <input
            id="prospect_name"
            name="prospect_name"
            type="text"
            required
            placeholder="Prospect Corp"
            className="w-full border rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="contact_email" className="text-sm font-medium">
            Contact email
          </label>
          <input
            id="contact_email"
            name="contact_email"
            type="email"
            placeholder="jane@prospect.com"
            className="w-full border rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="prospect_url" className="text-sm font-medium">
            Company website
          </label>
          <input
            id="prospect_url"
            name="prospect_url"
            type="url"
            placeholder="https://prospect.com"
            className="w-full border rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black"
          />
          <p className="text-xs text-gray-400">
            The AI crawls this to personalise the pitch automatically.
          </p>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="notes" className="text-sm font-medium">
            Notes
          </label>
          <input
            id="notes"
            name="notes"
            type="text"
            placeholder="e.g. Met at SaaStr 2025, interested in enterprise plan"
            className="w-full border rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black"
          />
        </div>

        <button
          type="submit"
          className="w-full bg-black text-white rounded-md px-4 py-2 text-sm font-medium hover:bg-gray-800 transition-colors"
        >
          Create lead
        </button>
      </form>
    </div>
  );
}
