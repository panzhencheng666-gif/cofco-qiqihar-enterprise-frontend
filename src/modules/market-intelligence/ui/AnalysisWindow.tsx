import { useEffect, useMemo, useRef, useState } from "react";
import { metricCatalog, type AnalysisTopic } from "./metricCatalog";
import { getAnalysisProfile } from "./analysisProfile";
import { WorldBankMonthlyPanel } from "./WorldBankMonthlyPanel";
import { FaoNewsAnalysisPanel } from "./FaoNewsAnalysisPanel";
import { MoaNewsAnalysisPanel } from "./MoaNewsAnalysisPanel";
import { ChinaIndexAnalysisPanel } from "./ChinaIndexAnalysisPanel";
import { FormulaAnalysisPanel } from "./FormulaAnalysisPanel";
import { QuoteAnalysisPanel } from "./QuoteAnalysisPanel";
import { PendingAnalysisSurface } from "./PendingAnalysisSurface";
import { AnalysisCollectorStrip } from "./AnalysisCollectorStrip";
import { useWorkspaceTheme } from "./useWorkspaceTheme";
import "./analysis-operations.css";

const workspaceTabs = ["趋势研判", "横向对比", "手动试算", "来源与口径"] as const;
const regions = [
  "全球",
  "中国",
  "东北",
  "华北",
  "华东",
  "华南",
  "北美",
  "南美",
  "欧洲",
  "黑海",
  "东南亚",
];
const ranges = ["近24小时", "近7天", "近30天", "近90天", "近1年", "近5年"];
const commodities = ["玉米", "小麦", "稻谷", "大豆", "油脂"];
type Tab = (typeof workspaceTabs)[number];
type AssumptionKey =
  | "fob"
  | "ocean"
  | "insurance"
  | "fx"
  | "tariff"
  | "inland"
  | "processing"
  | "finance"
  | "sale";
const assumptions: readonly [AssumptionKey, string, string][] = [
  ["fob", "离岸采购价", "美元/吨"],
  ["ocean", "国际运费", "美元/吨"],
  ["insurance", "保险费", "美元/吨"],
  ["fx", "结算汇率", "元/美元"],
  ["tariff", "适用税率", "%"],
  ["inland", "国内运费", "元/吨"],
  ["processing", "加工仓储费", "元/吨"],
  ["finance", "融资费", "元/吨"],
  ["sale", "假设销售价", "元/吨"],
];
const numberFormat = new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 2 });
const balanceFields = [
  ["opening", "期初库存"],
  ["production", "本期产量"],
  ["imports", "本期进口"],
  ["consumption", "本期消费"],
  ["exports", "本期出口"],
] as const;
type BalanceKey = (typeof balanceFields)[number][0];

function readWatchlist(): string[] {
  try {
    const value: unknown = JSON.parse(
      localStorage.getItem("mi-analysis-watchlist-v1") ?? "[]",
    );
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

export function AnalysisWindow({
  commodity,
  onClose,
  onSelectTopic,
  period,
  topic,
}: {
  commodity: string;
  onClose: () => void;
  onSelectTopic: (topic: AnalysisTopic) => void;
  period: string;
  topic: AnalysisTopic;
}) {
  const backRef = useRef<HTMLButtonElement>(null);
  const [tab, setTab] = useState<Tab>("趋势研判");
  const [search, setSearch] = useState("");
  const [compareSearch, setCompareSearch] = useState("");
  const [selectedCommodity, setSelectedCommodity] = useState(commodity);
  const [region, setRegion] = useState("全球");
  const [range, setRange] = useState(period);
  const [comparison, setComparison] = useState<string[]>([]);
  const [watchlist, setWatchlist] = useState(readWatchlist);
  const [values, setValues] = useState<Record<AssumptionKey, string>>({
    fob: "",
    ocean: "",
    insurance: "",
    fx: "",
    tariff: "",
    inland: "",
    processing: "",
    finance: "",
    sale: "",
  });
  const [balanceValues, setBalanceValues] = useState<Record<BalanceKey, string>>({
    opening: "",
    production: "",
    imports: "",
    consumption: "",
    exports: "",
  });
  const [impactDuration, setImpactDuration] = useState("");
  const [impactChannel, setImpactChannel] = useState("生产");
  const [impactEvidence, setImpactEvidence] = useState("");
  const [copied, setCopied] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const { theme, selectTheme } = useWorkspaceTheme();
  const profile = useMemo(() => getAnalysisProfile(topic), [topic]);
  const quoteTopic =
    topic.id.startsWith("cross-market-") ||
    (topic.id.startsWith("overview-") && topic.kind === "价格与成本");
  const faoFoodPrice = topic.id.startsWith("fao-food-price-");
  const worldBankMonthly = topic.id.startsWith("world-bank-monthly-") || faoFoodPrice;
  const chinaIndex = topic.id.startsWith("china-index-");
  const moaNews = topic.id.startsWith("moa-news:");
  const newsArticle = topic.id.startsWith("fao-news:") || moaNews;
  const formulaTopic = topic.group === "自动计算模型" || topic.title === "自动计算模型";
  const sourceCode = faoFoodPrice
    ? "fao-food-price-index"
    : worldBankMonthly
      ? "world-bank-pink-sheet"
      : chinaIndex
        ? "moa-public-monitor"
        : moaNews
          ? "moa-department-news"
          : newsArticle
            ? "fao-newsroom-rss"
            : formulaTopic && topic.title === "小麦玉米国际月均价比"
              ? "world-bank-pink-sheet"
              : null;
  const desk = faoFoodPrice
    ? "FAO 月度指数"
    : worldBankMonthly
      ? "国际月度基准"
      : chinaIndex
        ? "国内发布指数"
        : newsArticle
          ? "资讯核验"
          : formulaTopic
            ? "模型口径"
            : profile.mode === "balance"
              ? "供需账本"
              : profile.mode === "event"
                ? "事件监视"
                : "行情监视";
  const tabLabels: Record<Tab, string> =
    profile.mode === "balance"
      ? {
          趋势研判: "供需账本",
          横向对比: "指标对照",
          手动试算: "供需试算",
          来源与口径: "来源与口径",
        }
      : profile.mode === "event"
        ? {
            趋势研判: "事件流",
            横向对比: "关联观察",
            手动试算: "影响假设",
            来源与口径: "来源与口径",
          }
        : {
            趋势研判: "行情监视",
            横向对比: "市场对照",
            手动试算: "情景试算",
            来源与口径: "来源与口径",
          };
  const effectiveRange =
    worldBankMonthly && !["近1年", "近5年"].includes(range) ? "近1年" : range;
  useEffect(() => {
    backRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (catalogOpen) setCatalogOpen(false);
        else onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [catalogOpen, onClose]);

  useEffect(() => {
    try {
      localStorage.setItem("mi-analysis-watchlist-v1", JSON.stringify(watchlist));
    } catch {
      /* The workspace remains usable when storage is unavailable. */
    }
  }, [watchlist]);

  const filteredGroups = useMemo(
    () =>
      profile.groups
        .map((group) => ({
          ...group,
          metrics: profile.metrics.filter(
            (item) => item.group === group.title && item.title.includes(search.trim()),
          ),
        }))
        .filter((group) => group.metrics.length > 0),
    [profile, search],
  );

  const scenarioReady =
    assumptions.every(
      ([key]) =>
        values[key].trim() !== "" &&
        Number.isFinite(Number(values[key])) &&
        Number(values[key]) >= 0,
    ) && Number(values.fx) > 0;
  const input = (key: AssumptionKey) => Number(values[key]);
  const landedCost = scenarioReady
    ? (input("fob") + input("ocean") + input("insurance")) *
        input("fx") *
        (1 + input("tariff") / 100) +
      input("inland") +
      input("processing") +
      input("finance")
    : null;
  const margin = landedCost === null ? null : input("sale") - landedCost;
  const balanceReady = balanceFields.every(
    ([key]) =>
      balanceValues[key].trim() !== "" &&
      Number.isFinite(Number(balanceValues[key])) &&
      Number(balanceValues[key]) >= 0,
  );
  const balanceInput = (key: BalanceKey) => Number(balanceValues[key]);
  const available = balanceReady
    ? balanceInput("opening") + balanceInput("production") + balanceInput("imports")
    : null;
  const closing =
    available === null
      ? null
      : available - balanceInput("consumption") - balanceInput("exports");
  const watched = watchlist.includes(topic.id);

  function toggleComparison(id: string) {
    setComparison((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : current.length < 4
          ? [...current, id]
          : current,
    );
  }

  function toggleWatchlist() {
    setWatchlist((current) =>
      current.includes(topic.id)
        ? current.filter((item) => item !== topic.id)
        : [...current, topic.id],
    );
  }

  async function copyConfiguration() {
    const configuration = {
      metric: topic.title,
      commodity: selectedCommodity,
      region,
      range,
      comparison: comparison.map(
        (id) => metricCatalog.find((item) => item.id === id)?.title ?? id,
      ),
      scenario:
        profile.scenario === "cost"
          ? values
          : profile.scenario === "balance"
            ? balanceValues
            : {
                durationDays: impactDuration,
                channel: impactChannel,
                evidence: impactEvidence,
              },
      dataStatus: worldBankMonthly
        ? faoFoodPrice
          ? "FAO 月度公开指数"
          : "世界银行月度基准"
        : chinaIndex || moaNews
          ? "农业农村部公开发布"
          : newsArticle
            ? "FAO 原始新闻"
            : quoteTopic
              ? "自动报价监控，连接和授权状态以面板为准"
              : "待接入",
    };
    try {
      await navigator.clipboard.writeText(JSON.stringify(configuration, null, 2));
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section
      className="mi-workspace"
      data-theme={theme}
      data-desk={desk}
      role="dialog"
      aria-modal="true"
      aria-labelledby="mi-workspace-title"
    >
      <header className="mi-workspace-header">
        <button
          ref={backRef}
          type="button"
          className="mi-workspace-back"
          onClick={onClose}
        >
          ← 返回商情大屏
        </button>
        <button
          type="button"
          className="mi-workspace-action"
          aria-expanded={catalogOpen}
          aria-controls="mi-workspace-catalog"
          onClick={() => setCatalogOpen((open) => !open)}
        >
          ☰ 指标目录
        </button>
        <div className="mi-workspace-heading">
          <small>
            {desk} / {topic.group ?? topic.kind}
          </small>
          <h1 id="mi-workspace-title">{topic.title}</h1>
        </div>
        <span className="mi-workspace-feed">
          ●{" "}
          {worldBankMonthly
            ? faoFoodPrice
              ? "FAO 月度公开指数"
              : "世界银行月度基准"
            : chinaIndex || moaNews
              ? "农业农村部官方发布"
              : newsArticle
                ? "FAO 官方新闻"
                : formulaTopic && topic.title === "小麦玉米国际月均价比"
                  ? "世界银行月度自动计算"
                  : quoteTopic
                    ? "自动报价监控 · 状态见面板"
                    : "数据源待接入"}
        </span>
        <div className="mi-theme-switch" role="group" aria-label="分析界面外观">
          <button
            type="button"
            aria-pressed={theme === "light"}
            onClick={() => selectTheme("light")}
          >
            浅色
          </button>
          <button
            type="button"
            aria-pressed={theme === "dark"}
            onClick={() => selectTheme("dark")}
          >
            深色
          </button>
        </div>
        <button type="button" className="mi-workspace-action" onClick={toggleWatchlist}>
          {watched ? "★ 已加入关注" : "☆ 加入关注"}
        </button>
        <button
          type="button"
          className="mi-workspace-action"
          onClick={() => void copyConfiguration()}
        >
          {copied ? "已复制配置" : "复制分析配置"}
        </button>
      </header>

      {!newsArticle && !formulaTopic && !chinaIndex && !quoteTopic && (
        <div className="mi-workspace-filters">
          {!worldBankMonthly && (
            <label>
              品种
              <select
                value={selectedCommodity}
                onChange={(event) => setSelectedCommodity(event.target.value)}
              >
                {commodities.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
          )}
          {!worldBankMonthly && (
            <label>
              区域
              <select
                value={region}
                onChange={(event) => setRegion(event.target.value)}
              >
                {regions.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
          )}
          {worldBankMonthly && (
            <span>
              {faoFoodPrice ? "FAO 全球月度指数" : "全球公开基准"} · 非期货实时行情
            </span>
          )}
          <label>
            时段
            <select
              value={effectiveRange}
              onChange={(event) => setRange(event.target.value)}
            >
              {(worldBankMonthly ? ["近1年", "近5年"] : ranges).map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <span>单位：{topic.unit ?? "按接入数据定义"}</span>
          <strong>
            {worldBankMonthly
              ? faoFoodPrice
                ? "按 FAO 月度发布自动更新；非日内行情"
                : "按世界银行月度发布自动更新；非日内行情"
              : "筛选、关注与情景配置仅保存在本机；无实时行情"}
          </strong>
        </div>
      )}

      {!quoteTopic && <AnalysisCollectorStrip sourceCode={sourceCode} />}

      <div className={`mi-workspace-grid${catalogOpen ? " catalog-open" : ""}`}>
        <aside
          id="mi-workspace-catalog"
          className="mi-workspace-catalog"
          aria-label="指标目录"
          hidden={!catalogOpen}
        >
          <div className="mi-workspace-panel-title">
            本主题指标 <span>{profile.metrics.length} 项</span>
          </div>
          <input
            type="search"
            placeholder="搜索本主题指标"
            aria-label="搜索本主题指标"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <div className="mi-workspace-focus">
            {profile.focus} · {profile.groups.length} 个相关领域
          </div>
          <div className="mi-workspace-catalog-list">
            {filteredGroups.map((group) => (
              <section key={group.id}>
                <h2>
                  {group.title} <small>{group.metrics.length}</small>
                </h2>
                {group.metrics.map((metric) => (
                  <button
                    type="button"
                    key={metric.id}
                    className={metric.id === topic.id ? "active" : ""}
                    onClick={() => {
                      onSelectTopic(metric);
                      setCatalogOpen(false);
                    }}
                  >
                    {metric.title}
                  </button>
                ))}
              </section>
            ))}
            {filteredGroups.length === 0 && <p>没有匹配的指标</p>}
          </div>
        </aside>

        <div className="mi-workspace-main">
          {!worldBankMonthly &&
            !newsArticle &&
            !formulaTopic &&
            !chinaIndex &&
            !quoteTopic && (
              <nav className="mi-workspace-tabs" aria-label="分析功能">
                {workspaceTabs.map((item) => (
                  <button
                    type="button"
                    key={item}
                    className={tab === item ? "active" : ""}
                    onClick={() => setTab(item)}
                  >
                    {tabLabels[item]}
                  </button>
                ))}
              </nav>
            )}

          {worldBankMonthly && (
            <WorldBankMonthlyPanel
              key={`${topic.id}-${effectiveRange}`}
              topicId={topic.id}
              range={effectiveRange}
            />
          )}

          {quoteTopic && <QuoteAnalysisPanel key={topic.id} topic={topic} />}

          {chinaIndex && <ChinaIndexAnalysisPanel key={topic.id} topicId={topic.id} />}

          {newsArticle &&
            (moaNews ? (
              <MoaNewsAnalysisPanel
                key={topic.title}
                title={topic.title}
                sourceUrl={topic.id.slice("moa-news:".length)}
              />
            ) : (
              <FaoNewsAnalysisPanel key={topic.title} title={topic.title} />
            ))}

          {formulaTopic && (
            <FormulaAnalysisPanel
              key={topic.id}
              topic={topic}
              onSelectTopic={onSelectTopic}
            />
          )}

          {!worldBankMonthly &&
            !newsArticle &&
            !formulaTopic &&
            !chinaIndex &&
            !quoteTopic &&
            tab === "趋势研判" && (
              <PendingAnalysisSurface
                mode={profile.mode}
                topic={topic}
                range={effectiveRange}
                region={region}
                related={profile.metrics}
                checks={profile.checks}
                onSelectTopic={onSelectTopic}
              />
            )}

          {!worldBankMonthly &&
            !newsArticle &&
            !formulaTopic &&
            !chinaIndex &&
            !quoteTopic &&
            tab === "横向对比" && (
              <div className="mi-workspace-view">
                <div className="mi-workspace-section-head">
                  <div>
                    <small>COMPARE</small>
                    <h2>多指标横向对比</h2>
                  </div>
                  <span>最多选 4 项</span>
                </div>
                <p className="mi-workspace-intro">
                  选取同一品种与区域的指标，接入数据后可按统一时间轴比较。单位不同的指标不会直接相加。
                </p>
                <input
                  className="mi-compare-search"
                  type="search"
                  aria-label="搜索可对比指标"
                  placeholder={`搜索本主题 ${profile.metrics.length} 项指标`}
                  value={compareSearch}
                  onChange={(event) => setCompareSearch(event.target.value)}
                />
                <div className="mi-compare-picks">
                  {profile.metrics
                    .filter((metric) => metric.title.includes(compareSearch.trim()))
                    .map((metric) => (
                      <label key={metric.id}>
                        <input
                          type="checkbox"
                          checked={comparison.includes(metric.id)}
                          disabled={
                            !comparison.includes(metric.id) && comparison.length >= 4
                          }
                          onChange={() => toggleComparison(metric.id)}
                        />
                        {metric.title}
                        <small>{metric.unit}</small>
                      </label>
                    ))}
                </div>
                <div className="mi-workspace-selection">
                  <strong>已选指标</strong>
                  {comparison.length ? (
                    comparison.map((id) => (
                      <span key={id}>
                        {metricCatalog.find((metric) => metric.id === id)?.title}
                      </span>
                    ))
                  ) : (
                    <span>请勾选要比较的指标</span>
                  )}
                </div>
                <div className="mi-workspace-empty-chart compact">对比数据待接入</div>
              </div>
            )}

          {!worldBankMonthly &&
            !newsArticle &&
            !formulaTopic &&
            !chinaIndex &&
            !quoteTopic &&
            tab === "手动试算" && (
              <div className="mi-workspace-view">
                <div className="mi-workspace-section-head">
                  <div>
                    <small>SCENARIO LAB</small>
                    <h2>
                      {profile.scenario === "cost"
                        ? "到岸成本与毛利推演"
                        : profile.scenario === "balance"
                          ? "供需平衡手动推演"
                          : "事件影响路径记录"}
                    </h2>
                  </div>
                  <span>手动输入假设 · 不自动抓数或预测</span>
                </div>
                {profile.scenario === "cost" && (
                  <>
                    <p className="mi-workspace-intro">
                      仅计算手动输入的价格、汇率、运费与税率假设。税种及计税顺序需按交易合同核定。
                    </p>
                    <div className="mi-scenario-form">
                      {assumptions.map(([key, label, unit]) => (
                        <label key={key}>
                          <span>
                            {label}
                            <small>{unit}</small>
                          </span>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={values[key]}
                            placeholder="输入假设"
                            onChange={(event) =>
                              setValues((current) => ({
                                ...current,
                                [key]: event.target.value,
                              }))
                            }
                          />
                        </label>
                      ))}
                    </div>
                    <div className="mi-scenario-results">
                      <div>
                        <small>假设到岸总成本</small>
                        <strong>
                          {landedCost === null
                            ? "待输入"
                            : `${numberFormat.format(landedCost)} 元/吨`}
                        </strong>
                      </div>
                      <div>
                        <small>假设单位毛利</small>
                        <strong>
                          {margin === null
                            ? "待输入"
                            : `${numberFormat.format(margin)} 元/吨`}
                        </strong>
                      </div>
                      <div>
                        <small>毛利率</small>
                        <strong>
                          {margin === null || input("sale") <= 0
                            ? "待输入"
                            : `${numberFormat.format((margin / input("sale")) * 100)}%`}
                        </strong>
                      </div>
                    </div>
                    <p className="mi-workspace-formula">
                      口径：(离岸采购价＋国际运费＋保险费) × 汇率 ×
                      (1＋适用税率)＋国内运费＋加工仓储费＋融资费；毛利＝假设销售价－总成本。
                    </p>
                  </>
                )}
                {profile.scenario === "balance" && (
                  <>
                    <p className="mi-workspace-intro">
                      按同一统计期、地域与单位输入供需假设，核对期末结余；负值表示假设缺口，不代表官方统计结果。
                    </p>
                    <div className="mi-scenario-form">
                      {balanceFields.map(([key, label]) => (
                        <label key={key}>
                          <span>
                            {label}
                            <small>万吨</small>
                          </span>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={balanceValues[key]}
                            placeholder="输入假设"
                            onChange={(event) =>
                              setBalanceValues((current) => ({
                                ...current,
                                [key]: event.target.value,
                              }))
                            }
                          />
                        </label>
                      ))}
                    </div>
                    <div className="mi-scenario-results">
                      <div>
                        <small>可用总量</small>
                        <strong>
                          {available === null
                            ? "待输入"
                            : `${numberFormat.format(available)} 万吨`}
                        </strong>
                      </div>
                      <div>
                        <small>期末结余 / 缺口</small>
                        <strong>
                          {closing === null
                            ? "待输入"
                            : `${numberFormat.format(closing)} 万吨`}
                        </strong>
                      </div>
                    </div>
                    <p className="mi-workspace-formula">
                      口径：期末结余＝期初库存＋本期产量＋本期进口－本期消费－本期出口。各项必须属于同一统计期与地域。
                    </p>
                  </>
                )}
                {profile.scenario === "impact" && (
                  <>
                    <p className="mi-workspace-intro">
                      记录事件假设与待核验证据，梳理对 {selectedCommodity}、{region}{" "}
                      的可能传导路径。数据接入前不生成影响幅度或价格预测。
                    </p>
                    <div className="mi-scenario-form">
                      <label>
                        <span>
                          假设持续时间<small>天</small>
                        </span>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={impactDuration}
                          placeholder="输入天数"
                          onChange={(event) => setImpactDuration(event.target.value)}
                        />
                      </label>
                      <label>
                        <span>主要影响环节</span>
                        <select
                          value={impactChannel}
                          onChange={(event) => setImpactChannel(event.target.value)}
                        >
                          {["生产", "物流", "贸易", "库存", "需求", "政策"].map(
                            (item) => (
                              <option key={item}>{item}</option>
                            ),
                          )}
                        </select>
                      </label>
                      <label className="mi-scenario-wide">
                        <span>证据与假设说明</span>
                        <textarea
                          value={impactEvidence}
                          placeholder="记录原始来源、发布时间及待核验假设"
                          onChange={(event) => setImpactEvidence(event.target.value)}
                        />
                      </label>
                    </div>
                    <div className="mi-scenario-path">
                      <span>{topic.title}</span>
                      <b>→</b>
                      <span>{impactChannel}</span>
                      <b>→</b>
                      <span>
                        {region} · {selectedCommodity}
                      </span>
                      <b>→</b>
                      <span>价格 / 供应影响待核验</span>
                    </div>
                  </>
                )}
              </div>
            )}

          {!worldBankMonthly &&
            !newsArticle &&
            !formulaTopic &&
            !chinaIndex &&
            !quoteTopic &&
            tab === "来源与口径" && (
              <div className="mi-workspace-view">
                <div className="mi-workspace-section-head">
                  <div>
                    <small>PROVENANCE</small>
                    <h2>来源、单位与计算口径</h2>
                  </div>
                  <span>审核状态：未接入</span>
                </div>
                <dl className="mi-source-grid">
                  <div>
                    <dt>当前指标</dt>
                    <dd>{topic.title}</dd>
                  </div>
                  <div>
                    <dt>所属领域</dt>
                    <dd>{topic.group ?? topic.kind}</dd>
                  </div>
                  <div>
                    <dt>标准单位</dt>
                    <dd>{topic.unit ?? "接入时确定"}</dd>
                  </div>
                  <div>
                    <dt>最新值</dt>
                    <dd>未接入</dd>
                  </div>
                  <div>
                    <dt>来源授权</dt>
                    <dd>未审核</dd>
                  </div>
                  <div>
                    <dt>采集/更新时间</dt>
                    <dd>未接入</dd>
                  </div>
                  <div>
                    <dt>区域口径</dt>
                    <dd>{region} · 待源定义</dd>
                  </div>
                  <div>
                    <dt>计算规则</dt>
                    <dd>{topic.formula ?? "原始指标或待制定换算规则"}</dd>
                  </div>
                </dl>
                <div className="mi-source-note">
                  正式数据链路需记录：原始出处、发布与抓取时间、许可范围、币种/计量单位、地理范围、版本、修订历史和人工复核状态。
                </div>
              </div>
            )}
        </div>

        <aside className="mi-workspace-side" aria-label="分析上下文">
          <section>
            <h2>{desk} · 上下文</h2>
            <dl>
              {!worldBankMonthly &&
                !newsArticle &&
                !formulaTopic &&
                !chinaIndex &&
                !quoteTopic && (
                  <div>
                    <dt>品种</dt>
                    <dd>{selectedCommodity}</dd>
                  </div>
                )}
              <div>
                <dt>区域</dt>
                <dd>
                  {faoFoodPrice
                    ? "FAO 全球指数"
                    : worldBankMonthly ||
                        (formulaTopic && topic.title === "小麦玉米国际月均价比")
                      ? "世界银行全球基准"
                      : chinaIndex || moaNews
                        ? "中国 / 农业农村部"
                        : newsArticle
                          ? "FAO 国际新闻"
                          : formulaTopic
                            ? "来源待定"
                            : quoteTopic
                              ? "以报价面板市场为准"
                              : region}
                </dd>
              </div>
              <div>
                <dt>时间范围</dt>
                <dd>
                  {moaNews
                    ? "官方发布日期 / 国内指数"
                    : chinaIndex
                      ? "最近公开观测"
                      : newsArticle
                        ? "新闻发布时间 / 月度基准"
                        : formulaTopic
                          ? topic.title === "小麦玉米国际月均价比"
                            ? "最近13个统计月"
                            : "待来源定义"
                          : quoteTopic
                            ? "最新报价快照"
                            : effectiveRange}
                </dd>
              </div>
              <div>
                <dt>指标单位</dt>
                <dd>
                  {moaNews
                    ? "事件 + 指数点"
                    : newsArticle
                      ? "事件 + 美元计价基准"
                      : (topic.unit ?? "待定义")}
                </dd>
              </div>
            </dl>
          </section>
          {!worldBankMonthly &&
            !newsArticle &&
            !formulaTopic &&
            !chinaIndex &&
            !quoteTopic && (
              <section>
                <h2>本主题证据清单</h2>
                <ul className="mi-workspace-checks">
                  {profile.checks.map((check) => (
                    <li key={check}>
                      {check}
                      <span>待接入</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          <section>
            <h2>数据可用性</h2>
            <p>
              {worldBankMonthly
                ? faoFoodPrice
                  ? "FAO 食品价格指数按月发布，由系统定时同步并计算历史涨跌；不是交易所实时行情。"
                  : "价格为世界银行月度公开基准，由系统定时同步并计算历史涨跌。新闻、国内现货和日内期货行情仍待接入。"
                : chinaIndex || moaNews
                  ? "农业农村部公开发布的国内指数和监测信息已接入，按发布日更新；指数变化为系统按已发布值计算，非交易所实时报价。"
                  : newsArticle
                    ? "FAO 新闻标题、发布时间和原文链接已接入；价格为独立的月度基准。自动事件抽取与影响预测尚未建立。"
                    : formulaTopic
                      ? topic.title === "小麦玉米国际月均价比"
                        ? "已用同月世界银行公开价格自动计算比值；来源为月度基准，不代表期货实时行情。"
                        : "计算表达式与必需输入已列出；行情源、企业成本参数及业务口径未齐全前不输出数值。"
                      : quoteTopic
                        ? "报价面板按后台状态自动更新；权限、断线与过期提示以面板为准。历史行情与深度分析仍待接入。"
                        : "本主题最新值、历史序列与分析模型待授权来源接入。筛选、关注、对比配置和手动情景可操作。"}
            </p>
          </section>
          <section>
            <h2>
              我的关注 <small>{watchlist.length}</small>
            </h2>
            {watchlist.length ? (
              watchlist.map((id) => {
                const item = metricCatalog.find((metric) => metric.id === id);
                return item ? (
                  <button key={id} type="button" onClick={() => onSelectTopic(item)}>
                    {item.title} ↗
                  </button>
                ) : null;
              })
            ) : (
              <p>点击页眉“加入关注”保存到本机。</p>
            )}
          </section>
        </aside>
      </div>
    </section>
  );
}
