import { z } from "zod";

import type {
  OverviewRegionQuery,
  OverviewRepository,
} from "../../application/ports/OverviewRepository";
import type { HttpClient } from "../../../../shared/api/HttpClient";
import { queryString } from "../../../../shared/api/HttpClient";

export const OVERVIEW_AUDIT_CONTRACT_VERSION = "overview-audit-v2";

const optionSchema = z.object({ code: z.string(), label: z.string() });
const optionsSchema = z.object({
  data: z.object({
    products: z.array(optionSchema),
    periods: z.array(optionSchema.extend({ startsOn: z.string(), endsOn: z.string() })),
    years: z.array(z.number().int()),
  }),
});
const mapScopeSchema = z.object({
  data: z.object({
    scopeCode: z.string(),
    name: z.string(),
    boundaryGeoJson: z.string(),
    sourceName: z.string(),
    sourceRevision: z.string(),
    sourceLicense: z.string(),
    componentGeometryFingerprint: z.string(),
    refreshedAt: z.string(),
  }),
});
const regionSchema = z.object({
  code: z.string(),
  name: z.string(),
  parentCode: z.string().nullable().optional(),
  level: z.enum(["PREFECTURE", "COUNTY", "TOWNSHIP", "VILLAGE"]),
  approvedRecordCount: z.number(),
  boundaryGeoJson: z.string().nullable().optional(),
  locationGeoJson: z.string().nullable().optional(),
  locationReviewStatus: z.string().nullable().optional(),
  mapContextOnly: z.boolean().optional().default(false),
});
const regionsSchema = z.object({ data: z.array(regionSchema) });
const indicatorsSchema = z
  .object({
    contractVersion: z.literal(OVERVIEW_AUDIT_CONTRACT_VERSION),
    data: z.array(
      z.object({
        code: z.string(),
        name: z.string(),
        unitCode: z.string(),
        value: z.string().nullable(),
        sourceDomain: z.enum(["PRODUCTION", "MARKET", "LOGISTICS"]),
        sourceCount: z.number(),
        sourcePath: z.string(),
        formula: z.string(),
        sourceRelation: z.string(),
        dataCutoff: z.string().nullable(),
        coverageScope: z.string(),
        coverageStatus: z.enum(["AVAILABLE", "PARTIAL", "NO_APPROVED_SOURCES"]),
        calculationVersion: z.string(),
      }),
    ),
  })
  .describe(OVERVIEW_AUDIT_CONTRACT_VERSION);
const dashboardSummarySchema = z
  .object({
    contractVersion: z.literal(OVERVIEW_AUDIT_CONTRACT_VERSION),
    data: z.object({
      scope: z.object({
        prefectureCount: z.number(),
        countyCount: z.number(),
        townshipCount: z.number(),
        villageCount: z.number(),
      }),
      metrics: z.array(
        z.object({
          code: z.string(),
          name: z.string(),
          unitCode: z.string(),
          value: z.string().nullable(),
          sourceCount: z.number(),
          dataCutoff: z.string().nullable(),
          coverageStatus: z.enum([
            "AVAILABLE",
            "PARTIAL",
            "NO_APPROVED_SOURCES",
            "INSUFFICIENT_COVERAGE",
            "CUTOFF_MISMATCH",
            "UNRELIABLE_SOURCE_CONTRACT",
            "MUTUAL_EXCLUSIVITY_VIOLATION",
          ]),
          calculationVersion: z.string(),
          formula: z.string(),
          sourcePath: z.string(),
          sourceRelation: z.string(),
          coverageScope: z.string(),
        }),
      ),
    }),
  })
  .describe(OVERVIEW_AUDIT_CONTRACT_VERSION);

const GEOGRAPHY_CACHE_TTL_MS = 5 * 60 * 1000;
const BUSINESS_CACHE_TTL_MS = 5 * 1000;

interface CacheEntry<T> {
  expiresAt: number;
  promise: Promise<T>;
}

export class HttpOverviewRepository implements OverviewRepository {
  private readonly cache = new Map<string, CacheEntry<unknown>>();

  constructor(private readonly http: HttpClient) {}

  invalidateBusinessData() {
    this.invalidateGeographyData();
    for (const key of this.cache.keys()) {
      if (
        key.startsWith("/api/v1/overview/dashboard") ||
        key.startsWith("/api/v1/overview/indicators") ||
        key === "options"
      ) {
        this.cache.delete(key);
      }
    }
  }

  invalidateGeographyData() {
    for (const key of this.cache.keys()) {
      if (
        key.startsWith("/api/v1/overview/regions") ||
        key.startsWith("/api/v1/overview/locations")
      ) {
        this.cache.delete(key);
      }
    }
  }

  async options() {
    return this.cached(
      "options",
      GEOGRAPHY_CACHE_TTL_MS,
      async () => (await this.http.get("/api/v1/overview/options", optionsSchema)).data,
    );
  }

  async mapScope() {
    return this.cached(
      "map-scope",
      GEOGRAPHY_CACHE_TTL_MS,
      async () =>
        (await this.http.get("/api/v1/overview/map-scope", mapScopeSchema)).data,
    );
  }

  async regions(query: OverviewRegionQuery) {
    const path = `/api/v1/overview/regions${queryString(query)}`;
    return this.cached(path, GEOGRAPHY_CACHE_TTL_MS, async () =>
      (await this.http.get(path, regionsSchema)).data.map(toOverviewRegion),
    );
  }

  async locations(query: {
    ancestorCode?: string;
    level: "TOWNSHIP" | "VILLAGE";
    productCode: string;
    year: number;
  }) {
    const path = `/api/v1/overview/locations${queryString(query)}`;
    return this.cached(path, GEOGRAPHY_CACHE_TTL_MS, async () =>
      (await this.http.get(path, regionsSchema)).data.map(toOverviewRegion),
    );
  }

  async indicators(query: { productCode: string; regionCode: string; year: number }) {
    const path = `/api/v1/overview/indicators${queryString(query)}`;
    return this.cached(
      path,
      BUSINESS_CACHE_TTL_MS,
      async () => (await this.http.get(path, indicatorsSchema)).data,
    );
  }

  async dashboard(query: { productCode: string; regionCode?: string; year: number }) {
    const path = `/api/v1/overview/dashboard-summary${queryString(query)}`;
    return this.cached(path, BUSINESS_CACHE_TTL_MS, async () => {
      return (await this.http.get(path, dashboardSummarySchema)).data;
    });
  }

  private cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
    const cached = this.cache.get(key) as CacheEntry<T> | undefined;
    if (cached && cached.expiresAt > Date.now()) return cached.promise;

    const promise = load().catch((error: unknown) => {
      const current = this.cache.get(key);
      if (current?.promise === promise) this.cache.delete(key);
      throw error;
    });
    this.cache.set(key, { expiresAt: Date.now() + ttlMs, promise });
    return promise;
  }
}

function toOverviewRegion({
  parentCode,
  boundaryGeoJson,
  locationGeoJson,
  locationReviewStatus,
  ...region
}: z.infer<typeof regionSchema>) {
  return {
    ...region,
    ...(parentCode ? { parentCode } : {}),
    ...(boundaryGeoJson ? { boundaryGeoJson } : {}),
    ...(locationGeoJson ? { locationGeoJson } : {}),
    ...(locationReviewStatus ? { locationReviewStatus } : {}),
  };
}
