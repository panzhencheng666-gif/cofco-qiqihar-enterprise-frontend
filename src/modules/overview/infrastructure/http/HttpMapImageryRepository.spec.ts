import { describe, expect, it, vi } from "vitest";

import type { HttpClient } from "../../../../shared/api/HttpClient";
import { HttpMapImageryRepository } from "./HttpMapImageryRepository";

describe("HttpMapImageryRepository", () => {
  it("loads the governed imagery metadata contract", async () => {
    const get = vi.fn((...args: [string, unknown, unknown?]) => {
      void args;
      return Promise.resolve({
        data: {
          provider: "Copernicus Sentinel-2 L2A",
          attribution: "Copernicus Sentinel data",
          updateCadence: "WEEKLY",
          imageryPeriod: "2026-W38",
          acquisitionFrom: "2026-09-18",
          acquisitionTo: "2026-09-20",
          commercialConfigured: false,
          automaticWeeklyPeriod: true,
          syncedAt: "2026-09-21T19:10:00Z",
          spatialResolutionMeters: 10,
          cloudCoveragePercent: 8.4,
          status: "CURRENT",
          sourceProductIds: ["S2B_20260920_QIQIHAR"],
          truthStatement:
            "Latest available governed weekly observation; not live video.",
        },
      });
    });
    const repository = new HttpMapImageryRepository({ get } as HttpClient);

    await expect(repository.metadata()).resolves.toMatchObject({
      imageryPeriod: "2026-W38",
      spatialResolutionMeters: 10,
      status: "CURRENT",
    });
    expect(get).toHaveBeenCalledOnce();
    expect(get).toHaveBeenCalledWith(
      "/api/v1/overview/map-imagery/metadata",
      expect.anything(),
      undefined,
    );
  });

  it("forwards the component abort signal without retrying", async () => {
    const get = vi.fn((...args: [string, unknown, unknown?]) => {
      void args;
      return Promise.reject(new DOMException("Aborted", "AbortError"));
    });
    const repository = new HttpMapImageryRepository({ get } as HttpClient);
    const controller = new AbortController();

    await expect(repository.metadata(controller.signal)).rejects.toMatchObject({
      name: "AbortError",
    });
    expect(get).toHaveBeenCalledOnce();
    expect(get.mock.calls[0]?.[2]).toEqual({ signal: controller.signal });
  });
});
