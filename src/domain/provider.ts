import { Evidence } from "./evidence";

// Every provider method returns Evidence-shaped results (never a bare number) so that
// agents can attach provenance to every claim they make. `value` carries the actual
// number/string the agent will use; the rest is provenance.

export interface ListingResult extends Evidence {
  listingId: string;
  title: string;
  price: number;
  estimatedMonthlySales?: number;
  rating?: number;
  reviewCount?: number;
  sellerCount?: number;
  dominantBrandShare?: number; // 0-1, share of reviews held by top brand(s)
}

export interface ReviewResult extends Evidence {
  reviewId: string;
  rating: number;
  text: string;
  theme:
    | "durability"
    | "sizing"
    | "packaging"
    | "usability"
    | "shipping_damage"
    | "value_perception"
    | "feature_request"
    | "other";
}

export interface FeeEstimate extends Evidence {
  referralFeePercent: number;
  fulfillmentFeeFlat: number;
}

export interface AdCostEstimate extends Evidence {
  estimatedCpc: number;
  estimatedAcosPercent: number; // advertising cost of sales
  dependencyLevel: "LOW" | "MEDIUM" | "HIGH" | "EXTREME";
}

export interface SearchVolumeResult extends Evidence {
  term: string;
  monthlySearchVolume: number;
  trendDirection: "rising" | "flat" | "declining";
}

export interface TrendResult extends Evidence {
  term: string;
  classification: Evidence["classification"];
  trendType: "emerging" | "established" | "seasonal" | "viral_spike" | "declining" | "noise";
}

export interface ComplaintSignal extends Evidence {
  topic: string;
  complaintText: string;
  frequency: "rare" | "occasional" | "frequent";
}

export interface SupplierResult extends Evidence {
  supplierName: string;
  country: string;
  moq: number;
  unitPriceAtMoq: number;
  unitPriceAt500: number;
  leadTimeDays: number;
  verificationStatus:
    | "FOUND"
    | "IDENTITY_CHECKED"
    | "CAPABILITY_CHECKED"
    | "DOCUMENTS_CHECKED"
    | "PRICE_CONFIRMED"
    | "SAMPLE_REQUIRED"
    | "SAMPLE_VERIFIED";
}

export interface TariffResult extends Evidence {
  htsCodeGuess: string;
  dutyRatePercent: number;
  requiresBrokerConfirmation: boolean;
  // HS/HTS classification confidence (Phase 2A) — how confident the classification
  // step is that htsCodeGuess is actually correct for this product, plus what else
  // it considered. See lib/hs-classifier.ts.
  classificationConfidence?: number; // 0-100
  alternativeHtsCodes?: string[];
  requiresHumanReview?: boolean; // true when classificationConfidence is too low to act on
}

export interface RegulatoryAssessment extends Evidence {
  category: string;
  riskScore: number; // 0-100
  requiredAgencies: string[];
  requiresStopAndVerify: boolean;
  // Phase 2A fix: replaces the earlier ad-hoc matchOutcome with the 4 explicit
  // levels required so the system never conflates a broad category match with
  // evidence about the specific product. See docs/PROVIDERS.md.
  matchType?: "STRONG_PRODUCT_MATCH" | "PRODUCT_TYPE_MATCH" | "CATEGORY_MATCH" | "NO_RELEVANT_MATCH";
  matchReason?: string;
  matchedRecallIds?: string[];
}

export interface FreightEstimate extends Evidence {
  costPerUnit: number;
  transitDays: number;
}

export interface MarketplaceProvider {
  searchListings(query: string, market: "US"): Promise<ListingResult[]>;
  getListingReviews(listingId: string): Promise<ReviewResult[]>;
  estimateFees(listingPrice: number, category: string): Promise<FeeEstimate>;
  estimateAdCost(category: string): Promise<AdCostEstimate>;
}

export interface SearchProvider {
  getSearchVolume(term: string, market: "US"): Promise<SearchVolumeResult>;
}

export interface TrendProvider {
  getTrend(term: string, market: "US"): Promise<TrendResult>;
}

export interface SocialProvider {
  getComplaintSignals(topic: string): Promise<ComplaintSignal[]>;
}

export interface SupplierProvider {
  findSuppliers(productCategory: string, country?: string): Promise<SupplierResult[]>;
}

export interface TariffProvider {
  lookupDuty(htsGuess: string, originCountry: string): Promise<TariffResult>;
}

export interface RegulatoryProvider {
  // productName is optional and additive — existing callers/mocks that only pass
  // category keep working unchanged. Real providers use productName, when given,
  // to distinguish a specific-product match from a broad-category one.
  assessCategory(category: string, productName?: string): Promise<RegulatoryAssessment>;
}

export interface ShippingProvider {
  estimateFreight(
    originCountry: string,
    unitWeightKg: number,
    quantity: number
  ): Promise<FreightEstimate>;
}

export interface ProviderRegistry {
  marketplace: MarketplaceProvider;
  search: SearchProvider;
  trend: TrendProvider;
  social: SocialProvider;
  supplier: SupplierProvider;
  tariff: TariffProvider;
  regulatory: RegulatoryProvider;
  shipping: ShippingProvider;
}

export interface ProviderStatus {
  key: keyof ProviderRegistry;
  label: string;
  connected: boolean; // false = mock data active
  plannedPhase?: string;
}
