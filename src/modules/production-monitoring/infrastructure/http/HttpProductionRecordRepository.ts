import { z } from "zod";

import type { HttpClient } from "../../../../shared/api/HttpClient";
import { queryString } from "../../../../shared/api/HttpClient";
import type { ProductionRecordRepository } from "../../application/ports/ProductionRecordRepository";
import type {
  ProductionDraft,
  ProductionRecordCriteria,
} from "../../domain/productionRecord";

const listRecordSchema = z.object({
  id: z.string(),
  values: z.record(z.string(), z.string().nullable()),
  allowedActions: z.array(z.string()),
  version: z.number().int().nonnegative(),
});
const pageSchema = z.object({
  data: z.object({
    items: z.array(listRecordSchema),
    pageNumber: z.number().int().nonnegative(),
    pageSize: z.number().int().positive(),
    totalElements: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
  }),
});
const detailSchema = z.object({
  data: z.object({
    id: z.string(),
    productCode: z.string(),
    objectTypeCode: z.string(),
    regionCode: z.string(),
    cultivarCode: z.string().nullable(),
    surveyDate: z.string(),
    reportedAt: z.string(),
    cultivatedAreaMu: z.string(),
    yieldPerMuKilograms: z.string(),
    estimatedOutputKilograms: z.string(),
    status: z.string(),
    returnReason: z.string().nullable(),
    quality: z.record(z.string(), z.string()),
    costs: z.record(z.string(), z.string()),
    insurance: z.record(z.string(), z.string()),
    subsidies: z.record(z.string(), z.string()),
    allowedActions: z.array(z.string()),
    version: z.number().int().nonnegative(),
  }),
});
const definitionSchema = z.object({
  data: z.object({
    productCode: z.string(),
    objectTypeCode: z.string().nullable(),
    groups: z.array(
      z.object({
        category: z.enum(["QUALITY", "COST", "INSURANCE", "SUBSIDY"]),
        fields: z.array(
          z.object({
            code: z.string(),
            label: z.string(),
            valueType: z.string(),
            unit: z.string().nullable(),
            description: z.string().nullable(),
            precision: z.number().int().positive(),
            scale: z.number().int().nonnegative(),
          }),
        ),
      }),
    ),
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
    return response.data;
  }

  async detail(id: string) {
    return (await this.http.get(`/api/v1/production-records/${id}`, detailSchema)).data;
  }

  async definition(productCode: string, objectTypeCode?: string) {
    return (
      await this.http.get(
        `/api/v1/production-record-definitions${queryString({
          productCode,
          objectTypeCode,
        })}`,
        definitionSchema,
      )
    ).data;
  }

  async create(draft: ProductionDraft) {
    return (await this.writer("post", "/api/v1/production-records", draft)).data;
  }

  async saveDraft(id: string, version: number, draft: ProductionDraft) {
    return (
      await this.writer("put", `/api/v1/production-records/${id}`, {
        ...draft,
        version,
      })
    ).data;
  }

  async submit(id: string, version: number) {
    return (
      await this.writer("post", `/api/v1/production-records/${id}/submit`, { version })
    ).data;
  }

  async approve(id: string, version: number) {
    return (
      await this.writer("post", `/api/v1/production-records/${id}/approve`, { version })
    ).data;
  }

  async returnForCorrection(id: string, version: number, reason: string) {
    return (
      await this.writer("post", `/api/v1/production-records/${id}/return`, {
        version,
        reason,
      })
    ).data;
  }

  private writer(method: "post" | "put", path: string, body: unknown) {
    if (method === "post") {
      if (!this.http.post) throw new Error("HTTP client does not support writes");
      return this.http.post(path, body, detailSchema);
    }
    if (!this.http.put) throw new Error("HTTP client does not support writes");
    return this.http.put(path, body, detailSchema);
  }
}
