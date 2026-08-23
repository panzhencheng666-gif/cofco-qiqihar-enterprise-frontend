import type {
  OverviewSamplePointAggregate,
  OverviewSamplePointCategoryCode,
  OverviewSamplePointDetail,
  OverviewSamplePointIcon,
  OverviewSamplePointList,
  SampleNetworkComparison,
} from "../../domain/overviewSamplePoint";

export interface OverviewSamplePointRepository {
  comparison(query: {
    regionCode?: string;
    year: number;
  }): Promise<SampleNetworkComparison>;
  aggregates(query: {
    parentCode?: string;
    productCode: string;
    year: number;
  }): Promise<readonly OverviewSamplePointAggregate[]>;
  list(query: {
    regionCode: string;
    productCode: string;
    year: number;
    categoryCode?: OverviewSamplePointCategoryCode;
    typeCode?: string;
    query?: string;
  }): Promise<OverviewSamplePointList>;
  icons(query: {
    regionCode: string;
    productCode: string;
    year: number;
    categoryCode: OverviewSamplePointCategoryCode;
    typeCode?: string;
    query?: string;
  }): Promise<readonly OverviewSamplePointIcon[]>;
  detail(query: {
    samplePointId: string;
    regionCode: string;
    productCode: string;
    year: number;
    categoryCode: OverviewSamplePointCategoryCode;
    typeCode?: string;
  }): Promise<OverviewSamplePointDetail>;
}
