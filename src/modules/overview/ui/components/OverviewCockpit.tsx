import type { ReactNode } from "react";

import type {
  OverviewDashboard,
  OverviewDashboardMetric,
  OverviewIndicator,
  OverviewRegion,
} from "../../domain/overview";
import { formatMetricAuditLabel } from "../presentation/metricAuditLabel";
import { businessPlatformLedgerUrl } from "../businessPlatformNavigation";

export function OverviewCockpit({
  dashboard,
  filters,
  indicators,
  map,
  mapControls,
  navigation,
  periodLabel,
  productLabel,
  selectedRegion,
}: {
  dashboard?: OverviewDashboard;
  filters: ReactNode;
  indicators: readonly OverviewIndicator[];
  map: ReactNode;
  mapControls: ReactNode;
  navigation: ReactNode;
  periodLabel?: string;
  productLabel: string;
  selectedRegion?: OverviewRegion;
}) {
  const metricByCode = new Map(dashboard?.metrics.map((item) => [item.code, item]));
  const path = dashboard?.regionPath.map((item) => item.label) ?? [];
  const selectedPath = path.length
    ? path.join(" / ")
    : (selectedRegion?.name ?? "请选择地图地区");
  const sourceCount = indicators.reduce((sum, item) => sum + item.sourceCount, 0);
  const cards = [
    scopeCard("纳入县区", dashboard?.scope.countyCount, "个", "county"),
    scopeCard("行政村", dashboard?.scope.villageCount, "个", "village"),
    scopeCard("填报单位", dashboard?.scope.reportingUnitCount, "家", "unit"),
    metricCard(
      "粮食产量",
      metricByCode.get("PRODUCTION_ESTIMATED_OUTPUT"),
      "production",
    ),
    metricCard("收购量", metricByCode.get("MARKET_PURCHASE_VOLUME"), "purchase"),
    metricCard("库存量", metricByCode.get("MARKET_ENDING_INVENTORY"), "inventory"),
    regionSurplusCard(metricByCode.get("REGION_SURPLUS")),
  ];

  return (
    <main className="overview-page overview-cockpit">
      <header className="overview-cockpit-header">
        <h1>齐齐哈尔粮食商情企业平台 / 总揽监测</h1>
        <h2 className="overview-sr-only">粮食商情总览</h2>
        {filters}
        <div className="overview-updated-at">
          <span>数据更新时间</span>
          <strong>{formatDateTime(dashboard?.scope.latestUpdatedAt)}</strong>
        </div>
      </header>

      <section aria-label="总揽关键指标" className="overview-kpi-grid">
        {cards.map((card) => (
          <article className={`overview-kpi is-${card.tone}`} key={card.label}>
            <span aria-hidden="true" className="overview-kpi-icon">
              {card.icon}
            </span>
            <div>
              <p>{card.label}</p>
              <strong>{card.value}</strong>
              <small>{card.unit}</small>
              <em>{card.sourceLabel}</em>
            </div>
          </article>
        ))}
      </section>

      <section className="overview-cockpit-main">
        <aside className="overview-layer-panel">
          <p>图层切换</p>
          <button aria-pressed="true" type="button">
            <span />
            行政区划
          </button>
          <button aria-pressed="false" type="button">
            <span />
            业务状态
          </button>
        </aside>

        <section aria-label="粮食商情总览地图" className="overview-cockpit-map">
          {map}
          {navigation}
          {mapControls}
          <div className="overview-map-legend">
            <p>数据状态图例</p>
            <span>
              <i className="is-approved" />
              有审核数据
            </span>
            <span>
              <i className="is-warning" />
              存在异常
            </span>
            <span>
              <i className="is-empty" />
              暂无审核数据
            </span>
          </div>
        </section>

        <aside aria-label="已选择地区业务档案" className="overview-profile-panel">
          <header>
            <h2>已选择：{selectedPath}</h2>
            <span className={sourceCount ? "is-approved" : "is-empty"}>
              数据状态：{sourceCount ? "已关联审核数据" : "暂无审核数据"}
            </span>
          </header>
          <ProfileSection
            icon="▣"
            items={[
              ["行政区划代码", selectedRegion?.code],
              ["行政层级", levelLabel(selectedRegion?.level)],
              [
                "审核记录",
                dashboard ? String(dashboard.scope.approvedRecordCount) : undefined,
              ],
              ["数据更新时间", formatDateTime(dashboard?.scope.latestUpdatedAt)],
            ]}
            title="基础信息"
          />
          <IndicatorSection
            indicators={indicators.filter((item) => item.sourceDomain === "PRODUCTION")}
            title="粮食生产"
            tone="production"
          />
          <IndicatorSection
            indicators={indicators.filter((item) => item.sourceDomain === "MARKET")}
            title="购销库存"
            tone="market"
          />
          <IndicatorSection
            indicators={indicators.filter(
              (item) =>
                item.sourceDomain === "LOGISTICS" || item.sourceDomain === "SUPPLY",
            )}
            title="物流与供需"
            tone="supply"
          />
          <div className="overview-profile-actions">
            <a href={indicatorSource(indicators, "PRODUCTION")}>查看完整档案</a>
            <a href={businessPlatformLedgerUrl()} target="_top">
              进入地区监测
            </a>
            <button type="button" onClick={() => window.print()}>
              导出讲解卡片
            </button>
          </div>
        </aside>
      </section>

      <section aria-label="业务数据联动分析" className="overview-analysis-grid">
        <TrendPanel dashboard={dashboard} />
        <ProductStructurePanel dashboard={dashboard} />
        <ActivityPanel dashboard={dashboard} />
        <AlertPanel dashboard={dashboard} />
      </section>

      <footer className="overview-cockpit-footer">
        <span>数据范围：{scopeText(dashboard)}</span>
        <span>
          {productLabel} · {periodLabel ?? "未选择业务期间"}
        </span>
        <span>仅展示业务平台已填报并符合审核口径的数据</span>
      </footer>
    </main>
  );
}

function ProfileSection({
  icon,
  items,
  title,
}: {
  icon: string;
  items: readonly (readonly [string, string | undefined])[];
  title: string;
}) {
  return (
    <section className="overview-profile-section">
      <h3>
        <span aria-hidden="true">{icon}</span>
        {title}
      </h3>
      <dl>
        {items.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value || "暂无填报数据"}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function IndicatorSection({
  indicators,
  title,
  tone,
}: {
  indicators: readonly OverviewIndicator[];
  title: string;
  tone: string;
}) {
  const visible = indicators.filter((item) => item.sourceCount > 0);
  return (
    <section className={`overview-profile-section is-${tone}`}>
      <h3>
        <span aria-hidden="true">◆</span>
        {title}
      </h3>
      {visible.length ? (
        <dl>
          {visible.slice(0, 4).map((item) => (
            <div key={item.code}>
              <dt>{item.name}</dt>
              <dd>
                {formatNumber(item.value)} <small>{item.unitCode}</small>
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="overview-data-empty">当前条件下暂无已审核填报数据</p>
      )}
    </section>
  );
}

function TrendPanel({ dashboard }: { dashboard: OverviewDashboard | undefined }) {
  const data = dashboard?.priceTrend ?? [];
  const values = data.map((item) => Number(item.value)).filter(Number.isFinite);
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 1;
  const span = Math.max(max - min, 1);
  const points = data
    .map((item, index) => {
      const x = data.length <= 1 ? 150 : 18 + (index / (data.length - 1)) * 264;
      const y = 84 - ((Number(item.value) - min) / span) * 58;
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <article className="overview-analysis-card overview-trend-card">
      <header>
        <h3>近12月价格走势</h3>
        <span>单位：元/吨</span>
      </header>
      {data.length ? (
        <>
          <svg aria-label="价格趋势图" role="img" viewBox="0 0 300 110">
            <g className="overview-chart-grid">
              <path d="M12 24H290M12 54H290M12 84H290" />
            </g>
            <polyline points={points} />
            {points.split(" ").map((point, index) => {
              const [cx, cy] = point.split(",");
              return <circle cx={cx} cy={cy} key={data[index]?.periodLabel} r="3" />;
            })}
          </svg>
          <div className="overview-axis-labels">
            {data.map((item) => (
              <span key={item.periodLabel}>{item.periodLabel.slice(5)}</span>
            ))}
          </div>
        </>
      ) : (
        <EmptyChart />
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
  const colors = ["#2d82ef", "#27c8ad", "#f2b84b", "#869bb6"];
  const cumulativeValues = data.reduce<readonly number[]>(
    (values, item) => [...values, (values.at(-1) ?? 0) + Number(item.value || 0)],
    [],
  );
  const stops = data.map((_item, index) => {
    const start = total ? ((cumulativeValues[index - 1] ?? 0) / total) * 100 : 0;
    const end = total ? ((cumulativeValues[index] ?? 0) / total) * 100 : 0;
    return `${colors[index % colors.length]} ${start}% ${end}%`;
  });
  return (
    <article className="overview-analysis-card overview-structure-card">
      <header>
        <h3>品种结构</h3>
        <span>审核产量占比</span>
      </header>
      {data.length ? (
        <div className="overview-structure-content">
          <div
            className="overview-donut"
            style={{ background: `conic-gradient(${stops.join(",")})` }}
          >
            <strong>{formatCompact(total)}</strong>
            <small>公斤</small>
          </div>
          <ul>
            {data.map((item, index) => (
              <li key={item.productCode}>
                <i style={{ background: colors[index % colors.length] }} />
                <span>{item.productName}</span>
                <strong>{percent(Number(item.value), total)}</strong>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <EmptyChart />
      )}
    </article>
  );
}

function ActivityPanel({ dashboard }: { dashboard: OverviewDashboard | undefined }) {
  const data = dashboard?.regionActivity ?? [];
  const max = Math.max(...data.map((item) => item.totalCount), 1);
  return (
    <article className="overview-analysis-card overview-activity-card">
      <header>
        <h3>审核完成率</h3>
        <span>按当前下级区域</span>
      </header>
      {data.length ? (
        <div className="overview-bars">
          {data.slice(0, 7).map((item) => (
            <div key={item.regionCode}>
              <span
                style={{ height: `${Math.max((item.totalCount / max) * 72, 3)}px` }}
              >
                <i
                  style={{
                    height: `${item.totalCount ? (item.approvedCount / item.totalCount) * 100 : 0}%`,
                  }}
                />
              </span>
              <strong>
                {item.totalCount
                  ? Math.round((item.approvedCount / item.totalCount) * 100)
                  : 0}
                %
              </strong>
              <small>{item.regionName}</small>
            </div>
          ))}
        </div>
      ) : (
        <EmptyChart />
      )}
    </article>
  );
}

function AlertPanel({ dashboard }: { dashboard: OverviewDashboard | undefined }) {
  const alerts = dashboard?.alerts ?? [];
  return (
    <article className="overview-analysis-card overview-alert-card">
      <header>
        <h3>重点异常提醒</h3>
        <span>来自平台填报与审核状态</span>
      </header>
      {alerts.length ? (
        <table>
          <thead>
            <tr>
              <th>等级</th>
              <th>区域</th>
              <th>内容</th>
              <th>日期</th>
            </tr>
          </thead>
          <tbody>
            {alerts.slice(0, 5).map((item, index) => (
              <tr key={`${item.code}-${item.regionName}-${index}`}>
                <td>
                  <span className={`is-${item.severity.toLowerCase()}`}>
                    {severityLabel(item.severity)}
                  </span>
                </td>
                <td>{item.regionName}</td>
                <td>{item.message}</td>
                <td>{item.occurredOn}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <EmptyChart label="当前条件下无业务异常" />
      )}
    </article>
  );
}

function EmptyChart({ label = "暂无已审核填报数据" }: { label?: string }) {
  return <p className="overview-chart-empty">{label}</p>;
}

function metricCard(
  label: string,
  metric: OverviewDashboardMetric | undefined,
  tone: string,
) {
  return {
    icon: tone === "production" ? "穗" : tone === "purchase" ? "购" : "仓",
    label,
    sourceLabel: metric?.sourceCount ? formatMetricAuditLabel(metric) : "暂无审核来源",
    tone,
    unit: metric?.unitCode ?? "",
    value:
      metric?.sourceCount && metric.value !== null ? formatNumber(metric.value) : "—",
  };
}

function regionSurplusCard(metric: OverviewDashboardMetric | undefined) {
  const available =
    metric?.coverageStatus === "AVAILABLE" &&
    metric.sourceCount > 0 &&
    metric.value !== null;
  const partial =
    metric?.coverageStatus === "PARTIAL" &&
    metric.sourceCount > 0 &&
    metric.value !== null;
  const missing = !metric || metric.coverageStatus === "NO_APPROVED_SOURCES";
  return {
    icon: "余",
    label: "地区余粮",
    sourceLabel: available
      ? `${metric.sourceCount} 条审核来源${metric.dataCutoff ? ` · 截止 ${metric.dataCutoff}` : ""}`
      : partial
        ? `${metric.sourceCount} 条审核来源 · 来源范围不完整${metric.dataCutoff ? ` · 截止 ${metric.dataCutoff}` : ""}`
        : missing
          ? "暂无审核来源"
          : reliabilityLabel(metric.coverageStatus),
    tone: "surplus",
    unit: metric?.unitCode ?? "吨",
    value:
      (available || partial) && metric?.value !== null && metric?.value !== undefined
        ? formatNumber(metric.value)
        : missing
          ? "暂无审核数据"
          : "暂无可靠数据",
  };
}

function reliabilityLabel(status: OverviewDashboardMetric["coverageStatus"]) {
  switch (status) {
    case "PARTIAL":
      return "审核来源范围不完整";
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

function scopeCard(
  label: string,
  value: number | undefined,
  unit: string,
  tone: string,
) {
  return {
    icon: tone === "county" ? "区" : tone === "village" ? "村" : "企",
    label,
    sourceLabel: "平台治理主数据",
    tone,
    unit,
    value: value === undefined ? "—" : formatNumber(String(value)),
  };
}

function indicatorSource(
  indicators: readonly OverviewIndicator[],
  domain: OverviewIndicator["sourceDomain"],
) {
  return (
    indicators.find((item) => item.sourceDomain === domain)?.sourcePath ?? "#/overview"
  );
}

function formatNumber(value: string | null) {
  if (value === null) return "暂无可靠数据";
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
        dateStyle: "short",
        timeStyle: "medium",
        timeZone: "Asia/Shanghai",
      }).format(date);
}

function levelLabel(level?: OverviewRegion["level"]) {
  return level
    ? (
        {
          PREFECTURE: "地市",
          COUNTY: "县区",
          TOWNSHIP: "乡镇",
          VILLAGE: "行政村",
        } as const
      )[level]
    : undefined;
}

function percent(value: number, total: number) {
  return total ? `${((value / total) * 100).toFixed(1)}%` : "0%";
}

function severityLabel(severity: OverviewDashboard["alerts"][number]["severity"]) {
  return ({ INFO: "提示", WARNING: "注意", CRITICAL: "紧急" } as const)[severity];
}

function scopeText(dashboard?: OverviewDashboard) {
  if (!dashboard) return "正在读取平台治理主数据";
  return `${dashboard.scope.countyCount}个县区、${dashboard.scope.townshipCount}个乡镇、${dashboard.scope.villageCount}个行政村`;
}
