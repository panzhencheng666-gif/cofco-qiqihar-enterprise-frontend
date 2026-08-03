import type {
  OverviewIndicator,
  OverviewOptions,
  OverviewRegion,
} from "../../domain/overview";

export interface OverviewRepository {
  options(): Promise<OverviewOptions>;
  regions(query: {
    parentCode?: string;
    productCode: string;
    periodCode: string;
  }): Promise<readonly OverviewRegion[]>;
  indicators(query: {
    productCode: string;
    regionCode: string;
    periodCode: string;
    marketingYear?: string;
  }): Promise<readonly OverviewIndicator[]>;
}
