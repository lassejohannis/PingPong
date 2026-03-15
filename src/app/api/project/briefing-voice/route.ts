import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import {
  AGENT_KNOWLEDGE_QUESTIONS,
  getAllQuestions,
  getEmptyKnowledge,
  type AgentKnowledge,
  type KnowledgeQuestion,
} from "@/lib/ai/knowledge-questions";

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY!;
const ELEVENLABS_AGENT_ID = process.env.ELEVENLABS_AGENT_ID!;

function questionIdList(allQuestions: KnowledgeQuestion[]): string {
  return allQuestions.map((q) => `- "${q.id}": ${q.question}`).join("\n");
}

function buildInterviewPrompt(
  knowledge: AgentKnowledge,
  productName: string,
  allQuestions: KnowledgeQuestion[],
): string {
  const unanswered = allQuestions
    .filter((q) => !knowledge[q.id]?.answer)
    .map((q) => `- ${q.question} (id: "${q.id}")`)
    .join("\n");

  const answered = allQuestions
    .filter((q) => knowledge[q.id]?.answer)
    .map((q) => `- ${q.question}: ${knowledge[q.id].answer}`)
    .join("\n");

  return `You are interviewing a seller about "${productName}" to build an AI sales agent's knowledge. Be conversational, warm, and friendly — you're having a real spoken conversation.

## Questions still open:
${unanswered || "All answered — help refine existing answers."}

## Already known:
${answered || "Nothing yet."}

## Valid question IDs for propose_knowledge_update:
${questionIdList(allQuestions)}

## Instructions
- Ask 1-2 questions at a time, naturally
- When you learn something new, call the propose_knowledge_update tool with the matching question_id, the new_answer, and a short reason
- You can call the tool multiple times throughout the conversation
- Keep the conversation flowing — don't pause after each tool call

## Speech Output Guidelines
Your responses will be read aloud via text-to-speech:
- Use contractions (we're, you'll, that's) — sound natural, not scripted
- Keep sentences short and punchy
- Sound warm and enthusiastic, like a real conversation
- Never use bullet points, markdown, or visual formatting`;
}

function buildTestPrompt(
  knowledge: AgentKnowledge,
  productName: string,
  allQuestions: KnowledgeQuestion[],
): string {
  const knowledgeText = allQuestions
    .filter((q) => knowledge[q.id]?.answer)
    .map((q) => `${q.question}: ${knowledge[q.id].answer}`)
    .join("\n");

  return `You are an AI sales agent for "${productName}" being tested by the seller. Answer as if speaking to a real prospect. The seller may correct you — when they do, note the correction.

## Your knowledge:
${knowledgeText || "No knowledge yet."}

## Valid question IDs for propose_knowledge_update:
${questionIdList(allQuestions)}

## Instructions
- Use ONLY the knowledge above to answer questions
- If the seller corrects you, call propose_knowledge_update with the matching question_id, corrected answer, and reason
- Stay in character as the sales agent — don't break the fourth wall unless corrected

## Speech Output Guidelines
Your responses will be read aloud via text-to-speech:
- Use contractions (we're, you'll, that's) — sound natural, not scripted
- Keep sentences short and punchy
- Sound warm and enthusiastic, like a real conversation
- Never use bullet points, markdown, or visual formatting`;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId, mode, conversationHistory } = await request.json() as {
    projectId: string;
    mode: "interview" | "test";
    conversationHistory?: { role: "user" | "assistant"; content: string }[];
  };

  if (!projectId) return NextResponse.json({ error: "Missing projectId" }, { status: 400 });

  const { data: project } = await supabase
    .from("projects")
    .select("id, settings, company_name")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .single();

  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const settings = (project.settings ?? {}) as Record<string, unknown>;
  const knowledge = (settings.agent_knowledge as AgentKnowledge) || getEmptyKnowledge();
  const productName = (settings.product_name as string) || project.company_name;
  const customQuestions = (settings.custom_questions as KnowledgeQuestion[]) || [];
  const allQuestions = getAllQuestions(customQuestions);

  let systemPrompt = mode === "interview"
    ? buildInterviewPrompt(knowledge, productName, allQuestions)
    : buildTestPrompt(knowledge, productName, allQuestions);

  if (conversationHistory && conversationHistory.length > 0) {
    const historyText = conversationHistory
      .map((m) => `${m.role === "user" ? "Seller" : "You"}: ${m.content}`)
      .join("\n");
    systemPrompt += `\n\n## Previous Conversation\nContinue naturally from where you left off. Do NOT repeat your greeting.\n\n${historyText}`;
  }

  const hasHistory = conversationHistory && conversationHistory.length > 1;

  const firstMessage = hasHistory
    ? "I'm here — let's keep going!"
    : mode === "interview"
      ? `Let's talk about ${productName}. I have a few questions to get started.`
      : `I'm your ${productName} sales agent. Test me — ask anything a prospect would ask.`;

  const response = await fetch(
    `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${ELEVENLABS_AGENT_ID}`,
    {
      method: "GET",
      headers: { "xi-api-key": ELEVENLABS_API_KEY },
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    console.error("ElevenLabs signed URL error:", response.status, errText);
    return NextResponse.json({ error: "Failed to get signed URL" }, { status: 500 });
  }

  const { signed_url } = await response.json();

  return NextResponse.json({
    signedUrl: signed_url,
    overrides: {
      agent: {
        prompt: { prompt: systemPrompt },
        firstMessage,
      },
    },
  });
}
