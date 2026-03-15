import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/types";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

type ChatMessage = { role: "user" | "assistant"; content: string };

export async function POST(request: Request) {
  const body = await request.json() as {
    pitchLinkId: string;
    messages: ChatMessage[];
    conversationId?: string;
  };

  const { pitchLinkId, messages, conversationId } = body;

  if (!pitchLinkId || !messages?.length) {
    return Response.json({ error: "Missing required fields" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: lead } = await admin
    .from("pitch_links")
    .select("id, prospect_name, prospect_context, projects(id, company_name, system_prompt, settings)")
    .eq("id", pitchLinkId)
    .eq("status", "active")
    .single();

  if (!lead) return Response.json({ error: "Not found" }, { status: 404 });

  const project = lead.projects as {
    id: string;
    company_name: string;
    system_prompt: string | null;
    settings: Record<string, string> | null;
  };

  const { data: slides } = await admin
    .from("slides")
    .select("slide_index, title, description")
    .eq("project_id", project.id)
    .order("slide_index", { ascending: true });

  let profile: Record<string, unknown> | null = null;
  if (lead.prospect_context) {
    try {
      profile = JSON.parse(lead.prospect_context);
    } catch { /* ignore */ }
  }

  const settings = (project.settings ?? {}) as Record<string, string>;
  const productName = settings.product_name ?? project.company_name;

  const systemPrompt = buildSystemPrompt({
    companyName: project.company_name,
    productName,
    systemPrompt: project.system_prompt,
    prospectName: lead.prospect_name,
    profile,
    slides: slides ?? [],
  });

  const hasSlides = slides && slides.length > 0;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 800,
    system: systemPrompt,
    tools: hasSlides
      ? [
          {
            name: "show_slide",
            description:
              "Display a slide to the prospect. Use this when a slide directly illustrates what you're discussing. Don't overuse — only when genuinely helpful.",
            input_schema: {
              type: "object" as const,
              properties: {
                slide_index: {
                  type: "number",
                  description: "The slide_index (0-based) of the slide to display",
                },
              },
              required: ["slide_index"],
            },
          },
        ]
      : [],
    messages,
  });

  let assistantText = "";
  let showSlide: number | null = null;

  for (const block of response.content) {
    if (block.type === "text") {
      assistantText += block.text;
    } else if (block.type === "tool_use" && block.name === "show_slide") {
      showSlide = (block.input as { slide_index: number }).slide_index;
    }
  }

  // Persist conversation
  const timestamp = new Date().toISOString();
  const lastUserMsg = { ...messages[messages.length - 1], timestamp };
  const assistantMsg = {
    role: "assistant" as const,
    content: assistantText,
    timestamp,
    ...(showSlide !== null ? { slide_shown: showSlide } : {}),
  };

  let savedId = conversationId;

  if (conversationId) {
    const { data: existing } = await admin
      .from("conversations")
      .select("messages, slides_viewed")
      .eq("id", conversationId)
      .single();

    if (existing) {
      const prevMsgs = (existing.messages as Record<string, unknown>[]) ?? [];
      const prevSlides = (existing.slides_viewed as number[]) ?? [];
      const slidesViewed =
        showSlide !== null && !prevSlides.includes(showSlide)
          ? [...prevSlides, showSlide]
          : prevSlides;

      await admin
        .from("conversations")
        .update({
          messages: [...prevMsgs, lastUserMsg, assistantMsg] as unknown as Json,
          slides_viewed: slidesViewed as unknown as Json,
        })
        .eq("id", conversationId);
    }
  } else {
    const { data: newConv } = await admin
      .from("conversations")
      .insert({
        pitch_link_id: pitchLinkId,
        messages: [lastUserMsg, assistantMsg],
        slides_viewed: showSlide !== null ? [showSlide] : [],
      })
      .select("id")
      .single();

    savedId = newConv?.id;
  }

  return Response.json({ text: assistantText, showSlide, conversationId: savedId });
}

function buildSystemPrompt(opts: {
  companyName: string;
  productName: string;
  systemPrompt: string | null;
  prospectName: string;
  profile: Record<string, unknown> | null;
  slides: { slide_index: number; title: string; description: string | null }[];
}): string {
  const { companyName, productName, systemPrompt, prospectName, profile, slides } = opts;
  const lines: string[] = [];

  lines.push(
    `You are an AI sales agent for ${companyName}, presenting ${productName} to ${prospectName}.`,
    `Your goal: engage the prospect, understand their needs, and show how ${productName} solves their problems.`,
    `Keep responses concise and conversational — 2-4 sentences. Ask qualifying questions naturally.`
  );

  if (systemPrompt) {
    lines.push(`\nPRODUCT CONTEXT:\n${systemPrompt}`);
  }

  if (profile) {
    lines.push(`\nPROSPECT RESEARCH — ${prospectName.toUpperCase()}:`);
    if (profile.company_summary) lines.push(`• ${profile.company_summary}`);
    if (profile.industry) lines.push(`• Industry: ${profile.industry}`);
    if (Array.isArray(profile.pain_points) && profile.pain_points.length) {
      lines.push(`• Pain points: ${(profile.pain_points as string[]).join("; ")}`);
    }
    if (profile.relevance_mapping) lines.push(`• Why relevant: ${profile.relevance_mapping}`);
    if (Array.isArray(profile.potential_objections) && profile.potential_objections.length) {
      lines.push(`• Likely objections: ${(profile.potential_objections as string[]).join("; ")}`);
    }
    if (profile.personalized_opener) {
      lines.push(`\nOPEN THE CONVERSATION WITH:\n"${profile.personalized_opener}"`);
    }
    if (profile.fit_score) {
      lines.push(`\nFit: ${String(profile.fit_score).toUpperCase()} — ${profile.fit_reasoning}`);
      if (profile.fit_score === "low") {
        lines.push(`If it becomes clear the product genuinely isn't a fit, say so honestly and kindly.`);
      }
    }
  }

  if (slides.length > 0) {
    lines.push(`\nSLIDES AVAILABLE (use show_slide tool when relevant):`);
    slides.forEach((s) =>
      lines.push(`  [${s.slide_index}] ${s.title}${s.description ? ` — ${s.description}` : ""}`)
    );
    lines.push(`Only show a slide when it directly illustrates the current topic. Don't show all slides.`);
  }

  return lines.join("\n");
}
