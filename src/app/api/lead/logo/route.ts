import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const pitchLinkId = formData.get("pitchLinkId") as string | null;

  if (!file || !pitchLinkId) return Response.json({ error: "Missing fields" }, { status: 400 });

  // Verify ownership via project
  const { data: lead } = await supabase
    .from("pitch_links")
    .select("id, project_id")
    .eq("id", pitchLinkId)
    .single();

  if (!lead) return Response.json({ error: "Not found" }, { status: 404 });

  const { data: proj } = await supabase
    .from("projects")
    .select("id")
    .eq("id", lead.project_id)
    .single();

  if (!proj) return Response.json({ error: "Forbidden" }, { status: 403 });

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "png";
  const path = `leads/${pitchLinkId}/logo.${ext}`;

  const admin = createAdminClient();
  const { error: uploadError } = await admin.storage
    .from("slides")
    .upload(path, file, { upsert: true, contentType: file.type });

  if (uploadError) return Response.json({ error: uploadError.message }, { status: 500 });

  const { data } = admin.storage.from("slides").getPublicUrl(path);
  const logoUrl = `${data.publicUrl}?t=${Date.now()}`;

  await admin
    .from("pitch_links")
    .update({ prospect_logo: logoUrl })
    .eq("id", pitchLinkId);

  return Response.json({ logoUrl });
}
