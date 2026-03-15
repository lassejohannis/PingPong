import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const projectId = formData.get("projectId") as string | null;

  if (!file || !projectId) return Response.json({ error: "Missing fields" }, { status: 400 });

  const admin = createAdminClient();

  // Verify project ownership
  const { data: project } = await admin
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .single();

  if (!project) return Response.json({ error: "Not found" }, { status: 404 });

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
  const path = `${user.id}/${projectId}/${Date.now()}.${ext}`;

  const { error: uploadError } = await admin.storage
    .from("documents")
    .upload(path, file, { contentType: file.type });

  if (uploadError) return Response.json({ error: uploadError.message }, { status: 500 });

  // Use admin client for DB insert (bypasses RLS sub-query issues)
  const { data: doc, error: insertError } = await admin
    .from("documents")
    .insert({
      project_id: projectId,
      file_name: file.name,
      file_type: file.type,
      file_url: path,
    })
    .select("id, file_name, file_type, file_url, created_at")
    .single();

  if (insertError) return Response.json({ error: insertError.message }, { status: 500 });

  return Response.json({ document: doc });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const docId = searchParams.get("id");
  const forgetKnowledge = searchParams.get("forgetKnowledge") === "true";
  if (!docId) return Response.json({ error: "Missing id" }, { status: 400 });

  const admin = createAdminClient();

  // Fetch document and verify ownership via project
  const { data: doc } = await admin
    .from("documents")
    .select("id, file_url, project_id, projects!inner(user_id, settings)")
    .eq("id", docId)
    .single();

  if (!doc) return Response.json({ error: "Not found" }, { status: 404 });

  const project = doc.projects as unknown as { user_id: string; settings: Record<string, unknown> | null };
  if (project.user_id !== user.id) return Response.json({ error: "Forbidden" }, { status: 403 });

  // Delete from storage + database
  await admin.storage.from("documents").remove([doc.file_url]);
  await admin.from("documents").delete().eq("id", docId);

  // Clean up knowledge sources
  const settings = (project.settings ?? {}) as Record<string, unknown>;
  const knowledge = settings.agent_knowledge as Record<string, { sources?: string[]; needsReview?: boolean }> | undefined;

  if (knowledge) {
    let changed = false;
    for (const [key, entry] of Object.entries(knowledge)) {
      if (entry.sources?.includes(docId)) {
        entry.sources = entry.sources.filter((s: string) => s !== docId);
        if (forgetKnowledge) {
          entry.needsReview = true;
        }
        changed = true;
      }
    }
    if (changed) {
      await admin
        .from("projects")
        .update({ settings: { ...settings, agent_knowledge: knowledge } })
        .eq("id", doc.project_id);
    }
  }

  // If deleted doc was the presentation, clean up slides
  if (settings?.presentation_doc_id === docId) {
    // Delete all slide images from storage
    const { data: slides } = await admin
      .from("slides")
      .select("slide_index")
      .eq("project_id", doc.project_id);

    if (slides?.length) {
      const paths = slides.map((s) => `${doc.project_id}/${s.slide_index}.png`);
      await admin.storage.from("slides").remove(paths);
    }

    // Delete slide rows
    await admin.from("slides").delete().eq("project_id", doc.project_id);

    // Clear presentation settings
    const updatedSettings = { ...(settings || {}), presentation_doc_id: null, last_processed_presentation_id: null };
    await admin
      .from("projects")
      .update({ settings: updatedSettings })
      .eq("id", doc.project_id);
  }

  return Response.json({ success: true });
}
