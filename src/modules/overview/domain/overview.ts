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
  years: readonly number[];
}

export interface OverviewMapScope {
  scopeCode: string;
  name: string;
  boundaryGeoJson: string;
  sourceName: string;
  sourceRevision: string;
  sourceLicense: string;
  componentGeometryFingerprint: string;
  refreshedAt: string;
}

export interface OverviewRegion {
  code: string;
  name: string;
  parentCode?: string;
  level: "PREFECTURE" | "COUNTY" | "TOWNSHIP" | "VILLAGE";
  approvedRecordCount: number | null;
  boundaryGeoJson?: string;
  locationGeoJson?: string;
  locationReviewStatus?: string;
  /** Real map-only context outside the FORMAL_BUSINESS monitoring scope. */
  mapContextOnly?: boolean;
}

export interface OverviewRegionHierarchy {
  counties: readonly OverviewRegion[];
  townships: readonly OverviewRegion[];
  villages: readonly OverviewRegion[];
  loading: boolean;
  error?: string;
}

export interface OverviewIndicator {
  code: string;
  name: string;
  unitCode: string;
  value: string | null;
  sourceDomain: "PRODUCTION" | "MARKET" | "LOGISTICS";
  sourceCount: number;
  sourcePath: string;
  formula: string;
  sourceRelation: string;
  dataCutoff: string | null;
  coverageScope: string;
  coverageStatus: "AVAILABLE" | "PARTIAL" | "NO_APPROVED_SOURCES";
  calculationVersion: string;
}

export interface OverviewDashboardMetric {
  code: string;
  name: string;
  unitCode: string;
  value: string | null;
  sourceCount: number;
  dataCutoff: string | null;
  coverageStatus:
    | "AVAILABLE"
    | "PARTIAL"
    | "NO_APPROVED_SOURCES"
    | "INSUFFICIENT_COVERAGE"
    | "CUTOFF_MISMATCH"
    | "UNRELIABLE_SOURCE_CONTRACT"
    | "MUTUAL_EXCLUSIVITY_VIOLATION";
  calculationVersion: string;
  formula: string;
  sourcePath: string;
  sourceRelation: string;
  coverageScope: string;
}

export interface OverviewPriceTrendPoint {
  periodLabel: string;
  value: string;
  sourceCount: number;
}

export interface OverviewRegionActivity {
  regionCode: string;
  regionName: string;
  approvedCount: number;
  totalCount: number;
}

export interface OverviewProductShare {
  productCode: string;
  productName: string;
  value: string;
  unitCode: string;
  sourceCount: number;
}

export interface OverviewAlert {
  code: string;
  severity: "INFO" | "WARNING" | "CRITICAL";
  regionName: string;
  message: string;
  occurredOn: string;
}

export interface OverviewYoYComparison {
  regionCode: string;
  regionName: string;
  currentValue: string | null;
  previousValue: string | null;
  unitCode: string;
  currentSourceCount: number;
  previousSourceCount: number;
}

export interface OverviewBusinessTableCell {
  value: string | null;
  sourceCount: number;
}

export interface OverviewBusinessTableColumn {
  code: string;
  label: string;
  unitCode: string | null;
}

export interface OverviewBusinessTableRow {
  regionCode: string;
  regionName: string;
  sourceCount: number;
  latestApprovedAt: string | null;
  completenessStatus: "COMPLETE" | "PARTIAL" | "NO_APPROVED_SOURCES";
  values: Readonly<Record<string, OverviewBusinessTableCell>>;
}

export interface OverviewBusinessTable {
  code: "PRODUCTION" | "MARKET" | "LOGISTICS";
  title: string;
  coverageStatus: "AVAILABLE" | "NO_APPROVED_SOURCES";
  columns: readonly OverviewBusinessTableColumn[];
  rows: readonly OverviewBusinessTableRow[];
}

export interface OverviewDashboard {
  scope: {
    prefectureCount: number;
    countyCount: number;
    townshipCount: number;
    villageCount: number;
    reportingUnitCount: number;
    approvedRecordCount: number;
    latestUpdatedAt?: string;
  };
  metrics: readonly OverviewDashboardMetric[];
  regionPath: readonly OverviewOption[];
  priceTrend: readonly OverviewPriceTrendPoint[];
  productStructure: readonly OverviewProductShare[];
  regionActivity: readonly OverviewRegionActivity[];
  alerts: readonly OverviewAlert[];
  cultivatedAreaYoY: readonly OverviewYoYComparison[];
  outputYoY: readonly OverviewYoYComparison[];
  businessTables: readonly OverviewBusinessTable[];
}

export interface OverviewDashboardSummary {
  scope: {
    prefectureCount: number;
    countyCount: number;
    townshipCount: number;
    villageCount: number;
  };
  metrics: readonly OverviewDashboardMetric[];
}
