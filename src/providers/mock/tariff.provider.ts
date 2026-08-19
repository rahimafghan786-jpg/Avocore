import { TariffProvider, TariffResult } from "@/domain/provider";
import { seededRandom, randFloat } from "./seeded-random";
import { makeSource, makeEvidence } from "./evidence-helpers";

export class MockTariffProvider implements TariffProvider {
  async lookupDuty(htsGuess: string, originCountry: string): Promise<TariffResult> {
    const rand = seededRandom(`tariff-${htsGuess}-${originCountry}`);
    const source = makeSource("tariff", "Mock Tariff/HTS Lookup");
    const dutyRatePercent = randFloat(rand, 0, 12);

    return {
      ...makeEvidence({
        dataType: "tariff",
        claim: `Estimated duty rate for HTS-style code "${htsGuess}" originating from ${originCountry} is approximately ${dutyRatePercent.toFixed(
          1
        )}%. This is not a confirmed classification.`,
        value: dutyRatePercent,
        unit: "%",
        source,
        confidence: 30,
        assumptions: ["Placeholder duty estimate; real HTS classification requires a customs broker."],
      }),
      htsCodeGuess: htsGuess,
      dutyRatePercent,
      requiresBrokerConfirmation: true,
    };
  }
}
