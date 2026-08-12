import type { ReactNode } from "react";

import type {
  OverviewDashboard,
  OverviewDashboardMetric,
  OverviewRegion,
  OverviewYoYComparison,
} from "../../domain/overview";
import { formatMetricAuditLabel } from "../presentation/metricAuditLabel";
import type { OverviewMapSelectionPoint } from "./boundaryGeometry";
import { businessPlatformLedgerUrl } from "../businessPlatformNavigation";
import { overviewSelectionConnector } from "./terrainReliefGeometry";

export function OverviewCommandCenter({
  boundarySource,
  dashboard,
  filters,
  map,
  navigation,
  onCloseDetails,
  onEnterSelectedRegion,
  periodLabel,
  productLabel,
  samplePoints,
  selectedRegion,
  selectionPoint,
}: {
  boundarySource?: {
    license: string;
    name: string;
    revision: string;
  };
  dashboard?: OverviewDashboard;
  filters: ReactNode;
  map: ReactNode;
  navigation: ReactNode;
  onCloseDetails: () => void;
  onEnterSelectedRegion: (region: OverviewRegion) => void;
  periodLabel?: string;
  productLabel: string;
  samplePoints?: ReactNode;
  selectedRegion?: OverviewRegion;
  selectionPoint?: OverviewMapSelectionPoint;
}) {
  const metricByCode = new Map(dashboard?.metrics.map((item) => [item.code, item]));
  const overtureBoundary = boundarySource?.name.includes("Overture") ?? false;
  const path = dashboard?.regionPath.map((item) => item.label) ?? [];
  const selectedPath = path.length ? path.join(" / ") : selectedRegion?.name;
  const metrics = [
    metric("粮食播种面积", metricByCode.get("PRODUCTION_CULTIVATED_AREA"), "area"),
    metric("预计总产量", metricByCode.get("PRODUCTION_ESTIMATED_OUTPUT"), "output"),
    metric("平均成交价", metricByCode.get("MARKET_AVERAGE_TRADE_PRICE"), "price"),
    metric("总供给", metricByCode.get("SUPPLY_TOTAL_SUPPLY"), "supply"),
    metric("总需求", metricByCode.get("SUPPLY_TOTAL_USE"), "demand"),
    metric(
      "期末库存",
      metricByCode.get("SUPPLY_ADOPTED_ENDING_INVENTORY"),
      "inventory",
    ),
    regionSurplusMetric(metricByCode.get("REGION_SURPLUS")),
  ];

  return (
    <main className={`overview-command-center${selectedRegion ? " has-details" : ""}`}>
      <h2 className="overview-sr-only">粮食商情总览</h2>

      <section aria-label="粮食商情总览地图" className="overview-command-map">
        {map}
      </section>
      <div aria-hidden="true" className="overview-command-atmosphere" />

      <header className="overview-command-header">
        <h1>
          齐齐哈尔粮食商情企业平台 <span>/ 总揽监测</span>
        </h1>
        {filters}
        <div className="overview-command-status">
          <span>
            <i />
            {dashboard?.scope.approvedRecordCount ? "已核验数据" : "等待审核数据"}
          </span>
          <b>更新于</b>
          <strong>{formatDateTime(dashboard?.scope.latestUpdatedAt)}</strong>
        </div>
      </header>

      <section aria-label="总揽关键指标" className="overview-command-kpis">
        {metrics.map((item) => (
          <article
            aria-label={item.label}
            className={`is-${item.tone}`}
            key={item.label}
          >
            <p>{item.label}</p>
            <div>
              <strong>{item.value}</strong>
              <small>{item.unit}</small>
            </div>
            <span>{item.sourceLabel}</span>
          </article>
        ))}
      </section>

      <aside className="overview-command-legend">
        <h3>图例</h3>
        <span>
          <i className="is-boundary" />
          市界
        </span>
        <span>
          <i className="is-county" />
          县区界
        </span>
        <span>
          <i className="is-township" />
          乡镇界
        </span>
        <span>
          <i className="is-village" />
          行政村界
        </span>
      </aside>
      {navigation}

      {selectedRegion && selectionPoint && <SelectionLink point={selectionPoint} />}

      {selectedRegion && (
        <aside aria-label="所选地区样本点详情" className="overview-command-details">
          <header>
            <div>
              <h2>所选地区样本点详情</h2>
              <p>{selectedPath}</p>
            </div>
            <button aria-label="关闭地区详情" onClick={onCloseDetails} type="button">
              ×
            </button>
          </header>
          {samplePoints ?? <UnavailableSamplePointPanel />}
          <nav className="overview-detail-actions">
            <a href={businessPlatformLedgerUrl()} target="_top">
              查看样本点台账
            </a>
            <button
              disabled={selectedRegion.level === "VILLAGE"}
              onClick={() => onEnterSelectedRegion(selectedRegion)}
              type="button"
            >
              {selectedRegion.level === "VILLAGE"
                ? "行政村样本点末级"
                : "进入样本点监测"}
            </button>
          </nav>
        </aside>
      )}

      <section aria-label="业务数据联动分析" className="overview-command-analysis">
        <PriceTrendPanel dashboard={dashboard} />
        <ProductStructurePanel dashboard={dashboard} />
        <YoYPanel
          data={dashboard?.cultivatedAreaYoY ?? []}
          title="各地区播种面积同比"
        />
        <YoYPanel data={dashboard?.outputYoY ?? []} title="各地区总产量同比" />
      </section>

      <footer className="overview-command-footer">
        <span>{scopeText(dashboard)}</span>
        <span>
          {productLabel} · {periodLabel ?? "未选择业务期间"}
        </span>
        <span>业务数据仅展示已填报并审核内容</span>
        {boundarySource && (
          <span
            className="overview-boundary-provenance"
            title={`${boundarySource.name} · ${boundarySource.license} · 来源可追溯的地图展示边界，非勘界或法律依据`}
          >
            边界：{overtureBoundary ? "Overture/OSM" : "来源数据"}{" "}
            {boundarySource.revision}
            （非勘界依据） ·{" "}
            <a
              href={
                overtureBoundary
                  ? "https://docs.overturemaps.org/guides/divisions/"
                  : "https://github.com/thedavidweng/china-village-boundaries/issues"
              }
              rel="noreferrer"
              target="_blank"
            >
              来源与许可
            </a>
          </span>
        )}
      </footer>
    </main>
  );
}

function SelectionLink({ point }: { point: OverviewMapSelectionPoint }) {
  const { bendX, bendY, panelX, panelY } = overviewSelectionConnector(point);
  return (
    <svg
      aria-hidden="true"
      className="overview-selection-link"
      preserveAspectRatio="none"
      viewBox={`0 0 ${point.width} ${point.height}`}
    >
      <polyline
        points={`${point.x},${point.y} ${bendX},${bendY} ${panelX},${panelY}`}
      />
      <circle cx={point.x} cy={point.y} r="5" />
      <circle cx={panelX} cy={panelY} r="3" />
    </svg>
  );
}

function UnavailableSamplePointPanel() {
  return (
    <section
      aria-label="样本点业务信息"
      className="overview-sample-point-panel is-unavailable"
    >
      <section className="overview-detail-section overview-sample-point-categories">
        <h3>
          <span aria-hidden="true">◆</span>
          样本点分类
          <i aria-hidden="true">不可用</i>
        </h3>
        <p className="overview-sample-point-state">样本点数据不可用</p>
        <div aria-label="样本点细分类型">
          <p>细分类型数据不可用</p>
        </div>
      </section>
      <section className="overview-detail-section overview-sample-point-list-section">
        <h3>
          <span aria-hidden="true">◆</span>
          样本点列表
          <i aria-hidden="true">不可用</i>
        </h3>
        <div aria-label="样本点列表" className="overview-sample-point-list">
          <p>样本点列表数据不可用</p>
        </div>
      </section>
      <section className="overview-detail-section overview-sample-point-business">
        <h3>
          <span aria-hidden="true">◆</span>
          样本点业务信息
          <i aria-hidden="true">不可用</i>
        </h3>
        <p className="overview-sample-point-state">样本点业务信息不可用</p>
      </section>
    </section>
  );
}

function PriceTrendPanel({ dashboard }: { dashboard: OverviewDashboard | undefined }) {
  const data = dashboard?.priceTrend ?? [];
  const points = linePoints(
    data.map((item) => Number(item.value)),
    328,
    102,
  );
  return (
    <article className="overview-command-chart">
      <header>
        <h3>近12月价格趋势</h3>
        <span>单位：元/吨</span>
      </header>
      {data.length ? (
        <>
          <svg aria-label="价格趋势图" role="img" viewBox="0 0 340 118">
            <path className="grid" d="M18 22H330M18 54H330M18 86H330M18 112H330" />
            <polyline className="line-primary" points={points} />
            {points.split(" ").map((point, index) => {
              const [cx, cy] = point.split(",");
              return <circle cx={cx} cy={cy} key={data[index]?.periodLabel} r="2.8" />;
            })}
          </svg>
          <div className="overview-command-axis">
            {data.map((item) => (
              <span key={item.periodLabel}>{item.periodLabel.slice(5)}</span>
            ))}
          </div>
        </>
      ) : (
        <EmptyTrendChart />
      )}
    </article>
  );
}

function ProductStructurePanel({
  dashboard,
}: {
  dashboard: OverviewDashboard | undefined;
}) {
  const data = dashboard?.productStructure ?? [];
  const total = data.reduce((sum, item) => sum + Number(item.value || 0), 0);
  const colors = ["#f2c451", "#29d5dc", "#438dff", "#b7d9e9"];
  const stops = data.map((item, index) => {
    const startValue = data
      .slice(0, index)
      .reduce((sum, previous) => sum + Number(previous.value || 0), 0);
    const endValue = startValue + Number(item.value || 0);
    const start = total ? (startValue / total) * 100 : 0;
    const end = total ? (endValue / total) * 100 : 0;
    return `${colors[index % colors.length]} ${start}% ${end}%`;
  });
  return (
    <article className="overview-command-chart overview-command-structure">
      <header>
        <h3>品种结构</h3>
        <span>审核产量占比</span>
      </header>
      {data.length ? (
        <div>
          <figure style={{ background: `conic-gradient(${stops.join(",")})` }}>
            <span>
              {formatCompact(total)}
              <small>公斤</small>
            </span>
          </figure>
          <ul>
            {data.slice(0, 4).map((item, index) => (
              <li key={item.productCode}>
                <i style={{ background: colors[index % colors.length] }} />
                <span>{item.productName}</span>
                <strong>{percent(Number(item.value), total)}</strong>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <EmptyStructureChart />
      )}
    </article>
  );
}

function YoYPanel({
  data,
  title,
}: {
  data: readonly OverviewYoYComparison[];
  title: string;
}) {
  const visible = data.slice(0, 7);
  const maximum = Math.max(
    ...visible.flatMap((item) => [
      Number(item.currentValue),
      Number(item.previousValue),
    ]),
    1,
  );
  return (
    <article className="overview-command-chart overview-command-yoy">
      <header>
        <h3>{title}</h3>
        <span>
          <i />
          本期 / ◎ 同比
        </span>
      </header>
      {visible.length ? (
        <div className="overview-yoy-bars">
          {visible.map((item) => {
            const current = item.currentSourceCount ? Number(item.currentValue) : 0;
            const prior = item.previousSourceCount ? Number(item.previousValue) : 0;
            const change = prior ? ((current - prior) / prior) * 100 : undefined;
            return (
              <div key={item.regionCode}>
                <span
                  className="overview-yoy-column"
                  style={{
                    height: `${Math.max((current / maximum) * 88, current ? 3 : 0)}px`,
                  }}
                />
                <i
                  style={{
                    bottom: `${Math.max((prior / maximum) * 88, prior ? 3 : 0)}px`,
                  }}
                />
                <strong>
                  {change === undefined
                    ? "—"
                    : `${change >= 0 ? "+" : ""}${change.toFixed(1)}%`}
                </strong>
                <small>{item.regionName}</small>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyYoYChart />
      )}
    </article>
  );
}

function EmptyTrendChart() {
  return (
    <div className="overview-empty-chart is-trend">
      <svg aria-hidden="true" viewBox="0 0 340 118">
        <path d="M18 18V108H330M18 30H330M18 56H330M18 82H330" />
      </svg>
      <strong>暂无审核数据</strong>
      <span>— / — / — / — / —</span>
    </div>
  );
}

function EmptyStructureChart() {
  return (
    <div className="overview-empty-chart is-structure">
      <figure>
        <span>暂无审核数据</span>
      </figure>
      <p>仅展示业务平台已审核的品种结构</p>
    </div>
  );
}

function EmptyYoYChart() {
  return (
    <div className="overview-empty-chart is-yoy">
      <svg aria-hidden="true" viewBox="0 0 340 118">
        <path d="M18 18V108H330M18 30H330M18 56H330M18 82H330" />
      </svg>
      <strong>暂无审核数据</strong>
      <span>— / — / — / — / —</span>
    </div>
  );
}

function metric(
  label: string,
  value: OverviewDashboardMetric | undefined,
  tone: string,
) {
  return {
    label,
    sourceLabel: value?.sourceCount ? formatMetricAuditLabel(value) : "暂无审核数据",
    tone,
    unit: value?.unitCode ?? "",
    value:
      value?.sourceCount && value.value !== null ? formatNumber(value.value) : "— —",
  };
}

function regionSurplusMetric(value: OverviewDashboardMetric | undefined) {
  const available =
    value?.coverageStatus === "AVAILABLE" &&
    value.sourceCount > 0 &&
    value.value !== null;
  const missing = !value || value.coverageStatus === "NO_APPROVED_SOURCES";
  return {
    label: "地区余粮",
    sourceLabel: available
      ? `${value.sourceCount} 条审核来源${value.dataCutoff ? ` · 截止 ${value.dataCutoff}` : ""}`
      : missing
        ? "暂无审核来源"
        : regionSurplusReliabilityLabel(value.coverageStatus),
    tone: "surplus",
    unit: value?.unitCode ?? "吨",
    value:
      available && value?.value !== null && value?.value !== undefined
        ? formatNumber(value.value)
        : missing
          ? "暂无审核数据"
          : "暂无可靠数据",
  };
}

function regionSurplusReliabilityLabel(
  status: OverviewDashboardMetric["coverageStatus"],
) {
  switch (status) {
    case "INSUFFICIENT_COVERAGE":
      return "审核来源覆盖不足";
    case "CUTOFF_MISMATCH":
      return "审核来源统计截止日不一致";
    case "UNRELIABLE_SOURCE_CONTRACT":
      return "审核来源契约不可靠";
    case "MUTUAL_EXCLUSIVITY_VIOLATION":
      return "审核来源存在重复归属";
    default:
      return "后端可靠性校验未通过";
  }
}

function linePoints(values: readonly number[], width: number, height: number) {
  const finite = values.filter(Number.isFinite);
  const minimum = finite.length ? Math.min(...finite) : 0;
  const maximum = finite.length ? Math.max(...finite) : 1;
  const span = Math.max(maximum - minimum, 1);
  return values
    .map((value, index) => {
      const x =
        values.length <= 1
          ? width / 2
          : 18 + (index / (values.length - 1)) * (width - 18);
      const y = 12 + (1 - (value - minimum) / span) * (height - 24);
      return `${x},${y}`;
    })
    .join(" ");
}

function formatNumber(value: string) {
  const number = Number(value);
  return Number.isFinite(number)
    ? new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 2 }).format(number)
    : value;
}

function formatCompact(value: number) {
  return new Intl.NumberFormat("zh-CN", {
    maximumFractionDigits: 2,
    notation: "compact",
  }).format(value);
}

function formatDateTime(value?: string) {
  if (!value) return "暂无审核数据";
  const date = new Date(value);
  return Number.isNaN(date.valueOf())
    ? value
    : new Intl.DateTimeFormat("zh-CN", {
        hour: "2-digit",
        minute: "2-digit",
        month: "2-digit",
        day: "2-digit",
        year: "numeric",
        timeZone: "Asia/Shanghai",
      }).format(date);
}

function percent(value: number, total: number) {
  return total ? `${((value / total) * 100).toFixed(1)}%` : "0%";
}

function scopeText(dashboard?: OverviewDashboard) {
  if (!dashboard) return "正在读取平台治理主数据";
  return `数据范围：${dashboard.scope.countyCount}个县区、${dashboard.scope.townshipCount}个乡镇、${dashboard.scope.villageCount}个行政村`;
}
