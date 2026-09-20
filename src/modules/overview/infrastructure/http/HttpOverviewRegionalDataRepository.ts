import { z } from "zod";

import type {
  OverviewRegionalDataQuery,
  OverviewRegionalDataRepository,
} from "../../application/ports/OverviewRegionalDataRepository";
import type { HttpClient } from "../../../../shared/api/HttpClient";
import { queryString } from "../../../../shared/api/HttpClient";
import type { StorageFacilityDraft } from "../../domain/operationalFacilities";

const decimalValueSchema = z
  .union([z.string(), z.number()])
  .transform((value) => String(value));
const decimalNumberSchema = z
  .union([z.string(), z.number()])
  .transform((value) => Number(value));

const currentEstimateSchema = z.object({
  value: decimalValueSchema,
  model: z.string(),
  selection: z.string(),
  formula: z.string(),
  inputs: z.array(
    z.object({
      year: z.number().int(),
      value: decimalValueSchema,
      unit: z.string(),
      source: z.string(),
      url: z.string(),
    }),
  ),
  candidates: z.array(
    z.object({
      model: z.string(),
      meanAbsoluteError: decimalValueSchema,
      validationYears: z.number().int(),
    }),
  ),
});
const estimateBatchSchema = z.object({
  rootRegionCode: z.string(),
  year: z.number().int(),
  calculatedAt: z.string().nullable(),
  attemptedAt: z.string(),
  sourceCheckedAt: z.string().nullable(),
  calculationStatus: z.string(),
  sourceStatus: z.string(),
  modelVersion: z.string(),
  comparisons: z.array(
    z.object({
      label: z.string(),
      category: z.string(),
      unit: z.string(),
      publicYear: z.number().int(),
      publicValue: decimalValueSchema,
      sourceName: z.string(),
      sourceUrl: z.string(),
      estimateYear: z.number().int(),
      current: currentEstimateSchema.nullable(),
      difference: decimalValueSchema.nullable(),
      differencePercent: decimalValueSchema.nullable(),
      historicalCheck: currentEstimateSchema.nullable(),
      historicalDifference: decimalValueSchema.nullable(),
      conclusion: z.string(),
    }),
  ),
});

const regionalSummarySchema = z.object({
  data: z.object({
    regionCode: z.string(),
    regionName: z.string(),
    administrativeLevel: z.string(),
    year: z.number().int(),
    productCode: z.string(),
    plantedAreaMu: z.string().nullable(),
    yieldPerMuKg: z.string().nullable(),
    totalOutputKg: z.string().nullable(),
    areaChangeWanMu: z.string().nullable(),
    areaChangeRatePercent: z.string().nullable(),
    currentDataAvailable: z.boolean(),
    comparisonAvailable: z.boolean(),
    areaChangeRateAvailable: z.boolean(),
    comparisonMessage: z.string().nullable(),
  }),
});

const regionalAgricultureProfileSchema = z.object({
  data: z.object({
    regionCode: z.string(),
    regionName: z.string(),
    administrativeLevel: z.string(),
    year: z.number().int(),
    automatic: z.boolean(),
    generatedAt: z.string(),
    coverageDescription: z.string().optional(),
    regionalCalculation: z
      .object({
        status: z.string(),
        attemptedAt: z.string(),
        calculatedAt: z.string().nullable(),
        sourceStatus: z.string(),
      })
      .nullish(),
    regionFacts: z.object({
      areaSquareKilometres: decimalValueSchema,
      directChildCount: z.number().int(),
      countyCount: z.number().int(),
      townshipCount: z.number().int(),
      villageCount: z.number().int(),
    }),
    sourceSummary: z.string(),
    calculationMethod: z.string(),
    refreshStatus: z
      .object({
        cadence: z.string(),
        status: z.string(),
        lastAttemptAt: z.string().nullable(),
        lastSuccessAt: z.string().nullable(),
        nextRefreshAt: z.string().nullable(),
      })
      .optional(),
    weather: z
      .object({
        meanTemperatureC: decimalValueSchema.nullable(),
        precipitationMm: decimalValueSchema.nullable(),
        soilMoisturePercent: decimalValueSchema.nullable(),
        risk: z.string(),
        assessment: z.string(),
        observedAt: z.string(),
        sourceId: z.string(),
      })
      .nullable()
      .optional(),
    policies: z
      .array(
        z.object({
          title: z.string(),
          publishedOn: z.string().nullable(),
          sourceName: z.string(),
          sourceUrl: z.string(),
          affectedCrops: z.string(),
          impact: z.string(),
        }),
      )
      .optional(),
    indicators: z
      .array(
        z.object({
          category: z.string(),
          label: z.string(),
          value: decimalValueSchema,
          unit: z.string(),
          dataYear: z.number().int(),
          dataKind: z.enum(["OBSERVED", "ESTIMATED", "PLAN", "CONTEXT"]),
          method: z.string(),
          sourceName: z.string(),
          sourceUrl: z.string(),
          verifiedAt: z.string().optional(),
        }),
      )
      .optional(),
    sources: z
      .array(
        z.object({
          id: z.string(),
          type: z.enum(["AGRICULTURE", "WEATHER", "POLICY"]),
          name: z.string(),
          url: z.string(),
          sourceClass: z.string(),
          reliabilityWeight: decimalValueSchema,
          publishedOn: z.string().nullable(),
          fetchedAt: z.string().nullable(),
          status: z.string(),
          evidence: z.string(),
        }),
      )
      .optional(),
    railway: z
      .object({
        regionCode: z.string(),
        boundaryAvailable: z.boolean(),
        sourceAsOf: z.string().nullable(),
        facilities: z.array(
          z.object({
            sourceId: z.string(),
            name: z.string(),
            kind: z.string(),
            longitude: z.number(),
            latitude: z.number(),
            operator: z.string(),
            reference: z.string(),
            status: z.string(),
            service: z.string(),
            locationRelation: z.enum(["WITHIN", "NEARBY"]),
            distanceKm: z.number(),
            nearbyLines: z.string(),
            sourceUrl: z.string(),
          }),
        ),
        lines: z.array(
          z.object({
            name: z.string(),
            mappedTrackKm: z.number(),
            usage: z.string(),
            electrification: z.string(),
            gauge: z.string(),
            operator: z.string(),
            sourceUrl: z.string(),
          }),
        ),
      })
      .nullish(),
    estimateBatch: estimateBatchSchema
      .nullish()
      .transform((value) => value ?? undefined),
    crops: z.array(
      z.object({
        productCode: z.enum(["CORN", "SOYBEAN", "RICE"]),
        productName: z.string(),
        dataKind: z.enum(["OBSERVED", "MODEL_ESTIMATE"]),
        plantedAreaMu: z.string(),
        yieldPerMuKg: z.string(),
        totalOutputKg: z.string(),
        structurePercent: z.string(),
        basis: z.string(),
        formula: z.string().optional(),
        confidencePercent: z
          .string()
          .nullish()
          .transform((value) => value ?? undefined),
        uncertaintyLowKg: z
          .string()
          .nullish()
          .transform((value) => value ?? undefined),
        uncertaintyHighKg: z
          .string()
          .nullish()
          .transform((value) => value ?? undefined),
        forecasts: z.array(
          z.object({
            year: z.number().int(),
            plantedAreaMu: z.string(),
            yieldPerMuKg: z.string(),
            totalOutputKg: z.string(),
            formula: z.string().optional(),
            confidencePercent: z
              .string()
              .nullish()
              .transform((value) => value ?? undefined),
          }),
        ),
      }),
    ),
  }),
});

const supplyBalanceSchema = z.object({
  data: z.object({
    regionCode: z.string(),
    regionName: z.string(),
    administrativeLevel: z.string(),
    surveyYear: z.number().int(),
    productCode: z.string(),
    regionalProductionAvailable: z.boolean(),
    version: z.number().int(),
    updatedAt: z.string().nullable(),
    rows: z.array(
      z.object({
        code: z.string(),
        label: z.string(),
        kind: z.enum(["AUTO", "MANUAL", "DERIVED", "RATIO"]),
        unit: z.string(),
        requirement: z.string(),
        value: z.string().nullable(),
        display: z.string().nullable(),
        note: z.string().nullable(),
      }),
    ),
  }),
});

const storageFacilitySchema = z.object({
  code: z.string(),
  name: z.string(),
  workUnitCode: z.string(),
  relationType: z.enum(["OWNED", "LEASED", "HISTORICAL_LEASED"]),
  relationLabel: z.string(),
  regionCode: z.string(),
  regionName: z.string(),
  address: z.string(),
  longitude: decimalNumberSchema.nullable(),
  latitude: decimalNumberSchema.nullable(),
  coordinatePrecision: z.enum(["EXACT", "STREET", "TOWN", "UNKNOWN"]),
  coordinatePrecisionLabel: z.string(),
  operationalStatus: z.string(),
  capacityTonnes: decimalNumberSchema.nullable(),
  capacityAsOf: z.string().nullable(),
  version: z.number().int().nonnegative(),
  prices: z.array(
    z.object({
      productCode: z.string(),
      productName: z.string().nullable(),
      qualityRequirement: z.string(),
      value: decimalNumberSchema,
      unit: z.string(),
      effectiveOn: z.string(),
      expiresOn: z.string().nullable(),
      sourceName: z.string(),
      sourceUrl: z.string(),
      sourceClassification: z.string(),
      current: z.boolean(),
    }),
  ),
  evidence: z.array(
    z.object({
      kind: z.string(),
      title: z.string(),
      sourceName: z.string(),
      sourceUrl: z.string(),
      sourceClassification: z.string(),
      sourceAsOf: z.string().nullable(),
      note: z.string(),
    }),
  ),
});

const operationalFacilityCatalogueSchema = z.object({
  data: z.object({
    regionCode: z.string().nullable(),
    productCode: z.string().nullable(),
    asOf: z.string(),
    storageCategories: z.array(
      z.object({
        code: z.enum(["OWNED", "LEASED", "HISTORICAL_LEASED"]),
        label: z.string(),
        count: z.number().int(),
      }),
    ),
    storageFacilities: z.array(storageFacilitySchema),
    railwayFacilities: z.array(
      z.object({
        sourceId: z.string(),
        name: z.string(),
        kind: z.string(),
        longitude: decimalNumberSchema,
        latitude: decimalNumberSchema,
        operator: z.string(),
        reference: z.string(),
        status: z.string(),
        service: z.string(),
        locationRelation: z.enum(["WITHIN", "NEARBY"]),
        distanceKm: decimalNumberSchema,
        nearbyLines: z.string(),
        sourceUrl: z.string(),
      }),
    ),
    railwayLines: z.array(
      z.object({
        name: z.string(),
        mappedTrackKm: decimalNumberSchema,
        usage: z.string(),
        electrification: z.string(),
        gauge: z.string(),
        operator: z.string(),
        sourceUrl: z.string(),
      }),
    ),
    railwayRoutes: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        geometryGeoJson: z.string(),
        usage: z.string(),
        operator: z.string(),
        sourceUrl: z.string(),
      }),
    ),
    sources: z.array(
      z.object({
        code: z.enum(["STORAGE", "RAILWAY"]),
        label: z.string(),
        status: z.enum(["READY", "STALE", "UNAVAILABLE"]),
        sourceAsOf: z.string().nullable(),
        sourceUrl: z.string().nullable(),
        notice: z.string(),
      }),
    ),
  }),
});

const operationalSituationSchema = z.object({
  data: z.object({
    generatedAt: z.string(),
    weather: z.array(
      z.object({
        rootRegionCode: z.string(),
        regionCode: z
          .string()
          .nullish()
          .transform((value) => value ?? ""),
        regionName: z.string(),
        longitude: decimalNumberSchema,
        latitude: decimalNumberSchema,
        observedAt: z.string(),
        meanTemperatureC: decimalNumberSchema.nullable(),
        precipitationMm: decimalNumberSchema.nullable(),
        soilMoisturePercent: decimalNumberSchema.nullable(),
        weatherCode: decimalNumberSchema.nullish().transform((value) => value ?? null),
        windSpeedKph: decimalNumberSchema.nullish().transform((value) => value ?? null),
        windDirectionDegrees: decimalNumberSchema
          .nullish()
          .transform((value) => value ?? null),
        cloudCoverPercent: decimalNumberSchema
          .nullish()
          .transform((value) => value ?? null),
        observationPrecision: z
          .enum(["PREFECTURE", "COUNTY", "TOWNSHIP", "INHERITED_TOWNSHIP"])
          .default("PREFECTURE"),
        risk: z.string(),
        assessment: z.string(),
        sourceName: z.string(),
        sourceUrl: z.string(),
        fetchedAt: z.string(),
      }),
    ),
    publicEvents: z.array(
      z.object({
        eventId: z.string(),
        title: z.string(),
        description: z.string().nullable(),
        categoryCode: z.string(),
        categoryLabel: z.string(),
        longitude: decimalNumberSchema,
        latitude: decimalNumberSchema,
        observedAt: z.string(),
        magnitudeValue: decimalNumberSchema.nullable(),
        magnitudeUnit: z.string().nullable(),
        eventUrl: z.string(),
        evidenceUrl: z.string().nullable(),
        fetchedAt: z.string(),
      }),
    ),
    policyEvents: z
      .array(
        z.object({
          sourceId: z.string(),
          rootRegionCode: z.string(),
          title: z.string(),
          summary: z.string(),
          publishedOn: z.string().nullable(),
          sourceName: z.string(),
          sourceUrl: z.string(),
          verifiedAt: z.string().nullable(),
        }),
      )
      .default([]),
    logisticsFlows: z
      .array(
        z.object({
          eventId: z.string(),
          productCode: z.string(),
          direction: z.string(),
          originRegionCode: z.string(),
          originRegionName: z.string(),
          originLongitude: decimalNumberSchema,
          originLatitude: decimalNumberSchema,
          destinationRegionCode: z.string(),
          destinationRegionName: z.string(),
          destinationLongitude: decimalNumberSchema,
          destinationLatitude: decimalNumberSchema,
          volumeTonnes: decimalNumberSchema.nullable(),
          occurredAt: z.string(),
          transportMode: z.string(),
        }),
      )
      .default([]),
    inventories: z
      .array(
        z.object({
          regionCode: z.string(),
          regionName: z.string(),
          productCode: z.string(),
          longitude: decimalNumberSchema,
          latitude: decimalNumberSchema,
          inventoryTonnes: decimalNumberSchema,
          sourceCount: z.number().int().nonnegative(),
          observedAt: z.string(),
        }),
      )
      .default([]),
    sources: z.array(
      z.object({
        code: z.string(),
        label: z.string(),
        status: z.enum(["READY", "STALE", "UNAVAILABLE"]),
        lastAttemptAt: z.string().nullable(),
        lastSuccessAt: z.string().nullable(),
        sourceUrl: z.string(),
        notice: z.string(),
      }),
    ),
  }),
});

export class HttpOverviewRegionalDataRepository implements OverviewRegionalDataRepository {
  constructor(private readonly http: HttpClient) {}

  async agricultureProfile(query: OverviewRegionalDataQuery) {
    return (
      await this.http.get(
        `/api/v1/overview/regional-agriculture-profile${queryString({
          regionCode: query.regionCode,
          year: query.year,
        })}`,
        regionalAgricultureProfileSchema,
      )
    ).data;
  }

  async regionalSummary(query: OverviewRegionalDataQuery) {
    return (
      await this.http.get(
        `/api/v1/overview/regional-crop-summary${queryString({
          regionCode: query.regionCode,
          year: query.year,
          productCode: query.productCode,
        })}`,
        regionalSummarySchema,
      )
    ).data;
  }

  async supplyBalance(query: OverviewRegionalDataQuery) {
    return (
      await this.http.get(
        `/api/v1/supply-balances${queryString({
          regionCode: query.regionCode,
          surveyYear: query.year,
          productCode: query.productCode,
        })}`,
        supplyBalanceSchema,
      )
    ).data;
  }

  async operationalFacilities(
    query: { regionCode?: string; productCode?: string; asOf: string },
    signal?: AbortSignal,
  ) {
    return (
      await this.http.get(
        `/api/v1/overview/operational-facilities${queryString(query)}`,
        operationalFacilityCatalogueSchema,
        { ...(signal ? { signal } : {}), timeoutMs: 60_000 },
      )
    ).data;
  }

  async createOperationalFacility(draft: StorageFacilityDraft) {
    if (!this.http.post) throw new Error("当前连接不支持库点填报");
    return (
      await this.http.post(
        "/api/v1/overview/operational-facilities",
        draft,
        z.object({ data: storageFacilitySchema }),
      )
    ).data;
  }

  async updateOperationalFacility(facilityCode: string, draft: StorageFacilityDraft) {
    if (!this.http.put) throw new Error("当前连接不支持库点更新");
    return (
      await this.http.put(
        `/api/v1/overview/operational-facilities/${encodeURIComponent(facilityCode)}`,
        draft,
        z.object({ data: storageFacilitySchema }),
      )
    ).data;
  }

  async archiveOperationalFacility(facilityCode: string, expectedVersion: number) {
    if (!this.http.delete) throw new Error("当前连接不支持库点归档");
    await this.http.delete(
      `/api/v1/overview/operational-facilities/${encodeURIComponent(facilityCode)}${queryString({ expectedVersion })}`,
      z.object({ data: z.boolean() }),
    );
  }

  async operationalSituation(
    query?: { regionCode?: string; productCode?: string; surveyYear?: number },
    signal?: AbortSignal,
  ) {
    return (
      await this.http.get(
        `/api/v1/overview/operational-situation${queryString(query ?? {})}`,
        operationalSituationSchema,
        signal ? { signal } : undefined,
      )
    ).data;
  }
}
