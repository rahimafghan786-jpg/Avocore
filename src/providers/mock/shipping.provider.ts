import { ShippingProvider, FreightEstimate } from "@/domain/provider";
import { seededRandom, randFloat, randInt } from "./seeded-random";
import { makeSource, makeEvidence } from "./evidence-helpers";

export class MockShippingProvider implements ShippingProvider {
  async estimateFreight(
    originCountry: string,
    unitWeightKg: number,
    quantity: number
  ): Promise<FreightEstimate> {
    const rand = seededRandom(`shipping-${originCountry}-${unitWeightKg}-${quantity}`);
    const source = makeSource("shipping", "Mock Freight Estimator");
    // Rough per-kg ocean/air blended rate depending on origin, cheaper per-unit at higher volume.
    const perKgRate = randFloat(rand, 3.5, 7.5);
    const volumeDiscount = quantity >= 500 ? 0.75 : quantity >= 200 ? 0.88 : 1;
    const costPerUnit = Math.round(unitWeightKg * perKgRate * volumeDiscount * 100) / 100;
    const transitDays = randInt(rand, 20, 40);

    return {
      ...makeEvidence({
        dataType: "shipping",
        claim: `Estimated freight cost from ${originCountry} at ${unitWeightKg}kg/unit and ${quantity} units is about $${costPerUnit.toFixed(
          2
        )}/unit, ~${transitDays} days transit.`,
        value: costPerUnit,
        unit: "USD/unit",
        source,
        confidence: 45,
        assumptions: ["Blended ocean/air estimate; real freight varies by carrier, season, and Incoterms."],
      }),
      costPerUnit,
      transitDays,
    };
  }
}
