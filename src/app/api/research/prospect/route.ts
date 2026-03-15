import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { crawlWebsite } from "@/lib/crawl/extract";
import { generateProspectProfile } from "@/lib/ai/prospect-research";

export const maxDuration = 60;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { pitchLinkId } = await request.json();
  if (!pitchLinkId) {
    return Response.json({ error: "Missing pitchLinkId" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: lead } = await admin
    .from("pitch_links")
    .select("id, prospect_name, prospect_url, prospect_context, project_id, projects(company_name, system_prompt, settings)")
    .eq("id", pitchLinkId)
    .single();

  if (!lead) return Response.json({ error: "Lead not found" }, { status: 404 });

  // Verify ownership via the project
  const { data: projectOwner } = await supabase
    .from("projects")
    .select("id")
    .eq("id", lead.project_id)
    .single();

  if (!projectOwner) return Response.json({ error: "Forbidden" }, { status: 403 });

  const project = lead.projects as {
    company_name: string;
    system_prompt: string | null;
    settings: Record<string, string> | null;
  };

  // Crawl prospect website
  let webContent = "";
  if (lead.prospect_url) {
    webContent = await crawlWebsite(lead.prospect_url);
  }

  const settings = (project.settings ?? {}) as Record<string, string>;
  const productName = settings.product_name ?? project.company_name;

  // Generate prospect profile with Claude
  const profile = await generateProspectProfile(lead.prospect_name, webContent, {
    productName,
    companyName: project.company_name,
    systemPrompt: project.system_prompt,
  });

  // Save to pitch_links.prospect_context
  await admin
    .from("pitch_links")
    .update({ prospect_context: JSON.stringify(profile) })
    .eq("id", pitchLinkId);

  return Response.json({ profile });
}
