import { NextRequest, NextResponse } from "next/server";
import { parseResearchRequest } from "@/lib/request-parser";
import { runMasterAgent } from "@/lib/master-agent";

export async function POST(req: NextRequest) {
  let body: { message?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const message = body.message?.trim();
  if (!message) {
    return NextResponse.json({ error: "A `message` field is required." }, { status: 400 });
  }

  const request = parseResearchRequest(message);
  const run = await runMasterAgent(request);

  return NextResponse.json({ run });
}
