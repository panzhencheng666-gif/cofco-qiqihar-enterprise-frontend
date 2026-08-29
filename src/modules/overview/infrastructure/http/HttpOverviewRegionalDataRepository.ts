import { z } from "zod";

import type {
  OverviewRegionalDataQuery,
  OverviewRegionalDataRepository,
} from "../../application/ports/OverviewRegionalDataRepository";
import type { HttpClient } from "../../../../shared/api/HttpClient";
import { queryString } from "../../../../shared/api/HttpClient";

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
