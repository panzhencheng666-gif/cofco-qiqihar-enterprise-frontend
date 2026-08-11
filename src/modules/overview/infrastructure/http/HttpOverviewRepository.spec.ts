import type { z } from "zod";
import { describe, expect, it, vi } from "vitest";

import type { HttpClient } from "../../../../shared/api/HttpClient";
import { HttpOverviewRepository } from "./HttpOverviewRepository";

describe("HttpOverviewRepository request cache", () => {
  it("reads audited survey years and sends the selected year to business queries", async () => {
    const get = vi.fn<HttpClient["get"]>((path, schema) => {
      if (path === "/api/v1/overview/options") {
        return Promise.resolve(
          schema.parse({
            data: {
              products: [{ code: "CORN", label: "玉米" }],
              periods: [],
              years: [2026, 2025],
            },
          }),
        );
      }
      return Promise.resolve(
        schema.parse({
          data: {
            alerts: [],
            cultivatedAreaYoY: [],
            metrics: [],
            outputYoY: [],
            priceTrend: [],
            productStructure: [],
            regionActivity: [],
            regionPath: [],
            scope: {
              approvedRecordCount: 0,
              countyCount: 0,
              reportingUnitCount: 0,
              townshipCount: 0,
              villageCount: 0,
            },
          },
        }),
      );
    });
    const repository = new HttpOverviewRepository({
      get: get as unknown as HttpClient["get"],
    });

    await expect(repository.options()).resolves.toEqual({
      products: [{ code: "CORN", label: "玉米" }],
      periods: [],
      years: [2026, 2025],
    });
    await (repository.dashboard as unknown as (query: unknown) => Promise<unknown>)({
      productCode: "CORN",
      regionCode: "230200",
      year: 2025,
    });

    expect(get.mock.calls.map(([path]) => path)).toContain(
      "/api/v1/overview/dashboard?productCode=CORN&regionCode=230200&year=2025",
    );
  });

  it("keeps rejected region-surplus audit sources with missing contract fields", async () => {
    const get = vi.fn<HttpClient["get"]>((_path, schema) =>
      Promise.resolve(
        schema.parse({
          data: {
            alerts: [],
            cultivatedAreaYoY: [],
            metrics: [
              {
                auditSources: [
                  {
                    adopted: false,
                    adoptionReason: "REQUIRED_FIELD_MISSING",
                    approvedAt: "2026-08-11T03:20:03Z",
                    cargoOwnerKey: null,
                    dataCutoff: null,
                    inventoryHolderKey: null,
                    ownershipType: null,
                    regionCode: null,
                    sourceDomain: "MARKET",
                    sourceRecordId: "record-1",
                    sourceVersion: 5,
                    subjectKey: null,
                    valueTonnes: 351,
                  },
                ],
                calculationVersion: "REGION_SURPLUS_V1",
                code: "REGION_SURPLUS",
                coverageStatus: "UNRELIABLE_SOURCE_CONTRACT",
                dataCutoff: null,
                name: "地区余粮",
                sourceCount: 0,
                unitCode: "吨",
                value: null,
              },
            ],
            outputYoY: [],
            priceTrend: [],
            productStructure: [],
            regionActivity: [],
            regionPath: [],
            scope: {
              approvedRecordCount: 0,
              countyCount: 0,
              reportingUnitCount: 0,
              townshipCount: 0,
              villageCount: 0,
            },
          },
        }),
      ),
    );
    const repository = new HttpOverviewRepository({
      get: get as unknown as HttpClient["get"],
    });

    await expect(
      repository.dashboard({ productCode: "SOYBEAN", year: 2026 }),
    ).resolves.toMatchObject({
      metrics: [
        {
          auditSources: [
            {
              cargoOwnerKey: null,
              ownershipType: null,
              regionCode: null,
              subjectKey: null,
            },
          ],
        },
      ],
    });
  });

  it("deduplicates concurrent and repeated geography requests", async () => {
    const get = vi.fn<HttpClient["get"]>((_path, schema) =>
      Promise.resolve(
        schema.parse({
          data: [
            {
              code: "230200",
              name: "齐齐哈尔市",
              level: "PREFECTURE",
              approvedRecordCount: 0,
            },
          ],
        }),
      ),
    );
    const repository = new HttpOverviewRepository({
      get: get as unknown as HttpClient["get"],
    });
    const query = { productCode: "CORN", year: 2026 };

    const [first, second] = await Promise.all([
      repository.regions(query),
      repository.regions(query),
    ]);
    const third = await repository.regions(query);

    expect(get).toHaveBeenCalledTimes(1);
    expect(second).toBe(first);
    expect(third).toBe(first);
  });

  it("evicts a failed request so a retry can recover", async () => {
    const get = vi
      .fn<HttpClient["get"]>()
      .mockRejectedValueOnce(new Error("temporary"))
      .mockImplementationOnce((_path, schema: z.ZodType) =>
        Promise.resolve(schema.parse({ data: [] })),
      );
    const repository = new HttpOverviewRepository({
      get: get as unknown as HttpClient["get"],
    });

    await expect(
      repository.locations({ level: "TOWNSHIP", productCode: "CORN", year: 2026 }),
    ).rejects.toThrow("temporary");
    await expect(
      repository.locations({ level: "TOWNSHIP", productCode: "CORN", year: 2026 }),
    ).resolves.toEqual([]);
    expect(get).toHaveBeenCalledTimes(2);
  });

  it("requests a fresh dashboard scope for every selected region", async () => {
    const get = vi.fn<HttpClient["get"]>((_path, schema) =>
      Promise.resolve(
        schema.parse({
          data: {
            alerts: [],
            cultivatedAreaYoY: [],
            metrics: [],
            outputYoY: [],
            priceTrend: [],
            productStructure: [],
            regionActivity: [],
            regionPath: [],
            scope: {
              approvedRecordCount: 0,
              countyCount: 1,
              reportingUnitCount: 0,
              townshipCount: 2,
              villageCount: 3,
            },
          },
        }),
      ),
    );
    const repository = new HttpOverviewRepository({
      get: get as unknown as HttpClient["get"],
    });

    await repository.dashboard({
      productCode: "CORN",
      regionCode: "230200",
      year: 2026,
    });
    await repository.dashboard({
      productCode: "CORN",
      regionCode: "230281",
      year: 2026,
    });

    expect(get.mock.calls.map(([path]) => path)).toEqual([
      "/api/v1/overview/dashboard?productCode=CORN&regionCode=230200&year=2026",
      "/api/v1/overview/dashboard?productCode=CORN&regionCode=230281&year=2026",
    ]);
  });
});
