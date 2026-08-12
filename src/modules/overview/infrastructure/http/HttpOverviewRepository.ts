import { z } from "zod";

import type { OverviewRepository } from "../../application/ports/OverviewRepository";
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
        sourceDomain: z.enum(["PRODUCTION", "MARKET", "LOGISTICS", "SUPPLY"]),
        sourceCount: z.number(),
        sourcePath: z.string(),
        formula: z.string(),
        sourceRelation: z.string(),
        dataCutoff: z.string().nullable(),
        coverageScope: z.string(),
        coverageStatus: z.enum(["AVAILABLE", "NO_APPROVED_SOURCES"]),
        calculationVersion: z.string(),
      }),
    ),
  })
  .describe(OVERVIEW_AUDIT_CONTRACT_VERSION);
const dashboardSchema = z
  .object({
    contractVersion: z.literal(OVERVIEW_AUDIT_CONTRACT_VERSION),
    data: z.object({
      scope: z.object({
        countyCount: z.number(),
        townshipCount: z.number(),
        villageCount: z.number(),
        reportingUnitCount: z.number(),
        approvedRecordCount: z.number(),
        latestUpdatedAt: z.string().nullable().optional(),
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
          auditSources: z.array(
            z.object({
              sourceDomain: z.enum(["PRODUCTION", "MARKET"]),
              sourceRecordId: z.string(),
              sourceVersion: z.number(),
              subjectKey: z.string().nullable(),
              inventoryHolderKey: z.string().nullable().optional(),
              cargoOwnerKey: z.string().nullable(),
              ownershipType: z
                .enum(["PRODUCTION_SURPLUS", "OWNED", "CUSTODIAL"])
                .nullable(),
              regionCode: z.string().nullable(),
              dataCutoff: z.string().nullable(),
              valueTonnes: z.number(),
              approvedAt: z.string(),
              adopted: z.boolean(),
              adoptionReason: z.string(),
            }),
          ),
        }),
      ),
      regionPath: z.array(optionSchema),
      priceTrend: z.array(
        z.object({
          periodLabel: z.string(),
          value: z.string(),
          sourceCount: z.number(),
        }),
      ),
      productStructure: z.array(
        z.object({
          productCode: z.string(),
          productName: z.string(),
          value: z.string(),
          unitCode: z.string(),
          sourceCount: z.number(),
        }),
      ),
      regionActivity: z.array(
        z.object({
          regionCode: z.string(),
          regionName: z.string(),
          approvedCount: z.number(),
          totalCount: z.number(),
        }),
      ),
      alerts: z.array(
        z.object({
          code: z.string(),
          severity: z.enum(["INFO", "WARNING", "CRITICAL"]),
          regionName: z.string(),
          message: z.string(),
          occurredOn: z.string(),
        }),
      ),
      cultivatedAreaYoY: z.array(
        z.object({
          regionCode: z.string(),
          regionName: z.string(),
          currentValue: z.string().nullable(),
          previousValue: z.string().nullable(),
          unitCode: z.string(),
          currentSourceCount: z.number(),
          previousSourceCount: z.number(),
        }),
      ),
      outputYoY: z.array(
        z.object({
          regionCode: z.string(),
          regionName: z.string(),
          currentValue: z.string().nullable(),
          previousValue: z.string().nullable(),
          unitCode: z.string(),
          currentSourceCount: z.number(),
          previousSourceCount: z.number(),
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
    for (const key of this.cache.keys()) {
      if (
        key.startsWith("/api/v1/overview/dashboard") ||
        key.startsWith("/api/v1/overview/indicators") ||
        key.startsWith("/api/v1/overview/regions") ||
        key.startsWith("/api/v1/overview/locations") ||
        key === "options"
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

  async regions(query: { parentCode?: string; productCode: string; year: number }) {
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
    const path = `/api/v1/overview/dashboard${queryString(query)}`;
    return this.cached(path, BUSINESS_CACHE_TTL_MS, async () => {
      const dashboard = (await this.http.get(path, dashboardSchema)).data;
      const { latestUpdatedAt, ...scope } = dashboard.scope;
      return {
        ...dashboard,
        metrics: dashboard.metrics.map(({ auditSources, ...metric }) => ({
          ...metric,
          auditSources: auditSources.map(({ inventoryHolderKey, ...source }) => ({
            ...source,
            ...(inventoryHolderKey ? { inventoryHolderKey } : {}),
          })),
        })),
        scope: {
          ...scope,
          ...(latestUpdatedAt ? { latestUpdatedAt } : {}),
        },
      };
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
