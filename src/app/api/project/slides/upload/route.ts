import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const projectId = formData.get("projectId") as string | null;
  const slideIndex = formData.get("slideIndex") as string | null;

  if (!file || !projectId || slideIndex === null) {
    return Response.json({ error: "Missing fields" }, { status: 400 });
  }

  // Verify project ownership
  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .single();

  if (!project) return Response.json({ error: "Not found" }, { status: 404 });

  const path = `${projectId}/${slideIndex}.png`;
  const admin = createAdminClient();

  const { error: uploadError } = await admin.storage
    .from("slides")
    .upload(path, file, { upsert: true, contentType: "image/png" });

  if (uploadError) return Response.json({ error: uploadError.message }, { status: 500 });

  const { data } = admin.storage.from("slides").getPublicUrl(path);
  const imageUrl = `${data.publicUrl}?t=${Date.now()}`;

  return Response.json({ imageUrl });
}
