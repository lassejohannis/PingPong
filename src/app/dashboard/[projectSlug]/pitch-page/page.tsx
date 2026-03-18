import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { PitchPageEditor } from "@/components/pitch-page-editor";

export default async function PitchPageSettings({
  params,
}: {
  params: Promise<{ projectSlug: string }>;
}) {
  const { projectSlug } = await params;
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id, slug, company_name, settings")
    .eq("slug", projectSlug)
    .single();

  if (!project) redirect("/dashboard");

  const settings =
    project.settings && typeof project.settings === "object" && !Array.isArray(project.settings)
      ? (project.settings as Record<string, unknown>)
      : {};

  const presentationDocId = (settings.presentation_doc_id as string) ?? null;

  const { data: documents } = await supabase
    .from("documents")
    .select("id, file_name, file_type")
    .eq("project_id", project.id)
    .order("created_at", { ascending: false });

  const presentationDoc = presentationDocId
    ? (documents ?? []).find((d) => d.id === presentationDocId) ?? null
    : null;

  const defaultQuestions = [
    "What does it cost?",
    "How does it work?",
    "Show me case studies",
    "What makes you different?",
  ];

  return (
    <PitchPageEditor
      projectId={project.id}
      projectSlug={project.slug}
      companyName={project.company_name}
      settings={settings}
      defaultQuestions={defaultQuestions}
      presentationDocId={presentationDocId}
      presentationDocName={presentationDoc?.file_name ?? null}
    />
  );
}
