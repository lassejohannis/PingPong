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

  // Verify project ownership
  const { data: project } = await supabase
    .from("projects")
    .select("settings")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .single();

  if (!project) return Response.json({ error: "Not found" }, { status: 404 });

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "png";
  const path = `${projectId}/logo.${ext}`;

  // Use service role for storage — anon key is blocked by RLS on slides bucket
  const admin = createAdminClient();
  const { error: uploadError } = await admin.storage
    .from("slides")
    .upload(path, file, { upsert: true, contentType: file.type });

  if (uploadError) return Response.json({ error: uploadError.message }, { status: 500 });

  const { data } = admin.storage.from("slides").getPublicUrl(path);
  const logoUrl = `${data.publicUrl}?t=${Date.now()}`;

  // Save URL into project settings
  const existing =
    project.settings && typeof project.settings === "object" && !Array.isArray(project.settings)
      ? (project.settings as Record<string, string>)
      : {};

  await supabase
    .from("projects")
    .update({ settings: { ...existing, logo_url: logoUrl } })
    .eq("id", projectId);

  return Response.json({ logoUrl });
}
