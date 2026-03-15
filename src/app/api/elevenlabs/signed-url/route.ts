import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY!;
const ELEVENLABS_AGENT_ID = process.env.ELEVENLABS_AGENT_ID!;

export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get("slug");
  if (!slug) {
    return NextResponse.json({ error: "Missing slug" }, { status: 400 });
  }

  const supabase = await createClient();

  // Load pitch link + project + slides (same query as page.tsx)
  const { data: pitchLink, error } = await supabase
    .from("pitch_links")
    .select("*, projects(*)")
    .eq("slug", slug)
    .eq("status", "active")
    .single();

  if (!pitchLink || error) {
    console.error("Supabase pitch_link query error:", error, "slug:", slug);
    return NextResponse.json({ error: "Pitch link not found", detail: error?.message }, { status: 404 });
  }

  const project = pitchLink.projects as {
    system_prompt: string;
    company_name: string;
    settings: Record<string, unknown>;
  };

  const { data: slides } = await supabase
    .from("slides")
    .select("slide_index, title, description")
    .eq("project_id", pitchLink.project_id)
    .order("slide_index", { ascending: true });

  // Build system prompt (same logic as /api/chat)
  const slideContext = (slides || [])
    .map((s) => `Slide ${s.slide_index}: "${s.title}" — ${s.description}`)
    .join("\n");

  const basePrompt = project.system_prompt || "You are a helpful sales assistant.";

  const fullSystemPrompt = `${basePrompt}

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

  const openingMessage =
    `Hey! I know ${pitchLink.prospect_name} is doing great work. ` +
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
