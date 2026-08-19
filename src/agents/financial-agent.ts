import { ProviderRegistry } from "@/domain/provider";
import { AgentInput, AgentResult } from "@/domain/agent";
import { computeFinancials } from "@/lib/financial-engine";

const TEST_QUANTITY_DEFAULT = 100;
const RETURNS_RATE_DEFAULT_PERCENT = 5;

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
    summary: `At $${sellingPrice.toFixed(2)} selling price, estimated landed cost is $${outputs.landedCostPerUnit.toFixed(
      2
    )}/unit and contribution margin is ${outputs.contributionMarginPercent.toFixed(1)}%. A ${TEST_QUANTITY_DEFAULT}-unit test requires about $${outputs.cashRequiredForTest.toFixed(
      2
    )} in cash.`,
    findings: {
      ...outputs,
      unitCost,
      sellingPrice,
      marginPotentialScore,
    },
    evidence: [...suppliers, fees, adCost, freight, tariff],
    confidence: 55,
    durationMs: Date.now() - start,
  };
}
