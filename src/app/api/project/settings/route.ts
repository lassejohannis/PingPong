import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/types";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId, updates } = await request.json() as {
    projectId: string;
    updates: Record<string, unknown>;
  };

  if (!projectId || !updates) {
    return Response.json({ error: "Missing fields" }, { status: 400 });
  }

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
    .update({ settings: { ...existing, ...updates } as unknown as Json })
    .eq("id", projectId);

  return Response.json({ success: true });
}
