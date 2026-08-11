import type {
  OverviewSamplePointAggregate,
  OverviewSamplePointCategoryCode,
  OverviewSamplePointDetail,
  OverviewSamplePointIcon,
  OverviewSamplePointList,
} from "../../domain/overviewSamplePoint";

export interface OverviewSamplePointRepository {
  aggregates(query: {
    productCode: string;
    parentCode?: string;
  }): Promise<readonly OverviewSamplePointAggregate[]>;
  list(query: {
    productCode: string;
    regionCode: string;
    categoryCode?: OverviewSamplePointCategoryCode;
    typeCode?: string;
    query?: string;
  }): Promise<OverviewSamplePointList>;
  icons(query: {
    productCode: string;
    regionCode: string;
    categoryCode: OverviewSamplePointCategoryCode;
    typeCode?: string;
    query?: string;
  }): Promise<readonly OverviewSamplePointIcon[]>;
  detail(query: {
    samplePointId: string;
    productCode: string;
    regionCode: string;
    categoryCode: OverviewSamplePointCategoryCode;
    typeCode?: string;
  }): Promise<OverviewSamplePointDetail>;
}
