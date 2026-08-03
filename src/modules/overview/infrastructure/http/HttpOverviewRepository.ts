import { z } from "zod";

import type { OverviewRepository } from "../../application/ports/OverviewRepository";
import type { HttpClient } from "../../../../shared/api/HttpClient";
import { queryString } from "../../../../shared/api/HttpClient";

const optionSchema = z.object({ code: z.string(), label: z.string() });
const optionsSchema = z.object({
  data: z.object({
    products: z.array(optionSchema),
    periods: z.array(optionSchema.extend({ startsOn: z.string(), endsOn: z.string() })),
  }),
});
const regionSchema = z.object({
  code: z.string(),
  name: z.string(),
  parentCode: z.string().nullable().optional(),
  level: z.enum(["PREFECTURE", "COUNTY", "TOWNSHIP", "VILLAGE"]),
  approvedRecordCount: z.number(),
  boundaryGeoJson: z.string().nullable().optional(),
});
const regionsSchema = z.object({ data: z.array(regionSchema) });
const indicatorsSchema = z.object({
  data: z.array(
    z.object({
      code: z.string(),
      name: z.string(),
      unitCode: z.string(),
      value: z.string(),
      sourceDomain: z.enum(["PRODUCTION", "MARKET", "LOGISTICS", "SUPPLY"]),
      sourceCount: z.number(),
      sourcePath: z.string(),
    }),
  ),
});

export class HttpOverviewRepository implements OverviewRepository {
  constructor(private readonly http: HttpClient) {}

  async options() {
    return (await this.http.get("/api/v1/overview/options", optionsSchema)).data;
  }

  async regions(query: {
    parentCode?: string;
    productCode: string;
    periodCode: string;
  }) {
    return (
      await this.http.get(
        `/api/v1/overview/regions${queryString(query)}`,
        regionsSchema,
      )
    ).data.map(({ parentCode, boundaryGeoJson, ...region }) => ({
      ...region,
      ...(parentCode ? { parentCode } : {}),
      ...(boundaryGeoJson ? { boundaryGeoJson } : {}),
    }));
  }

  async indicators(query: {
    productCode: string;
    regionCode: string;
    periodCode: string;
    marketingYear?: string;
  }) {
    return (
      await this.http.get(
        `/api/v1/overview/indicators${queryString(query)}`,
        indicatorsSchema,
      )
    ).data;
  }
}
