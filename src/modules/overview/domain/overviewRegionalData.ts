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
  coverageDescription?: string | undefined;
  sourceSummary: string;
  calculationMethod: string;
  refreshStatus?:
    | {
        cadence: string;
        status: string;
        lastAttemptAt: string | null;
        lastSuccessAt: string | null;
        nextRefreshAt: string | null;
      }
    | undefined;
  weather?:
    | {
        meanTemperatureC: string | null;
        precipitationMm: string | null;
        soilMoisturePercent: string | null;
        risk: string;
        assessment: string;
        observedAt: string;
        sourceId: string;
      }
    | null
    | undefined;
  policies?:
    | readonly {
        title: string;
        publishedOn: string | null;
        sourceName: string;
        sourceUrl: string;
        affectedCrops: string;
        impact: string;
      }[]
    | undefined;
  sources?:
    | readonly {
        id: string;
        type: "AGRICULTURE" | "WEATHER" | "POLICY";
        name: string;
        url: string;
        publishedOn: string | null;
        fetchedAt: string | null;
        status: string;
        evidence: string;
      }[]
    | undefined;
  crops: readonly {
    productCode: "CORN" | "SOYBEAN" | "RICE";
    productName: string;
    dataKind: "OBSERVED" | "MODEL_ESTIMATE";
    plantedAreaMu: string;
    yieldPerMuKg: string;
    totalOutputKg: string;
    structurePercent: string;
    basis: string;
    formula?: string | undefined;
    confidencePercent?: string | undefined;
    uncertaintyLowKg?: string | undefined;
    uncertaintyHighKg?: string | undefined;
    forecasts: readonly {
      year: number;
      plantedAreaMu: string;
      yieldPerMuKg: string;
      totalOutputKg: string;
      formula?: string | undefined;
      confidencePercent?: string | undefined;
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
