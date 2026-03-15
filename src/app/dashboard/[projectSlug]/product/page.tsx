import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AgentTuningPanels } from "@/components/agent-tuning-panels";
import type { AgentKnowledge } from "@/lib/ai/knowledge-questions";

export default async function ProductPage({
  params,
}: {
  params: Promise<{ projectSlug: string }>;
}) {
  const { projectSlug } = await params;
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id, user_id, company_name, system_prompt, settings")
    .eq("slug", projectSlug)
    .single();

  if (!project) redirect("/dashboard");

  const { data: userProfile } = await supabase
    .from("users")
    .select("company_name")
    .eq("id", project.user_id)
    .single();

  const settings =
    project.settings && typeof project.settings === "object" && !Array.isArray(project.settings)
      ? (project.settings as Record<string, unknown>)
      : {};

  const knowledge = (settings.agent_knowledge as AgentKnowledge) || null;

  const { data: documents } = await supabase
    .from("documents")
    .select("id, file_name, file_type, file_url, created_at")
    .eq("project_id", project.id)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Agent Tuning</h1>
        <p className="text-sm text-[#666] mt-1">
          Teach the AI everything about your product.
          {userProfile?.company_name && (
            <> Company: <span className="text-[#888]">{userProfile.company_name}</span></>
          )}
        </p>
      </div>

      <AgentTuningPanels
        projectId={project.id}
        initialSettings={settings}
        initialKnowledge={knowledge}
        initialSystemPrompt={project.system_prompt}
        initialDocuments={documents ?? []}
        productName={(settings.product_name as string) || project.company_name}
        companyName={userProfile?.company_name || project.company_name}
      />
    </div>
  );
}
