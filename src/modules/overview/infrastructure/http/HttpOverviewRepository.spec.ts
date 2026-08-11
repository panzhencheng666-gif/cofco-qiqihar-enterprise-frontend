import type { z } from "zod";
import { describe, expect, it, vi } from "vitest";

import type { HttpClient } from "../../../../shared/api/HttpClient";
import { HttpOverviewRepository } from "./HttpOverviewRepository";

describe("HttpOverviewRepository request cache", () => {
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
    const query = { productCode: "CORN" };

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
      repository.locations({ level: "TOWNSHIP", productCode: "CORN" }),
    ).rejects.toThrow("temporary");
    await expect(
      repository.locations({ level: "TOWNSHIP", productCode: "CORN" }),
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
      periodCode: "2026-Q3",
      regionCode: "230200",
    });
    await repository.dashboard({
      productCode: "CORN",
      periodCode: "2026-Q3",
      regionCode: "230281",
    });

    expect(get.mock.calls.map(([path]) => path)).toEqual([
      "/api/v1/overview/dashboard?productCode=CORN&periodCode=2026-Q3&regionCode=230200",
      "/api/v1/overview/dashboard?productCode=CORN&periodCode=2026-Q3&regionCode=230281",
    ]);
  });
});
