import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { SourceChannel, SyncStatus } from "@/types";

async function refreshTokenIfNeeded() {
  const integration = await prisma.integration.findUnique({ where: { channel: "GMAIL" } });
  if (!integration?.accessToken) return null;

  // Check if token is expired
  if (integration.tokenExpiry && new Date() >= integration.tokenExpiry) {
    if (!integration.refreshToken) return null;

    const clientId = process.env.GMAIL_CLIENT_ID;
    const clientSecret = process.env.GMAIL_CLIENT_SECRET;
    if (!clientId || !clientSecret) return null;

    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: integration.refreshToken,
        grant_type: "refresh_token",
      }),
    });

    const tokens = await response.json();
    if (!response.ok) return null;

    await prisma.integration.update({
      where: { channel: "GMAIL" },
      data: {
        accessToken: tokens.access_token,
        tokenExpiry: tokens.expires_in
          ? new Date(Date.now() + tokens.expires_in * 1000)
          : null,
      },
    });

    return tokens.access_token as string;
  }

  return integration.accessToken;
}

export async function POST() {
  const log = await prisma.syncLog.create({
    data: { channel: SourceChannel.GMAIL, status: SyncStatus.PARTIAL },
  });

  try {
    const accessToken = await refreshTokenIfNeeded();
    if (!accessToken) {
      await prisma.syncLog.update({
        where: { id: log.id },
        data: { status: SyncStatus.FAILED, errorMessage: "No valid access token", completedAt: new Date() },
      });
      return NextResponse.json({ error: "Gmail not connected or token expired" }, { status: 401 });
    }

    // Fetch recent messages with mentions (inbox, unread preferred)
    const listResponse = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=20&q=is:inbox",
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!listResponse.ok) {
      const err = await listResponse.text();
      await prisma.syncLog.update({
        where: { id: log.id },
        data: { status: SyncStatus.FAILED, errorMessage: err, completedAt: new Date() },
      });
      return NextResponse.json({ error: "Gmail API error" }, { status: 502 });
    }

    const listData = await listResponse.json();
    const messageIds: string[] = (listData.messages || []).map((m: { id: string }) => m.id);

    let messagesNew = 0;

    for (const gmailId of messageIds) {
      // Skip if already imported
      const existing = await prisma.message.findUnique({
        where: {
          sourceChannel_externalId: {
            sourceChannel: SourceChannel.GMAIL,
            externalId: gmailId,
          },
        },
      });
      if (existing) continue;

      // Fetch full message
      const msgResponse = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${gmailId}?format=metadata&metadataHeaders=Subject&metadataHeaders=From`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      if (!msgResponse.ok) continue;

      const msgData = await msgResponse.json();
      const headers = msgData.payload?.headers || [];
      const subject = headers.find((h: { name: string }) => h.name === "Subject")?.value || "(no subject)";
      const from = headers.find((h: { name: string }) => h.name === "From")?.value || "";
      const snippet = msgData.snippet || "";

      await prisma.message.create({
        data: {
          sourceChannel: SourceChannel.GMAIL,
          externalId: gmailId,
          senderName: from,
          senderEmail: from,
          subject,
          body: snippet,
          sourceUrl: `https://mail.google.com/mail/u/0/#inbox/${gmailId}`,
          receivedAt: new Date(parseInt(msgData.internalDate)),
        },
      });

      messagesNew++;
    }

    await prisma.syncLog.update({
      where: { id: log.id },
      data: {
        status: SyncStatus.SUCCESS,
        messagesFound: messageIds.length,
        messagesNew,
        completedAt: new Date(),
      },
    });

    await prisma.integration.update({
      where: { channel: "GMAIL" },
      data: { lastSyncAt: new Date() },
    });

    return NextResponse.json({ synced: messagesNew, total: messageIds.length });
  } catch (error) {
    await prisma.syncLog.update({
      where: { id: log.id },
      data: {
        status: SyncStatus.FAILED,
        errorMessage: error instanceof Error ? error.message : "Unknown error",
        completedAt: new Date(),
      },
    });
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}
