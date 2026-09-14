export interface CurrentEstimate {
  value: string;
  model: string;
  selection: string;
  formula: string;
  inputs: readonly {
    year: number;
    value: string;
    unit: string;
    source: string;
    url: string;
  }[];
  candidates: readonly {
    model: string;
    meanAbsoluteError: string;
    validationYears: number;
  }[];
}
export interface CurrentComparison {
  label: string;
  category: string;
  unit: string;
  publicYear: number;
  publicValue: string;
  sourceName: string;
  sourceUrl: string;
  estimateYear: number;
  current: CurrentEstimate | null;
  difference: string | null;
  differencePercent: string | null;
  historicalCheck: CurrentEstimate | null;
  historicalDifference: string | null;
  conclusion: string;
}
export interface RegionalEstimateBatch {
  rootRegionCode: string;
  year: number;
  calculatedAt: string | null;
  attemptedAt: string;
  sourceCheckedAt: string | null;
  calculationStatus: string;
  sourceStatus: string;
  modelVersion: string;
  comparisons: readonly CurrentComparison[];
}
