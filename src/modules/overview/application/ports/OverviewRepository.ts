import type {
  OverviewDashboard,
  OverviewIndicator,
  OverviewMapScope,
  OverviewOptions,
  OverviewRegion,
} from "../../domain/overview";

export interface OverviewRepository {
  invalidateBusinessData?(): void;
  options(): Promise<OverviewOptions>;
  mapScope(): Promise<OverviewMapScope>;
  regions(query: {
    parentCode?: string;
    productCode: string;
    year: number;
  }): Promise<readonly OverviewRegion[]>;
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
