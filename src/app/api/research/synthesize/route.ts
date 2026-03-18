import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import Anthropic from "@anthropic-ai/sdk";
import {
  AGENT_KNOWLEDGE_QUESTIONS,
  getAllQuestions,
  type AgentKnowledge,
} from "@/lib/ai/knowledge-questions";
import { NextRequest, NextResponse } from "next/server";
import type { ConversationReport } from "@/app/api/research/report/route";

export const maxDuration = 60;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId } = await request.json();
  if (!projectId) {
    return NextResponse.json({ error: "Missing projectId" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Fetch project — verify ownership
  const { data: project } = await admin
    .from("projects")
    .select("id, settings, company_name")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .single();

  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Fetch all pitch_link ids for this project
  const { data: pitchLinkRows } = await admin
    .from("pitch_links")
    .select("id")
    .eq("project_id", project.id);

  const pitchLinkIds = pitchLinkRows?.map((r) => r.id) ?? [];

  // Fetch conversations that have reports
  type ConvRow = {
    id: string;
    messages: { role: string; content: string }[];
    qualification: string | null;
    feedback: string | null;
    pitch_links: { prospect_name: string } | null;
  };

  // Pitch-link conversations
  const { data: pitchLinkConvs } = pitchLinkIds.length > 0
    ? await admin
        .from("conversations")
        .select("id, messages, qualification, feedback, pitch_links(prospect_name)")
        .in("pitch_link_id", pitchLinkIds)
        .not("feedback", "is", null)
        .order("updated_at", { ascending: false })
        .returns<ConvRow[]>()
    : { data: [] as ConvRow[] };

  // Generic project conversations
  const { data: genericConvs } = await admin
    .from("conversations")
    .select("id, messages, qualification, feedback")
    .eq("project_id", project.id)
    .is("pitch_link_id", null)
    .not("feedback", "is", null)
    .order("updated_at", { ascending: false })
    .returns<ConvRow[]>();

  const conversations = [...(pitchLinkConvs ?? []), ...(genericConvs ?? [])];

  if (conversations.length < 2) {
    return NextResponse.json(
      { error: "Need at least 2 reports to synthesize" },
      { status: 400 }
    );
  }

  // Parse each feedback as ConversationReport
  const reports: ConversationReport[] = [];
  for (const conv of conversations) {
    if (!conv.feedback) continue;
    try {
      reports.push(JSON.parse(conv.feedback) as ConversationReport);
    } catch {
      // skip malformed
    }
  }

  // Aggregate counts
  const hot = conversations.filter((c) => c.qualification === "HOT").length;
  const warm = conversations.filter((c) => c.qualification === "WARM").length;
  const notAFit = conversations.filter((c) => c.qualification === "NOT_A_FIT").length;

  // Aggregate questions asked
  const questionFreq: Record<string, number> = {};
  for (const r of reports) {
    for (const q of r.questions_asked ?? []) {
      const key = q.toLowerCase().trim();
      questionFreq[key] = (questionFreq[key] ?? 0) + 1;
    }
  }
  const aggregatedQuestions = Object.entries(questionFreq)
    .sort(([, a], [, b]) => b - a)
    .map(([q, count]) => (count > 1 ? `- "${q}" (${count}x)` : `- "${q}"`))
    .join("\n");

  // Aggregate objections
  const objectionFreq: Record<string, number> = {};
  for (const r of reports) {
    for (const obj of r.objections_raised ?? []) {
      const key = obj.toLowerCase().trim();
      objectionFreq[key] = (objectionFreq[key] ?? 0) + 1;
    }
  }
  const aggregatedObjections = Object.entries(objectionFreq)
    .sort(([, a], [, b]) => b - a)
    .map(([obj, count]) => (count > 1 ? `- "${obj}" (${count}x)` : `- "${obj}"`))
    .join("\n");

  // Follow-up actions
  const aggregatedFollowUps = reports
    .filter((r) => r.follow_up_action)
    .map((r) => `- ${r.follow_up_action}`)
    .join("\n");

  // Existing knowledge + questions
  const settings = (project.settings ?? {}) as Record<string, unknown>;
  const agentKnowledge = (settings.agent_knowledge as AgentKnowledge) ?? {};
  const productName =
    (settings.product_name as string) || (project.company_name as string) || "the product";
  const customQuestions = (settings.custom_questions as Parameters<typeof getAllQuestions>[0]) ?? [];
  const allQuestions = getAllQuestions(customQuestions);

  const knowledgeText = allQuestions
    .filter((q) => agentKnowledge[q.id]?.answer)
    .map((q) => `[${q.id}] ${q.question}\n${agentKnowledge[q.id].answer}`)
    .join("\n\n");

  // Claude call
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2000,
    tools: [
      {
        name: "suggest_knowledge_updates",
        description:
          "Suggest updates to the agent's knowledge base based on conversation patterns",
        input_schema: {
          type: "object" as const,
          properties: {
            suggestions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  questionId: {
                    type: "string",
                    description: "The knowledge question ID to update",
                  },
                  newAnswer: {
                    type: "string",
                    description: "Suggested new or improved answer",
                  },
                  reason: {
                    type: "string",
                    description:
                      "Why this update is suggested, citing specific patterns e.g. 'Asked in 5/8 conversations'",
                  },
                },
                required: ["questionId", "newAnswer", "reason"],
              },
            },
          },
          required: ["suggestions"],
        },
      },
    ],
    tool_choice: { type: "tool", name: "suggest_knowledge_updates" },
    messages: [
      {
        role: "user",
        content: `You are analyzing ${conversations.length} sales conversations for ${productName} to improve the AI agent's knowledge base.

## Valid question IDs you can update:
${allQuestions.map((q) => `- "${q.id}": ${q.question}`).join("\n")}

## Current knowledge (only non-empty answers shown):
${knowledgeText || "No knowledge yet"}

## Conversation patterns across ${conversations.length} conversations:

Qualification breakdown: ${hot} HOT, ${warm} WARM, ${notAFit} NOT_A_FIT

Most common questions asked by prospects:
${aggregatedQuestions || "(none)"}

Most common objections raised:
${aggregatedObjections || "(none)"}

Follow-up actions recommended:
${aggregatedFollowUps || "(none)"}

Based on these patterns, suggest specific improvements to the knowledge base. Focus on:
- Objections that came up repeatedly → improve the objections answer
- Questions the agent couldn't answer well → fill knowledge gaps
- Patterns that suggest missing or weak knowledge
Only suggest updates where the conversations clearly reveal a gap or improvement. Aim for 2-5 high-quality suggestions.`,
      },
    ],
  });

  const toolUse = response.content.find((c) => c.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    return NextResponse.json({ error: "Failed to generate suggestions" }, { status: 500 });
  }

  const toolInput = toolUse.input as {
    suggestions: { questionId: string; newAnswer: string; reason: string }[];
  };

  return NextResponse.json({
    suggestions: toolInput.suggestions,
    conversationCount: conversations.length,
  });
}
