import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 60;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export type ConversationReport = {
  questions_asked: string[];
  objections_raised: string[];
  slides_shown: number[];
  interest_level: "HOT" | "WARM" | "NOT_A_FIT";
  interest_reasoning: string;
  follow_up_action: string;
};

export async function POST(request: Request) {
  // Auth check — only project owners can generate reports
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { conversationId } = await request.json();
  if (!conversationId) {
    return Response.json({ error: "Missing conversationId" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: conv } = await admin
    .from("conversations")
    .select("id, messages, slides_viewed, project_id, visitor_email, pitch_links(prospect_name, projects(company_name, settings))" as any)
    .eq("id", conversationId)
    .single() as { data: { id: string; messages: any; slides_viewed: any; project_id: string | null; visitor_email: string | null; pitch_links: any } | null };

  if (!conv) return Response.json({ error: "Not found" }, { status: 404 });

  // Verify ownership — extract project_id and check via RLS
  let ownershipProjectId: string | null = conv.project_id;
  if (!ownershipProjectId && conv.pitch_links) {
    const pl = conv.pitch_links as { prospect_name: string; projects: { company_name: string; settings: Record<string, string> | null } & { id?: string } };
    // pitch_links join doesn't include project id directly — look it up
    const { data: plData } = await admin
      .from("conversations")
      .select("pitch_links!inner(project_id)")
      .eq("id", conversationId)
      .single();
    if (plData?.pitch_links) {
      ownershipProjectId = (plData.pitch_links as unknown as { project_id: string }).project_id;
    }
  }
  if (!ownershipProjectId) return Response.json({ error: "Not found" }, { status: 404 });

  const { data: ownedProject } = await supabase
    .from("projects")
    .select("id")
    .eq("id", ownershipProjectId)
    .single();
  if (!ownedProject) return Response.json({ error: "Forbidden" }, { status: 403 });

  let productName: string;
  let prospectName: string;

  if (conv.pitch_links) {
    const pitchLink = conv.pitch_links as {
      prospect_name: string;
      projects: { company_name: string; settings: Record<string, string> | null };
    };
    const settings = (pitchLink.projects.settings ?? {}) as Record<string, string>;
    productName = settings.product_name ?? pitchLink.projects.company_name;
    prospectName = pitchLink.prospect_name;
  } else {
    const { data: project } = await admin
      .from("projects")
      .select("company_name, settings")
      .eq("id", conv.project_id!)
      .single();
    const settings = ((project?.settings ?? {}) as Record<string, string>);
    productName = settings.product_name ?? project?.company_name ?? "the product";
    prospectName = (conv.visitor_email as string) || "Anonymous visitor";
  }

  const messages = (conv.messages as { role: string; content: string }[]) ?? [];
  const transcript = messages
    .map((m) => `${m.role === "user" ? "PROSPECT" : "AI AGENT"}: ${m.content}`)
    .join("\n\n");

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1000,
    tools: [
      {
        name: "write_conversation_report",
        description: "Generate a structured post-conversation report for the salesperson",
        input_schema: {
          type: "object" as const,
          properties: {
            questions_asked: {
              type: "array",
              items: { type: "string" },
              description: "Key questions the prospect asked during the conversation",
            },
            objections_raised: {
              type: "array",
              items: { type: "string" },
              description: "Objections or concerns the prospect raised",
            },
            slides_shown: {
              type: "array",
              items: { type: "number" },
              description: "Slide indices that were shown during the conversation",
            },
            interest_level: {
              type: "string",
              enum: ["HOT", "WARM", "NOT_A_FIT"],
              description: "Overall interest level assessment",
            },
            interest_reasoning: {
              type: "string",
              description: "Brief explanation of why this interest level was assigned",
            },
            follow_up_action: {
              type: "string",
              description: "Recommended next step for the salesperson (1-2 sentences)",
            },
          },
          required: [
            "questions_asked",
            "objections_raised",
            "slides_shown",
            "interest_level",
            "interest_reasoning",
            "follow_up_action",
          ],
        },
      },
    ],
    tool_choice: { type: "tool", name: "write_conversation_report" },
    messages: [
      {
        role: "user",
        content: `Analyze this sales conversation between an AI agent for ${productName} and ${prospectName}.

CONVERSATION TRANSCRIPT:
${transcript || "(No messages yet)"}

SLIDES VIEWED: ${JSON.stringify(conv.slides_viewed ?? [])}

Generate a concise post-conversation report for the salesperson.`,
      },
    ],
  });

  const toolUse = response.content.find((c) => c.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    return Response.json({ error: "Failed to generate report" }, { status: 500 });
  }

  const report = toolUse.input as ConversationReport;

  // Save report + qualification to conversations
  await admin
    .from("conversations")
    .update({
      feedback: JSON.stringify(report),
      qualification: report.interest_level,
      summary: report.follow_up_action,
    })
    .eq("id", conversationId);

  return Response.json({ report });
}
