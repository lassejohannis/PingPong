import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";

const client = new Anthropic();

const showSlideTool: Anthropic.Tool = {
  name: "show_slide",
  description:
    "Display a specific slide from the pitch deck to the prospect. Call this whenever the conversation topic matches a slide's content. Always navigate to the most relevant slide for the current question or topic.",
  input_schema: {
    type: "object" as const,
    properties: {
      slide_index: {
        type: "integer",
        description: "The index of the slide to display (0-based)",
      },
      reason: {
        type: "string",
        description:
          "Brief explanation of why this slide is relevant right now (not shown to the prospect, used for analytics logging)",
      },
    },
    required: ["slide_index"],
  },
};

export async function POST(request: NextRequest) {
  const {
    messages,
    systemPrompt,
    slides,
  }: {
    messages: Anthropic.MessageParam[];
    systemPrompt: string;
    slides: { index: number; title: string; description: string }[];
  } = await request.json();

  // Build slide context for the system prompt
  const slideContext = slides
    .map(
      (s) =>
        `Slide ${s.index}: "${s.title}" — ${s.description}`
    )
    .join("\n");

  const fullSystemPrompt = `${systemPrompt}

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
- Add natural pauses with ellipses ... for dramatic effect or thinking moments
- Use CAPS sparingly for emphasis on key words (e.g. "Our designs REALLY pay for themselves")
- Write numbers and currencies as spoken words (e.g. "fifteen thousand euros" not "€15,000")
- Spell out abbreviations (e.g. "U X audit" not "UX audit", "S A A S" not "SaaS")
- Keep sentences short and punchy — long sentences sound unnatural when spoken
- Sound warm and enthusiastic, like you're having a real conversation, not reading a script
- Avoid bullet points, markdown formatting, or anything visual — this is pure audio`;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
        );
      };

      let currentMessages = [...messages];

      // Agentic loop: keep going until Claude stops calling tools
      while (true) {
        const response = client.messages.stream({
          model: "claude-sonnet-4-20250514",
          max_tokens: 4096,
          system: fullSystemPrompt,
          tools: [showSlideTool],
          messages: currentMessages,
        });

        const toolUseBlocks: Anthropic.ToolUseBlock[] = [];
        let clauseBuffer = "";

        for await (const event of response) {
          if (
            event.type === "content_block_start" &&
            event.content_block.type === "text"
          ) {
            send({ type: "text_start" });
            clauseBuffer = "";
          }

          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            send({ type: "text_delta", text: event.delta.text });

            // Track clause boundaries for low-latency TTS
            clauseBuffer += event.delta.text;
            const clauseEnd = clauseBuffer.match(/[,;:—.!?]\s/);
            if (clauseEnd) {
              const idx = clauseEnd.index! + 1;
              const clause = clauseBuffer.slice(0, idx).trim();
              // Minimum 4 words for natural-sounding TTS
              if (clause.split(/\s+/).length >= 4) {
                send({ type: "clause_end", text: clause });
                clauseBuffer = clauseBuffer.slice(idx);
              }
            }
          }

          if (event.type === "content_block_stop") {
            // Flush remaining text as final clause
            const remaining = clauseBuffer.trim();
            if (remaining.length > 3) {
              send({ type: "clause_end", text: remaining });
            }
            clauseBuffer = "";
          }
        }

        const finalMessage = await response.finalMessage();

        // Collect any tool use blocks
        for (const block of finalMessage.content) {
          if (block.type === "tool_use") {
            toolUseBlocks.push(block);
          }
        }

        // If no tools were called, we're done
        if (toolUseBlocks.length === 0) {
          send({ type: "done", stop_reason: finalMessage.stop_reason });
          break;
        }

        // Process tool calls
        const toolResults: Anthropic.ToolResultBlockParam[] = [];
        for (const toolUse of toolUseBlocks) {
          if (toolUse.name === "show_slide") {
            const input = toolUse.input as {
              slide_index: number;
              reason?: string;
            };

            // Send slide change event to the frontend
            send({
              type: "slide_change",
              slide_index: input.slide_index,
              reason: input.reason,
            });

            toolResults.push({
              type: "tool_result",
              tool_use_id: toolUse.id,
              content: `Slide ${input.slide_index} is now being displayed to the prospect.`,
            });
          }
        }

        // Continue the conversation with tool results
        currentMessages = [
          ...currentMessages,
          { role: "assistant", content: finalMessage.content },
          { role: "user", content: toolResults },
        ];
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
