import { ProviderRegistry } from "@/domain/provider";
import { AgentInput, AgentResult } from "@/domain/agent";
import { computeFinancials } from "@/lib/financial-engine";
import { getTradeContext } from "@/providers/real/census-trade.provider";
import { Evidence } from "@/domain/evidence";

const TEST_QUANTITY_DEFAULT = 100;
const RETURNS_RATE_DEFAULT_PERCENT = 5;

export function recentPublishedMonth(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 3);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export function toHs6(htsCodeGuess: string): string | null {
  const digitsOnly = htsCodeGuess.replace(/\D/g, "");
  return digitsOnly.length >= 6 ? digitsOnly.slice(0, 6) : null;
}

export async function runFinancialAgent(
  providers: ProviderRegistry,
  input: AgentInput
): Promise<AgentResult> {
  const start = Date.now();
  const { candidate, request } = input;

  const [suppliers, fees, adCost, freight, tariff] = await Promise.all([
    providers.supplier.findSuppliers(candidate.id, candidate.supplierCountryHint),
    providers.marketplace.estimateFees(candidate.basePriceHint, candidate.category),
    providers.marketplace.estimateAdCost(candidate.id),
    providers.shipping.estimateFreight(
      candidate.supplierCountryHint,
      candidate.unitWeightKgHint,
      TEST_QUANTITY_DEFAULT
    ),
    providers.tariff.lookupDuty(candidate.name, candidate.supplierCountryHint),
  ]);

  const bestSupplier = suppliers.reduce((best, s) => (s.unitPriceAtMoq < (best?.unitPriceAtMoq ?? Infinity) ? s : best), suppliers[0]);
  const unitCost = bestSupplier?.unitPriceAtMoq ?? candidate.basePriceHint * 0.3;
  const sellingPrice = candidate.basePriceHint;
  const estimatedAdCostPerUnit = sellingPrice * (adCost.estimatedAcosPercent / 100);

  const tradeEvidence: Evidence[] = [];
  const hs6 = toHs6(tariff.htsCodeGuess);
  if (hs6 && process.env.CENSUS_API_KEY) {
    try {
      const trade = await getTradeContext(hs6, recentPublishedMonth());
      tradeEvidence.push(trade);
    } catch (err) {
      console.error("Census trade context lookup failed (non-fatal, supplementary evidence only):", err);
    }
  }

  const outputs = computeFinancials(
    {
      unitCost,
      packagingCostPerUnit: 0.6,
      freightCostPerUnit: freight.costPerUnit,
      dutyRatePercent: tariff.dutyRatePercent,
      marketplaceFeePercent: fees.referralFeePercent,
      fulfillmentCostPerUnit: fees.fulfillmentFeeFlat,
      paymentProcessingPercent: 2.9,
      estimatedAdCostPerUnit,
      returnsRatePercent: RETURNS_RATE_DEFAULT_PERCENT,
      sellingPrice,
      testQuantity: TEST_QUANTITY_DEFAULT,
    },
    request.capital
  );

  const marginPotentialScore =
    outputs.contributionMarginPercent >= 30
      ? 85
      : outputs.contributionMarginPercent >= 18
      ? 60
      : outputs.contributionMarginPercent >= 8
      ? 35
      : 10;

  return {
    agent: "FinancialAgent",
    candidateId: candidate.id,
    summary: `At $${sellingPrice.toFixed(2)} selling price, estimated landed cost is $${outputs.landedCostPerUnit.toFixed(2)}/unit and contribution margin is ${outputs.contributionMarginPercent.toFixed(1)}%. A ${TEST_QUANTITY_DEFAULT}-unit test requires about $${outputs.cashRequiredForTest.toFixed(2)} in cash.`,
    findings: {
      ...outputs,
      unitCost,
      sellingPrice,
      marginPotentialScore,
    },
    evidence: [...suppliers, fees, adCost, freight, tariff, ...tradeEvidence],
    confidence: 55,
    durationMs: Date.now() - start,
  };
}
Activate Census trade data
