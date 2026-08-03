export interface OverviewOption {
  code: string;
  label: string;
}

export interface OverviewPeriodOption extends OverviewOption {
  startsOn: string;
  endsOn: string;
}

export interface OverviewOptions {
  products: readonly OverviewOption[];
  periods: readonly OverviewPeriodOption[];
}

export interface OverviewRegion {
  code: string;
  name: string;
  parentCode?: string;
  level: "PREFECTURE" | "COUNTY" | "TOWNSHIP" | "VILLAGE";
  approvedRecordCount: number;
  boundaryGeoJson?: string;
}

export interface OverviewIndicator {
  code: string;
  name: string;
  unitCode: string;
  value: string;
  sourceDomain: "PRODUCTION" | "MARKET" | "LOGISTICS" | "SUPPLY";
  sourceCount: number;
  sourcePath: string;
}
