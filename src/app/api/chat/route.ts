import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";

export const maxDuration = 60;

const client = new Anthropic();
const MAX_TOOL_ITERATIONS = 15;

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

const checkAvailabilityTool: Anthropic.Tool = {
  name: "check_availability",
  description: "Check available meeting slots for the next 7 days. Call this when the prospect wants to book a call or meeting.",
  input_schema: { type: "object" as const, properties: {}, required: [] },
};

const bookMeetingTool: Anthropic.Tool = {
  name: "book_meeting",
  description: "Book a meeting slot for the prospect. Call this after the prospect confirms a specific time slot.",
  input_schema: {
    type: "object" as const,
    properties: {
      slot_time: { type: "string", description: "The ISO datetime of the slot to book (from check_availability)" },
      attendee_name: { type: "string", description: "The prospect's full name" },
      attendee_email: { type: "string", description: "The prospect's email address" },
    },
    required: ["slot_time", "attendee_name", "attendee_email"],
  },
};

export async function POST(request: NextRequest) {
  const {
    messages,
    systemPrompt,
    prospectContext,
    slides,
    calendarEnabled,
    visitorEmail,
  }: {
    messages: Anthropic.MessageParam[];
    systemPrompt: string;
    prospectContext?: string | null;
    slides: { index: number; title: string; description: string }[];
    calendarEnabled?: boolean;
    visitorEmail?: string;
  } = await request.json();

  // Count user messages — enforce 30-message limit
  const userMessageCount = (messages as { role: string }[]).filter(m => m.role === "user").length;
  if (userMessageCount >= 30) {
    const closingText = calendarEnabled
      ? "We've had a great conversation! I'd love to get you connected with our team for a deeper dive. Let me pull up some available times for a call — just say the word and I'll book it for you right now."
      : "We've had a great conversation! I'd love to get you connected with our team directly for a deeper dive. Reach out and we'll take it from there.";

    const encoder = new TextEncoder();
    const limitStream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "text_delta", text: closingText })}\n\n`));
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "limit_reached", calendarEnabled: !!calendarEnabled })}\n\n`));
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done", stop_reason: "limit" })}\n\n`));
        controller.close();
      },
    });
    return new Response(limitStream, {
      headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
    });
  }

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

## Speech Output Guidelines
Your responses will be read aloud via text-to-speech. Write in a natural, conversational spoken style:
- Use contractions (we're, you'll, that's, it's) — never formal written style
- Add natural pauses with ellipses ... for dramatic effect or thinking moments
- Use CAPS sparingly for emphasis on key words (e.g. "Our designs REALLY pay for themselves")
- Write numbers and currencies as spoken words (e.g. "fifteen thousand euros" not "€15,000")
- Spell out abbreviations (e.g. "U X audit" not "UX audit", "S A A S" not "SaaS")
- Keep sentences short and punchy — long sentences sound unnatural when spoken
- Sound warm and enthusiastic, like you're having a real conversation, not reading a script
- Avoid bullet points, markdown formatting, or anything visual — this is pure audio`
  + (prospectContext ? `\n\n## Prospect Intelligence\n${prospectContext}` : "")
  + (calendarEnabled ? `\n\n## Calendar Booking\nYou can check availability and book meetings directly. When the prospect wants to schedule a call:\n1. Call check_availability to get open slots\n2. Present 2-3 options naturally ("I have Tuesday at 2pm or Wednesday at 10am — which works?")\n3. Once they confirm, call book_meeting with the slot_time, their name, and email\n${visitorEmail ? `Prospect email already collected: ${visitorEmail}` : "If you don't have their email, ask for it before booking."}` : "");

  const tools: Anthropic.Tool[] = [showSlideTool];
  if (calendarEnabled) tools.push(checkAvailabilityTool, bookMeetingTool);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
        );
      };

      let currentMessages = [...messages];

      try {
        // Agentic loop: keep going until Claude stops calling tools
        let iterations = 0;
        while (iterations < MAX_TOOL_ITERATIONS) {
          iterations++;
          const response = client.messages.stream({
            model: "claude-sonnet-4-20250514",
            max_tokens: 4096,
            system: fullSystemPrompt,
            tools,
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

            if (toolUse.name === "check_availability") {
              const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
              const availRes = await fetch(`${baseUrl}/api/calendar/availability`);
              const availData = await availRes.json();
              toolResults.push({
                type: "tool_result",
                tool_use_id: toolUse.id,
                content: availData.slotsText || "No slots available.",
              });
            }

            if (toolUse.name === "book_meeting") {
              const input = toolUse.input as { slot_time: string; attendee_name: string; attendee_email: string };
              const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
              const bookRes = await fetch(`${baseUrl}/api/calendar/book`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ start: input.slot_time, attendeeName: input.attendee_name, attendeeEmail: input.attendee_email }),
              });
              const bookData = await bookRes.json();
              if (bookData.success) {
                send({ type: "booking_confirmed", message: bookData.message });
              }
              toolResults.push({
                type: "tool_result",
                tool_use_id: toolUse.id,
                content: bookData.success ? bookData.message : (bookData.error || "Booking failed."),
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
      } catch (err: unknown) {
        console.error("Chat streaming error:", err);
        const apiErr = err as { status?: number; error?: { type?: string }; headers?: Record<string, string> };
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
