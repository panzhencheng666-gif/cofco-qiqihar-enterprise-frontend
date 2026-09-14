export type OverviewDataMode = "SAMPLE_POINTS" | "REGIONAL_DATA" | "SUPPLY_BALANCE";

export interface RegionalCropSummary {
  regionCode: string;
  regionName: string;
  administrativeLevel: string;
  year: number;
  productCode: string;
  plantedAreaMu: string | null;
  yieldPerMuKg: string | null;
  totalOutputKg: string | null;
  areaChangeWanMu: string | null;
  areaChangeRatePercent: string | null;
  currentDataAvailable: boolean;
  comparisonAvailable: boolean;
  areaChangeRateAvailable: boolean;
  comparisonMessage: string | null;
}

export interface RegionalAgricultureProfile {
  regionCode: string;
  regionName: string;
  administrativeLevel: string;
  year: number;
  automatic: boolean;
  generatedAt: string;
  sourceSummary: string;
  calculationMethod: string;
  crops: readonly {
    productCode: "CORN" | "SOYBEAN" | "RICE";
    productName: string;
    dataKind: "OBSERVED" | "MODEL_ESTIMATE";
    plantedAreaMu: string;
    yieldPerMuKg: string;
    totalOutputKg: string;
    structurePercent: string;
    basis: string;
    forecasts: readonly {
      year: number;
      plantedAreaMu: string;
      yieldPerMuKg: string;
      totalOutputKg: string;
    }[];
  }[];
}

export interface SupplyBalanceSummary {
  regionCode: string;
  regionName: string;
  administrativeLevel: string;
  surveyYear: number;
  productCode: string;
  regionalProductionAvailable: boolean;
  version: number;
  updatedAt: string | null;
  rows: readonly {
    code: string;
    label: string;
    kind: "AUTO" | "MANUAL" | "DERIVED" | "RATIO";
    unit: string;
    requirement: string;
    value: string | null;
    display: string | null;
    note: string | null;
  }[];
}
