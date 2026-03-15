import { createClient } from "@/lib/supabase/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const {
    projectId,
    toneInstruction,
    existingTemplate,
  }: {
    projectId: string;
    toneInstruction?: string;
    existingTemplate?: { subject: string; bodyHtml: string };
  } = body;

  // Fetch project (verify ownership via RLS)
  const { data: project } = await supabase
    .from("projects")
    .select("company_name, company_url, system_prompt, settings")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .single();

  if (!project) return Response.json({ error: "Project not found" }, { status: 404 });

  const settings =
    project.settings && typeof project.settings === "object" && !Array.isArray(project.settings)
      ? (project.settings as Record<string, string>)
      : {};
  const productName = settings.product_name ?? project.company_name;
  const systemPromptSnippet = project.system_prompt
    ? project.system_prompt.slice(0, 500)
    : "";

  let userMessage: string;

  if (toneInstruction && existingTemplate) {
    userMessage = `You are a B2B sales email copywriter. Take the existing email template below and rewrite it with this change: "${toneInstruction}".

Keep the exact same placeholder tokens:
- {{contact_name}} — the contact person's name (use this to open the email greeting)
- {{prospect_name}} — the prospect's company name
- {{pitch_link_url}} — their personalised pitch page URL
- {{og_image_url}} — the preview image URL (keep inside the <a><img> tag exactly as shown)

Existing template to modify:
Subject: ${existingTemplate.subject}

Body:
${existingTemplate.bodyHtml}`;
  } else {
    userMessage = `You are a B2B sales email copywriter. Write a concise, high-converting cold email template for the following product.

Product: ${productName}
Seller company: ${project.company_name}
${project.company_url ? `Product website: ${project.company_url}` : ""}
${systemPromptSnippet ? `Product context: ${systemPromptSnippet}` : ""}

Requirements:
- Write a subject line and HTML email body
- Use these exact placeholder tokens in the body:
  - {{contact_name}} — the contact person's first + last name (use this to open the email, e.g. "Hi {{contact_name}},")
  - {{prospect_name}} — the prospect's company name (use in body copy, not greeting)
  - {{pitch_link_url}} — their personalised pitch page URL
  - {{og_image_url}} — preview image URL
- The email body must include this exact HTML block for the pitch preview (do not change the tags or attributes):
  <a href="{{pitch_link_url}}" style="display:block;text-decoration:none;margin:24px 0;"><img src="{{og_image_url}}" alt="Watch your personalised pitch" width="600" style="border-radius:8px;border:1px solid #e5e7eb;display:block;" /></a>
- After the image block, include a plain-text CTA button as fallback:
  <a href="{{pitch_link_url}}" style="display:inline-block;background:#000;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-size:14px;font-family:Arial,sans-serif;">Watch your personalised pitch →</a>
- Keep it concise (2-3 short paragraphs before the image)
- Use inline styles for all HTML (email clients don't support external CSS)
- Wrap everything in a <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#111;font-size:15px;line-height:1.6;">`;
  }

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1500,
    tools: [
      {
        name: "write_email_template",
        description: "Output the email template as structured data",
        input_schema: {
          type: "object" as const,
          properties: {
            subject: { type: "string", description: "Email subject line" },
            bodyHtml: {
              type: "string",
              description:
                "Full HTML email body with inline styles and placeholder tokens",
            },
          },
          required: ["subject", "bodyHtml"],
        },
      },
    ],
    tool_choice: { type: "tool", name: "write_email_template" },
    messages: [{ role: "user", content: userMessage }],
  });

  const toolUse = response.content.find((c) => c.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    return Response.json({ error: "Failed to generate template" }, { status: 500 });
  }

  const result = toolUse.input as { subject: string; bodyHtml: string };
  return Response.json({ subject: result.subject, bodyHtml: result.bodyHtml });
}
