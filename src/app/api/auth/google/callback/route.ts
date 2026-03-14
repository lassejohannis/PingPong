import { google } from "googleapis";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/google/callback`
  );
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const returnTo = searchParams.get("state") ?? "/dashboard";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  if (!code) {
    return NextResponse.redirect(`${appUrl}${returnTo}?gmail_error=no_code`);
  }

  try {
    const oauth2Client = getOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Get Gmail address from token info
    const tokenInfo = await oauth2Client.getTokenInfo(tokens.access_token!);
    const gmailEmail = tokenInfo.email ?? null;
    console.log("Gmail OAuth: tokenInfo =", tokenInfo);

    // Store tokens in Supabase user_metadata
    const supabase = await createClient();
    await supabase.auth.updateUser({
      data: {
        gmail_access_token: tokens.access_token,
        gmail_refresh_token: tokens.refresh_token,
        gmail_token_expiry: tokens.expiry_date,
        gmail_email: gmailEmail,
      },
    });

    return NextResponse.redirect(`${appUrl}${returnTo}`);
  } catch (err) {
    console.error("Gmail OAuth callback error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.redirect(`${appUrl}${returnTo}?gmail_error=${encodeURIComponent(message)}`);
  }
}
