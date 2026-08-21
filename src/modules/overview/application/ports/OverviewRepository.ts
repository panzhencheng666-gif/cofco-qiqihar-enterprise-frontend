import type {
  OverviewDashboard,
  OverviewIndicator,
  OverviewMapScope,
  OverviewOptions,
  OverviewRegion,
} from "../../domain/overview";

export type OverviewRegionTimeScope =
  { periodCode: string; year?: never } | { periodCode?: never; year: number };

export type OverviewRegionQuery = {
  parentCode?: string;
  productCode: string;
} & OverviewRegionTimeScope;

export interface OverviewRepository {
  invalidateBusinessData?(): void;
  options(): Promise<OverviewOptions>;
  mapScope(): Promise<OverviewMapScope>;
  regions(query: OverviewRegionQuery): Promise<readonly OverviewRegion[]>;
  locations(query: {
    ancestorCode?: string;
    level: "TOWNSHIP" | "VILLAGE";
    productCode: string;
    year: number;
  }): Promise<readonly OverviewRegion[]>;
  indicators(query: {
    productCode: string;
    regionCode: string;
    year: number;
  }): Promise<readonly OverviewIndicator[]>;
  dashboard(query: {
    productCode: string;
    regionCode?: string;
    year: number;
  }): Promise<OverviewDashboard>;
}
