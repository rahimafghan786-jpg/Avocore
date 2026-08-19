import { SupplierProvider, SupplierResult } from "@/domain/provider";
import { getCandidateById } from "./seed-data";
import { seededRandom, randFloat, randInt, pick } from "./seeded-random";
import { makeSource, makeEvidence } from "./evidence-helpers";

export class MockSupplierProvider implements SupplierProvider {
  async findSuppliers(productCategoryOrCandidateId: string, country?: string): Promise<SupplierResult[]> {
    const candidate = getCandidateById(productCategoryOrCandidateId);
    const rand = seededRandom(`supplier-${productCategoryOrCandidateId}-${country ?? "any"}`);
    const source = makeSource("supplier", "Mock Supplier Directory");
    const originCountry = country ?? candidate?.supplierCountryHint ?? "China";
    // Landed-cost trap: unit cost itself is a much higher fraction of sell price than
    // normal (42-55% vs the usual 16-24%), independent of advertising or competition —
    // this is what creates bad economics that ad efficiency alone cannot fix.
    const costMultiplierRange: [number, number] =
      candidate?.mockProfile === "trap_landed_cost" ? [0.42, 0.55] : [0.16, 0.24];
    const baseCost = candidate
      ? candidate.basePriceHint * randFloat(rand, costMultiplierRange[0], costMultiplierRange[1])
      : randFloat(rand, 3, 9);

    const verificationLevels: SupplierResult["verificationStatus"][] = [
      "FOUND",
      "IDENTITY_CHECKED",
      "CAPABILITY_CHECKED",
    ];

    return Array.from({ length: 3 }).map((_, i) => {
      const moq = pick(rand, [100, 200, 300, 500]);
      const unitPriceAtMoq = randFloat(rand, baseCost * 1.05, baseCost * 1.2);
      const unitPriceAt500 = randFloat(rand, baseCost * 0.85, baseCost * 1.05);
      const leadTimeDays = randInt(rand, 18, 45);
      const verificationStatus = pick(rand, verificationLevels);

      return {
        ...makeEvidence({
          dataType: "supplier",
          claim: `A candidate supplier in ${originCountry} quotes $${unitPriceAtMoq.toFixed(
            2
          )}/unit at MOQ ${moq}, dropping to about $${unitPriceAt500.toFixed(
            2
          )}/unit at 500 units. Verification status: ${verificationStatus} — not yet sample-verified.`,
          value: unitPriceAtMoq,
          unit: "USD/unit",
          source,
          confidence: verificationStatus === "FOUND" ? 35 : 50,
          assumptions: [
            "Directory-style mock listing. Real sourcing requires RFQ, sample verification, and document checks before this can be marked VERIFIED.",
          ],
        }),
        supplierName: `${originCountry} Supplier Candidate ${i + 1}`,
        country: originCountry,
        moq,
        unitPriceAtMoq,
        unitPriceAt500,
        leadTimeDays,
        verificationStatus,
      };
    });
  }
}
