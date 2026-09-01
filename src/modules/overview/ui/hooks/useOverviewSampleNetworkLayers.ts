import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { OverviewSamplePointRepository } from "../../application/ports/OverviewSamplePointRepository";
import type {
  OverviewSamplePointCategoryCode,
  OverviewDesignSamplePoint,
  OverviewDesignSamplePointRecord,
  OverviewSamplePointIcon,
  OverviewSamplePointList,
  SampleNetworkComparison,
  SampleNetworkDesignComparison,
  SampleNetworkLayerMode,
} from "../../domain/overviewSamplePoint";
import { sampleNetworkLayerIcons } from "../presentation/sampleNetworkLayers";
import { HttpError } from "../../../../shared/api/HttpClient";

export type SampleNetworkLoadState = "idle" | "loading" | "ready" | "unavailable";

type RegionLevel = "PREFECTURE" | "COUNTY" | "TOWNSHIP" | "VILLAGE";

export interface OverviewSampleNetworkRegion {
  code: string;
  level: RegionLevel;
  name: string;
  parentCode?: string;
}

export interface OverviewSampleNetworkLayerModel {
  applicable: boolean;
  catalog: OverviewSamplePointList | undefined;
  catalogState: SampleNetworkLoadState;
  categoryCode: OverviewSamplePointCategoryCode | undefined;
  comparison: SampleNetworkComparison | undefined;
  designPoints: readonly OverviewDesignSamplePoint[];
  designPointState: SampleNetworkLoadState;
  actualIcons?: readonly OverviewSamplePointIcon[];
  filteredList?: OverviewSamplePointList;
  filteredState?: SampleNetworkLoadState;
  icons: readonly OverviewSamplePointIcon[];
  issue: string | undefined;
  mode: SampleNetworkLayerMode;
  query?: string;
  retryFiltered?: () => void;
  region: OverviewSampleNetworkRegion | undefined;
  setCategoryCode: (categoryCode: OverviewSamplePointCategoryCode | undefined) => void;
  setMode: (mode: SampleNetworkLayerMode) => void;
  setQuery?: (query: string) => void;
  setQueryComposition?: (composing: boolean) => void;
  setShowExactDesignLocations: (show: boolean) => void;
  showExactDesignLocations: boolean;
  state: SampleNetworkLoadState;
  setTypeCode: (typeCode: string | undefined) => void;
  typeCode: string | undefined;
}

const SEARCH_DEBOUNCE_MS = 250;
const DESIGN_SAMPLE_PAGE_SIZE = 100;

export function useOverviewSampleNetworkLayers({
  productCode,
  refreshSequence,
  region,
  repository,
  year,
}: {
  productCode: string;
  refreshSequence: number;
  region: OverviewSampleNetworkRegion | undefined;
  repository: OverviewSamplePointRepository | undefined;
  year: number | undefined;
}): OverviewSampleNetworkLayerModel {
  const applicable = year !== undefined;
  const regionCode = region?.code;
  const regionLevel = region?.level;
  const regionParentCode = region?.parentCode;
  const filterScopeKey = `${productCode}:${year ?? ""}:${regionCode ?? ""}`;
  const [mode, setMode] = useState<SampleNetworkLayerMode>("comparison");
  const [filterStateScopeKey, setFilterStateScopeKey] = useState(filterScopeKey);
  const [storedCategoryCode, setCategoryCodeState] =
    useState<OverviewSamplePointCategoryCode>();
  const [storedTypeCode, setTypeCodeState] = useState<string>();
  const [catalog, setCatalog] = useState<OverviewSamplePointList>();
  const [catalogState, setCatalogState] = useState<SampleNetworkLoadState>("idle");
  const [catalogIssue, setCatalogIssue] = useState<string>();
  const [actualIcons, setActualIcons] = useState<readonly OverviewSamplePointIcon[]>(
    [],
  );
  const [filteredList, setFilteredList] = useState<OverviewSamplePointList>();
  const [filteredState, setFilteredState] = useState<SampleNetworkLoadState>("idle");
  const [storedQuery, setQueryState] = useState("");
  const [requestQuery, setRequestQuery] = useState("");
  const [queryComposing, setQueryComposition] = useState(false);
  const [filteredRetrySequence, setFilteredRetrySequence] = useState(0);
  const [showExactDesignLocations, setShowExactDesignLocations] = useState(false);
  const [comparisonSource, setComparisonSource] = useState<
    SampleNetworkComparison | SampleNetworkDesignComparison
  >();
  const [designPoints, setDesignPoints] = useState<
    readonly OverviewDesignSamplePoint[]
  >([]);
  const [designPointState, setDesignPointState] =
    useState<SampleNetworkLoadState>("idle");
  const [designPointIssue, setDesignPointIssue] = useState<string>();
  const [state, setState] = useState<SampleNetworkLoadState>("idle");
  const [issue, setIssue] = useState<string>();
  const categoryCode =
    filterStateScopeKey === filterScopeKey ? storedCategoryCode : undefined;
  const typeCode = filterStateScopeKey === filterScopeKey ? storedTypeCode : undefined;
  const query = filterStateScopeKey === filterScopeKey ? storedQuery : "";
  const comparisonRegionCode =
    regionLevel === "VILLAGE" ? regionParentCode : regionCode;
  const comparisonScopeKey = `${productCode}:${year ?? ""}:${comparisonRegionCode ?? ""}`;
  const filteredScopeKey = `${filterScopeKey}:${categoryCode ?? ""}:${typeCode ?? ""}:${requestQuery.trim()}`;
  const comparisonSnapshotScopeRef = useRef("");
  const catalogSnapshotScopeRef = useRef("");
  const filteredSnapshotScopeRef = useRef("");
  const canLoadComparison = Boolean(applicable && repository && productCode);
  const canLoadCatalog = Boolean(applicable && repository && productCode && regionCode);
  const canLoadDesignPoints = Boolean(
    repository?.designPoints && repository.designPointDefinition && productCode,
  );

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (!active) return;
      setDesignPointState(canLoadDesignPoints ? "loading" : "idle");
      setDesignPointIssue(undefined);
      if (!canLoadDesignPoints) setDesignPoints([]);
    });
    if (
      !canLoadDesignPoints ||
      !repository?.designPoints ||
      !repository.designPointDefinition
    ) {
      return () => {
        active = false;
      };
    }
    loadDesignSamplePoints(repository, productCode)
      .then((next) => {
        if (!active) return;
        setDesignPoints(next);
        setDesignPointState("ready");
      })
      .catch((failure: unknown) => {
        if (!active) return;
        setDesignPoints([]);
        setDesignPointState("unavailable");
        setDesignPointIssue(designPointLoadIssue(failure));
      });
    return () => {
      active = false;
    };
  }, [canLoadDesignPoints, productCode, refreshSequence, repository]);

  const setCategoryCode = useCallback(
    (next: OverviewSamplePointCategoryCode | undefined) => {
      setFilterStateScopeKey(filterScopeKey);
      setCategoryCodeState(next);
      setTypeCodeState(undefined);
      setQueryState("");
      setRequestQuery("");
      setQueryComposition(false);
    },
    [filterScopeKey],
  );
  const setTypeCode = useCallback(
    (next: string | undefined) => {
      setFilterStateScopeKey(filterScopeKey);
      setTypeCodeState(next);
    },
    [filterScopeKey],
  );
  const setQuery = useCallback(
    (next: string) => {
      setFilterStateScopeKey(filterScopeKey);
      setQueryState(next);
      if (!next.trim()) setRequestQuery("");
    },
    [filterScopeKey],
  );
  const retryFiltered = useCallback(() => {
    setFilteredRetrySequence((current) => current + 1);
  }, []);

  useEffect(() => {
    if (queryComposing) return;
    const trimmed = storedQuery.trim();
    if (!trimmed) return;
    const timer = window.setTimeout(() => {
      setRequestQuery(trimmed);
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [queryComposing, storedQuery]);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (!active) return;
      setFilterStateScopeKey(filterScopeKey);
      setCategoryCodeState(undefined);
      setTypeCodeState(undefined);
      setQueryState("");
      setRequestQuery("");
      setQueryComposition(false);
    });
    return () => {
      active = false;
    };
  }, [filterScopeKey]);

  useEffect(() => {
    let active = true;
    const sameScope = comparisonSnapshotScopeRef.current === comparisonScopeKey;
    void Promise.resolve().then(() => {
      if (!active) return;
      if (!sameScope) {
        setComparisonSource(undefined);
      }
      setState(canLoadComparison ? "loading" : "idle");
      setIssue(undefined);
    });
    if (!canLoadComparison || !repository || year === undefined) {
      return () => {
        active = false;
      };
    }
    const comparisonRequest = repository.designComparison
      ? repository.designComparison({
          year,
          ...(comparisonRegionCode ? { regionCode: comparisonRegionCode } : {}),
        })
      : repository.comparison({
          productCode,
          year,
          ...(comparisonRegionCode ? { regionCode: comparisonRegionCode } : {}),
        });
    comparisonRequest
      .then((next) => {
        if (!active) return;
        comparisonSnapshotScopeRef.current = comparisonScopeKey;
        setComparisonSource(next);
        setState("ready");
      })
      .catch(() => {
        if (!active) return;
        if (!sameScope) {
          setComparisonSource(undefined);
        }
        setState("unavailable");
        setIssue("设计样本点与年度样本网络加载失败，请稍后重试。");
      });
    return () => {
      active = false;
    };
  }, [
    canLoadComparison,
    comparisonScopeKey,
    comparisonRegionCode,
    productCode,
    refreshSequence,
    repository,
    year,
  ]);

  const selectedCategory = catalog?.categories.find(
    (category) => category.code === categoryCode,
  );
  const actualKindCodes = useMemo(
    () =>
      categoryCode
        ? typeCode
          ? [typeCode]
          : (selectedCategory?.types.map(({ code }) => code) ?? [])
        : undefined,
    [categoryCode, selectedCategory, typeCode],
  );

  useEffect(() => {
    repository?.invalidateFormalCatalog?.();
  }, [refreshSequence, repository]);

  useEffect(() => {
    let active = true;
    const sameScope = filteredSnapshotScopeRef.current === filteredScopeKey;
    const sameCatalogScope = catalogSnapshotScopeRef.current === filterScopeKey;
    const unfiltered = !categoryCode && !typeCode && !requestQuery.trim();
    const controller = new AbortController();
    const filters = {
      productCode,
      regionCode: regionCode ?? "",
      year: year ?? 0,
      ...(categoryCode ? { categoryCode } : {}),
      ...(typeCode ? { typeCode } : {}),
      ...(requestQuery.trim() ? { query: requestQuery.trim() } : {}),
    };
    void Promise.resolve().then(() => {
      if (!active) return;
      if (!sameScope) {
        setActualIcons([]);
        setFilteredList(undefined);
      }
      if (unfiltered) {
        if (!sameCatalogScope) setCatalog(undefined);
        setCatalogState(canLoadCatalog ? "loading" : "idle");
        setCatalogIssue(undefined);
      }
      setFilteredState(canLoadCatalog ? "loading" : "idle");
    });
    if (!canLoadCatalog || !repository || year === undefined || !regionCode) {
      return () => {
        active = false;
        controller.abort();
      };
    }
    const snapshotRequest = repository.snapshot
      ? repository.snapshot(
          { ...filters, ...(region?.name ? { regionName: region.name } : {}) },
          { signal: controller.signal },
        )
      : Promise.all([
          repository.list(filters, { signal: controller.signal }),
          repository.icons(filters, { signal: controller.signal }),
        ]).then(([list, icons]) => ({ icons, list }));
    snapshotRequest
      .then(({ icons: nextIcons, list: nextList }) => {
        if (!active) return;
        filteredSnapshotScopeRef.current = filteredScopeKey;
        setFilteredList(nextList);
        setActualIcons(nextIcons);
        setFilteredState("ready");
        if (unfiltered) {
          catalogSnapshotScopeRef.current = filterScopeKey;
          setCatalog(nextList);
          setCatalogState("ready");
          setCatalogIssue(undefined);
        }
      })
      .catch(() => {
        if (!active) return;
        if (!sameScope) {
          setFilteredList(undefined);
          setActualIcons([]);
        }
        setFilteredState("unavailable");
        if (unfiltered) {
          if (!sameCatalogScope) setCatalog(undefined);
          setCatalogState("unavailable");
          setCatalogIssue("样本点分类加载失败，请稍后重试。");
        }
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [
    canLoadCatalog,
    categoryCode,
    filterScopeKey,
    filteredScopeKey,
    filteredRetrySequence,
    productCode,
    requestQuery,
    refreshSequence,
    regionCode,
    region?.name,
    repository,
    typeCode,
    year,
  ]);

  const comparison = useMemo(
    () =>
      comparisonSource
        ? synchronizeDesignComparison(
            comparisonSource,
            catalog && catalog.items.length === catalog.totalCount
              ? catalog.items.map(({ samplePointId }) => samplePointId)
              : actualIcons.map(({ samplePointId }) => samplePointId),
          )
        : undefined,
    [actualIcons, catalog, comparisonSource],
  );
  const visibleDesignPoints = useMemo(
    () =>
      regionCode
        ? designPoints.filter(({ regionCode: pointRegionCode }) =>
            regionContains(regionCode, pointRegionCode),
          )
        : designPoints,
    [designPoints, regionCode],
  );

  const icons = useMemo(() => {
    if (!regionCode || !regionLevel) return [];
    const missingVillageParent = regionLevel === "VILLAGE" && !regionParentCode;
    if (missingVillageParent) {
      if (mode === "design") return [];
      return sampleNetworkLayerIcons("actual", actualIcons, undefined, {
        ...(actualKindCodes ? { actualKindCodes } : {}),
        regionLevel,
        selectedRegionCode: regionCode,
      });
    }
    return sampleNetworkLayerIcons(
      mode,
      actualIcons,
      comparison,
      {
        ...(actualKindCodes ? { actualKindCodes } : {}),
        regionLevel,
        selectedRegionCode: regionCode,
        ...(comparisonRegionCode
          ? { summaryAnchorRegionCode: comparisonRegionCode }
          : {}),
        showExactDesignLocations,
      },
      canLoadDesignPoints ? visibleDesignPoints : undefined,
    );
  }, [
    actualIcons,
    actualKindCodes,
    canLoadDesignPoints,
    comparison,
    comparisonRegionCode,
    mode,
    regionCode,
    regionLevel,
    regionParentCode,
    showExactDesignLocations,
    visibleDesignPoints,
  ]);

  return {
    applicable,
    actualIcons,
    catalog,
    catalogState,
    categoryCode,
    comparison,
    designPoints: visibleDesignPoints,
    designPointState,
    ...(filteredList ? { filteredList } : {}),
    filteredState,
    icons,
    issue: designPointIssue ?? catalogIssue ?? issue,
    mode,
    query,
    retryFiltered,
    region,
    setCategoryCode,
    setMode,
    setQuery,
    setQueryComposition,
    setShowExactDesignLocations,
    showExactDesignLocations,
    state,
    setTypeCode,
    typeCode,
  };
}

function designPointLoadIssue(failure: unknown): string {
  if (failure instanceof HttpError && failure.status === 403) {
    return "当前账号无权查看该地区的设计样本点，请返回已授权地区或联系权限管理员。";
  }
  return "设计样本点或行政区边界数据暂不可用，请稍后重试。";
}

async function loadDesignSamplePoints(
  repository: OverviewSamplePointRepository,
  productCode: string,
): Promise<readonly OverviewDesignSamplePoint[]> {
  if (!repository.designPoints || !repository.designPointDefinition) return [];
  const first = await repository.designPoints({
    page: 0,
    pageSize: DESIGN_SAMPLE_PAGE_SIZE,
    productCode,
  });
  const records = [...first.items];
  for (let page = 1; page < first.totalPages; page += 1) {
    const next = await repository.designPoints({
      page,
      pageSize: DESIGN_SAMPLE_PAGE_SIZE,
      productCode,
    });
    records.push(...next.items);
  }
  const uniqueRecords = [
    ...new Map(records.map((record) => [record.id, record] as const)).values(),
  ];
  const contexts = new Map(
    uniqueRecords.map((record) => [contextKey(record), record.context] as const),
  );
  const definitions = new Map(
    await Promise.all(
      [...contexts].map(
        async ([key, context]) =>
          [key, await repository.designPointDefinition!(context)] as const,
      ),
    ),
  );
  return uniqueRecords.map((record) => {
    const definition = definitions.get(contextKey(record));
    if (!definition || definition.contractDigest !== record.contractDigest) {
      throw new Error("Design sample point metadata mismatch");
    }
    return presentDesignSamplePoint(record, definition);
  });
}

function presentDesignSamplePoint(
  record: OverviewDesignSamplePointRecord,
  definition: Awaited<
    ReturnType<NonNullable<OverviewSamplePointRepository["designPointDefinition"]>>
  >,
): OverviewDesignSamplePoint {
  const domainLabel = definition.domains.find(
    ({ code }) => code === record.context.domainCode,
  )?.label;
  const productLabel = definition.products.find(
    ({ code }) => code === record.context.productCode,
  )?.label;
  const objectTypeLabel = definition.objectTypes.find(
    ({ code }) => code === record.context.objectTypeCode,
  )?.label;
  if (!domainLabel || !productLabel || !objectTypeLabel) {
    throw new Error("Design sample point catalog mismatch");
  }
  return {
    ...record,
    domainLabel,
    productLabel,
    objectTypeLabel,
    businessValues: definition.observationFields.flatMap((field) => {
      const value = record.values[field.code];
      if (value === undefined || value === null) return [];
      return [
        {
          code: field.code,
          label: field.label,
          value: designSampleValueLabel(value),
          unit: field.unit,
        },
      ];
    }),
  };
}

function contextKey({ context }: Pick<OverviewDesignSamplePointRecord, "context">) {
  return `${context.domainCode}:${context.productCode}:${context.objectTypeCode}`;
}

function designSampleValueLabel(value: unknown) {
  const labels: Readonly<Record<string, string>> = {
    GOOD: "良好",
    NORMAL: "正常",
    POOR: "偏弱",
    SUFFICIENT: "充足",
    TIGHT: "偏紧",
    OUT_OF_STOCK: "缺货",
    INCREASE: "增加",
    STABLE: "稳定",
    DECREASE: "减少",
  };
  if (typeof value === "string") return labels[value] ?? value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  throw new Error("Unsupported design sample point display value");
}

function regionContains(selectedRegionCode: string, pointRegionCode: string) {
  if (selectedRegionCode === pointRegionCode) return true;
  if (/^\d{6}$/u.test(selectedRegionCode) && selectedRegionCode.endsWith("00")) {
    return pointRegionCode.startsWith(selectedRegionCode.slice(0, 4));
  }
  return pointRegionCode.startsWith(selectedRegionCode);
}

function synchronizeDesignComparison(
  source: SampleNetworkComparison | SampleNetworkDesignComparison,
  samplePointIds: readonly string[],
): SampleNetworkComparison {
  const activeIds = new Set(samplePointIds);
  const exact = new Set<string>();
  const represented = new Set<string>();
  const regional = new Set<string>();
  source.relations
    .filter(
      (relation) =>
        activeIds.has(relation.samplePointId) &&
        relation.reviewStatus === "APPROVED" &&
        relation.relationType === "EXACT_VILLAGE",
    )
    .forEach(({ designVillageRegionCode }) => exact.add(designVillageRegionCode));
  source.relations
    .filter(
      (relation) =>
        activeIds.has(relation.samplePointId) &&
        relation.reviewStatus === "APPROVED" &&
        relation.relationType === "EXPLICIT_REPRESENTATION" &&
        !exact.has(relation.designVillageRegionCode),
    )
    .forEach(({ designVillageRegionCode }) => represented.add(designVillageRegionCode));
  source.relations
    .filter(
      (relation) =>
        activeIds.has(relation.samplePointId) &&
        relation.relationType === "REGIONAL_ASSOCIATION" &&
        !exact.has(relation.designVillageRegionCode) &&
        !represented.has(relation.designVillageRegionCode),
    )
    .forEach(({ designVillageRegionCode }) => regional.add(designVillageRegionCode));
  const multipleActualPerDesignPointCount = [
    ...source.relations
      .filter(
        (relation) =>
          activeIds.has(relation.samplePointId) &&
          relation.reviewStatus === "APPROVED" &&
          (relation.relationType === "EXACT_VILLAGE" ||
            relation.relationType === "EXPLICIT_REPRESENTATION"),
      )
      .reduce((byVillage, relation) => {
        const ids =
          byVillage.get(relation.designVillageRegionCode) ?? new Set<string>();
        ids.add(relation.samplePointId);
        byVillage.set(relation.designVillageRegionCode, ids);
        return byVillage;
      }, new Map<string, Set<string>>())
      .values(),
  ].filter((ids) => ids.size > 1).length;
  const full = "actualPoints" in source ? source : undefined;
  const associated = exact.size + represented.size + regional.size;
  return {
    ...source,
    activeSamplePointCount: activeIds.size,
    approvedSubmissionSamplePointCount: activeIds.size,
    multipleActualPerDesignPointCount,
    anomalyCount:
      source.designPoints.filter(
        ({ coordinateMatchConfidence }) => coordinateMatchConfidence === "LOW",
      ).length +
      source.relations.filter(({ reviewStatus }) => reviewStatus === "RETURNED").length,
    exactCoveredDesignPointCount: exact.size,
    representedDesignPointCount: represented.size,
    regionalAssociationDesignPointCount: regional.size,
    unrelatedDesignPointCount: Math.max(0, source.designPointCount - associated),
    actualLevelCounts: full?.actualLevelCounts ?? {
      prefecture: 0,
      county: 0,
      township: 0,
      village: 0,
    },
    actualPoints: full?.actualPoints ?? [],
  };
}
