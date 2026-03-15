import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import PitchClient from "./pitch-client";

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

  const { data: slides } = await admin
    .from("slides")
    .select("slide_index, title, description, image_url")
    .eq("project_id", pitchLink.project_id)
    .order("slide_index", { ascending: true });

  // Build opening message
  const openingMessage =
    `Hey! I know ${pitchLink.prospect_name} is doing great work. ` +
    `I can walk you through how ${project.company_name} can specifically help. ` +
    `What would you like to know?`;

  // Default suggested questions
  const suggestedQuestions = [
    "What does it cost?",
    "How does it work?",
    "Show me case studies",
    "What makes you different?",
  ];

  return (
    <PitchClient
      slug={pitchLinkSlug}
      systemPrompt={project.system_prompt || "You are a helpful sales assistant."}
      slides={
        (slides || []).map((s) => ({
          index: s.slide_index,
          title: s.title,
          description: s.description || "",
          image_url: s.image_url,
        }))
      }
      prospectName={pitchLink.prospect_name}
      prospectLogo={pitchLink.prospect_logo}
      headline={pitchLink.headline}
      openingMessage={openingMessage}
      suggestedQuestions={suggestedQuestions}
    />
  );
}
