import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Link a message to a todo
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: todoId } = await params;
  const { messageId, linkType } = await request.json();

  if (!messageId) {
    return NextResponse.json({ error: "messageId is required" }, { status: 400 });
  }

  const link = await prisma.messageToTodo.upsert({
    where: { messageId_todoId: { messageId, todoId } },
    update: { linkType: linkType || "MANUAL" },
    create: { messageId, todoId, linkType: linkType || "MANUAL" },
    include: { message: true, todo: true },
  });

  return NextResponse.json(link, { status: 201 });
}

// Unlink a message from a todo
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: todoId } = await params;
  const { messageId } = await request.json();

  await prisma.messageToTodo.delete({
    where: { messageId_todoId: { messageId, todoId } },
  });

  return NextResponse.json({ success: true });
}
