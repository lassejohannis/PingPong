import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/types";
import Anthropic from "@anthropic-ai/sdk";
import { extractDocumentContent } from "@/lib/ai/extract-document";
import { generateSystemPrompt } from "@/lib/ai/generate-system-prompt";
import {
  getAllQuestions,
  getEmptyKnowledge,
  type AgentKnowledge,
  type KnowledgeQuestion,
} from "@/lib/ai/knowledge-questions";

const anthropic = new Anthropic();

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId } = await request.json() as { projectId: string };
  if (!projectId) return Response.json({ error: "Missing projectId" }, { status: 400 });

  const { data: project } = await supabase
    .from("projects")
    .select("id, settings, user_id")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .single();

  if (!project) return Response.json({ error: "Not found" }, { status: 404 });

  const { data: documents } = await supabase
    .from("documents")
    .select("id, file_name, file_type, file_url, extracted_text")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });

  if (!documents || documents.length === 0) {
    return Response.json({ error: "No documents to process" }, { status: 400 });
  }

  const encoder = new TextEncoder();

  // Use TransformStream for proper flushing
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();

  const send = async (data: Record<string, unknown>) => {
    await writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
  };

  // Run processing in background
  (async () => {
    try {
      const settings = (project.settings ?? {}) as Record<string, unknown>;
      let knowledge = (settings.agent_knowledge as AgentKnowledge) || getEmptyKnowledge();
      const customQuestions = (settings.custom_questions as KnowledgeQuestion[]) || [];
      const allQuestions = getAllQuestions(customQuestions);
      const admin = createAdminClient();

      for (let i = 0; i < documents.length; i++) {
        const doc = documents[i];

        await send({ type: "status", message: `Reading "${doc.file_name}"...` });

        // Get document content
        let content;
        try {
          content = await extractDocumentContent(doc.file_url, doc.file_type);

          // Save extracted text if we got it
          if (content.text && !doc.extracted_text) {
            await admin
              .from("documents")
              .update({ extracted_text: content.text })
              .eq("id", doc.id);
          }
        } catch (err) {
          await send({ type: "status", message: `Could not read "${doc.file_name}", skipping...` });
          console.error(`Failed to extract ${doc.file_name}:`, err);
          continue;
        }

        // Skip if no content at all
        if (!content.text && !content.base64) {
          await send({ type: "status", message: `"${doc.file_name}" has no content, skipping...` });
          continue;
        }

        await send({ type: "status", message: `Analyzing "${doc.file_name}" for answers...` });

        // Build current knowledge summary (standard + custom questions)
        const currentKnowledgeText = allQuestions
          .map((q) => {
            const entry = knowledge[q.id];
            const isBriefing = entry?.sourceType === "briefing";
            const status = entry?.answer
              ? `Current answer${isBriefing ? " (SET BY SELLER — do not replace, only add new info)" : ""}: ${entry.answer}`
              : entry?.needsReview
              ? "NEEDS REVIEW — previous source was removed, verify if still valid"
              : "Not yet answered";
            return `- ${q.id}: ${q.question}\n  ${status}`;
          })
          .join("\n");

        const promptText = `You are analyzing a product document to extract knowledge for an AI sales agent.

## Document: "${doc.file_name}"
${content.text ? content.text.slice(0, 15000) : "(See attached PDF document)"}

## Knowledge Questions (current state):
${currentKnowledgeText}

## Instructions:
Read the document and determine which questions it can answer or improve the answer for.
Only update a question if the document provides NEW, RELEVANT information that is BETTER or MORE COMPLETE than the current answer.
Do NOT update questions where the document has no relevant information.

Respond in JSON format:
{
  "updates": [
    {
      "questionId": "the question id",
      "answer": "the new/improved answer based on the document",
      "quality": "basic|good|excellent",
      "reason": "brief explanation of what new info the document provided"
    }
  ]
}

Quality levels:
- "basic": Surface-level answer, few details (1-2 generic sentences)
- "good": Solid answer with concrete specifics (names, features, processes)
- "excellent": Comprehensive with numbers, examples, differentiators, or actionable detail

If the document has no relevant information for any question, respond with: { "updates": [] }
IMPORTANT: Respond ONLY with the JSON object, no other text.`;

        // Build message content — text or PDF document block
        const messageContent: Anthropic.ContentBlockParam[] = [];

        if (content.base64 && content.mediaType) {
          // Send PDF directly to Claude Vision
          messageContent.push({
            type: "document",
            source: {
              type: "base64",
              media_type: content.mediaType,
              data: content.base64,
            },
          });
        }

        messageContent.push({ type: "text", text: promptText });

        const response = await anthropic.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 4000,
          messages: [{ role: "user", content: messageContent }],
        });

        const responseText = response.content[0];
        if (responseText.type !== "text") continue;

        try {
          // Clean response — sometimes Claude wraps in ```json ... ```
          let jsonText = responseText.text.trim();
          if (jsonText.startsWith("```")) {
            jsonText = jsonText.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
          }

          const parsed = JSON.parse(jsonText);
          if (Array.isArray(parsed.updates) && parsed.updates.length > 0) {
            for (const update of parsed.updates) {
              if (update.questionId && update.answer) {
                const existing = knowledge[update.questionId];
                // Protect briefing entries — don't replace, only supplement
                if (existing?.sourceType === "briefing") {
                  // Append new info if Claude found something additional
                  knowledge[update.questionId] = {
                    ...existing,
                    answer: existing.answer + "\n\n" + update.answer,
                    quality: update.quality || existing.quality,
                    sources: [...new Set([...existing.sources, doc.id])],
                    updatedAt: new Date().toISOString(),
                    needsReview: false,
                  };
                } else {
                  knowledge[update.questionId] = {
                    answer: update.answer,
                    quality: update.quality || "basic",
                    sourceType: "document",
                    sources: [...new Set([...(existing?.sources || []), doc.id])],
                    updatedAt: new Date().toISOString(),
                    needsReview: false,
                  };
                }
              }
            }
            await send({ type: "status", message: `Found ${parsed.updates.length} answer(s) in "${doc.file_name}"` });
          } else {
            await send({ type: "status", message: `No new information in "${doc.file_name}"` });
          }
        } catch {
          console.error(`Failed to parse Claude response for ${doc.file_name}:`, responseText.text.slice(0, 200));
          await send({ type: "status", message: `Could not process response for "${doc.file_name}"` });
        }
      }

      // Generate system prompt
      await send({ type: "status", message: "Generating system prompt..." });

      const { data: userProfile } = await supabase
        .from("users")
        .select("company_name")
        .eq("id", user.id)
        .single();

      const systemPrompt = await generateSystemPrompt({
        knowledge,
        productName: (settings.product_name as string) || "the product",
        companyName: userProfile?.company_name || undefined,
        productDescription: (settings.product_description as string) || undefined,
        productWebsite: (settings.product_website as string) || undefined,
        tone: (settings.tone as string) || undefined,
        aggressiveness: (settings.aggressiveness as number) || undefined,
        pricingStrategy: (settings.pricing_strategy as string) || undefined,
        ctaType: (settings.cta_type as string) || undefined,
        responseLength: (settings.response_length as string) || undefined,
        customRules: (settings.custom_rules as string) || undefined,
        customQuestions,
      });

      // Save
      await supabase
        .from("projects")
        .update({
          system_prompt: systemPrompt,
          settings: { ...settings, agent_knowledge: knowledge } as unknown as Json,
        })
        .eq("id", projectId);

      await send({
        type: "done",
        knowledge,
        systemPrompt,
        documentsProcessed: documents.length,
      });
    } catch (err) {
      console.error("Process docs error:", err);
      await send({ type: "error", message: "Processing failed" });
    } finally {
      await writer.close();
    }
  })();

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
