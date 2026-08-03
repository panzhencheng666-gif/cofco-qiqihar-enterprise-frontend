import { z } from "zod";

import type { HttpClient } from "../../../../shared/api/HttpClient";
import { queryString } from "../../../../shared/api/HttpClient";
import type { LogisticsRecordRepository } from "../../application/ports/LogisticsRecordRepository";
import type {
  LogisticsDraft,
  LogisticsDefinition,
  LogisticsRecordCriteria,
} from "../../domain/logisticsRecord";

const recordSchema = z.object({
  id: z.string(),
  productCode: z.string(),
  values: z.record(z.string(), z.string().nullable()),
  status: z.string(),
  returnReason: z.string().nullable(),
  allowedActions: z.array(z.string()),
  version: z.number().int().nonnegative(),
});
const detailSchema = z.object({ data: recordSchema });
const pageSchema = z.object({
  data: z.object({
    items: z.array(recordSchema),
    pageNumber: z.number().int().nonnegative(),
    pageSize: z.number().int().positive(),
    totalElements: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
  }),
});
const definitionSchema = z.object({
  data: z.object({
    productCode: z.string(),
    fields: z.array(
      z.object({
        code: z.string(),
        label: z.string(),
        controlType: z.enum([
          "SELECT",
          "DATE",
          "DECIMAL",
          "TEXT",
          "READONLY_DATETIME",
          "READONLY_STATUS",
        ]),
        unit: z.string().nullable(),
        precision: z.number().int().nullable(),
        scale: z.number().int().nullable(),
        required: z.boolean(),
        readOnly: z.boolean(),
        sortOrder: z.number().int(),
        options: z.array(
          z.object({
            value: z.string(),
            label: z.string(),
            sortOrder: z.number().int(),
          }),
        ),
      }),
    ),
    actions: z.array(
      z.object({
        code: z.string(),
        label: z.string(),
        scope: z.string(),
        sortOrder: z.number().int(),
      }),
    ),
  }),
});

export class HttpLogisticsRecordRepository implements LogisticsRecordRepository {
  constructor(private readonly http: HttpClient) {}

  async definition(productCode: string): Promise<LogisticsDefinition> {
    return (
      await this.http.get(
        `/api/v1/logistics-record-definitions${queryString({ productCode })}`,
        definitionSchema,
      )
    ).data;
  }

  async search(criteria: LogisticsRecordCriteria) {
    const filters = Object.fromEntries(
      Object.entries(criteria.values).map(([key, value]) => [`filter.${key}`, value]),
    );
    return (
      await this.http.get(
        `/api/v1/logistics-records${queryString({
          productCode: criteria.productCode,
          pageNumber: criteria.pageNumber,
          pageSize: criteria.pageSize,
          ...filters,
        })}`,
        pageSchema,
      )
    ).data;
  }

  async detail(id: string) {
    return (await this.http.get(`/api/v1/logistics-records/${id}`, detailSchema)).data;
  }

  async create(draft: LogisticsDraft) {
    if (!this.http.post) throw new Error("HTTP client does not support writes");
    return (await this.http.post("/api/v1/logistics-records", draft, detailSchema))
      .data;
  }

  async saveDraft(id: string, version: number, draft: LogisticsDraft) {
    if (!this.http.put) throw new Error("HTTP client does not support writes");
    return (
      await this.http.put(
        `/api/v1/logistics-records/${id}`,
        { ...draft, version },
        detailSchema,
      )
    ).data;
  }

  async submit(id: string, version: number) {
    return this.transition(`/api/v1/logistics-records/${id}/submit`, { version });
  }

  async approve(id: string, version: number) {
    return this.transition(`/api/v1/logistics-records/${id}/approve`, { version });
  }

  async returnForCorrection(id: string, version: number, reason: string) {
    return this.transition(`/api/v1/logistics-records/${id}/return`, {
      version,
      reason,
    });
  }

  private async transition(path: string, body: unknown) {
    if (!this.http.post) throw new Error("HTTP client does not support writes");
    return (await this.http.post(path, body, detailSchema)).data;
  }
}
