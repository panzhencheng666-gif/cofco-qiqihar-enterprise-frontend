import type {
  OverviewDataMode,
  RegionalCropSummary,
  SupplyBalanceSummary,
} from "../../domain/overviewRegionalData";
import "./overview-data-mode.css";

function format(value: string | null | undefined, divisor = 1): string {
  if (value === null || value === undefined || value === "") return "—";
  const number = Number(value) / divisor;
  return Number.isFinite(number)
    ? number.toLocaleString("zh-CN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : "—";
}

const DATA_MODES = ["SAMPLE_POINTS", "REGIONAL_DATA", "SUPPLY_BALANCE"] as const;
const CORE_BALANCE_CODES = [
  "OUTPUT",
  "TOTAL_SUPPLY",
  "TOTAL_DEMAND",
  "CLOSING_INVENTORY",
  "DEMAND_SUPPLY_RATIO",
] as const;

type SupplyBalanceRow = SupplyBalanceSummary["rows"][number];

function modeLabel(mode: OverviewDataMode): string {
  if (mode === "SAMPLE_POINTS") return "样本点";
  if (mode === "REGIONAL_DATA") return "地区数据";
  return "供需平衡";
}

function balanceValueLabel(row: SupplyBalanceRow): string {
  if (row.display !== null && row.display !== "") return row.display;
  if (row.kind === "MANUAL") return "待填报";
  if (row.kind === "RATIO") return "不可计算";
  return "计算条件未完整";
}

export function OverviewDataModeTabs({
  mode,
  onModeChange,
}: {
  mode: OverviewDataMode;
  onModeChange: (mode: OverviewDataMode) => void;
}) {
  return (
    <nav aria-label="总揽展示内容" className="overview-data-mode-tabs">
      {DATA_MODES.map((item) => (
        <button
          aria-pressed={mode === item}
          key={item}
          type="button"
          onClick={() => onModeChange(item)}
        >
          {modeLabel(item)}
        </button>
      ))}
    </nav>
  );
}

export function OverviewDataModePanel({
  issue,
  loading = false,
  mode,
  productLabel,
  regionalSummary,
  supplyBalance,
}: {
  issue?: string;
  loading?: boolean;
  mode: OverviewDataMode;
  productLabel?: string;
  regionalSummary?: RegionalCropSummary;
  supplyBalance?: SupplyBalanceSummary;
}) {
  return (
    <section
      className={`overview-data-mode is-${mode.toLowerCase()}`}
      aria-label="总揽数据模式"
    >
      {mode !== "SAMPLE_POINTS" && loading && <p role="status">正在同步地区正式数据</p>}
      {mode !== "SAMPLE_POINTS" && issue && (
        <p className="overview-data-mode__issue" role="alert">
          {issue}
        </p>
      )}
      {mode === "REGIONAL_DATA" && regionalSummary && (
        <>
          <header>
            <strong>{regionalSummary.regionName}</strong>
            <span>
              {regionalSummary.year}年 · {productLabel ?? regionalSummary.productCode}
            </span>
          </header>
          <div className="overview-data-mode__metrics">
            <article>
              <span>播种面积</span>
              <strong>{format(regionalSummary.plantedAreaMu, 10_000)}</strong>
              <small>万亩</small>
            </article>
            <article>
              <span>单产</span>
              <strong>{format(regionalSummary.yieldPerMuKg)}</strong>
              <small>公斤/亩</small>
            </article>
            <article>
              <span>总产</span>
              <strong>{format(regionalSummary.totalOutputKg, 10_000_000)}</strong>
              <small>万吨</small>
            </article>
            <article>
              <span>结构调整增减</span>
              <strong>{format(regionalSummary.areaChangeWanMu)}</strong>
              <small>万亩</small>
            </article>
            <article>
              <span>增减比率</span>
              <strong>
                {regionalSummary.areaChangeRateAvailable
                  ? format(regionalSummary.areaChangeRatePercent)
                  : "—"}
              </strong>
              <small>%</small>
            </article>
          </div>
          <p className="overview-data-mode__message">
            {regionalSummary.comparisonMessage}
          </p>
        </>
      )}
      {mode === "REGIONAL_DATA" && !loading && !issue && !regionalSummary && (
        <p>请在地图上选择要查看的地区。</p>
      )}
      {mode === "SUPPLY_BALANCE" && supplyBalance && (
        <div className="overview-data-mode__balance">
          <header>
            <strong>{supplyBalance.regionName}供需平衡</strong>
            <span>
              {supplyBalance.surveyYear}年 · {productLabel ?? supplyBalance.productCode}
            </span>
          </header>
          <ol
            aria-label="供需平衡核心指标"
            className="overview-data-mode__balance-metrics"
          >
            {CORE_BALANCE_CODES.map((code) =>
              supplyBalance.rows.find((row) => row.code === code),
            )
              .filter((row): row is SupplyBalanceRow => row !== undefined)
              .map((row) => (
                <li className={`is-${row.code.toLowerCase()}`} key={row.code}>
                  <span>{row.label}</span>
                  <div>
                    <strong>{balanceValueLabel(row)}</strong>
                    <small>{row.unit}</small>
                  </div>
                </li>
              ))}
          </ol>
          <div className="overview-data-mode__balance-table">
            <table aria-label="供需平衡完整明细">
              <colgroup>
                <col className="is-item" />
                <col className="is-value" />
                <col className="is-unit" />
              </colgroup>
              <thead>
                <tr>
                  <th>项目</th>
                  <th>数值</th>
                  <th>单位</th>
                </tr>
              </thead>
              <tbody>
                {supplyBalance.rows.map((row) => (
                  <tr key={row.code}>
                    <th scope="row">
                      <strong>{row.label}</strong> <small>{row.requirement}</small>
                    </th>
                    <td className={row.display === null ? "is-pending" : undefined}>
                      {balanceValueLabel(row)}
                    </td>
                    <td>{row.unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {mode === "SUPPLY_BALANCE" && !loading && !issue && !supplyBalance && (
        <p>请在地图上选择要查看的地区。</p>
      )}
    </section>
  );
}
