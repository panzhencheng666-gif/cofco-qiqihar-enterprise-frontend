import { z } from "zod";

import type { OverviewSamplePointRepository } from "../../application/ports/OverviewSamplePointRepository";
import type { OverviewSamplePointCategoryCode } from "../../domain/overviewSamplePoint";
import type { HttpClient } from "../../../../shared/api/HttpClient";
import { queryString } from "../../../../shared/api/HttpClient";

const categoryCodeSchema = z.enum(["PRODUCTION", "MARKET"]);
const regionLevelSchema = z.enum(["PREFECTURE", "COUNTY", "TOWNSHIP", "VILLAGE"]);
const uuidTextSchema = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
const typeRefSchema = z.object({
  code: z.string(),
  name: z.string(),
  iconKey: z.string().min(1),
});
const businessValueSchema = z.object({
  label: z.string(),
  value: z.string(),
  unitCode: z.string().nullable(),
});

const aggregateSchema = z
  .object({
    regionCode: z.string(),
    regionName: z.string(),
    regionLevel: regionLevelSchema,
    samplePointCount: z.number().int().nonnegative(),
    productionCount: z.number().int().nonnegative(),
    marketCount: z.number().int().nonnegative(),
    validCoordinateCount: z.number(),
    dataQualityIssueCount: z.number(),
    correctionSourceCount: z.number(),
    unresolvedSourceCount: z.number(),
  })
  .refine(
    ({ marketCount, productionCount, samplePointCount }) =>
      samplePointCount >= Math.max(productionCount, marketCount) &&
      samplePointCount <= productionCount + marketCount,
    {
      message: "samplePointCount must stay within distinct-point bounds",
      path: ["samplePointCount"],
    },
  );

const aggregatesSchema = z.object({
  data: z.array(aggregateSchema),
});

const listSchema = z.object({
  data: z.object({
    regionCode: z.string(),
    totalCount: z.number(),
    validCoordinateCount: z.number(),
    dataQualityIssueCount: z.number(),
    correctionSourceCount: z.number(),
    unresolvedSourceCount: z.number(),
    categories: z.array(
      z.object({
        code: categoryCodeSchema,
        name: z.string(),
        count: z.number(),
        types: z.array(typeRefSchema.extend({ count: z.number() })),
      }),
    ),
    items: z.array(
      z.object({
        samplePointId: uuidTextSchema,
        name: z.string(),
        regionCode: z.string(),
        regionName: z.string(),
        locationState: z.string(),
        dataQualityReason: z.string().nullable(),
        categories: z.array(z.object({ code: categoryCodeSchema, name: z.string() })),
        types: z.array(typeRefSchema),
        products: z.array(z.object({ code: z.string(), name: z.string() })),
        latestBusinessDate: z.string(),
        summaryValues: z.record(z.string(), businessValueSchema),
      }),
    ),
    correctionSources: z.array(
      z.object({
        categoryCode: categoryCodeSchema,
        sourceRecordId: z.string(),
        sourceRole: z.enum(["SURVEY", "ORIGIN", "DESTINATION"]),
        dataQualityReason: z.string(),
      }),
    ),
  }),
});

const iconsSchema = z.object({
  data: z.array(
    z.object({
      samplePointId: uuidTextSchema,
      name: z.string(),
      iconKey: z.string().min(1),
      types: z.array(typeRefSchema),
      longitude: z.number(),
      latitude: z.number(),
      dataQualityReason: z.string().nullable().default(null),
    }),
  ),
});

const detailSchema = z.object({
  data: z.object({
    samplePointId: uuidTextSchema,
    name: z.string(),
    regionCode: z.string(),
    regionName: z.string(),
    locationState: z.string(),
    dataQualityReason: z.string().nullable(),
    associations: z.array(
      z.object({
        categoryCode: categoryCodeSchema,
        categoryName: z.string(),
        sourceRole: z.enum(["SURVEY", "ORIGIN", "DESTINATION"]),
        typeCode: z.string(),
        typeName: z.string(),
        productCode: z.string(),
        productName: z.string(),
        occurrenceDate: z.string(),
        sourceVersion: z.number(),
        businessValues: z.record(z.string(), businessValueSchema),
      }),
    ),
  }),
});

const comparisonSchema = z.object({
  data: z.object({
    networkYear: z.number().int(),
    networkStatus: z.string(),
    designPointCount: z.number().int().nonnegative(),
    activeSamplePointCount: z.number().int().nonnegative(),
    coveredDesignPointCount: z.number().int().nonnegative(),
    uncoveredDesignPointCount: z.number().int().nonnegative(),
    points: z.array(
      z.object({
        villageRegionCode: z.string(),
        villageName: z.string(),
        townshipRegionCode: z.string(),
        townshipName: z.string(),
        countyRegionCode: z.string(),
        countyName: z.string(),
        designLongitude: z.number(),
        designLatitude: z.number(),
        samplePointId: uuidTextSchema.nullable(),
        samplePointName: z.string().nullable(),
        samplePointKindCode: z.string().nullable(),
        membershipStatusCode: z.string().nullable(),
        actualLongitude: z.number().nullable(),
        actualLatitude: z.number().nullable(),
        comparisonState: z.string(),
      }),
    ),
  }),
});

export class HttpOverviewSamplePointRepository implements OverviewSamplePointRepository {
  constructor(private readonly http: HttpClient) {}

  async comparison(query: { year: number; regionCode?: string }) {
    return (
      await this.http.get(
        `/api/v1/sample-networks/${query.year}/comparison${queryString(
          query.regionCode ? { regionCode: query.regionCode } : {},
        )}`,
        comparisonSchema,
      )
    ).data;
  }

  async aggregates(query: { year: number; productCode: string; parentCode?: string }) {
    const parameters = {
      year: query.year,
      productCode: query.productCode,
      ...(query.parentCode ? { parentCode: query.parentCode } : {}),
    };
    return (
      await this.http.get(
        `/api/v1/overview/sample-point-aggregates${queryString(parameters)}`,
        aggregatesSchema,
      )
    ).data;
  }

  async list(query: {
    regionCode: string;
    productCode: string;
    year: number;
    categoryCode?: OverviewSamplePointCategoryCode;
    typeCode?: string;
    query?: string;
  }) {
    return (
      await this.http.get(
        `/api/v1/overview/sample-points${queryString(query)}`,
        listSchema,
      )
    ).data;
  }

  async icons(query: {
    regionCode: string;
    productCode: string;
    year: number;
    categoryCode: OverviewSamplePointCategoryCode;
    typeCode?: string;
    query?: string;
  }) {
    return (
      await this.http.get(
        `/api/v1/overview/sample-point-icons${queryString(query)}`,
        iconsSchema,
      )
    ).data;
  }

  async detail(query: {
    samplePointId: string;
    regionCode: string;
    productCode: string;
    year: number;
    categoryCode: OverviewSamplePointCategoryCode;
    typeCode?: string;
  }) {
    const parameters = {
      year: query.year,
      productCode: query.productCode,
      regionCode: query.regionCode,
      categoryCode: query.categoryCode,
      ...(query.typeCode ? { typeCode: query.typeCode } : {}),
    };
    return (
      await this.http.get(
        `/api/v1/overview/sample-points/${encodeURIComponent(query.samplePointId)}${queryString(parameters)}`,
        detailSchema,
      )
    ).data;
  }
}
