import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import PitchClient from "./pitch-client";

interface ProspectContext {
  company_summary?: string;
  industry?: string;
  pain_points?: string[];
  relevance_mapping?: string;
  potential_objections?: string[];
  personalized_opener?: string;
  fit_score?: string;
  fit_reasoning?: string;
  custom_opening?: string;
  custom_questions?: string[];
  agent_notes?: string;
}

export default async function PitchPage({
  params,
}: {
  params: Promise<{ pitchLinkSlug: string }>;
}) {
  const { pitchLinkSlug } = await params;
  const admin = createAdminClient();

  // Try pitch_links first (personalized), then projects (generic)
  let pitchLink = null;
  let isGenericLink = false;

  const { data: personalLink } = await admin
    .from("pitch_links")
    .select("id, prospect_name, prospect_logo, prospect_context, headline, project_id, projects(company_name, settings, system_prompt)")
    .eq("slug", pitchLinkSlug)
    .eq("status", "active")
    .single();

  if (personalLink) {
    pitchLink = personalLink;
  } else {
    // Fallback: look up as project slug (generic link)
    const { data: project } = await admin
      .from("projects")
      .select("id, company_name, settings, system_prompt")
      .eq("slug", pitchLinkSlug)
      .single();

    if (project) {
      isGenericLink = true;
      pitchLink = {
        id: null,
        prospect_name: "there",
        prospect_logo: null,
        prospect_context: null,
        headline: null,
        project_id: project.id,
        projects: project,
      };
    }
  }

  if (!pitchLink) notFound();

  const project = pitchLink.projects as {
    company_name: string;
    settings: Record<string, unknown> | null;
    system_prompt: string | null;
  };

  const settings = (project.settings ?? {}) as Record<string, unknown>;

  // Parse prospect context
  let prospectContext: ProspectContext | null = null;
  if (pitchLink.prospect_context) {
    try {
      prospectContext = typeof pitchLink.prospect_context === "string"
        ? JSON.parse(pitchLink.prospect_context)
        : pitchLink.prospect_context as ProspectContext;
    } catch { /* ignore */ }
  }

  const { data: slides } = await admin
    .from("slides")
    .select("slide_index, title, description, image_url")
    .eq("project_id", pitchLink.project_id)
    .order("slide_index", { ascending: true });

  // Headline: per-lead > prospect context > project default > fallback
  const headline =
    pitchLink.headline ||
    (settings.default_headline as string) ||
    `How ${project.company_name} can help`;

  // Opening message: per-lead custom > project setting > auto-generated
  const openingMessage =
    prospectContext?.custom_opening ||
    (settings.opening_message as string) ||
    (isGenericLink
      ? `Hey! I can walk you through how ${project.company_name} can help. What would you like to know?`
      : `Hey! I know ${pitchLink.prospect_name} is doing great work. ` +
        `I can walk you through how ${project.company_name} can specifically help. ` +
        `What would you like to know?`);

  // Suggested questions: per-lead custom + project defaults
  const defaultQuestions = [
    "What does it cost?",
    "How does it work?",
    "Show me case studies",
    "What makes you different?",
  ];
  const projectQuestions = (settings.suggested_questions as string[]) || defaultQuestions;
  const leadQuestions = prospectContext?.custom_questions || [];
  const suggestedQuestions = [...leadQuestions, ...projectQuestions].slice(0, 6);

  // Build prospect context string for system prompt
  let prospectContextForPrompt: string | null = null;
  if (prospectContext && !isGenericLink) {
    const lines: string[] = [];
    if (prospectContext.company_summary) lines.push(`About ${pitchLink.prospect_name}: ${prospectContext.company_summary}`);
    if (prospectContext.industry) lines.push(`Industry: ${prospectContext.industry}`);
    if (prospectContext.pain_points?.length) lines.push(`Their pain points: ${prospectContext.pain_points.join("; ")}`);
    if (prospectContext.relevance_mapping) lines.push(`Why we're relevant: ${prospectContext.relevance_mapping}`);
    if (prospectContext.potential_objections?.length) lines.push(`Likely objections: ${prospectContext.potential_objections.join("; ")}`);
    if (prospectContext.personalized_opener) lines.push(`Suggested opener: "${prospectContext.personalized_opener}"`);
    if (prospectContext.agent_notes) lines.push(`Important notes: ${prospectContext.agent_notes}`);
    if (lines.length > 0) prospectContextForPrompt = lines.join("\n");
  }

  return (
    <PitchClient
      slug={pitchLinkSlug}
      systemPrompt={project.system_prompt || "You are a helpful sales assistant."}
      prospectContext={prospectContextForPrompt}
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
      headline={headline}
      openingMessage={openingMessage}
      suggestedQuestions={suggestedQuestions}
    />
  );
}
