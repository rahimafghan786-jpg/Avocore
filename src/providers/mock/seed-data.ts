import { CandidateProduct } from "@/domain/opportunity";

// A small, hand-curated demo catalog. Numbers generated from these by the mock providers
// are plausible-in-shape but fabricated, and are always labeled MOCK in the UI. The
// `mockProfile` field exists only so the mock providers can produce internally-consistent,
// reproducible demo evidence (e.g. a "saturation trap" candidate consistently looks
// saturated across the DemandAgent, CompetitionAgent, and ReviewIntelligenceAgent) — it is
// never read by any agent or engine, which only ever see provider output.

export const CANDIDATE_CATALOG: CandidateProduct[] = [
  {
    id: "cand-cutting-board",
    name: "Collapsible Silicone Travel Cutting Board",
    category: "Kitchen",
    problemSolved: "Rigid cutting boards don't fit in small kitchens, RVs, or carry-on luggage.",
    targetCustomer: "Small-kitchen renters, RV/van-life owners, frequent travelers who cook",
    supplierCountryHint: "China",
    basePriceHint: 18.99,
    unitWeightKgHint: 0.25,
    mockProfile: "solid_beginner",
  },
  {
    id: "cand-cable-clips",
    name: "Magnetic Cable Organizer Clips (6-Pack)",
    category: "Home Office",
    problemSolved: "Charging cables slide off desks and tangle.",
    targetCustomer: "Remote workers, students",
    supplierCountryHint: "China",
    basePriceHint: 9.99,
    unitWeightKgHint: 0.08,
    mockProfile: "trap_saturation",
  },
  {
    id: "cand-pet-grinder",
    name: "LED Rechargeable Pet Nail Grinder",
    category: "Pet Electronics",
    problemSolved: "Manual clippers risk cutting the quick; owners avoid trimming nails.",
    targetCustomer: "Dog and cat owners",
    supplierCountryHint: "China",
    basePriceHint: 24.99,
    unitWeightKgHint: 0.3,
    mockProfile: "trap_regulatory",
  },
  {
    id: "cand-cooler-backpack",
    name: "Insulated Foldable Cooler Backpack",
    category: "Outdoor",
    problemSolved: "Rigid coolers are bulky to carry to beaches, hikes, and tailgates.",
    targetCustomer: "Campers, beachgoers, tailgaters",
    supplierCountryHint: "Vietnam",
    basePriceHint: 34.99,
    unitWeightKgHint: 0.9,
    mockProfile: "trap_ad_dependency",
  },
  {
    id: "cand-drawer-trays",
    name: "Bamboo Drawer Organizer Trays (Set of 4, Adjustable)",
    category: "Home Organization",
    problemSolved: "Standard drawer organizers don't adjust to odd drawer sizes.",
    targetCustomer: "Renters and homeowners organizing kitchens/bathrooms",
    supplierCountryHint: "Vietnam",
    basePriceHint: 27.99,
    unitWeightKgHint: 0.7,
    mockProfile: "underserved_niche",
  },
  {
    id: "cand-baby-placemat",
    name: "Silicone Baby Feeding Placemat with Suction Base",
    category: "Baby Products",
    problemSolved: "Plates and bowls slide off high-chair trays during self-feeding.",
    targetCustomer: "Parents of infants/toddlers starting solid foods",
    supplierCountryHint: "China",
    basePriceHint: 15.99,
    unitWeightKgHint: 0.2,
    mockProfile: "trap_regulatory",
  },
  {
    id: "cand-laptop-stand",
    name: "Adjustable Aluminum Laptop Stand",
    category: "Home Office",
    problemSolved: "Laptops at desk height cause neck strain.",
    targetCustomer: "Remote and hybrid workers",
    supplierCountryHint: "China",
    basePriceHint: 29.99,
    unitWeightKgHint: 1.1,
    mockProfile: "trap_saturation",
  },
  {
    id: "cand-produce-bags",
    name: "Reusable Organic Cotton Produce Mesh Bags (Set of 9)",
    category: "Kitchen",
    problemSolved: "Single-use produce bags create plastic waste; store-bought reusable sets are flimsy.",
    targetCustomer: "Zero-waste-conscious grocery shoppers",
    supplierCountryHint: "India",
    basePriceHint: 16.99,
    unitWeightKgHint: 0.15,
    mockProfile: "underserved_niche",
  },
  {
    // Deliberate landed-cost trap: high demand, LOW advertising dependency, healthy
    // (not saturated) competition — but bad unit economics from supplier cost + freight
    // weight alone. Proves bad landed economics can independently override high demand
    // WITHOUT an advertising problem, distinct from the demand_vs_economics trap above.
    id: "cand-insulated-bottle-set",
    name: "Stainless Steel Insulated Water Bottle Set (3-Pack)",
    category: "Outdoor",
    problemSolved: "A single bottle doesn't cover a family's hydration needs across a full day of activities.",
    targetCustomer: "Active families, outdoor enthusiasts",
    supplierCountryHint: "China",
    basePriceHint: 39.99,
    unitWeightKgHint: 3.2, // deliberately heavy — drives freight cost up
    mockProfile: "trap_landed_cost",
  },
];

export function getCandidateById(id: string): CandidateProduct | undefined {
  return CANDIDATE_CATALOG.find((c) => c.id === id);
}
