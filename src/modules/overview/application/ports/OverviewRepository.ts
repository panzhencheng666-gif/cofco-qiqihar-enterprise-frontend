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
    periodCode?: string;
  }): Promise<readonly OverviewRegion[]>;
  locations(query: {
    ancestorCode?: string;
    level: "TOWNSHIP" | "VILLAGE";
    productCode: string;
    periodCode?: string;
  }): Promise<readonly OverviewRegion[]>;
  indicators(query: {
    productCode: string;
    regionCode: string;
    periodCode: string;
    marketingYear?: string;
  }): Promise<readonly OverviewIndicator[]>;
  dashboard(query: {
    marketingYear?: string;
    periodCode?: string;
    productCode: string;
    regionCode?: string;
  }): Promise<OverviewDashboard>;
}
