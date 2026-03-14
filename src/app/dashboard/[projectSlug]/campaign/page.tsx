import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { CampaignBuilder } from "./campaign-builder";

export default async function CampaignPage({
  params,
}: {
  params: Promise<{ projectSlug: string }>;
}) {
  const { projectSlug } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: project } = await supabase
    .from("projects")
    .select("id, company_name, settings")
    .eq("slug", projectSlug)
    .single();

  if (!project) redirect("/dashboard");

  const settings =
    project.settings && typeof project.settings === "object" && !Array.isArray(project.settings)
      ? (project.settings as Record<string, string>)
      : {};
  const productName = settings.product_name ?? project.company_name;

  type LeadRow = { slug: string; prospect_name: string; headline: string; contact_email: string | null };
  const { data: rawLeads } = await supabase
    .from("pitch_links")
    .select("slug, prospect_name, headline, contact_email")
    .eq("project_id", project.id)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .returns<LeadRow[]>();

  const leads = rawLeads ?? [];

  const meta = user.user_metadata as Record<string, string | undefined>;
  const gmailEmail = meta.gmail_email ?? null;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  return (
    <CampaignBuilder
      projectId={project.id}
      projectSlug={projectSlug}
      productName={productName}
      leads={leads}
      appUrl={appUrl}
      gmailEmail={gmailEmail}
    />
  );
}
