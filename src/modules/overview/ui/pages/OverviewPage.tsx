import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { OverviewRepository } from "../../application/ports/OverviewRepository";
import type { OverviewRealtimeStream } from "../../application/ports/OverviewRealtimeStream";
import type { OverviewSamplePointRepository } from "../../application/ports/OverviewSamplePointRepository";
import type {
  OverviewDashboard,
  OverviewIndicator,
  OverviewMapScope,
  OverviewOptions,
  OverviewRegion,
} from "../../domain/overview";
import type {
  OverviewSamplePointAggregate,
  OverviewSamplePointIcon,
} from "../../domain/overviewSamplePoint";
import {
  BoundaryMap,
  toMapFeature,
  toMapPointFeature,
  type OverviewMapSelectionPoint,
  type SamplePointAggregateStatus,
} from "../components/BoundaryMap";
import { OverviewCommandCenter } from "../components/OverviewCommandCenter";
import { OverviewSamplePointPanel } from "../components/OverviewSamplePointPanel";
import { useOverviewRealtimeRefresh } from "../hooks/useOverviewRealtimeRefresh";
import { HttpContractError, HttpError } from "../../../../shared/api/HttpClient";

const OVERALL_SCOPE = "__OVERALL__";
const MAP_SCOPE_RETRY_DELAYS_MS = [500, 1_000, 2_000] as const;
const NOOP_REALTIME_STREAM: OverviewRealtimeStream = {
  subscribe: () => () => undefined,
};

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
  const [samplePointIcons, setSamplePointIcons] = useState<
    readonly OverviewSamplePointIcon[]
  >([]);
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
    selectedRegionCode || (scopeRootCode !== OVERALL_SCOPE ? scopeRootCode : "");
  const { businessSequence, optionSequence, samplePointSequence } =
    useOverviewRealtimeRefresh(realtimeStream ?? NOOP_REALTIME_STREAM, {
      productCode,
      regionCodes: realtimeRegionCode ? [realtimeRegionCode] : [],
      ...(year === undefined ? {} : { year }),
    });
  const desiredRootRegionQueryKey =
    productCode && year !== undefined
      ? `${productCode}:${year}:${businessSequence}`
      : "";
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
  const updateSamplePointIcons = useCallback(
    (icons: readonly OverviewSamplePointIcon[]) => {
      setSamplePointIcons(icons);
    },
    [],
  );

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (!active) return;
      setSamplePointIcons([]);
    });
    return () => {
      active = false;
    };
  }, [selectedRegionCode, year]);

  useEffect(() => {
    repository.invalidateBusinessData?.();
  }, [businessSequence, optionSequence, repository]);

  useEffect(() => {
    let live = true;
    repository
      .options()
      .then((next) => {
        if (!live) return;
        setOptions(next);
        setOptionsIssue(undefined);
        setProductCode((current) => current || next.products[0]?.code || "");
        setYear((current) =>
          current !== undefined && next.years.includes(current)
            ? current
            : next.years[0],
        );
      })
      .catch(() => live && setOptionsIssue("总览筛选条件加载失败，请稍后重试。"));
    return () => {
      live = false;
    };
  }, [optionSequence, repository]);

  useEffect(() => {
    if (!samplePointRepository || year === undefined) return;
    let active = true;
    if (!showSamplePointAggregates) {
      void Promise.resolve().then(() => {
        if (!active) return;
        setSamplePointAggregates([]);
        setSamplePointAggregateStatus("hidden");
        setSamplePointAggregateIssue(undefined);
      });
      return () => {
        active = false;
      };
    }
    void Promise.resolve().then(() => {
      if (!active) return;
      setSamplePointAggregates([]);
      setSamplePointAggregateStatus("loading");
      setSamplePointAggregateIssue(undefined);
    });
    samplePointRepository
      .aggregates({ year, ...(parentCode ? { parentCode } : {}) })
      .then((aggregates) => {
        if (!active) return;
        setSamplePointAggregates(aggregates);
        setSamplePointAggregateStatus("ready");
        setSamplePointAggregateIssue(undefined);
      })
      .catch(() => {
        if (!active) return;
        setSamplePointAggregates([]);
        setSamplePointAggregateStatus("unavailable");
        setSamplePointAggregateIssue("样本点行政统计加载失败，请稍后重试。");
      });
    return () => {
      active = false;
    };
  }, [
    parentCode,
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
  }, [businessSequence, productCode, year]);

  useEffect(() => {
    if (!productCode || year === undefined) return;
    let live = true;
    repository
      .regions({
        productCode,
        year,
      })
      .then((next) => {
        if (!live) return;
        setRootRegions(next);
        setRootRegionQueryKey(`${productCode}:${year}:${businessSequence}`);
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
  }, [businessSequence, productCode, repository, year]);

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
  }, [businessSequence, parentCode, productCode, year]);

  useEffect(() => {
    if (!productCode || year === undefined) return;
    if (!parentCode) {
      return;
    }
    let live = true;
    repository
      .regions({
        productCode,
        year,
        parentCode,
      })
      .then((next) => {
        if (!live) return;
        setRegions(next);
        setRegionsParentCode(parentCode);
        setChildRegionQueryKey(
          `${productCode}:${year}:${businessSequence}:${parentCode}`,
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
  }, [businessSequence, parentCode, productCode, repository, year]);

  useEffect(() => {
    if (!productCode || year === undefined || !selectedRegionCode) return;
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
    productCode,
    regions,
    repository,
    rootRegions,
    selectedRegionCode,
    year,
  ]);

  useEffect(() => {
    if (!productCode || year === undefined) return;
    const requestRegion = [...regions, ...rootRegions].find(
      (region) => region.code === selectedRegionCode,
    );
    const businessRegionCode = requestRegion?.mapContextOnly
      ? (mapContextRegion?.code ??
        (scopeRootCode !== OVERALL_SCOPE ? scopeRootCode : ""))
      : selectedRegionCode || (scopeRootCode !== OVERALL_SCOPE ? scopeRootCode : "");
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
  const visibleRegionCountsCurrent = parentCode
    ? childRegionQueryKey === desiredChildRegionQueryKey
    : rootRegionQueryKey === desiredRootRegionQueryKey;
  const interactiveMapRegions = useMemo(
    () =>
      visibleRegions
        .filter(({ mapContextOnly }) => !mapContextOnly)
        .map((region) =>
          visibleRegionCountsCurrent
            ? region
            : { ...region, approvedRecordCount: null },
        ),
    [visibleRegionCountsCurrent, visibleRegions],
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
      year === undefined ||
      region.mapContextOnly ||
      region.level === "VILLAGE"
    ) {
      return;
    }
    const commonQuery = {
      productCode,
      year,
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
        {optionsIssue ? <p role="alert">{optionsIssue}</p> : "正在读取粮食商情业务数据"}
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
                  setIndicators([]);
                  setDashboard(undefined);
                }}
              >
                {options.years.map((item) => (
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
            samplePointAggregates={samplePointAggregates}
            {...(samplePointRepository ? { samplePointAggregateStatus } : {})}
            samplePointIcons={samplePointIcons}
            selectedCode={selectedRegionCode}
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
        {...(yearLabel ? { periodLabel: yearLabel } : {})}
        productLabel={productLabel}
        {...(samplePointRepository &&
        year !== undefined &&
        selectedRegion &&
        !selectedRegion.mapContextOnly
          ? {
              samplePoints: (
                <OverviewSamplePointPanel
                  key={`${year}:${selectedRegion.code}`}
                  onIconsChange={updateSamplePointIcons}
                  refreshSequence={samplePointSequence}
                  region={selectedRegion}
                  repository={samplePointRepository}
                  year={year}
                />
              ),
            }
          : {})}
        {...(mapSelectionPoint ? { selectionPoint: mapSelectionPoint } : {})}
        {...(selectedRegion ? { selectedRegion } : {})}
        onEnterSelectedRegion={drillDown}
        onCloseDetails={() => {
          setSelectedRegionCode("");
          setSelectedRegionSnapshot(undefined);
          setIndicators([]);
          setDashboard(undefined);
        }}
      />
      {!options.years.length && (
        <p className="overview-cockpit-guidance" role="status">
          尚无审核正式年度数据：地图可查看，业务指标将在平台完成正式填报并审核后自动接入。
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
