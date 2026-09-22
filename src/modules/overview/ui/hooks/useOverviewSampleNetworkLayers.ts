import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { OverviewSamplePointRepository } from "../../application/ports/OverviewSamplePointRepository";
import type {
  OverviewSamplePointCategoryCode,
  OverviewSamplePointAggregate,
  OverviewDesignSamplePoint,
  OverviewDesignSamplePointRecord,
  OverviewSamplePointIcon,
  OverviewSamplePointList,
  SampleNetworkComparison,
  SampleNetworkDesignComparison,
  SampleNetworkLayerMode,
} from "../../domain/overviewSamplePoint";
import {
  designPointsInRegion,
  designPointRegionAggregates,
} from "../presentation/designSampleRegionScope";
import { sampleNetworkLayerIcons } from "../presentation/sampleNetworkLayers";
import { HttpError } from "../../../../shared/api/HttpClient";

export type SampleNetworkLoadState = "idle" | "loading" | "ready" | "unavailable";

type RegionLevel = "PREFECTURE" | "COUNTY" | "TOWNSHIP" | "VILLAGE";

export interface OverviewSampleNetworkRegion {
  code: string;
  level: RegionLevel;
  name: string;
  parentCode?: string;
  boundaryGeoJson?: string;
}

export interface OverviewSampleNetworkLayerModel {
  applicable: boolean;
  catalog: OverviewSamplePointList | undefined;
  catalogState: SampleNetworkLoadState;
  categoryCode: OverviewSamplePointCategoryCode | undefined;
  comparison: SampleNetworkComparison | undefined;
  designPoints: readonly OverviewDesignSamplePoint[];
  designPointState: SampleNetworkLoadState;
  designPointAggregates?: readonly OverviewSamplePointAggregate[];
  historicalIcons?: readonly OverviewSamplePointIcon[];
  historicalAggregates?: readonly OverviewSamplePointAggregate[];
  historicalState?: SampleNetworkLoadState;
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
  year?: number;
}

const SEARCH_DEBOUNCE_MS = 250;
const DESIGN_SAMPLE_PAGE_SIZE = 100;

interface SampleLoadFlight {
  refresh: number;
  trailing: boolean;
  controller: AbortController;
}

function isAbortError(error: unknown) {
  return error instanceof DOMException
    ? error.name === "AbortError"
    : error instanceof Error && error.name === "AbortError";
}

interface IconTypeCount {
  code: string;
  name: string;
  iconKey: string;
  count: number;
}

function listFromIcons(
  regionCode: string,
  icons: readonly OverviewSamplePointIcon[],
): OverviewSamplePointList {
  const categories = new Map<
    string,
    {
      code: "PRODUCTION" | "MARKET" | "LOGISTICS";
      name: string;
      count: number;
      types: Map<string, IconTypeCount>;
    }
  >();
  for (const icon of icons) {
    for (const role of icon.roles ?? []) {
      const category = categories.get(role.code) ?? {
        code: role.code,
        name: role.name,
        count: 0,
        types: new Map<string, IconTypeCount>(),
      };
      category.count += 1;
      for (const type of icon.types) {
        const current = category.types.get(type.code);
        if (current) {
          current.count += 1;
        } else {
          category.types.set(type.code, {
            code: type.code,
            name: type.name,
            iconKey: type.iconKey,
            count: 1,
          });
        }
      }
      categories.set(role.code, category);
    }
  }
  return {
    regionCode,
    totalCount: icons.length,
    validCoordinateCount: icons.filter(
      (icon) =>
        icon.longitude != null && icon.latitude != null && !icon.dataQualityReason,
    ).length,
    dataQualityIssueCount: icons.filter((icon) => icon.dataQualityReason).length,
    correctionSourceCount: 0,
    unresolvedSourceCount: 0,
    categories: [...categories.values()].map((category) => ({
      code: category.code,
      name: category.name,
      count: category.count,
      types: [...category.types.values()],
    })),
    items: icons.map((icon) => ({
      samplePointId: icon.samplePointId,
      name: icon.name,
      regionCode: icon.regionCode ?? regionCode,
      regionName: "",
      locationState: "VALID",
      dataQualityReason: icon.dataQualityReason,
      categories: (icon.roles ?? []).map((role) => ({
        code: role.code,
        name: role.name,
      })),
      types: icon.types,
      products: [],
      latestBusinessDate: null,
      summaryValues: {},
    })),
    correctionSources: [],
  };
}

function releaseFlight(
  flightRef: { current: SampleLoadFlight | null },
  flight: SampleLoadFlight,
  refreshNow: number,
  start: () => void,
) {
  if (flightRef.current !== flight) return;
  const follow = flight.trailing || refreshNow !== flight.refresh;
  flightRef.current = null;
  if (follow) start();
}

export function useOverviewSampleNetworkLayers({
  productCode,
  mapRegions,
  mapParentCode,
  refreshSequence,
  region,
  repository,
  year,
}: {
  productCode: string;
  mapRegions?: readonly OverviewSampleNetworkRegion[];
  mapParentCode?: string | undefined;
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
  const [historicalIcons, setHistoricalIcons] = useState<
    readonly OverviewSamplePointIcon[]
  >([]);
  const [historicalAggregates, setHistoricalAggregates] = useState<
    readonly OverviewSamplePointAggregate[]
  >([]);
  const [historicalState, setHistoricalState] =
    useState<SampleNetworkLoadState>("idle");
  const [historicalIssue, setHistoricalIssue] = useState<string>();
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
  const catalogRefreshSequenceRef = useRef<number | undefined>(undefined);
  const filteredSnapshotScopeRef = useRef("");
  const refreshSequenceRef = useRef(refreshSequence);
  const catalogFlightRef = useRef<SampleLoadFlight | null>(null);
  const comparisonFlightRef = useRef<SampleLoadFlight | null>(null);
  const historicalFlightRef = useRef<SampleLoadFlight | null>(null);
  const designFlightRef = useRef<SampleLoadFlight | null>(null);
  const comparisonReadyScopeRef = useRef("");
  const historicalReadyScopeRef = useRef("");
  const designReadyScopeRef = useRef("");
  const startCatalogRef = useRef<() => void>(() => {});
  const startComparisonRef = useRef<() => void>(() => {});
  const startHistoricalRef = useRef<() => void>(() => {});
  const startDesignRef = useRef<() => void>(() => {});
  const canLoadComparison = Boolean(applicable && repository && productCode);
  const pointLevel = regionLevel === "TOWNSHIP" || regionLevel === "VILLAGE";
  const canLoadCatalog = Boolean(applicable && repository && productCode && regionCode);
  const canLoadHistorical = Boolean(
    applicable &&
    repository &&
    productCode &&
    mode === "historical" &&
    (regionCode
      ? typeof repository.historicalIcons === "function"
      : typeof repository.historicalAggregates === "function"),
  );
  const canLoadDesignPoints = Boolean(
    (repository?.designMapCatalog ||
      (repository?.designPoints && repository.designPointDefinition)) &&
    productCode &&
    regionCode,
  );

  const previousRefresh = useRef(refreshSequence);
  useEffect(() => {
    if (previousRefresh.current !== refreshSequence)
      repository?.invalidateFormalCatalog?.();
    previousRefresh.current = refreshSequence;
  }, [refreshSequence, repository]);

  useEffect(() => {
    refreshSequenceRef.current = refreshSequence;
  }, [refreshSequence]);

  useEffect(() => {
    startDesignRef.current = () => {
      const refresh = refreshSequenceRef.current;
      const existing = designFlightRef.current;
      if (existing) {
        if (existing.refresh !== refresh) existing.trailing = true;
        return;
      }
      const scope = `${productCode}:${regionCode ?? ""}:${canLoadDesignPoints}`;
      const retain = designReadyScopeRef.current === scope && canLoadDesignPoints;
      if (!retain) {
        setDesignPointState(canLoadDesignPoints ? "loading" : "idle");
        setDesignPointIssue(undefined);
        if (!canLoadDesignPoints) setDesignPoints([]);
      }
      if (
        !canLoadDesignPoints ||
        !repository ||
        (!repository.designMapCatalog &&
          (!repository.designPoints || !repository.designPointDefinition))
      ) {
        return;
      }
      const flight: SampleLoadFlight = {
        refresh,
        trailing: false,
        controller: new AbortController(),
      };
      designFlightRef.current = flight;
      loadDesignSamplePoints(repository, productCode, regionCode?.slice(0, 6))
        .then((next) => {
          if (designFlightRef.current !== flight) return;
          designReadyScopeRef.current = scope;
          setDesignPoints(next);
          setDesignPointState("ready");
          setDesignPointIssue(undefined);
        })
        .catch((failure: unknown) => {
          if (designFlightRef.current !== flight) return;
          if (isAbortError(failure) && flight.controller.signal.aborted) return;
          if (!retain) {
            setDesignPoints([]);
            setDesignPointState("unavailable");
          }
          setDesignPointIssue(designPointLoadIssue(failure));
        })
        .finally(() => {
          releaseFlight(designFlightRef, flight, refreshSequenceRef.current, () =>
            startDesignRef.current(),
          );
        });
    };
    startDesignRef.current();
    return () => {
      designFlightRef.current?.controller.abort();
      designFlightRef.current = null;
    };
  }, [canLoadDesignPoints, productCode, regionCode, repository]);

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
    startComparisonRef.current = () => {
      const refresh = refreshSequenceRef.current;
      const existing = comparisonFlightRef.current;
      if (existing) {
        if (existing.refresh !== refresh) existing.trailing = true;
        return;
      }
      const retain =
        comparisonReadyScopeRef.current === comparisonScopeKey && canLoadComparison;
      if (!retain) {
        if (comparisonSnapshotScopeRef.current !== comparisonScopeKey) {
          setComparisonSource(undefined);
        }
        setState(canLoadComparison ? "loading" : "idle");
        setIssue(undefined);
      }
      if (!canLoadComparison || !repository || year === undefined) return;
      const flight: SampleLoadFlight = {
        refresh,
        trailing: false,
        controller: new AbortController(),
      };
      comparisonFlightRef.current = flight;
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
          if (comparisonFlightRef.current !== flight) return;
          comparisonSnapshotScopeRef.current = comparisonScopeKey;
          comparisonReadyScopeRef.current = comparisonScopeKey;
          setComparisonSource(next);
          setState("ready");
          setIssue(undefined);
        })
        .catch((failure: unknown) => {
          if (comparisonFlightRef.current !== flight) return;
          if (isAbortError(failure) && flight.controller.signal.aborted) return;
          if (!retain) {
            if (comparisonSnapshotScopeRef.current !== comparisonScopeKey) {
              setComparisonSource(undefined);
            }
            setState("unavailable");
          }
          setIssue("设计样本点与年度样本网络加载失败，请稍后重试。");
        })
        .finally(() => {
          releaseFlight(comparisonFlightRef, flight, refreshSequenceRef.current, () =>
            startComparisonRef.current(),
          );
        });
    };
    startComparisonRef.current();
    return () => {
      comparisonFlightRef.current?.controller.abort();
      comparisonFlightRef.current = null;
    };
  }, [
    canLoadComparison,
    comparisonScopeKey,
    comparisonRegionCode,
    productCode,
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
    startHistoricalRef.current = () => {
      const refresh = refreshSequenceRef.current;
      const existing = historicalFlightRef.current;
      if (existing) {
        if (existing.refresh !== refresh) existing.trailing = true;
        return;
      }
      const scope = [
        productCode,
        year ?? "",
        regionCode ?? "",
        mapParentCode ?? "",
        categoryCode ?? "",
        typeCode ?? "",
        requestQuery.trim(),
        canLoadHistorical,
      ].join(":");
      const retain = historicalReadyScopeRef.current === scope && canLoadHistorical;
      if (!retain) {
        setHistoricalState(canLoadHistorical ? "loading" : "idle");
        setHistoricalIssue(undefined);
        setHistoricalIcons([]);
        setHistoricalAggregates([]);
      }
      if (!canLoadHistorical || !repository || year === undefined) return;
      const flight: SampleLoadFlight = {
        refresh,
        trailing: false,
        controller: new AbortController(),
      };
      historicalFlightRef.current = flight;
      Promise.all([
        regionCode && repository.historicalIcons
          ? repository.historicalIcons(
              {
                productCode,
                regionCode,
                year,
                ...(categoryCode ? { categoryCode } : {}),
                ...(typeCode ? { typeCode } : {}),
                ...(requestQuery.trim() ? { query: requestQuery.trim() } : {}),
              },
              { signal: flight.controller.signal },
            )
          : Promise.resolve([]),
        repository.historicalAggregates?.(
          {
            productCode,
            year,
            ...(mapParentCode ? { parentCode: mapParentCode } : {}),
            ...(categoryCode ? { categoryCode } : {}),
            ...(typeCode ? { typeCode } : {}),
            ...(requestQuery.trim() ? { query: requestQuery.trim() } : {}),
          },
          { signal: flight.controller.signal },
        ) ?? Promise.resolve([]),
      ])
        .then(([next, aggregates]) => {
          if (historicalFlightRef.current !== flight) return;
          historicalReadyScopeRef.current = scope;
          setHistoricalAggregates(
            aggregates.map((aggregate) => ({ ...aggregate, sampleKind: "HISTORICAL" })),
          );
          setHistoricalIcons(
            next.map((icon) => ({ ...icon, layerType: "HISTORICAL_ACTUAL" })),
          );
          setHistoricalState("ready");
          setHistoricalIssue(undefined);
        })
        .catch((failure: unknown) => {
          if (historicalFlightRef.current !== flight) return;
          if (isAbortError(failure) && flight.controller.signal.aborted) return;
          if (!retain) {
            setHistoricalIcons([]);
            setHistoricalState("unavailable");
          }
          setHistoricalIssue("历史样本点加载失败，请稍后重试。");
        })
        .finally(() => {
          releaseFlight(historicalFlightRef, flight, refreshSequenceRef.current, () =>
            startHistoricalRef.current(),
          );
        });
    };
    startHistoricalRef.current();
    return () => {
      historicalFlightRef.current?.controller.abort();
      historicalFlightRef.current = null;
    };
  }, [
    canLoadHistorical,
    mapParentCode,
    categoryCode,
    productCode,
    regionCode,
    repository,
    requestQuery,
    typeCode,
    year,
  ]);

  useEffect(() => {
    startCatalogRef.current = () => {
      const refresh = refreshSequenceRef.current;
      const existing = catalogFlightRef.current;
      if (existing) {
        if (existing.refresh !== refresh) existing.trailing = true;
        return;
      }
      const sameScope = filteredSnapshotScopeRef.current === filteredScopeKey;
      const sameCatalogScope = catalogSnapshotScopeRef.current === filterScopeKey;
      const unfiltered = !categoryCode && !typeCode && !requestQuery.trim();
      if (!canLoadCatalog || !repository || year === undefined || !regionCode) {
        if (!sameScope) {
          setActualIcons([]);
          setFilteredList(undefined);
        }
        if (unfiltered && !sameCatalogScope) setCatalog(undefined);
        setFilteredState("idle");
        setCatalogState("idle");
        return;
      }
      if (!sameScope) {
        setActualIcons([]);
        setFilteredList(undefined);
      }
      setFilteredState("loading");
      if (unfiltered && !sameCatalogScope) {
        setCatalog(undefined);
        setCatalogState("loading");
        setCatalogIssue(undefined);
      }
      const flight: SampleLoadFlight = {
        refresh,
        trailing: false,
        controller: new AbortController(),
      };
      catalogFlightRef.current = flight;
      const filters = {
        productCode,
        regionCode,
        year,
        ...(categoryCode ? { categoryCode } : {}),
        ...(typeCode ? { typeCode } : {}),
        ...(requestQuery.trim() ? { query: requestQuery.trim() } : {}),
      };
      const readCatalog = pointLevel
        ? (repository.mapCatalog?.bind(repository) ??
          repository.snapshot?.bind(repository))
        : undefined;
      const iconCatalog = (
        query:
          typeof filters | Omit<typeof filters, "categoryCode" | "typeCode" | "query">,
      ) => {
        const pending = repository.icons?.(query, {
          signal: flight.controller.signal,
        });
        if (pending === undefined) return undefined;
        return pending.then((loaded) => listFromIcons(regionCode, loaded ?? []));
      };
      const snapshotRequest = readCatalog
        ? readCatalog(
            { ...filters, ...(region?.name ? { regionName: region.name } : {}) },
            { signal: flight.controller.signal },
          )
        : pointLevel
          ? Promise.all([
              repository.list(filters, { signal: flight.controller.signal }),
              repository.icons(filters, { signal: flight.controller.signal }),
            ]).then(([list, icons]) => ({ icons, list }))
          : (iconCatalog(filters)?.then((list) => ({
              icons: [] as OverviewSamplePointIcon[],
              list,
            })) ??
            repository
              .list(filters, { signal: flight.controller.signal })
              .then((list) => ({ icons: [], list })));
      const refreshCatalog =
        !unfiltered &&
        (!sameCatalogScope || catalogRefreshSequenceRef.current !== refresh);
      const catalogFilters = {
        productCode,
        regionCode,
        year,
        ...(region?.name ? { regionName: region.name } : {}),
      };
      const catalogRequest = refreshCatalog
        ? readCatalog
          ? readCatalog(catalogFilters, { signal: flight.controller.signal }).then(
              ({ list }) => list,
            )
          : (iconCatalog(catalogFilters) ??
            repository.list(catalogFilters, { signal: flight.controller.signal }))
        : Promise.resolve(undefined);
      Promise.all([snapshotRequest, catalogRequest])
        .then(([{ icons: nextIcons, list: nextList }, nextCatalog]) => {
          if (catalogFlightRef.current !== flight) return;
          filteredSnapshotScopeRef.current = filteredScopeKey;
          setFilteredList(nextList);
          setActualIcons(nextIcons);
          setFilteredState("ready");
          if (unfiltered || nextCatalog) {
            catalogSnapshotScopeRef.current = filterScopeKey;
            catalogRefreshSequenceRef.current = flight.refresh;
            setCatalog(nextCatalog ?? nextList);
            setCatalogState("ready");
            setCatalogIssue(undefined);
          }
        })
        .catch((failure: unknown) => {
          if (catalogFlightRef.current !== flight) return;
          if (isAbortError(failure) && flight.controller.signal.aborted) return;
          if (!sameScope) {
            setFilteredList(undefined);
            setActualIcons([]);
            setFilteredState("unavailable");
          } else {
            setFilteredState("ready");
          }
          if (unfiltered || refreshCatalog) {
            if (!sameCatalogScope) {
              setCatalog(undefined);
              setCatalogState("unavailable");
              setCatalogIssue("样本点分类加载失败，请稍后重试。");
            } else {
              setCatalogIssue("样本点刷新失败，继续显示上一份已加载目录。");
            }
          }
        })
        .finally(() => {
          releaseFlight(catalogFlightRef, flight, refreshSequenceRef.current, () =>
            startCatalogRef.current(),
          );
        });
    };
    startCatalogRef.current();
    return () => {
      catalogFlightRef.current?.controller.abort();
      catalogFlightRef.current = null;
    };
  }, [
    canLoadCatalog,
    categoryCode,
    filterScopeKey,
    filteredScopeKey,
    filteredRetrySequence,
    productCode,
    pointLevel,
    requestQuery,
    regionCode,
    region?.name,
    repository,
    typeCode,
    year,
  ]);

  useEffect(() => {
    const refresh = refreshSequenceRef.current;
    const nudge = (
      flightRef: { current: SampleLoadFlight | null },
      start: () => void,
    ) => {
      const flight = flightRef.current;
      if (flight) {
        if (flight.refresh !== refresh) flight.trailing = true;
        return;
      }
      start();
    };
    nudge(catalogFlightRef, () => startCatalogRef.current());
    nudge(comparisonFlightRef, () => startComparisonRef.current());
    nudge(historicalFlightRef, () => startHistoricalRef.current());
    nudge(designFlightRef, () => startDesignRef.current());
  }, [refreshSequence]);

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
    () => designPointsInRegion(designPoints, region),
    [designPoints, region],
  );
  const designPointAggregates = useMemo(
    () => designPointRegionAggregates(designPoints, mapRegions ?? []),
    [designPoints, mapRegions],
  );
  const mapDesignPoints = useMemo(
    () =>
      pointLevel
        ? visibleDesignPoints
        : visibleDesignPoints.filter(
            (point) =>
              point.regionCode === regionCode || point.displayRegionCode === regionCode,
          ),
    [pointLevel, regionCode, visibleDesignPoints],
  );

  const icons = useMemo(() => {
    if (!regionCode || !regionLevel) return [];
    if (mode === "historical") return historicalIcons;
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
      canLoadDesignPoints ? mapDesignPoints : undefined,
    );
  }, [
    actualIcons,
    actualKindCodes,
    canLoadDesignPoints,
    comparison,
    comparisonRegionCode,
    mode,
    historicalIcons,
    regionCode,
    regionLevel,
    regionParentCode,
    showExactDesignLocations,
    mapDesignPoints,
  ]);

  return {
    applicable,
    actualIcons,
    catalog,
    catalogState,
    categoryCode,
    comparison,
    designPoints: visibleDesignPoints,
    designPointAggregates,
    designPointState,
    historicalIcons,
    historicalAggregates,
    historicalState,
    ...(filteredList ? { filteredList } : {}),
    filteredState,
    icons,
    issue:
      mode === "historical"
        ? historicalIssue
        : (designPointIssue ?? catalogIssue ?? issue),
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
    ...(year === undefined ? {} : { year }),
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
  regionCode?: string,
): Promise<readonly OverviewDesignSamplePoint[]> {
  if (repository.designMapCatalog) {
    const records = await repository.designMapCatalog({
      productCode,
      ...(regionCode ? { regionCode } : {}),
    });
    return records.map((record) => ({
      ...record,
      domainLabel:
        (
          { PRODUCTION: "产情", MARKET: "市场", LOGISTICS: "物流" } as Record<
            string,
            string
          >
        )[record.context.domainCode] ?? "样本",
      productLabel:
        record.context.productCode === "GENERAL" ? "通用" : record.context.productCode,
      objectTypeLabel: "设计样本",
      businessValues: [],
    }));
  }
  if (!repository.designPoints || !repository.designPointDefinition) return [];
  const first = await repository.designPoints({
    page: 0,
    pageSize: DESIGN_SAMPLE_PAGE_SIZE,
    productCode,
    ...(regionCode ? { regionCode } : {}),
  });
  const records = [...first.items];
  for (let page = 1; page < first.totalPages; page += 1) {
    const next = await repository.designPoints({
      page,
      pageSize: DESIGN_SAMPLE_PAGE_SIZE,
      productCode,
      ...(regionCode ? { regionCode } : {}),
    });
    records.push(...next.items);
  }
  const uniqueRecords = [
    ...new Map(records.map((record) => [record.id, record] as const)).values(),
  ];
  return uniqueRecords.map((record) => ({
    ...record,
    domainLabel:
      (
        { PRODUCTION: "产情", MARKET: "市场", LOGISTICS: "物流" } as Record<
          string,
          string
        >
      )[record.context.domainCode] ?? "样本",
    productLabel:
      ({ CORN: "玉米", SOYBEAN: "大豆", RICE: "稻谷" } as Record<string, string>)[
        record.context.productCode
      ] ?? "",
    objectTypeLabel: "设计样本",
    businessValues: [],
  }));
}

export function presentDesignSamplePoint(
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
  const allocationProvenance = designAllocationProvenance(record, definition);
  const detailFields = presentableDesignFields(definition);
  return {
    ...record,
    domainLabel,
    productLabel,
    objectTypeLabel,
    ...(allocationProvenance ? { allocationProvenance } : {}),
    businessValues: presentDesignValues(record.values, detailFields),
  };
}

function designAllocationProvenance(
  record: OverviewDesignSamplePointRecord,
  definition: Awaited<
    ReturnType<NonNullable<OverviewSamplePointRepository["designPointDefinition"]>>
  >,
) {
  const raw = record.values.DSP_ALLOCATION_PROVENANCE;
  if (!isRecord(raw) || raw.coordinateSource !== "GENERATED_DESIGN") return undefined;
  if (
    raw.businessValuesStatus !== "ORIGIN_ONLY_NOT_VERIFIED_AT_TARGET" &&
    raw.businessValuesStatus !== "NO_OBSERVED_BUSINESS_FACTS"
  )
    return undefined;
  const originalValues = isRecord(raw.originalValues) ? raw.originalValues : {};
  const presentableFields = presentableDesignFields(definition);
  const presentableCodes = new Set(presentableFields.map(({ code }) => code));
  return {
    coordinateSource: raw.coordinateSource,
    businessValuesStatus: raw.businessValuesStatus,
    ...(typeof raw.originalName === "string" && raw.originalName.trim()
      ? { originalName: raw.originalName }
      : {}),
    ...(typeof raw.originalAddress === "string" && raw.originalAddress.trim()
      ? { originalAddress: raw.originalAddress }
      : {}),
    originalBusinessValues: presentDesignValues(originalValues, presentableFields),
    hasRetainedUnpresentedOriginalValues: Object.entries(originalValues).some(
      ([code, value]) =>
        value !== undefined && value !== null && !presentableCodes.has(code),
    ),
  } as const;
}

const PRESENTABLE_IDENTITY_CODES = new Set([
  "DSP_ADDRESS",
  "DSP_MAINTAINER_NAME",
  "DSP_MAINTAINER_UNIT",
]);

function presentableDesignFields(
  definition: Awaited<
    ReturnType<NonNullable<OverviewSamplePointRepository["designPointDefinition"]>>
  >,
) {
  return [
    ...definition.identityFields.filter(({ code }) =>
      PRESENTABLE_IDENTITY_CODES.has(code),
    ),
    ...definition.observationFields,
  ];
}

function presentDesignValues(
  values: Readonly<Record<string, unknown>>,
  fields: ReturnType<typeof presentableDesignFields>,
) {
  return fields.flatMap((field) => {
    const value = values[field.code];
    if (value === undefined || value === null) return [];
    return [
      {
        code: field.code,
        label: field.label,
        value: designSampleValueLabel(value),
        unit: field.unit,
      },
    ];
  });
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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
