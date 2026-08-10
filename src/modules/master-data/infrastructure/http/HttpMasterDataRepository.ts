import { z } from "zod";

import type { MasterDataRepository } from "../../application/ports/MasterDataRepository";
import type { HttpClient } from "../../../../shared/api/HttpClient";

const wireOptionSchema = z.object({ code: z.string(), name: z.string() });
const businessPeriodListSchema = z.object({
  data: z.array(
    wireOptionSchema.extend({
      startsOn: z.string(),
      endsOn: z.string(),
      marketingYearCode: z.string(),
      marketingYearName: z.string(),
    }),
  ),
});
const supplySurveyPeriodListSchema = z.object({
  data: z.array(
    wireOptionSchema.extend({
      surveyYear: z.number().int(),
      surveyQuarter: z.enum(["Q1", "Q2", "Q3", "Q4"]).nullable(),
      precision: z.enum(["YEAR", "QUARTER"]),
      marketingYearCode: z.string(),
      marketingYearName: z.string(),
    }),
  ),
});
const optionListSchema = z.object({ data: z.array(wireOptionSchema) });
const regionRootListSchema = z.object({
  data: z.array(
    wireOptionSchema.extend({
      parentCode: z.string().nullable(),
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

  async getBusinessPeriods() {
    return (
      await this.http.get(
        "/api/v1/master-data/business-periods",
        businessPeriodListSchema,
      )
    ).data.map(({ code, name, ...period }) => ({ id: code, name, ...period }));
  }

  async getSupplySurveyPeriods() {
    return (
      await this.http.get(
        "/api/v1/master-data/supply-survey-periods",
        supplySurveyPeriodListSchema,
      )
    ).data.map(({ code, name, ...period }) => ({ id: code, name, ...period }));
  }

  async getProducts(domain?: string, pageKind?: string) {
    const applicability =
      domain === undefined && pageKind === undefined
        ? ""
        : `?domain=${encodeURIComponent(domain ?? "")}&pageKind=${encodeURIComponent(pageKind ?? "")}`;
    return (
      await this.http.get(
        `/api/v1/master-data/products${applicability}`,
        optionListSchema,
      )
    ).data.map(toMasterDataOption);
  }

  async getCultivars(productCode: string) {
    return (
      await this.http.get(
        `/api/v1/master-data/products/${productCode}/cultivars`,
        optionListSchema,
      )
    ).data.map(toMasterDataOption);
  }

  async getMarketObjectTypes(productCode: string) {
    return (
      await this.http.get(
        `/api/v1/master-data/object-types?domain=MARKET&productCode=${productCode}`,
        optionListSchema,
      )
    ).data.map(toMasterDataOption);
  }

  async getMonitoringPeriods(domain: "MARKET", productCode: string) {
    return (
      await this.http.get(
        `/api/v1/master-data/monitoring-periods?domain=${domain}&productCode=${productCode}`,
        optionListSchema,
      )
    ).data.map(toMasterDataOption);
  }

  async getRegionRoots() {
    return (
      await this.http.get("/api/v1/master-data/regions", regionRootListSchema)
    ).data.map(({ code, name, parentCode, level }) => ({
      id: code,
      name,
      parentCode,
      level,
    }));
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

function toMasterDataOption(option: z.infer<typeof wireOptionSchema>) {
  return { id: option.code, name: option.name };
}
