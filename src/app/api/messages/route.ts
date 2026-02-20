import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { SourceChannel } from "@/types";

function parsePagination(value: string | null, fallback: number, max: number) {
  const parsed = Number.parseInt(value || "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
}

function toSafeExternalUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.trim().length === 0) return null;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const channel = searchParams.get("channel");
  const linked = searchParams.get("linked"); // "true" | "false"
  const page = parsePagination(searchParams.get("page"), 1, 10000);
  const limit = parsePagination(searchParams.get("limit"), 20, 100);

  const where: Record<string, unknown> = {};
  if (channel && Object.values(SourceChannel).includes(channel as SourceChannel)) {
    where.sourceChannel = channel;
  }
  if (linked === "true") {
    where.todos = { some: {} };
  } else if (linked === "false") {
    where.todos = { none: {} };
  }

  const [messages, total] = await Promise.all([
    prisma.message.findMany({
      where,
      include: { todos: { include: { todo: true } } },
      orderBy: { receivedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.message.count({ where }),
  ]);

  return NextResponse.json({ messages, total, page, limit });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { sourceChannel, externalId, senderName, senderEmail, subject, body: msgBody, sourceUrl, rawMetadata } = body;

  if (
    !sourceChannel ||
    !Object.values(SourceChannel).includes(sourceChannel as SourceChannel) ||
    typeof msgBody !== "string" ||
    msgBody.trim().length === 0
  ) {
    return NextResponse.json({ error: "valid sourceChannel and body are required" }, { status: 400 });
  }

  // Idempotent upsert by sourceChannel + externalId
  if (externalId) {
    const existing = await prisma.message.findUnique({
      where: { sourceChannel_externalId: { sourceChannel, externalId } },
    });
    if (existing) {
      return NextResponse.json({ message: existing, created: false });
    }
  }

  const message = await prisma.message.create({
    data: {
      sourceChannel,
      externalId: externalId || null,
      senderName: senderName || null,
      senderEmail: senderEmail || null,
      subject: subject || null,
      body: msgBody,
      sourceUrl: toSafeExternalUrl(sourceUrl),
      rawMetadata: rawMetadata ? JSON.stringify(rawMetadata) : null,
    },
  });

  return NextResponse.json({ message, created: true }, { status: 201 });
}
