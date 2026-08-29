import { act, renderHook, waitFor } from "@testing-library/react";
import { vi } from "vitest";

import type { OverviewSamplePointRepository } from "../../application/ports/OverviewSamplePointRepository";
import type { SampleNetworkComparison } from "../../domain/overviewSamplePoint";
import { useOverviewSampleNetworkLayers } from "./useOverviewSampleNetworkLayers";

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
        region: { code: "230281", level: "COUNTY", name: "讷河市" },
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
    expect(repository.list).not.toHaveBeenCalled();
    expect(repository.icons).not.toHaveBeenCalled();

    act(() => {
      refreshPending = true;
      refreshSequence = 1;
      rerender();
    });

    await waitFor(() => expect(result.current.filteredState).toBe("loading"));
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
        region: { code: "230281", level: "COUNTY", name: "讷河市" },
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
      list: vi.fn(() =>
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
      icons: vi.fn(() => Promise.resolve([])),
      detail: vi.fn(),
    } satisfies OverviewSamplePointRepository;

    const { result } = renderHook(() =>
      useOverviewSampleNetworkLayers({
        productCode: "RICE",
        refreshSequence: 0,
        region: { code: "230200", level: "PREFECTURE", name: "齐齐哈尔市" },
        repository,
        year: 2025,
      }),
    );

    await waitFor(() => expect(result.current.catalogState).toBe("ready"));
    expect(repository.list).toHaveBeenCalledWith({
      productCode: "RICE",
      regionCode: "230200",
      year: 2025,
    });
    expect(repository.icons).toHaveBeenCalledWith({
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
      list: vi.fn(() =>
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
      icons: vi.fn(() => Promise.resolve([])),
      detail: vi.fn(),
    } satisfies OverviewSamplePointRepository;

    const { result } = renderHook(() =>
      useOverviewSampleNetworkLayers({
        productCode: "RICE",
        refreshSequence: 0,
        region: { code: "230200", level: "PREFECTURE", name: "齐齐哈尔市" },
        repository,
        year: 2026,
      }),
    );

    await waitFor(() => expect(result.current.catalogState).toBe("ready"));
    expect(repository.icons).toHaveBeenCalledWith({
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
        region: { code: "230281", level: "COUNTY", name: "讷河市" },
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
});
