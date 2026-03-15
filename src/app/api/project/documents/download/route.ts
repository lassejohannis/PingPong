import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { searchParams } = new URL(request.url);
  const docId = searchParams.get("id");
  if (!docId) return new Response("Missing id", { status: 400 });

  const admin = createAdminClient();

  const { data: doc } = await admin
    .from("documents")
    .select("file_url, file_type, project_id, projects!inner(user_id)")
    .eq("id", docId)
    .single();

  if (!doc) return new Response("Not found", { status: 404 });

  const owner = (doc.projects as unknown as { user_id: string }).user_id;
  if (owner !== user.id) return new Response("Forbidden", { status: 403 });

  const { data, error } = await admin.storage.from("documents").download(doc.file_url);
  if (!data || error) {
    console.error("Document download failed:", error);
    return new Response("Download failed", { status: 500 });
  }

  // Convert Blob to ArrayBuffer for Response
  const arrayBuffer = await data.arrayBuffer();

  return new Response(arrayBuffer, {
    headers: {
      "Content-Type": doc.file_type || "application/octet-stream",
      "Content-Length": String(arrayBuffer.byteLength),
    },
  });
}
