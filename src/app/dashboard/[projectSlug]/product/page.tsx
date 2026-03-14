import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";

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

  const settings =
    project.settings &&
    typeof project.settings === "object" &&
    !Array.isArray(project.settings)
      ? (project.settings as Record<string, string>)
      : {};

  const { data: documents } = await supabase
    .from("documents")
    .select("id, file_name, file_type, created_at")
    .eq("project_id", project.id)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-8">
      {/* Continue to leads */}
      <div className="flex justify-end">
        <Link
          href={`/dashboard/${projectSlug}`}
          className="rounded-md bg-black text-white px-4 py-2 text-sm font-medium hover:bg-gray-800 transition-colors"
        >
          Continue to Leads →
        </Link>
      </div>

      {/* Product info */}
      <div className="grid grid-cols-2 gap-4">
        <div className="border rounded-lg p-4 space-y-1">
          <p className="text-xs text-gray-400 uppercase tracking-wide">Campaign</p>
          <p className="font-semibold">{project.company_name}</p>
        </div>
        <div className="border rounded-lg p-4 space-y-1">
          <p className="text-xs text-gray-400 uppercase tracking-wide">Product</p>
          <p className="font-semibold">{settings.product_name ?? "—"}</p>
        </div>
      </div>

      {/* Uploaded documents */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold">Uploaded files</h2>
        {documents && documents.length > 0 ? (
          <div className="space-y-2">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center gap-3 border rounded-md px-4 py-3"
              >
                <svg
                  className="w-4 h-4 text-gray-400 shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{doc.file_name}</p>
                  <p className="text-xs text-gray-400">{doc.file_type}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400">No files uploaded yet.</p>
        )}
      </div>

      {/* AI briefing chatbot placeholder */}
      <div className="border rounded-lg overflow-hidden">
        <div className="bg-gray-50 border-b px-4 py-3">
          <h2 className="text-sm font-semibold">Product Briefing</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Chat with the AI to make sure it understands your product before you send out pitches.
          </p>
        </div>

        <div className="h-[420px] flex flex-col">
          {/* Mock conversation */}
          <div className="flex-1 p-4 space-y-4 overflow-y-auto">
            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-full bg-black flex items-center justify-center shrink-0 mt-0.5">
                <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z" />
                </svg>
              </div>
              <div className="bg-gray-100 rounded-lg px-4 py-3 text-sm max-w-lg">
                <p>
                  Hi! I&apos;ve reviewed your product information and slides. I&apos;m ready to pitch{" "}
                  <strong>{settings.product_name ?? "your product"}</strong>. Ask me anything to
                  verify I understand it correctly.
                </p>
              </div>
            </div>
          </div>

          {/* Input placeholder */}
          <div className="border-t p-3">
            <div className="flex gap-2 items-center border rounded-md px-3 py-2 bg-gray-50">
              <input
                disabled
                placeholder="Ask the AI about your product... (coming soon)"
                className="flex-1 bg-transparent text-sm outline-none text-gray-400 cursor-not-allowed"
              />
              <button
                disabled
                className="text-gray-300 cursor-not-allowed"
              >
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
