import { z } from "zod";

import type { OverviewSamplePointRepository } from "../../application/ports/OverviewSamplePointRepository";
import type { OverviewSamplePointRequestOptions } from "../../application/ports/OverviewSamplePointRepository";
import type { OverviewSamplePointCategoryCode } from "../../domain/overviewSamplePoint";
import type { HttpClient } from "../../../../shared/api/HttpClient";
import { queryString } from "../../../../shared/api/HttpClient";

const categoryCodeSchema = z.enum(["PRODUCTION", "MARKET", "LOGISTICS"]);
const roleRefSchema = z.object({
  code: categoryCodeSchema,
  name: z.string(),
  iconKey: z.enum(["production", "market", "logistics"]),
});
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
    scopeKind: z.enum(["CHILD_REGION", "PARENT_DIRECT"]),
    anchorRegionCode: z.string(),
    samplePointCount: z.number().int().nonnegative(),
    productionCount: z.number().int().nonnegative(),
    marketCount: z.number().int().nonnegative(),
    logisticsCount: z.number().int().nonnegative(),
    validCoordinateCount: z.number(),
    dataQualityIssueCount: z.number(),
    correctionSourceCount: z.number(),
    unresolvedSourceCount: z.number(),
  })
  .refine(
    ({ logisticsCount, marketCount, productionCount, samplePointCount }) =>
      samplePointCount >= Math.max(productionCount, marketCount, logisticsCount) &&
      samplePointCount <= productionCount + marketCount + logisticsCount,
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
        latestBusinessDate: z.string().nullable(),
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
      regionCode: z.string().min(1),
      iconKey: z.string().min(1),
      roles: z.array(roleRefSchema).min(1),
      types: z.array(typeRefSchema),
      longitude: z.number(),
      latitude: z.number(),
      dataQualityReason: z.string().nullable().default(null),
    }),
  ),
});

const snapshotSchema = z.object({
  data: z.object({
    list: listSchema.shape.data,
    icons: iconsSchema.shape.data,
  }),
});

const detailSchema = z.object({
  data: z.object({
    samplePointId: uuidTextSchema,
    name: z.string(),
    regionCode: z.string(),
    regionName: z.string(),
    locationState: z.string(),
    dataQualityReason: z.string().nullable(),
    roles: z.array(roleRefSchema).min(1),
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

const comparisonDesignPointSchema = z
  .object({
    villageRegionCode: z.string(),
    villageName: z.string(),
    townshipRegionCode: z.string(),
    townshipName: z.string(),
    countyRegionCode: z.string(),
    countyName: z.string(),
    designLongitude: z.number(),
    designLatitude: z.number(),
    coordinateReviewStatus: z.string().nullable().optional(),
    coordinateSourceName: z.string().nullable().optional(),
    coordinateSourceRevision: z.string().nullable().optional(),
    coordinateMatchConfidence: z.string().nullable().optional(),
    coordinateSource: z.string().nullable().optional(),
  })
  .transform(({ coordinateSource, coordinateSourceName, ...point }) => {
    return {
      ...point,
      coordinateSourceName: coordinateSourceName ?? coordinateSource,
    };
  });

const comparisonSchema = z.object({
  data: z.object({
    networkYear: z.number().int(),
    networkStatus: z.string(),
    designPointCount: z.number().int().nonnegative(),
    designCoordinateCount: z.number().int().nonnegative(),
    activeSamplePointCount: z.number().int().nonnegative(),
    approvedSubmissionSamplePointCount: z.number().int().nonnegative(),
    pendingVerificationDesignPointCount: z.number().int().nonnegative(),
    multipleActualPerDesignPointCount: z.number().int().nonnegative(),
    anomalyCount: z.number().int().nonnegative(),
    exactCoveredDesignPointCount: z.number().int().nonnegative(),
    representedDesignPointCount: z.number().int().nonnegative(),
    regionalAssociationDesignPointCount: z.number().int().nonnegative(),
    unrelatedDesignPointCount: z.number().int().nonnegative(),
    actualLevelCounts: z.object({
      prefecture: z.number().int().nonnegative(),
      county: z.number().int().nonnegative(),
      township: z.number().int().nonnegative(),
      village: z.number().int().nonnegative(),
    }),
    designPoints: z.array(comparisonDesignPointSchema),
    actualPoints: z.array(
      z.object({
        samplePointId: uuidTextSchema,
        samplePointName: z.string(),
        samplePointKindCode: z.string(),
        membershipStatusCode: z.string(),
        locatedRegionCode: z.string(),
        locatedRegionName: z.string(),
        locatedRegionLevel: regionLevelSchema,
        actualLongitude: z.number().nullable(),
        actualLatitude: z.number().nullable(),
        locationState: z.string(),
      }),
    ),
    relations: z.array(
      z.object({
        samplePointId: uuidTextSchema,
        designVillageRegionCode: z.string(),
        relationType: z.enum([
          "EXACT_VILLAGE",
          "EXPLICIT_REPRESENTATION",
          "REGIONAL_ASSOCIATION",
        ]),
        evidenceReference: z.string().nullable(),
        reviewStatus: z.string().nullable(),
        createdBy: z.string().nullable(),
        createdAt: z.string().nullable(),
        reviewedBy: z.string().nullable(),
        reviewedAt: z.string().nullable(),
      }),
    ),
  }),
});

const designComparisonSchema = z.object({
  data: z.object({
    networkYear: z.number().int(),
    networkStatus: z.string(),
    designPointCount: z.number().int().nonnegative(),
    designCoordinateCount: z.number().int().nonnegative(),
    pendingVerificationDesignPointCount: z.number().int().nonnegative(),
    designPoints: z.array(comparisonDesignPointSchema),
    relations: comparisonSchema.shape.data.shape.relations,
  }),
});

export class HttpOverviewSamplePointRepository implements OverviewSamplePointRepository {
  constructor(private readonly http: HttpClient) {}

  async exportInventory(query: { year: number; regionCode?: string }) {
    if (!this.http.download)
      throw new Error("Sample inventory download is unavailable");
    return this.http.download(
      `/api/v1/overview/sample-points/export${queryString(query)}`,
    );
  }

  async comparison(query: { year: number; productCode: string; regionCode?: string }) {
    return (
      await this.http.get(
        `/api/v1/sample-networks/${query.year}/comparison${queryString({
          productCode: query.productCode,
          ...(query.regionCode ? { regionCode: query.regionCode } : {}),
        })}`,
        comparisonSchema,
      )
    ).data;
  }

  async designComparison(query: { year: number; regionCode?: string }) {
    return (
      await this.http.get(
        `/api/v1/sample-networks/${query.year}/design-comparison${queryString({
          ...(query.regionCode ? { regionCode: query.regionCode } : {}),
        })}`,
        designComparisonSchema,
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

  async list(
    query: {
      regionCode: string;
      productCode: string;
      year: number;
      categoryCode?: OverviewSamplePointCategoryCode;
      typeCode?: string;
      query?: string;
    },
    options?: OverviewSamplePointRequestOptions,
  ) {
    const path = `/api/v1/overview/sample-points${queryString(query)}`;
    return (
      await (options
        ? this.http.get(path, listSchema, options)
        : this.http.get(path, listSchema))
    ).data;
  }

  async icons(
    query: {
      regionCode: string;
      productCode: string;
      year: number;
      categoryCode?: OverviewSamplePointCategoryCode;
      typeCode?: string;
      query?: string;
    },
    options?: OverviewSamplePointRequestOptions,
  ) {
    const path = `/api/v1/overview/sample-point-icons${queryString(query)}`;
    return (
      await (options
        ? this.http.get(path, iconsSchema, options)
        : this.http.get(path, iconsSchema))
    ).data;
  }

  async snapshot(
    query: {
      regionCode: string;
      productCode: string;
      year: number;
      categoryCode?: OverviewSamplePointCategoryCode;
      typeCode?: string;
      query?: string;
    },
    options?: OverviewSamplePointRequestOptions,
  ) {
    const path = `/api/v1/overview/sample-point-snapshot${queryString(query)}`;
    return (
      await (options
        ? this.http.get(path, snapshotSchema, options)
        : this.http.get(path, snapshotSchema))
    ).data;
  }

  async detail(query: {
    samplePointId: string;
    regionCode: string;
    productCode: string;
    year: number;
    categoryCode?: OverviewSamplePointCategoryCode;
    typeCode?: string;
  }) {
    const parameters = {
      year: query.year,
      productCode: query.productCode,
      regionCode: query.regionCode,
      ...(query.categoryCode ? { categoryCode: query.categoryCode } : {}),
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
