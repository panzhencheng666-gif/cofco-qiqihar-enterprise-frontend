import { useEffect, useMemo, useState } from "react";
import { z } from "zod";

export const seriesCodes = [
  "maize",
  "wheat-srw",
  "rice-thai-5",
  "soybeans",
  "palm-oil",
  "crude-oil",
  "urea",
] as const;
const pointSchema = z.object({ period: z.string(), value: z.number() });
export const snapshotSchema = z.object({
  series: z.string(),
  title: z.string(),
  unit: z.string(),
  cadence: z.string(),
  points: z.array(pointSchema),
  latest: z.number().nullable(),
  latestPeriod: z.string().nullable(),
  previous: z.number().nullable(),
  monthChangePct: z.number().nullable(),
  yearChangePct: z.number().nullable(),
  trailingThreeMonthAverage: z.number().nullable(),
  trend: z.string(),
  sourceUrl: z.string().url(),
  sourceUpdatedOn: z.string().nullable(),
  lastAttemptAt: z.string().nullable(),
  lastSuccessAt: z.string().nullable(),
  syncError: z.string().nullable(),
  stale: z.boolean(),
});
export type Snapshot = z.infer<typeof snapshotSchema>;
const formatter = new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 2 });

function show(value: number | null, suffix = "") {
  return value === null ? "--" : `${formatter.format(value)}${suffix}`;
}

function signed(value: number | null) {
  return value === null ? "--" : `${value > 0 ? "+" : ""}${show(value, "%")}`;
}

export function WorldBankMonthlyPanel({
  topicId,
  range,
}: {
  topicId: string;
  range: string;
}) {
  const fao = topicId.startsWith("fao-food-price-");
  const index =
    Number(topicId.slice((fao ? "fao-food-price-" : "world-bank-monthly-").length)) - 1;
  const series = fao
    ? ["food", "meat", "dairy", "cereals", "oils", "sugar"][index]
    : seriesCodes[index];
  const source = fao ? "fao-food-price" : "world-bank";
  const months = range === "近5年" ? 60 : range === "近1年" ? 12 : 24;
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [faoComponents, setFaoComponents] = useState<Snapshot[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "unavailable">("loading");
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [chartMode, setChartMode] = useState<"price" | "change">("price");

  useEffect(() => {
    if (!series) return;
    const controller = new AbortController();
    async function refresh() {
      try {
        const response = await fetch(
          `/api/v1/market-intelligence/${source}/monthly?series=${series}&months=${months}`,
          { credentials: "same-origin", cache: "no-store", signal: controller.signal },
        );
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const body = z.object({ data: snapshotSchema }).parse(await response.json());
        setSnapshot(body.data);
        setState("ready");
      } catch {
        if (!controller.signal.aborted) setState("unavailable");
      }
    }
    void refresh();
    const timer = window.setInterval(() => void refresh(), 15 * 60 * 1000);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [series, months, source]);

  useEffect(() => {
    if (!fao) return;
    const controller = new AbortController();
    async function refresh() {
      try {
        const response = await fetch(
          "/api/v1/market-intelligence/fao-food-price/overview",
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
        setFaoComponents(body.data);
      } catch {
        if (!controller.signal.aborted) setFaoComponents([]);
      }
    }
    void refresh();
    const timer = window.setInterval(() => void refresh(), 15 * 60 * 1000);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [fao]);

  const chart = useMemo(() => {
    const points = snapshot?.points ?? [];
    if (points.length < 2) return null;
    const observations = points.map((point, index) => {
      const previous = points[index - 1];
      const month = new Date(`${point.period.slice(0, 7)}-01T00:00:00Z`);
      month.setUTCMonth(month.getUTCMonth() - 1);
      const change =
        previous &&
        previous.value !== 0 &&
        previous.period.slice(0, 7) === month.toISOString().slice(0, 7)
          ? ((point.value - previous.value) / previous.value) * 100
          : null;
      return { ...point, change };
    });
    const visible =
      chartMode === "change"
        ? observations.filter((point) => point.change !== null)
        : observations;
    if (visible.length < 2) return null;
    const values = visible.map((point) =>
      chartMode === "change" ? point.change! : point.value,
    );
    const min = Math.min(...values);
    const max = Math.max(...values);
    const pad = Math.max(
      (max - min) * 0.1,
      chartMode === "change" ? 0.5 : min * 0.02,
      1,
    );
    const bottom = min - pad;
    const span = max - min + 2 * pad;
    const coords = visible.map((point, index) => ({
      x: 46 + (index / (visible.length - 1)) * 924,
      y:
        280 -
        (((chartMode === "change" ? point.change! : point.value) - bottom) / span) *
          230,
      ...point,
    }));
    return { coords, min: bottom, max: bottom + span };
  }, [snapshot, chartMode]);
  const focusedPoint = chart?.coords[selectedIndex ?? chart.coords.length - 1];
  const points = snapshot?.points ?? [];
  const highest = points.length
    ? Math.max(...points.map((point) => point.value))
    : null;
  const lowest = points.length ? Math.min(...points.map((point) => point.value)) : null;

  if (!snapshot?.points.length) {
    return (
      <div className="mi-wb-empty" role="status">
        <strong>
          {state === "loading" ? "正在读取官方月度数据" : "官方月度数据尚不可用"}
        </strong>
        <span>现有后台尚未返回可核验序列；系统不会用示例行情填充。</span>
      </div>
    );
  }

  return (
    <div className="mi-wb-panel">
      <div className="mi-wb-head">
        <div>
          <small>
            {fao
              ? "FAO / FOOD PRICE INDEX / MONTHLY"
              : "WORLD BANK / PINK SHEET / MONTHLY"}
          </small>
          <h2>{snapshot.title}</h2>
          <span>
            最新统计月 {snapshot.latestPeriod?.slice(0, 7) ?? "--"}
            {!fao && <> · 来源更新 {snapshot.sourceUpdatedOn ?? "--"}</>}
          </span>
        </div>
        <div className="mi-wb-status">
          {state === "unavailable"
            ? "● 连接中断，显示已读取数据"
            : snapshot.stale
              ? "● 数据已过期"
              : "● 来源已同步"}
        </div>
      </div>
      <div className="mi-wb-tape" aria-label="自动计算的月度摘要">
        <div>
          <small>{fao ? "最新月度指数" : "月均价格"}</small>
          <strong>{show(snapshot.latest)}</strong>
          <span>{snapshot.unit}</span>
        </div>
        <div>
          <small>较上月</small>
          <strong className={(snapshot.monthChangePct ?? 0) >= 0 ? "up" : "down"}>
            {signed(snapshot.monthChangePct)}
          </strong>
          <span>月度环比</span>
        </div>
        <div>
          <small>较去年同月</small>
          <strong className={(snapshot.yearChangePct ?? 0) >= 0 ? "up" : "down"}>
            {signed(snapshot.yearChangePct)}
          </strong>
          <span>同比</span>
        </div>
        <div>
          <small>{fao ? "近三月指数均值" : "近三月均价"}</small>
          <strong>{show(snapshot.trailingThreeMonthAverage)}</strong>
          <span>{snapshot.unit}</span>
        </div>
        <div>
          <small>趋势信号</small>
          <strong>
            {snapshot.trend === "RISING"
              ? "月度上行"
              : snapshot.trend === "FALLING"
                ? "月度下行"
                : snapshot.trend === "FLAT"
                  ? "月度持平"
                  : "样本不足"}
          </strong>
          <span>仅据环比计算</span>
        </div>
      </div>
      <div className="mi-wb-market-layout">
        <div className="mi-wb-chart-shell">
          <header>
            <div className="mi-wb-chart-title">
              <strong>
                {chartMode === "price"
                  ? fao
                    ? "月度指数走势"
                    : "月均价格走势"
                  : "月度环比变化"}
              </strong>
              <small>MONTHLY SERIES · {snapshot.points.length} 期观测</small>
            </div>
            <div className="mi-wb-chart-actions" role="group" aria-label="走势图指标">
              <button
                type="button"
                aria-pressed={chartMode === "price"}
                onClick={() => {
                  setChartMode("price");
                  setSelectedIndex(null);
                }}
              >
                {fao ? "指数" : "价格"}
              </button>
              <button
                type="button"
                aria-pressed={chartMode === "change"}
                onClick={() => {
                  setChartMode("change");
                  setSelectedIndex(null);
                }}
              >
                环比
              </button>
            </div>
            <span>
              {focusedPoint
                ? `${focusedPoint.period.slice(0, 7)}  ${chartMode === "price" ? `${show(focusedPoint.value)} ${snapshot.unit}` : signed(focusedPoint.change)}`
                : `${snapshot.points.length} 个统计月 · ${snapshot.unit}`}
            </span>
          </header>
          {chart && (
            <svg
              className="mi-wb-chart"
              viewBox="0 0 1000 320"
              role="img"
              aria-label={`${snapshot.title}${chartMode === "price" ? (fao ? "月度指数" : "月均价格") : "月度环比"}历史走势，使用左右方向键定位统计月`}
              tabIndex={0}
              onMouseMove={(event) => {
                const rect = event.currentTarget.getBoundingClientRect();
                const x = ((event.clientX - rect.left) / rect.width) * 1000;
                setSelectedIndex(
                  Math.max(
                    0,
                    Math.min(
                      chart.coords.length - 1,
                      Math.round(((x - 46) / 924) * (chart.coords.length - 1)),
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
                        chart.coords.length - 1,
                        (current ?? chart.coords.length - 1) +
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
              <text x="4" y="54">
                {show(chart.max, chartMode === "change" ? "%" : "")}
              </text>
              <text x="4" y="282">
                {show(chart.min, chartMode === "change" ? "%" : "")}
              </text>
              <polyline
                points={chart.coords.map((point) => `${point.x},${point.y}`).join(" ")}
                className="line"
              />
              {selectedIndex !== null && focusedPoint && (
                <g className="mi-wb-crosshair">
                  <line x1={focusedPoint.x} x2={focusedPoint.x} y1="45" y2="282" />
                  <circle cx={focusedPoint.x} cy={focusedPoint.y} r="6" />
                  <rect
                    x={Math.min(focusedPoint.x + 9, 810)}
                    y="58"
                    width="155"
                    height="42"
                    rx="2"
                  />
                  <text x={Math.min(focusedPoint.x + 17, 818)} y="76">
                    {focusedPoint.period.slice(0, 7)}
                  </text>
                  <text x={Math.min(focusedPoint.x + 17, 818)} y="92">
                    {chartMode === "price"
                      ? `${show(focusedPoint.value)} ${snapshot.unit}`
                      : signed(focusedPoint.change)}
                  </text>
                </g>
              )}
              <circle
                cx={chart.coords.at(-1)?.x}
                cy={chart.coords.at(-1)?.y}
                r="5"
                className="current"
              />
              <text x="46" y="309">
                {chart.coords[0]?.period.slice(0, 7)}
              </text>
              <text x="912" y="309">
                {chart.coords.at(-1)?.period.slice(0, 7)}
              </text>
            </svg>
          )}
          {!chart && (
            <div className="mi-wb-chart-pending" role="status">
              连续统计月不足，暂不能绘制
              {chartMode === "price" ? (fao ? "指数" : "价格") : "环比"}走势。
            </div>
          )}
          <footer>← → 键定位统计月 · 环比仅比较连续两个月的发布值</footer>
        </div>
        <aside className="mi-wb-market-depth" aria-label="历史区间与观测详情">
          <header>
            <strong>区间观察</strong>
            <span>
              {range} / {snapshot.unit}
            </span>
          </header>
          <dl>
            <div>
              <dt>区间最高</dt>
              <dd>{show(highest)}</dd>
            </div>
            <div>
              <dt>区间最低</dt>
              <dd>{show(lowest)}</dd>
            </div>
            <div>
              <dt>高低差</dt>
              <dd>
                {highest === null || lowest === null ? "--" : show(highest - lowest)}
              </dd>
            </div>
            <div>
              <dt>上一统计月</dt>
              <dd>{show(snapshot.previous)}</dd>
            </div>
            <div>
              <dt>{fao ? "三月指数均值" : "三月均价"}</dt>
              <dd>{show(snapshot.trailingThreeMonthAverage)}</dd>
            </div>
          </dl>
          <div className="mi-wb-market-focus">
            <small>当前定位 / {focusedPoint?.period.slice(0, 7) ?? "--"}</small>
            <strong>{show(focusedPoint?.value ?? null)}</strong>
            <span>
              {snapshot.unit} · 环比 {signed(focusedPoint?.change ?? null)}
            </span>
          </div>
          <p>
            {fao
              ? "FAO 月度公开指数，不代表交易所实时盘口。"
              : "统计月度价格，不代表交易所实时盘口。"}
          </p>
        </aside>
      </div>
      {fao && (
        <section className="mi-fao-components" aria-label="FAO 食品价格指数分项对照">
          <header>
            <strong>食品价格指数 · 分项监视</strong>
            <span>同一统计月 / 2014—2016 = 100</span>
          </header>
          <div className="mi-fao-components-row labels">
            <span>系列</span>
            <span>指数点</span>
            <span>环比</span>
            <span>同比</span>
          </div>
          {faoComponents.map((item) => (
            <div className="mi-fao-components-row" key={item.series}>
              <span>{item.title}</span>
              <strong>{show(item.latest)}</strong>
              <em className={(item.monthChangePct ?? 0) >= 0 ? "up" : "down"}>
                {signed(item.monthChangePct)}
              </em>
              <em className={(item.yearChangePct ?? 0) >= 0 ? "up" : "down"}>
                {signed(item.yearChangePct)}
              </em>
            </div>
          ))}
          {!faoComponents.length && <p>分项数据读取中或暂不可用</p>}
          <footer>分项指数水平仅供同口径对照，不代表各分项对总指数的贡献率。</footer>
        </section>
      )}
      <div className="mi-wb-lower">
        <section>
          <header>
            <strong>月度序列</strong>
            <span>最近 12 期</span>
          </header>
          <div className="mi-wb-row labels">
            <span>统计月</span>
            <span>{fao ? "指数点" : "月均价"}</span>
            <span>环比</span>
          </div>
          {snapshot.points
            .slice(-12)
            .reverse()
            .map((point, index, rows) => {
              const previous = rows[index + 1];
              const expected = new Date(`${point.period.slice(0, 7)}-01T00:00:00Z`);
              expected.setUTCMonth(expected.getUTCMonth() - 1);
              const change =
                previous?.period.slice(0, 7) === expected.toISOString().slice(0, 7)
                  ? ((point.value - previous.value) / previous.value) * 100
                  : null;
              return (
                <button
                  type="button"
                  className={`mi-wb-row${focusedPoint?.period === point.period ? " active" : ""}`}
                  key={point.period}
                  onClick={() => {
                    const index =
                      chart?.coords.findIndex((item) => item.period === point.period) ??
                      -1;
                    if (index >= 0) setSelectedIndex(index);
                  }}
                  disabled={!chart?.coords.some((item) => item.period === point.period)}
                  aria-label={`定位 ${point.period.slice(0, 7)}，${show(point.value)} ${snapshot.unit}`}
                >
                  <span>{point.period.slice(0, 7)}</span>
                  <span>{show(point.value)}</span>
                  <span>{signed(change)}</span>
                </button>
              );
            })}
        </section>
        <section className="mi-wb-method">
          <header>
            <strong>自动研判与数据口径</strong>
          </header>
          <p>
            {fao
              ? "本序列按 FAO 已发布月度指数计算环比、同比和近三月均值。趋势信号仅表示最近两个月的方向，不是交易建议或未来价格预测。"
              : "本序列按世界银行公开月均价计算环比、同比和近三月均价。趋势信号仅表示最近两个月的方向，不是交易建议或未来价格预测。"}
          </p>
          <dl>
            <dt>统计频率</dt>
            <dd>{snapshot.cadence}</dd>
            <dt>数据单位</dt>
            <dd>{snapshot.unit}</dd>
            <dt>最近同步</dt>
            <dd>
              {snapshot.lastSuccessAt
                ? new Date(snapshot.lastSuccessAt).toLocaleString("zh-CN")
                : "--"}
            </dd>
            <dt>同步状态</dt>
            <dd>
              {snapshot.syncError ? "上次更新失败，显示已保存数据" : "最近一次同步成功"}
            </dd>
          </dl>
          <a href={snapshot.sourceUrl} target="_blank" rel="noreferrer">
            {fao ? "FAO 官方原始数据 ↗" : "世界银行原始数据 · CC BY 4.0 ↗"}
          </a>
        </section>
      </div>
    </div>
  );
}
