import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import Anthropic from "@anthropic-ai/sdk";
import type { Json } from "@/lib/supabase/types";

const anthropic = new Anthropic();

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId, presentationDocId, slideCount, imageUrls } = await request.json() as {
    projectId: string;
    presentationDocId: string;
    slideCount: number;
    imageUrls: string[];
  };

  if (!projectId || !presentationDocId || !slideCount) {
    return Response.json({ error: "Missing fields" }, { status: 400 });
  }

  // Verify ownership
  const { data: project } = await supabase
    .from("projects")
    .select("id, settings")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .single();

  if (!project) return Response.json({ error: "Not found" }, { status: 404 });

  const admin = createAdminClient();

  // Load the presentation PDF for Claude Vision
  const { data: doc } = await admin
    .from("documents")
    .select("file_url, file_type")
    .eq("id", presentationDocId)
    .single();

  if (!doc) return Response.json({ error: "Document not found" }, { status: 404 });

  const { data: fileData } = await admin.storage.from("documents").download(doc.file_url);
  if (!fileData) return Response.json({ error: "Failed to download" }, { status: 500 });

  const buffer = Buffer.from(await fileData.arrayBuffer());
  const base64 = buffer.toString("base64");

  // Ask Claude to generate metadata for each slide
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4000,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: {
              type: "base64",
              media_type: "application/pdf",
              data: base64,
            },
          },
          {
            type: "text",
            text: `This PDF has ${slideCount} pages/slides. For each slide, provide a short title and a 1-2 sentence description of what the slide shows. The description should help an AI sales agent decide WHEN to show this slide during a conversation.

Respond in JSON format:
{
  "slides": [
    { "slide_index": 0, "title": "...", "description": "..." },
    { "slide_index": 1, "title": "...", "description": "..." }
  ]
}

IMPORTANT: Respond ONLY with the JSON object. Include exactly ${slideCount} entries.`,
          },
        ],
      },
    ],
  });

  const responseText = response.content[0];
  if (responseText.type !== "text") {
    return Response.json({ error: "Unexpected response" }, { status: 500 });
  }

  let slidesData: { slide_index: number; title: string; description: string }[];
  try {
    let jsonText = responseText.text.trim();
    if (jsonText.startsWith("```")) {
      jsonText = jsonText.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }
    const parsed = JSON.parse(jsonText);
    slidesData = parsed.slides;
  } catch {
    return Response.json({ error: "Failed to parse slide metadata" }, { status: 500 });
  }

  // Delete old slides for this project
  await admin.from("slides").delete().eq("project_id", projectId);

  // Insert new slides with image URLs
  const slideRows = slidesData.map((s, i) => ({
    project_id: projectId,
    slide_index: s.slide_index,
    title: s.title,
    description: s.description,
    image_url: imageUrls[i] || "",
  }));

  const { error: insertError } = await admin
    .from("slides")
    .insert(slideRows);

  if (insertError) {
    return Response.json({ error: insertError.message }, { status: 500 });
  }

  // Update last_processed_presentation_id
  const settings = (project.settings ?? {}) as Record<string, unknown>;
  await supabase
    .from("projects")
    .update({
      settings: {
        ...settings,
        last_processed_presentation_id: presentationDocId,
      } as unknown as Json,
    })
    .eq("id", projectId);

  return Response.json({ slides: slidesData });
}
