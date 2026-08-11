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
  sourceDomain: "PRODUCTION" | "MARKET" | "LOGISTICS" | "SUPPLY";
  sourceCount: number;
  sourcePath: string;
}

export interface OverviewDashboardMetric {
  code: string;
  name: string;
  unitCode: string;
  value: string | null;
  sourceCount: number;
  dataCutoff?: string;
  coverageStatus?:
    | "AVAILABLE"
    | "NO_APPROVED_SOURCES"
    | "INSUFFICIENT_COVERAGE"
    | "CUTOFF_MISMATCH"
    | "UNRELIABLE_SOURCE_CONTRACT"
    | "MUTUAL_EXCLUSIVITY_VIOLATION";
  calculationVersion?: string;
  auditSources?: readonly OverviewRegionSurplusAuditSource[];
}

export interface OverviewRegionSurplusAuditSource {
  sourceDomain: "PRODUCTION" | "MARKET";
  sourceRecordId: string;
  sourceVersion: number;
  subjectKey: string | null;
  inventoryHolderKey?: string;
  cargoOwnerKey: string | null;
  ownershipType: "PRODUCTION_SURPLUS" | "OWNED" | "CUSTODIAL" | null;
  regionCode: string | null;
  dataCutoff: string | null;
  valueTonnes: number;
  approvedAt: string;
  adopted: boolean;
  adoptionReason: string;
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

export interface OverviewDashboard {
  scope: {
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
}
