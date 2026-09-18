export type StorageFacilityRelation = "OWNED" | "LEASED" | "HISTORICAL_LEASED";

export interface OperationalFacilityCatalogue {
  regionCode: string | null;
  productCode: string | null;
  asOf: string;
  storageCategories: readonly {
    code: StorageFacilityRelation;
    label: string;
    count: number;
  }[];
  storageFacilities: readonly StorageFacility[];
  railwayFacilities: readonly RailwayFacility[];
  railwayLines: readonly RailwayLine[];
  sources: readonly OperationalFacilitySource[];
}

export interface StorageFacility {
  code: string;
  name: string;
  workUnitCode: string;
  relationType: StorageFacilityRelation;
  relationLabel: string;
  regionCode: string;
  regionName: string;
  address: string;
  longitude: number | null;
  latitude: number | null;
  coordinatePrecision: "EXACT" | "STREET" | "TOWN" | "UNVERIFIED";
  coordinatePrecisionLabel: string;
  operationalStatus: string;
  capacityTonnes: number | null;
  capacityAsOf: string | null;
  prices: readonly StorageFacilityPrice[];
  evidence: readonly StorageFacilityEvidence[];
}

export interface StorageFacilityPrice {
  productCode: string;
  productName: string | null;
  qualityRequirement: string;
  value: number;
  unit: string;
  effectiveOn: string;
  expiresOn: string | null;
  sourceName: string;
  sourceUrl: string;
  sourceClassification: string;
  current: boolean;
}

export interface StorageFacilityEvidence {
  kind: string;
  title: string;
  sourceName: string;
  sourceUrl: string;
  sourceClassification: string;
  sourceAsOf: string | null;
  note: string;
}

export interface RailwayFacility {
  sourceId: string;
  name: string;
  kind: string;
  longitude: number;
  latitude: number;
  operator: string;
  reference: string;
  status: string;
  service: string;
  locationRelation: "WITHIN" | "NEARBY";
  distanceKm: number;
  nearbyLines: string;
  sourceUrl: string;
}

export interface RailwayLine {
  name: string;
  mappedTrackKm: number;
  usage: string;
  electrification: string;
  gauge: string;
  operator: string;
  sourceUrl: string;
}

export interface OperationalFacilitySource {
  code: "STORAGE" | "RAILWAY";
  label: string;
  status: "READY" | "STALE" | "UNAVAILABLE";
  sourceAsOf: string | null;
  sourceUrl: string | null;
  notice: string;
}
