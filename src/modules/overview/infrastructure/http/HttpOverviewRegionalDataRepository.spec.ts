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
      )
      .mockImplementationOnce((_path: string, schema: ZodType) =>
        Promise.resolve(
          schema.parse({
            data: {
              regionCode: "230200",
              regionName: "齐齐哈尔市",
              administrativeLevel: "PREFECTURE",
              year: 2026,
              automatic: true,
              generatedAt: "2026-09-14T10:00:00Z",
              sourceSummary: "地区年度正式数据优先，缺项由统计模型自动补齐",
              calculationMethod: "结构系数估算；复合增长公式预测",
              weather: {
                meanTemperatureC: 15.8,
                precipitationMm: 0,
                soilMoisturePercent: 30.5,
                risk: "常规",
                assessment: "墒情正常",
                observedAt: "2026-09-14T11:00:00Z",
                sourceId: "weather-qqhr",
              },
              crops: [
                {
                  productCode: "CORN",
                  productName: "玉米",
                  dataKind: "OBSERVED",
                  plantedAreaMu: "17844200.0000",
                  yieldPerMuKg: "650.0000",
                  totalOutputKg: "11598730000.0000",
                  structurePercent: "62.0000",
                  basis: "采用地区年度正式数据自动汇总",
                  forecasts: [
                    {
                      year: 2027,
                      plantedAreaMu: "18058330.4000",
                      yieldPerMuKg: "655.2000",
                      totalOutputKg: "11830738180.8000",
                    },
                  ],
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
    const profile = await repository.agricultureProfile({
      regionCode: "230200",
      year: 2026,
      productCode: "CORN",
    });

    expect(get.mock.calls[0]?.[0]).toContain("/api/v1/overview/regional-crop-summary?");
    expect(get.mock.calls[1]?.[0]).toContain("/api/v1/supply-balances?");
    expect(get.mock.calls[2]?.[0]).toContain(
      "/api/v1/overview/regional-agriculture-profile?",
    );
    expect(summary.comparisonMessage).toBeNull();
    expect(balance.rows[0]?.display).toBeNull();
    expect(profile.crops[0]?.forecasts[0]?.year).toBe(2027);
    expect(profile.weather?.meanTemperatureC).toBe("15.8");
  });
});
