import type {
  OverviewSamplePointAggregate,
  OverviewSamplePointCategoryCode,
  OverviewSamplePointDetail,
  OverviewSamplePointIcon,
  OverviewSamplePointList,
  SampleNetworkComparison,
  SampleNetworkDesignComparison,
} from "../../domain/overviewSamplePoint";
import type { HttpDownload } from "../../../../shared/api/HttpClient";

export interface OverviewSamplePointRequestOptions {
  signal?: AbortSignal;
}

export interface OverviewSamplePointRepository {
  exportInventory?(query: { year: number; regionCode?: string }): Promise<HttpDownload>;
  designComparison?(query: {
    regionCode?: string;
    year: number;
  }): Promise<SampleNetworkDesignComparison>;
  comparison(query: {
    productCode: string;
    regionCode?: string;
    year: number;
  }): Promise<SampleNetworkComparison>;
  aggregates(query: {
    parentCode?: string;
    productCode: string;
    year: number;
  }): Promise<readonly OverviewSamplePointAggregate[]>;
  list(
    query: {
      regionCode: string;
      productCode: string;
      year: number;
      categoryCode?: OverviewSamplePointCategoryCode;
      typeCode?: string;
      query?: string;
    },
    options?: OverviewSamplePointRequestOptions,
  ): Promise<OverviewSamplePointList>;
  icons(
    query: {
      regionCode: string;
      productCode: string;
      year: number;
      categoryCode?: OverviewSamplePointCategoryCode;
      typeCode?: string;
      query?: string;
    },
    options?: OverviewSamplePointRequestOptions,
  ): Promise<readonly OverviewSamplePointIcon[]>;
  snapshot?(
    query: {
      regionCode: string;
      productCode: string;
      year: number;
      categoryCode?: OverviewSamplePointCategoryCode;
      typeCode?: string;
      query?: string;
    },
    options?: OverviewSamplePointRequestOptions,
  ): Promise<{
    list: OverviewSamplePointList;
    icons: readonly OverviewSamplePointIcon[];
  }>;
  detail(query: {
    samplePointId: string;
    regionCode: string;
    productCode: string;
    year: number;
    categoryCode?: OverviewSamplePointCategoryCode;
    typeCode?: string;
  }): Promise<OverviewSamplePointDetail>;
}
