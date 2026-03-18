import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";
import { rateLimit, getClientIP } from "@/lib/rate-limit";

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY!;
const ELEVENLABS_AGENT_ID = process.env.ELEVENLABS_AGENT_ID!;

const signedUrlLimiter = rateLimit({ windowMs: 60_000, max: 5 });

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

function formatProspectContext(ctx: ProspectContext, prospectName: string): string {
  const lines: string[] = [];
  if (ctx.company_summary) lines.push(`About ${prospectName}: ${ctx.company_summary}`);
  if (ctx.industry) lines.push(`Industry: ${ctx.industry}`);
  if (ctx.pain_points?.length) lines.push(`Their pain points: ${ctx.pain_points.join("; ")}`);
  if (ctx.relevance_mapping) lines.push(`Why we're relevant: ${ctx.relevance_mapping}`);
  if (ctx.potential_objections?.length) lines.push(`Likely objections: ${ctx.potential_objections.join("; ")}`);
  if (ctx.personalized_opener) lines.push(`Suggested opener: "${ctx.personalized_opener}"`);
  if (ctx.agent_notes) lines.push(`Important notes: ${ctx.agent_notes}`);
  return lines.join("\n");
}

export async function POST(request: NextRequest) {
  // Rate limiting
  const ip = getClientIP(request);
  const { success } = signedUrlLimiter.check(ip);
  if (!success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const { slug, conversationHistory, visitorEmail } = await request.json() as {
    slug: string;
    conversationHistory?: { role: "user" | "assistant"; content: string }[];
    visitorEmail?: string;
  };

  if (!slug) {
    return NextResponse.json({ error: "Missing slug" }, { status: 400 });
  }

  // Use admin client to bypass RLS — this is a public-facing endpoint
  const supabase = createAdminClient();

  // Try pitch_links first, then fallback to projects (generic link)
  let projectData: { system_prompt: string; company_name: string; settings: Record<string, unknown> };
  let projectId: string;
  let prospectName = "there";
  let prospectContextStr: string | null = null;

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

    // Parse prospect context from DB (not from client)
    if (pitchLink.prospect_context) {
      try {
        const ctx: ProspectContext = typeof pitchLink.prospect_context === "string"
          ? JSON.parse(pitchLink.prospect_context)
          : pitchLink.prospect_context as ProspectContext;
        const formatted = formatProspectContext(ctx, prospectName);
        if (formatted) prospectContextStr = formatted;
      } catch { /* ignore malformed */ }
    }
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

  // Email gate enforcement
  const requireEmailGate = (project.settings.require_email_gate as boolean) ?? false;
  if (requireEmailGate && !visitorEmail) {
    return NextResponse.json({ error: "Email required", code: "EMAIL_REQUIRED" }, { status: 403 });
  }

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

## Conversation Style — CRITICAL
You are not a FAQ bot. You are a proactive sales agent closing a call with the founders. Every response MUST end with a question. Never just answer and stop.

**Question progression — follow this strictly:**
1. First 1-2 exchanges: qualify — "What kind of products do you sell?", "How does your team handle this today?", "Is this for you personally or your whole team?"
2. Next 1-2 exchanges: dig into fit — "What would need to be true for this to work for you?", "What's your biggest challenge with [topic]?"
3. ANY sign of interest (they say yes, sounds good, interesting, could work, I like this, etc.) → STOP asking product questions. IMMEDIATELY pivot to booking. Do not wait. Do not ask another product question first.

**Once interest is shown — MANDATORY booking push:**
Say something like: "Honestly, the best next step is a quick call with our founders — they can show you exactly how this works for your situation. I can book that for you right now. What's your name and email and I'll get it locked in?"
- Be direct and confident. Don't ask "would you like to" — assume yes and go for it.
- If they give any resistance ("maybe later", "I'll think about it"), acknowledge it briefly then push again: "I get it — but it's just 20 minutes and completely worth it. Want me to find a slot for next week?"
- Keep pushing until they either book or explicitly say no.
- If calendar booking is available, use check_availability immediately and present real slots.

**Rules:**
- ALWAYS end with one question — no exceptions
- Never ask more than one question at a time
- The goal is a booked call. Not education. Not a satisfied prospect. A booked call.

## Troll Detection
If the prospect sends 5 or more messages that are clearly nonsensical, gibberish, offensive, or completely unrelated to anything (e.g. random sounds, repeated meaningless words, insults) — they are trolling. After the 5th such message, say something like: "Looks like this isn't a great time — feel free to come back when you're ready. Talk soon!" Then end the conversation naturally.

## Speech Output Guidelines
Your responses will be read aloud via text-to-speech. Write in a natural, conversational spoken style:
- Use contractions (we're, you'll, that's, it's) — never formal written style
- Keep sentences short and punchy — long sentences sound unnatural when spoken
- Sound warm and enthusiastic, like you're having a real conversation, not reading a script
- Avoid bullet points, markdown formatting, or anything visual — this is pure audio`;

  // Append prospect context from DB (not client)
  if (prospectContextStr) {
    fullSystemPrompt += `\n\n## Prospect Intelligence\n${prospectContextStr}`;
  }

  // Append calendar booking instructions if enabled
  if (project.settings.calendar_booking_enabled) {
    fullSystemPrompt += `\n\n## Calendar Booking\nYou can check availability and book meetings directly. When the prospect wants to schedule a call:\n1. Call check_availability to get open slots\n2. Present 2-3 options naturally ("I have Tuesday at 2pm or Wednesday at 10am — which works?")\n3. Once they confirm, call book_meeting with the slot_time, their name, and email\nIf you don't have the prospect's email, ask for it before booking.`;
  }

  // Append session limit instruction
  fullSystemPrompt += `\n\n## Session Limit\nThis voice session has a 5-minute limit. When you sense time is running low (after covering the main topics), naturally wrap up and push for a booking: "I want to make sure we get you connected with our team before we wrap up — can I book a quick call for you right now?" Then use the book_meeting or check_availability tools if available.`;

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

  // Fetch the seller's company name from the users table
  const { data: projectRow } = await supabase
    .from("projects")
    .select("user_id")
    .eq("id", projectId)
    .single();
  let sellerCompanyName = (project.settings.product_name as string | undefined) || project.company_name;
  if (projectRow?.user_id) {
    const { data: userProfile } = await supabase
      .from("users")
      .select("company_name")
      .eq("id", projectRow.user_id)
      .single();
    if (userProfile?.company_name) sellerCompanyName = userProfile.company_name;
  }

  const openingMessage = hasHistory
    ? "I'm here — feel free to keep talking!"
    : prospectName && prospectName !== "there"
    ? `Hey! I can walk you through how ${sellerCompanyName} can help ${prospectName}. What would you like to know?`
    : `Hey! I can walk you through how ${sellerCompanyName} can help. What would you like to know?`;

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
    return NextResponse.json(
      { error: "Failed to get signed URL" },
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
      conversation: {
        max_duration_seconds: 300,
      },
    },
  });
}
