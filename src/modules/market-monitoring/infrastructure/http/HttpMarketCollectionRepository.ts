import { z } from "zod";

import type { HttpClient } from "../../../../shared/api/HttpClient";
import { queryString } from "../../../../shared/api/HttpClient";
import type { MarketCollectionRepository } from "../../application/ports/MarketCollectionRepository";
import type { MarketCollectionCriteria } from "../../domain/marketCollection";

const recordSchema = z.object({
  id: z.string(),
  values: z.record(z.string(), z.union([z.string(), z.number(), z.null()])),
});
const recordPageResponseSchema = z.object({
  data: z.object({
    items: z.array(recordSchema),
    pageNumber: z.number().int().nonnegative(),
    pageSize: z.number().int().positive(),
    totalElements: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
  }),
});

export class HttpMarketCollectionRepository implements MarketCollectionRepository {
  constructor(private readonly http: HttpClient) {}

  async search(criteria: MarketCollectionCriteria) {
    const filters = Object.fromEntries(
      Object.entries(criteria.values).map(([id, value]) => [`filter.${id}`, value]),
    );
    const query = queryString({
      productCode: criteria.productCode,
      pageKind: criteria.pageKind,
      pageNumber: criteria.pageNumber,
      pageSize: criteria.pageSize,
      ...filters,
    });
    return (
      await this.http.get(`/api/v1/market-records${query}`, recordPageResponseSchema)
    ).data;
  }
}
