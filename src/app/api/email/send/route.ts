import { createClient } from "@/lib/supabase/server";
import { google } from "googleapis";

function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/google/callback`
  );
}

function encodeEmail(to: string, from: string, subject: string, html: string): string {
  const message = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/html; charset=UTF-8`,
    ``,
    html,
  ].join("\r\n");

  return Buffer.from(message)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const meta = user.user_metadata as Record<string, string | number | undefined>;
  if (!meta.gmail_access_token) {
    return Response.json({ error: "gmail_not_connected" }, { status: 403 });
  }

  const body = await request.json();
  const { projectId, subject, bodyHtml }: { projectId: string; subject: string; bodyHtml: string } = body;

  const { data: project } = await supabase
    .from("projects")
    .select("company_name, settings")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .single();

  if (!project) return Response.json({ error: "Project not found" }, { status: 404 });

  const settings =
    project.settings && typeof project.settings === "object" && !Array.isArray(project.settings)
      ? (project.settings as Record<string, string>)
      : {};
  const productName = settings.product_name ?? project.company_name;

  type LeadRow = { slug: string; prospect_name: string; headline: string; contact_email: string };
  const { data: leads } = await supabase
    .from("pitch_links")
    .select("slug, prospect_name, headline, contact_email")
    .eq("project_id", projectId)
    .eq("status", "active")
    .not("contact_email", "is", null)
    .returns<LeadRow[]>();

  if (!leads || leads.length === 0) {
    return Response.json({ sent: 0, failed: 0, errors: [] });
  }

  // Set up OAuth2 client with stored tokens
  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({
    access_token: meta.gmail_access_token as string,
    refresh_token: meta.gmail_refresh_token as string,
    expiry_date: meta.gmail_token_expiry as number,
  });

  // Refresh token if expiring within 60 seconds
  if (meta.gmail_token_expiry && Date.now() > (meta.gmail_token_expiry as number) - 60_000) {
    const { credentials } = await oauth2Client.refreshAccessToken();
    oauth2Client.setCredentials(credentials);
    await supabase.auth.updateUser({
      data: {
        gmail_access_token: credentials.access_token,
        gmail_token_expiry: credentials.expiry_date,
      },
    });
  }

  const gmail = google.gmail({ version: "v1", auth: oauth2Client });
  const fromEmail = meta.gmail_email as string;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  let sent = 0;
  let failed = 0;
  const errors: Array<{ email: string; error: string }> = [];

  for (const lead of leads) {
    const pitchUrl = `${appUrl}/p/${lead.slug}`;
    const ogImageUrl = `${appUrl}/api/og/pitch?${new URLSearchParams({
      prospect: lead.prospect_name,
      product: productName,
      headline: lead.headline,
    })}`;

    const personalizedSubject = subject.replace(/\{\{prospect_name\}\}/g, lead.prospect_name);
    const personalizedHtml = bodyHtml
      .replace(/\{\{prospect_name\}\}/g, lead.prospect_name)
      .replace(/\{\{pitch_link_url\}\}/g, pitchUrl)
      .replace(/\{\{og_image_url\}\}/g, ogImageUrl);

    try {
      await gmail.users.messages.send({
        userId: "me",
        requestBody: {
          raw: encodeEmail(lead.contact_email, fromEmail, personalizedSubject, personalizedHtml),
        },
      });
      sent++;
    } catch (err) {
      failed++;
      errors.push({ email: lead.contact_email, error: err instanceof Error ? err.message : String(err) });
    }
  }

  return Response.json({ sent, failed, errors });
}
