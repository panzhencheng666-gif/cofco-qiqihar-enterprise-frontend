import { z } from "zod";

import type { OverviewSamplePointRepository } from "../../application/ports/OverviewSamplePointRepository";
import type { OverviewSamplePointRequestOptions } from "../../application/ports/OverviewSamplePointRepository";
import type { OverviewSamplePointCategoryCode } from "../../domain/overviewSamplePoint";
import type { HttpClient } from "../../../../shared/api/HttpClient";
import { queryString } from "../../../../shared/api/HttpClient";
import type {
  DesignSampleContext,
  DesignSampleFieldContract,
} from "../../../design-sample/domain/designSampleFieldContract";
import {
  formalLocationIssue,
  formalObservationHistorySchema,
  formalRole,
  formalSamplePointDetailSchema,
  formalSamplePointPageSchema,
  logisticsObservationDefinitionSchema,
  lockedObservationCodes,
  marketObservationDefinitionSchema,
  presentFormalSnapshot,
  presentObservationValues,
  productionObservationDefinitionSchema,
  shanghaiDate,
  uniqueObservationFields,
} from "./formalSamplePointProjection";
import type {
  FormalSamplePoint,
  ObservationFieldDefinition,
} from "./formalSamplePointProjection";

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

const designSamplePointSchema = z
  .object({
    id: uuidTextSchema,
    contractVersion: z.literal("design-sample-fields-v1"),
    contractDigest: z.string().regex(/^sha256:[a-f0-9]{64}$/u),
    context: z
      .object({
        domainCode: z.string().min(1),
        productCode: z.string().min(1),
        objectTypeCode: z.string().min(1),
      })
      .strict(),
    values: z.record(z.string(), z.unknown()),
    name: z.string().min(1),
    regionCode: z.string().min(1),
    regionPath: z.string().min(1),
    longitude: z.number().min(-180).max(180),
    latitude: z.number().min(-90).max(90),
    version: z.number().int().nonnegative(),
    updatedAt: z.string().min(1),
  })
  .strict();

const designSamplePointPageSchema = z.object({
  data: z
    .object({
      items: z.array(designSamplePointSchema),
      pageNumber: z.number().int().nonnegative(),
      pageSize: z.number().int().positive().max(100),
      totalElements: z.number().int().nonnegative(),
      totalPages: z.number().int().nonnegative(),
    })
    .strict(),
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
  constructor(
    private readonly http: HttpClient,
    private readonly loadDesignPointDefinition?: (
      context: DesignSampleContext,
    ) => Promise<DesignSampleFieldContract>,
  ) {}

  async designPoints(query: {
    page: number;
    pageSize: number;
    productCode?: string;
    regionCode?: string;
  }) {
    return (
      await this.http.get(
        `/api/v1/design-sample-points${queryString({
          page: query.page,
          pageSize: query.pageSize,
          productCode: query.productCode,
          regionCode: query.regionCode,
        })}`,
        designSamplePointPageSchema,
      )
    ).data;
  }

  async designPointDefinition(context: DesignSampleContext) {
    if (!this.loadDesignPointDefinition) {
      throw new Error("Design sample point metadata repository is unavailable");
    }
    return this.loadDesignPointDefinition(context);
  }

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
      regionName?: string;
      productCode: string;
      year: number;
      categoryCode?: OverviewSamplePointCategoryCode;
      typeCode?: string;
      query?: string;
    },
    options?: OverviewSamplePointRequestOptions,
  ) {
    const points = await this.loadFormalSamplePoints(
      query.regionCode,
      query.query,
      options,
    );
    return presentFormalSnapshot(points, {
      regionCode: query.regionCode,
      regionName: query.regionName ?? "",
      ...(query.categoryCode ? { categoryCode: query.categoryCode } : {}),
      ...(query.typeCode ? { typeCode: query.typeCode } : {}),
    });
  }

  async detail(query: {
    samplePointId: string;
    regionCode: string;
    regionName?: string;
    productCode: string;
    year: number;
    categoryCode?: OverviewSamplePointCategoryCode;
    typeCode?: string;
  }) {
    const point = (
      await this.http.get(
        `/api/v1/formal-sample-points/${encodeURIComponent(query.samplePointId)}`,
        formalSamplePointDetailSchema,
      )
    ).data;
    const [history, fields] = await Promise.all([
      this.http.get(
        `/api/v1/formal-sample-observations/observations${queryString({
          domain: point.businessDomain,
          samplePointId: point.id,
          productCode: query.productCode,
          year: query.year,
          pageNumber: 0,
          pageSize: 100,
        })}`,
        formalObservationHistorySchema,
      ),
      this.loadObservationFields(
        point.businessDomain,
        query.productCode,
        point.objectTypeCode,
      ),
    ]);
    const role = formalRole(point.businessDomain);
    return {
      samplePointId: point.id,
      name: point.canonicalName,
      regionCode: point.regionCode,
      regionName: query.regionName ?? "",
      address: point.address,
      ...(point.longitude === null ? {} : { longitude: point.longitude }),
      ...(point.latitude === null ? {} : { latitude: point.latitude }),
      objectTypeName: point.objectTypeName,
      version: point.version,
      locationState: point.locationState,
      dataQualityReason: formalLocationIssue(point),
      roles: [role],
      associations: history.data.items.map((observation) => ({
        categoryCode: point.businessDomain,
        categoryName: role.name,
        sourceRole: "SURVEY" as const,
        typeCode: point.objectTypeCode,
        typeName: point.objectTypeName,
        productCode: query.productCode,
        productName: "",
        occurrenceDate: shanghaiDate(observation.observedAt),
        businessValues: presentObservationValues(observation.values, fields),
      })),
    };
  }

  private async loadFormalSamplePoints(
    regionCode: string,
    keyword: string | undefined,
    options: OverviewSamplePointRequestOptions | undefined,
  ): Promise<readonly FormalSamplePoint[]> {
    const readPage = (page: number) =>
      this.http.get(
        `/api/v1/formal-sample-points${queryString({
          regionCode,
          keyword,
          page,
          pageSize: 100,
        })}`,
        formalSamplePointPageSchema,
        options,
      );
    const first = (await readPage(0)).data;
    const items = [...first.items];
    for (let page = 1; page < first.totalPages; page += 1) {
      items.push(...(await readPage(page)).data.items);
    }
    return items;
  }

  private async loadObservationFields(
    domain: OverviewSamplePointCategoryCode,
    productCode: string,
    objectTypeCode: string,
  ): Promise<readonly ObservationFieldDefinition[]> {
    if (domain === "MARKET") {
      const definition = (
        await this.http.get(
          `/api/v1/market-record-definitions${queryString({ productCode, objectTypeCode })}`,
          marketObservationDefinitionSchema,
        )
      ).data;
      return uniqueObservationFields([
        ...definition.coreFields
          .filter(
            ({ code, controlType }) =>
              !lockedObservationCodes.MARKET.has(code) &&
              !controlType.toUpperCase().startsWith("READONLY"),
          )
          .map((field) => ({ ...field, sectionOrder: 0, options: field.options })),
        ...definition.groups.flatMap(({ fields, sortOrder: sectionOrder }) =>
          fields.map((field) => ({ ...field, sectionOrder, options: [] })),
        ),
      ]);
    }
    if (domain === "PRODUCTION") {
      const definition = (
        await this.http.get(
          `/api/v1/production-record-definitions${queryString({ productCode, objectTypeCode })}`,
          productionObservationDefinitionSchema,
        )
      ).data;
      const fields = definition.fields
        .filter(
          (field) =>
            field.displayed &&
            !field.readOnly &&
            !field.calculated &&
            !lockedObservationCodes.PRODUCTION.has(field.code),
        )
        .map((field) => ({
          ...field,
          sectionOrder: field.groupOrder,
          options: field.options.map((value) => ({ value, label: value })),
        }));
      return uniqueObservationFields(fields);
    }
    const definition = (
      await this.http.get(
        `/api/v1/logistics-record-definitions${queryString({ productCode })}`,
        logisticsObservationDefinitionSchema,
      )
    ).data;
    return definition.fields
      .filter(
        (field) => !field.readOnly && !lockedObservationCodes.LOGISTICS.has(field.code),
      )
      .map((field) => ({ ...field, sectionOrder: 0, options: field.options }));
  }
}
