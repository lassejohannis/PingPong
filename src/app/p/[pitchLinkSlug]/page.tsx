import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import { PitchChat } from "@/components/pitch-chat";

export default async function PitchPage({
  params,
}: {
  params: Promise<{ pitchLinkSlug: string }>;
}) {
  const { pitchLinkSlug } = await params;
  const admin = createAdminClient();

  const { data: pitchLink } = await admin
    .from("pitch_links")
    .select("id, prospect_name, prospect_logo, headline, project_id, projects(company_name, settings, system_prompt)")
    .eq("slug", pitchLinkSlug)
    .eq("status", "active")
    .single();

  if (!pitchLink) notFound();

  const project = pitchLink.projects as {
    company_name: string;
    settings: Record<string, string> | null;
    system_prompt: string | null;
  };

  const settings = (project.settings ?? {}) as Record<string, string>;
  const productName = settings.product_name ?? project.company_name;

  const { data: slides } = await admin
    .from("slides")
    .select("slide_index, title, description, image_url")
    .eq("project_id", pitchLink.project_id)
    .order("slide_index", { ascending: true });

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col">
      {/* Header */}
      <header className="h-14 border-b border-[#1a1a1a] px-5 flex items-center gap-3 shrink-0">
        {pitchLink.prospect_logo && (
          <img
            src={pitchLink.prospect_logo}
            alt={pitchLink.prospect_name}
            className="h-7 w-7 rounded object-contain"
          />
        )}
        <span className="text-sm font-semibold text-white">{pitchLink.headline}</span>
        <span className="text-[#333] mx-1">·</span>
        <span className="text-sm text-[#555]">{project.company_name}</span>
      </header>

      <PitchChat
        pitchLinkId={pitchLink.id}
        prospectName={pitchLink.prospect_name}
        productName={productName}
        slides={slides ?? []}
      />
    </div>
  );
}
