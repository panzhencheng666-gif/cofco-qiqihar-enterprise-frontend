import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type {
  OverviewRegionTimeScope,
  OverviewRepository,
} from "../../application/ports/OverviewRepository";
import type { OverviewRealtimeStream } from "../../application/ports/OverviewRealtimeStream";
import type { OverviewSamplePointRepository } from "../../application/ports/OverviewSamplePointRepository";
import type {
  OverviewDashboard,
  OverviewIndicator,
  OverviewMapScope,
  OverviewOptions,
  OverviewRegion,
} from "../../domain/overview";
import type { OverviewSamplePointAggregate } from "../../domain/overviewSamplePoint";
import {
  BoundaryMap,
  toMapFeature,
  toMapPointFeature,
  type OverviewMapSelectionPoint,
  type SamplePointAggregateStatus,
} from "../components/BoundaryMap";
import { OverviewCommandCenter } from "../components/OverviewCommandCenter";
import { OverviewSampleNetworkToolbar } from "../components/OverviewSampleNetworkToolbar";
import { OverviewSamplePointPanel } from "../components/OverviewSamplePointPanel";
import { useOverviewRealtimeRefresh } from "../hooks/useOverviewRealtimeRefresh";
import { useOverviewSampleNetworkLayers } from "../hooks/useOverviewSampleNetworkLayers";
import { HttpContractError, HttpError } from "../../../../shared/api/HttpClient";

const OVERALL_SCOPE = "__OVERALL__";
const MAP_SCOPE_RETRY_DELAYS_MS = [500, 1_000, 2_000] as const;
const OPTIONS_LOAD_TIMEOUT_MS = 10_000;
const OPTIONS_LOAD_FAILURE_MESSAGE = "总览筛选条件加载失败，请稍后重试。";
const ANNUAL_SAMPLE_NETWORK_START_YEAR = 2026;
const NOOP_REALTIME_STREAM: OverviewRealtimeStream = {
  subscribe: () => () => undefined,
};

function selectableOverviewYears(
  approvedBusinessYears: readonly number[],
  currentYear = new Date().getFullYear(),
): readonly number[] {
  const years = new Set(approvedBusinessYears);
  for (
    let annualYear = ANNUAL_SAMPLE_NETWORK_START_YEAR;
    annualYear <= currentYear;
    annualYear += 1
  ) {
    years.add(annualYear);
  }
  return [...years].sort((left, right) => right - left);
}

function preserveEquivalentCollection<T>(
  current: readonly T[],
  next: readonly T[],
  equivalent: (left: T, right: T) => boolean,
): readonly T[] {
  if (current.length !== next.length) return next;
  return current.every((item, index) => {
    const candidate = next[index];
    return candidate !== undefined && equivalent(item, candidate);
  })
    ? current
    : next;
}

function preserveEquivalentRegions(
  current: readonly OverviewRegion[],
  next: readonly OverviewRegion[],
): readonly OverviewRegion[] {
  return preserveEquivalentCollection(
    current,
    next,
    (region, candidate) =>
      region.code === candidate.code &&
      region.name === candidate.name &&
      region.parentCode === candidate.parentCode &&
      region.level === candidate.level &&
      region.approvedRecordCount === candidate.approvedRecordCount &&
      region.boundaryGeoJson === candidate.boundaryGeoJson &&
      region.locationGeoJson === candidate.locationGeoJson &&
      region.locationReviewStatus === candidate.locationReviewStatus &&
      region.mapContextOnly === candidate.mapContextOnly,
  );
}

function preserveEquivalentAggregates(
  current: readonly OverviewSamplePointAggregate[],
  next: readonly OverviewSamplePointAggregate[],
): readonly OverviewSamplePointAggregate[] {
  return preserveEquivalentCollection(
    current,
    next,
    (aggregate, candidate) =>
      aggregate.regionCode === candidate.regionCode &&
      aggregate.regionName === candidate.regionName &&
      aggregate.regionLevel === candidate.regionLevel &&
      aggregate.samplePointCount === candidate.samplePointCount &&
      aggregate.productionCount === candidate.productionCount &&
      aggregate.marketCount === candidate.marketCount &&
      aggregate.validCoordinateCount === candidate.validCoordinateCount &&
      aggregate.dataQualityIssueCount === candidate.dataQualityIssueCount &&
      aggregate.correctionSourceCount === candidate.correctionSourceCount &&
      aggregate.unresolvedSourceCount === candidate.unresolvedSourceCount,
  );
}

const IGNORE_SAMPLE_POINT_ICONS = (): void => undefined;

function overviewDataIssue(error: unknown, fallback: string): string {
  if (error instanceof HttpContractError) {
    const trace = error.traceId ? `追踪号：${error.traceId}。` : "追踪号：响应未提供。";
    return `指标数据契约版本不匹配，当前验收后端可能仍为旧版本。${trace}请停止验收并同步重启后端服务。`;
  }
  if (error instanceof HttpError && error.status === 403) {
    return "当前账号无权查看该地区的核定业务数据，请返回已授权地区或联系权限管理员。";
  }
  if (error instanceof HttpError && error.status === 400) {
    return "当前总揽筛选条件无效，请重新选择地区、产品和年度。";
  }
  return fallback;
}

function mapRegionTimeScope(
  year: number | undefined,
  referencePeriodCode: string | undefined,
): OverviewRegionTimeScope | undefined {
  if (year !== undefined) return { year };
  return referencePeriodCode ? { periodCode: referencePeriodCode } : undefined;
}

export function OverviewPage({
  realtimeStream,
  repository,
  samplePointRepository,
}: {
  realtimeStream?: OverviewRealtimeStream;
  repository: OverviewRepository;
  samplePointRepository?: OverviewSamplePointRepository;
}) {
  const [options, setOptions] = useState<OverviewOptions>();
  const [overallMapScope, setOverallMapScope] = useState<OverviewMapScope>();
  const [rootRegions, setRootRegions] = useState<readonly OverviewRegion[]>([]);
  const [rootRegionQueryKey, setRootRegionQueryKey] = useState("");
  const [regions, setRegions] = useState<readonly OverviewRegion[]>([]);
  const [childRegionQueryKey, setChildRegionQueryKey] = useState("");
  const [regionsParentCode, setRegionsParentCode] = useState("");
  const [, setIndicators] = useState<readonly OverviewIndicator[]>([]);
  const [dashboard, setDashboard] = useState<OverviewDashboard>();
  const [productCode, setProductCode] = useState("");
  const [year, setYear] = useState<number>();
  const [selectedRegionCode, setSelectedRegionCode] = useState("");
  const [selectedRegionSnapshot, setSelectedRegionSnapshot] =
    useState<OverviewRegion>();
  const [scopeRootCode, setScopeRootCode] = useState(OVERALL_SCOPE);
  const [parentCode, setParentCode] = useState<string>();
  const [parentTrail, setParentTrail] = useState<readonly string[]>([]);
  const [optionsIssue, setOptionsIssue] = useState<string>();
  const [optionsReloadKey, setOptionsReloadKey] = useState(0);
  const [rootRegionIssue, setRootRegionIssue] = useState<string>();
  const [childRegionIssue, setChildRegionIssue] = useState<string>();
  const [indicatorIssue, setIndicatorIssue] = useState<string>();
  const [dashboardIssue, setDashboardIssue] = useState<string>();
  const [mapScopeIssue, setMapScopeIssue] = useState<string>();
  const [mapSelectionPoint, setMapSelectionPoint] =
    useState<OverviewMapSelectionPoint>();
  const [mapContextRegion, setMapContextRegion] = useState<OverviewRegion>();
  const [mapContextTrail, setMapContextTrail] = useState<readonly OverviewRegion[]>([]);
  const [samplePointAggregates, setSamplePointAggregates] = useState<
    readonly OverviewSamplePointAggregate[]
  >([]);
  const [samplePointAggregateStatus, setSamplePointAggregateStatus] =
    useState<SamplePointAggregateStatus>("loading");
  const [samplePointAggregateIssue, setSamplePointAggregateIssue] = useState<string>();
  const [selectedSamplePointId, setSelectedSamplePointId] = useState<string>();
  const availableYears = useMemo(
    () => selectableOverviewYears(options?.years ?? []),
    [options?.years],
  );
  const hasApprovedBusinessYear =
    year !== undefined && (options?.years.includes(year) ?? false);
  const aggregateParentLevel = parentCode
    ? mapContextRegion?.code === parentCode
      ? mapContextRegion.level
      : rootRegions.find((region) => region.code === parentCode)?.level
    : undefined;
  const aggregateSelectionLevel = [...regions, ...rootRegions].find(
    (region) => region.code === selectedRegionCode,
  )?.level;
  const hasDeepRegionSelection =
    aggregateSelectionLevel === "COUNTY" ||
    aggregateSelectionLevel === "TOWNSHIP" ||
    aggregateSelectionLevel === "VILLAGE";
  const showSamplePointAggregates =
    (!parentCode || aggregateParentLevel === "PREFECTURE") && !hasDeepRegionSelection;
  const realtimeRegionCode =
    selectedRegionCode ||
    mapContextRegion?.code ||
    (scopeRootCode !== OVERALL_SCOPE ? scopeRootCode : "");
  const { businessSequence, optionSequence, samplePointSequence } =
    useOverviewRealtimeRefresh(realtimeStream ?? NOOP_REALTIME_STREAM, {
      productCode,
      regionCodes: realtimeRegionCode ? [realtimeRegionCode] : [],
      ...(year === undefined ? {} : { year }),
    });
  const mapReferencePeriodCode = hasApprovedBusinessYear
    ? undefined
    : options?.periods[0]?.code;
  const mapRegionScope = useMemo(
    () =>
      mapRegionTimeScope(
        hasApprovedBusinessYear ? year : undefined,
        mapReferencePeriodCode,
      ),
    [hasApprovedBusinessYear, mapReferencePeriodCode, year],
  );
  const mapTimeKey =
    year !== undefined
      ? `year:${year}`
      : mapReferencePeriodCode
        ? `period:${mapReferencePeriodCode}`
        : "";
  const desiredRootRegionQueryKey =
    productCode && mapTimeKey ? `${productCode}:${mapTimeKey}:${businessSequence}` : "";
  const desiredChildRegionQueryKey =
    desiredRootRegionQueryKey && parentCode
      ? `${desiredRootRegionQueryKey}:${parentCode}`
      : "";
  const initializedScope = useRef(false);
  const updateMapSelectionPoint = useCallback(
    (position: OverviewMapSelectionPoint | undefined) => {
      setMapSelectionPoint(position);
    },
    [],
  );
  const clearSamplePointSelection = useCallback(() => {
    setSelectedSamplePointId(undefined);
  }, []);
  const updateSelectedSamplePoint = useCallback((samplePointId: string | undefined) => {
    setSelectedSamplePointId(samplePointId);
  }, []);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (!active) return;
      clearSamplePointSelection();
    });
    return () => {
      active = false;
    };
  }, [clearSamplePointSelection, productCode, selectedRegionCode, year]);

  useEffect(() => {
    repository.invalidateBusinessData?.();
  }, [businessSequence, optionSequence, repository]);

  useEffect(() => {
    let live = true;
    const timeout = window.setTimeout(() => {
      if (live) setOptionsIssue(OPTIONS_LOAD_FAILURE_MESSAGE);
    }, OPTIONS_LOAD_TIMEOUT_MS);
    repository
      .options()
      .then((next) => {
        if (!live) return;
        window.clearTimeout(timeout);
        const selectableYears = selectableOverviewYears(next.years);
        setOptions(next);
        setOptionsIssue(undefined);
        setProductCode((current) => current || next.products[0]?.code || "");
        setYear((current) =>
          current !== undefined && selectableYears.includes(current)
            ? current
            : selectableYears[0],
        );
      })
      .catch(() => {
        window.clearTimeout(timeout);
        if (live) setOptionsIssue(OPTIONS_LOAD_FAILURE_MESSAGE);
      });
    return () => {
      live = false;
      window.clearTimeout(timeout);
    };
  }, [optionSequence, optionsReloadKey, repository]);

  useEffect(() => {
    if (!samplePointRepository || !productCode) return;
    let active = true;
    if (year === undefined || year < 2026) {
      void Promise.resolve().then(() => {
        if (!active) return;
        setSamplePointAggregates((current) =>
          preserveEquivalentAggregates(current, []),
        );
        setSamplePointAggregateStatus("hidden");
        setSamplePointAggregateIssue(undefined);
      });
      return () => {
        active = false;
      };
    }
    if (!showSamplePointAggregates) {
      void Promise.resolve().then(() => {
        if (!active) return;
        setSamplePointAggregates((current) =>
          preserveEquivalentAggregates(current, []),
        );
        setSamplePointAggregateStatus("hidden");
        setSamplePointAggregateIssue(undefined);
      });
      return () => {
        active = false;
      };
    }
    void Promise.resolve().then(() => {
      if (!active) return;
      setSamplePointAggregates((current) => preserveEquivalentAggregates(current, []));
      setSamplePointAggregateStatus("loading");
      setSamplePointAggregateIssue(undefined);
    });
    samplePointRepository
      .aggregates({ productCode, year, ...(parentCode ? { parentCode } : {}) })
      .then((aggregates) => {
        if (!active) return;
        setSamplePointAggregates((current) =>
          preserveEquivalentAggregates(current, aggregates),
        );
        setSamplePointAggregateStatus("ready");
        setSamplePointAggregateIssue(undefined);
      })
      .catch(() => {
        if (!active) return;
        setSamplePointAggregates((current) =>
          preserveEquivalentAggregates(current, []),
        );
        setSamplePointAggregateStatus("unavailable");
        setSamplePointAggregateIssue("样本点行政统计加载失败，请稍后重试。");
      });
    return () => {
      active = false;
    };
  }, [
    parentCode,
    productCode,
    samplePointSequence,
    samplePointRepository,
    showSamplePointAggregates,
    year,
  ]);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (!active) return;
      setRootRegionQueryKey("");
      setRootRegionIssue(undefined);
    });
    return () => {
      active = false;
    };
  }, [businessSequence, mapTimeKey, productCode]);

  useEffect(() => {
    if (!productCode || !mapTimeKey || !mapRegionScope) return;
    let live = true;
    repository
      .regions({
        productCode,
        ...mapRegionScope,
      })
      .then((next) => {
        if (!live) return;
        setRootRegions((current) => preserveEquivalentRegions(current, next));
        setRootRegionQueryKey(`${productCode}:${mapTimeKey}:${businessSequence}`);
        setRootRegionIssue(undefined);
        if (!initializedScope.current) {
          initializedScope.current = true;
          setScopeRootCode(OVERALL_SCOPE);
          setParentCode(undefined);
          return;
        }
        setScopeRootCode((current) => {
          if (
            current === OVERALL_SCOPE ||
            next.some((region) => region.code === current)
          ) {
            return current;
          }
          return OVERALL_SCOPE;
        });
      })
      .catch(() => {
        if (!live) return;
        setRootRegionIssue("总览正式地区范围加载失败，请重试。");
      });
    return () => {
      live = false;
    };
  }, [businessSequence, mapRegionScope, mapTimeKey, productCode, repository]);

  useEffect(() => {
    let live = true;
    let retryIndex = 0;
    let retryTimer: number | undefined;

    const loadMapScope = () => {
      repository
        .mapScope()
        .then((nextMapScope) => {
          if (!live) return;
          setOverallMapScope(nextMapScope);
          setMapScopeIssue(undefined);
        })
        .catch(() => {
          if (!live) return;
          const delay = MAP_SCOPE_RETRY_DELAYS_MS[retryIndex];
          retryIndex += 1;
          if (delay !== undefined) {
            setMapScopeIssue("总体贴地底座正在恢复，现有真实行政区地图仍可正常使用。");
            retryTimer = window.setTimeout(loadMapScope, delay);
            return;
          }
          setOverallMapScope(undefined);
          setMapScopeIssue(
            "总体贴地底座暂未加载，已使用真实行政区外壁保障地图完整显示。",
          );
        });
    };

    loadMapScope();
    return () => {
      live = false;
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
    };
  }, [repository]);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (!active) return;
      setChildRegionQueryKey("");
      setChildRegionIssue(undefined);
    });
    return () => {
      active = false;
    };
  }, [businessSequence, mapTimeKey, parentCode, productCode]);

  useEffect(() => {
    if (!productCode || !mapTimeKey || !mapRegionScope) return;
    if (!parentCode) {
      return;
    }
    let live = true;
    repository
      .regions({
        productCode,
        parentCode,
        ...mapRegionScope,
      })
      .then((next) => {
        if (!live) return;
        setRegions((current) => preserveEquivalentRegions(current, next));
        setRegionsParentCode(parentCode);
        setChildRegionQueryKey(
          `${productCode}:${mapTimeKey}:${businessSequence}:${parentCode}`,
        );
        setChildRegionIssue(undefined);
      })
      .catch(() => {
        if (!live) return;
        setChildRegionIssue("总览地区边界或统计范围加载失败，请重试。");
      });
    return () => {
      live = false;
    };
  }, [
    businessSequence,
    mapRegionScope,
    mapTimeKey,
    parentCode,
    productCode,
    repository,
  ]);

  useEffect(() => {
    if (
      !productCode ||
      year === undefined ||
      !hasApprovedBusinessYear ||
      !selectedRegionCode
    )
      return;
    const requestRegion = [...regions, ...rootRegions].find(
      (region) => region.code === selectedRegionCode,
    );
    if (requestRegion?.mapContextOnly) {
      return;
    }
    let live = true;
    void Promise.resolve().then(() => {
      if (!live) return;
      setIndicators([]);
      setIndicatorIssue(undefined);
    });
    repository
      .indicators({
        productCode,
        regionCode: selectedRegionCode,
        year,
      })
      .then((next) => {
        if (!live) return;
        setIndicators(next);
        setIndicatorIssue(undefined);
      })
      .catch((error: unknown) => {
        if (!live) return;
        setIndicators([]);
        setIndicatorIssue(overviewDataIssue(error, "核定指标加载失败，请稍后重试。"));
      });
    return () => {
      live = false;
    };
  }, [
    businessSequence,
    hasApprovedBusinessYear,
    productCode,
    regions,
    repository,
    rootRegions,
    selectedRegionCode,
    year,
  ]);

  useEffect(() => {
    if (!productCode || year === undefined || !hasApprovedBusinessYear) return;
    const requestRegion = [...regions, ...rootRegions].find(
      (region) => region.code === selectedRegionCode,
    );
    const businessRegionCode = requestRegion?.mapContextOnly
      ? (mapContextRegion?.code ??
        (scopeRootCode !== OVERALL_SCOPE ? scopeRootCode : ""))
      : selectedRegionCode ||
        mapContextRegion?.code ||
        (scopeRootCode !== OVERALL_SCOPE ? scopeRootCode : "");
    let live = true;
    void Promise.resolve().then(() => {
      if (!live) return;
      setDashboard(undefined);
      setDashboardIssue(undefined);
    });
    repository
      .dashboard({
        productCode,
        year,
        ...(businessRegionCode ? { regionCode: businessRegionCode } : {}),
      })
      .then((next) => {
        if (!live) return;
        setDashboard(next);
        setDashboardIssue(undefined);
      })
      .catch((error: unknown) => {
        if (!live) return;
        setDashboard(undefined);
        setDashboardIssue(
          overviewDataIssue(error, "总揽业务聚合数据加载失败，请稍后重试。"),
        );
      });
    return () => {
      live = false;
    };
  }, [
    businessSequence,
    hasApprovedBusinessYear,
    productCode,
    mapContextRegion,
    regions,
    repository,
    rootRegions,
    scopeRootCode,
    selectedRegionCode,
    year,
  ]);

  const visibleRegions = useMemo(
    () =>
      parentCode ? (regionsParentCode === parentCode ? regions : []) : rootRegions,
    [parentCode, regions, regionsParentCode, rootRegions],
  );
  const selectedRegion =
    visibleRegions.find((region) => region.code === selectedRegionCode) ??
    (selectedRegionSnapshot?.code === selectedRegionCode
      ? selectedRegionSnapshot
      : undefined);
  const sampleNetworkRegion =
    selectedRegion?.level === "VILLAGE"
      ? selectedRegion
      : mapContextRegion?.level === "TOWNSHIP"
        ? mapContextRegion
        : (selectedRegion ?? mapContextRegion);
  const sampleNetworkModel = useOverviewSampleNetworkLayers({
    productCode,
    refreshSequence: samplePointSequence,
    region: sampleNetworkRegion,
    repository: samplePointRepository,
    year,
  });
  const showAggregateLayer =
    sampleNetworkModel.applicable && sampleNetworkModel.mode !== "design";
  const visibleSamplePointAggregates = showAggregateLayer ? samplePointAggregates : [];
  const visibleSamplePointAggregateStatus = showAggregateLayer
    ? samplePointAggregateStatus
    : "hidden";
  const visibleRegionCountsCurrent = parentCode
    ? childRegionQueryKey === desiredChildRegionQueryKey
    : rootRegionQueryKey === desiredRootRegionQueryKey;
  const visibleRegionCountsUsable =
    visibleRegionCountsCurrent ||
    (parentCode ? childRegionIssue === undefined : rootRegionIssue === undefined);
  const interactiveMapRegions = useMemo(
    () =>
      visibleRegions
        .filter(({ mapContextOnly }) => !mapContextOnly)
        .map((region) =>
          visibleRegionCountsUsable ? region : { ...region, approvedRecordCount: null },
        ),
    [visibleRegionCountsUsable, visibleRegions],
  );
  const mapFeatures = useMemo(
    () => interactiveMapRegions.flatMap(toMapFeature),
    [interactiveMapRegions],
  );
  const mapPoints = useMemo(() => {
    const byCode = new Map<string, ReturnType<typeof toMapPointFeature>[number]>();
    interactiveMapRegions.forEach((region) => {
      if (region.boundaryGeoJson) return;
      toMapPointFeature(region).forEach((point) => byCode.set(region.code, point));
    });
    return [...byCode.values()];
  }, [interactiveMapRegions]);
  const mapBackdrop = useMemo(() => {
    const contextRegion =
      mapContextRegion ??
      (scopeRootCode === OVERALL_SCOPE
        ? undefined
        : rootRegions.find((region) => region.code === scopeRootCode));
    if (contextRegion?.boundaryGeoJson) return toMapFeature(contextRegion)[0];
    if (scopeRootCode !== OVERALL_SCOPE || !overallMapScope) return undefined;
    return toMapFeature({
      approvedRecordCount: 0,
      boundaryGeoJson: overallMapScope.boundaryGeoJson,
      code: overallMapScope.scopeCode,
      level: "PREFECTURE",
      name: overallMapScope.name,
    })[0];
  }, [mapContextRegion, overallMapScope, rootRegions, scopeRootCode]);
  const productLabel =
    options?.products.find((product) => product.code === productCode)?.label ??
    "粮食产品";
  const yearLabel = year === undefined ? undefined : `${year}年`;
  const issue =
    optionsIssue ??
    rootRegionIssue ??
    childRegionIssue ??
    indicatorIssue ??
    dashboardIssue;
  function changeScopeRoot(code: string) {
    setScopeRootCode(code);
    setParentCode(code === OVERALL_SCOPE ? undefined : code);
    setParentTrail([]);
    setSelectedRegionCode("");
    setSelectedRegionSnapshot(undefined);
    setIndicators([]);
    setDashboard(undefined);
    setMapContextRegion(undefined);
    setMapContextTrail([]);
    setRootRegionIssue(undefined);
    setChildRegionIssue(undefined);
    setIndicatorIssue(undefined);
    setDashboardIssue(undefined);
  }

  function selectRegion(region: OverviewRegion) {
    if (selectedRegionCode !== region.code) {
      setSelectedRegionCode(region.code);
      setSelectedRegionSnapshot(region);
      setIndicators([]);
      setDashboard(undefined);
    }
    prefetchRegionChildren(region);
    setIndicatorIssue(undefined);
    setDashboardIssue(undefined);
  }

  function prefetchRegionChildren(region: OverviewRegion) {
    if (
      !productCode ||
      !mapTimeKey ||
      !mapRegionScope ||
      region.mapContextOnly ||
      region.level === "VILLAGE"
    ) {
      return;
    }
    const commonQuery = {
      productCode,
      ...mapRegionScope,
    };
    void repository
      .regions({ ...commonQuery, parentCode: region.code })
      .catch(() => undefined);
  }

  function drillDown(region: OverviewRegion) {
    if (region.mapContextOnly || region.level === "VILLAGE") return;
    const currentContext =
      mapContextRegion ?? rootRegions.find((item) => item.code === scopeRootCode);
    if (currentContext) setMapContextTrail((trail) => [...trail, currentContext]);
    setMapContextRegion(region);
    setParentTrail((trail) => [...trail, parentCode ?? ""]);
    setParentCode(region.code);
    setSelectedRegionCode("");
    setSelectedRegionSnapshot(undefined);
    setIndicators([]);
    setDashboard(undefined);
    setChildRegionIssue(undefined);
    setIndicatorIssue(undefined);
    setDashboardIssue(undefined);
  }

  function returnToParent() {
    if (!parentCode) return;
    const priorParent = parentTrail[parentTrail.length - 1];
    const priorContext = mapContextTrail[mapContextTrail.length - 1];
    setParentCode(priorParent || undefined);
    setParentTrail((trail) => trail.slice(0, -1));
    setMapContextRegion(priorContext);
    setMapContextTrail((trail) => trail.slice(0, -1));
    setSelectedRegionCode("");
    setSelectedRegionSnapshot(undefined);
    setIndicators([]);
    setDashboard(undefined);
  }

  if (!options) {
    return (
      <main className="overview-loading">
        {optionsIssue ? (
          <div>
            <p role="alert">{optionsIssue}</p>
            <button
              type="button"
              onClick={() => {
                setOptionsIssue(undefined);
                setOptionsReloadKey((current) => current + 1);
              }}
            >
              重新加载
            </button>
          </div>
        ) : (
          "正在读取粮食商情业务数据"
        )}
      </main>
    );
  }

  return (
    <>
      <OverviewCommandCenter
        {...(overallMapScope
          ? {
              boundarySource: {
                license: overallMapScope.sourceLicense,
                name: overallMapScope.sourceName,
                revision: overallMapScope.sourceRevision,
              },
            }
          : {})}
        {...(dashboard ? { dashboard } : {})}
        filters={
          <section className="overview-cockpit-filters" aria-label="总览筛选条件">
            <label>
              <span>区域范围</span>
              <select
                aria-label="区域范围"
                value={scopeRootCode}
                onChange={(event) => changeScopeRoot(event.target.value)}
              >
                <option value={OVERALL_SCOPE}>总体</option>
                {rootRegions.map((region) => (
                  <option key={region.code} value={region.code}>
                    {region.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>产品</span>
              <select
                aria-label="产品"
                value={productCode}
                onChange={(event) => {
                  setProductCode(event.target.value);
                  clearSamplePointSelection();
                  setIndicators([]);
                  setDashboard(undefined);
                }}
              >
                {options.products.map((item) => (
                  <option key={item.code} value={item.code}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>年度</span>
              <select
                aria-label="年度"
                value={year ?? ""}
                onChange={(event) => {
                  setYear(Number(event.target.value));
                  clearSamplePointSelection();
                  setIndicators([]);
                  setDashboard(undefined);
                }}
              >
                {availableYears.map((item) => (
                  <option key={item} value={item}>
                    {item}年
                  </option>
                ))}
              </select>
            </label>
          </section>
        }
        map={
          <BoundaryMap
            {...(mapBackdrop ? { backdrop: mapBackdrop } : {})}
            features={mapFeatures}
            points={mapPoints}
            samplePointAggregates={visibleSamplePointAggregates}
            {...(samplePointRepository
              ? { samplePointAggregateStatus: visibleSamplePointAggregateStatus }
              : {})}
            samplePointIcons={sampleNetworkModel.icons}
            onSamplePointSelect={updateSelectedSamplePoint}
            selectedCode={selectedRegionCode}
            {...(selectedSamplePointId ? { selectedSamplePointId } : {})}
            onSelect={selectRegion}
            onSelectionPosition={updateMapSelectionPoint}
            onDrill={drillDown}
          />
        }
        navigation={
          <nav className="overview-cockpit-navigation" aria-label="行政区导航">
            <details className="overview-region-browser">
              <summary>选择地区</summary>
              <div aria-label="行政区列表">
                {visibleRegions.map((region) => (
                  <button
                    aria-pressed={selectedRegionCode === region.code}
                    key={region.code}
                    onClick={() => selectRegion(region)}
                    type="button"
                  >
                    {region.name}
                  </button>
                ))}
                {!visibleRegions.length && <span>当前层级没有可展示的行政区。</span>}
              </div>
            </details>
            {parentCode && parentCode !== scopeRootCode && (
              <button type="button" onClick={returnToParent}>
                返回上级
              </button>
            )}
          </nav>
        }
        {...(samplePointRepository
          ? {
              sampleNetworkControls: (
                <OverviewSampleNetworkToolbar model={sampleNetworkModel} />
              ),
            }
          : {})}
        {...(yearLabel ? { periodLabel: yearLabel } : {})}
        productLabel={productLabel}
        {...(samplePointRepository &&
        productCode &&
        year !== undefined &&
        selectedRegion &&
        !selectedRegion.mapContextOnly
          ? {
              samplePoints:
                year >= 2026 ? (
                  <OverviewSamplePointPanel
                    key={`${productCode}:${year}:${selectedRegion.code}`}
                    networkModel={sampleNetworkModel}
                    onIconsChange={IGNORE_SAMPLE_POINT_ICONS}
                    onSelectedSamplePointChange={updateSelectedSamplePoint}
                    productCode={productCode}
                    refreshSequence={samplePointSequence}
                    region={selectedRegion}
                    repository={samplePointRepository}
                    selectedSamplePointId={selectedSamplePointId}
                    year={year}
                  />
                ) : (
                  <section
                    aria-label="历史业务记录说明"
                    className="overview-sample-point-panel overview-historical-record-notice"
                  >
                    <h3>{year}年历史业务记录</h3>
                    <p>现有样本网络自2026年启用，当前年度仅展示历史业务记录。</p>
                    <p>
                      产情、市场和物流记录仍按原业务页面查询，但不计入现有样本点数量、分类或地图图标。
                    </p>
                  </section>
                ),
            }
          : {})}
        {...(mapSelectionPoint ? { selectionPoint: mapSelectionPoint } : {})}
        {...(selectedRegion ? { selectedRegion } : {})}
        onEnterSelectedRegion={drillDown}
        onCloseDetails={() => {
          setSelectedRegionCode("");
          setSelectedRegionSnapshot(undefined);
          sampleNetworkModel.setCategoryCode(undefined);
          clearSamplePointSelection();
          setIndicators([]);
          setDashboard(undefined);
        }}
      />
      {year !== undefined && !hasApprovedBusinessYear && (
        <p className="overview-cockpit-guidance" role="status">
          {year}
          年度暂无审核正式业务数据：样本网络可查看，业务指标将在平台完成正式填报并审核后自动接入。
        </p>
      )}
      {issue && (
        <p className="overview-cockpit-guidance is-error" role="alert">
          {issue}
        </p>
      )}
      {samplePointAggregateIssue && (
        <p className="overview-cockpit-guidance is-error" role="alert">
          {samplePointAggregateIssue}
        </p>
      )}
      {mapScopeIssue && (
        <p className="overview-cockpit-guidance" role="status">
          {mapScopeIssue}
        </p>
      )}
    </>
  );
}
