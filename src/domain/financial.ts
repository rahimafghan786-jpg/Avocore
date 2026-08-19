export interface FinancialInputs {
  unitCost: number; // supplier unit cost
  packagingCostPerUnit: number;
  freightCostPerUnit: number;
  dutyRatePercent: number; // e.g. 6.5 for 6.5%
  marketplaceFeePercent: number; // referral/commission
  fulfillmentCostPerUnit: number;
  paymentProcessingPercent: number;
  estimatedAdCostPerUnit: number;
  returnsRatePercent: number;
  sellingPrice: number;
  testQuantity: number;
}

export interface FinancialOutputs {
  landedCostPerUnit: number;
  totalCostPerUnit: number; // landed + fulfillment + fees + ad + processing, allocated for returns
  contributionMarginPerUnit: number;
  contributionMarginPercent: number;
  grossMarginPercent: number;
  breakEvenUnits: number;
  breakEvenRevenue: number;
  cashRequiredForTest: number;
  roiPercentAtTestQuantity: number;
  maxAffordableInventoryUnits: number; // given user's available capital
}
