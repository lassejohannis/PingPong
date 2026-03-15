import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId, documentId } = await request.json() as {
    projectId: string;
    documentId: string | null;
  };

  if (!projectId) return Response.json({ error: "Missing projectId" }, { status: 400 });

  // Verify project ownership and get current settings
  const { data: project } = await supabase
    .from("projects")
    .select("id, settings")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .single();

  if (!project) return Response.json({ error: "Not found" }, { status: 404 });

  const existing =
    project.settings && typeof project.settings === "object" && !Array.isArray(project.settings)
      ? (project.settings as Record<string, unknown>)
      : {};

  await supabase
    .from("projects")
    .update({
      settings: { ...existing, presentation_doc_id: documentId },
    })
    .eq("id", projectId);

  return Response.json({ success: true });
}
