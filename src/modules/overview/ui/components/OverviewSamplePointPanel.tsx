import { useEffect, useState } from "react";

import type { OverviewSamplePointRepository } from "../../application/ports/OverviewSamplePointRepository";
import type {
  OverviewSamplePointCategoryCode,
  OverviewSamplePointDetail,
  OverviewSamplePointIcon,
  OverviewSamplePointList,
} from "../../domain/overviewSamplePoint";

type RegionLevel = "PREFECTURE" | "COUNTY" | "TOWNSHIP" | "VILLAGE";
type LoadState = "idle" | "loading" | "ready" | "unavailable";

export function OverviewSamplePointPanel({
  onIconsChange,
  refreshSequence = 0,
  region,
  repository,
  year,
}: {
  onIconsChange: (icons: readonly OverviewSamplePointIcon[]) => void;
  refreshSequence?: number;
  region: { code: string; level: RegionLevel; name: string };
  repository: OverviewSamplePointRepository;
  year: number;
}) {
  const [categoryCode, setCategoryCode] = useState<OverviewSamplePointCategoryCode>();
  const [typeCode, setTypeCode] = useState<string>();
  const [query, setQuery] = useState("");
  const [catalog, setCatalog] = useState<OverviewSamplePointList>();
  const [result, setResult] = useState<OverviewSamplePointList>();
  const [detail, setDetail] = useState<OverviewSamplePointDetail>();
  const [selectedId, setSelectedId] = useState<string>();
  const [catalogState, setCatalogState] = useState<LoadState>("loading");
  const [resultState, setResultState] = useState<LoadState>("idle");
  const [detailUnavailable, setDetailUnavailable] = useState(false);
  const [catalogIssue, setCatalogIssue] = useState<string>();
  const [resultIssue, setResultIssue] = useState<string>();
  const [iconIssue, setIconIssue] = useState<string>();
  const [detailIssue, setDetailIssue] = useState<string>();

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (!active) return;
      setCategoryCode(undefined);
      setTypeCode(undefined);
      setQuery("");
      setCatalog(undefined);
      setResult(undefined);
      setDetail(undefined);
      setSelectedId(undefined);
      setCatalogState("loading");
      setResultState("idle");
      setCatalogIssue(undefined);
      setResultIssue(undefined);
      setIconIssue(undefined);
      setDetailIssue(undefined);
      setDetailUnavailable(false);
    });
    onIconsChange([]);
    return () => {
      active = false;
    };
  }, [onIconsChange, region.code, repository, year]);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (!active) return;
      setCatalog(undefined);
      setCatalogState("loading");
      setCatalogIssue(undefined);
    });
    repository
      .list({ regionCode: region.code, year })
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
  }, [refreshSequence, region.code, repository, year]);

  useEffect(() => {
    if (!categoryCode) {
      onIconsChange([]);
      return;
    }
    let active = true;
    const filters = {
      regionCode: region.code,
      year,
      categoryCode,
      ...(typeCode ? { typeCode } : {}),
      ...(query.trim() ? { query: query.trim() } : {}),
    };
    void Promise.resolve().then(() => {
      if (!active) return;
      setResult(undefined);
      setResultState("loading");
      setResultIssue(undefined);
      setIconIssue(undefined);
      onIconsChange([]);
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
    if (region.level === "PREFECTURE") {
      onIconsChange([]);
    } else {
      repository
        .icons(filters)
        .then((icons) => active && onIconsChange(icons))
        .catch(() => {
          if (!active) return;
          onIconsChange([]);
          setIconIssue("样本点图标加载失败，请稍后重试。");
        });
    }
    return () => {
      active = false;
    };
  }, [
    categoryCode,
    onIconsChange,
    query,
    refreshSequence,
    region.code,
    region.level,
    repository,
    typeCode,
    year,
  ]);

  useEffect(() => {
    if (!selectedId || !categoryCode) {
      return;
    }
    let active = true;
    void Promise.resolve().then(() => {
      if (!active) return;
      setDetail(undefined);
      setDetailUnavailable(false);
      setDetailIssue(undefined);
    });
    repository
      .detail({
        samplePointId: selectedId,
        regionCode: region.code,
        year,
        categoryCode,
        ...(typeCode ? { typeCode } : {}),
      })
      .then((next) => active && setDetail(next))
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
    refreshSequence,
    region.code,
    repository,
    selectedId,
    typeCode,
    year,
  ]);

  function clearConcreteResults() {
    setResult(undefined);
    setResultState("idle");
    setDetail(undefined);
    setSelectedId(undefined);
    setDetailUnavailable(false);
    setResultIssue(undefined);
    setIconIssue(undefined);
    setDetailIssue(undefined);
    onIconsChange([]);
  }

  function selectCategory(next: OverviewSamplePointCategoryCode) {
    clearConcreteResults();
    setCategoryCode((current) => (current === next ? undefined : next));
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
    setDetailUnavailable(false);
    setDetailIssue(undefined);
    setSelectedId(samplePointId);
  }

  const selectedCategory = catalog?.categories.find(
    (category) => category.code === categoryCode,
  );
  const qualityScope = result ?? catalog;
  const issue = detailIssue ?? iconIssue ?? resultIssue ?? catalogIssue;

  return (
    <section aria-label="样本点业务信息" className="overview-sample-point-panel">
      {issue && <p role="alert">{issue}</p>}

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
            {catalogState === "unavailable" ? "样本点数据不可用" : "正在同步样本点分类"}
          </p>
        )}
        <div aria-label="样本点细分类型">
          {selectedCategory ? (
            selectedCategory.types.map((type) => (
              <button
                aria-pressed={typeCode === type.code}
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

        {qualityScope && qualityScope.totalCount > 0 ? (
          <div className="overview-sample-point-quality-summary" role="status">
            <strong>
              {region.level === "PREFECTURE"
                ? `实体核对：有效坐标 ${qualityScope.validCoordinateCount} 个 + 坐标待纠正 ${qualityScope.dataQualityIssueCount} 个 = 共 ${qualityScope.totalCount} 个。`
                : `实体核对：可显示图标 ${qualityScope.validCoordinateCount} 个 + 坐标待纠正 ${qualityScope.dataQualityIssueCount} 个 = 共 ${qualityScope.totalCount} 个。`}
            </strong>
            {qualityScope.dataQualityIssueCount > 0 ? (
              <span>
                {categoryCode
                  ? "待纠正实体保留在下方清单，当前不显示地图图标。"
                  : "当前不显示待纠正实体的地图图标；请选择分类进入坐标纠错清单。"}
              </span>
            ) : null}
            {region.level === "PREFECTURE" ? (
              <span>市级聚合层不显示具体样本点图标，请进入区县查看。</span>
            ) : null}
          </div>
        ) : null}
        {qualityScope?.correctionSourceCount ? (
          <p role="status">
            {qualityScope.correctionSourceCount}{" "}
            条正式来源尚未关联稳定主体，已进入纠错清单。
          </p>
        ) : null}

        <div aria-label="样本点列表" className="overview-sample-point-list">
          {!categoryCode ? (
            <p>
              {catalog
                ? `请选择分类后逐条查看 ${catalog.totalCount} 个实体及坐标质量原因`
                : "请选择分类后查看样本点"}
            </p>
          ) : null}
          {result?.items.map((item) => (
            <button
              aria-pressed={selectedId === item.samplePointId}
              key={item.samplePointId}
              onClick={() => selectItem(item.samplePointId)}
              type="button"
            >
              <strong>{item.name}</strong>
              <span>{item.types.map((type) => type.name).join(" / ")}</span>
              <small>{item.products.map((product) => product.name).join("、")}</small>
              {item.dataQualityReason ? (
                <em>{dataQualityLabel(item.dataQualityReason)}</em>
              ) : null}
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
              <p className="overview-sample-point-detail-quality" role="status">
                {dataQualityLabel(detail.dataQualityReason)}
              </p>
            ) : null}
            {detail.associations.map((association, index) => (
              <article
                key={`${association.categoryCode}-${association.typeCode}-${association.productCode}-${association.sourceRole}-${association.occurrenceDate}-${index}`}
              >
                <h5>
                  {association.categoryName} · {association.typeName}
                </h5>
                <p>{association.productName}</p>
                <dl>
                  {Object.entries(association.businessValues).map(([code, value]) => (
                    <div key={code}>
                      <dt>{value.label}</dt>
                      <dd>
                        {value.value}
                        {value.unitCode ? ` ${value.unitCode}` : ""}
                      </dd>
                    </div>
                  ))}
                </dl>
              </article>
            ))}
          </div>
        ) : (
          <p className="overview-sample-point-state">
            {detailUnavailable
              ? "样本点业务信息不可用"
              : selectedId
                ? "正在同步样本点业务信息"
                : "请选择样本点查看业务信息"}
          </p>
        )}
      </section>
    </section>
  );
}

function loadStateLabel(state: LoadState) {
  if (state === "loading") return "同步中";
  if (state === "unavailable") return "不可用";
  return "⌃";
}

function dataQualityLabel(reason: string) {
  const labels: Readonly<Record<string, string>> = {
    COORDINATE_OUT_OF_RANGE: "经纬度超出范围",
    CONTAINMENT_EVIDENCE_STALE: "行政边界校验已失效",
    DUPLICATE_COORDINATE_UNVERIFIED: "重复坐标尚未核实",
    LOCATION_INVALID: "坐标无效",
    LOCATION_MISSING: "缺少坐标",
    LOCATION_OUTSIDE_REGION: "坐标超出所属地区",
    OUTSIDE_VALIDITY_WINDOW: "坐标不在有效期内",
    REGION_MISSING: "所属地区缺失",
  };
  return `坐标质量：${labels[reason] ?? reason}`;
}
