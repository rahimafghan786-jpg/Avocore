import { Evidence, DataType, Source } from "@/domain/evidence";
import { randomUUID } from "crypto";

let sourceCounter = 0;

export function makeSource(providerKey: string, name: string): Source {
  sourceCounter += 1;
  return {
    id: `src-${providerKey}-${sourceCounter}`,
    name,
    providerKey,
  };
}

export function makeEvidence(params: {
  dataType: DataType;
  claim: string;
  value?: number | string | boolean;
  unit?: string;
  source: Source;
  confidence: number;
  assumptions?: string[];
}): Evidence {
  return {
    id: randomUUID(),
    dataType: params.dataType,
    classification: "MOCK",
    claim: params.claim,
    value: params.value,
    unit: params.unit,
    source: params.source,
    collectedAt: new Date().toISOString(),
    freshnessNote: "Generated from Avocore's seeded demo catalog, not a live data source.",
    confidence: params.confidence,
    assumptions: params.assumptions,
  };
}
