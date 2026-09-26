import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { metricCatalog, type AnalysisTopic } from "./metricCatalog";
import { snapshotSchema, type Snapshot } from "./WorldBankMonthlyPanel";

const requiredInputs: Record<string, readonly string[]> = {
  国产大豆压榨利润: [
    "国产大豆采购价",
    "豆粕与豆油成交价",
    "实际出粕率与出油率",
    "加工及其他费用",
  ],
  进口大豆压榨利润: [
    "进口大豆到厂成本",
    "豆粕与豆油成交价",
    "实际出粕率与出油率",
    "加工及其他费用",
  ],
  潮粮折干成本模型: [
    "潮粮采购价及报价单位",
    "实测水分与目标水分",
    "当地折扣系数",
    "烘干与损耗费用",
  ],
  毛粮净粮塔粮价格链: ["同县毛粮基价", "净粮升贴水", "烘干与塔粮附加费", "生效日期"],
  饲用糙米混合物出厂成本: [
    "稻谷拍卖底价与费用",
    "出糙率",
    "副产品收益",
    "糙米与替代谷物配比及到场价",
    "资金损耗",
  ],
  进口粮食到厂成本模型: [
    "FOB报价",
    "国际运费及保险费",
    "结算汇率",
    "适用税费与计税顺序",
    "港杂费及国内运费",
  ],
  小麦玉米国际月均价比: ["世界银行小麦月均价", "世界银行玉米月均价"],
  小麦玉米替代比价模型: ["同区域小麦与玉米到场价", "品质与营养参数", "配方替代约束"],
  小麦升贴水与出库成本: ["小麦基准价", "品质升贴水", "出库费", "运输损耗"],
  小麦制粉利润模型: ["小麦到厂价", "面粉及麸皮售价", "实际出粉率", "加工与能源费"],
  玉米淀粉加工利润模型: ["玉米到厂价", "淀粉及副产品售价", "实际得率", "加工与能源费"],
  玉米酒精加工利润模型: ["玉米到厂价", "酒精及副产品售价", "实际得率", "加工与能源费"],
  仓储资金占用成本: ["库存货值", "融资利率", "占用天数", "仓储费"],
  汇率利率平价模型: ["即期汇率", "同期限人民币利率", "同期限美元利率", "报价方向"],
};

const number = new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 4 });

export function FormulaAnalysisPanel({
  topic,
  onSelectTopic,
}: {
  topic: AnalysisTopic;
  onSelectTopic: (topic: AnalysisTopic) => void;
}) {
  const ratio = topic.title === "小麦玉米国际月均价比";
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [feedError, setFeedError] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!ratio) return;
    const controller = new AbortController();
    async function refresh() {
      try {
        const response = await fetch(
          "/api/v1/market-intelligence/world-bank/overview",
          {
            credentials: "same-origin",
            cache: "no-store",
            signal: controller.signal,
          },
        );
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const body = z
          .object({ data: z.array(snapshotSchema) })
          .parse(await response.json());
        setSnapshots(body.data);
        setFeedError(false);
      } catch {
        if (!controller.signal.aborted) setFeedError(true);
      }
    }
    void refresh();
    const timer = window.setInterval(() => void refresh(), 15 * 60 * 1000);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [ratio]);

  const wheat = snapshots.find((item) => item.series === "wheat-srw");
  const maize = snapshots.find((item) => item.series === "maize");
  const points = useMemo(() => {
    if (!wheat || !maize) return [];
    const maizeByPeriod = new Map(
      maize.points.map((point) => [point.period, point.value]),
    );
    return wheat.points.flatMap((point) => {
      const maizePrice = maizeByPeriod.get(point.period);
      return maizePrice && maizePrice > 0
        ? [{ period: point.period, value: point.value / maizePrice }]
        : [];
    });
  }, [wheat, maize]);
  const latest = points.at(-1);
  const previous = points.at(-2);
  const priorMonth = latest ? new Date(`${latest.period}T00:00:00Z`) : null;
  priorMonth?.setUTCMonth(priorMonth.getUTCMonth() - 1);
  const latestChange =
    latest &&
    previous &&
    priorMonth &&
    previous.period === priorMonth.toISOString().slice(0, 10) &&
    previous.value > 0
      ? (latest.value / previous.value - 1) * 100
      : null;
  const values = points.map((point) => point.value);
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 1;
  const span = Math.max(max - min, max * 0.02, 0.01);
  const plot = points.map((point, index) => ({
    ...point,
    x: 46 + (index / Math.max(points.length - 1, 1)) * 924,
    y: 280 - ((point.value - min + span * 0.08) / (span * 1.16)) * 230,
  }));
  const focused = plot[selectedIndex ?? plot.length - 1];

  if (topic.title === "自动计算模型") {
    return (
      <div className="mi-formula-analysis">
        <div className="mi-workspace-section-head">
          <div>
            <small>AUTOMATED CALCULATION / MODEL DIRECTORY</small>
            <h2>自动计算模型</h2>
          </div>
          <span>按来源和业务口径逐项启用</span>
        </div>
        <p className="mi-formula-provenance">
          已登记 14
          个计算模型。点击模型查看计算式、输入需求、数据状态及可用走势；截图示例报价不作为正式数据。
        </p>
        <div className="mi-formula-directory">
          {metricCatalog
            .filter((item) => item.group === "自动计算模型")
            .map((item) => (
              <button key={item.id} type="button" onClick={() => onSelectTopic(item)}>
                <strong>{item.title}</strong>
                <span>
                  {item.title === "小麦玉米国际月均价比"
                    ? "世界银行月度自动计算"
                    : "输入源待接入"}
                </span>
                <em>↗</em>
              </button>
            ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mi-formula-analysis">
      <div className="mi-workspace-section-head">
        <div>
          <small>AUTOMATED CALCULATION / SOURCE GATED</small>
          <h2>{topic.title}</h2>
        </div>
        <span>
          {ratio && latest
            ? "同月来源自动计算 · 非期货实时行情"
            : "输入源或业务口径待接入"}
        </span>
      </div>
      <div className="mi-formula-expression">
        <small>计算口径</small>
        <strong>{topic.formula}</strong>
        <span>
          {ratio
            ? "输入必须来自同一统计月；任一序列缺失或分母为零时不生成结果。"
            : "截图中的数字和固定系数不作为正式参数；须先核对来源、单位和业务口径。"}
        </span>
      </div>
      {ratio && latest ? (
        <>
          <div className="mi-wb-tape">
            <div>
              <small>最新统计月</small>
              <strong>{latest.period.slice(0, 7)}</strong>
              <span>世界银行月度</span>
            </div>
            <div>
              <small>小麦 / 玉米</small>
              <strong>{number.format(latest.value)}</strong>
              <span>同单位比值</span>
            </div>
            <div>
              <small>较上月变化</small>
              <strong>
                {latestChange === null
                  ? "--"
                  : `${latestChange > 0 ? "+" : ""}${number.format(latestChange)}%`}
              </strong>
              <span>比值环比</span>
            </div>
            <div>
              <small>数据状态</small>
              <strong>
                {wheat?.stale || maize?.stale
                  ? "来源已过期"
                  : feedError
                    ? "连接中断"
                    : "来源已同步"}
              </strong>
              <span>最近同步与修订可查</span>
            </div>
          </div>
          <div className="mi-wb-chart-shell">
            <header>
              <strong>同月价格比走势</strong>
              <span>
                {focused
                  ? `${focused.period.slice(0, 7)} · ${number.format(focused.value)}`
                  : "--"}
              </span>
            </header>
            <svg
              className="mi-wb-chart"
              viewBox="0 0 1000 320"
              role="img"
              aria-label={`${topic.title}月度走势，最新${number.format(latest.value)}`}
              tabIndex={0}
              onMouseMove={(event) => {
                const rect = event.currentTarget.getBoundingClientRect();
                const x = ((event.clientX - rect.left) / rect.width) * 1000;
                setSelectedIndex(
                  Math.max(
                    0,
                    Math.min(
                      plot.length - 1,
                      Math.round(((x - 46) / 924) * (plot.length - 1)),
                    ),
                  ),
                );
              }}
              onMouseLeave={() => setSelectedIndex(null)}
              onKeyDown={(event) => {
                if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                  event.preventDefault();
                  setSelectedIndex((current) =>
                    Math.max(
                      0,
                      Math.min(
                        plot.length - 1,
                        (current ?? plot.length - 1) +
                          (event.key === "ArrowLeft" ? -1 : 1),
                      ),
                    ),
                  );
                }
              }}
            >
              {[50, 107.5, 165, 222.5, 280].map((y) => (
                <line key={y} x1="46" x2="970" y1={y} y2={y} className="grid" />
              ))}
              <polyline
                points={plot.map((point) => `${point.x},${point.y}`).join(" ")}
                className="line"
              />
              {selectedIndex !== null && focused && (
                <g className="mi-wb-crosshair">
                  <line x1={focused.x} x2={focused.x} y1="45" y2="282" />
                  <circle cx={focused.x} cy={focused.y} r="6" />
                  <rect
                    x={Math.min(focused.x + 9, 810)}
                    y="58"
                    width="155"
                    height="42"
                    rx="2"
                  />
                  <text x={Math.min(focused.x + 17, 818)} y="76">
                    {focused.period.slice(0, 7)}
                  </text>
                  <text x={Math.min(focused.x + 17, 818)} y="92">
                    {number.format(focused.value)}
                  </text>
                </g>
              )}
              <circle
                cx={plot.at(-1)?.x}
                cy={plot.at(-1)?.y}
                r="5"
                className="current"
              />
              <text x="46" y="309">
                {points[0]?.period.slice(0, 7)}
              </text>
              <text x="912" y="309">
                {latest.period.slice(0, 7)}
              </text>
            </svg>
          </div>
          <p className="mi-formula-provenance">
            来源：
            <a href={wheat?.sourceUrl} target="_blank" rel="noopener noreferrer">
              世界银行 Pink Sheet 月度工作簿 ↗
            </a>{" "}
            · 来源更新 {wheat?.sourceUpdatedOn ?? "--"} ·
            仅比较美国软红冬小麦与国际玉米月均基准。
          </p>
        </>
      ) : (
        <div className="mi-formula-pending" role="status">
          <strong>
            {ratio ? "同月价格序列暂不可用" : "自动结果待输入源与业务口径核验"}
          </strong>
          <span>系统不会使用截图示例报价、未授权行情或预置常数生成业务结果。</span>
        </div>
      )}
      <section className="mi-formula-inputs">
        <header>
          <strong>计算所需输入</strong>
          <span>{ratio ? "公开月度基准" : "逐项接入并校验"}</span>
        </header>
        {(requiredInputs[topic.title] ?? []).map((name) => (
          <div key={name}>
            <span>{name}</span>
            <em>{ratio && latest ? "同月已取得" : "待接入 / 待核验"}</em>
          </div>
        ))}
      </section>
    </div>
  );
}
