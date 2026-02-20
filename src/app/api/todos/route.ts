import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { TodoStatus, TodoPriority } from "@/types";

function parsePagination(value: string | null, fallback: number, max: number) {
  const parsed = Number.parseInt(value || "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const status = searchParams.get("status");
  const priority = searchParams.get("priority");
  const search = searchParams.get("search");
  const page = parsePagination(searchParams.get("page"), 1, 10000);
  const limit = parsePagination(searchParams.get("limit"), 20, 100);

  const where: Record<string, unknown> = {};
  if (status && Object.values(TodoStatus).includes(status as TodoStatus)) {
    where.status = status;
  }
  if (priority && Object.values(TodoPriority).includes(priority as TodoPriority)) {
    where.priority = priority;
  }
  if (search) {
    where.OR = [
      { title: { contains: search } },
      { description: { contains: search } },
    ];
  }

  const [todos, total] = await Promise.all([
    prisma.todo.findMany({
      where,
      include: {
        messages: { include: { message: true } },
        bundleMembers: { include: { bundle: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.todo.count({ where }),
  ]);

  return NextResponse.json({ todos, total, page, limit });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { title, description, status, priority, deadline, messageId, linkType } = body;

  if (typeof title !== "string" || title.trim().length === 0) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  if (status && !Object.values(TodoStatus).includes(status)) {
    return NextResponse.json({ error: "invalid status" }, { status: 400 });
  }

  if (priority && !Object.values(TodoPriority).includes(priority)) {
    return NextResponse.json({ error: "invalid priority" }, { status: 400 });
  }

  const todo = await prisma.todo.create({
    data: {
      title: title.trim(),
      description: description || null,
      status: status || TodoStatus.OPEN,
      priority: priority || TodoPriority.MEDIUM,
      deadline: deadline ? new Date(deadline) : null,
      ...(messageId
        ? {
            messages: {
              create: { messageId, linkType: linkType || "MANUAL" },
            },
          }
        : {}),
    },
    include: { messages: { include: { message: true } } },
  });

  return NextResponse.json(todo, { status: 201 });
}
