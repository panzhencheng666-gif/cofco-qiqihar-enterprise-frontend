import { z } from "zod";

import type {
  OverviewRegionalDataQuery,
  OverviewRegionalDataRepository,
} from "../../application/ports/OverviewRegionalDataRepository";
import type { HttpClient } from "../../../../shared/api/HttpClient";
import { queryString } from "../../../../shared/api/HttpClient";

const decimalValueSchema = z
  .union([z.string(), z.number()])
  .transform((value) => String(value));

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
    sources: z
      .array(
        z.object({
          id: z.string(),
          type: z.enum(["AGRICULTURE", "WEATHER", "POLICY"]),
          name: z.string(),
          url: z.string(),
          publishedOn: z.string().nullable(),
          fetchedAt: z.string().nullable(),
          status: z.string(),
          evidence: z.string(),
        }),
      )
      .optional(),
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
        confidencePercent: z.string().optional(),
        uncertaintyLowKg: z.string().optional(),
        uncertaintyHighKg: z.string().optional(),
        forecasts: z.array(
          z.object({
            year: z.number().int(),
            plantedAreaMu: z.string(),
            yieldPerMuKg: z.string(),
            totalOutputKg: z.string(),
            formula: z.string().optional(),
            confidencePercent: z.string().optional(),
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

export class HttpOverviewRegionalDataRepository implements OverviewRegionalDataRepository {
  constructor(private readonly http: Pick<HttpClient, "get">) {}

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
}
