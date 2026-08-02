import { z } from "zod";

import type { MasterDataRepository } from "../../application/ports/MasterDataRepository";
import type { HttpClient } from "../../../../shared/api/HttpClient";

const optionSchema = z.object({ id: z.string(), name: z.string() });
const optionListSchema = z.object({ data: z.array(optionSchema) });
const regionListSchema = z.object({
  data: z.array(
    optionSchema.extend({
      level: z.enum(["PREFECTURE", "COUNTY", "TOWNSHIP", "VILLAGE"]),
    }),
  ),
});
const regionHierarchyListSchema = z.object({
  data: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      level: z.enum(["PREFECTURE", "COUNTY", "TOWNSHIP", "VILLAGE"]),
    }),
  ),
});

export class HttpMasterDataRepository implements MasterDataRepository {
  constructor(private readonly http: HttpClient) {}

  async getProducts(domain: string, pageKind: string) {
    return (
      await this.http.get(
        `/api/v1/master-data/products?domain=${encodeURIComponent(domain)}&pageKind=${encodeURIComponent(pageKind)}`,
        optionListSchema,
      )
    ).data;
  }

  async getCultivars(productCode: string) {
    return (
      await this.http.get(
        `/api/v1/master-data/products/${productCode}/cultivars`,
        optionListSchema,
      )
    ).data;
  }

  async getMarketObjectTypes(productCode: string) {
    return (
      await this.http.get(
        `/api/v1/master-data/object-types?domain=MARKET&productCode=${productCode}`,
        optionListSchema,
      )
    ).data;
  }

  async getMonitoringPeriods(domain: "MARKET", productCode: string) {
    return (
      await this.http.get(
        `/api/v1/master-data/monitoring-periods?domain=${domain}&productCode=${productCode}`,
        optionListSchema,
      )
    ).data;
  }

  async getRegionRoots() {
    return (await this.http.get("/api/v1/master-data/regions", regionListSchema)).data;
  }

  async getRegionChildren(parentId?: string) {
    const path =
      parentId === undefined
        ? "/api/v1/regions"
        : `/api/v1/regions?parentCode=${encodeURIComponent(parentId)}`;
    return (await this.http.get(path, regionHierarchyListSchema)).data;
  }

  async getRegionPath(regionId: string) {
    return (
      await this.http.get(
        `/api/v1/regions/${encodeURIComponent(regionId)}/path`,
        regionHierarchyListSchema,
      )
    ).data;
  }
}
