import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit, getClientIP } from "@/lib/rate-limit";

const saveLimiter = rateLimit({ windowMs: 60_000, max: 10 });

export async function POST(request: Request) {
  // Rate limiting
  const ip = getClientIP(request);
  const { success } = saveLimiter.check(ip);
  if (!success) {
    return Response.json({ error: "Too many requests" }, { status: 429 });
  }

  const { slug, messages, slidesViewed, visitorEmail } = await request.json() as {
    slug: string;
    messages: { role: string; content: string }[];
    slidesViewed: number[];
    visitorEmail?: string;
  };

  if (!slug || !messages) {
    return Response.json({ error: "Missing fields" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Try pitch_links first (personalized link)
  const { data: pitchLink } = await admin
    .from("pitch_links")
    .select("id, project_id")
    .eq("slug", slug)
    .single();

  let projectId: string;

  if (pitchLink) {
    projectId = pitchLink.project_id;
  } else {
    // Fallback: generic project link
    const { data: project } = await admin
      .from("projects")
      .select("id")
      .eq("slug", slug)
      .single();

    if (!project) {
      return Response.json({ error: "Pitch link not found" }, { status: 404 });
    }
    projectId = project.id;
  }

  // Email gate enforcement — check project settings
  const { data: proj } = await admin
    .from("projects")
    .select("settings")
    .eq("id", projectId)
    .single();

  const settings = (proj?.settings ?? {}) as Record<string, unknown>;
  if ((settings.require_email_gate as boolean) && !visitorEmail) {
    return Response.json({ error: "Email required" }, { status: 403 });
  }

  // Save conversation
  if (pitchLink) {
    const { data, error } = await admin
      .from("conversations")
      .insert({
        pitch_link_id: pitchLink.id,
        messages,
        slides_viewed: slidesViewed ?? [],
        visitor_email: visitorEmail || null,
      })
      .select("id")
      .single();

    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ conversationId: data.id });
  }

  const { data, error } = await admin
    .from("conversations")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .insert({
      project_id: projectId,
      messages,
      slides_viewed: slidesViewed ?? [],
      visitor_email: visitorEmail || null,
    } as any)
    .select("id")
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ conversationId: data.id });
}
