import { z } from "zod";

import {
  HttpError,
  type HttpClient,
  queryString,
} from "../../../../shared/api/HttpClient";
import {
  MarketRepositoryFailure,
  type MarketCollectionRepository,
  type MarketRepositoryFailureKind,
} from "../../application/ports/MarketCollectionRepository";
import type {
  MarketCollectionCriteria,
  MarketDraft,
} from "../../domain/marketCollection";

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
const detailRecordSchema = z.object({
  id: z.string(),
  productCode: z.string(),
  objectTypeCode: z.string(),
  regionCode: z.string(),
  tradeDate: z.string(),
  reportedAt: z.string(),
  direction: z.string(),
  purchaseBasePrice: z.string().nullable(),
  saleBasePrice: z.string().nullable(),
  carriageBoardAmount: z.string(),
  packagingAmount: z.string(),
  freightAmount: z.string(),
  packagingForm: z.string().nullable(),
  actualTradePrice: z.string(),
  status: z.string(),
  returnReason: z.string().nullable(),
  facts: z.record(z.string(), z.string()),
  allowedActions: z.array(z.string()),
  version: z.number().int().nonnegative(),
});
const detailSchema = z.object({ data: detailRecordSchema });
const optionSchema = z.object({
  value: z.string(),
  label: z.string(),
  sortOrder: z.number().int(),
});
const definitionSchema = z.object({
  data: z.object({
    productCode: z.string(),
    objectTypeCode: z.string().nullable(),
    coreFields: z.array(
      z.object({
        code: z.string(),
        label: z.string(),
        controlType: z.string(),
        unit: z.string().nullable(),
        precision: z.number().int().positive().nullable(),
        scale: z.number().int().nonnegative().nullable(),
        sortOrder: z.number().int(),
        options: z.array(optionSchema),
      }),
    ),
    groups: z.array(
      z.object({
        category: z.string().min(1),
        label: z.string().min(1),
        sortOrder: z.number().int(),
        fields: z.array(
          z.object({
            code: z.string(),
            label: z.string(),
            valueType: z.string(),
            unit: z.string().nullable(),
            description: z.string().nullable(),
            precision: z.number().int().positive(),
            scale: z.number().int().nonnegative(),
            sortOrder: z.number().int(),
          }),
        ),
      }),
    ),
  }),
});

export class HttpMarketCollectionRepository implements MarketCollectionRepository {
  constructor(private readonly http: HttpClient) {}

  async search(criteria: MarketCollectionCriteria) {
    const filters = Object.fromEntries(
      Object.entries(criteria.values).map(([key, value]) => [`filter.${key}`, value]),
    );
    return (
      await repositoryRequest(() =>
        this.http.get(
          `/api/v1/market-records${queryString({
            productCode: criteria.productCode,
            pageKind: criteria.pageKind,
            pageNumber: criteria.pageNumber,
            pageSize: criteria.pageSize,
            ...filters,
          })}`,
          pageSchema,
        ),
      )
    ).data;
  }

  async detail(id: string) {
    return (
      await repositoryRequest(() =>
        this.http.get(`/api/v1/market-records/${id}`, detailSchema),
      )
    ).data;
  }

  async definition(productCode: string, objectTypeCode?: string) {
    return (
      await repositoryRequest(() =>
        this.http.get(
          `/api/v1/market-record-definitions${queryString({ productCode, objectTypeCode })}`,
          definitionSchema,
        ),
      )
    ).data;
  }

  async create(draft: MarketDraft) {
    return (await this.write("post", "/api/v1/market-records", draft)).data;
  }

  async saveDraft(id: string, version: number, draft: MarketDraft) {
    return (
      await this.write("put", `/api/v1/market-records/${id}`, { ...draft, version })
    ).data;
  }

  async submit(id: string, version: number) {
    return (
      await this.write("post", `/api/v1/market-records/${id}/submit`, { version })
    ).data;
  }

  async approve(id: string, version: number) {
    return (
      await this.write("post", `/api/v1/market-records/${id}/approve`, { version })
    ).data;
  }

  async returnForCorrection(id: string, version: number, reason: string) {
    return (
      await this.write("post", `/api/v1/market-records/${id}/return`, {
        version,
        reason,
      })
    ).data;
  }

  private write(method: "post" | "put", path: string, body: unknown) {
    return repositoryRequest(() => {
      if (method === "post") {
        if (!this.http.post) throw new Error("HTTP client does not support writes");
        return this.http.post(path, body, detailSchema);
      }
      if (!this.http.put) throw new Error("HTTP client does not support writes");
      return this.http.put(path, body, detailSchema);
    });
  }
}

async function repositoryRequest<T>(request: () => Promise<T>): Promise<T> {
  try {
    return await request();
  } catch (failure) {
    if (failure instanceof MarketRepositoryFailure) throw failure;
    throw new MarketRepositoryFailure(failureKind(failure), failure);
  }
}

function failureKind(failure: unknown): MarketRepositoryFailureKind {
  if (!(failure instanceof HttpError)) return "UNEXPECTED";
  if (failure.status === 400) return "VALIDATION";
  if (failure.status === 401) return "AUTHENTICATION";
  if (failure.status === 409) return "CONFLICT";
  return "UNEXPECTED";
}
