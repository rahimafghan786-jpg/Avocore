import { Opportunity, ResearchRequest } from "@/domain/opportunity";

// Claude is only ever asked to narrate an already-computed, already-evidenced result in
// plain English. It never invents evidence, scores, or financial numbers — those are always
// passed in as already-computed structured data, and the prompt explicitly forbids adding
// any new numeric claims. If ANTHROPIC_API_KEY isn't set, the app falls back to a
// deterministic template (see buildFallbackNarrative below) so the pipeline is fully
// testable without any API key.
export async function narrateResults(
  request: ResearchRequest,
  opportunities: Opportunity[]
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return buildFallbackNarrative(request, opportunities);
  }

  try {
    const structuredSummary = opportunities.map((o) => ({
      name: o.candidate.name,
      decision: o.decision,
      score: o.score.total,
      decisionNarrative: o.decisionNarrative,
      contributionMarginPercent: o.financials.contributionMarginPercent,
      capitalRequired: o.capitalRequired,
    }));

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 500,
        system:
          "You narrate already-computed e-commerce opportunity research results for a beginner founder. " +
          "You MUST NOT invent any number, statistic, or fact that is not present in the structured data " +
          "you are given. Do not add new claims about demand, competition, or pricing. Just explain, in " +
          "plain conversational English, what the data already says and why. Keep it under 180 words.",
        messages: [
          {
            role: "user",
            content: `User request: "${request.rawMessage}"\n\nStructured results (already computed, do not alter the numbers):\n${JSON.stringify(
              structuredSummary,
              null,
              2
            )}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      return buildFallbackNarrative(request, opportunities);
    }

    const data = await response.json();
    const text = (data.content ?? [])
      .filter((block: { type: string }) => block.type === "text")
      .map((block: { text: string }) => block.text)
      .join("\n");

    return text || buildFallbackNarrative(request, opportunities);
  } catch {
    return buildFallbackNarrative(request, opportunities);
  }
}

function buildFallbackNarrative(request: ResearchRequest, opportunities: Opportunity[]): string {
  const goCount = opportunities.filter((o) => o.decision === "GO" || o.decision === "TEST").length;
  const rejectCount = opportunities.filter((o) => o.decision === "REJECT").length;
  return (
    `Based on $${request.capital.toLocaleString()} in available capital and ${
      opportunities.length
    } candidates investigated: ${goCount} look worth testing, ${rejectCount} are recommended against. ` +
    `Every recommendation below shows the evidence and reasoning behind it — none of these are guarantees, ` +
    `and all figures are from Avocore's mock demo dataset until real data providers are connected.`
  );
}
