import { useEffect, useState } from "react";

import type { OverviewSamplePointRepository } from "../../application/ports/OverviewSamplePointRepository";
import type {
  OverviewSamplePointAggregate,
  OverviewSamplePointCategoryCode,
  OverviewSamplePointDetail,
  OverviewSamplePointIcon,
  OverviewSamplePointList,
} from "../../domain/overviewSamplePoint";

type RegionLevel = "PREFECTURE" | "COUNTY" | "TOWNSHIP" | "VILLAGE";

export function OverviewSamplePointPanel({
  onAggregatesChange,
  onIconsChange,
  onSamplePointSelect,
  parentCode,
  productCode,
  region,
  repository,
  selectedSamplePointId,
}: {
  onAggregatesChange?: (aggregates: readonly OverviewSamplePointAggregate[]) => void;
  onIconsChange: (icons: readonly OverviewSamplePointIcon[]) => void;
  onSamplePointSelect?: (samplePointId: string) => void;
  parentCode?: string;
  productCode: string;
  region: { code: string; level: RegionLevel; name: string };
  repository: OverviewSamplePointRepository;
  selectedSamplePointId?: string;
}) {
  const [categoryCode, setCategoryCode] = useState<OverviewSamplePointCategoryCode>();
  const [typeCode, setTypeCode] = useState<string>();
  const [query, setQuery] = useState("");
  const [list, setList] = useState<OverviewSamplePointList>();
  const [detail, setDetail] = useState<OverviewSamplePointDetail>();
  const [selectedId, setSelectedId] = useState<string>();
  const [issue, setIssue] = useState<string>();
  const [listState, setListState] = useState<"loading" | "ready" | "unavailable">(
    "loading",
  );
  const [detailUnavailable, setDetailUnavailable] = useState(false);

  useEffect(() => {
    setSelectedId(selectedSamplePointId);
  }, [productCode, region.code, selectedSamplePointId]);

  useEffect(() => {
    if (!onAggregatesChange) return;
    let active = true;
    repository
      .aggregates({ productCode, ...(parentCode ? { parentCode } : {}) })
      .then((aggregates) => active && onAggregatesChange(aggregates))
      .catch(() => {
        if (!active) return;
        onAggregatesChange([]);
        setIssue("样本点行政统计加载失败，请稍后重试。");
      });
    return () => {
      active = false;
    };
  }, [onAggregatesChange, parentCode, productCode, repository]);

  useEffect(() => {
    let active = true;
    setDetail(undefined);
    setListState("loading");
    repository
      .list({
        productCode,
        regionCode: region.code,
        ...(categoryCode ? { categoryCode } : {}),
        ...(typeCode ? { typeCode } : {}),
        ...(query.trim() ? { query: query.trim() } : {}),
      })
      .then((next) => {
        if (!active) return;
        setList(next);
        setListState("ready");
        setIssue(undefined);
      })
      .catch(() => {
        if (!active) return;
        setList(undefined);
        setListState("unavailable");
        setIssue("样本点列表加载失败，请稍后重试。");
      });
    return () => {
      active = false;
    };
  }, [categoryCode, productCode, query, region.code, repository, typeCode]);

  useEffect(() => {
    if (region.level !== "VILLAGE" || !categoryCode) {
      onIconsChange([]);
      return;
    }
    let active = true;
    repository
      .icons({
        productCode,
        regionCode: region.code,
        categoryCode,
        ...(typeCode ? { typeCode } : {}),
      })
      .then((icons) => active && onIconsChange(icons))
      .catch(() => {
        if (!active) return;
        onIconsChange([]);
        setIssue("行政村样本点图标加载失败，请稍后重试。");
      });
    return () => {
      active = false;
    };
  }, [categoryCode, onIconsChange, productCode, region.code, region.level, repository, typeCode]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(undefined);
      setDetailUnavailable(false);
      return;
    }
    let active = true;
    setDetailUnavailable(false);
    setIssue(undefined);
    repository
      .detail(selectedId, region.code, productCode)
      .then((next) => active && setDetail(next))
      .catch(() => {
        if (!active) return;
        setDetailUnavailable(true);
        setIssue("样本点业务信息加载失败，请稍后重试。");
      });
    return () => {
      active = false;
    };
  }, [productCode, region.code, repository, selectedId]);

  function selectCategory(next: OverviewSamplePointCategoryCode) {
    setCategoryCode((current) => (current === next ? undefined : next));
    setTypeCode(undefined);
  }

  function selectItem(samplePointId: string) {
    setSelectedId(samplePointId);
    onSamplePointSelect?.(samplePointId);
  }

  const selectedCategory = list?.categories.find(
    (category) => category.code === categoryCode,
  );

  return (
    <section aria-label="样本点业务信息" className="overview-sample-point-panel">
      {issue && <p role="alert">{issue}</p>}

      <section className="overview-detail-section overview-sample-point-categories">
        <h3>
          <span aria-hidden="true">◆</span>
          样本点分类
          <i aria-hidden="true">
            {list ? `${list.totalCount} 个` : listStateLabel(listState)}
          </i>
        </h3>
        {list ? (
          <nav aria-label="样本点分类">
            {list.categories.map((category) => (
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
            {listState === "unavailable" ? "样本点数据不可用" : "正在同步样本点分类"}
          </p>
        )}
        <div aria-label="样本点细分类型">
          {selectedCategory ? (
            selectedCategory.types.map((type) => (
              <button
                aria-pressed={typeCode === type.code}
                key={type.code}
                onClick={() =>
                  setTypeCode((current) =>
                    current === type.code ? undefined : type.code,
                  )
                }
                type="button"
              >
                {type.name} <strong>{type.count}</strong>
              </button>
            ))
          ) : (
            <p>{list ? "选择分类后查看细分类型" : "细分类型数据不可用"}</p>
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
            disabled={!list}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="输入样本点名称、地区或联系方式"
            type="search"
            value={query}
          />
        </label>

        {list?.unresolvedSourceCount ? (
          <p role="status">
            {list.unresolvedSourceCount}{" "}
            条正式来源缺少或存在异常坐标，已计数但不显示图标。
          </p>
        ) : null}

        <div aria-label="样本点列表" className="overview-sample-point-list">
          {list?.items.map((item) => (
            <button
              aria-pressed={selectedId === item.samplePointId}
              key={item.samplePointId}
              onClick={() => selectItem(item.samplePointId)}
              type="button"
            >
              <strong>{item.name}</strong>
              <span>{item.types.map((type) => type.name).join(" / ")}</span>
              <small>{item.products.map((product) => product.name).join("、")}</small>
            </button>
          ))}
          {list && !list.items.length ? <p>当前条件下暂无样本点。</p> : null}
          {!list ? (
            <p>
              {listState === "unavailable"
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

function listStateLabel(state: "loading" | "ready" | "unavailable") {
  if (state === "loading") return "同步中";
  if (state === "unavailable") return "不可用";
  return "⌃";
}
