import { NextRequest, NextResponse } from "next/server";
import { getOpportunityFromCache } from "@/lib/master-agent";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const opportunity = await getOpportunityFromCache(id);
  if (!opportunity) {
    return NextResponse.json({ error: "Opportunity not found. Run a new research request first." }, { status: 404 });
  }
  return NextResponse.json({ opportunity });
}
