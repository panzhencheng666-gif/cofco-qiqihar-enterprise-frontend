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

  it("builds the map and list only from the authoritative formal sample master page", async () => {
    const get = respondingWith({
      items: [
        {
          id: "94000000-0000-0000-0000-000000000001",
          kindCode: "SURVEY_SITE",
          canonicalName: "龙沙兴农农资店",
          regionCode: "230202",
          objectTypeCode: "AGRICULTURAL_INPUT_STORE",
          objectTypeName: "农资店",
          businessDomain: "MARKET",
          address: "龙沙区兴农路 1 号",
          approvalState: "APPROVED",
          locationState: "VALID",
          longitude: 123.95,
          latitude: 47.35,
          effectiveFrom: "2026-01-01",
          effectiveTo: null,
          version: 3,
          annualObservationCount: 2,
          networkMembershipCount: 0,
        },
      ],
      pageNumber: 0,
      pageSize: 100,
      totalElements: 1,
      totalPages: 1,
    });

    const result = await repositoryWith(get).snapshot({
      productCode: "CORN",
      regionCode: "230202",
      regionName: "龙沙区",
      year: 2026,
    });

    expect(get).toHaveBeenCalledWith(
      "/api/v1/formal-sample-points?regionCode=230202&page=0&pageSize=100",
      expect.anything(),
      undefined,
    );
    expect(result.list.items[0]).toMatchObject({
      name: "龙沙兴农农资店",
      regionName: "龙沙区",
      categories: [{ code: "MARKET", name: "市场类" }],
      types: [{ code: "AGRICULTURAL_INPUT_STORE", name: "农资店" }],
      latestBusinessDate: null,
      summaryValues: {},
    });
    expect(result.icons[0]).toMatchObject({
      name: "龙沙兴农农资店",
      regionCode: "230202",
      longitude: 123.95,
      latitude: 47.35,
      roles: [{ code: "MARKET", name: "市场类" }],
      types: [{ code: "AGRICULTURAL_INPUT_STORE", name: "农资店" }],
    });
  });

  it("supplements legacy null master fields without hiding complete formal masters", async () => {
    const get = vi.fn<HttpClient["get"]>((path, schema) => {
      if (path.startsWith("/api/v1/formal-sample-points?")) {
        return Promise.resolve(
          schema.parse({
            data: {
              items: [
                {
                  id: "94000000-0000-0000-0000-000000000001",
                  kindCode: "SURVEY_SITE",
                  canonicalName: "新格式正式样本点",
                  regionCode: "230202",
                  objectTypeCode: "FARMER",
                  objectTypeName: "农户",
                  businessDomain: "PRODUCTION",
                  address: "龙沙区新格式地址",
                  approvalState: "APPROVED",
                  locationState: "VALID",
                  longitude: 123.95,
                  latitude: 47.35,
                  effectiveFrom: "2026-01-01",
                  effectiveTo: null,
                  version: 1,
                  annualObservationCount: 0,
                  networkMembershipCount: 0,
                },
                {
                  id: "94000000-0000-0000-0000-000000000002",
                  kindCode: "SURVEY_SITE",
                  canonicalName: "历史正式样本点",
                  regionCode: "230202",
                  objectTypeCode: null,
                  objectTypeName: null,
                  businessDomain: null,
                  address: null,
                  approvalState: "APPROVED",
                  locationState: "VALID",
                  longitude: 123.96,
                  latitude: 47.32,
                  effectiveFrom: "2026-01-01",
                  effectiveTo: null,
                  version: 0,
                  annualObservationCount: 1,
                  networkMembershipCount: 0,
                },
              ],
              pageNumber: 0,
              pageSize: 100,
              totalElements: 2,
              totalPages: 1,
            },
          }),
        );
      }
      if (path.startsWith("/api/v1/overview/sample-point-snapshot?")) {
        return Promise.resolve(
          schema.parse({
            data: {
              list: {
                regionCode: "230202",
                totalCount: 1,
                validCoordinateCount: 1,
                dataQualityIssueCount: 0,
                correctionSourceCount: 0,
                unresolvedSourceCount: 0,
                categories: [
                  {
                    code: "MARKET",
                    name: "市场类",
                    count: 1,
                    types: [
                      {
                        code: "FEED_MILL",
                        name: "饲料加工企业",
                        iconKey: "feed-mill",
                        count: 1,
                      },
                    ],
                  },
                ],
                items: [
                  {
                    samplePointId: "94000000-0000-0000-0000-000000000002",
                    name: "历史正式样本点",
                    regionCode: "230202",
                    regionName: "龙沙区",
                    locationState: "VALID",
                    dataQualityReason: null,
                    categories: [{ code: "MARKET", name: "市场类" }],
                    types: [
                      {
                        code: "FEED_MILL",
                        name: "饲料加工企业",
                        iconKey: "feed-mill",
                      },
                    ],
                    products: [{ code: "CORN", name: "玉米" }],
                    latestBusinessDate: "2026-08-31",
                    summaryValues: {},
                  },
                ],
                correctionSources: [],
              },
              icons: [
                {
                  samplePointId: "94000000-0000-0000-0000-000000000002",
                  name: "历史正式样本点",
                  regionCode: "230202",
                  iconKey: "feed-mill",
                  roles: [{ code: "MARKET", name: "市场类", iconKey: "market" }],
                  types: [
                    {
                      code: "FEED_MILL",
                      name: "饲料加工企业",
                      iconKey: "feed-mill",
                    },
                  ],
                  longitude: 123.96,
                  latitude: 47.32,
                  dataQualityReason: null,
                },
              ],
            },
          }),
        );
      }
      return Promise.reject(new Error(`Unexpected path: ${path}`));
    });

    const result = await repositoryWith(get).snapshot({
      productCode: "CORN",
      regionCode: "230202",
      regionName: "龙沙区",
      year: 2026,
    });

    expect(get.mock.calls.map(([path]) => path)).toEqual([
      "/api/v1/formal-sample-points?regionCode=230202&page=0&pageSize=100",
      "/api/v1/overview/sample-point-snapshot?productCode=CORN&regionCode=230202&year=2026",
      "/api/v1/overview/sample-point-snapshot?productCode=CORN&regionCode=230202&year=2026&categoryCode=MARKET",
    ]);
    expect(result.list.items.map(({ name }) => name)).toEqual([
      "历史正式样本点",
      "新格式正式样本点",
    ]);
    expect(result.icons.map(({ name }) => name)).toEqual([
      "历史正式样本点",
      "新格式正式样本点",
    ]);
    expect(result.list.totalCount).toBe(2);
  });

  it("uses only incomplete legacy identities for filtered fallback and full facets", async () => {
    const complete = formalMaster({
      id: "94000000-0000-0000-0000-000000000001",
      canonicalName: "完整主数据样本点",
    });
    const incomplete = formalMaster({
      id: "94000000-0000-0000-0000-000000000002",
      canonicalName: "历史主数据样本点",
      objectTypeCode: null,
      objectTypeName: null,
      businessDomain: null,
      address: null,
    });
    const completeLegacy = legacyOverviewRecord({
      samplePointId: complete.id,
      name: complete.canonicalName,
    });
    const incompleteLegacy = legacyOverviewRecord({
      samplePointId: incomplete.id,
      name: incomplete.canonicalName,
    });
    const get = vi.fn<HttpClient["get"]>((path, schema) => {
      if (path.includes("keyword=")) {
        return Promise.resolve(schema.parse({ data: formalPage([]) }));
      }
      if (path.startsWith("/api/v1/formal-sample-points?")) {
        return Promise.resolve(
          schema.parse({ data: formalPage([complete, incomplete]) }),
        );
      }
      if (path.startsWith("/api/v1/overview/sample-point-snapshot?")) {
        return Promise.resolve(
          schema.parse({
            data: legacySnapshot([completeLegacy, incompleteLegacy]),
          }),
        );
      }
      return Promise.reject(new Error(`Unexpected path: ${path}`));
    });

    const result = await repositoryWith(get).snapshot({
      productCode: "CORN",
      regionCode: "230202",
      regionName: "龙沙区",
      year: 2026,
      query: "历史联系方式",
    });

    expect(result.list.items.map(({ samplePointId }) => samplePointId)).toEqual([
      incomplete.id,
    ]);
    expect(result.icons.map(({ samplePointId }) => samplePointId)).toEqual([
      incomplete.id,
    ]);
    expect(result.list.categories.find(({ code }) => code === "MARKET")).toMatchObject({
      count: 2,
      types: [{ code: "FEED_MILL", count: 2 }],
    });
    expect(get.mock.calls.map(([path]) => path)).toEqual([
      "/api/v1/formal-sample-points?regionCode=230202&keyword=%E5%8E%86%E5%8F%B2%E8%81%94%E7%B3%BB%E6%96%B9%E5%BC%8F&page=0&pageSize=100",
      "/api/v1/formal-sample-points?regionCode=230202&page=0&pageSize=100",
      "/api/v1/overview/sample-point-snapshot?productCode=CORN&regionCode=230202&year=2026&query=%E5%8E%86%E5%8F%B2%E8%81%94%E7%B3%BB%E6%96%B9%E5%BC%8F",
      "/api/v1/overview/sample-point-snapshot?productCode=CORN&regionCode=230202&year=2026",
      "/api/v1/overview/sample-point-snapshot?productCode=CORN&regionCode=230202&year=2026&categoryCode=MARKET",
    ]);
  });

  it("keeps legacy category types separate and quality counters distinct", async () => {
    const incomplete = formalMaster({
      objectTypeCode: null,
      objectTypeName: null,
      businessDomain: null,
      address: null,
    });
    const legacy = legacyOverviewRecord({
      categories: [
        { code: "PRODUCTION", name: "产情类" },
        { code: "MARKET", name: "市场类" },
      ],
      types: [
        { code: "FARMER", name: "农户", iconKey: "farmer" },
        { code: "FEED_MILL", name: "饲料加工企业", iconKey: "feed-mill" },
      ],
    });
    const get = vi.fn<HttpClient["get"]>((path, schema) => {
      if (path.startsWith("/api/v1/formal-sample-points?")) {
        return Promise.resolve(schema.parse({ data: formalPage([incomplete]) }));
      }
      const type = path.includes("categoryCode=PRODUCTION")
        ? { code: "FARMER", name: "农户", iconKey: "farmer" }
        : path.includes("categoryCode=MARKET")
          ? { code: "FEED_MILL", name: "饲料加工企业", iconKey: "feed-mill" }
          : undefined;
      const data = legacySnapshot(
        [{ ...legacy, ...(type ? { types: [type] } : {}) }],
        type
          ? []
          : [
              {
                categoryCode: "MARKET",
                sourceRecordId: "legacy-source-1",
                sourceRole: "SURVEY",
                dataQualityReason: "SUBJECT_IDENTITY_MISSING",
              },
            ],
      );
      return Promise.resolve(schema.parse({ data }));
    });

    const result = await repositoryWith(get).snapshot({
      productCode: "CORN",
      regionCode: "230202",
      regionName: "龙沙区",
      year: 2026,
    });

    expect(
      result.list.categories.find(({ code }) => code === "PRODUCTION")?.types,
    ).toEqual([{ code: "FARMER", name: "农户", iconKey: "farmer", count: 1 }]);
    expect(result.list.categories.find(({ code }) => code === "MARKET")?.types).toEqual(
      [
        {
          code: "FEED_MILL",
          name: "饲料加工企业",
          iconKey: "feed-mill",
          count: 1,
        },
      ],
    );
    expect(result.list).toMatchObject({
      dataQualityIssueCount: 0,
      correctionSourceCount: 1,
      unresolvedSourceCount: 1,
    });
  });

  it("invalidates the formal identity catalog before a realtime filtered requery", async () => {
    let incomplete = false;
    const complete = formalMaster();
    const legacy = legacyOverviewRecord();
    const get = vi.fn<HttpClient["get"]>((path, schema) => {
      if (path.startsWith("/api/v1/formal-sample-points?")) {
        const point = incomplete
          ? {
              ...complete,
              objectTypeCode: null,
              objectTypeName: null,
              businessDomain: null,
            }
          : complete;
        return Promise.resolve(
          schema.parse({ data: formalPage(path.includes("keyword=") ? [] : [point]) }),
        );
      }
      return Promise.resolve(schema.parse({ data: legacySnapshot([legacy]) }));
    });
    const repository = repositoryWith(get);
    await repository.snapshot({
      productCode: "CORN",
      regionCode: "230202",
      year: 2026,
    });

    incomplete = true;
    repository.invalidateFormalCatalog?.();
    const result = await repository.snapshot({
      productCode: "CORN",
      regionCode: "230202",
      year: 2026,
      query: "历史联系方式",
    });

    expect(result.list.items.map(({ samplePointId }) => samplePointId)).toEqual([
      complete.id,
    ]);
  });

  it("forwards cancellation to formal and legacy snapshot requests", async () => {
    const incomplete = formalMaster({
      objectTypeCode: null,
      objectTypeName: null,
      businessDomain: null,
      address: null,
    });
    const get = vi.fn<HttpClient["get"]>((path, schema) =>
      Promise.resolve(
        schema.parse({
          data: path.startsWith("/api/v1/formal-sample-points?")
            ? formalPage([incomplete])
            : legacySnapshot([]),
        }),
      ),
    );
    const controller = new AbortController();

    await repositoryWith(get).snapshot(
      { productCode: "CORN", regionCode: "230202", year: 2026 },
      { signal: controller.signal },
    );

    expect(get.mock.calls).toHaveLength(2);
    expect(get.mock.calls.map(([path]) => path)).toEqual([
      "/api/v1/formal-sample-points?regionCode=230202&page=0&pageSize=100",
      "/api/v1/overview/sample-point-snapshot?productCode=CORN&regionCode=230202&year=2026",
    ]);
    expect(
      get.mock.calls.every(([, , options]) => options?.signal === controller.signal),
    ).toBe(true);
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

  it("reads legacy detail when the formal master has no categorization fields", async () => {
    const get = vi.fn<HttpClient["get"]>((path, schema) => {
      if (
        path === "/api/v1/formal-sample-points/94000000-0000-0000-0000-000000000002"
      ) {
        return Promise.resolve(
          schema.parse({
            data: {
              id: "94000000-0000-0000-0000-000000000002",
              kindCode: "SURVEY_SITE",
              canonicalName: "历史正式样本点",
              regionCode: "230202",
              objectTypeCode: null,
              objectTypeName: null,
              businessDomain: null,
              address: null,
              approvalState: "APPROVED",
              locationState: "VALID",
              longitude: "123.9600000",
              latitude: "47.3200000",
              effectiveFrom: "2026-01-01",
              effectiveTo: null,
              version: 0,
              annualObservationCount: 1,
              networkMembershipCount: 0,
            },
          }),
        );
      }
      if (path.startsWith("/api/v1/overview/sample-points/94000000-")) {
        return Promise.resolve(
          schema.parse({
            data: {
              samplePointId: "94000000-0000-0000-0000-000000000002",
              name: "历史正式样本点",
              regionCode: "230202",
              regionName: "龙沙区",
              locationState: "VALID",
              dataQualityReason: null,
              roles: [{ code: "MARKET", name: "市场类", iconKey: "market" }],
              associations: [
                {
                  categoryCode: "MARKET",
                  categoryName: "市场类",
                  sourceRole: "SURVEY",
                  typeCode: "FEED_MILL",
                  typeName: "饲料加工企业",
                  productCode: "CORN",
                  productName: "玉米",
                  occurrenceDate: "2026-08-31",
                  sourceVersion: 1,
                  businessValues: {},
                },
              ],
            },
          }),
        );
      }
      return Promise.reject(new Error(`Unexpected path: ${path}`));
    });

    const result = await repositoryWith(get).detail({
      samplePointId: "94000000-0000-0000-0000-000000000002",
      regionCode: "230202",
      regionName: "龙沙区",
      productCode: "CORN",
      year: 2026,
    });

    expect(get.mock.calls.map(([path]) => path)).toEqual([
      "/api/v1/formal-sample-points/94000000-0000-0000-0000-000000000002",
      "/api/v1/overview/sample-points/94000000-0000-0000-0000-000000000002?year=2026&productCode=CORN&regionCode=230202",
    ]);
    expect(result).toMatchObject({
      name: "历史正式样本点",
      roles: [{ code: "MARKET" }],
      associations: [{ typeCode: "FEED_MILL", productCode: "CORN" }],
    });
  });

  it("joins authoritative master detail with agricultural-input observation history", async () => {
    const get = vi.fn<HttpClient["get"]>((path, schema) => {
      if (
        path === "/api/v1/formal-sample-points/94000000-0000-0000-0000-000000000001"
      ) {
        return Promise.resolve(
          schema.parse({
            data: {
              id: "94000000-0000-0000-0000-000000000001",
              kindCode: "SURVEY_SITE",
              canonicalName: "龙沙兴农农资店",
              regionCode: "230202",
              objectTypeCode: "AGRICULTURAL_INPUT_STORE",
              objectTypeName: "农资店",
              businessDomain: "MARKET",
              address: "龙沙区兴农路 1 号",
              approvalState: "APPROVED",
              locationState: "VALID",
              longitude: "123.9500000",
              latitude: "47.3500000",
              effectiveFrom: "2026-01-01",
              effectiveTo: null,
              version: 3,
              annualObservationCount: 2,
              networkMembershipCount: 0,
            },
          }),
        );
      }
      if (path.startsWith("/api/v1/formal-sample-observations/observations?")) {
        return Promise.resolve(
          schema.parse({
            data: {
              items: [
                {
                  observationId: "95000000-0000-0000-0000-000000000001",
                  observedAt: "2026-08-28T02:15:00Z",
                  officialSavedAt: "2026-08-28T02:16:00Z",
                  actorDisplayName: "业务人员",
                  projectionVersion:
                    "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                  synchronizedModules: ["OVERVIEW", "MARKET_ANALYSIS", "REPORTS"],
                  values: {
                    AGRI_INPUT_SEED_SALES_VOLUME: "1250.5000",
                    AGRI_INPUT_SEED_RETAIL_PRICE: "6.7500",
                    AGRI_INPUT_SUPPLY_STATUS: "TIGHT",
                    AGRI_INPUT_PLANTING_INTENTION_TREND: null,
                    AGRI_INPUT_INTERNAL_NOTE: "只读内部说明",
                    MKT_OBJECT_TYPE: "AGRICULTURAL_INPUT_STORE",
                  },
                  latest: true,
                },
              ],
              totalElements: 1,
              pageNumber: 0,
              pageSize: 100,
            },
          }),
        );
      }
      if (path.startsWith("/api/v1/market-record-definitions?")) {
        return Promise.resolve(
          schema.parse({
            data: {
              productCode: "CORN",
              objectTypeCode: "AGRICULTURAL_INPUT_STORE",
              coreFields: [
                marketField("AGRI_INPUT_SEED_SALES_VOLUME", "种子销售量", "公斤"),
                marketField("AGRI_INPUT_SEED_RETAIL_PRICE", "种子零售价", "元/公斤"),
                marketField("AGRI_INPUT_SUPPLY_STATUS", "供货状态", null, [
                  { value: "SUFFICIENT", label: "充足", sortOrder: 10 },
                  { value: "TIGHT", label: "偏紧", sortOrder: 20 },
                ]),
                marketField(
                  "AGRI_INPUT_PLANTING_INTENTION_TREND",
                  "种植意向趋势",
                  null,
                  [
                    { value: "INCREASE", label: "增加", sortOrder: 10 },
                    { value: "STABLE", label: "持平", sortOrder: 20 },
                  ],
                ),
                {
                  ...marketField("AGRI_INPUT_INTERNAL_NOTE", "内部说明", null),
                  controlType: "READONLY_TEXT",
                },
              ],
              groups: [],
            },
          }),
        );
      }
      return Promise.reject(new Error(`Unexpected path: ${path}`));
    });
    const repository = repositoryWith(get);

    const result = await (
      repository.detail as unknown as (
        query: unknown,
      ) => Promise<Awaited<ReturnType<typeof repository.detail>>>
    )({
      samplePointId: "94000000-0000-0000-0000-000000000001",
      regionCode: "230202",
      regionName: "龙沙区",
      year: 2026,
      productCode: "CORN",
    });

    expect(get.mock.calls.map(([path]) => path)).toEqual([
      "/api/v1/formal-sample-points/94000000-0000-0000-0000-000000000001",
      "/api/v1/formal-sample-observations/observations?domain=MARKET&samplePointId=94000000-0000-0000-0000-000000000001&productCode=CORN&year=2026&pageNumber=0&pageSize=100",
      "/api/v1/market-record-definitions?productCode=CORN&objectTypeCode=AGRICULTURAL_INPUT_STORE",
    ]);
    expect(result).toMatchObject({
      name: "龙沙兴农农资店",
      regionName: "龙沙区",
      address: "龙沙区兴农路 1 号",
      longitude: 123.95,
      latitude: 47.35,
      objectTypeName: "农资店",
      version: 3,
    });
    expect(result.associations[0]?.businessValues).toEqual({
      AGRI_INPUT_SEED_SALES_VOLUME: {
        label: "种子销售量",
        value: "1250.5000",
        unitCode: "公斤",
      },
      AGRI_INPUT_SEED_RETAIL_PRICE: {
        label: "种子零售价",
        value: "6.7500",
        unitCode: "元/公斤",
      },
      AGRI_INPUT_SUPPLY_STATUS: {
        label: "供货状态",
        value: "偏紧",
        unitCode: null,
      },
      AGRI_INPUT_PLANTING_INTENTION_TREND: {
        label: "种植意向趋势",
        value: "—",
        unitCode: null,
      },
    });
    expect(result.associations[0]?.businessValues).not.toHaveProperty(
      "MKT_OBJECT_TYPE",
    );
    expect(result.associations[0]?.businessValues).not.toHaveProperty(
      "AGRI_INPUT_INTERNAL_NOTE",
    );
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

  it("reads the year-independent authoritative design sample point page", async () => {
    const get = respondingWith({
      items: [
        {
          id: "94000000-0000-0000-0000-000000000009",
          contractVersion: "design-sample-fields-v1",
          contractDigest:
            "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          context: {
            domainCode: "MARKET",
            productCode: "CORN",
            objectTypeCode: "AGRICULTURAL_INPUT_STORE",
          },
          values: {
            DSP_NAME: "龙沙农资店",
            DSP_REGION_CODE: "230202",
            DSP_LONGITUDE: 123.95,
            DSP_LATITUDE: 47.35,
            AGRI_INPUT_SEED_SALES_VOLUME: 1200,
            AGRI_INPUT_SEED_RETAIL_PRICE: 8.5,
            AGRI_INPUT_SUPPLY_STATUS: "SUFFICIENT",
            AGRI_INPUT_PLANTING_INTENTION_TREND: "STABLE",
          },
          name: "龙沙农资店",
          regionCode: "230202",
          regionPath: "黑龙江省 / 齐齐哈尔市 / 龙沙区",
          longitude: 123.95,
          latitude: 47.35,
          version: 2,
          updatedAt: "2026-09-01T00:00:00Z",
        },
      ],
      pageNumber: 0,
      pageSize: 100,
      totalElements: 1,
      totalPages: 1,
    });

    const result = await repositoryWith(get).designPoints({
      page: 0,
      pageSize: 100,
      productCode: "CORN",
    });

    expect(get).toHaveBeenCalledWith(
      "/api/v1/design-sample-points?page=0&pageSize=100&productCode=CORN",
      expect.anything(),
    );
    expect(get.mock.calls[0]?.[0]).not.toContain("surveyYear");
    expect(result.items[0]?.values.AGRI_INPUT_SEED_SALES_VOLUME).toBe(1200);
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

function marketField(
  code: string,
  label: string,
  unit: string | null,
  options: readonly { value: string; label: string; sortOrder: number }[] = [],
) {
  return {
    code,
    label,
    controlType: options.length ? "SELECT" : "DECIMAL",
    capability: "GENERIC",
    required: false,
    unit,
    description: null,
    precision: options.length ? null : 18,
    scale: options.length ? null : 4,
    sortOrder: 10,
    options,
  };
}

function formalMaster(overrides: Readonly<Record<string, unknown>> = {}) {
  return {
    id: "94000000-0000-0000-0000-000000000001",
    kindCode: "SURVEY_SITE",
    canonicalName: "完整主数据样本点",
    regionCode: "230202",
    objectTypeCode: "FEED_MILL",
    objectTypeName: "饲料加工企业",
    businessDomain: "MARKET",
    address: "龙沙区正式地址",
    approvalState: "APPROVED",
    locationState: "VALID",
    longitude: 123.95,
    latitude: 47.35,
    effectiveFrom: "2026-01-01",
    effectiveTo: null,
    version: 1,
    annualObservationCount: 1,
    networkMembershipCount: 0,
    ...overrides,
  };
}

function formalPage(items: readonly Readonly<Record<string, unknown>>[]) {
  return {
    items,
    pageNumber: 0,
    pageSize: 100,
    totalElements: items.length,
    totalPages: items.length === 0 ? 0 : 1,
  };
}

function legacyOverviewRecord(overrides: Readonly<Record<string, unknown>> = {}) {
  return {
    samplePointId: "94000000-0000-0000-0000-000000000001",
    name: "历史投影样本点",
    regionCode: "230202",
    regionName: "龙沙区",
    locationState: "VALID",
    dataQualityReason: null,
    categories: [{ code: "MARKET", name: "市场类" }],
    types: [
      {
        code: "FEED_MILL",
        name: "饲料加工企业",
        iconKey: "feed-mill",
      },
    ],
    products: [{ code: "CORN", name: "玉米" }],
    latestBusinessDate: "2026-08-31",
    summaryValues: {},
    ...overrides,
  };
}

function legacySnapshot(
  items: readonly ReturnType<typeof legacyOverviewRecord>[],
  correctionSources: readonly {
    categoryCode: "PRODUCTION" | "MARKET" | "LOGISTICS";
    sourceRecordId: string;
    sourceRole: "SURVEY" | "ORIGIN" | "DESTINATION";
    dataQualityReason: string;
  }[] = [],
) {
  return {
    list: {
      regionCode: "230202",
      totalCount: items.length,
      validCoordinateCount: items.length,
      dataQualityIssueCount: 0,
      correctionSourceCount: 0,
      unresolvedSourceCount: 0,
      categories: [
        {
          code: "MARKET",
          name: "市场类",
          count: items.length,
          types: [
            {
              code: "FEED_MILL",
              name: "饲料加工企业",
              iconKey: "feed-mill",
              count: items.length,
            },
          ],
        },
      ],
      items,
      correctionSources: [...correctionSources],
    },
    icons: items.map((item, index) => ({
      samplePointId: item.samplePointId,
      name: item.name,
      regionCode: item.regionCode,
      iconKey: "feed-mill",
      roles: [{ code: "MARKET", name: "市场类", iconKey: "market" }],
      types: item.types,
      longitude: 123.95 + index / 100,
      latitude: 47.35 + index / 100,
      dataQualityReason: null,
    })),
  };
}
