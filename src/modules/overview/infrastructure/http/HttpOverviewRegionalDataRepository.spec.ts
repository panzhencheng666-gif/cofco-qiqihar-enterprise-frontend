import { describe, expect, it, vi } from "vitest";
import type { ZodType } from "zod";

import { HttpOverviewRegionalDataRepository } from "./HttpOverviewRegionalDataRepository";

describe("HttpOverviewRegionalDataRepository", () => {
  it("reads source-aware public events and weather as a cached operational picture", async () => {
    const get = vi.fn().mockImplementation((_path: string, schema: ZodType) =>
      Promise.resolve(
        schema.parse({
          data: {
            generatedAt: "2026-09-18T06:00:00Z",
            weather: [
              {
                rootRegionCode: "230200",
                regionName: "齐齐哈尔市",
                longitude: "123.92",
                latitude: "47.35",
                observedAt: "2026-09-18T05:00:00Z",
                meanTemperatureC: "18.2",
                precipitationMm: "0",
                soilMoisturePercent: "25.4",
                risk: "未触发提示阈值",
                assessment: "公开天气模型快照",
                sourceName: "Open-Meteo",
                sourceUrl: "https://open-meteo.com/",
                fetchedAt: "2026-09-18T05:01:00Z",
              },
            ],
            publicEvents: [
              {
                eventId: "EONET_1",
                title: "公开事件",
                description: null,
                categoryCode: "severeStorms",
                categoryLabel: "Severe Storms",
                longitude: "125.1",
                latitude: "47.2",
                observedAt: "2026-09-18T00:00:00Z",
                magnitudeValue: "55",
                magnitudeUnit: "kts",
                eventUrl: "https://eonet.gsfc.nasa.gov/api/v3/events/EONET_1",
                evidenceUrl: null,
                fetchedAt: "2026-09-18T05:02:00Z",
              },
            ],
            policyEvents: [
              {
                sourceId: "policy-1",
                rootRegionCode: "*",
                title: "公开政策",
                summary: "以原始公开文件为准。",
                publishedOn: "2026-09-01",
                sourceName: "公开来源",
                sourceUrl: "https://example.test/policy",
                verifiedAt: "2026-09-18T05:00:00Z",
              },
            ],
            sources: [
              {
                code: "NASA_EONET",
                label: "NASA EONET",
                status: "READY",
                lastAttemptAt: "2026-09-18T05:02:00Z",
                lastSuccessAt: "2026-09-18T05:02:00Z",
                sourceUrl: "https://eonet.gsfc.nasa.gov/api/v3/events",
                notice: "仅展示公开事件。",
              },
            ],
          },
        }),
      ),
    );
    const repository = new HttpOverviewRegionalDataRepository({ get });

    const result = await repository.operationalSituation();

    expect(get.mock.calls[0]?.[0]).toBe("/api/v1/overview/operational-situation");
    expect(result.weather[0]?.meanTemperatureC).toBe(18.2);
    expect(result.publicEvents[0]?.magnitudeValue).toBe(55);
    expect(result.policyEvents[0]?.title).toBe("公开政策");
  });

  it("requests cached live weather for the selected administrative region", async () => {
    const get = vi.fn().mockResolvedValue({
      data: { generatedAt: "2026-09-19T02:00:00Z", weather: [], publicEvents: [], policyEvents: [], sources: [] },
    });
    const repository = new HttpOverviewRegionalDataRepository({ get });

    await repository.operationalSituation("230229101");

    expect(get.mock.calls[0]?.[0]).toBe(
      "/api/v1/overview/operational-situation?regionCode=230229101",
    );
  });

  it("reads governed storage and railway facilities for the overall map", async () => {
    const get = vi.fn().mockImplementation((_path: string, schema: ZodType) =>
      Promise.resolve(
        schema.parse({
          data: {
            regionCode: null,
            productCode: "SOYBEAN",
            asOf: "2026-09-18",
            storageCategories: [{ code: "OWNED", label: "自有库点", count: 1 }],
            storageFacilities: [
              {
                code: "KESHAN_DEPOT",
                name: "中粮贸易（克山）粮食储运有限公司",
                workUnitCode: "KESHAN_DEPOT",
                relationType: "OWNED",
                relationLabel: "自有库点",
                regionCode: "230229",
                regionName: "克山县",
                address: "春风大街36号",
                longitude: "125.8476007",
                latitude: "48.0252548",
                coordinatePrecision: "STREET",
                coordinatePrecisionLabel: "公开地址街道级近似位置",
                operationalStatus: "ACTIVE",
                capacityTonnes: null,
                capacityAsOf: null,
                prices: [],
                evidence: [],
              },
            ],
            railwayFacilities: [
              {
                sourceId: "node/1",
                name: "泰来",
                kind: "STATION",
                longitude: 123.4,
                latitude: 46.4,
                operator: "",
                reference: "",
                status: "",
                service: "",
                locationRelation: "WITHIN",
                distanceKm: 0,
                nearbyLines: "平齐铁路",
                sourceUrl: "https://www.openstreetmap.org/node/1",
              },
            ],
            railwayLines: [],
            railwayRoutes: [
              {
                id: "230200:cross-region",
                name: "滨洲铁路",
                geometryGeoJson:
                  '{"type":"LineString","coordinates":[[123,47],[120,49]]}',
                usage: "main",
                operator: "",
                sourceUrl: "https://www.openstreetmap.org/way/1",
              },
            ],
            sources: [
              {
                code: "RAILWAY",
                label: "铁路站点",
                status: "READY",
                sourceAsOf: "2026-09-18T00:00:00Z",
                sourceUrl: "https://www.openstreetmap.org/copyright",
                notice: "地理参考不等于货运营业资质。",
              },
            ],
          },
        }),
      ),
    );
    const repository = new HttpOverviewRegionalDataRepository({ get });

    const result = await repository.operationalFacilities({
      productCode: "SOYBEAN",
      asOf: "2026-09-18",
    });

    expect(get.mock.calls[0]?.[0]).toBe(
      "/api/v1/overview/operational-facilities?productCode=SOYBEAN&asOf=2026-09-18",
    );
    expect(result.storageFacilities[0]?.longitude).toBe(125.8476007);
    expect(result.railwayFacilities[0]?.name).toBe("泰来");
    expect(result.railwayRoutes[0]?.name).toBe("滨洲铁路");
  });

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
              regionFacts: {
                areaSquareKilometres: 42202.36,
                directChildCount: 16,
                countyCount: 16,
                townshipCount: 232,
                villageCount: 2332,
              },
              sourceSummary: "地区年度正式数据优先，缺项由统计模型自动补齐",
              calculationMethod: "结构系数估算；复合增长公式预测",
              indicators: [
                {
                  category: "PROCESSING",
                  label: "粮食加工企业",
                  value: 191,
                  unit: "家",
                  dataYear: 2025,
                  dataKind: "OBSERVED",
                  method: "媒体公开数据",
                  sourceName: "人民网黑龙江频道",
                  sourceUrl: "https://example.test/processing",
                },
              ],
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
    expect(profile.indicators?.[0]?.value).toBe("191");
  });
});
