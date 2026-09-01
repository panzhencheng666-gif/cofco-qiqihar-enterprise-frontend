import { useEffect, useMemo, useState } from "react";

import type { OverviewSamplePointRepository } from "../../application/ports/OverviewSamplePointRepository";
import type {
  OverviewSamplePointCategoryCode,
  OverviewDesignSamplePoint,
  OverviewSamplePointDetail,
  OverviewSamplePointIcon,
  OverviewSamplePointList,
  SampleNetworkComparison,
  SampleNetworkLayerMode,
} from "../../domain/overviewSamplePoint";
import { sampleNetworkLayerIcons } from "../presentation/sampleNetworkLayers";
import type { OverviewSampleNetworkLayerModel } from "../hooks/useOverviewSampleNetworkLayers";
import { HttpError } from "../../../../shared/api/HttpClient";

type RegionLevel = "PREFECTURE" | "COUNTY" | "TOWNSHIP" | "VILLAGE";
type LoadState = "idle" | "loading" | "ready" | "unavailable";
const SAMPLE_PAGE_SIZE = 30;
const SEARCH_DEBOUNCE_MS = 250;
const DESIGN_POINT_ID_PREFIX = "design-sample-point:";
const DESIGN_POINT_PAGE_SIZE = 30;

export function OverviewSamplePointPanel({
  networkModel,
  onIconsChange,
  onSelectedSamplePointChange,
  productCode,
  refreshSequence = 0,
  region,
  repository,
  selectedSamplePointId,
  year,
}: {
  networkModel?: OverviewSampleNetworkLayerModel;
  onIconsChange: (icons: readonly OverviewSamplePointIcon[]) => void;
  onSelectedSamplePointChange: (samplePointId: string | undefined) => void;
  productCode: string;
  refreshSequence?: number;
  region: { code: string; level: RegionLevel; name: string; parentCode?: string };
  repository: OverviewSamplePointRepository;
  selectedSamplePointId: string | undefined;
  year: number;
}) {
  const [localCategoryCode, setLocalCategoryCode] =
    useState<OverviewSamplePointCategoryCode>();
  const [localTypeCode, setLocalTypeCode] = useState<string>();
  const [query, setQuery] = useState("");
  const [localRequestQuery, setLocalRequestQuery] = useState("");
  const [localQueryComposing, setLocalQueryComposing] = useState(false);
  const [localRetrySequence, setLocalRetrySequence] = useState(0);
  const [pageIndex, setPageIndex] = useState(0);
  const [localCatalog, setLocalCatalog] = useState<OverviewSamplePointList>();
  const [result, setResult] = useState<OverviewSamplePointList>();
  const [publishedIcons, setPublishedIcons] = useState<
    readonly OverviewSamplePointIcon[]
  >([]);
  const [layerMode, setLayerMode] = useState<SampleNetworkLayerMode>("actual");
  const [showExactDesignLocations, setShowExactDesignLocations] = useState(false);
  const [comparison, setComparison] = useState<SampleNetworkComparison>();
  const [comparisonState, setComparisonState] = useState<LoadState>("loading");
  const [comparisonIssue, setComparisonIssue] = useState<string>();
  const [detail, setDetail] = useState<OverviewSamplePointDetail>();
  const [detailPeriod, setDetailPeriod] = useState<string>();
  const [catalogState, setCatalogState] = useState<LoadState>("loading");
  const [resultState, setResultState] = useState<LoadState>("idle");
  const [detailUnavailable, setDetailUnavailable] = useState(false);
  const [catalogIssue, setCatalogIssue] = useState<string>();
  const [resultIssue, setResultIssue] = useState<string>();
  const [iconIssue, setIconIssue] = useState<string>();
  const [detailIssue, setDetailIssue] = useState<string>();
  const [designQuery, setDesignQuery] = useState("");
  const [designPageIndex, setDesignPageIndex] = useState(0);
  const categoryCode = networkModel?.categoryCode ?? localCategoryCode;
  const typeCode = networkModel?.typeCode ?? localTypeCode;
  const missingVillageParent = region.level === "VILLAGE" && !region.parentCode;
  const controlledNetwork = networkModel !== undefined;
  const catalog = networkModel?.catalog ?? localCatalog;
  const effectiveCatalogState = networkModel?.catalogState ?? catalogState;
  const effectiveQuery = networkModel?.query ?? query;
  const effectiveResult = networkModel?.filteredList ?? result;
  const effectiveResultState = networkModel?.filteredState ?? resultState;
  const effectivePublishedIcons = networkModel?.actualIcons ?? publishedIcons;
  const comparisonRegionCode = missingVillageParent
    ? undefined
    : region.level === "VILLAGE"
      ? region.parentCode
      : region.code;

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (!active) return;
      setLocalCategoryCode(undefined);
      setLocalTypeCode(undefined);
      setQuery("");
      setLocalRequestQuery("");
      setLocalQueryComposing(false);
      setPageIndex(0);
      setLocalCatalog(undefined);
      setResult(undefined);
      setPublishedIcons([]);
      setLayerMode("actual");
      setShowExactDesignLocations(false);
      setComparison(undefined);
      setComparisonState("loading");
      setComparisonIssue(undefined);
      setDetail(undefined);
      setDetailPeriod(undefined);
      setCatalogState("loading");
      setResultState("idle");
      setCatalogIssue(undefined);
      setResultIssue(undefined);
      setIconIssue(undefined);
      setDetailIssue(undefined);
      setDetailUnavailable(false);
      setDesignQuery("");
      setDesignPageIndex(0);
    });
    onSelectedSamplePointChange(undefined);
    onIconsChange([]);
    return () => {
      active = false;
    };
  }, [
    onIconsChange,
    onSelectedSamplePointChange,
    productCode,
    region.code,
    repository,
    year,
  ]);

  useEffect(() => {
    if (controlledNetwork || localQueryComposing) return;
    const trimmed = query.trim();
    if (!trimmed) return;
    const timer = window.setTimeout(() => {
      setLocalRequestQuery(trimmed);
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [controlledNetwork, localQueryComposing, query]);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    if (controlledNetwork) {
      return () => {
        active = false;
        controller.abort();
      };
    }
    void Promise.resolve().then(() => {
      if (!active) return;
      setLocalCatalog(undefined);
      setCatalogState("loading");
      setCatalogIssue(undefined);
    });
    repository
      .list(
        { productCode, regionCode: region.code, year },
        { signal: controller.signal },
      )
      .then((next) => {
        if (!active) return;
        setLocalCatalog(next);
        setCatalogState("ready");
      })
      .catch(() => {
        if (!active) return;
        setLocalCatalog(undefined);
        setCatalogState("unavailable");
        setCatalogIssue("样本角色加载失败，请稍后重试。");
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [
    controlledNetwork,
    localRetrySequence,
    productCode,
    refreshSequence,
    region.code,
    repository,
    year,
  ]);

  useEffect(() => {
    let active = true;
    if (controlledNetwork) {
      return () => {
        active = false;
      };
    }
    void Promise.resolve().then(() => {
      if (!active) return;
      setComparison(undefined);
      setComparisonState(comparisonRegionCode ? "loading" : "unavailable");
      setComparisonIssue(undefined);
    });
    if (!comparisonRegionCode) {
      return () => {
        active = false;
      };
    }
    repository
      .comparison({ productCode, regionCode: comparisonRegionCode, year })
      .then((next) => {
        if (!active) return;
        setComparison(next);
        setComparisonState("ready");
      })
      .catch(() => {
        if (!active) return;
        setComparison(undefined);
        setComparisonState("unavailable");
        setComparisonIssue("设计样本点与年度样本网络加载失败，请稍后重试。");
      });
    return () => {
      active = false;
    };
  }, [
    comparisonRegionCode,
    controlledNetwork,
    productCode,
    refreshSequence,
    repository,
    year,
  ]);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    if (controlledNetwork) {
      return () => {
        active = false;
        controller.abort();
      };
    }
    const filters = {
      productCode,
      regionCode: region.code,
      year,
      ...(categoryCode ? { categoryCode } : {}),
      ...(typeCode ? { typeCode } : {}),
      ...(localRequestQuery.trim() ? { query: localRequestQuery.trim() } : {}),
    };
    void Promise.resolve().then(() => {
      if (!active) return;
      setResult(undefined);
      setPublishedIcons([]);
      setResultState("loading");
      setResultIssue(undefined);
      setIconIssue(undefined);
    });
    Promise.all([
      repository.list(filters, { signal: controller.signal }),
      repository.icons(filters, { signal: controller.signal }),
    ])
      .then(([next, icons]) => {
        if (!active) return;
        setResult(next);
        setPublishedIcons(icons);
        setResultState("ready");
      })
      .catch(() => {
        if (!active) return;
        setResult(undefined);
        setPublishedIcons([]);
        setResultState("unavailable");
        setResultIssue("样本点列表加载失败，请稍后重试。");
        setIconIssue("样本点图标加载失败，请稍后重试。");
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [
    categoryCode,
    controlledNetwork,
    localRequestQuery,
    localRetrySequence,
    productCode,
    refreshSequence,
    region.code,
    region.level,
    repository,
    typeCode,
    year,
  ]);

  const effectiveLayerMode = networkModel?.mode ?? layerMode;
  const effectiveComparison = networkModel?.comparison ?? comparison;
  const effectiveComparisonState = networkModel?.state ?? comparisonState;
  const effectiveShowExactDesignLocations =
    networkModel?.showExactDesignLocations ?? showExactDesignLocations;
  const selectedCategory = catalog?.categories.find(
    (category) => category.code === categoryCode,
  );
  const authoritativeDesignPoints = networkModel?.designPoints ?? [];
  const selectedDesignPoint = authoritativeDesignPoints.find(
    ({ id }) => selectedSamplePointId === designPointMapId(id),
  );
  const formalSelectedSamplePointId = selectedSamplePointId?.startsWith(
    DESIGN_POINT_ID_PREFIX,
  )
    ? undefined
    : selectedSamplePointId;
  const actualKindCodes = useMemo(
    () =>
      categoryCode
        ? typeCode
          ? [typeCode]
          : (selectedCategory?.types.map(({ code }) => code) ?? [])
        : undefined,
    [categoryCode, selectedCategory, typeCode],
  );
  const visibleLayerIcons = useMemo(() => {
    if (missingVillageParent) {
      if (effectiveLayerMode === "design") return [];
      return sampleNetworkLayerIcons("actual", publishedIcons, undefined, {
        ...(actualKindCodes ? { actualKindCodes } : {}),
        regionLevel: region.level,
        selectedRegionCode: region.code,
      });
    }
    const visibleComparison =
      comparisonRegionCode && region.level !== "PREFECTURE"
        ? effectiveComparison
        : undefined;
    return sampleNetworkLayerIcons(
      effectiveLayerMode,
      publishedIcons,
      visibleComparison,
      {
        ...(actualKindCodes ? { actualKindCodes } : {}),
        regionLevel: region.level,
        selectedRegionCode: region.code,
        ...(comparisonRegionCode
          ? { summaryAnchorRegionCode: comparisonRegionCode }
          : {}),
        showExactDesignLocations: effectiveShowExactDesignLocations,
      },
    );
  }, [
    actualKindCodes,
    comparisonRegionCode,
    effectiveComparison,
    effectiveLayerMode,
    effectiveShowExactDesignLocations,
    missingVillageParent,
    publishedIcons,
    region.code,
    region.level,
  ]);
  useEffect(() => {
    onIconsChange(controlledNetwork ? effectivePublishedIcons : visibleLayerIcons);
  }, [controlledNetwork, effectivePublishedIcons, onIconsChange, visibleLayerIcons]);

  useEffect(() => {
    if (!formalSelectedSamplePointId) {
      return;
    }
    let active = true;
    void Promise.resolve().then(() => {
      if (!active) return;
      setDetail(undefined);
      setDetailPeriod(undefined);
      setDetailUnavailable(false);
      setDetailIssue(undefined);
    });
    repository
      .detail({
        samplePointId: formalSelectedSamplePointId,
        productCode,
        regionCode: region.code,
        regionName: region.name,
        year,
        ...(categoryCode ? { categoryCode } : {}),
        ...(typeCode ? { typeCode } : {}),
      })
      .then((next) => {
        if (!active) return;
        setDetail(next);
        setDetailPeriod(detailPeriods(next)[0]);
      })
      .catch((failure: unknown) => {
        if (!active) return;
        if (
          failure instanceof HttpError &&
          (failure.status === 403 || failure.status === 404)
        ) {
          setDetail(undefined);
          setDetailPeriod(undefined);
          setDetailUnavailable(false);
          setDetailIssue(undefined);
          onSelectedSamplePointChange(undefined);
          return;
        }
        setDetailUnavailable(true);
        setDetailIssue("样本点业务信息加载失败，请稍后重试。");
      });
    return () => {
      active = false;
    };
  }, [
    categoryCode,
    productCode,
    refreshSequence,
    region.code,
    region.name,
    repository,
    formalSelectedSamplePointId,
    onSelectedSamplePointChange,
    typeCode,
    year,
  ]);

  useEffect(() => {
    if (
      !formalSelectedSamplePointId ||
      effectiveResultState !== "ready" ||
      !effectiveResult ||
      effectiveResult.items.some(
        (item) => item.samplePointId === formalSelectedSamplePointId,
      )
    ) {
      return;
    }
    let active = true;
    void Promise.resolve().then(() => {
      if (!active) return;
      setDetail(undefined);
      setDetailPeriod(undefined);
      setDetailUnavailable(false);
      setDetailIssue(undefined);
      onSelectedSamplePointChange(undefined);
    });
    return () => {
      active = false;
    };
  }, [
    effectiveResult,
    effectiveResultState,
    onSelectedSamplePointChange,
    formalSelectedSamplePointId,
  ]);

  useEffect(() => {
    if (!selectedSamplePointId?.startsWith(DESIGN_POINT_ID_PREFIX)) return;
    if (effectiveLayerMode === "actual") {
      onSelectedSamplePointChange(undefined);
      return;
    }
    if (networkModel?.designPointState === "ready" && !selectedDesignPoint) {
      onSelectedSamplePointChange(undefined);
    }
  }, [
    effectiveLayerMode,
    networkModel?.designPointState,
    onSelectedSamplePointChange,
    selectedDesignPoint,
    selectedSamplePointId,
  ]);

  function clearConcreteResults() {
    setResult(undefined);
    setPublishedIcons([]);
    setResultState("idle");
    setDetail(undefined);
    setDetailPeriod(undefined);
    onSelectedSamplePointChange(undefined);
    setDetailUnavailable(false);
    setResultIssue(undefined);
    setIconIssue(undefined);
    setDetailIssue(undefined);
    onIconsChange([]);
  }

  function selectCategory(next: OverviewSamplePointCategoryCode | undefined) {
    if (categoryCode === next) return;
    clearConcreteResults();
    if (networkModel) {
      networkModel.setCategoryCode(next);
      networkModel.setQuery?.("");
    } else {
      setLocalCategoryCode(next);
      setLocalTypeCode(undefined);
      setQuery("");
      setLocalRequestQuery("");
    }
    setPageIndex(0);
  }

  function selectType(next: string) {
    clearConcreteResults();
    const selectedType = typeCode === next ? undefined : next;
    if (networkModel) {
      networkModel.setTypeCode(selectedType);
    } else {
      setLocalTypeCode(selectedType);
    }
    setPageIndex(0);
  }

  function changeQuery(next: string) {
    if (networkModel?.setQuery) {
      networkModel.setQuery(next);
    } else {
      setQuery(next);
      if (!next.trim()) setLocalRequestQuery("");
    }
    setPageIndex(0);
  }

  function startQueryComposition() {
    if (networkModel?.setQueryComposition) {
      networkModel.setQueryComposition(true);
    } else {
      setLocalQueryComposing(true);
    }
  }

  function endQueryComposition(next: string) {
    changeQuery(next);
    if (networkModel?.setQueryComposition) {
      networkModel.setQueryComposition(false);
    } else {
      setLocalQueryComposing(false);
    }
  }

  function retrySampleSearch() {
    if (networkModel?.retryFiltered) {
      networkModel.retryFiltered();
    } else {
      setLocalRetrySequence((current) => current + 1);
    }
  }

  function selectItem(samplePointId: string) {
    setDetail(undefined);
    setDetailPeriod(undefined);
    setDetailUnavailable(false);
    setDetailIssue(undefined);
    onSelectedSamplePointChange(samplePointId);
  }

  function returnToList() {
    setDetail(undefined);
    setDetailPeriod(undefined);
    setDetailUnavailable(false);
    setDetailIssue(undefined);
    onSelectedSamplePointChange(undefined);
  }

  const issue =
    detailIssue ??
    iconIssue ??
    resultIssue ??
    catalogIssue ??
    networkModel?.issue ??
    comparisonIssue;
  const blockedLocationCount =
    !missingVillageParent && effectiveResult
      ? Math.max(0, effectiveResult.items.length - effectivePublishedIcons.length)
      : 0;
  const allVisibleItems = effectiveResult?.items ?? [];
  const pageCount = Math.max(1, Math.ceil(allVisibleItems.length / SAMPLE_PAGE_SIZE));
  const currentPageIndex = Math.min(pageIndex, pageCount - 1);
  const visibleItems = allVisibleItems.slice(
    currentPageIndex * SAMPLE_PAGE_SIZE,
    (currentPageIndex + 1) * SAMPLE_PAGE_SIZE,
  );
  const availableDetailPeriods = detail ? detailPeriods(detail) : [];
  const visibleAssociations = detail
    ? detail.associations.filter(
        (association) => periodKey(association.occurrenceDate) === detailPeriod,
      )
    : [];
  const approvedDesignCoordinateCount =
    effectiveComparison?.designPoints.filter(
      ({ coordinateReviewStatus }) => coordinateReviewStatus === "AUTHORITY_APPROVED",
    ).length ?? 0;
  const registeredCoordinateSourceCount =
    effectiveComparison?.designPoints.filter(({ coordinateSourceName }) =>
      Boolean(coordinateSourceName?.trim()),
    ).length ?? 0;
  const comparisonStatusText = missingVillageParent
    ? "父乡镇信息缺失，网络对照不可用，请先治理行政区层级关系。"
    : effectiveComparisonState === "unavailable"
      ? "年度样本网络不可用"
      : "正在同步年度样本网络";
  const usesRegionalSummary =
    region.level === "PREFECTURE" || region.level === "COUNTY";
  const locationCountLabel = usesRegionalSummary ? "地图汇总" : "地图图标";
  const normalizedDesignQuery = designQuery.trim().toLocaleLowerCase("zh-CN");
  const filteredDesignPoints = authoritativeDesignPoints.filter((point) => {
    if (!normalizedDesignQuery) return true;
    return [
      point.name,
      point.regionPath,
      point.domainLabel,
      point.productLabel,
      point.objectTypeLabel,
      ...point.businessValues.flatMap(({ label, value }) => [label, value]),
    ].some((value) => value.toLocaleLowerCase("zh-CN").includes(normalizedDesignQuery));
  });
  const designPageCount = Math.max(
    1,
    Math.ceil(filteredDesignPoints.length / DESIGN_POINT_PAGE_SIZE),
  );
  const currentDesignPageIndex = Math.min(designPageIndex, designPageCount - 1);
  const visibleDesignPoints = filteredDesignPoints.slice(
    currentDesignPageIndex * DESIGN_POINT_PAGE_SIZE,
    (currentDesignPageIndex + 1) * DESIGN_POINT_PAGE_SIZE,
  );

  return (
    <section aria-label="样本点业务信息" className="overview-sample-point-panel">
      {issue && <p role="alert">{issue}</p>}

      {!controlledNetwork ? (
        <section className="overview-sample-network-layers">
          <div aria-label="地图样本点图层" role="group">
            {(
              [
                ["actual", "只看现有"],
                ["design", "只看设计"],
                ["comparison", "网络覆盖对照"],
              ] as const
            ).map(([mode, label]) => (
              <button
                aria-pressed={effectiveLayerMode === mode}
                key={mode}
                onClick={() => setLayerMode(mode)}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>
          {!missingVillageParent &&
          effectiveComparisonState === "ready" &&
          effectiveComparison ? (
            <p>
              设计行政村 {effectiveComparison.designPointCount} 个 · 年度现有样本点{" "}
              {effectiveComparison.activeSamplePointCount} 个
            </p>
          ) : (
            <p>{comparisonStatusText}</p>
          )}
          {region.level === "PREFECTURE" && effectiveLayerMode !== "actual" ? (
            <small>市级仅显示区县汇总，避免在全市范围堆叠 2,332 个标识。</small>
          ) : null}
          {region.level === "COUNTY" && effectiveLayerMode !== "actual" ? (
            <small>区县级仅显示乡镇汇总；进入乡镇后展示全部下属村覆盖徽标。</small>
          ) : null}
          {(region.level === "TOWNSHIP" || region.level === "VILLAGE") &&
          effectiveLayerMode !== "actual" ? (
            <small>行政村展示分区（非权威边界）；覆盖徽标不代表精确经纬度。</small>
          ) : null}
          {effectiveLayerMode !== "actual" &&
          !missingVillageParent &&
          effectiveComparisonState === "ready" &&
          effectiveComparison ? (
            <label>
              <input
                checked={effectiveShowExactDesignLocations}
                disabled={approvedDesignCoordinateCount === 0}
                onChange={(event) => setShowExactDesignLocations(event.target.checked)}
                type="checkbox"
              />
              显示权威核验精确位置（{approvedDesignCoordinateCount}）
            </label>
          ) : null}
        </section>
      ) : null}

      {effectiveLayerMode === "design" &&
      networkModel?.designPointState !== undefined &&
      networkModel.designPointState !== "idle" ? (
        <section
          aria-label="设计样本点信息"
          className="overview-detail-section overview-design-sample-points"
        >
          <h3>
            <span aria-hidden="true">◆</span>
            设计样本点
          </h3>
          <p>设计样本点不带年份；点位、行政区、坐标和业务字段来自权威清单。</p>
          {networkModel?.designPointState === "loading" ? (
            <p role="status">正在同步设计样本点…</p>
          ) : null}
          {networkModel?.designPointState === "unavailable" ? (
            <p role="alert">设计样本点暂不可用，请稍后重试。</p>
          ) : null}
          {networkModel?.designPointState === "ready" ? (
            <>
              <label className="overview-design-sample-search">
                <span>搜索设计样本点</span>
                <input
                  onChange={(event) => {
                    setDesignQuery(event.target.value);
                    setDesignPageIndex(0);
                  }}
                  placeholder="输入点位、地区或业务对象"
                  type="search"
                  value={designQuery}
                />
              </label>
              <p role="status">当前地区共 {filteredDesignPoints.length} 个设计样本点</p>
              <div
                aria-label="设计样本点列表"
                className="overview-design-sample-list"
                role="list"
              >
                {visibleDesignPoints.map((point) => (
                  <div key={point.id} role="listitem">
                    <button
                      aria-pressed={selectedDesignPoint?.id === point.id}
                      onClick={() =>
                        onSelectedSamplePointChange(designPointMapId(point.id))
                      }
                      type="button"
                    >
                      <strong>{point.name}</strong>
                      <span>
                        {point.objectTypeLabel} · {point.productLabel}
                      </span>
                      <small>{point.regionPath}</small>
                    </button>
                  </div>
                ))}
                {visibleDesignPoints.length === 0 ? (
                  <p>当前条件下暂无设计样本点。</p>
                ) : null}
              </div>
              {filteredDesignPoints.length > DESIGN_POINT_PAGE_SIZE ? (
                <nav
                  aria-label="设计样本点分页"
                  className="overview-sample-point-pagination"
                >
                  <button
                    disabled={currentDesignPageIndex === 0}
                    onClick={() =>
                      setDesignPageIndex((current) => Math.max(0, current - 1))
                    }
                    type="button"
                  >
                    上一页
                  </button>
                  <span>
                    第 {currentDesignPageIndex + 1} / {designPageCount} 页
                  </span>
                  <button
                    disabled={currentDesignPageIndex >= designPageCount - 1}
                    onClick={() =>
                      setDesignPageIndex((current) =>
                        Math.min(designPageCount - 1, current + 1),
                      )
                    }
                    type="button"
                  >
                    下一页
                  </button>
                </nav>
              ) : null}
              {selectedDesignPoint ? (
                <DesignSamplePointDetail point={selectedDesignPoint} />
              ) : null}
            </>
          ) : null}
        </section>
      ) : effectiveLayerMode === "design" ? (
        <section
          aria-label="设计样本网络信息"
          className="overview-detail-section overview-sample-network-design"
        >
          <h3>
            <span aria-hidden="true">◆</span>
            设计覆盖信息
          </h3>
          {!missingVillageParent &&
          effectiveComparisonState === "ready" &&
          effectiveComparison ? (
            <>
              <p>设计样本点不带年份，不承载产量、价格、库存等年度业务数据。</p>
              <dl>
                <div>
                  <dt>坐标来源</dt>
                  <dd>
                    已登记 {registeredCoordinateSourceCount} / 总数{" "}
                    {effectiveComparison.designPointCount}
                  </dd>
                </div>
                <div>
                  <dt>坐标审核</dt>
                  <dd>
                    权威核验通过 {approvedDesignCoordinateCount} 个 · 待核验{" "}
                    {effectiveComparison.pendingVerificationDesignPointCount} 个
                  </dd>
                </div>
                <div>
                  <dt>对照关系</dt>
                  <dd>
                    精确对应 {effectiveComparison.exactCoveredDesignPointCount} ·
                    明确代表 {effectiveComparison.representedDesignPointCount} ·
                    区域关联 {effectiveComparison.regionalAssociationDesignPointCount}
                  </dd>
                </div>
              </dl>
            </>
          ) : (
            <p>
              {missingVillageParent
                ? "缺少父乡镇归属，无法生成设计覆盖或区域汇总标识。"
                : comparisonStatusText}
            </p>
          )}
        </section>
      ) : (
        <>
          {selectedDesignPoint ? (
            <DesignSamplePointDetail point={selectedDesignPoint} />
          ) : null}
          <section className="overview-detail-section overview-sample-point-categories">
            <h3>
              <span aria-hidden="true">◆</span>
              地区样本总览
              <i aria-hidden="true">
                {catalog
                  ? `${catalog.totalCount} 个`
                  : loadStateLabel(effectiveCatalogState)}
              </i>
            </h3>
            {catalog ? (
              <>
                <dl
                  aria-label="地区正式样本定位账"
                  className="overview-sample-point-location-ledger"
                >
                  <div>
                    <dt>正式样本</dt>
                    <dd>{catalog.totalCount}</dd>
                    <small>业务目录稳定身份</small>
                  </div>
                  <div>
                    <dt>{locationCountLabel}</dt>
                    <dd>{catalog.validCoordinateCount}</dd>
                    <small>
                      {usesRegionalSummary
                        ? `${region.level === "PREFECTURE" ? "市级按区县" : "区县按乡镇"}唯一分桶，列表选择后定位`
                        : "正式坐标生成，可点击"}
                    </small>
                  </div>
                </dl>
                {catalog.dataQualityIssueCount ? (
                  <p className="overview-sample-point-location-blocked" role="status">
                    系统契约异常：{catalog.dataQualityIssueCount}{" "}
                    条审核通过样本未生成地图图标；请回填报导入环节治理，系统不会推测坐标。
                  </p>
                ) : null}
                <p className="overview-sample-point-filter-label">
                  按样本角色筛选（同一样本可有多个角色，分项不相加）
                </p>
                <nav aria-label="样本角色">
                  <button
                    aria-label={`全部样本 ${catalog.totalCount}`}
                    aria-pressed={!categoryCode}
                    onClick={() => selectCategory(undefined)}
                    type="button"
                  >
                    <span>全部样本</span>
                    <strong>{catalog.totalCount}</strong>
                    <small>个稳定身份</small>
                  </button>
                  {catalog.categories.map((category) => (
                    <button
                      aria-label={`${category.name} ${category.count}`}
                      aria-pressed={categoryCode === category.code}
                      disabled={category.count === 0}
                      key={category.code}
                      onClick={() => selectCategory(category.code)}
                      type="button"
                    >
                      <span>{category.name}</span>
                      <strong>{category.count}</strong>
                      <small>个样本点</small>
                    </button>
                  ))}
                </nav>
              </>
            ) : (
              <p className="overview-sample-point-state">
                {effectiveCatalogState === "unavailable"
                  ? "样本点数据不可用"
                  : "正在同步样本角色"}
              </p>
            )}
            <div aria-label="当前品种对象类型">
              {selectedCategory ? (
                selectedCategory.types.map((type) => (
                  <button
                    aria-pressed={typeCode === type.code}
                    disabled={type.count === 0}
                    key={type.code}
                    onClick={() => selectType(type.code)}
                    type="button"
                  >
                    {type.name} <strong>{type.count}</strong>
                  </button>
                ))
              ) : (
                <p>
                  {catalog
                    ? "选择样本角色后查看当前品种对象类型"
                    : "当前品种对象类型不可用"}
                </p>
              )}
            </div>
          </section>

          <div
            className={`overview-sample-point-workspace${formalSelectedSamplePointId ? " has-selection" : ""}`}
          >
            <section className="overview-detail-section overview-sample-point-list-section">
              <h3>
                <span aria-hidden="true">◆</span>
                样本点列表
                <i aria-hidden="true">⌃</i>
              </h3>
              <label>
                <span>搜索样本点</span>
                <input
                  disabled={!catalog}
                  onCompositionEnd={(event) =>
                    endQueryComposition(event.currentTarget.value)
                  }
                  onCompositionStart={startQueryComposition}
                  onChange={(event) => changeQuery(event.target.value)}
                  placeholder="输入样本点名称、地区或联系方式"
                  type="search"
                  value={effectiveQuery}
                />
              </label>

              {effectiveResultState === "ready" && effectiveResult ? (
                <div className="overview-sample-point-quality-summary" role="status">
                  <strong>
                    当前条件：正式样本 {effectiveResult.items.length} ·{" "}
                    {locationCountLabel} {effectivePublishedIcons.length}
                  </strong>
                  {blockedLocationCount ? (
                    <span>
                      系统契约异常：另有 {blockedLocationCount}{" "}
                      条审核通过样本未生成地图图标
                    </span>
                  ) : null}
                </div>
              ) : null}

              <div
                aria-busy={effectiveResultState === "loading"}
                aria-label="样本点列表"
                className="overview-sample-point-list"
                role="list"
              >
                {visibleItems.map((item) => (
                  <div key={item.samplePointId} role="listitem">
                    <button
                      aria-pressed={formalSelectedSamplePointId === item.samplePointId}
                      onClick={() => selectItem(item.samplePointId)}
                      type="button"
                    >
                      <strong>{item.name}</strong>
                      <span>
                        {item.types.length
                          ? item.types.map((type) => type.name).join(" / ")
                          : `${item.categories.map((role) => role.name).join(" / ")} · 当前品种暂无审核通过对象类型`}{" "}
                        · {item.regionName}
                      </span>
                      <small>
                        {item.latestBusinessDate
                          ? `最近期间观测 ${formatChineseDate(item.latestBusinessDate)}`
                          : "稳定主数据 · 点击查看期间观测"}
                      </small>
                      {item.dataQualityReason ? (
                        <span className="overview-sample-point-list-quality">
                          {listQualityLabel(item.dataQualityReason)}
                        </span>
                      ) : null}
                      <span className="overview-sample-point-list-summary">
                        {Object.entries(item.summaryValues).map(([code, value]) => (
                          <span key={code}>
                            {value.label}：{value.value}
                            {value.unitCode ? ` ${value.unitCode}` : ""}
                          </span>
                        ))}
                      </span>
                    </button>
                  </div>
                ))}
                {effectiveResult && !allVisibleItems.length ? (
                  <p>当前条件下暂无样本点。</p>
                ) : null}
                {!effectiveResult ? (
                  <p role="status">
                    {effectiveResultState === "unavailable"
                      ? "样本点列表数据不可用"
                      : "正在同步样本点列表"}
                  </p>
                ) : null}
                {effectiveResultState === "unavailable" ? (
                  <button
                    aria-label="重试样本点列表"
                    onClick={retrySampleSearch}
                    type="button"
                  >
                    重试
                  </button>
                ) : null}
              </div>
              {allVisibleItems.length > SAMPLE_PAGE_SIZE ? (
                <nav
                  aria-label="样本点列表分页"
                  className="overview-sample-point-pagination"
                >
                  <button
                    disabled={currentPageIndex === 0}
                    onClick={() => setPageIndex((current) => Math.max(0, current - 1))}
                    type="button"
                  >
                    上一页
                  </button>
                  <span aria-live="polite" role="status">
                    第 {currentPageIndex + 1} / {pageCount} 页
                  </span>
                  <button
                    disabled={currentPageIndex >= pageCount - 1}
                    onClick={() =>
                      setPageIndex((current) => Math.min(pageCount - 1, current + 1))
                    }
                    type="button"
                  >
                    下一页
                  </button>
                </nav>
              ) : null}
            </section>

            {formalSelectedSamplePointId ? (
              <section className="overview-detail-section overview-sample-point-business">
                <h3 aria-label="样本点业务信息">
                  <span aria-hidden="true">◆</span>
                  样本点业务信息
                  <button
                    className="overview-sample-point-back-to-list"
                    onClick={returnToList}
                    type="button"
                  >
                    返回样本列表
                  </button>
                </h3>
                {detail ? (
                  <div
                    aria-label="所选样本点详情"
                    className="overview-sample-point-detail"
                  >
                    <header>
                      <h4>{detail.name}</h4>
                      <span>{detail.regionName}</span>
                    </header>
                    {detail.dataQualityReason ? (
                      <p className="overview-sample-point-detail-quality">
                        {detailQualityLabel(detail.dataQualityReason)}
                      </p>
                    ) : null}
                    {detail.roles?.length ? (
                      <p className="overview-sample-point-period-note">
                        稳定样本角色：
                        {detail.roles.map((role) => role.name).join(" / ")}
                      </p>
                    ) : null}
                    {detail.address !== undefined ||
                    detail.longitude !== undefined ||
                    detail.latitude !== undefined ||
                    detail.objectTypeName !== undefined ||
                    detail.version !== undefined ? (
                      <dl aria-label="正式样本稳定主数据">
                        {detail.objectTypeName !== undefined ? (
                          <div>
                            <dt>当前对象分类</dt>
                            <dd>{detail.objectTypeName}</dd>
                          </div>
                        ) : null}
                        {detail.address !== undefined ? (
                          <div>
                            <dt>地址</dt>
                            <dd>{detail.address}</dd>
                          </div>
                        ) : null}
                        {detail.longitude !== undefined &&
                        detail.latitude !== undefined ? (
                          <div>
                            <dt>经纬度</dt>
                            <dd>
                              {detail.longitude}，{detail.latitude}
                            </dd>
                          </div>
                        ) : null}
                        {detail.version !== undefined ? (
                          <div>
                            <dt>当前版本</dt>
                            <dd>第{detail.version}版</dd>
                          </div>
                        ) : null}
                      </dl>
                    ) : null}
                    {availableDetailPeriods.length ? (
                      <>
                        <div
                          aria-label="核定月份"
                          className="overview-sample-point-periods"
                        >
                          <span>核定月份</span>
                          {availableDetailPeriods.map((period) => (
                            <button
                              aria-label={formatChineseMonth(period)}
                              aria-pressed={detailPeriod === period}
                              key={period}
                              onClick={() => setDetailPeriod(period)}
                              type="button"
                            >
                              {formatChineseMonth(period)}
                            </button>
                          ))}
                        </div>
                        <p className="overview-sample-point-period-note">
                          默认显示最新核定月份，可切换查看该样本点的历史核定记录。
                        </p>
                      </>
                    ) : (
                      <p className="overview-sample-point-period-note">
                        该样本身份已正式入网；当前品种暂无审核通过业务记录。
                      </p>
                    )}
                    {visibleAssociations.map((association, index) => (
                      <article
                        key={`${association.categoryCode}-${association.typeCode}-${association.productCode}-${association.sourceRole}-${association.occurrenceDate}-${index}`}
                      >
                        <h5>
                          {association.categoryName} · {association.typeName}
                        </h5>
                        <p>
                          {association.productName
                            ? `${association.productName} · `
                            : ""}
                          实际观测 {formatChineseDate(association.occurrenceDate)}
                        </p>
                        {association.sourceVersion !== undefined ? (
                          <p>
                            审核来源历史：{sourceRoleLabel(association.sourceRole)} ·
                            业务日期 {formatChineseDate(association.occurrenceDate)} ·
                            第{association.sourceVersion}版
                          </p>
                        ) : null}
                        <dl>
                          {Object.entries(association.businessValues).map(
                            ([code, value]) => (
                              <div key={code}>
                                <dt>{value.label}</dt>
                                <dd>
                                  {value.value}
                                  {value.unitCode ? ` ${value.unitCode}` : ""}
                                </dd>
                              </div>
                            ),
                          )}
                        </dl>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="overview-sample-point-state">
                    {detailUnavailable
                      ? "样本点业务信息不可用"
                      : selectedSamplePointId
                        ? "正在同步样本点业务信息"
                        : "请选择样本点查看业务信息"}
                  </p>
                )}
              </section>
            ) : null}
          </div>
        </>
      )}
    </section>
  );
}

function designPointMapId(id: string) {
  return `${DESIGN_POINT_ID_PREFIX}${id}`;
}

function DesignSamplePointDetail({ point }: { point: OverviewDesignSamplePoint }) {
  return (
    <section aria-label="设计样本点详情" className="overview-design-sample-detail">
      <header>
        <h4>{point.name}</h4>
        <span>
          {point.objectTypeLabel} · {point.productLabel}
        </span>
      </header>
      <p>{point.regionPath}</p>
      <p>坐标已通过所选行政区边界校验。</p>
      {point.businessValues.length ? (
        <dl>
          {point.businessValues.map(({ code, label, unit, value }) => (
            <div key={code}>
              <dt>{label}</dt>
              <dd>
                {value}
                {unit ? ` ${unit}` : ""}
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <p>当前业务对象暂无已填写的适用信息。</p>
      )}
    </section>
  );
}

function formatChineseDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  return `${match[1]}年${Number(match[2])}月${Number(match[3])}日`;
}

function sourceRoleLabel(sourceRole: string) {
  if (sourceRole === "ORIGIN") return "发运端核定记录";
  if (sourceRole === "DESTINATION") return "到达端核定记录";
  return "调研填报";
}

function loadStateLabel(state: LoadState) {
  if (state === "loading") return "同步中";
  if (state === "unavailable") return "不可用";
  return "⌃";
}

function detailPeriods(detail: OverviewSamplePointDetail) {
  return Array.from(
    new Set(
      detail.associations.map((association) => periodKey(association.occurrenceDate)),
    ),
  ).sort((left, right) => right.localeCompare(left));
}

function periodKey(value: string) {
  return value.slice(0, 7);
}

function formatChineseMonth(value: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) return value;
  return `${match[1]}年${Number(match[2])}月`;
}

function listQualityLabel(reason: string) {
  if (reason === "DUPLICATE_COORDINATE_UNVERIFIED") {
    return "地图未生成 · 导入坐标契约异常（坐标重复）";
  }
  return `地图未生成 · ${qualityReasonLabel(reason)}`;
}

function detailQualityLabel(reason: string) {
  if (reason === "DUPLICATE_COORDINATE_UNVERIFIED") {
    return "导入坐标契约异常（坐标重复），地图未生成";
  }
  return `${qualityReasonLabel(reason)}，地图未生成`;
}

function qualityReasonLabel(reason: string) {
  if (reason === "MISSING_COORDINATE" || reason === "LOCATION_MISSING") {
    return "导入坐标缺失";
  }
  if (reason === "INVALID_COORDINATE" || reason === "COORDINATE_OUT_OF_RANGE") {
    return "导入坐标超出有效范围";
  }
  if (reason === "OUT_OF_REGION") return "导入坐标与所属地区不匹配";
  if (reason === "OBSERVED_COORDINATE_CONFLICT") return "导入坐标记录不一致";
  if (reason === "REGION_MISSING") return "导入归属缺失";
  if (reason === "SUBJECT_IDENTITY_MISSING") return "导入身份缺失";
  return "导入坐标契约异常";
}
