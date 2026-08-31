import { describe, expect, it, vi } from "vitest";

import type { HttpClient } from "../../../../shared/api/HttpClient";
import { HttpOverviewRepository } from "./HttpOverviewRepository";

describe("HttpOverviewRepository realtime invalidation", () => {
  it("evicts business reads while retaining the same formal query contract", async () => {
    const get = vi.fn<HttpClient["get"]>((_path, schema) =>
      Promise.resolve(schema.parse({ contractVersion: "overview-audit-v2", data: [] })),
    );
    const repository = new HttpOverviewRepository({
      get: get as unknown as HttpClient["get"],
    });
    const query = {
      productCode: "CORN",
      regionCode: "230200",
      year: 2026,
    };

    await repository.indicators(query);
    await repository.indicators(query);
    expect(get).toHaveBeenCalledTimes(1);

    repository.invalidateBusinessData();
    await repository.indicators(query);

    expect(get).toHaveBeenCalledTimes(2);
    expect(get.mock.calls[1]?.[0]).toBe(
      "/api/v1/overview/indicators?productCode=CORN&regionCode=230200&year=2026",
    );
  });

  it("evicts five-minute region and location reads before realtime requery", async () => {
    const get = vi.fn<HttpClient["get"]>((_path, schema) =>
      Promise.resolve(schema.parse({ data: [] })),
    );
    const repository = new HttpOverviewRepository({
      get: get as unknown as HttpClient["get"],
    });
    const regionQuery = { productCode: "CORN", year: 2026 };
    const locationQuery = {
      level: "VILLAGE" as const,
      productCode: "CORN",
      year: 2026,
    };

    await repository.regions(regionQuery);
    await repository.locations(locationQuery);
    await repository.regions(regionQuery);
    await repository.locations(locationQuery);
    expect(get).toHaveBeenCalledTimes(2);

    repository.invalidateGeographyData();
    await repository.regions(regionQuery);
    await repository.locations(locationQuery);

    expect(get.mock.calls.map(([path]) => path)).toEqual([
      "/api/v1/overview/regions?productCode=CORN&year=2026",
      "/api/v1/overview/locations?level=VILLAGE&productCode=CORN&year=2026",
      "/api/v1/overview/regions?productCode=CORN&year=2026",
      "/api/v1/overview/locations?level=VILLAGE&productCode=CORN&year=2026",
    ]);
  });
});
