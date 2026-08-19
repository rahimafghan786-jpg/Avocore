import { NextRequest, NextResponse } from "next/server";
import { getRunFromCache } from "@/lib/master-agent";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const run = await getRunFromCache(id);
  if (!run) {
    return NextResponse.json({ error: "Run not found." }, { status: 404 });
  }
  return NextResponse.json({ run });
}
