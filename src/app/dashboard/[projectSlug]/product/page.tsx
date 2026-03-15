import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { LogoUpload } from "@/components/logo-upload";

export default async function ProductPage({
  params,
}: {
  params: Promise<{ projectSlug: string }>;
}) {
  const { projectSlug } = await params;
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id, company_name, settings")
    .eq("slug", projectSlug)
    .single();

  if (!project) redirect("/dashboard");

  const projectId = project!.id;
  const projectSettings = project!.settings;

  async function saveSettings(formData: FormData) {
    "use server";
    const supabase2 = await createClient();
    const existing =
      projectSettings && typeof projectSettings === "object" && !Array.isArray(projectSettings)
        ? (projectSettings as Record<string, string>)
        : {};
    await supabase2
      .from("projects")
      .update({
        settings: {
          ...existing,
          product_name: (formData.get("product_name") as string).trim(),
          tone: formData.get("tone") as string,
          calendar_link: (formData.get("calendar_link") as string).trim() || null,
        },
      })
      .eq("id", projectId);
    revalidatePath(`/dashboard/${projectSlug}/product`);
  }

  const settings =
    project.settings && typeof project.settings === "object" && !Array.isArray(project.settings)
      ? (project.settings as Record<string, string>)
      : {};

  const { data: documents } = await supabase
    .from("documents")
    .select("id, file_name, file_type, created_at")
    .eq("project_id", project.id)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Product</h1>
          <p className="text-sm text-[#666] mt-1">Configure how the AI presents your product.</p>
        </div>
        <Link
          href={`/dashboard/${projectSlug}`}
          className="rounded-lg bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 text-sm font-medium transition-colors"
        >
          Continue to Leads →
        </Link>
      </div>

      {/* Product settings */}
      <form action={saveSettings} className="bg-[#111] border border-[#1e1e1e] rounded-xl p-6 space-y-5">
        <h2 className="text-sm font-semibold text-white">Settings</h2>

        <LogoUpload
          projectId={projectId}
          currentLogoUrl={settings.logo_url ?? null}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label htmlFor="product_name" className="text-sm font-medium text-[#ccc]">Product name</label>
            <input
              id="product_name" name="product_name" type="text" required
              defaultValue={settings.product_name ?? ""}
              placeholder="PitchLink Pro"
              className="w-full rounded-lg bg-[#0d0d0d] border border-[#2a2a2a] text-white placeholder:text-[#555] px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-colors"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="tone" className="text-sm font-medium text-[#ccc]">Tone</label>
            <select
              id="tone" name="tone"
              defaultValue={settings.tone ?? "professional"}
              className="w-full rounded-lg bg-[#0d0d0d] border border-[#2a2a2a] text-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-colors"
            >
              <option value="professional">Professional</option>
              <option value="casual">Casual</option>
              <option value="direct">Direct</option>
            </select>
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="calendar_link" className="text-sm font-medium text-[#ccc]">
            Calendar link <span className="text-[#444] font-normal">(optional)</span>
          </label>
          <input
            id="calendar_link" name="calendar_link" type="url"
            defaultValue={settings.calendar_link ?? ""}
            placeholder="https://cal.com/yourname"
            className="w-full rounded-lg bg-[#0d0d0d] border border-[#2a2a2a] text-white placeholder:text-[#555] px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-colors"
          />
          <p className="text-xs text-[#555]">The AI will share this link when a prospect wants to book a call.</p>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            className="rounded-lg bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 text-sm font-medium transition-colors"
          >
            Save settings
          </button>
        </div>
      </form>

      {/* Uploaded documents */}
      <div className="bg-[#111] border border-[#1e1e1e] rounded-xl p-6 space-y-4">
        <h2 className="text-sm font-semibold text-white">Uploaded files</h2>
        {documents && documents.length > 0 ? (
          <div className="space-y-2">
            {documents.map((doc) => (
              <div key={doc.id} className="flex items-center gap-3 bg-[#0d0d0d] border border-[#222] rounded-lg px-4 py-3">
                <svg className="w-4 h-4 text-[#555] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{doc.file_name}</p>
                  <p className="text-xs text-[#555]">{doc.file_type}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[#444]">No files uploaded yet.</p>
        )}
      </div>

      {/* AI briefing placeholder */}
      <div className="bg-[#111] border border-[#1e1e1e] rounded-xl overflow-hidden">
        <div className="border-b border-[#1e1e1e] px-5 py-4">
          <h2 className="text-sm font-semibold text-white">Product Briefing</h2>
          <p className="text-xs text-[#555] mt-0.5">
            Chat with the AI to make sure it understands your product before you send out pitches.
          </p>
        </div>

        <div className="h-[420px] flex flex-col">
          <div className="flex-1 p-5 space-y-4 overflow-y-auto">
            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-full bg-violet-600/20 border border-violet-500/30 flex items-center justify-center shrink-0 mt-0.5">
                <svg className="w-3.5 h-3.5 text-violet-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z" />
                </svg>
              </div>
              <div className="bg-[#1a1a1a] border border-[#222] rounded-xl px-4 py-3 text-sm max-w-lg text-[#ccc]">
                Hi! I&apos;ve reviewed your product information and slides. I&apos;m ready to pitch{" "}
                <span className="text-white font-medium">{settings.product_name ?? "your product"}</span>. Ask me anything to verify I understand it correctly.
              </div>
            </div>
          </div>

          <div className="border-t border-[#1a1a1a] p-3">
            <div className="flex gap-2 items-center bg-[#0d0d0d] border border-[#222] rounded-lg px-3 py-2">
              <input
                disabled
                placeholder="Ask the AI about your product… (coming soon)"
                className="flex-1 bg-transparent text-sm outline-none text-[#333] cursor-not-allowed placeholder:text-[#333]"
              />
              <button disabled className="text-[#2a2a2a] cursor-not-allowed">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
