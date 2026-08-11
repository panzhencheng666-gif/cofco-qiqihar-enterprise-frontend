export type OverviewSamplePointCategoryCode = "PRODUCTION" | "MARKET" | "LOGISTICS";

export interface OverviewSamplePointAggregate {
  regionCode: string;
  regionName: string;
  regionLevel: "PREFECTURE" | "COUNTY" | "TOWNSHIP" | "VILLAGE";
  samplePointCount: number;
  unresolvedSourceCount: number;
}

export interface OverviewSamplePointTypeRef {
  code: string;
  name: string;
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
  categories: readonly OverviewSamplePointCategoryRef[];
  types: readonly OverviewSamplePointTypeRef[];
  products: readonly OverviewSamplePointProductRef[];
}

export interface OverviewSamplePointList {
  regionCode: string;
  totalCount: number;
  unresolvedSourceCount: number;
  categories: readonly OverviewSamplePointCategoryCount[];
  items: readonly OverviewSamplePointListItem[];
}

export interface OverviewSamplePointIcon {
  samplePointId: string;
  name: string;
  types: readonly OverviewSamplePointTypeRef[];
  longitude: number;
  latitude: number;
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
  associations: readonly OverviewSamplePointAssociation[];
}
