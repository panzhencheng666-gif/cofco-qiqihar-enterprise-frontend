import { z } from "zod";

import type { HttpClient } from "../../../../shared/api/HttpClient";
import { queryString } from "../../../../shared/api/HttpClient";
import type { ProductionRecordRepository } from "../../application/ports/ProductionRecordRepository";
import type { ProductionRecordCriteria } from "../../domain/productionRecord";

const recordSchema = z.object({
  id: z.string(),
  productCode: z.string(),
  objectTypeCode: z.string(),
  regionCode: z.string(),
  cultivarCode: z.string().nullable(),
  surveyDate: z.string(),
  reportedAt: z.string(),
  cultivatedAreaMu: z.number(),
  yieldPerMuKilograms: z.number(),
  estimatedOutputKilograms: z.number(),
  status: z.string(),
  returnReason: z.string().nullable(),
  quality: z.record(z.string(), z.number()),
});
const pageSchema = z.object({
  data: z.object({
    items: z.array(recordSchema),
    pageNumber: z.number().int().nonnegative(),
    pageSize: z.number().int().positive(),
    totalElements: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
  }),
});

export class HttpProductionRecordRepository implements ProductionRecordRepository {
  constructor(private readonly http: HttpClient) {}

  async search(criteria: ProductionRecordCriteria) {
    const filters = Object.fromEntries(
      Object.entries(criteria.values).map(([key, value]) => [`filter.${key}`, value]),
    );
    const response = await this.http.get(
      `/api/v1/production-records${queryString({
        productCode: criteria.productCode,
        pageKind: criteria.pageKind,
        pageNumber: criteria.pageNumber,
        pageSize: criteria.pageSize,
        ...filters,
      })}`,
      pageSchema,
    );
    return {
      ...response.data,
      items: response.data.items.map((record) => ({
        id: record.id,
        values: {
          PROD_REGION: record.regionCode,
          PROD_OBJECT_TYPE: record.objectTypeCode,
          PROD_SURVEY_DATE: record.surveyDate,
          PROD_REPORTED_AT: record.reportedAt,
          PROD_CULTIVAR: record.cultivarCode,
          PROD_AREA_MU: record.cultivatedAreaMu,
          PROD_YIELD_PER_MU: record.yieldPerMuKilograms,
          PROD_ESTIMATED_OUTPUT: record.estimatedOutputKilograms,
          PROD_STATUS: record.status,
        },
      })),
    };
  }
}
