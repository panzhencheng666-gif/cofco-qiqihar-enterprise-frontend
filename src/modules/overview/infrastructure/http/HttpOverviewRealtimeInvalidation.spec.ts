import { describe, expect, it, vi } from "vitest";

import type { HttpClient } from "../../../../shared/api/HttpClient";
import { HttpOverviewRepository } from "./HttpOverviewRepository";

describe("HttpOverviewRepository realtime invalidation", () => {
  it("evicts business reads while retaining the same formal query contract", async () => {
    const get = vi.fn<HttpClient["get"]>((_path, schema) =>
      Promise.resolve(schema.parse({ data: [] })),
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
});
