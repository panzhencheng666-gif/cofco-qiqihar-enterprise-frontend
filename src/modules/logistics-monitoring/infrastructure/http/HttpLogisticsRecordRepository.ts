import { z } from "zod";

import type { HttpClient } from "../../../../shared/api/HttpClient";
import { queryString } from "../../../../shared/api/HttpClient";
import type { LogisticsRecordRepository } from "../../application/ports/LogisticsRecordRepository";
import type {
  LogisticsDraft,
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

export class HttpLogisticsRecordRepository implements LogisticsRecordRepository {
  constructor(private readonly http: HttpClient) {}

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
