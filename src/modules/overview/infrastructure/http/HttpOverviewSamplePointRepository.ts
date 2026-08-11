import { z } from "zod";

import type { OverviewSamplePointRepository } from "../../application/ports/OverviewSamplePointRepository";
import type { OverviewSamplePointCategoryCode } from "../../domain/overviewSamplePoint";
import type { HttpClient } from "../../../../shared/api/HttpClient";
import { queryString } from "../../../../shared/api/HttpClient";

const categoryCodeSchema = z.enum(["PRODUCTION", "MARKET", "LOGISTICS"]);
const regionLevelSchema = z.enum(["PREFECTURE", "COUNTY", "TOWNSHIP", "VILLAGE"]);
const uuidTextSchema = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
const typeRefSchema = z.object({ code: z.string(), name: z.string() });

const aggregatesSchema = z.object({
  data: z.array(
    z.object({
      regionCode: z.string(),
      regionName: z.string(),
      regionLevel: regionLevelSchema,
      samplePointCount: z.number(),
      unresolvedSourceCount: z.number(),
    }),
  ),
});

const listSchema = z.object({
  data: z.object({
    regionCode: z.string(),
    totalCount: z.number(),
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
        categories: z.array(z.object({ code: categoryCodeSchema, name: z.string() })),
        types: z.array(typeRefSchema),
        products: z.array(z.object({ code: z.string(), name: z.string() })),
      }),
    ),
  }),
});

const iconsSchema = z.object({
  data: z.array(
    z.object({
      samplePointId: uuidTextSchema,
      name: z.string(),
      types: z.array(typeRefSchema),
      longitude: z.number(),
      latitude: z.number(),
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
        businessValues: z.record(
          z.string(),
          z.object({
            label: z.string(),
            value: z.string(),
            unitCode: z.string().nullable(),
          }),
        ),
      }),
    ),
  }),
});

export class HttpOverviewSamplePointRepository implements OverviewSamplePointRepository {
  constructor(private readonly http: HttpClient) {}

  async aggregates(query: { productCode: string; parentCode?: string }) {
    const parameters = {
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
    productCode: string;
    regionCode: string;
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
    productCode: string;
    regionCode: string;
    categoryCode: OverviewSamplePointCategoryCode;
    typeCode?: string;
  }) {
    return (
      await this.http.get(
        `/api/v1/overview/sample-point-icons${queryString(query)}`,
        iconsSchema,
      )
    ).data;
  }

  async detail(samplePointId: string, regionCode: string, productCode: string) {
    return (
      await this.http.get(
        `/api/v1/overview/sample-points/${encodeURIComponent(samplePointId)}${queryString({ productCode, regionCode })}`,
        detailSchema,
      )
    ).data;
  }
}
