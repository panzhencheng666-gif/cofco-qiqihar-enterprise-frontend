import type { ReactNode } from "react";

import type {
  OverviewDashboardMetric,
  OverviewDashboardSummary,
  OverviewRegion,
} from "../../domain/overview";
import { publicAssetUrl } from "../../../../shared/assets/publicAssetUrl";
import { formatMetricAuditLabel } from "../presentation/metricAuditLabel";
import type { OverviewMapSelectionPoint } from "./boundaryGeometry";
import { overviewSelectionConnector } from "./terrainReliefGeometry";

export function OverviewCommandCenter({
  boundarySource,
  dashboard,
  dashboardLoading = false,
  dataModePanel,
  dataModeControls,
  sideDataPanel = false,
  dataSourceLabel = "业务数据仅展示已填报并审核内容",
  dataStatusText,
  filters,
  map,
  navigation,
  onCloseDetails,
  onEnterSelectedRegion,
  periodLabel,
  productLabel,
  sampleNetworkControls,
  sampleMode = true,
  scopeLabel,
  samplePoints,
  selectedSamplePoint,
  onCloseSelectedSamplePoint,
  selectedRegion,
  selectionPoint,
}: {
  boundarySource?: {
    license: string;
    name: string;
    revision: string;
  };
  dashboard?: OverviewDashboardSummary;
  dashboardLoading?: boolean;
  dataModePanel?: ReactNode;
  dataModeControls?: ReactNode;
  sideDataPanel?: boolean;
  dataSourceLabel?: string;
  dataStatusText?: string;
  filters: ReactNode;
  map: ReactNode;
  navigation: ReactNode;
  onCloseDetails: () => void;
  onEnterSelectedRegion: (region: OverviewRegion) => void;
  periodLabel?: string;
  productLabel: string;
  sampleNetworkControls?: ReactNode;
  sampleMode?: boolean;
  scopeLabel?: string;
  samplePoints?: ReactNode;
  selectedSamplePoint?: { details: ReactNode; name: string };
  onCloseSelectedSamplePoint?: () => void;
  selectedRegion?: OverviewRegion;
  selectionPoint?: OverviewMapSelectionPoint;
}) {
  const metricByCode = new Map(dashboard?.metrics.map((item) => [item.code, item]));
  const overtureBoundary = boundarySource?.name.includes("Overture") ?? false;
  const selectedPath = selectedRegion?.name;
  const awaitingDashboard = dashboardLoading && !dashboard;
  const hasApprovedSources =
    dashboard?.metrics.some((item) => item.sourceCount > 0) ?? false;
  const latestUpdatedAt = dashboard?.metrics
    .map((item) => item.dataCutoff)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1);
  const metrics = [
    metric(
      "粮食播种面积",
      metricByCode.get("PRODUCTION_CULTIVATED_AREA"),
      "area",
      awaitingDashboard,
    ),
    metric(
      "预计总产量",
      metricByCode.get("PRODUCTION_ESTIMATED_OUTPUT"),
      "output",
      awaitingDashboard,
    ),
    metric(
      "平均收购价",
      metricByCode.get("MARKET_AVERAGE_PURCHASE_PRICE"),
      "price",
      awaitingDashboard,
    ),
    metric(
      "平均销售价",
      metricByCode.get("MARKET_AVERAGE_SALE_PRICE"),
      "price",
      awaitingDashboard,
    ),
  ];

  return (
    <main
      className={`overview-command-center${selectedRegion || selectedSamplePoint ? " has-details" : ""}${sideDataPanel ? " has-side-data-panel" : ""}`}
    >
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
            {dataStatusText ??
              (awaitingDashboard
                ? "正在同步审核数据"
                : hasApprovedSources
                  ? "已核验数据"
                  : "等待审核数据")}
          </span>
          <b>更新于</b>
          <strong>
            {dataStatusText
              ? "实时联动"
              : awaitingDashboard
                ? "正在同步"
                : formatDateTime(latestUpdatedAt)}
          </strong>
        </div>
      </header>

      {dataModePanel ?? (
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
      )}

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
        {sampleMode && (
          <>
            <span>
              <img
                alt=""
                className="is-production-sample"
                src={publicAssetUrl("overview/sample-points/production-rice.svg")}
              />
              产情类样本点
            </span>
            <span>
              <img
                alt=""
                className="is-market-sample"
                src={publicAssetUrl("overview/sample-points/market-bank.svg")}
              />
              市场类样本点
            </span>
            <span>
              <img
                alt=""
                className="is-logistics-sample"
                src={publicAssetUrl("overview/sample-points/logistics-car.svg")}
              />
              物流类样本点
            </span>
            <span>
              <i className="is-design-coverage" />
              设计覆盖
            </span>
            <span>
              <i className="is-design-exact" />
              已核验设计位置
            </span>
          </>
        )}
      </aside>
      <div className="overview-command-tools">
        {dataModeControls}
        {navigation}
        {sampleNetworkControls}
      </div>

      {selectedRegion && selectionPoint && <SelectionLink point={selectionPoint} />}

      {selectedSamplePoint ? (
        <aside
          aria-label="所选现有样本详情"
          className="overview-command-details overview-command-sample-details"
        >
          <header>
            <div>
              <h2>现有样本详情</h2>
              <p>{selectedSamplePoint.name}</p>
            </div>
            <button
              aria-label="关闭现有样本详情"
              onClick={onCloseSelectedSamplePoint}
              type="button"
            >
              ×
            </button>
          </header>
          {selectedSamplePoint.details}
        </aside>
      ) : selectedRegion ? (
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
            <button
              disabled={selectedRegion.level === "VILLAGE"}
              onClick={() => onEnterSelectedRegion(selectedRegion)}
              type="button"
            >
              {selectedRegion.level === "VILLAGE"
                ? "行政村样本点末级"
                : `进入${selectedRegion.name}，查看${selectedRegion.level === "PREFECTURE" ? "区县" : selectedRegion.level === "COUNTY" ? "乡镇" : "行政村"}样本`}
            </button>
          </nav>
        </aside>
      ) : null}

      <footer className="overview-command-footer">
        <span>{scopeLabel ?? scopeText(dashboard)}</span>
        <span>
          {productLabel} · {periodLabel ?? "未选择业务期间"}
        </span>
        <span>{dataSourceLabel}</span>
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

function metric(
  label: string,
  value: OverviewDashboardMetric | undefined,
  tone: string,
  loading = false,
) {
  if (loading) {
    return {
      label,
      sourceLabel: "正在同步审核数据",
      tone,
      unit: "",
      value: "正在同步",
    };
  }
  return {
    label,
    sourceLabel: value?.sourceCount ? formatMetricAuditLabel(value) : "暂无审核数据",
    tone,
    unit: value?.unitCode ?? "",
    value:
      value?.sourceCount && value.value !== null
        ? formatNumber(value.value)
        : value?.sourceCount
          ? "计算条件未完整"
          : "暂无审核数据",
  };
}

function formatNumber(value: string) {
  const number = Number(value);
  return Number.isFinite(number)
    ? new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 2 }).format(number)
    : value;
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

function scopeText(dashboard?: OverviewDashboardSummary) {
  if (!dashboard) return "正在读取平台治理主数据";
  return `数据范围：${dashboard.scope.prefectureCount}个地级范围、${dashboard.scope.countyCount}个县区、${dashboard.scope.townshipCount}个乡镇、${dashboard.scope.villageCount}个行政村`;
}
