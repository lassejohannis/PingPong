import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
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

  const { data: pitchLink } = await admin
    .from("pitch_links")
    .select("id")
    .eq("slug", slug)
    .single();

  if (!pitchLink) {
    return Response.json({ error: "Pitch link not found" }, { status: 404 });
  }

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

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ conversationId: data.id });
}
