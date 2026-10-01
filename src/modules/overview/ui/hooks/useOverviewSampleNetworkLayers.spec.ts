import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, vi } from "vitest";

import type { OverviewSamplePointRepository } from "../../application/ports/OverviewSamplePointRepository";
import type { DesignSampleFieldContract } from "../../../design-sample/domain/designSampleFieldContract";
import type { SampleNetworkComparison } from "../../domain/overviewSamplePoint";
import { HttpError } from "../../../../shared/api/HttpClient";
import {
  useOverviewSampleNetworkLayers,
  presentDesignSamplePoint,
} from "./useOverviewSampleNetworkLayers";

const comparison: SampleNetworkComparison = {
  networkYear: 2026,
  networkStatus: "DRAFT",
  designPointCount: 2332,
  designCoordinateCount: 2332,
  activeSamplePointCount: 0,
  approvedSubmissionSamplePointCount: 0,
  pendingVerificationDesignPointCount: 2332,
  multipleActualPerDesignPointCount: 0,
  anomalyCount: 0,
  exactCoveredDesignPointCount: 0,
  representedDesignPointCount: 0,
  regionalAssociationDesignPointCount: 0,
  unrelatedDesignPointCount: 2332,
  actualLevelCounts: {
    prefecture: 0,
    county: 0,
    township: 0,
    village: 0,
  },
  designPoints: [],
  actualPoints: [],
  relations: [],
};

describe("useOverviewSampleNetworkLayers", () => {
  it("loads GENERAL design catalog records for village detail without legacy definition endpoints", async () => {
    const general = {
      id: "94000000-0000-0000-0000-000000000099",
      contractVersion: "design-sample-fields-v1" as const,
      contractDigest: `sha256:${"a".repeat(64)}`,
      context: {
        domainCode: "PRODUCTION",
        productCode: "GENERAL",
        objectTypeCode: "FARMER",
      },
      values: {},
      name: "通用设计样本",
      regionCode: "230202997001",
      regionPath: "齐齐哈尔市/龙沙区/某镇/某村",
      longitude: 123.95,
      latitude: 47.35,
      version: 1,
      updatedAt: "2026-09-17T00:00:00Z",
    };
    const repository = {
      ...repositoryWithSnapshot(),
      designMapCatalog: vi.fn(() => Promise.resolve([general])),
    } satisfies OverviewSamplePointRepository;
    const { result } = renderHook(() =>
      useOverviewSampleNetworkLayers({
        productCode: "CORN",
        refreshSequence: 0,
        region: {
          code: "230202997001",
          level: "VILLAGE",
          name: "某村",
          parentCode: "230202997",
        },
        repository,
        year: 2026,
      }),
    );

    await waitFor(() =>
      expect(result.current.designPoints).toEqual([
        expect.objectContaining({
          id: general.id,
          regionCode: general.regionCode,
          productLabel: "通用",
        }),
      ]),
    );
  });

  it("loads the design catalog at county level so direct points and descendant counts are not hidden", async () => {
    const direct = {
      id: "94000000-0000-0000-0000-000000000090",
      contractVersion: "design-sample-fields-v1" as const,
      contractDigest: `sha256:${"a".repeat(64)}`,
      context: {
        domainCode: "PRODUCTION",
        productCode: "CORN",
        objectTypeCode: "FARMER",
      },
      values: {},
      name: "县级设计点",
      regionCode: "230202",
      regionPath: "齐齐哈尔市/龙沙区",
      longitude: 123.9,
      latitude: 47.2,
      version: 1,
      updatedAt: "2026-09-17T00:00:00Z",
      lifecycleStatus: "ACTIVE" as const,
    };
    const descendant = {
      ...direct,
      id: "94000000-0000-0000-0000-000000000091",
      name: "村级作废设计点",
      regionCode: "230202997001",
      lifecycleStatus: "EXPIRED" as const,
      expiredAt: "2026-09-16T00:00:00Z",
    };
    const repository = {
      ...repositoryWithSnapshot(),
      list: vi.fn<OverviewSamplePointRepository["list"]>(({ regionCode }) =>
        Promise.resolve(emptySnapshot(regionCode).list),
      ),
      designMapCatalog: vi.fn(() => Promise.resolve([direct, descendant])),
    } satisfies OverviewSamplePointRepository;
    const { result } = renderHook(() =>
      useOverviewSampleNetworkLayers({
        productCode: "CORN",
        refreshSequence: 0,
        region: { code: "230202", level: "COUNTY", name: "龙沙区" },
        mapRegions: [
          {
            code: "230202997",
            level: "TOWNSHIP",
            name: "某镇",
            parentCode: "230202",
          },
        ],
        repository,
        year: 2026,
      }),
    );

    await waitFor(() => expect(result.current.designPoints).toHaveLength(2));
    act(() => result.current.setMode("design"));
    expect(repository.designMapCatalog).toHaveBeenCalled();
    expect(result.current.icons).toEqual([
      expect.objectContaining({
        name: "县级设计点",
        layerType: "DESIGN_EXACT_LOCATION",
      }),
    ]);
    expect(result.current.designPointAggregates?.[0]).toEqual(
      expect.objectContaining({ samplePointCount: 1, expiredSamplePointCount: 1 }),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows only retired icons for the selected retirement year and reloads them after refresh", async () => {
    const historicalIcons = vi.fn<
      NonNullable<OverviewSamplePointRepository["historicalIcons"]>
    >(() =>
      Promise.resolve([
        {
          samplePointId: "94000000-0000-0000-0000-000000000099",
          name: "已淘汰样本",
          regionCode: "230281",
          iconKey: "farmer",
          roles: [
            {
              code: "PRODUCTION" as const,
              name: "产情类",
              iconKey: "production" as const,
            },
          ],
          types: [{ code: "FARMER", name: "农户", iconKey: "farmer" }],
          longitude: 124.9,
          latitude: 48.5,
          dataQualityReason: null,
        },
      ]),
    );
    const historicalAggregates = vi.fn().mockResolvedValue([
      {
        regionCode: "230281",
        regionName: "讷河市",
        regionLevel: "COUNTY",
        samplePointCount: 1,
        productionCount: 1,
        marketCount: 0,
        logisticsCount: 0,
        validCoordinateCount: 1,
        dataQualityIssueCount: 0,
        correctionSourceCount: 0,
        unresolvedSourceCount: 0,
      },
    ]);
    const repository = {
      ...repositoryWithSnapshot(),
      historicalIcons,
      historicalAggregates,
    } as unknown as OverviewSamplePointRepository;
    let refreshSequence = 0;
    const { result, rerender } = renderHook(() =>
      useOverviewSampleNetworkLayers({
        productCode: "CORN",
        refreshSequence,
        region: { code: "230281", level: "TOWNSHIP", name: "讷河市" },
        repository,
        year: 2026,
      }),
    );

    act(() => result.current.setMode("historical"));
    await waitFor(() => expect(result.current.historicalState).toBe("ready"));

    expect(historicalIcons.mock.calls[0]?.[0]).toEqual({
      productCode: "CORN",
      regionCode: "230281",
      year: 2026,
    });
    expect(historicalIcons.mock.calls[0]?.[1]?.signal).toBeInstanceOf(AbortSignal);
    expect(result.current.icons.map(({ name }) => name)).toEqual(["已淘汰样本"]);
    expect(historicalAggregates.mock.calls[0]?.[0]).toEqual({
      productCode: "CORN",
      year: 2026,
    });
    expect(result.current.historicalAggregates?.[0]?.samplePointCount).toBe(1);
    expect(result.current.actualIcons?.map(({ name }) => name)).not.toContain(
      "已淘汰样本",
    );

    act(() => {
      refreshSequence = 1;
      rerender();
    });
    await waitFor(() => expect(historicalIcons).toHaveBeenCalledTimes(2));
  });

  it.each(["search", "category"])(
    "refreshes the regional catalog while %s stays active",
    async (filter) => {
      let count = 329;
      const repository = repositoryWithSnapshot((query) => {
        const filtered = Boolean(query.query || query.categoryCode);
        const snapshot = emptySnapshot(query.regionCode);
        return Promise.resolve({
          ...snapshot,
          list: {
            ...snapshot.list,
            totalCount: filtered ? 1 : count,
            categories: [
              { code: "LOGISTICS", name: "物流类", count: count - 326, types: [] },
            ],
          },
        });
      });
      const { result, rerender } = renderHook(
        ({ refreshSequence }) =>
          useOverviewSampleNetworkLayers({
            productCode: "CORN",
            refreshSequence,
            region: { code: "230200", level: "TOWNSHIP", name: "齐齐哈尔市" },
            repository,
            year: 2026,
          }),
        { initialProps: { refreshSequence: 0 } },
      );
      await waitFor(() => expect(result.current.catalog?.totalCount).toBe(329));
      act(() => {
        if (filter === "search") result.current.setQuery?.("专用样本");
        else result.current.setCategoryCode("LOGISTICS");
      });
      await waitFor(() => expect(result.current.filteredList?.totalCount).toBe(1));
      count = 330;
      rerender({ refreshSequence: 1 });
      await waitFor(() => expect(result.current.catalog?.totalCount).toBe(330));
      expect(result.current.catalog?.categories[0]?.count).toBe(4);
      expect(result.current.filteredList?.totalCount).toBe(1);
      if (filter === "search") expect(result.current.query).toBe("专用样本");
      else expect(result.current.categoryCode).toBe("LOGISTICS");
    },
  );

  it("debounces search, suppresses IME composition, and clears immediately", async () => {
    vi.useFakeTimers();
    const repository = repositoryWithSnapshot();
    const { result } = renderHook(() =>
      useOverviewSampleNetworkLayers({
        productCode: "CORN",
        refreshSequence: 0,
        region: { code: "230281", level: "TOWNSHIP", name: "讷河市" },
        repository,
        year: 2026,
      }),
    );

    await act(() => Promise.resolve());
    expect(repository.snapshot).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.setQueryComposition?.(true);
      result.current.setQuery?.("n");
      result.current.setQuery?.("ne");
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(repository.snapshot).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.setQuery?.("讷河");
      result.current.setQueryComposition?.(false);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(249);
    });
    expect(repository.snapshot).toHaveBeenCalledTimes(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(repository.snapshot.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({ query: "讷河" }),
    );
    expect(repository.snapshot.mock.calls.at(-1)?.[1]?.signal).toBeInstanceOf(
      AbortSignal,
    );

    act(() => result.current.setQuery?.(""));
    await act(() => Promise.resolve());
    expect(repository.snapshot.mock.calls.at(-1)?.[0]).not.toHaveProperty("query");
    expect(repository.snapshot.mock.calls.at(-1)?.[1]?.signal).toBeInstanceOf(
      AbortSignal,
    );
  });

  it("aborts superseded searches and ignores a late response from an older scope", async () => {
    vi.useFakeTimers();
    const firstSearch = deferredSnapshot();
    const secondSearch = deferredSnapshot();
    const repository = repositoryWithSnapshot((query) => {
      if (query.query === "旧") return firstSearch.promise;
      if (query.query === "新") return secondSearch.promise;
      return Promise.resolve(emptySnapshot(query.regionCode));
    });
    const { result } = renderHook(() =>
      useOverviewSampleNetworkLayers({
        productCode: "CORN",
        refreshSequence: 0,
        region: { code: "230281", level: "TOWNSHIP", name: "讷河市" },
        repository,
        year: 2026,
      }),
    );
    await act(() => Promise.resolve());

    act(() => result.current.setQuery?.("旧"));
    await act(() => vi.advanceTimersByTimeAsync(250));
    const oldSignal = repository.snapshot.mock.calls.at(-1)?.[1]?.signal;
    expect(oldSignal?.aborted).toBe(false);

    act(() => result.current.setQuery?.("新"));
    await act(() => vi.advanceTimersByTimeAsync(250));
    expect(oldSignal?.aborted).toBe(true);

    secondSearch.resolve(snapshotNamed("230281", "新结果"));
    await act(() => Promise.resolve());
    expect(result.current.filteredList?.items[0]?.name).toBe("新结果");

    firstSearch.resolve(snapshotNamed("230281", "旧结果"));
    await act(() => Promise.resolve());
    expect(result.current.filteredList?.items[0]?.name).toBe("新结果");
  });

  it.each([
    ["region", { productCode: "CORN", regionCode: "230225", year: 2026 }],
    ["product", { productCode: "SOYBEAN", regionCode: "230281", year: 2026 }],
    ["year", { productCode: "CORN", regionCode: "230281", year: 2025 }],
  ] as const)(
    "aborts the active search when %s scope changes",
    async (_label, next) => {
      const pending = deferredSnapshot();
      let firstSnapshot = true;
      const repository = repositoryWithSnapshot((query) => {
        if (firstSnapshot) {
          firstSnapshot = false;
          return pending.promise;
        }
        return Promise.resolve(emptySnapshot(query.regionCode));
      });
      let scope = { productCode: "CORN", regionCode: "230281", year: 2026 };
      const { rerender } = renderHook(() =>
        useOverviewSampleNetworkLayers({
          productCode: scope.productCode,
          refreshSequence: 0,
          region: { code: scope.regionCode, level: "TOWNSHIP", name: "测试地区" },
          repository,
          year: scope.year,
        }),
      );
      await act(() => Promise.resolve());
      const oldSignal = repository.snapshot.mock.calls[0]?.[1]?.signal;
      expect(oldSignal?.aborted).toBe(false);

      scope = next;
      rerender();
      await act(() => Promise.resolve());
      expect(oldSignal?.aborted).toBe(true);
      expect(repository.snapshot.mock.calls.at(-1)?.[0]).toEqual(
        expect.objectContaining(next),
      );
      expect(repository.snapshot.mock.calls.at(-1)?.[1]?.signal).toBeInstanceOf(
        AbortSignal,
      );
    },
  );
  it("keeps one confirmed map and list snapshot during a same-scope realtime refresh", async () => {
    const list = {
      regionCode: "230281",
      totalCount: 1,
      validCoordinateCount: 1,
      dataQualityIssueCount: 0,
      correctionSourceCount: 0,
      unresolvedSourceCount: 0,
      categories: [],
      items: [],
      correctionSources: [],
    };
    const icon = {
      samplePointId: "94000000-0000-0000-0000-000000000001",
      name: "已核验样本点",
      iconKey: "production",
      roles: [
        { code: "PRODUCTION" as const, name: "产情类", iconKey: "production" as const },
      ],
      types: [],
      longitude: 124.9,
      latitude: 48.5,
      dataQualityReason: null,
    };
    let refreshSequence = 0;
    let refreshPending = false;
    const pendingComparison = new Promise<SampleNetworkComparison>(() => undefined);
    const pendingList = new Promise<typeof list>(() => undefined);
    const pendingIcons = new Promise<readonly (typeof icon)[]>(() => undefined);
    const repository = {
      invalidateFormalCatalog: vi.fn(),
      comparison: vi.fn(() =>
        refreshPending ? pendingComparison : Promise.resolve(comparison),
      ),
      aggregates: vi.fn(),
      snapshot: vi.fn(() =>
        refreshPending
          ? Promise.all([pendingList, pendingIcons]).then(([nextList, nextIcons]) => ({
              icons: nextIcons,
              list: nextList,
            }))
          : Promise.resolve({ icons: [icon], list }),
      ),
      list: vi.fn(),
      icons: vi.fn(),
      detail: vi.fn(),
    } satisfies OverviewSamplePointRepository;

    const { result, rerender } = renderHook(() =>
      useOverviewSampleNetworkLayers({
        productCode: "CORN",
        refreshSequence,
        region: { code: "230281", level: "TOWNSHIP", name: "讷河市" },
        repository,
        year: 2026,
      }),
    );

    await waitFor(() => expect(result.current.filteredState).toBe("ready"));
    expect(result.current.catalog).toEqual(list);
    expect(result.current.actualIcons).toEqual([icon]);
    expect(result.current.comparison).toMatchObject({
      ...comparison,
      activeSamplePointCount: 1,
      approvedSubmissionSamplePointCount: 1,
    });
    expect(repository.snapshot).toHaveBeenCalledTimes(1);
    expect(repository.invalidateFormalCatalog).not.toHaveBeenCalled();
    expect(repository.list).not.toHaveBeenCalled();
    expect(repository.icons).not.toHaveBeenCalled();

    act(() => {
      refreshPending = true;
      refreshSequence = 1;
      rerender();
    });

    await waitFor(() => expect(result.current.filteredState).toBe("loading"));
    expect(repository.invalidateFormalCatalog).toHaveBeenCalledTimes(1);
    expect(result.current.catalog).toEqual(list);
    expect(result.current.actualIcons).toEqual([icon]);
    expect(result.current.comparison).toMatchObject({
      ...comparison,
      activeSamplePointCount: 1,
      approvedSubmissionSamplePointCount: 1,
    });
  });

  it("publishes the filtered list and map icons as one scope-consistent snapshot", async () => {
    let resolveIcons!: (icons: []) => void;
    const icons = new Promise<[]>((resolve) => {
      resolveIcons = resolve;
    });
    const list = {
      regionCode: "230281",
      totalCount: 3,
      validCoordinateCount: 2,
      dataQualityIssueCount: 1,
      correctionSourceCount: 0,
      unresolvedSourceCount: 1,
      categories: [],
      items: [],
      correctionSources: [],
    };
    const repository = {
      comparison: vi.fn(() => Promise.resolve(comparison)),
      aggregates: vi.fn(),
      list: vi.fn(() => Promise.resolve(list)),
      icons: vi.fn(() => icons),
      detail: vi.fn(),
    } satisfies OverviewSamplePointRepository;

    const { result } = renderHook(() =>
      useOverviewSampleNetworkLayers({
        productCode: "CORN",
        refreshSequence: 0,
        region: { code: "230281", level: "TOWNSHIP", name: "讷河市" },
        repository,
        year: 2026,
      }),
    );

    await waitFor(() => expect(result.current.catalogState).toBe("loading"));
    expect(result.current.filteredState).toBe("loading");
    expect(result.current.catalog).toBeUndefined();
    expect(result.current.filteredList).toBeUndefined();
    expect(result.current.actualIcons).toEqual([]);

    resolveIcons([]);
    await waitFor(() => expect(result.current.filteredState).toBe("ready"));
    expect(result.current.catalogState).toBe("ready");
    expect(result.current.catalog).toEqual(list);
    expect(result.current.filteredList).toEqual(list);
    expect(result.current.actualIcons).toEqual([]);
  });

  it("loads pre-2026 business samples and annual comparison through the same year contract", async () => {
    const repository = {
      comparison: vi.fn(() =>
        Promise.resolve({
          ...comparison,
          networkYear: 2025,
          networkStatus: "NOT_CREATED",
        }),
      ),
      aggregates: vi.fn(),
      list: vi.fn<OverviewSamplePointRepository["list"]>(() =>
        Promise.resolve({
          regionCode: "230200",
          totalCount: 1,
          validCoordinateCount: 1,
          dataQualityIssueCount: 0,
          correctionSourceCount: 0,
          unresolvedSourceCount: 0,
          categories: [],
          items: [],
          correctionSources: [],
        }),
      ),
      icons: vi.fn<OverviewSamplePointRepository["icons"]>(() => Promise.resolve([])),
      detail: vi.fn(),
    } satisfies OverviewSamplePointRepository;

    const { result } = renderHook(() =>
      useOverviewSampleNetworkLayers({
        productCode: "RICE",
        refreshSequence: 0,
        region: { code: "230200", level: "TOWNSHIP", name: "齐齐哈尔市" },
        repository,
        year: 2025,
      }),
    );

    await waitFor(() => expect(result.current.catalogState).toBe("ready"));
    expect(repository.list.mock.calls.map(([request]) => request)).toContainEqual({
      productCode: "RICE",
      regionCode: "230200",
      year: 2025,
    });
    expect(repository.icons.mock.calls.map(([request]) => request)).toContainEqual({
      productCode: "RICE",
      regionCode: "230200",
      year: 2025,
    });
    expect(repository.comparison).toHaveBeenCalledWith({
      productCode: "RICE",
      regionCode: "230200",
      year: 2025,
    });
    expect(result.current.applicable).toBe(true);
  });

  it("loads all stable role icons before any role or object-type filter is selected", async () => {
    const repository = {
      comparison: vi.fn(() =>
        Promise.resolve({ ...comparison, networkStatus: "PUBLISHED" }),
      ),
      aggregates: vi.fn(),
      list: vi.fn<OverviewSamplePointRepository["list"]>(() =>
        Promise.resolve({
          regionCode: "230200",
          totalCount: 1,
          validCoordinateCount: 1,
          dataQualityIssueCount: 0,
          correctionSourceCount: 0,
          unresolvedSourceCount: 0,
          categories: [],
          items: [],
          correctionSources: [],
        }),
      ),
      icons: vi.fn<OverviewSamplePointRepository["icons"]>(() => Promise.resolve([])),
      detail: vi.fn(),
    } satisfies OverviewSamplePointRepository;

    const { result } = renderHook(() =>
      useOverviewSampleNetworkLayers({
        productCode: "RICE",
        refreshSequence: 0,
        region: { code: "230200", level: "TOWNSHIP", name: "齐齐哈尔市" },
        repository,
        year: 2026,
      }),
    );

    await waitFor(() => expect(result.current.catalogState).toBe("ready"));
    expect(repository.icons.mock.calls.map(([request]) => request)).toContainEqual({
      productCode: "RICE",
      regionCode: "230200",
      year: 2026,
    });
  });

  it("loads one all-region baseline without redundant map count markers", async () => {
    const repository = {
      comparison: vi
        .fn<OverviewSamplePointRepository["comparison"]>()
        .mockResolvedValue(comparison),
      aggregates: vi.fn(),
      list: vi.fn(),
      icons: vi.fn(),
      detail: vi.fn(),
    } satisfies OverviewSamplePointRepository;

    const { result } = renderHook(() =>
      useOverviewSampleNetworkLayers({
        productCode: "CORN",
        refreshSequence: 0,
        region: undefined,
        repository,
        year: 2026,
      }),
    );

    await waitFor(() => expect(result.current.state).toBe("ready"));

    expect(repository.comparison).toHaveBeenCalledWith({
      productCode: "CORN",
      year: 2026,
    });
    expect(repository.comparison).toHaveBeenCalledTimes(1);
    expect(result.current.comparison?.designPointCount).toBe(2332);
    expect(result.current.icons).toEqual([]);
    expect(result.current.catalogState).toBe("idle");
    expect(repository.list).not.toHaveBeenCalled();
  });

  it("combines the lightweight design contract with the atomic actual snapshot", async () => {
    const samplePointId = "94000000-0000-0000-0000-000000000001";
    const designComparison = vi.fn(() =>
      Promise.resolve({
        networkYear: 2026,
        networkStatus: "PUBLISHED",
        designPointCount: 1,
        designCoordinateCount: 1,
        pendingVerificationDesignPointCount: 0,
        designPoints: [],
        relations: [
          {
            samplePointId,
            designVillageRegionCode: "230281102016",
            relationType: "EXACT_VILLAGE" as const,
            evidenceReference: null,
            reviewStatus: "APPROVED",
            createdBy: null,
            createdAt: null,
            reviewedBy: null,
            reviewedAt: null,
          },
        ],
      }),
    );
    const repository = {
      designComparison,
      comparison: vi.fn<OverviewSamplePointRepository["comparison"]>(),
      aggregates: vi.fn(),
      snapshot: vi.fn(() =>
        Promise.resolve({
          list: {
            regionCode: "230281",
            totalCount: 1,
            validCoordinateCount: 1,
            dataQualityIssueCount: 0,
            correctionSourceCount: 0,
            unresolvedSourceCount: 0,
            categories: [],
            items: [],
            correctionSources: [],
          },
          icons: [
            {
              samplePointId,
              name: "正式样本",
              iconKey: "production",
              roles: [],
              types: [],
              longitude: 124.9,
              latitude: 48.5,
              dataQualityReason: null,
            },
          ],
        }),
      ),
      list: vi.fn(),
      icons: vi.fn(),
      detail: vi.fn(),
    } satisfies OverviewSamplePointRepository;

    const { result } = renderHook(() =>
      useOverviewSampleNetworkLayers({
        productCode: "CORN",
        refreshSequence: 0,
        region: { code: "230281", level: "TOWNSHIP", name: "讷河市" },
        repository,
        year: 2026,
      }),
    );

    await waitFor(() => expect(result.current.filteredState).toBe("ready"));
    await waitFor(() => expect(result.current.state).toBe("ready"));
    expect(designComparison).toHaveBeenCalledWith({ regionCode: "230281", year: 2026 });
    expect(repository.comparison).not.toHaveBeenCalled();
    expect(result.current.comparison?.activeSamplePointCount).toBe(1);
    expect(result.current.comparison?.exactCoveredDesignPointCount).toBe(1);
  });

  it("uses the displayed township and village boundary for county-registered points and map totals", async () => {
    const point = agriculturalInputStorePoint();
    const region = {
      code: "230202001",
      name: "测试乡",
      level: "TOWNSHIP" as "TOWNSHIP" | "VILLAGE",
      parentCode: "230202",
      boundaryGeoJson: JSON.stringify({
        type: "Polygon",
        coordinates: [
          [
            [123.9, 47.3],
            [124, 47.3],
            [124, 47.4],
            [123.9, 47.4],
            [123.9, 47.3],
          ],
        ],
      }),
      approvedRecordCount: null,
    };
    const repository = {
      ...repositoryWithSnapshot(),
      designPoints: vi.fn(() =>
        Promise.resolve({
          items: [point, { ...point, id: "outside", longitude: 124.1 }],
          pageNumber: 0,
          pageSize: 100,
          totalElements: 2,
          totalPages: 1,
        }),
      ),
      designPointDefinition: vi.fn(() => Promise.resolve(agriculturalInputContract())),
    } as unknown as OverviewSamplePointRepository;
    const { result, rerender } = renderHook(
      ({ selected }) =>
        useOverviewSampleNetworkLayers({
          productCode: "CORN",
          refreshSequence: 0,
          region: selected,
          mapRegions: [region],
          repository,
          year: 2026,
        }),
      { initialProps: { selected: region } },
    );
    await waitFor(() => expect(result.current.designPointState).toBe("ready"));
    act(() => result.current.setMode("design"));
    expect(result.current.designPoints.map(({ id }) => id)).toEqual([point.id]);
    expect(result.current.icons).toHaveLength(1);
    expect(result.current.designPointAggregates?.[0]?.samplePointCount).toBe(1);
    rerender({
      selected: {
        ...region,
        code: "230202001001",
        level: "VILLAGE",
        parentCode: region.code,
      },
    });
    expect(result.current.designPoints.map(({ id }) => id)).toEqual([point.id]);
    expect(result.current.icons[0]).toMatchObject({
      longitude: point.longitude,
      latitude: point.latitude,
    });
  });

  it("maps authoritative design points with V157 labels and all four agricultural-input fields", async () => {
    const designPoints = vi.fn(() =>
      Promise.resolve({
        items: [agriculturalInputStorePoint()],
        pageNumber: 0,
        pageSize: 100,
        totalElements: 1,
        totalPages: 1,
      }),
    );
    const designPointDefinition = vi.fn(() =>
      Promise.resolve(agriculturalInputContract()),
    );
    const repository = {
      ...repositoryWithSnapshot(),
      designPoints,
      designPointDefinition,
    } as unknown as OverviewSamplePointRepository;

    const { result } = renderHook(() =>
      useOverviewSampleNetworkLayers({
        productCode: "CORN",
        refreshSequence: 0,
        region: { code: "230202", level: "TOWNSHIP", name: "齐齐哈尔市" },
        repository,
        year: 2026,
      }),
    );

    await waitFor(() => expect(result.current.designPointState).toBe("ready"));

    expect(designPoints).toHaveBeenCalledWith({
      page: 0,
      pageSize: 100,
      productCode: "CORN",
      regionCode: "230202",
    });
    expect(designPointDefinition).not.toHaveBeenCalled();
    expect(result.current.designPoints[0]?.businessValues).toEqual([]);
    const detail = presentDesignSamplePoint(
      result.current.designPoints[0]!,
      agriculturalInputContract(),
    );
    expect(detail).toMatchObject({
      name: "龙沙农资店",
      objectTypeLabel: "农资店",
      productLabel: "玉米",
      regionPath: "黑龙江省 / 齐齐哈尔市 / 龙沙区",
    });
    expect(detail.businessValues).toEqual([
      {
        code: "AGRI_INPUT_SEED_SALES_VOLUME",
        label: "种子销售量",
        value: "1200",
        unit: "公斤",
      },
      {
        code: "AGRI_INPUT_SEED_RETAIL_PRICE",
        label: "种子零售价",
        value: "8.5",
        unit: "元/公斤",
      },
      {
        code: "AGRI_INPUT_SUPPLY_STATUS",
        label: "供货状态",
        value: "充足",
        unit: null,
      },
      {
        code: "AGRI_INPUT_PLANTING_INTENTION_TREND",
        label: "种植意向趋势",
        value: "稳定",
        unit: null,
      },
    ]);
    expect(result.current.icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          samplePointId: "design-sample-point:94000000-0000-0000-0000-000000000009",
          name: "龙沙农资店",
          longitude: 123.95,
          latitude: 47.35,
        }),
      ]),
    );
  });

  it("presents generated design provenance and keeps origin facts separate", () => {
    const record = {
      ...agriculturalInputStorePoint(),
      name: "万发村设计点",
      regionCode: "230230100001",
      regionPath: "黑龙江省 / 齐齐哈尔市 / 克东县 / 克东镇 / 万发村",
      values: {
        DSP_ALLOCATION_PROVENANCE: {
          coordinateSource: "GENERATED_DESIGN",
          businessValuesStatus: "ORIGIN_ONLY_NOT_VERIFIED_AT_TARGET",
          originalRegionCode: "230202997001",
          originalName: "原龙沙农资店",
          originalAddress: "龙沙区原地址",
          originalValues: {
            AGRI_INPUT_SEED_SALES_VOLUME: 1200,
            AGRI_INPUT_SUPPLY_STATUS: "SUFFICIENT",
          },
        },
      },
    };

    const detail = presentDesignSamplePoint(record, agriculturalInputContract());

    expect(detail.allocationProvenance).toEqual({
      coordinateSource: "GENERATED_DESIGN",
      businessValuesStatus: "ORIGIN_ONLY_NOT_VERIFIED_AT_TARGET",
      originalName: "原龙沙农资店",
      originalAddress: "龙沙区原地址",
      originalBusinessValues: [
        {
          code: "AGRI_INPUT_SEED_SALES_VOLUME",
          label: "种子销售量",
          value: "1200",
          unit: "公斤",
        },
        {
          code: "AGRI_INPUT_SUPPLY_STATUS",
          label: "供货状态",
          value: "充足",
          unit: null,
        },
      ],
      hasRetainedUnpresentedOriginalValues: false,
    });
    expect(detail.businessValues).toEqual([]);
  });

  it("uses the real reference v3 identity shape and distinguishes retained unsupported origin fields", () => {
    const record = {
      ...agriculturalInputStorePoint(),
      contractVersion: "design-sample-fields-v3" as const,
      context: {
        domainCode: "REFERENCE",
        productCode: "GENERAL",
        objectTypeCode: "REFERENCE_POINT",
      },
      values: {
        DSP_ADDRESS: "万发村设计地址",
        DSP_MAINTAINER_NAME: "现维护人",
        DSP_MAINTAINER_UNIT: "克东镇维护单位",
        DSP_ALLOCATION_PROVENANCE: {
          coordinateSource: "GENERATED_DESIGN",
          businessValuesStatus: "ORIGIN_ONLY_NOT_VERIFIED_AT_TARGET",
          originalName: "原始参考点",
          originalAddress: "原始地址",
          originalValues: {
            DSP_MAINTAINER_NAME: "原维护人",
            RETIRED_PRICE_FIELD: 8.5,
          },
        },
      },
    };

    const detail = presentDesignSamplePoint(record, referencePointV3Contract());

    expect(detail.businessValues).toEqual([
      { code: "DSP_ADDRESS", label: "详细地址", value: "万发村设计地址", unit: null },
      { code: "DSP_MAINTAINER_NAME", label: "维护人", value: "现维护人", unit: null },
      {
        code: "DSP_MAINTAINER_UNIT",
        label: "维护单位",
        value: "克东镇维护单位",
        unit: null,
      },
    ]);
    expect(detail.allocationProvenance).toMatchObject({
      originalBusinessValues: [
        { code: "DSP_MAINTAINER_NAME", label: "维护人", value: "原维护人", unit: null },
      ],
      hasRetainedUnpresentedOriginalValues: true,
    });
  });

  it("does not fall back to legacy design coverage while the authoritative list is loading", async () => {
    const legacyComparison: SampleNetworkComparison = {
      ...comparison,
      designPointCount: 1,
      designPoints: [
        {
          villageRegionCode: "230202997001",
          villageName: "旧设计村",
          townshipRegionCode: "230202997",
          townshipName: "测试乡",
          countyRegionCode: "230202",
          countyName: "龙沙区",
          designLongitude: 123.9,
          designLatitude: 47.3,
          coordinateReviewStatus: "AUTHORITY_APPROVED",
          coordinateSourceName: "历史来源",
        },
      ],
    };
    const repository = {
      ...repositoryWithSnapshot(),
      comparison: vi.fn(() => Promise.resolve(legacyComparison)),
      designPoints: vi.fn(() => new Promise(() => undefined)),
      designPointDefinition: vi.fn(() => Promise.resolve(agriculturalInputContract())),
    } as unknown as OverviewSamplePointRepository;

    const { result } = renderHook(() =>
      useOverviewSampleNetworkLayers({
        productCode: "CORN",
        refreshSequence: 0,
        region: { code: "230202997", level: "TOWNSHIP", name: "测试乡" },
        repository,
        year: 2026,
      }),
    );

    await waitFor(() => expect(result.current.state).toBe("ready"));
    expect(result.current.designPointState).toBe("loading");
    expect(result.current.icons).toEqual([]);
  });

  it("explains a regional permission denial for authoritative design points", async () => {
    const repository = {
      ...repositoryWithSnapshot(),
      designPoints: vi.fn(() =>
        Promise.reject(new HttpError(403, "ACCESS_REGION_DENIED")),
      ),
      designPointDefinition: vi.fn(() => Promise.resolve(agriculturalInputContract())),
    } as unknown as OverviewSamplePointRepository;

    const { result } = renderHook(() =>
      useOverviewSampleNetworkLayers({
        productCode: "CORN",
        refreshSequence: 0,
        region: { code: "230200", level: "TOWNSHIP", name: "齐齐哈尔市" },
        repository,
        year: 2026,
      }),
    );

    await waitFor(() => expect(result.current.designPointState).toBe("unavailable"));
    expect(result.current.issue).toBe(
      "当前账号无权查看该地区的设计样本点，请返回已授权地区或联系权限管理员。",
    );
  });

  it.each(["CORN", "SOYBEAN", "RICE"])(
    "finishes the first %s catalog load when refreshes arrive before it returns",
    async (productCode) => {
      let resolveList:
        ((value: ReturnType<typeof emptySnapshot>["list"]) => void) | undefined;
      const list = vi.fn<OverviewSamplePointRepository["list"]>(
        () =>
          new Promise((resolve) => {
            resolveList = resolve;
          }),
      );
      const repository = {
        ...repositoryWithSnapshot(),
        list,
      } satisfies OverviewSamplePointRepository;
      const { result, rerender } = renderHook(
        ({ refreshSequence }) =>
          useOverviewSampleNetworkLayers({
            productCode,
            refreshSequence,
            region: { code: "230200", level: "PREFECTURE", name: "齐齐哈尔市" },
            repository,
            year: 2026,
          }),
        { initialProps: { refreshSequence: 0 } },
      );

      await waitFor(() => expect(list).toHaveBeenCalledTimes(1));
      const firstSignal = list.mock.calls[0]?.[1]?.signal;
      expect(firstSignal?.aborted).toBe(false);

      rerender({ refreshSequence: 1 });
      rerender({ refreshSequence: 2 });
      rerender({ refreshSequence: 3 });

      expect(list).toHaveBeenCalledTimes(1);
      expect(firstSignal?.aborted).toBe(false);
      expect(result.current.catalog).toBeUndefined();
      expect(result.current.catalogState).toBe("loading");

      await act(async () => {
        resolveList?.({ ...emptySnapshot("230200").list, totalCount: 12 });
        await Promise.resolve();
      });

      await waitFor(() => expect(result.current.catalog?.totalCount).toBe(12));
      expect(result.current.catalogState).toBe("ready");
      expect(result.current.catalog).toBeDefined();
      expect(list).toHaveBeenCalledTimes(2);
      expect(firstSignal?.aborted).toBe(false);
      expect(list.mock.calls.every((call) => call[0].productCode === productCode)).toBe(
        true,
      );
    },
  );

  it("keeps the loaded catalog visible when a later refresh fails", async () => {
    const list = vi
      .fn<OverviewSamplePointRepository["list"]>()
      .mockResolvedValueOnce({ ...emptySnapshot("230200").list, totalCount: 8 })
      .mockRejectedValueOnce(new Error("refresh failed"));
    const repository = {
      ...repositoryWithSnapshot(),
      list,
    } satisfies OverviewSamplePointRepository;
    const { result, rerender } = renderHook(
      ({ refreshSequence }) =>
        useOverviewSampleNetworkLayers({
          productCode: "RICE",
          refreshSequence,
          region: { code: "230200", level: "PREFECTURE", name: "齐齐哈尔市" },
          repository,
          year: 2026,
        }),
      { initialProps: { refreshSequence: 0 } },
    );

    await waitFor(() => expect(result.current.catalog?.totalCount).toBe(8));
    rerender({ refreshSequence: 1 });
    await waitFor(() => expect(list).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(result.current.issue).toBe("样本点刷新失败，继续显示上一份已加载目录。"),
    );
    expect(result.current.catalogState).toBe("ready");
    expect(result.current.catalog?.totalCount).toBe(8);
    expect(result.current.filteredList?.totalCount).toBe(8);
  });

  it("ignores a late catalog response after the selected product changes", async () => {
    let resolveCorn:
      ((value: ReturnType<typeof emptySnapshot>["list"]) => void) | undefined;
    const list = vi.fn<OverviewSamplePointRepository["list"]>(({ productCode }) => {
      if (productCode === "CORN") {
        return new Promise((resolve) => {
          resolveCorn = resolve;
        });
      }
      return Promise.resolve({ ...emptySnapshot("230200").list, totalCount: 4 });
    });
    const repository = {
      ...repositoryWithSnapshot(),
      list,
    } satisfies OverviewSamplePointRepository;
    const { result, rerender } = renderHook(
      ({ productCode }) =>
        useOverviewSampleNetworkLayers({
          productCode,
          refreshSequence: 0,
          region: { code: "230200", level: "PREFECTURE", name: "齐齐哈尔市" },
          repository,
          year: 2026,
        }),
      { initialProps: { productCode: "CORN" } },
    );

    await waitFor(() => expect(list).toHaveBeenCalledTimes(1));
    const cornSignal = list.mock.calls[0]?.[1]?.signal;
    rerender({ productCode: "SOYBEAN" });
    expect(cornSignal?.aborted).toBe(true);
    await waitFor(() => expect(result.current.catalog?.totalCount).toBe(4));

    await act(async () => {
      resolveCorn?.({ ...emptySnapshot("230200").list, totalCount: 99 });
      await Promise.resolve();
    });

    expect(result.current.catalog?.totalCount).toBe(4);
    expect(list.mock.calls.at(-1)?.[0].productCode).toBe("SOYBEAN");
  });
});

function agriculturalInputStorePoint() {
  return {
    id: "94000000-0000-0000-0000-000000000009",
    contractVersion: "design-sample-fields-v1" as const,
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
    version: 0,
    updatedAt: "2026-09-01T00:00:00Z",
  };
}

function agriculturalInputContract(): DesignSampleFieldContract {
  const field = (
    code: string,
    label: string,
    valueType: "DECIMAL" | "ENUM",
    sortOrder: number,
    unit: string | null = null,
  ) => ({
    code,
    sectionCode: "OBSERVATION" as const,
    label,
    description: label,
    valueType,
    precision: valueType === "DECIMAL" ? 18 : null,
    scale: valueType === "DECIMAL" ? 4 : null,
    maxLength: null,
    unit,
    enumOptions: valueType === "ENUM" ? ["SUFFICIENT", "STABLE"] : [],
    required: false,
    nullable: true,
    defaultValue: null,
    editable: true,
    minimumValue: null,
    maximumValue: null,
    groupCode: "AGRICULTURAL_INPUT",
    sortOrder,
    analysisRole: "DISTRIBUTION_NONNULL",
  });
  return {
    contractVersion: "design-sample-fields-v1",
    contractDigest:
      "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    context: {
      domainCode: "MARKET",
      productCode: "CORN",
      objectTypeCode: "AGRICULTURAL_INPUT_STORE",
    },
    domains: [
      {
        code: "MARKET",
        label: "市场域",
        description: "市场",
        aliases: [],
        sortOrder: 20,
      },
    ],
    products: [{ code: "CORN", label: "玉米", aliases: [], sortOrder: 10 }],
    objectTypes: [
      {
        domainCode: "MARKET",
        code: "AGRICULTURAL_INPUT_STORE",
        label: "农资店",
        aliases: [],
        sortOrder: 180,
      },
    ],
    supportedContexts: [
      {
        domainCode: "MARKET",
        productCode: "CORN",
        objectTypeCode: "AGRICULTURAL_INPUT_STORE",
        sortOrder: 260,
      },
    ],
    identityFields: [],
    observationFields: [
      field("AGRI_INPUT_SEED_SALES_VOLUME", "种子销售量", "DECIMAL", 310, "公斤"),
      field("AGRI_INPUT_SEED_RETAIL_PRICE", "种子零售价", "DECIMAL", 320, "元/公斤"),
      field("AGRI_INPUT_SUPPLY_STATUS", "供货状态", "ENUM", 330),
      field("AGRI_INPUT_PLANTING_INTENTION_TREND", "种植意向趋势", "ENUM", 340),
    ],
  };
}

function referencePointV3Contract(): DesignSampleFieldContract {
  const identity = (code: string, label: string, sortOrder: number) => ({
    code,
    sectionCode: "IDENTITY" as const,
    label,
    description: label,
    valueType: "STRING" as const,
    precision: null,
    scale: null,
    maxLength: 200,
    unit: null,
    enumOptions: [],
    required: false,
    nullable: true,
    defaultValue: null,
    editable: true,
    minimumValue: null,
    maximumValue: null,
    groupCode: "IDENTITY",
    sortOrder,
    analysisRole: "IDENTITY",
  });
  return {
    contractVersion: "design-sample-fields-v3",
    contractDigest:
      "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    context: {
      domainCode: "REFERENCE",
      productCode: "GENERAL",
      objectTypeCode: "REFERENCE_POINT",
    },
    domains: [
      {
        code: "REFERENCE",
        label: "参考点",
        description: "设计参考点",
        aliases: [],
        sortOrder: 30,
      },
    ],
    products: [{ code: "GENERAL", label: "通用", aliases: [], sortOrder: 40 }],
    objectTypes: [
      {
        domainCode: "REFERENCE",
        code: "REFERENCE_POINT",
        label: "参考点",
        aliases: [],
        sortOrder: 190,
      },
    ],
    supportedContexts: [
      {
        domainCode: "REFERENCE",
        productCode: "GENERAL",
        objectTypeCode: "REFERENCE_POINT",
        sortOrder: 280,
      },
    ],
    identityFields: [
      identity("DSP_NAME", "名称", 10),
      identity("DSP_REGION_CODE", "行政区", 20),
      identity("DSP_ADDRESS", "详细地址", 30),
      identity("DSP_LONGITUDE", "经度", 40),
      identity("DSP_LATITUDE", "纬度", 50),
      identity("DSP_MAINTAINER_NAME", "维护人", 60),
      identity("DSP_MAINTAINER_UNIT", "维护单位", 70),
    ],
    observationFields: [],
  };
}

function repositoryWithSnapshot(
  implementation: OverviewSamplePointRepository["snapshot"] = (query) =>
    Promise.resolve(emptySnapshot(query.regionCode)),
) {
  return {
    comparison: vi.fn(() => Promise.resolve(comparison)),
    aggregates: vi.fn(),
    snapshot: vi.fn(implementation),
    list: vi.fn(),
    icons: vi.fn(),
    detail: vi.fn(),
  } satisfies OverviewSamplePointRepository;
}

function emptySnapshot(regionCode: string) {
  return {
    list: {
      regionCode,
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
  };
}

function snapshotNamed(regionCode: string, name: string) {
  const snapshot = emptySnapshot(regionCode);
  return {
    ...snapshot,
    list: {
      ...snapshot.list,
      totalCount: 1,
      items: [
        {
          samplePointId: "94000000-0000-0000-0000-000000000001",
          name,
          regionCode,
          regionName: "测试地区",
          locationState: "VALID",
          dataQualityReason: null,
          categories: [],
          types: [],
          products: [],
          latestBusinessDate: null,
          summaryValues: {},
        },
      ],
    },
  };
}

function deferredSnapshot() {
  let resolve!: (value: ReturnType<typeof snapshotNamed>) => void;
  const promise = new Promise<ReturnType<typeof snapshotNamed>>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}
