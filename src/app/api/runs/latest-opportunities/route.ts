import { NextResponse } from "next/server";
import { getAllCachedOpportunities } from "@/lib/master-agent";

export async function GET() {
  const opportunities = await getAllCachedOpportunities();
  return NextResponse.json({ opportunities });
}
