import type {
  OverviewDataMode,
  RegionalAgricultureProfile,
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
  agricultureProfile,
  regionalSummary,
  supplyBalance,
}: {
  issue?: string;
  loading?: boolean;
  mode: OverviewDataMode;
  productLabel?: string;
  agricultureProfile?: RegionalAgricultureProfile;
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
      {mode === "REGIONAL_DATA" && agricultureProfile && (
        <div className="overview-data-mode__profile">
          <header>
            <div>
              <h2>{agricultureProfile.regionName}农业概况</h2>
              <span>
                {agricultureProfile.year}年 ·{" "}
                {agricultureProfile.refreshStatus?.cadence ?? "自动"}更新
              </span>
            </div>
            <b>系统自动生成 · 无需人工填报</b>
          </header>
          {agricultureProfile.coverageDescription && (
            <p className="overview-data-mode__coverage">
              {agricultureProfile.coverageDescription}
            </p>
          )}
          <section aria-labelledby="regional-structure-title">
            <h3 id="regional-structure-title">种植结构</h3>
            <div className="overview-data-mode__crop-list">
              {agricultureProfile.crops.map((crop) => (
                <article key={crop.productCode}>
                  <div className="overview-data-mode__crop-heading">
                    <strong>{crop.productName}</strong>
                    <span className={`is-${crop.dataKind.toLowerCase()}`}>
                      {crop.dataKind === "OBSERVED" ? "统计值" : "模型推算"}
                    </span>
                  </div>
                  <div className="overview-data-mode__structure-bar">
                    <i
                      style={{
                        width: `${Math.min(100, Number(crop.structurePercent))}%`,
                      }}
                    />
                    <b>{format(crop.structurePercent)}%</b>
                  </div>
                  <dl>
                    <div>
                      <dt>面积</dt>
                      <dd>{format(crop.plantedAreaMu, 10_000)} 万亩</dd>
                    </div>
                    <div>
                      <dt>单产</dt>
                      <dd>{format(crop.yieldPerMuKg)} 公斤/亩</dd>
                    </div>
                    <div>
                      <dt>总产</dt>
                      <dd>{format(crop.totalOutputKg, 10_000_000)} 万吨</dd>
                    </div>
                  </dl>
                  <small title={crop.basis}>{crop.basis}</small>
                  {crop.confidencePercent && (
                    <div className="overview-data-mode__confidence">
                      <span>置信度 {format(crop.confidencePercent)}%</span>
                      {crop.uncertaintyLowKg && crop.uncertaintyHighKg && (
                        <span>
                          总产区间 {format(crop.uncertaintyLowKg, 10_000_000)}–
                          {format(crop.uncertaintyHighKg, 10_000_000)} 万吨
                        </span>
                      )}
                    </div>
                  )}
                  {crop.formula && (
                    <details>
                      <summary>查看计算公式</summary>
                      <p>{crop.formula}</p>
                    </details>
                  )}
                </article>
              ))}
            </div>
          </section>
          <section aria-labelledby="regional-forecast-title">
            <h3 id="regional-forecast-title">当年补算与明年预测</h3>
            <div className="overview-data-mode__forecast-table">
              <table>
                <thead>
                  <tr>
                    <th>品种</th>
                    <th>年度</th>
                    <th>面积(万亩)</th>
                    <th>总产(万吨)</th>
                    <th>置信度</th>
                  </tr>
                </thead>
                <tbody>
                  {agricultureProfile.crops.flatMap((crop) =>
                    crop.forecasts.map((forecast) => (
                      <tr key={`${crop.productCode}-${forecast.year}`}>
                        <th scope="row">{crop.productName}</th>
                        <td>{forecast.year}年</td>
                        <td>{format(forecast.plantedAreaMu, 10_000)}</td>
                        <td>{format(forecast.totalOutputKg, 10_000_000)}</td>
                        <td>{format(forecast.confidencePercent)}%</td>
                      </tr>
                    )),
                  )}
                </tbody>
              </table>
            </div>
          </section>
          <section aria-labelledby="regional-weather-title">
            <h3 id="regional-weather-title">农业天气</h3>
            {agricultureProfile.weather ? (
              <div className="overview-data-mode__weather">
                <dl>
                  <div>
                    <dt>气温</dt>
                    <dd>{format(agricultureProfile.weather.meanTemperatureC)}℃</dd>
                  </div>
                  <div>
                    <dt>降水</dt>
                    <dd>{format(agricultureProfile.weather.precipitationMm)} mm</dd>
                  </div>
                  <div>
                    <dt>表层墒情</dt>
                    <dd>{format(agricultureProfile.weather.soilMoisturePercent)}%</dd>
                  </div>
                </dl>
                <p>{agricultureProfile.weather.assessment}</p>
                <small>{agricultureProfile.weather.risk}</small>
              </div>
            ) : (
              <p className="overview-data-mode__pending">
                天气源正在进行首次自动同步，计算暂用区域多年气候系数。
              </p>
            )}
          </section>
          <section aria-labelledby="regional-policy-title">
            <h3 id="regional-policy-title">政策影响</h3>
            <div className="overview-data-mode__policy-list">
              {(agricultureProfile.policies ?? []).map((policy) => (
                <article key={policy.sourceUrl}>
                  <a href={policy.sourceUrl} target="_blank" rel="noreferrer">
                    {policy.title}
                  </a>
                  <small>
                    {policy.publishedOn ?? "日期待源站更新"} · {policy.sourceName}
                  </small>
                  <p>{policy.impact}</p>
                </article>
              ))}
            </div>
          </section>
          <section aria-labelledby="regional-source-title">
            <h3 id="regional-source-title">来源与计算证明</h3>
            <div className="overview-data-mode__source-list">
              {(agricultureProfile.sources ?? []).map((source) => (
                <article key={source.id}>
                  <div>
                    <a href={source.url} target="_blank" rel="noreferrer">
                      {source.name} · 查看原文
                    </a>
                    <b>{source.status === "SUCCESS" ? "已同步" : "已有基线"}</b>
                  </div>
                  <p>{source.evidence}</p>
                  <small>
                    发布 {source.publishedOn ?? "待识别"} · 抓取{" "}
                    {source.fetchedAt ?? "等待首次每日任务"}
                  </small>
                </article>
              ))}
            </div>
          </section>
          <footer>
            <p>{agricultureProfile.sourceSummary}</p>
            <p>{agricultureProfile.calculationMethod}</p>
            <p>
              更新状态：{agricultureProfile.refreshStatus?.status ?? "自动计算"}
              ；最近成功：
              {agricultureProfile.refreshStatus?.lastSuccessAt ?? "等待首次每日任务"}
            </p>
          </footer>
        </div>
      )}
      {mode === "REGIONAL_DATA" && !agricultureProfile && regionalSummary && (
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
      {mode === "REGIONAL_DATA" &&
        !loading &&
        !issue &&
        !regionalSummary &&
        !agricultureProfile && <p>请在地图上选择要查看的地区。</p>}
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
