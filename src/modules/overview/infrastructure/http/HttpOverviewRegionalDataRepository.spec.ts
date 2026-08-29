import { describe, expect, it, vi } from "vitest";
import type { ZodType } from "zod";

import { HttpOverviewRegionalDataRepository } from "./HttpOverviewRegionalDataRepository";

describe("HttpOverviewRegionalDataRepository", () => {
  it("reads regional production and product-specific supply balance from independent endpoints", async () => {
    const get = vi
      .fn()
      .mockImplementationOnce((_path: string, schema: ZodType) =>
        Promise.resolve(
          schema.parse({
            data: {
              regionCode: "230200",
              regionName: "齐齐哈尔市",
              administrativeLevel: "PREFECTURE",
              year: 2026,
              productCode: "CORN",
              plantedAreaMu: "1",
              yieldPerMuKg: "2",
              totalOutputKg: "2",
              areaChangeWanMu: null,
              areaChangeRatePercent: null,
              currentDataAvailable: true,
              comparisonAvailable: false,
              areaChangeRateAvailable: false,
              comparisonMessage: null,
            },
          }),
        ),
      )
      .mockImplementationOnce((_path: string, schema: ZodType) =>
        Promise.resolve(
          schema.parse({
            data: {
              regionCode: "230200",
              regionName: "齐齐哈尔市",
              administrativeLevel: "PREFECTURE",
              surveyYear: 2026,
              productCode: "CORN",
              regionalProductionAvailable: true,
              version: 0,
              updatedAt: null,
              rows: [
                {
                  code: "OPENING_INVENTORY",
                  label: "期初库存",
                  kind: "MANUAL",
                  unit: "万吨",
                  requirement: "按本地区本年度实际口径填报",
                  value: null,
                  display: null,
                  note: null,
                },
              ],
            },
          }),
        ),
      );
    const repository = new HttpOverviewRegionalDataRepository({ get });

    const summary = await repository.regionalSummary({
      regionCode: "230200",
      year: 2026,
      productCode: "CORN",
    });
    const balance = await repository.supplyBalance({
      regionCode: "230200",
      year: 2026,
      productCode: "CORN",
    });

    expect(get.mock.calls[0]?.[0]).toContain("/api/v1/overview/regional-crop-summary?");
    expect(get.mock.calls[1]?.[0]).toContain("/api/v1/supply-balances?");
    expect(summary.comparisonMessage).toBeNull();
    expect(balance.rows[0]?.display).toBeNull();
  });
});
