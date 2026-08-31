export type OverviewSamplePointCategoryCode = "PRODUCTION" | "MARKET" | "LOGISTICS";

export interface OverviewSamplePointAggregate {
  regionCode: string;
  regionName: string;
  regionLevel: "PREFECTURE" | "COUNTY" | "TOWNSHIP" | "VILLAGE";
  /** Required by the live HTTP contract; optional only for legacy in-memory fixtures. */
  scopeKind?: "CHILD_REGION" | "PARENT_DIRECT";
  /** Real administrative region used to place the aggregate without fabricating coordinates. */
  anchorRegionCode?: string;
  samplePointCount: number;
  productionCount: number;
  marketCount: number;
  /** Required by the live HTTP contract; optional only for legacy in-memory fixtures. */
  logisticsCount?: number;
  validCoordinateCount: number;
  dataQualityIssueCount: number;
  correctionSourceCount: number;
  unresolvedSourceCount: number;
}

export interface OverviewSamplePointTypeRef {
  code: string;
  name: string;
  iconKey: string;
}

export interface OverviewSamplePointRoleRef {
  code: OverviewSamplePointCategoryCode;
  name: string;
  iconKey: "production" | "market" | "logistics";
}

export interface OverviewSamplePointCategoryRef {
  code: OverviewSamplePointCategoryCode;
  name: string;
}

export interface OverviewSamplePointProductRef {
  code: string;
  name: string;
}

export interface OverviewSamplePointTypeCount extends OverviewSamplePointTypeRef {
  count: number;
}

export interface OverviewSamplePointCategoryCount extends OverviewSamplePointCategoryRef {
  count: number;
  types: readonly OverviewSamplePointTypeCount[];
}

export interface OverviewSamplePointListItem {
  samplePointId: string;
  name: string;
  regionCode: string;
  regionName: string;
  locationState: string;
  dataQualityReason: string | null;
  categories: readonly OverviewSamplePointCategoryRef[];
  types: readonly OverviewSamplePointTypeRef[];
  products: readonly OverviewSamplePointProductRef[];
  latestBusinessDate: string | null;
  summaryValues: Readonly<Record<string, OverviewSamplePointBusinessValue>>;
}

export interface OverviewSamplePointList {
  regionCode: string;
  totalCount: number;
  validCoordinateCount: number;
  dataQualityIssueCount: number;
  correctionSourceCount: number;
  unresolvedSourceCount: number;
  categories: readonly OverviewSamplePointCategoryCount[];
  items: readonly OverviewSamplePointListItem[];
  correctionSources: readonly OverviewSamplePointCorrectionSource[];
}

export interface OverviewSamplePointCorrectionSource {
  categoryCode: OverviewSamplePointCategoryCode;
  sourceRecordId: string;
  sourceRole: "SURVEY" | "ORIGIN" | "DESTINATION";
  dataQualityReason: string;
}

export interface OverviewSamplePointIcon {
  samplePointId: string;
  name: string;
  /** Formal administrative ownership of this exact governed coordinate. */
  regionCode?: string;
  iconKey: string;
  roles?: readonly OverviewSamplePointRoleRef[];
  layerType?: SampleNetworkLayerType;
  anchorRegionCode?: string;
  villageRegionCode?: string;
  visualState?: "default" | "selected" | "muted";
  relationTypes?: readonly SampleNetworkRelationType[];
  representedRegionCode?: string;
  representedRegionName?: string;
  representedRegionLevel?: "PREFECTURE" | "COUNTY" | "TOWNSHIP";
  aggregateCount?: number;
  types: readonly OverviewSamplePointTypeRef[];
  longitude: number | null;
  latitude: number | null;
  dataQualityReason: string | null;
}

export type SampleNetworkLayerMode = "actual" | "design" | "comparison";

export type SampleNetworkLayerType =
  | "ANNUAL_ACTUAL"
  | "DESIGN_COVERAGE_BADGE"
  | "DESIGN_EXACT_LOCATION"
  | "REGIONAL_ACTUAL_BADGE";

export type SampleNetworkRelationType =
  "EXACT_VILLAGE" | "EXPLICIT_REPRESENTATION" | "REGIONAL_ASSOCIATION";

export interface OverviewDesignSamplePointRecord {
  id: string;
  contractVersion: "design-sample-fields-v1";
  contractDigest: string;
  context: {
    domainCode: string;
    productCode: string;
    objectTypeCode: string;
  };
  values: Readonly<Record<string, unknown>>;
  name: string;
  regionCode: string;
  regionPath: string;
  longitude: number;
  latitude: number;
  version: number;
  updatedAt: string;
}

export interface OverviewDesignSamplePointPage {
  items: readonly OverviewDesignSamplePointRecord[];
  pageNumber: number;
  pageSize: number;
  totalElements: number;
  totalPages: number;
}

export interface OverviewDesignSamplePointBusinessValue {
  code: string;
  label: string;
  value: string;
  unit: string | null;
}

export interface OverviewDesignSamplePoint extends OverviewDesignSamplePointRecord {
  domainLabel: string;
  productLabel: string;
  objectTypeLabel: string;
  businessValues: readonly OverviewDesignSamplePointBusinessValue[];
}

export interface SampleNetworkDesignPoint {
  villageRegionCode: string;
  villageName: string;
  townshipRegionCode: string;
  townshipName: string;
  countyRegionCode: string;
  countyName: string;
  designLongitude: number;
  designLatitude: number;
  coordinateReviewStatus?: string | null | undefined;
  coordinateSourceName?: string | null | undefined;
  coordinateSourceRevision?: string | null | undefined;
  coordinateMatchConfidence?: string | null | undefined;
}

export interface SampleNetworkActualPoint {
  samplePointId: string;
  samplePointName: string;
  samplePointKindCode: string;
  membershipStatusCode: string;
  locatedRegionCode: string;
  locatedRegionName: string;
  locatedRegionLevel: "PREFECTURE" | "COUNTY" | "TOWNSHIP" | "VILLAGE";
  actualLongitude: number | null;
  actualLatitude: number | null;
  locationState: string;
}

export interface SampleNetworkRelation {
  samplePointId: string;
  designVillageRegionCode: string;
  relationType: SampleNetworkRelationType;
  evidenceReference: string | null;
  reviewStatus: string | null;
  createdBy: string | null;
  createdAt: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
}

export interface SampleNetworkComparison {
  networkYear: number;
  networkStatus: string;
  designPointCount: number;
  designCoordinateCount: number;
  activeSamplePointCount: number;
  approvedSubmissionSamplePointCount: number;
  pendingVerificationDesignPointCount: number;
  multipleActualPerDesignPointCount: number;
  anomalyCount: number;
  exactCoveredDesignPointCount: number;
  representedDesignPointCount: number;
  regionalAssociationDesignPointCount: number;
  unrelatedDesignPointCount: number;
  actualLevelCounts: Readonly<{
    prefecture: number;
    county: number;
    township: number;
    village: number;
  }>;
  designPoints: readonly SampleNetworkDesignPoint[];
  actualPoints: readonly SampleNetworkActualPoint[];
  relations: readonly SampleNetworkRelation[];
}

export interface SampleNetworkDesignComparison {
  networkYear: number;
  networkStatus: string;
  designPointCount: number;
  designCoordinateCount: number;
  pendingVerificationDesignPointCount: number;
  designPoints: readonly SampleNetworkDesignPoint[];
  relations: readonly SampleNetworkRelation[];
}

export interface OverviewSamplePointBusinessValue {
  label: string;
  value: string;
  unitCode: string | null;
}

export interface OverviewSamplePointAssociation {
  categoryCode: OverviewSamplePointCategoryCode;
  categoryName: string;
  sourceRole: "SURVEY" | "ORIGIN" | "DESTINATION";
  typeCode: string;
  typeName: string;
  productCode: string;
  productName: string;
  occurrenceDate: string;
  sourceVersion: number;
  businessValues: Readonly<Record<string, OverviewSamplePointBusinessValue>>;
}

export interface OverviewSamplePointDetail {
  samplePointId: string;
  name: string;
  regionCode: string;
  regionName: string;
  locationState: string;
  dataQualityReason: string | null;
  /** Required by the live HTTP contract; optional only for legacy in-memory fixtures. */
  roles?: readonly OverviewSamplePointRoleRef[];
  associations: readonly OverviewSamplePointAssociation[];
}
