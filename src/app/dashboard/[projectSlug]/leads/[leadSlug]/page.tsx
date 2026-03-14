import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ projectSlug: string; leadSlug: string }>;
}) {
  const { projectSlug, leadSlug } = await params;
  const supabase = await createClient();

  const { data: lead } = await supabase
    .from("pitch_links")
    .select("*")
    .eq("slug", leadSlug)
    .single();

  if (!lead) redirect(`/dashboard/${projectSlug}`);

  async function updateEmail(formData: FormData) {
    "use server";
    const supabase2 = await createClient();
    const email = (formData.get("contact_email") as string).trim() || null;
    // contact_email not in generated types yet — cast to bypass
    await (supabase2.from("pitch_links") as ReturnType<typeof supabase2.from>)
      .update({ contact_email: email } as Record<string, unknown>)
      .eq("slug", leadSlug);
    revalidatePath(`/dashboard/${projectSlug}/leads/${leadSlug}`);
  }

  const pitchUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/p/${lead.slug}`;

  return (
    <div className="space-y-8">
      {/* Lead header */}
      <div className="flex items-start justify-between gap-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">{lead.prospect_name}</h1>
          {lead.prospect_url && (
            <a
              href={lead.prospect_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-gray-500 hover:underline"
            >
              {lead.prospect_url}
            </a>
          )}
          {lead.headline && lead.headline !== lead.prospect_name && (
            <p className="text-sm text-gray-400">{lead.headline}</p>
          )}
        </div>

        <div className="shrink-0 text-right space-y-1">
          <p className="text-xs text-gray-400">Pitch link</p>
          <code className="text-xs bg-gray-100 px-2 py-1 rounded block">
            {pitchUrl}
          </code>
          <a
            href={pitchUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-gray-500 hover:underline"
          >
            Open in new tab
          </a>
        </div>
      </div>

      {/* Status badge */}
      <div className="flex items-center gap-2">
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
            lead.status === "active"
              ? "bg-green-100 text-green-700"
              : "bg-gray-100 text-gray-600"
          }`}
        >
          {lead.status}
        </span>
        <span className="text-xs text-gray-400">
          Created {new Date(lead.created_at).toLocaleDateString()}
        </span>
      </div>

      {/* Contact email */}
      <form action={updateEmail} className="flex items-center gap-3">
        <label className="text-sm font-medium shrink-0">Contact email</label>
        <input
          name="contact_email"
          type="email"
          defaultValue={(lead as Record<string, unknown>).contact_email as string ?? ""}
          placeholder="jane@prospect.com"
          className="border rounded-md px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-black flex-1 max-w-xs"
        />
        <button
          type="submit"
          className="rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          Save
        </button>
      </form>

      {/* Chat placeholder */}
      <div className="border rounded-lg overflow-hidden">
        <div className="bg-gray-50 border-b px-4 py-3 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold">AI Agent</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Prospect view — this is what {lead.prospect_name} will see
            </p>
          </div>
          <Link
            href={pitchUrl}
            target="_blank"
            className="text-xs border rounded px-3 py-1.5 hover:bg-gray-100 transition-colors"
          >
            Preview
          </Link>
        </div>

        <div className="h-[480px] flex flex-col items-center justify-center bg-white gap-4">
          <div className="w-10 h-10 rounded-full border-2 border-gray-200 flex items-center justify-center">
            <svg
              className="w-5 h-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
              />
            </svg>
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-gray-600">
              Chat interface coming soon
            </p>
            <p className="text-xs text-gray-400 mt-1">
              The AI agent will be integrated here by the backend team.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
