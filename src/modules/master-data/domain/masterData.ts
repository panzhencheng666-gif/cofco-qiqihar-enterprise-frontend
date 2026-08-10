export interface MasterDataOption {
  id: string;
  name: string;
}

export type RegionLevel = "PREFECTURE" | "COUNTY" | "TOWNSHIP" | "VILLAGE";

export interface RegionOption extends MasterDataOption {
  level: RegionLevel;
}

export interface RegionHierarchyNode {
  id: string;
  label: string;
  level: RegionLevel;
}

export interface BusinessPeriodOption extends MasterDataOption {
  startsOn: string;
  endsOn: string;
  marketingYearCode: string;
  marketingYearName: string;
}

export interface SupplySurveyPeriodOption extends MasterDataOption {
  surveyYear: number;
  surveyQuarter: "Q1" | "Q2" | "Q3" | "Q4" | null;
  precision: "YEAR" | "QUARTER";
  marketingYearCode: string;
  marketingYearName: string;
}
