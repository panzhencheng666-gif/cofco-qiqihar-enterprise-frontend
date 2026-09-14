import { useMemo, useState } from "react";

import type { RegionalAgricultureProfile } from "../../domain/overviewRegionalData";

type Indicator = NonNullable<RegionalAgricultureProfile["indicators"]>[number];
type Source = NonNullable<RegionalAgricultureProfile["sources"]>[number];
type Crop = RegionalAgricultureProfile["crops"][number];

interface DataExplanation {
  title: string;
  value: string;
  dataPeriod: string;
  calculationTime: string;
  method: string;
  formula?: string;
  sourceName?: string;
  sourceUrl?: string;
  evidence?: string;
}

function format(value: string | number | null | undefined, divisor = 1): string {
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
  if (!value) return "尚未完成";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "尚未完成";
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(parsed);
}

function categoryLabel(category: string): string {
  return (
    {
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
    }[category] ?? "农业综合指标"
  );
}

function kindLabel(kind: Indicator["dataKind"]): string {
  if (kind === "OBSERVED") return "公开统计";
  if (kind === "ESTIMATED") return "公式计算";
  if (kind === "PLAN") return "公开计划";
  return "公开参考";
}

function sourceClassLabel(value: string): string {
  if (value === "OFFICIAL") return "政府公开";
  if (value === "PUBLIC_DATA_SERVICE") return "公共数据服务";
  if (value === "MAINSTREAM_MEDIA") return "主流媒体";
  if (value === "GOVERNMENT_MEDIA") return "政务媒体";
  if (value === "MEDIA_PUBLIC_ACCOUNT") return "媒体公众号";
  if (value === "INDUSTRY_MEDIA") return "行业媒体";
  return "公开渠道";
}

function sourceTypeLabel(value: Source["type"]): string {
  if (value === "WEATHER") return "气象";
  if (value === "POLICY") return "政策";
  return "农业统计";
}

function sourceStatusLabel(value: string): string {
  return value === "SUCCESS" ? "本轮核验成功" : "保留最近有效值";
}

function metricFormula(
  crop: Crop,
  key: "area" | "yield" | "output" | "share",
  totalArea: number,
) {
  if (key === "area")
    return `${crop.productName}面积=${format(crop.plantedAreaMu, 10_000)}万亩`;
  if (key === "yield")
    return `${crop.productName}亩均单产=${format(crop.yieldPerMuKg)}公斤/亩`;
  if (key === "output") {
    return `${format(crop.plantedAreaMu, 10_000)}万亩×${format(crop.yieldPerMuKg)}公斤/亩÷100=${format(crop.totalOutputKg, 10_000_000)}万吨`;
  }
  return `${format(crop.plantedAreaMu, 10_000)}÷${format(totalArea, 10_000)}×100=${format(crop.structurePercent)}%`;
}

export function RegionalAgricultureProfilePanel({
  profile,
}: {
  profile: RegionalAgricultureProfile;
}) {
  const [detail, setDetail] = useState<DataExplanation>();
  const summary = useMemo(() => {
    const totalArea = profile.crops.reduce(
      (sum, crop) => sum + Number(crop.plantedAreaMu),
      0,
    );
    const totalOutput = profile.crops.reduce(
      (sum, crop) => sum + Number(crop.totalOutputKg),
      0,
    );
    const nextOutput = profile.crops.reduce(
      (sum, crop) => sum + Number(crop.forecasts[0]?.totalOutputKg ?? 0),
      0,
    );
    const observed = profile.crops.filter(
      (crop) => crop.dataKind === "OBSERVED",
    ).length;
    const shares = profile.crops.map((crop) => Number(crop.structurePercent) / 100);
    const sources = profile.sources ?? [];
    const official = sources.filter((source) =>
      ["OFFICIAL", "GOVERNMENT_MEDIA"].includes(source.sourceClass),
    ).length;
    const successful = sources.filter((source) => source.status === "SUCCESS").length;
    const forecastConfidences = profile.crops.flatMap((crop) =>
      crop.forecasts.map((forecast) => Number(forecast.confidencePercent ?? 0)),
    );
    return {
      totalArea,
      totalOutput,
      nextOutput,
      weightedYield: totalArea > 0 ? totalOutput / totalArea : 0,
      concentration: Math.max(0, ...shares) * 100,
      diversity: (1 - shares.reduce((sum, share) => sum + share * share, 0)) * 100,
      observed,
      observedPercent: profile.crops.length
        ? (observed / profile.crops.length) * 100
        : 0,
      forecastChange: totalOutput ? (nextOutput / totalOutput - 1) * 100 : 0,
      outputDensity:
        Number(profile.regionFacts.areaSquareKilometres) > 0
          ? totalOutput / 1_000 / Number(profile.regionFacts.areaSquareKilometres)
          : 0,
      sourceCount: sources.length,
      officialPercent: sources.length ? (official / sources.length) * 100 : 0,
      successful,
      retained: sources.length - successful,
      forecastConfidence: forecastConfidences.length
        ? forecastConfidences.reduce((sum, value) => sum + value, 0) /
          forecastConfidences.length
        : 0,
    };
  }, [profile]);

  const leadingCrop = profile.crops.reduce<Crop | undefined>(
    (best, crop) =>
      !best || Number(crop.structurePercent) > Number(best.structurePercent)
        ? crop
        : best,
    undefined,
  );
  const groups = useMemo(() => {
    const result = new Map<string, Indicator[]>();
    (profile.indicators ?? []).forEach((indicator) => {
      result.set(indicator.category, [
        ...(result.get(indicator.category) ?? []),
        indicator,
      ]);
    });
    return [...result.entries()];
  }, [profile.indicators]);
  const calculatedAt = formatDateTime(profile.generatedAt);
  const openSummary = (
    title: string,
    value: string,
    formula: string,
    method = "由本页三个品种的当前值实时汇总",
  ) =>
    setDetail({
      title,
      value,
      dataPeriod: `${profile.year}年`,
      calculationTime: calculatedAt,
      method,
      formula,
    });

  return (
    <div className="overview-data-mode__profile">
      <header>
        <div>
          <h2>{profile.regionName}农业概况</h2>
          <span>公开资料自动核验 · 缺项自动补算 · 仅预测下一年</span>
        </div>
        <b>无需日常人工填报</b>
      </header>

      {detail && (
        <aside
          aria-label={`${detail.title}计算与来源说明`}
          className="overview-data-mode__detail-sheet"
          role="dialog"
        >
          <header>
            <div>
              <small>数据说明</small>
              <h3>{detail.title}</h3>
            </div>
            <button type="button" onClick={() => setDetail(undefined)}>
              关闭
            </button>
          </header>
          <strong>{detail.value}</strong>
          <dl>
            <div>
              <dt>数据期</dt>
              <dd>{detail.dataPeriod}</dd>
            </div>
            <div>
              <dt>本次计算</dt>
              <dd>{detail.calculationTime}</dd>
            </div>
            <div>
              <dt>计算口径</dt>
              <dd>{detail.method}</dd>
            </div>
            {detail.formula && (
              <div>
                <dt>代入公式</dt>
                <dd>{detail.formula}</dd>
              </div>
            )}
            {detail.evidence && (
              <div>
                <dt>公开依据</dt>
                <dd>{detail.evidence}</dd>
              </div>
            )}
          </dl>
          {detail.sourceUrl && (
            <a href={detail.sourceUrl} rel="noreferrer" target="_blank">
              打开{detail.sourceName ?? "来源原文"}
            </a>
          )}
        </aside>
      )}

      <section aria-label="地区数据时间" className="overview-data-mode__time-strip">
        <div>
          <span>统计年度</span>
          <strong>{profile.year}年</strong>
        </div>
        <div>
          <span>本次计算</span>
          <strong>{calculatedAt}</strong>
        </div>
        <div>
          <span>最近来源核验</span>
          <strong>{formatDateTime(profile.refreshStatus?.lastSuccessAt)}</strong>
        </div>
        <div>
          <span>下次定时任务</span>
          <strong>{formatDateTime(profile.refreshStatus?.nextRefreshAt)}</strong>
        </div>
      </section>

      {profile.coverageDescription && (
        <p className="overview-data-mode__coverage">{profile.coverageDescription}</p>
      )}

      <section aria-labelledby="regional-facts-title">
        <h3 id="regional-facts-title">地区档案</h3>
        <div className="overview-data-mode__fact-grid">
          <div>
            <span>区域面积</span>
            <strong>{format(profile.regionFacts.areaSquareKilometres)}</strong>
            <small>平方公里</small>
          </div>
          <div>
            <span>直接下辖</span>
            <strong>{profile.regionFacts.directChildCount}</strong>
            <small>个行政区</small>
          </div>
          <div>
            <span>县级地区</span>
            <strong>{profile.regionFacts.countyCount}</strong>
            <small>个</small>
          </div>
          <div>
            <span>乡镇地区</span>
            <strong>{profile.regionFacts.townshipCount}</strong>
            <small>个</small>
          </div>
          <div>
            <span>行政村</span>
            <strong>{profile.regionFacts.villageCount}</strong>
            <small>个</small>
          </div>
          <div>
            <span>主导作物</span>
            <strong>{leadingCrop?.productName ?? "—"}</strong>
            <small>按三品种结构</small>
          </div>
        </div>
        {leadingCrop && (
          <p className="overview-data-mode__introduction">
            {profile.regionName}区域面积约
            {format(profile.regionFacts.areaSquareKilometres)}平方公里， 共纳入
            {profile.regionFacts.countyCount}个县级地区、
            {profile.regionFacts.townshipCount}个乡镇和
            {profile.regionFacts.villageCount}个行政村；玉米、大豆、水稻合计约
            {format(summary.totalArea, 10_000)}万亩，结构以{leadingCrop.productName}
            为主。
          </p>
        )}
      </section>

      <section aria-labelledby="regional-scale-title">
        <h3 id="regional-scale-title">农业规模、结构与效率</h3>
        <div className="overview-data-mode__metric-grid">
          <MetricButton
            label="三品种播种规模"
            value={`${format(summary.totalArea, 10_000)} 万亩`}
            meta={`${profile.year}年 · 点击查看计算`}
            onClick={() =>
              openSummary(
                "三品种播种规模",
                `${format(summary.totalArea, 10_000)} 万亩`,
                profile.crops
                  .map((crop) => format(crop.plantedAreaMu, 10_000))
                  .join("+") + `=${format(summary.totalArea, 10_000)}万亩`,
              )
            }
          />
          <MetricButton
            label="三品种总产"
            value={`${format(summary.totalOutput, 10_000_000)} 万吨`}
            meta={`${profile.year}年 · 点击查看计算`}
            onClick={() =>
              openSummary(
                "三品种总产",
                `${format(summary.totalOutput, 10_000_000)} 万吨`,
                profile.crops
                  .map((crop) => format(crop.totalOutputKg, 10_000_000))
                  .join("+") + `=${format(summary.totalOutput, 10_000_000)}万吨`,
              )
            }
          />
          <MetricButton
            label="加权单产"
            value={`${format(summary.weightedYield)} 公斤/亩`}
            meta={`${profile.year}年 · 点击查看公式`}
            onClick={() =>
              openSummary(
                "加权单产",
                `${format(summary.weightedYield)} 公斤/亩`,
                `${format(summary.totalOutput, 10_000_000)}万吨×100÷${format(summary.totalArea, 10_000)}万亩=${format(summary.weightedYield)}公斤/亩`,
              )
            }
          />
          <MetricButton
            label="最大品种占比"
            value={`${format(summary.concentration)}%`}
            meta={`${profile.year}年 · 点击查看公式`}
            onClick={() =>
              openSummary(
                "最大品种占比",
                `${format(summary.concentration)}%`,
                `max(${profile.crops.map((crop) => `${crop.productName}${format(crop.structurePercent)}%`).join("，")})=${format(summary.concentration)}%`,
              )
            }
          />
          <MetricButton
            label="种植多样性指数"
            value={`${format(summary.diversity)}%`}
            meta="结构均衡程度 · 点击查看公式"
            onClick={() =>
              openSummary(
                "种植多样性指数",
                `${format(summary.diversity)}%`,
                `(1-${profile.crops
                  .map((crop) => `${format(Number(crop.structurePercent) / 100)}²`)
                  .join("-")})×100=${format(summary.diversity)}%`,
              )
            }
          />
          <MetricButton
            label="单位地域粮食产出"
            value={`${format(summary.outputDensity)} 吨/平方公里`}
            meta="空间产出强度 · 点击查看公式"
            onClick={() =>
              openSummary(
                "单位地域粮食产出",
                `${format(summary.outputDensity)} 吨/平方公里`,
                `${format(summary.totalOutput / 1_000)}吨÷${format(profile.regionFacts.areaSquareKilometres)}平方公里=${format(summary.outputDensity)}吨/平方公里`,
              )
            }
          />
          <MetricButton
            label="公开值覆盖"
            value={`${format(summary.observedPercent)}%`}
            meta={`${summary.observed}/${profile.crops.length}个品种 · 其余模型补算`}
            onClick={() =>
              openSummary(
                "公开值覆盖",
                `${format(summary.observedPercent)}%`,
                `${summary.observed}÷${profile.crops.length}×100=${format(summary.observedPercent)}%`,
                "按三个品种中公开统计值的数量计算",
              )
            }
          />
          <MetricButton
            label="明年产量变化"
            value={`${summary.forecastChange >= 0 ? "+" : ""}${format(summary.forecastChange)}%`}
            meta={`${profile.year + 1}年预测 · 点击查看公式`}
            onClick={() =>
              openSummary(
                "明年产量变化",
                `${summary.forecastChange >= 0 ? "+" : ""}${format(summary.forecastChange)}%`,
                `(${format(summary.nextOutput, 10_000_000)}-${format(summary.totalOutput, 10_000_000)})÷${format(summary.totalOutput, 10_000_000)}×100=${format(summary.forecastChange)}%`,
              )
            }
          />
        </div>
      </section>

      <section aria-labelledby="regional-model-title">
        <h3 id="regional-model-title">来源覆盖与模型诊断</h3>
        <div className="overview-data-mode__diagnostic-grid">
          <div>
            <span>来源总数</span>
            <strong>{summary.sourceCount}</strong>
            <small>已登记公开渠道</small>
          </div>
          <div>
            <span>政府及政务来源</span>
            <strong>{format(summary.officialPercent)}%</strong>
            <small>按来源数量</small>
          </div>
          <div>
            <span>本轮核验成功</span>
            <strong>{summary.successful}</strong>
            <small>其余保留最近有效值</small>
          </div>
          <div>
            <span>保留有效基线</span>
            <strong>{summary.retained}</strong>
            <small>失败后每小时重试</small>
          </div>
          <div>
            <span>明年预测置信度</span>
            <strong>{format(summary.forecastConfidence)}%</strong>
            <small>三品种平均</small>
          </div>
          <div>
            <span>定时运行</span>
            <strong>08:30</strong>
            <small>北京时间每日执行</small>
          </div>
        </div>
      </section>

      {groups.length > 0 && (
        <section aria-labelledby="regional-indicators-title">
          <h3 id="regional-indicators-title">
            农业粮食专题指标（{profile.indicators?.length ?? 0}项）
          </h3>
          {profile.administrativeLevel !== "PREFECTURE" && (
            <p className="overview-data-mode__indicator-note">
              专题指标采用所属地市公开资料作为环境背景；本级作物数据按本行政区边界另行补算。
            </p>
          )}
          <div className="overview-data-mode__indicator-groups">
            {groups.map(([category, indicators]) => (
              <section key={category}>
                <h4>{categoryLabel(category)}</h4>
                <div className="overview-data-mode__indicator-grid">
                  {indicators.map((indicator) => (
                    <button
                      aria-label={`查看${indicator.label}计算与来源`}
                      key={`${category}-${indicator.label}`}
                      type="button"
                      onClick={() =>
                        setDetail({
                          title: indicator.label,
                          value: `${format(indicator.value)} ${indicator.unit}`,
                          dataPeriod: `${indicator.dataYear}年`,
                          calculationTime: formatDateTime(indicator.verifiedAt),
                          method:
                            indicator.dataKind === "ESTIMATED"
                              ? "根据公开基础值动态计算"
                              : kindLabel(indicator.dataKind),
                          formula: indicator.method,
                          sourceName: indicator.sourceName,
                          sourceUrl: indicator.sourceUrl,
                        })
                      }
                    >
                      <span>
                        <b>{indicator.label}</b>
                        <i>{kindLabel(indicator.dataKind)}</i>
                      </span>
                      <strong>
                        {format(indicator.value)} <small>{indicator.unit}</small>
                      </strong>
                      <em>
                        数据期 {indicator.dataYear}年 · 最近核验{" "}
                        {formatDateTime(indicator.verifiedAt)}
                      </em>
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </section>
      )}

      <section aria-labelledby="regional-structure-title">
        <h3 id="regional-structure-title">种植结构与分品种数据</h3>
        <div className="overview-data-mode__crop-list">
          {profile.crops.map((crop) => (
            <article key={crop.productCode}>
              <div className="overview-data-mode__crop-heading">
                <strong>{crop.productName}</strong>
                <span className={`is-${crop.dataKind.toLowerCase()}`}>
                  {crop.dataKind === "OBSERVED" ? "公开统计" : "模型补算"}
                </span>
              </div>
              <button
                className="overview-data-mode__structure-bar"
                type="button"
                onClick={() =>
                  setDetail({
                    title: `${crop.productName}种植占比`,
                    value: `${format(crop.structurePercent)}%`,
                    dataPeriod: `${profile.year}年`,
                    calculationTime: calculatedAt,
                    method: crop.basis,
                    formula: metricFormula(crop, "share", summary.totalArea),
                  })
                }
              >
                <i
                  style={{ width: `${Math.min(100, Number(crop.structurePercent))}%` }}
                />
                <b>{format(crop.structurePercent)}%</b>
              </button>
              <div className="overview-data-mode__crop-metrics">
                {(["area", "yield", "output"] as const).map((key) => {
                  const labels = { area: "面积", yield: "单产", output: "总产" };
                  const values = {
                    area: `${format(crop.plantedAreaMu, 10_000)} 万亩`,
                    yield: `${format(crop.yieldPerMuKg)} 公斤/亩`,
                    output: `${format(crop.totalOutputKg, 10_000_000)} 万吨`,
                  };
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() =>
                        setDetail({
                          title: `${crop.productName}${labels[key]}`,
                          value: values[key],
                          dataPeriod: `${profile.year}年`,
                          calculationTime: calculatedAt,
                          method: crop.basis,
                          formula: metricFormula(crop, key, summary.totalArea),
                        })
                      }
                    >
                      <span>{labels[key]}</span>
                      <strong>{values[key]}</strong>
                    </button>
                  );
                })}
              </div>
              <p>{crop.basis}</p>
              <small>
                置信度 {format(crop.confidencePercent)}%
                {crop.uncertaintyLowKg && crop.uncertaintyHighKg
                  ? ` · 总产区间 ${format(crop.uncertaintyLowKg, 10_000_000)}–${format(crop.uncertaintyHighKg, 10_000_000)} 万吨`
                  : ""}
              </small>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="regional-forecast-title">
        <h3 id="regional-forecast-title">本年补算与下一年预测</h3>
        <div className="overview-data-mode__forecast-table">
          <table>
            <thead>
              <tr>
                <th>品种</th>
                <th>预测期</th>
                <th>面积(万亩)</th>
                <th>总产(万吨)</th>
                <th>说明</th>
              </tr>
            </thead>
            <tbody>
              {profile.crops.flatMap((crop) =>
                crop.forecasts.map((forecast) => (
                  <tr key={`${crop.productCode}-${forecast.year}`}>
                    <th scope="row">{crop.productName}</th>
                    <td>{forecast.year}年</td>
                    <td>{format(forecast.plantedAreaMu, 10_000)}</td>
                    <td>{format(forecast.totalOutputKg, 10_000_000)}</td>
                    <td>
                      <button
                        type="button"
                        onClick={() =>
                          setDetail({
                            title: `${crop.productName}${forecast.year}年产量预测`,
                            value: `${format(forecast.totalOutputKg, 10_000_000)} 万吨`,
                            dataPeriod: `${forecast.year}年预测`,
                            calculationTime: calculatedAt,
                            method: `基于${profile.year}年面积和单产，叠加趋势、天气与政策修正`,
                            formula: forecast.formula
                              ? `${forecast.formula
                                  .replace(
                                    "当年面积",
                                    `${format(crop.plantedAreaMu, 10_000)}万亩`,
                                  )
                                  .replace(
                                    "当年单产",
                                    `${format(crop.yieldPerMuKg)}公斤/亩`,
                                  )}=${format(forecast.totalOutputKg, 10_000_000)}万吨`
                              : "预测公式暂未返回",
                          })
                        }
                      >
                        查看公式
                      </button>
                    </td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="regional-weather-title">
        <h3 id="regional-weather-title">农业天气</h3>
        {profile.weather ? (
          <div className="overview-data-mode__weather">
            <dl>
              <div>
                <dt>气温</dt>
                <dd>{format(profile.weather.meanTemperatureC)}℃</dd>
              </div>
              <div>
                <dt>降水</dt>
                <dd>{format(profile.weather.precipitationMm)} mm</dd>
              </div>
              <div>
                <dt>表层墒情</dt>
                <dd>{format(profile.weather.soilMoisturePercent)}%</dd>
              </div>
            </dl>
            <p>{profile.weather.assessment}</p>
            <small>
              观测时间 {formatDateTime(profile.weather.observedAt)} ·{" "}
              {profile.weather.risk}
            </small>
          </div>
        ) : (
          <p className="overview-data-mode__pending">
            天气源正在进行首次自动同步，预测暂用区域多年气候系数。
          </p>
        )}
      </section>

      <section aria-labelledby="regional-policy-title">
        <h3 id="regional-policy-title">
          政策影响（{profile.policies?.length ?? 0}项）
        </h3>
        <div className="overview-data-mode__policy-list">
          {(profile.policies ?? []).map((policy) => (
            <article key={policy.sourceUrl}>
              <a href={policy.sourceUrl} target="_blank" rel="noreferrer">
                {policy.title}
              </a>
              <small>
                发布日期 {policy.publishedOn ?? "来源未标注"} · {policy.sourceName}
              </small>
              <p>{policy.impact}</p>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="regional-source-title">
        <h3 id="regional-source-title">来源档案（{summary.sourceCount}个渠道）</h3>
        <p className="overview-data-mode__source-note">
          这里只显示来源状态。点击来源后查看公开依据、资料日期和原文，避免把网页正文堆进页面。
        </p>
        <div className="overview-data-mode__source-list">
          {(profile.sources ?? []).map((source) => (
            <button
              aria-label={`查看${source.name}计算与来源`}
              key={source.id}
              type="button"
              onClick={() =>
                setDetail({
                  title: source.name,
                  value: sourceStatusLabel(source.status),
                  dataPeriod: source.publishedOn
                    ? `资料发布于 ${source.publishedOn}`
                    : "来源页未标注发布日期",
                  calculationTime: formatDateTime(source.fetchedAt),
                  method: `${sourceTypeLabel(source.type)} · ${sourceClassLabel(source.sourceClass)} · 可靠度权重 ${format(Number(source.reliabilityWeight) * 100)}%`,
                  evidence: source.evidence,
                  sourceName: source.name,
                  sourceUrl: source.url,
                })
              }
            >
              <span>
                <b>{source.name}</b>
                <i>{sourceStatusLabel(source.status)}</i>
              </span>
              <small>
                {sourceTypeLabel(source.type)} · {sourceClassLabel(source.sourceClass)}{" "}
                · 资料期 {source.publishedOn ?? "未标注"} · 核验{" "}
                {formatDateTime(source.fetchedAt)}
              </small>
            </button>
          ))}
        </div>
      </section>

      <footer>
        <p>
          <b>每日 08:30 自动任务：</b>
          核验已登记公开来源，更新可自动解析的作物与天气数据，并重新生成本年缺项和下一年预测；来源失败时保留最近有效值并每小时重试。
        </p>
        <p>
          <b>计算范围：</b>
          {profile.sourceSummary}；{profile.calculationMethod}
        </p>
      </footer>
    </div>
  );
}

function MetricButton({
  label,
  value,
  meta,
  onClick,
}: {
  label: string;
  value: string;
  meta: string;
  onClick: () => void;
}) {
  return (
    <button aria-label={`查看${label}计算说明`} type="button" onClick={onClick}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{meta}</small>
    </button>
  );
}
