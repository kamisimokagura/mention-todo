import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import path from "path";

function resolveDatabaseUrl() {
  const configured = process.env.DATABASE_URL?.trim();
  if (!configured) {
    return `file:${path.join(process.cwd(), "prisma", "dev.db")}`;
  }

  if (!configured.startsWith("file:")) {
    return configured;
  }

  const rawPath = configured.slice("file:".length);
  if (!rawPath) {
    return `file:${path.join(process.cwd(), "prisma", "dev.db")}`;
  }

  const absolutePath = path.isAbsolute(rawPath)
    ? rawPath
    : path.resolve(process.cwd(), rawPath);

  return `file:${absolutePath}`;
}

const adapter = new PrismaBetterSqlite3({ url: resolveDatabaseUrl() });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding database...");

  // Clean existing data
  await prisma.bundleMember.deleteMany();
  await prisma.bundle.deleteMany();
  await prisma.messageToTodo.deleteMany();
  await prisma.syncLog.deleteMany();
  await prisma.message.deleteMany();
  await prisma.todo.deleteMany();
  await prisma.integration.deleteMany();

  // Scenario: A社見積もり依頼 - same request across channels
  const msg1 = await prisma.message.create({
    data: {
      sourceChannel: "DISCORD",
      externalId: "discord_001",
      senderName: "田中太郎#1234",
      body: "@you 明日までにA社見積出して。条件は前回と同じでいいから。",
      sourceUrl: "https://discord.com/channels/123/456/discord_001",
      receivedAt: new Date("2026-02-18T10:00:00"),
      rawMetadata: JSON.stringify({ channelName: "requests", guildName: "Work Server" }),
    },
  });

  const msg2 = await prisma.message.create({
    data: {
      sourceChannel: "GMAIL",
      externalId: "gmail_001",
      senderName: "tanaka@example.com",
      senderEmail: "tanaka@example.com",
      subject: "Re: A社見積もりの件",
      body: "見積条件はこのメールの添付参照してください。納品は2週間後を想定。",
      sourceUrl: "https://mail.google.com/mail/u/0/#inbox/gmail_001",
      receivedAt: new Date("2026-02-18T10:30:00"),
    },
  });

  const msg3 = await prisma.message.create({
    data: {
      sourceChannel: "DISCORD",
      externalId: "discord_002",
      senderName: "佐藤花子#5678",
      body: "@you 納期は2週間って書いといて。A社の件ね。",
      sourceUrl: "https://discord.com/channels/123/456/discord_002",
      receivedAt: new Date("2026-02-18T11:00:00"),
      rawMetadata: JSON.stringify({ channelName: "requests", guildName: "Work Server" }),
    },
  });

  // Unrelated messages
  const msg4 = await prisma.message.create({
    data: {
      sourceChannel: "DISCORD",
      externalId: "discord_003",
      senderName: "山田次郎#9999",
      body: "@you 来週の定例ミーティングの資料、確認お願いします",
      sourceUrl: "https://discord.com/channels/123/789/discord_003",
      receivedAt: new Date("2026-02-18T14:00:00"),
    },
  });

  const msg5 = await prisma.message.create({
    data: {
      sourceChannel: "GMAIL",
      externalId: "gmail_002",
      senderName: "suzuki@example.com",
      senderEmail: "suzuki@example.com",
      subject: "B社プレゼン資料レビュー",
      body: "添付のプレゼン資料のレビューをお願いします。金曜までに。",
      sourceUrl: "https://mail.google.com/mail/u/0/#inbox/gmail_002",
      receivedAt: new Date("2026-02-18T15:00:00"),
    },
  });

  const msg6 = await prisma.message.create({
    data: {
      sourceChannel: "GMAIL",
      externalId: "gmail_003",
      senderName: "suzuki@example.com",
      senderEmail: "suzuki@example.com",
      subject: "Re: B社プレゼン資料レビュー",
      body: "追記: スライド3のグラフデータも更新お願いします。",
      sourceUrl: "https://mail.google.com/mail/u/0/#inbox/gmail_003",
      receivedAt: new Date("2026-02-18T16:00:00"),
    },
  });

  // Create TODOs
  const todo1 = await prisma.todo.create({
    data: {
      title: "A社見積書を作成する",
      description: "条件は前回と同じ。納期2週間。添付メール参照。",
      status: "OPEN",
      priority: "HIGH",
      deadline: new Date("2026-02-19T23:59:59"),
    },
  });

  const todo2 = await prisma.todo.create({
    data: {
      title: "定例ミーティング資料の確認",
      description: "来週の定例ミーティングの資料を確認する",
      status: "OPEN",
      priority: "MEDIUM",
    },
  });

  const todo3 = await prisma.todo.create({
    data: {
      title: "B社プレゼン資料のレビュー",
      description: "プレゼン資料とスライド3のグラフデータを確認",
      status: "OPEN",
      priority: "MEDIUM",
      deadline: new Date("2026-02-21T23:59:59"),
    },
  });

  const todo4 = await prisma.todo.create({
    data: {
      title: "A社見積もりの納期設定",
      description: "納期を2週間に設定する",
      status: "OPEN",
      priority: "HIGH",
      deadline: new Date("2026-02-19T23:59:59"),
    },
  });

  // Link messages to TODOs (traceability)
  await prisma.messageToTodo.createMany({
    data: [
      { messageId: msg1.id, todoId: todo1.id, linkType: "AUTO" },
      { messageId: msg2.id, todoId: todo1.id, linkType: "AUTO" },
      { messageId: msg3.id, todoId: todo4.id, linkType: "AUTO" },
      { messageId: msg4.id, todoId: todo2.id, linkType: "MANUAL" },
      { messageId: msg5.id, todoId: todo3.id, linkType: "AUTO" },
      { messageId: msg6.id, todoId: todo3.id, linkType: "AUTO" },
    ],
  });

  // Create a suggested bundle (A社見積もり関連)
  await prisma.bundle.create({
    data: {
      status: "SUGGESTED",
      similarityScore: 0.91,
      autoLabel: "A社見積書を作成する / A社見積もりの納期設定",
      members: {
        create: [
          { todoId: todo1.id },
          { todoId: todo4.id },
        ],
      },
    },
  });

  // Integration records
  await prisma.integration.createMany({
    data: [
      { channel: "DISCORD", enabled: true },
      { channel: "GMAIL", enabled: false },
    ],
  });

  console.log("Seed complete!");
  console.log(`  Messages: 6`);
  console.log(`  TODOs: 4`);
  console.log(`  Links: 6`);
  console.log(`  Bundles: 1 (SUGGESTED)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
