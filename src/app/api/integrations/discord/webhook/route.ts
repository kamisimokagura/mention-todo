import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { SourceChannel } from "@/types";
import { timingSafeEqual } from "crypto";

function verifySecret(provided: string | null): boolean {
  const expected = process.env.DISCORD_WEBHOOK_SECRET;
  if (!expected || !provided) return false;
  try {
    const a = Buffer.from(provided);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  const secret = request.headers.get("x-webhook-secret");
  if (!verifySecret(secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { messageId, content, authorName, authorId, channelId, channelName, guildName, timestamp } = body;

  if (!messageId || !content) {
    return NextResponse.json({ error: "messageId and content are required" }, { status: 400 });
  }

  const sourceUrl = `https://discord.com/channels/${body.guildId || "@me"}/${channelId}/${messageId}`;

  // Idempotent upsert
  const existing = await prisma.message.findUnique({
    where: {
      sourceChannel_externalId: {
        sourceChannel: SourceChannel.DISCORD,
        externalId: messageId,
      },
    },
  });

  if (existing) {
    return NextResponse.json({ message: existing, created: false });
  }

  const message = await prisma.message.create({
    data: {
      sourceChannel: SourceChannel.DISCORD,
      externalId: messageId,
      senderName: authorName || authorId,
      body: content,
      sourceUrl,
      receivedAt: timestamp ? new Date(timestamp) : new Date(),
      rawMetadata: JSON.stringify({ channelId, channelName, guildName, authorId }),
    },
  });

  return NextResponse.json({ message, created: true }, { status: 201 });
}
