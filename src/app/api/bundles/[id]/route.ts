import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { BundleStatus } from "@/types";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const bundle = await prisma.bundle.findUnique({
    where: { id },
    include: {
      members: { include: { todo: { include: { messages: { include: { message: true } } } } } },
    },
  });
  if (!bundle) {
    return NextResponse.json({ error: "Bundle not found" }, { status: 404 });
  }
  return NextResponse.json(bundle);
}

// Approve or reject a bundle
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { status } = await request.json();

  if (!Object.values(BundleStatus).includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const bundle = await prisma.bundle.update({
    where: { id },
    data: { status },
    include: {
      members: { include: { todo: true } },
    },
  });

  return NextResponse.json(bundle);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await prisma.bundle.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
