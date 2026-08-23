import { useEffect, useMemo, useState } from "react";

import type { OverviewSamplePointRepository } from "../../application/ports/OverviewSamplePointRepository";
import type {
  OverviewSamplePointCategoryCode,
  OverviewSamplePointDetail,
  OverviewSamplePointIcon,
  OverviewSamplePointList,
  SampleNetworkComparison,
  SampleNetworkLayerMode,
} from "../../domain/overviewSamplePoint";
import { sampleNetworkLayerIcons } from "../presentation/sampleNetworkLayers";
import type { OverviewSampleNetworkLayerModel } from "../hooks/useOverviewSampleNetworkLayers";

type RegionLevel = "PREFECTURE" | "COUNTY" | "TOWNSHIP" | "VILLAGE";
type LoadState = "idle" | "loading" | "ready" | "unavailable";

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
  const [categoryCode, setCategoryCode] = useState<OverviewSamplePointCategoryCode>();
  const [typeCode, setTypeCode] = useState<string>();
  const [query, setQuery] = useState("");
  const [catalog, setCatalog] = useState<OverviewSamplePointList>();
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
  const missingVillageParent = region.level === "VILLAGE" && !region.parentCode;
  const controlledNetwork = networkModel !== undefined;
  const comparisonRegionCode = missingVillageParent
    ? undefined
    : region.level === "VILLAGE"
      ? region.parentCode
      : region.code;
  const pointMapEnabled = region.level === "TOWNSHIP" || region.level === "VILLAGE";

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (!active) return;
      setCategoryCode(undefined);
      setTypeCode(undefined);
      setQuery("");
      setCatalog(undefined);
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
    let active = true;
    void Promise.resolve().then(() => {
      if (!active) return;
      setCatalog(undefined);
      setCatalogState("loading");
      setCatalogIssue(undefined);
    });
    repository
      .list({ productCode, regionCode: region.code, year })
      .then((next) => {
        if (!active) return;
        setCatalog(next);
        setCatalogState("ready");
      })
      .catch(() => {
        if (!active) return;
        setCatalog(undefined);
        setCatalogState("unavailable");
        setCatalogIssue("样本点分类加载失败，请稍后重试。");
      });
    return () => {
      active = false;
    };
  }, [productCode, refreshSequence, region.code, repository, year]);

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
    if (!categoryCode) {
      let active = true;
      void Promise.resolve().then(() => {
        if (!active) return;
        setPublishedIcons([]);
      });
      return () => {
        active = false;
      };
    }
    let active = true;
    const filters = {
      productCode,
      regionCode: region.code,
      year,
      categoryCode,
      ...(typeCode ? { typeCode } : {}),
      ...(query.trim() ? { query: query.trim() } : {}),
    };
    void Promise.resolve().then(() => {
      if (!active) return;
      setResult(undefined);
      setPublishedIcons([]);
      setResultState("loading");
      setResultIssue(undefined);
      setIconIssue(undefined);
    });
    repository
      .list(filters)
      .then((next) => {
        if (!active) return;
        setResult(next);
        setResultState("ready");
      })
      .catch(() => {
        if (!active) return;
        setResult(undefined);
        setResultState("unavailable");
        setResultIssue("样本点列表加载失败，请稍后重试。");
      });
    if (!pointMapEnabled) {
      void Promise.resolve().then(() => {
        if (!active) return;
        setPublishedIcons([]);
      });
    } else {
      repository
        .icons(filters)
        .then((icons) => {
          if (!active) return;
          setPublishedIcons(icons);
        })
        .catch(() => {
          if (!active) return;
          setPublishedIcons([]);
          setIconIssue("样本点图标加载失败，请稍后重试。");
        });
    }
    return () => {
      active = false;
    };
  }, [
    categoryCode,
    productCode,
    query,
    refreshSequence,
    region.code,
    region.level,
    pointMapEnabled,
    repository,
    typeCode,
    year,
  ]);

  const effectiveLayerMode = networkModel?.mode ?? layerMode;
  const effectiveComparison = networkModel?.comparison ?? comparison;
  const effectiveComparisonState = networkModel?.state ?? comparisonState;
  const effectiveShowExactDesignLocations =
    networkModel?.showExactDesignLocations ?? showExactDesignLocations;
  const visibleLayerIcons = useMemo(() => {
    if (missingVillageParent && effectiveLayerMode !== "actual") return [];
    const visibleComparison =
      comparisonRegionCode && region.level !== "PREFECTURE"
        ? effectiveComparison
        : undefined;
    return sampleNetworkLayerIcons(
      effectiveLayerMode,
      publishedIcons,
      visibleComparison,
      {
        regionLevel: region.level,
        selectedRegionCode: region.code,
        ...(comparisonRegionCode
          ? { summaryAnchorRegionCode: comparisonRegionCode }
          : {}),
        showExactDesignLocations: effectiveShowExactDesignLocations,
      },
    );
  }, [
    comparisonRegionCode,
    effectiveComparison,
    effectiveLayerMode,
    effectiveShowExactDesignLocations,
    missingVillageParent,
    publishedIcons,
    region.code,
    region.level,
  ]);
  const displayedLayerIcons = networkModel?.icons ?? visibleLayerIcons;

  useEffect(() => {
    onIconsChange(controlledNetwork ? publishedIcons : visibleLayerIcons);
  }, [controlledNetwork, onIconsChange, publishedIcons, visibleLayerIcons]);

  useEffect(() => {
    if (!selectedSamplePointId || !categoryCode) {
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
        samplePointId: selectedSamplePointId,
        productCode,
        regionCode: region.code,
        year,
        categoryCode,
        ...(typeCode ? { typeCode } : {}),
      })
      .then((next) => {
        if (!active) return;
        setDetail(next);
        setDetailPeriod(detailPeriods(next)[0]);
      })
      .catch(() => {
        if (!active) return;
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
    repository,
    selectedSamplePointId,
    typeCode,
    year,
  ]);

  useEffect(() => {
    if (
      !selectedSamplePointId ||
      resultState !== "ready" ||
      !result ||
      result.items.some((item) => item.samplePointId === selectedSamplePointId)
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
  }, [onSelectedSamplePointChange, result, resultState, selectedSamplePointId]);

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

  function selectCategory(next: OverviewSamplePointCategoryCode) {
    if (categoryCode === next) return;
    clearConcreteResults();
    setCategoryCode(next);
    setTypeCode(undefined);
    setQuery("");
  }

  function selectType(next: string) {
    clearConcreteResults();
    setTypeCode((current) => (current === next ? undefined : next));
  }

  function changeQuery(next: string) {
    clearConcreteResults();
    setQuery(next);
  }

  function selectItem(samplePointId: string) {
    setDetail(undefined);
    setDetailPeriod(undefined);
    setDetailUnavailable(false);
    setDetailIssue(undefined);
    onSelectedSamplePointChange(samplePointId);
  }

  const selectedCategory = catalog?.categories.find(
    (category) => category.code === categoryCode,
  );
  const issue =
    detailIssue ??
    iconIssue ??
    resultIssue ??
    catalogIssue ??
    networkModel?.issue ??
    comparisonIssue;
  const duplicateCoordinateIconCount = displayedLayerIcons.filter(
    (icon) => icon.dataQualityReason === "DUPLICATE_COORDINATE_UNVERIFIED",
  ).length;
  const preciseBusinessIconCount = displayedLayerIcons.filter(
    (icon) => !icon.layerType || icon.layerType === "ANNUAL_ACTUAL",
  ).length;
  const regionalSummaryBadgeCount = displayedLayerIcons.filter(
    (icon) => icon.layerType === "REGIONAL_ACTUAL_BADGE",
  ).length;
  const temporarilyHiddenCount =
    pointMapEnabled && !missingVillageParent && result
      ? Math.max(0, result.items.length - publishedIcons.length)
      : 0;
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

      {effectiveLayerMode === "design" ? (
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
          <section className="overview-detail-section overview-sample-point-categories">
            <h3>
              <span aria-hidden="true">◆</span>
              样本点分类
              <i aria-hidden="true">
                {catalog ? `${catalog.totalCount} 个` : loadStateLabel(catalogState)}
              </i>
            </h3>
            {catalog ? (
              <nav aria-label="样本点分类">
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
            ) : (
              <p className="overview-sample-point-state">
                {catalogState === "unavailable"
                  ? "样本点数据不可用"
                  : "正在同步样本点分类"}
              </p>
            )}
            <div aria-label="样本点细分类型">
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
                <p>{catalog ? "选择分类后查看细分类型" : "细分类型数据不可用"}</p>
              )}
            </div>
          </section>

          <section className="overview-detail-section overview-sample-point-list-section">
            <h3>
              <span aria-hidden="true">◆</span>
              样本点列表
              <i aria-hidden="true">⌃</i>
            </h3>
            <label>
              <span>搜索样本点</span>
              <input
                disabled={!catalog || !categoryCode}
                onChange={(event) => changeQuery(event.target.value)}
                placeholder="输入样本点名称、地区或联系方式"
                type="search"
                value={query}
              />
            </label>

            {resultState === "ready" && result ? (
              <p className="overview-sample-point-quality-summary" role="status">
                {pointMapEnabled ? (
                  <>
                    <strong>
                      精确业务图标 {preciseBusinessIconCount} 个
                      {duplicateCoordinateIconCount
                        ? `，其中 ${duplicateCoordinateIconCount} 个坐标重合待核验`
                        : ""}
                    </strong>
                    <span>
                      {!missingVillageParent &&
                      effectiveComparisonState === "ready" &&
                      effectiveComparison
                        ? `年度区域汇总标识 ${regionalSummaryBadgeCount} 个（不参与产情/市场分类筛选）`
                        : effectiveComparisonState === "unavailable"
                          ? "年度区域汇总标识不可用"
                          : "年度区域汇总标识加载中"}
                    </span>
                    {temporarilyHiddenCount ? (
                      <span>
                        {temporarilyHiddenCount}{" "}
                        个因坐标缺失或无效暂不显示，请在坐标治理中修正。
                      </span>
                    ) : null}
                  </>
                ) : (
                  <strong>当前层级使用聚合统计，不显示单个样本点图标。</strong>
                )}
              </p>
            ) : null}

            <div aria-label="样本点列表" className="overview-sample-point-list">
              {!categoryCode ? (
                <p>
                  {catalog
                    ? `请选择分类后查看 ${catalog.totalCount} 个样本点`
                    : "请选择分类后查看样本点"}
                </p>
              ) : null}
              {result?.items.map((item) => (
                <button
                  aria-pressed={selectedSamplePointId === item.samplePointId}
                  key={item.samplePointId}
                  onClick={() => selectItem(item.samplePointId)}
                  type="button"
                >
                  <strong>{item.name}</strong>
                  <span>
                    {item.types.map((type) => type.name).join(" / ")} ·{" "}
                    {item.regionName}
                  </span>
                  <small>
                    {item.products.map((product) => product.name).join("、")} · 最近业务
                    {formatChineseDate(item.latestBusinessDate)}
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
              ))}
              {result && !result.items.length ? <p>当前条件下暂无样本点。</p> : null}
              {categoryCode && !result ? (
                <p>
                  {resultState === "unavailable"
                    ? "样本点列表数据不可用"
                    : "正在同步样本点列表"}
                </p>
              ) : null}
            </div>
          </section>

          <section className="overview-detail-section overview-sample-point-business">
            <h3>
              <span aria-hidden="true">◆</span>
              样本点业务信息
              <i aria-hidden="true">⌃</i>
            </h3>
            {detail ? (
              <div aria-label="所选样本点详情" className="overview-sample-point-detail">
                <header>
                  <h4>{detail.name}</h4>
                  <span>{detail.regionName}</span>
                </header>
                {detail.dataQualityReason ? (
                  <p className="overview-sample-point-detail-quality">
                    {detailQualityLabel(detail.dataQualityReason)}
                  </p>
                ) : null}
                <div aria-label="核定月份" className="overview-sample-point-periods">
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
                {visibleAssociations.map((association, index) => (
                  <article
                    key={`${association.categoryCode}-${association.typeCode}-${association.productCode}-${association.sourceRole}-${association.occurrenceDate}-${index}`}
                  >
                    <h5>
                      {association.categoryName} · {association.typeName}
                    </h5>
                    <p>
                      {association.productName} · 业务日期
                      {formatChineseDate(association.occurrenceDate)}
                    </p>
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
        </>
      )}
    </section>
  );
}

function formatChineseDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  return `${match[1]}年${Number(match[2])}月${Number(match[3])}日`;
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
    return "地图已显示 · 坐标重合待核验";
  }
  return `地图暂未显示 · ${qualityReasonLabel(reason)}`;
}

function detailQualityLabel(reason: string) {
  if (reason === "DUPLICATE_COORDINATE_UNVERIFIED") {
    return "坐标重合待核验，地图按原始坐标显示";
  }
  return `${qualityReasonLabel(reason)}，地图暂不显示`;
}

function qualityReasonLabel(reason: string) {
  if (reason === "MISSING_COORDINATE") return "缺少坐标";
  if (reason === "INVALID_COORDINATE") return "坐标无效";
  if (reason === "OUT_OF_REGION") return "坐标超出所属地区";
  if (reason === "SUBJECT_IDENTITY_MISSING") return "样本点身份待治理";
  return "坐标质量待治理";
}
