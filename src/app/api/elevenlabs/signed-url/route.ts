import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY!;
const ELEVENLABS_AGENT_ID = process.env.ELEVENLABS_AGENT_ID!;

export async function POST(request: NextRequest) {
  const { slug, prospectContext, conversationHistory } = await request.json() as {
    slug: string;
    prospectContext?: string | null;
    conversationHistory?: { role: "user" | "assistant"; content: string }[];
  };

  if (!slug) {
    return NextResponse.json({ error: "Missing slug" }, { status: 400 });
  }

  // Use admin client to bypass RLS — this is a public-facing endpoint
  // called from pitch pages, where the visitor may or may not be authenticated
  const supabase = createAdminClient();

  // Try pitch_links first, then fallback to projects (generic link)
  let projectData: { system_prompt: string; company_name: string; settings: Record<string, unknown> };
  let projectId: string;
  let prospectName = "there";

  const { data: pitchLink } = await supabase
    .from("pitch_links")
    .select("*, projects(*)")
    .eq("slug", slug)
    .eq("status", "active")
    .single();

  if (pitchLink) {
    projectData = pitchLink.projects as typeof projectData;
    projectId = pitchLink.project_id;
    prospectName = pitchLink.prospect_name || "there";
  } else {
    // Fallback: look up as project slug
    const { data: project } = await supabase
      .from("projects")
      .select("id, system_prompt, company_name, settings")
      .eq("slug", slug)
      .single();

    if (!project) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    projectData = {
      system_prompt: project.system_prompt || "",
      company_name: project.company_name,
      settings: (project.settings ?? {}) as Record<string, unknown>,
    };
    projectId = project.id;
  }

  const project = projectData;

  const { data: slides } = await supabase
    .from("slides")
    .select("slide_index, title, description")
    .eq("project_id", projectId)
    .order("slide_index", { ascending: true });

  // Build system prompt (same logic as /api/chat)
  const slideContext = (slides || [])
    .map((s) => `Slide ${s.slide_index}: "${s.title}" — ${s.description}`)
    .join("\n");

  const basePrompt = project.system_prompt || "You are a helpful sales assistant.";

  let fullSystemPrompt = `${basePrompt}

## Available Slides
You have access to these slides. Use the show_slide tool to display the most relevant slide when answering questions.

${slideContext}

## Instructions
- When a topic matches a slide, call show_slide to display it
- Keep answers concise (2-3 sentences) unless asked for more detail
- Never make up information not in your knowledge base
- Reference the prospect's company and situation when relevant
- Track whether the prospect seems hot, warm, cold, or not a fit

## Speech Output Guidelines
Your responses will be read aloud via text-to-speech. Write in a natural, conversational spoken style:
- Use contractions (we're, you'll, that's, it's) — never formal written style
- Keep sentences short and punchy — long sentences sound unnatural when spoken
- Sound warm and enthusiastic, like you're having a real conversation, not reading a script
- Avoid bullet points, markdown formatting, or anything visual — this is pure audio`;

  // Append prospect context if available
  if (prospectContext) {
    fullSystemPrompt += `\n\n## Prospect Intelligence\n${prospectContext}`;
  }

  // Append conversation history if switching from text mode
  if (conversationHistory && conversationHistory.length > 1) {
    const historyText = conversationHistory
      .map((m) => `${m.role === "user" ? "Prospect" : "You"}: ${m.content}`)
      .join("\n");

    fullSystemPrompt += `\n\n## Previous Conversation
The prospect has already been chatting with you in text mode. Continue naturally from where the conversation left off. Do NOT repeat your greeting or re-introduce yourself.

${historyText}`;
  }

  const hasHistory = conversationHistory && conversationHistory.length > 1;

  const openingMessage = hasHistory
    ? "I'm here — feel free to keep talking!"
    :
    `Hey! I know ${prospectName} is doing great work. ` +
    `I can walk you through how ${project.company_name} can specifically help. ` +
    `What would you like to know?`;

  // Get signed URL from ElevenLabs with overrides
  const response = await fetch(
    `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${ELEVENLABS_AGENT_ID}`,
    {
      method: "GET",
      headers: {
        "xi-api-key": ELEVENLABS_API_KEY,
      },
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    console.error("ElevenLabs signed URL error:", response.status, errText);
    console.error("Agent ID used:", ELEVENLABS_AGENT_ID);
    return NextResponse.json(
      { error: "Failed to get signed URL", status: response.status, detail: errText },
      { status: 500 }
    );
  }

  const { signed_url } = await response.json();

  return NextResponse.json({
    signedUrl: signed_url,
    overrides: {
      agent: {
        prompt: { prompt: fullSystemPrompt },
        firstMessage: openingMessage,
      },
    },
  });
}
