import { describe, expect, it, vi } from "vitest";

import type { HttpClient } from "../../../../shared/api/HttpClient";
import { HttpOverviewSamplePointRepository } from "./HttpOverviewSamplePointRepository";

describe("HttpOverviewSamplePointRepository", () => {
  it("reads aggregate counts without accepting a business filter", async () => {
    const get = respondingWith([
      {
        regionCode: "230202997001",
        regionName: "契约测试村",
        regionLevel: "VILLAGE",
        samplePointCount: 3,
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
      year: 2026,
    });

    expect(get).toHaveBeenCalledWith(
      "/api/v1/overview/sample-point-aggregates?year=2026&parentCode=230202997",
      expect.anything(),
    );
    expect(result[0]).toEqual({
      regionCode: "230202997001",
      regionName: "契约测试村",
      regionLevel: "VILLAGE",
      samplePointCount: 3,
      validCoordinateCount: 2,
      dataQualityIssueCount: 1,
      correctionSourceCount: 0,
      unresolvedSourceCount: 1,
    });
    expect(result[0]).not.toHaveProperty("longitude");
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
      regionCode: "230202997001",
      categoryCode: "PRODUCTION",
      typeCode: "FARMER",
      query: "同一",
    });

    expect(get.mock.calls[0]?.[0]).toBe(
      "/api/v1/overview/sample-points?year=2026&regionCode=230202997001&categoryCode=PRODUCTION&typeCode=FARMER&query=%E5%90%8C%E4%B8%80",
    );
    expect(result.totalCount).toBe(1);
    expect(result.items[0]).not.toHaveProperty("longitude");
    expect(result.items[0]).not.toHaveProperty("latitude");
  });

  it("reads county-and-deeper icons through the full categorized query", async () => {
    const get = respondingWith([
      {
        samplePointId: "94000000-0000-0000-0000-000000000001",
        name: "同一跨产品样本点",
        iconKey: "farmer",
        types: [{ code: "FARMER", name: "农户", iconKey: "farmer" }],
        longitude: 123.9,
        latitude: 47.3,
      },
    ]);
    const repository = repositoryWith(get);

    const result = await (
      repository.icons as unknown as (
        query: unknown,
      ) => Promise<Awaited<ReturnType<typeof repository.icons>>>
    )({
      year: 2026,
      regionCode: "230202",
      categoryCode: "PRODUCTION",
      typeCode: "FARMER",
      query: "同一",
    });

    expect(get.mock.calls[0]?.[0]).toBe(
      "/api/v1/overview/sample-point-icons?year=2026&regionCode=230202&categoryCode=PRODUCTION&typeCode=FARMER&query=%E5%90%8C%E4%B8%80",
    );
    expect(result[0]?.longitude).toBe(123.9);
  });

  it("reads a stable-id detail with formal business values and no geometry", async () => {
    const get = respondingWith({
      samplePointId: "94000000-0000-0000-0000-000000000001",
      name: "同一跨产品样本点",
      regionCode: "230202997001",
      regionName: "契约测试村",
      locationState: "VALID",
      dataQualityReason: null,
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
            CONTACT: { label: "联系方式", value: "13900000000", unitCode: null },
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
      categoryCode: "PRODUCTION",
      typeCode: "FARMER",
    });

    expect(get.mock.calls[0]?.[0]).toBe(
      "/api/v1/overview/sample-points/94000000-0000-0000-0000-000000000001?year=2026&regionCode=230202&categoryCode=PRODUCTION&typeCode=FARMER",
    );
    expect(result.associations[0]?.businessValues.CONTACT?.value).toBe("13900000000");
    expect(result).not.toHaveProperty("pointGeometry");
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
