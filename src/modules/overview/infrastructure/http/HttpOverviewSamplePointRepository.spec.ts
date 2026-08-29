import { describe, expect, it, vi } from "vitest";

import type { HttpClient } from "../../../../shared/api/HttpClient";
import { HttpOverviewSamplePointRepository } from "./HttpOverviewSamplePointRepository";

describe("HttpOverviewSamplePointRepository", () => {
  it("downloads the formal sample inventory for duplicate comparison", async () => {
    const download = vi.fn().mockResolvedValue({
      filename: "正式样本点清单-2026.csv",
      contentType: "text/csv",
      content: new Blob(["正式样本"]),
    });
    const repository = new HttpOverviewSamplePointRepository({
      download,
    } as unknown as HttpClient);

    await repository.exportInventory({ year: 2026, regionCode: "230200" });

    expect(download).toHaveBeenCalledWith(
      "/api/v1/overview/sample-points/export?year=2026&regionCode=230200",
    );
  });

  it("loads the map icons and right-panel list from one backend snapshot", async () => {
    const get = respondingWith({
      list: {
        regionCode: "230202",
        totalCount: 0,
        validCoordinateCount: 0,
        dataQualityIssueCount: 0,
        correctionSourceCount: 0,
        unresolvedSourceCount: 0,
        categories: [],
        items: [],
        correctionSources: [],
      },
      icons: [],
    });

    const result = await repositoryWith(get).snapshot({
      productCode: "CORN",
      regionCode: "230202",
      year: 2026,
    });

    expect(get).toHaveBeenCalledWith(
      "/api/v1/overview/sample-point-snapshot?productCode=CORN&regionCode=230202&year=2026",
      expect.anything(),
    );
    expect(result.list.totalCount).toBe(0);
    expect(result.icons).toEqual([]);
  });

  it("keeps stable role icons separate from product-scoped object types", async () => {
    const get = respondingWith([
      {
        samplePointId: "94000000-0000-0000-0000-000000000001",
        name: "跨品种复合样本点",
        regionCode: "230202997001",
        iconKey: "production",
        roles: [
          { code: "PRODUCTION", name: "产情类", iconKey: "production" },
          { code: "MARKET", name: "市场类", iconKey: "market" },
        ],
        types: [
          { code: "FARMER", name: "农户", iconKey: "farmer" },
          { code: "RICE_MILL", name: "米厂", iconKey: "rice-mill" },
        ],
        longitude: 123.9,
        latitude: 47.3,
        dataQualityReason: null,
      },
      {
        samplePointId: "94000000-0000-0000-0000-000000000002",
        name: "物流样本点",
        regionCode: "230202997002",
        iconKey: "logistics",
        roles: [{ code: "LOGISTICS", name: "物流类", iconKey: "logistics" }],
        types: [],
        longitude: 123.8,
        latitude: 47.2,
        dataQualityReason: null,
      },
    ]);
    const repository = repositoryWith(get);

    const result = await repository.icons({
      productCode: "RICE",
      regionCode: "230202",
      year: 2026,
    });

    expect(get.mock.calls[0]?.[0]).toBe(
      "/api/v1/overview/sample-point-icons?productCode=RICE&regionCode=230202&year=2026",
    );
    expect(result[0]?.roles?.map(({ code }) => code)).toEqual(["PRODUCTION", "MARKET"]);
    expect(result[1]?.roles?.[0]?.code).toBe("LOGISTICS");
    expect(result.map(({ regionCode }) => regionCode)).toEqual([
      "230202997001",
      "230202997002",
    ]);
    expect(result[1]?.types).toEqual([]);
  });

  it("reads product-scoped distinct aggregate counts", async () => {
    const get = respondingWith([
      {
        regionCode: "230202997001",
        regionName: "契约测试村",
        regionLevel: "VILLAGE",
        scopeKind: "CHILD_REGION",
        anchorRegionCode: "230202997001",
        samplePointCount: 2,
        productionCount: 2,
        marketCount: 1,
        logisticsCount: 0,
        validCoordinateCount: 2,
        dataQualityIssueCount: 1,
        correctionSourceCount: 0,
        unresolvedSourceCount: 1,
      },
    ]);
    const repository = repositoryWith(get);

    const result = await (
      repository.aggregates as unknown as (
        query: unknown,
      ) => Promise<readonly unknown[]>
    )({
      parentCode: "230202997",
      productCode: "CORN",
      year: 2026,
    });

    expect(get).toHaveBeenCalledWith(
      "/api/v1/overview/sample-point-aggregates?year=2026&productCode=CORN&parentCode=230202997",
      expect.anything(),
    );
    expect(result[0]).toEqual({
      regionCode: "230202997001",
      regionName: "契约测试村",
      regionLevel: "VILLAGE",
      scopeKind: "CHILD_REGION",
      anchorRegionCode: "230202997001",
      samplePointCount: 2,
      productionCount: 2,
      marketCount: 1,
      logisticsCount: 0,
      validCoordinateCount: 2,
      dataQualityIssueCount: 1,
      correctionSourceCount: 0,
      unresolvedSourceCount: 1,
    });
    expect(result[0]).not.toHaveProperty("longitude");
  });

  it("rejects aggregate totals outside the distinct-point bounds", async () => {
    const get = respondingWith([
      {
        regionCode: "230202997001",
        regionName: "契约测试村",
        regionLevel: "VILLAGE",
        samplePointCount: 4,
        productionCount: 2,
        marketCount: 1,
        logisticsCount: 0,
        validCoordinateCount: 2,
        dataQualityIssueCount: 1,
        correctionSourceCount: 0,
        unresolvedSourceCount: 1,
      },
    ]);

    await expect(
      repositoryWith(get).aggregates({ productCode: "CORN", year: 2026 }),
    ).rejects.toThrow();
  });

  it("reads filtered lists and exposes no point geometry", async () => {
    const get = respondingWith({
      regionCode: "230202997001",
      totalCount: 1,
      validCoordinateCount: 0,
      dataQualityIssueCount: 1,
      correctionSourceCount: 1,
      unresolvedSourceCount: 1,
      categories: [
        {
          code: "PRODUCTION",
          name: "产情类",
          count: 1,
          types: [{ code: "FARMER", name: "农户", iconKey: "farmer", count: 1 }],
        },
      ],
      items: [
        {
          samplePointId: "94000000-0000-0000-0000-000000000001",
          name: "同一跨产品样本点",
          regionCode: "230202997001",
          regionName: "契约测试村",
          locationState: "VALID",
          dataQualityReason: "MISSING_COORDINATE",
          categories: [{ code: "PRODUCTION", name: "产情类" }],
          types: [{ code: "FARMER", name: "农户", iconKey: "farmer" }],
          products: [{ code: "CORN", name: "玉米" }],
          latestBusinessDate: "2026-08-05",
          summaryValues: {
            SAMPLE_CONTACT: {
              label: "样本点联系方式",
              value: "13900000000",
              unitCode: null,
            },
          },
        },
      ],
      correctionSources: [
        {
          categoryCode: "PRODUCTION",
          sourceRecordId: "source-1",
          sourceRole: "SURVEY",
          dataQualityReason: "SUBJECT_IDENTITY_MISSING",
        },
      ],
    });
    const repository = repositoryWith(get);

    const result = await (
      repository.list as unknown as (
        query: unknown,
      ) => Promise<Awaited<ReturnType<typeof repository.list>>>
    )({
      year: 2026,
      productCode: "CORN",
      regionCode: "230202997001",
      categoryCode: "PRODUCTION",
      typeCode: "FARMER",
      query: "同一",
    });

    expect(get.mock.calls[0]?.[0]).toBe(
      "/api/v1/overview/sample-points?year=2026&productCode=CORN&regionCode=230202997001&categoryCode=PRODUCTION&typeCode=FARMER&query=%E5%90%8C%E4%B8%80",
    );
    expect(result.totalCount).toBe(1);
    expect(result.items[0]).not.toHaveProperty("longitude");
    expect(result.items[0]).not.toHaveProperty("latitude");
    expect(result.items[0]?.summaryValues.SAMPLE_CONTACT?.value).toBe("13900000000");
  });

  it("reads county-and-deeper icons through the full categorized query", async () => {
    const get = respondingWith([
      {
        samplePointId: "94000000-0000-0000-0000-000000000001",
        name: "同一跨产品样本点",
        regionCode: "230202997001",
        iconKey: "farmer",
        roles: [{ code: "PRODUCTION", name: "产情类", iconKey: "production" }],
        types: [{ code: "FARMER", name: "农户", iconKey: "farmer" }],
        longitude: 123.9,
        latitude: 47.3,
        dataQualityReason: "DUPLICATE_COORDINATE_UNVERIFIED",
      },
    ]);
    const repository = repositoryWith(get);

    const result = await (
      repository.icons as unknown as (
        query: unknown,
      ) => Promise<Awaited<ReturnType<typeof repository.icons>>>
    )({
      year: 2026,
      productCode: "CORN",
      regionCode: "230202",
      categoryCode: "PRODUCTION",
      typeCode: "FARMER",
      query: "同一",
    });

    expect(get.mock.calls[0]?.[0]).toBe(
      "/api/v1/overview/sample-point-icons?year=2026&productCode=CORN&regionCode=230202&categoryCode=PRODUCTION&typeCode=FARMER&query=%E5%90%8C%E4%B8%80",
    );
    expect(result[0]?.longitude).toBe(123.9);
    expect(result[0]?.dataQualityReason).toBe("DUPLICATE_COORDINATE_UNVERIFIED");
  });

  it("reads a stable-id detail with formal business values and no geometry", async () => {
    const get = respondingWith({
      samplePointId: "94000000-0000-0000-0000-000000000001",
      name: "同一跨产品样本点",
      regionCode: "230202997001",
      regionName: "契约测试村",
      locationState: "VALID",
      dataQualityReason: null,
      roles: [{ code: "PRODUCTION", name: "产情类", iconKey: "production" }],
      associations: [
        {
          categoryCode: "PRODUCTION",
          categoryName: "产情类",
          sourceRole: "SURVEY",
          typeCode: "FARMER",
          typeName: "农户",
          productCode: "CORN",
          productName: "玉米",
          occurrenceDate: "2026-08-05",
          sourceVersion: 0,
          businessValues: {
            SAMPLE_CONTACT: {
              label: "样本点联系方式",
              value: "13900000000",
              unitCode: null,
            },
          },
        },
      ],
    });
    const repository = repositoryWith(get);

    const result = await (
      repository.detail as unknown as (
        query: unknown,
      ) => Promise<Awaited<ReturnType<typeof repository.detail>>>
    )({
      samplePointId: "94000000-0000-0000-0000-000000000001",
      regionCode: "230202",
      year: 2026,
      productCode: "CORN",
      categoryCode: "PRODUCTION",
      typeCode: "FARMER",
    });

    expect(get.mock.calls[0]?.[0]).toBe(
      "/api/v1/overview/sample-points/94000000-0000-0000-0000-000000000001?year=2026&productCode=CORN&regionCode=230202&categoryCode=PRODUCTION&typeCode=FARMER",
    );
    expect(result.associations[0]?.businessValues.SAMPLE_CONTACT?.value).toBe(
      "13900000000",
    );
    expect(result).not.toHaveProperty("pointGeometry");
  });

  it("reads the governed annual network comparison for the exact map scope", async () => {
    const get = respondingWith({
      networkYear: 2026,
      networkStatus: "PUBLISHED",
      designPointCount: 1,
      designCoordinateCount: 1,
      activeSamplePointCount: 1,
      approvedSubmissionSamplePointCount: 1,
      pendingVerificationDesignPointCount: 1,
      multipleActualPerDesignPointCount: 0,
      anomalyCount: 0,
      exactCoveredDesignPointCount: 1,
      representedDesignPointCount: 0,
      regionalAssociationDesignPointCount: 0,
      unrelatedDesignPointCount: 0,
      actualLevelCounts: { prefecture: 0, county: 0, township: 0, village: 1 },
      designPoints: [
        {
          villageRegionCode: "230202997001",
          villageName: "契约测试村",
          townshipRegionCode: "230202997",
          townshipName: "契约测试乡",
          countyRegionCode: "230202",
          countyName: "龙沙区",
          designLongitude: 123.8,
          designLatitude: 47.2,
          coordinateSource: "旧字段坐标来源",
        },
      ],
      actualPoints: [
        {
          samplePointId: "94000000-0000-0000-0000-000000000001",
          samplePointName: "同一跨产品样本点",
          samplePointKindCode: "SURVEY_SITE",
          membershipStatusCode: "ACTIVE",
          locatedRegionCode: "230202997001",
          locatedRegionName: "契约测试村",
          locatedRegionLevel: "VILLAGE",
          actualLongitude: 123.9,
          actualLatitude: 47.3,
          locationState: "VALID",
        },
      ],
      relations: [
        {
          samplePointId: "94000000-0000-0000-0000-000000000001",
          designVillageRegionCode: "230202997001",
          relationType: "EXACT_VILLAGE",
          evidenceReference: null,
          reviewStatus: "APPROVED",
          createdBy: "system",
          createdAt: "2026-08-23T01:00:00Z",
          reviewedBy: null,
          reviewedAt: null,
        },
      ],
    });

    const result = await repositoryWith(get).comparison({
      productCode: "CORN",
      regionCode: "230202",
      year: 2026,
    });

    expect(get).toHaveBeenCalledWith(
      "/api/v1/sample-networks/2026/comparison?productCode=CORN&regionCode=230202",
      expect.anything(),
    );
    expect(result.designPointCount).toBe(1);
    expect(result.designPoints[0]?.villageRegionCode).toBe("230202997001");
    expect(result.designPoints[0]?.coordinateSourceName).toBe("旧字段坐标来源");
    expect(result.designPoints[0]).not.toHaveProperty("coordinateSource");
    expect(result.actualPoints[0]?.locatedRegionLevel).toBe("VILLAGE");
    expect(result.relations[0]?.relationType).toBe("EXACT_VILLAGE");
  });

  it("reads design coverage without recomputing current actual samples", async () => {
    const get = respondingWith({
      networkYear: 2026,
      networkStatus: "PUBLISHED",
      designPointCount: 1,
      designCoordinateCount: 1,
      pendingVerificationDesignPointCount: 0,
      designPoints: [],
      relations: [],
    });

    const result = await repositoryWith(get).designComparison({
      regionCode: "230202",
      year: 2026,
    });

    expect(get).toHaveBeenCalledWith(
      "/api/v1/sample-networks/2026/design-comparison?regionCode=230202",
      expect.anything(),
    );
    expect(result.designPointCount).toBe(1);
    expect(result).not.toHaveProperty("actualPoints");
  });
});

function respondingWith(data: unknown) {
  return vi.fn<HttpClient["get"]>((_path, schema) =>
    Promise.resolve(schema.parse({ data })),
  );
}

function repositoryWith(get: ReturnType<typeof respondingWith>) {
  return new HttpOverviewSamplePointRepository({
    get: get as unknown as HttpClient["get"],
  });
}
