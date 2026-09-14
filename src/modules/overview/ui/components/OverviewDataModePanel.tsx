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

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "尚未核验";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "尚未核验";
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(parsed);
}

function sourceTypeLabel(type: "AGRICULTURE" | "WEATHER" | "POLICY"): string {
  if (type === "AGRICULTURE") return "统计资料";
  if (type === "WEATHER") return "气象资料";
  return "政策资料";
}

function sourceStatusLabel(status: string): string {
  return status === "SUCCESS" ? "今日已核验" : "沿用最近有效资料";
}

function sourceClassLabel(sourceClass: string): string {
  if (sourceClass === "OFFICIAL") return "政府公开";
  if (sourceClass === "PUBLIC_DATA_SERVICE") return "公共数据服务";
  if (sourceClass === "MAINSTREAM_MEDIA") return "主流媒体";
  if (sourceClass === "GOVERNMENT_MEDIA") return "政务媒体";
  if (sourceClass === "MEDIA_PUBLIC_ACCOUNT") return "媒体公众号";
  if (sourceClass === "INDUSTRY_MEDIA") return "行业媒体";
  return "公开渠道";
}

function indicatorCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    LAND: "土地与种植",
    PRODUCTION: "粮食生产",
    INFRASTRUCTURE: "农业基础设施",
    TECHNOLOGY: "农机与技术",
    INPUT: "农资保障",
    PROCESSING: "加工能力",
    FINANCE: "金融与补贴",
    BRAND: "绿色农业与品牌",
    LOGISTICS: "仓储与流通",
    RISK: "灾害与风险",
  };
  return labels[category] ?? "农业综合指标";
}

function indicatorKindLabel(
  kind: "OBSERVED" | "ESTIMATED" | "PLAN" | "CONTEXT",
): string {
  if (kind === "OBSERVED") return "公开统计";
  if (kind === "ESTIMATED") return "模型推算";
  if (kind === "PLAN") return "公开计划";
  return "公开参考";
}

function agricultureSummary(profile: RegionalAgricultureProfile) {
  const plantedAreaMu = profile.crops.reduce(
    (sum, crop) => sum + Number(crop.plantedAreaMu),
    0,
  );
  const totalOutputKg = profile.crops.reduce(
    (sum, crop) => sum + Number(crop.totalOutputKg),
    0,
  );
  const nextOutputKg = profile.crops.reduce(
    (sum, crop) => sum + Number(crop.forecasts[0]?.totalOutputKg ?? 0),
    0,
  );
  const observedCount = profile.crops.filter(
    (crop) => crop.dataKind === "OBSERVED",
  ).length;
  return {
    plantedAreaMu,
    totalOutputKg,
    weightedYield: plantedAreaMu > 0 ? totalOutputKg / plantedAreaMu : 0,
    concentration: Math.max(
      0,
      ...profile.crops.map((crop) => Number(crop.structurePercent)),
    ),
    observedPercent:
      profile.crops.length > 0 ? (observedCount / profile.crops.length) * 100 : 0,
    estimatedCount: profile.crops.length - observedCount,
    forecastChange: totalOutputKg > 0 ? (nextOutputKg / totalOutputKg - 1) * 100 : 0,
  };
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
  const summary = agricultureProfile
    ? agricultureSummary(agricultureProfile)
    : undefined;
  const leadingCrop = agricultureProfile?.crops.reduce((best, crop) =>
    Number(crop.structurePercent) > Number(best.structurePercent) ? crop : best,
  );
  const indicatorGroups = agricultureProfile
    ? Array.from(
        new Map(
          (agricultureProfile.indicators ?? []).map((indicator) => [
            indicator.category,
            (agricultureProfile.indicators ?? []).filter(
              (candidate) => candidate.category === indicator.category,
            ),
          ]),
        ),
      )
    : [];
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
          <section aria-labelledby="regional-facts-title">
            <h3 id="regional-facts-title">地区档案</h3>
            <div className="overview-data-mode__fact-grid">
              <div>
                <span>区域面积</span>
                <strong>
                  {format(String(agricultureProfile.regionFacts.areaSquareKilometres))}
                </strong>
                <small>平方公里</small>
              </div>
              <div>
                <span>直接下辖</span>
                <strong>{agricultureProfile.regionFacts.directChildCount}</strong>
                <small>个行政区</small>
              </div>
              <div>
                <span>县级地区</span>
                <strong>{agricultureProfile.regionFacts.countyCount}</strong>
                <small>个</small>
              </div>
              <div>
                <span>乡镇地区</span>
                <strong>{agricultureProfile.regionFacts.townshipCount}</strong>
                <small>个</small>
              </div>
              <div>
                <span>行政村</span>
                <strong>{agricultureProfile.regionFacts.villageCount}</strong>
                <small>个</small>
              </div>
              <div>
                <span>主导作物</span>
                <strong>{leadingCrop?.productName ?? "—"}</strong>
                <small>按种植结构</small>
              </div>
            </div>
            {summary && leadingCrop && (
              <p className="overview-data-mode__introduction">
                {agricultureProfile.regionName}区域面积约
                {format(String(agricultureProfile.regionFacts.areaSquareKilometres))}
                平方公里
                {agricultureProfile.regionFacts.directChildCount > 0
                  ? `，直接下辖${agricultureProfile.regionFacts.directChildCount}个行政区`
                  : ""}
                ；玉米、大豆、水稻播种规模约
                {format(String(summary.plantedAreaMu), 10_000)}万亩，总产约
                {format(String(summary.totalOutputKg), 10_000_000)}万吨，种植结构以
                {leadingCrop.productName}
                为主。档案由公开资料、行政区边界、天气和政策信息自动融合生成。
              </p>
            )}
          </section>
          {(agricultureProfile.sources ?? []).some(
            (source) => source.type === "AGRICULTURE",
          ) && (
            <section aria-labelledby="regional-highlights-title">
              <h3 id="regional-highlights-title">区域农业要点</h3>
              <div className="overview-data-mode__highlight-list">
                {(agricultureProfile.sources ?? [])
                  .filter((source) => source.type === "AGRICULTURE")
                  .slice(0, 4)
                  .map((source) => (
                    <article key={`highlight-${source.id}`}>
                      <b>{source.name}</b>
                      <p>{source.evidence}</p>
                    </article>
                  ))}
              </div>
            </section>
          )}
          {summary && (
            <section aria-labelledby="regional-scale-title">
              <h3 id="regional-scale-title">农业规模与效率</h3>
              <div className="overview-data-mode__fact-grid is-agriculture">
                <div>
                  <span>三品种播种规模</span>
                  <strong>{format(String(summary.plantedAreaMu), 10_000)}</strong>
                  <small>万亩</small>
                </div>
                <div>
                  <span>三品种总产</span>
                  <strong>{format(String(summary.totalOutputKg), 10_000_000)}</strong>
                  <small>万吨</small>
                </div>
                <div>
                  <span>加权单产</span>
                  <strong>{format(String(summary.weightedYield))}</strong>
                  <small>公斤/亩</small>
                </div>
                <div>
                  <span>种植集中度</span>
                  <strong>{format(String(summary.concentration))}%</strong>
                  <small>最大品种占比</small>
                </div>
                <div>
                  <span>公开值覆盖</span>
                  <strong>{format(String(summary.observedPercent))}%</strong>
                  <small>其余由模型补算</small>
                </div>
                <div>
                  <span>明年产量变化</span>
                  <strong>
                    {summary.forecastChange >= 0 ? "+" : ""}
                    {format(String(summary.forecastChange))}%
                  </strong>
                  <small>三品种合计预测</small>
                </div>
              </div>
              <p className="overview-data-mode__scale-note">
                当前三品种中 {summary.estimatedCount}{" "}
                个品种存在模型补算；全部结果均给出可信区间。
              </p>
            </section>
          )}
          {indicatorGroups.length > 0 && (
            <section aria-labelledby="regional-indicators-title">
              <h3 id="regional-indicators-title">农业粮食专题指标</h3>
              {agricultureProfile.administrativeLevel !== "PREFECTURE" && (
                <p className="overview-data-mode__indicator-note">
                  专题指标为所属地市公开参考；本级种植结构与产量由边界和统计模型另行计算。
                </p>
              )}
              <div className="overview-data-mode__indicator-groups">
                {indicatorGroups.map(([category, indicators]) => (
                  <section key={category}>
                    <h4>{indicatorCategoryLabel(category)}</h4>
                    <div className="overview-data-mode__indicator-grid">
                      {indicators.map((indicator) => (
                        <article key={`${category}-${indicator.label}`}>
                          <div>
                            <span>{indicator.label}</span>
                            <b>{indicatorKindLabel(indicator.dataKind)}</b>
                          </div>
                          <strong>
                            {format(indicator.value)} <small>{indicator.unit}</small>
                          </strong>
                          <p>
                            {indicator.dataYear}年 · {indicator.method}
                          </p>
                          <a
                            href={indicator.sourceUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {indicator.sourceName} · 查看依据
                          </a>
                        </article>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            </section>
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
                  <div className="overview-data-mode__basis">
                    <span>数据依据</span>
                    <p>{crop.basis}</p>
                  </div>
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
                      <summary>数据如何得出</summary>
                      <dl className="overview-data-mode__calculation">
                        <div>
                          <dt>当年计算</dt>
                          <dd>{crop.formula}</dd>
                        </div>
                        {crop.forecasts[0]?.formula && (
                          <div>
                            <dt>明年预测</dt>
                            <dd>{crop.forecasts[0].formula}</dd>
                          </div>
                        )}
                      </dl>
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
                    <span>
                      {sourceTypeLabel(source.type)} ·{" "}
                      {sourceClassLabel(source.sourceClass)} · 权重{" "}
                      {format(String(Number(source.reliabilityWeight) * 100))}%
                    </span>
                    <b>{sourceStatusLabel(source.status)}</b>
                  </div>
                  <a href={source.url} target="_blank" rel="noreferrer">
                    {source.name} · 查看原文
                  </a>
                  <dl className="overview-data-mode__source-proof">
                    <div>
                      <dt>公开依据</dt>
                      <dd>{source.evidence}</dd>
                    </div>
                    <div>
                      <dt>资料日期</dt>
                      <dd>{source.publishedOn ?? "来源页未标注"}</dd>
                    </div>
                    <div>
                      <dt>最近核验</dt>
                      <dd>{formatDateTime(source.fetchedAt)}</dd>
                    </div>
                  </dl>
                </article>
              ))}
            </div>
          </section>
          <footer>
            <p>{agricultureProfile.sourceSummary}</p>
            <p>{agricultureProfile.calculationMethod}</p>
            <p>
              每日 08:30 自动查找公开资料并重新计算；最近完成：
              {formatDateTime(agricultureProfile.refreshStatus?.lastSuccessAt)}
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
