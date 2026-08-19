import { FinancialInputs, FinancialOutputs } from "@/domain/financial";

// Every formula here is a plain, auditable calculation over the FinancialInputs. No number
// is invented — this is the "transparent calculations" requirement from the spec.
export function computeFinancials(
  inputs: FinancialInputs,
  availableCapital: number
): FinancialOutputs {
  const {
    unitCost,
    packagingCostPerUnit,
    freightCostPerUnit,
    dutyRatePercent,
    marketplaceFeePercent,
    fulfillmentCostPerUnit,
    paymentProcessingPercent,
    estimatedAdCostPerUnit,
    returnsRatePercent,
    sellingPrice,
    testQuantity,
  } = inputs;

  const dutyPerUnit = unitCost * (dutyRatePercent / 100);
  const landedCostPerUnit = unitCost + packagingCostPerUnit + freightCostPerUnit + dutyPerUnit;

  const marketplaceFeePerUnit = sellingPrice * (marketplaceFeePercent / 100);
  const paymentProcessingPerUnit = sellingPrice * (paymentProcessingPercent / 100);
  const returnsCostPerUnit = landedCostPerUnit * (returnsRatePercent / 100);

  const totalCostPerUnit =
    landedCostPerUnit +
    fulfillmentCostPerUnit +
    marketplaceFeePerUnit +
    paymentProcessingPerUnit +
    estimatedAdCostPerUnit +
    returnsCostPerUnit;

  const contributionMarginPerUnit = sellingPrice - totalCostPerUnit;
  const contributionMarginPercent = sellingPrice > 0 ? (contributionMarginPerUnit / sellingPrice) * 100 : 0;
  const grossMarginPercent =
    sellingPrice > 0 ? ((sellingPrice - landedCostPerUnit) / sellingPrice) * 100 : 0;

  // The "fixed cost" a beginner actually faces up front is the inventory purchase itself
  // (paid before any unit sells). Break-even here means: how many units at this margin does
  // it take to recover that upfront cash outlay?
  const cashRequiredForTest = landedCostPerUnit * testQuantity;
  const breakEvenUnits =
    contributionMarginPerUnit > 0 ? Math.ceil(cashRequiredForTest / contributionMarginPerUnit) : Infinity;
  const breakEvenRevenue = isFinite(breakEvenUnits) ? breakEvenUnits * sellingPrice : Infinity;

  const testProfit = contributionMarginPerUnit * testQuantity;
  const roiPercentAtTestQuantity =
    cashRequiredForTest > 0 ? (testProfit / cashRequiredForTest) * 100 : 0;

  const maxAffordableInventoryUnits =
    landedCostPerUnit > 0 ? Math.floor(availableCapital / landedCostPerUnit) : 0;

  return {
    landedCostPerUnit: round2(landedCostPerUnit),
    totalCostPerUnit: round2(totalCostPerUnit),
    contributionMarginPerUnit: round2(contributionMarginPerUnit),
    contributionMarginPercent: round2(contributionMarginPercent),
    grossMarginPercent: round2(grossMarginPercent),
    breakEvenUnits,
    breakEvenRevenue: round2(breakEvenRevenue),
    cashRequiredForTest: round2(cashRequiredForTest),
    roiPercentAtTestQuantity: round2(roiPercentAtTestQuantity),
    maxAffordableInventoryUnits,
  };
}

function round2(n: number): number {
  if (!isFinite(n)) return n;
  return Math.round(n * 100) / 100;
}
