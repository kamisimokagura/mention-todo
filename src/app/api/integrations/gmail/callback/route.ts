import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

function redirectToSettings(
  request: NextRequest,
  params: Record<string, string>
) {
  const url = new URL("/settings/gmail", request.url);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });
  const response = NextResponse.redirect(url);
  response.cookies.set("gmail_oauth_state", "", { maxAge: 0, path: "/" });
  return response;
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const state = searchParams.get("state");
  const storedState = request.cookies.get("gmail_oauth_state")?.value;

  if (error) {
    return redirectToSettings(request, { error });
  }

  if (!state || !storedState || state !== storedState) {
    return redirectToSettings(request, { error: "invalid_state" });
  }

  if (!code) {
    return NextResponse.json({ error: "No code provided" }, { status: 400 });
  }

  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  const redirectUri = process.env.GMAIL_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    return NextResponse.json({ error: "Gmail OAuth not configured" }, { status: 500 });
  }

  // Exchange code for tokens
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  const tokens = await tokenResponse.json();

  if (!tokenResponse.ok) {
    return redirectToSettings(request, { error: "token_exchange_failed" });
  }

  // Store tokens in Integration table
  await prisma.integration.upsert({
    where: { channel: "GMAIL" },
    update: {
      enabled: true,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || undefined,
      tokenExpiry: tokens.expires_in
        ? new Date(Date.now() + tokens.expires_in * 1000)
        : null,
    },
    create: {
      channel: "GMAIL",
      enabled: true,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || null,
      tokenExpiry: tokens.expires_in
        ? new Date(Date.now() + tokens.expires_in * 1000)
        : null,
    },
  });

  return redirectToSettings(request, { success: "true" });
}
