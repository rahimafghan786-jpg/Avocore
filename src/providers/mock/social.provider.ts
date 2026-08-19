import { SocialProvider, ComplaintSignal } from "@/domain/provider";
import { getCandidateById } from "./seed-data";
import { seededRandom, pick } from "./seeded-random";
import { makeSource, makeEvidence } from "./evidence-helpers";

const TEMPLATES = [
  (p: string) => `Why doesn't anyone make a ${p} that actually fits small spaces?`,
  (p: string) => `Wish the ${p} I bought came with clearer instructions.`,
  (p: string) => `Can't find a ${p} under $30 that isn't flimsy.`,
  (p: string) => `The ${p} I have broke within a month, disappointing.`,
  (p: string) => `Too expensive for what it is — a ${p} shouldn't cost this much.`,
];

export class MockSocialProvider implements SocialProvider {
  async getComplaintSignals(topic: string): Promise<ComplaintSignal[]> {
    const candidate = getCandidateById(topic);
    const rand = seededRandom(`social-${topic}`);
    const source = makeSource("social", "Mock Social Signal Provider");
    const name = candidate?.name ?? topic;

    return Array.from({ length: 4 }).map(() => {
      const text = pick(rand, TEMPLATES)(name);
      const frequency = pick(rand, ["rare", "occasional", "frequent"] as const);
      return {
        ...makeEvidence({
          dataType: "complaint_signal",
          claim: `A recurring public comment pattern about "${name}": "${text}" (${frequency}).`,
          value: text,
          source,
          confidence: 40,
          assumptions: [
            "Simulated social-listening signal; a live integration would pull from permitted, ToS-compliant sources only.",
          ],
        }),
        topic: name,
        complaintText: text,
        frequency,
      };
    });
  }
}
