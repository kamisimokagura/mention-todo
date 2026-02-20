import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const bundles = await prisma.bundle.findMany({
    include: {
      members: { include: { todo: { include: { messages: { include: { message: true } } } } } },
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ bundles });
}

// Trigger bundle analysis
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { action } = body;

  if (action === "analyze") {
    // Import dynamically to keep the route light
    const { runBundleAnalysis } = await import("@/lib/bundling");
    const result = await runBundleAnalysis();
    return NextResponse.json(result);
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
