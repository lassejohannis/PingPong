import { createClient } from "@/lib/supabase/server";
import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 60;
import {
  AGENT_KNOWLEDGE_QUESTIONS,
  getEmptyKnowledge,
  type AgentKnowledge,
} from "@/lib/ai/knowledge-questions";

const client = new Anthropic();
const MAX_TOOL_ITERATIONS = 15;

const knowledgeUpdateTool: Anthropic.Tool = {
  name: "propose_knowledge_update",
  description:
    "Propose an update to the agent's knowledge base. Use this when the seller provides new information, corrects something, or when you extract an answer from the conversation. In test mode, use this when the seller corrects your response.",
  input_schema: {
    type: "object" as const,
    properties: {
      question_id: {
        type: "string",
        description: "The ID of the knowledge question being updated",
      },
      new_answer: {
        type: "string",
        description: "The new or improved answer",
      },
      reason: {
        type: "string",
        description: "Brief explanation of what changed and why",
      },
    },
    required: ["question_id", "new_answer", "reason"],
  },
};

const checkpointTool: Anthropic.Tool = {
  name: "checkpoint",
  description:
    "Trigger a checkpoint to save pending knowledge updates. Call this after accumulating 3-4 updates, or when switching topics, or when the seller seems to be wrapping up. The frontend will show a confirmation dialog.",
  input_schema: {
    type: "object" as const,
    properties: {
      summary: {
        type: "string",
        description: "Brief summary of what was learned/changed in this batch",
      },
    },
    required: ["summary"],
  },
};

function buildInterviewPrompt(knowledge: AgentKnowledge, productName: string): string {
  const unanswered = AGENT_KNOWLEDGE_QUESTIONS
    .filter((q) => !knowledge[q.id]?.answer)
    .map((q) => `- [${q.id}] ${q.question}`)
    .join("\n");

  const answered = AGENT_KNOWLEDGE_QUESTIONS
    .filter((q) => knowledge[q.id]?.answer)
    .map((q) => `- [${q.id}] ${q.question}\n  Answer: ${knowledge[q.id].answer}`)
    .join("\n");

  return `You are interviewing a seller about their product "${productName}" to build an AI sales agent's knowledge base.

## Your Goal
Ask the seller targeted questions to fill gaps in the knowledge base. Be conversational and natural — group related questions, don't interrogate.

## Questions Still Open:
${unanswered || "All questions are answered! Help the seller refine and improve existing answers."}

## Already Known:
${answered || "Nothing yet — start from the beginning."}

## Instructions
- Ask 1-2 questions at a time, naturally grouped by topic
- When the seller answers, use the propose_knowledge_update tool to save each piece of information
- After collecting 3-4 updates, use the checkpoint tool to suggest saving
- Be encouraging and acknowledge good answers
- If all questions are answered, offer to dive deeper into any area
- Keep it conversational — you're a helpful colleague, not a form`;
}

function buildTestPrompt(knowledge: AgentKnowledge, productName: string): string {
  const knowledgeText = AGENT_KNOWLEDGE_QUESTIONS
    .filter((q) => knowledge[q.id]?.answer)
    .map((q) => `**${q.question}**\n${knowledge[q.id].answer}`)
    .join("\n\n");

  return `You are an AI sales agent for "${productName}" being tested by the seller. Act exactly like you would with a real prospect.

## Your Knowledge:
${knowledgeText || "You have no product knowledge yet. Tell the seller you need more information."}

## Instructions
- Respond to questions as if the seller is a prospect
- Use ONLY the knowledge above — don't make things up
- If the seller corrects you (e.g. "That's not right, actually..." or "No, the price is..."), use the propose_knowledge_update tool to record the correction
- After accumulating 3-4 corrections, use the checkpoint tool
- Be honest when you don't know something — say "I don't have information about that yet"
- Stay in character as the sales agent unless explicitly corrected`;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const {
    projectId,
    mode,
    messages,
  }: {
    projectId: string;
    mode: "interview" | "test";
    messages: Anthropic.MessageParam[];
  } = await request.json();

  // Verify ownership and get project
  const { data: project } = await supabase
    .from("projects")
    .select("id, settings, company_name")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .single();

  if (!project) return Response.json({ error: "Not found" }, { status: 404 });

  const settings = (project.settings ?? {}) as Record<string, unknown>;
  const knowledge = (settings.agent_knowledge as AgentKnowledge) || getEmptyKnowledge();
  const productName = (settings.product_name as string) || project.company_name;

  const systemPrompt = mode === "interview"
    ? buildInterviewPrompt(knowledge, productName)
    : buildTestPrompt(knowledge, productName);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      let currentMessages = [...messages];

      try {
        // Agentic loop
        let iterations = 0;
        while (iterations < MAX_TOOL_ITERATIONS) {
          iterations++;
          const response = client.messages.stream({
            model: "claude-sonnet-4-20250514",
            max_tokens: 2000,
            system: systemPrompt,
            tools: [knowledgeUpdateTool, checkpointTool],
            messages: currentMessages,
          });

          const toolUseBlocks: Anthropic.ToolUseBlock[] = [];

          for await (const event of response) {
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              send({ type: "text_delta", text: event.delta.text });
            }
          }

          const finalMessage = await response.finalMessage();

          for (const block of finalMessage.content) {
            if (block.type === "tool_use") {
              toolUseBlocks.push(block);
            }
          }

          if (toolUseBlocks.length === 0) {
            send({ type: "done" });
            break;
          }

          const toolResults: Anthropic.ToolResultBlockParam[] = [];
          for (const toolUse of toolUseBlocks) {
            if (toolUse.name === "propose_knowledge_update") {
              const input = toolUse.input as {
                question_id: string;
                new_answer: string;
                reason: string;
              };
              send({
                type: "knowledge_update",
                questionId: input.question_id,
                newAnswer: input.new_answer,
                reason: input.reason,
              });
              toolResults.push({
                type: "tool_result",
                tool_use_id: toolUse.id,
                content: "Update noted. Continue the conversation.",
              });
            }

            if (toolUse.name === "checkpoint") {
              const input = toolUse.input as { summary: string };
              send({
                type: "checkpoint",
                summary: input.summary,
              });
              toolResults.push({
                type: "tool_result",
                tool_use_id: toolUse.id,
                content: "Checkpoint shown to the user. They will decide whether to save. Continue the conversation.",
              });
            }
          }

          currentMessages = [
            ...currentMessages,
            { role: "assistant", content: finalMessage.content },
            { role: "user", content: toolResults },
          ];
        }
      } catch (err: unknown) {
        console.error("Briefing chat streaming error:", err);
        const apiErr = err as { status?: number; error?: { type?: string } };
        const isRateLimit = apiErr.status === 429 || apiErr.error?.type === "rate_limit_error";
        send({
          type: "error",
          error_type: isRateLimit ? "rate_limit" : "server_error",
          message: isRateLimit
            ? "The agent is currently busy. Please try again in a moment."
            : "Something went wrong. Please try again.",
        });
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
