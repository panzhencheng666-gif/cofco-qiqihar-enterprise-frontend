import { useEffect, useMemo, useRef, useState } from "react";
import { chinaSeries, loadMoaFeed, type MoaFeed } from "./MoaDomesticRail";
import { metricCatalog } from "./metricCatalog";

const number = new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 2 });
const show = (value: number | null | undefined) =>
  value == null ? "--" : number.format(value);
const signed = (value: number | null | undefined) =>
  value == null ? "--" : `${value > 0 ? "+" : ""}${show(value)}`;

export function ChinaIndexAnalysisPanel({
  topicId,
  event,
}: {
  topicId: string;
  event?: { date: string; title: string } | undefined;
}) {
  const [feed, setFeed] = useState<MoaFeed | null>(null);
  const [error, setError] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [chartMode, setChartMode] = useState<"index" | "change">("index");
  const trendRef = useRef<HTMLDivElement>(null);
  const diagnosticsRef = useRef<HTMLElement>(null);
  const companionsRef = useRef<HTMLElement>(null);
  const recordsRef = useRef<HTMLDivElement>(null);
  const series = chinaSeries[Number(topicId.slice("china-index-".length)) - 1];
  const topic = metricCatalog.find((item) => item.id === topicId);

  useEffect(() => {
    const controller = new AbortController();
    async function refresh() {
      try {
        setFeed(await loadMoaFeed(controller.signal));
        setError(false);
      } catch {
        if (!controller.signal.aborted) setError(true);
      }
    }
    void refresh();
    const timer = window.setInterval(() => void refresh(), 10 * 60 * 1000);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, []);

  const observations = useMemo(() => {
    const points =
      feed?.quotes
        .filter((point) => point.series === series)
        .sort((a, b) => a.period.localeCompare(b.period)) ?? [];
    return points.map((point, position) => ({
      ...point,
      change: position
        ? point.value - (points[position - 1]?.value ?? point.value)
        : null,
    }));
  }, [feed, series]);
  const latest = observations.at(-1);
  const previous = observations.at(-2);
  const mean =
    observations.length >= 3
      ? observations.slice(-3).reduce((sum, point) => sum + point.value, 0) / 3
      : null;
  const values = observations.map((point) => point.value);
  const highest = values.length ? Math.max(...values) : null;
  const lowest = values.length ? Math.min(...values) : null;
  const changes = observations.flatMap((point) =>
    point.change === null ? [] : [point.change],
  );
  const rises = changes.filter((change) => change > 0).length;
  const falls = changes.filter((change) => change < 0).length;
  const unchanged = changes.length - rises - falls;
  const recentStart = observations.at(-5);
  const intervalChange =
    latest && recentStart ? latest.value - recentStart.value : null;
  const intervalPercent =
    intervalChange !== null && recentStart?.value
      ? (intervalChange / recentStart.value) * 100
      : null;
  const meanAbsoluteChange = changes.length
    ? changes.reduce((sum, change) => sum + Math.abs(change), 0) / changes.length
    : null;
  const rangePosition =
    latest && highest !== null && lowest !== null && highest > lowest
      ? ((latest.value - lowest) / (highest - lowest)) * 100
      : null;
  const companionIndices = useMemo(
    () =>
      chinaSeries.map((name, index) => {
        const points =
          feed?.quotes
            .filter((point) => point.series === name)
            .sort((a, b) => b.period.localeCompare(a.period)) ?? [];
        const current = points[0];
        const prior = points[1];
        const change = current && prior ? current.value - prior.value : null;
        return {
          id: `china-index-${index + 1}`,
          title:
            metricCatalog.find((item) => item.id === `china-index-${index + 1}`)
              ?.title ?? name,
          current,
          prior,
          change,
          percent:
            change !== null && prior?.value ? (change / prior.value) * 100 : null,
        };
      }),
    [feed],
  );
  const chart = useMemo(() => {
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
    const pad = Math.max((max - min) * 0.12, chartMode === "change" ? 0.1 : 0.5);
    const bottom = min - pad;
    const span = max - min + 2 * pad;
    return {
      min: bottom,
      max: bottom + span,
      coords: visible.map((point, position) => ({
        ...point,
        x: 46 + (position / (visible.length - 1)) * 924,
        y:
          280 -
          (((chartMode === "change" ? point.change! : point.value) - bottom) / span) *
            230,
      })),
    };
  }, [observations, chartMode]);
  const eventWindow = event
    ? {
        before: observations.findLast((point) => point.period < event.date),
        same: observations.find((point) => point.period === event.date),
        after: observations.find((point) => point.period > event.date),
      }
    : null;
  const eventX = useMemo(() => {
    if (!event || !chart) return null;
    const coords = chart.coords;
    const first = coords[0];
    const last = coords.at(-1);
    if (!first || !last || event.date < first.period || event.date > last.period)
      return null;
    const exact = coords.find((point) => point.period === event.date);
    if (exact) return exact.x;
    const rightIndex = coords.findIndex((point) => point.period > event.date);
    const before = coords[rightIndex - 1];
    const after = coords[rightIndex];
    if (!before || !after) return null;
    const start = Date.parse(before.period);
    const end = Date.parse(after.period);
    const at = Date.parse(event.date);
    if (!Number.isFinite(at) || end <= start) return null;
    return before.x + ((at - start) / (end - start)) * (after.x - before.x);
  }, [chart, event]);
  const eventIndex =
    event && chart ? chart.coords.findIndex((point) => point.period >= event.date) : -1;
  const focusedChart =
    chart?.coords[
      selectedIndex ?? (eventIndex >= 0 ? eventIndex : chart.coords.length - 1)
    ];
  const focused = focusedChart ?? latest;

  if (!latest)
    return (
      <div className="mi-wb-empty" role="status">
        <strong>{error ? "国内官方指数接口暂不可用" : "正在读取国内官方指数"}</strong>
        <span>等待农业农村部公开发布序列同步；不使用示例行情填充。</span>
      </div>
    );

  return (
    <div className="mi-wb-panel mi-china-panel">
      <div className="mi-wb-head">
        <div>
          <small>
            CHINA / MINISTRY OF AGRICULTURE AND RURAL AFFAIRS / RELEASED INDEX
          </small>
          <h2>{topic?.title ?? "国内官方指数"}</h2>
          <span>
            最新发布日 {latest.period} · 每 10 分钟检查来源更新，发布频率依官方源
          </span>
        </div>
        <div className="mi-wb-status">
          {error || feed?.lastError
            ? "● 同步异常，显示已读取记录"
            : "● 官方发布记录已同步"}
        </div>
      </div>
      <div className="mi-wb-tape" aria-label="国内官方指数统计摘要">
        <div>
          <small>最新指数</small>
          <strong>{show(latest.value)}</strong>
          <span>指数点</span>
        </div>
        <div>
          <small>较前次发布</small>
          <strong
            className={latest.change !== null && latest.change < 0 ? "down" : "up"}
          >
            {signed(latest.change)}
          </strong>
          <span>{previous?.period ?? "无前次记录"}</span>
        </div>
        <div>
          <small>最近三次均值</small>
          <strong>{show(mean)}</strong>
          <span>按已发布观测计算</span>
        </div>
        <div>
          <small>已获取发布记录</small>
          <strong>{observations.length}</strong>
          <span>最新 {latest.period}</span>
        </div>
      </div>
      {event && (
        <div className="mi-china-event-window" aria-label="资讯发布日与指数时间对照">
          <div className="mi-china-event-title">
            <small>EVENT / RELEASE ALIGNMENT</small>
            <strong>资讯发布日 {event.date}</strong>
            <span>{event.title}</span>
          </div>
          <dl>
            {(
              [
                ["发布日前最近一期", eventWindow?.before],
                ["同发布日指数", eventWindow?.same],
                ["发布日后首期", eventWindow?.after],
              ] as const
            ).map(([label, point]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>
                  {show(point?.value)} <span>点</span>
                </dd>
                <small>{point?.period ?? "已获取记录中暂无"}</small>
              </div>
            ))}
          </dl>
          <p>同日指数与资讯无可靠的日内先后顺序；此处只对齐官方发布日期。</p>
        </div>
      )}
      <nav className="mi-china-analysis-nav" aria-label="国内指数分析模块">
        <button
          type="button"
          onClick={() => trendRef.current?.scrollIntoView({ block: "start" })}
        >
          走势与定位
        </button>
        <button
          type="button"
          onClick={() => diagnosticsRef.current?.scrollIntoView({ block: "start" })}
        >
          区间与方向
        </button>
        <button
          type="button"
          onClick={() => companionsRef.current?.scrollIntoView({ block: "start" })}
        >
          同源指数对照
        </button>
        <button
          type="button"
          onClick={() => recordsRef.current?.scrollIntoView({ block: "start" })}
        >
          记录与口径
        </button>
      </nav>
      <div className="mi-wb-market-layout" ref={trendRef}>
        <div className="mi-wb-chart-shell">
          <header>
            <div className="mi-wb-chart-title">
              <strong>
                {chartMode === "index" ? "官方指数走势" : "较前次发布变化"}
              </strong>
              <small>OFFICIAL RELEASES · {observations.length} 期观测</small>
            </div>
            <div className="mi-wb-chart-actions" role="group" aria-label="走势图指标">
              <button
                type="button"
                aria-pressed={chartMode === "index"}
                onClick={() => {
                  setChartMode("index");
                  setSelectedIndex(null);
                }}
              >
                指数
              </button>
              <button
                type="button"
                aria-pressed={chartMode === "change"}
                onClick={() => {
                  setChartMode("change");
                  setSelectedIndex(null);
                }}
              >
                较前次
              </button>
            </div>
            <span>
              {focused
                ? `${focused.period}  ${chartMode === "index" ? `${show(focused.value)} 点` : `${signed(focused.change)} 点`}`
                : "--"}
            </span>
          </header>
          {chart ? (
            <svg
              className="mi-wb-chart"
              viewBox="0 0 1000 320"
              role="img"
              tabIndex={0}
              aria-label={`${topic?.title ?? "国内指数"}${chartMode === "index" ? "官方指数" : "较前次发布变化"}曲线，使用左右方向键定位发布日期${eventX !== null ? `；资讯发布日标记 ${event?.date}` : ""}`}
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
                {show(chart.max)}
              </text>
              <text x="4" y="282">
                {show(chart.min)}
              </text>
              <polyline
                points={chart.coords.map((point) => `${point.x},${point.y}`).join(" ")}
                className="line"
              />
              {eventX !== null && (
                <g className="mi-china-event-marker" aria-hidden="true">
                  <line x1={eventX} x2={eventX} y1="47" y2="280" />
                  <text x={Math.min(eventX + 7, 810)} y="43">
                    资讯发布日 {event?.date}
                  </text>
                </g>
              )}
              {selectedIndex !== null && focusedChart && (
                <g className="mi-wb-crosshair">
                  <line x1={focusedChart.x} x2={focusedChart.x} y1="45" y2="282" />
                  <circle cx={focusedChart.x} cy={focusedChart.y} r="6" />
                  <rect
                    x={Math.min(focusedChart.x + 9, 810)}
                    y="58"
                    width="155"
                    height="42"
                    rx="2"
                  />
                  <text x={Math.min(focusedChart.x + 17, 818)} y="76">
                    {focusedChart.period}
                  </text>
                  <text x={Math.min(focusedChart.x + 17, 818)} y="92">
                    {chartMode === "index"
                      ? `${show(focusedChart.value)} 点`
                      : `${signed(focusedChart.change)} 点`}
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
                {chart.coords[0]?.period}
              </text>
              <text x="897" y="309">
                {chart.coords.at(-1)?.period}
              </text>
            </svg>
          ) : (
            <div className="mi-wb-chart-pending" role="status">
              已发布观测不足，暂不能绘制{chartMode === "index" ? "指数" : "较前次变化"}
              走势。
            </div>
          )}
          <footer>← → 键定位发布日期 · 变化值仅比较相邻两次已发布观测</footer>
        </div>
        <aside className="mi-wb-market-depth" aria-label="发布区间与观测详情">
          <header>
            <strong>发布区间</strong>
            <span>已获取记录 / 指数点</span>
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
              <dt>前次发布</dt>
              <dd>{show(previous?.value)}</dd>
            </div>
            <div>
              <dt>最近三次均值</dt>
              <dd>{show(mean)}</dd>
            </div>
          </dl>
          <div className="mi-wb-market-focus">
            <small>当前定位 / {focused?.period ?? "--"}</small>
            <strong>{show(focused?.value)}</strong>
            <span>指数点 · 较前次 {signed(focused?.change)} 点</span>
          </div>
          <p>发布日指数，不代表交易所实时行情；无新发布时保留最近一期。</p>
        </aside>
      </div>
      <section
        className="mi-china-diagnostics"
        aria-label="官方指数区间分析"
        ref={diagnosticsRef}
      >
        <header>
          <div>
            <small>RELEASE SERIES / DESCRIPTIVE ANALYSIS</small>
            <strong>区间变化与发布方向</strong>
          </div>
          <span>{changes.length} 组相邻发布对 · 仅描述已获取记录</span>
        </header>
        <div className="mi-china-diagnostics-grid">
          <dl className="mi-china-stat-table">
            <div>
              <dt>最近五期首末变化</dt>
              <dd>{signed(intervalChange)} 点</dd>
            </div>
            <div>
              <dt>最近五期相对变化</dt>
              <dd>{intervalPercent === null ? "--" : `${signed(intervalPercent)}%`}</dd>
            </div>
            <div>
              <dt>平均绝对单次变化</dt>
              <dd>{show(meanAbsoluteChange)} 点</dd>
            </div>
            <div>
              <dt>最新值在区间内位置</dt>
              <dd>{rangePosition === null ? "--" : `${show(rangePosition)}%`}</dd>
            </div>
          </dl>
          <div className="mi-china-direction">
            <div className="mi-china-direction-head">
              <strong>相邻发布方向</strong>
              <span>上升 / 下降 / 持平</span>
            </div>
            <div className="mi-china-direction-bars" aria-hidden="true">
              {(
                [
                  ["up", rises],
                  ["down", falls],
                  ["flat", unchanged],
                ] as const
              ).map(([direction, count]) => (
                <div key={direction} className={direction}>
                  <span
                    style={{
                      width: `${changes.length ? (count / changes.length) * 100 : 0}%`,
                    }}
                  />
                </div>
              ))}
            </div>
            <dl>
              <div>
                <dt>上升</dt>
                <dd>{rises} 次</dd>
              </div>
              <div>
                <dt>下降</dt>
                <dd>{falls} 次</dd>
              </div>
              <div>
                <dt>持平</dt>
                <dd>{unchanged} 次</dd>
              </div>
            </dl>
          </div>
        </div>
        <p>
          首末变化以最近五期中的第一期为基准；区间位置为（最新值－区间最低）÷（区间最高－区间最低）。区间长度不足时按已获取记录计算。
        </p>
      </section>
      <section
        className="mi-china-companions"
        aria-label="国内同源指数横向对照"
        ref={companionsRef}
      >
        <header>
          <div>
            <small>SAME SOURCE / RELEASE COMPARISON</small>
            <strong>国内同源指数对照</strong>
          </div>
          <span>仅比较各序列相对前次发布的变化</span>
        </header>
        <div className="mi-china-companion-row labels" aria-hidden="true">
          <span>指数</span>
          <span>发布日</span>
          <span>最新点位</span>
          <span>较前次 / 点</span>
          <span>相对变化</span>
        </div>
        {companionIndices.map((item) => (
          <div
            className={`mi-china-companion-row${item.id === topicId ? " selected" : ""}`}
            key={item.id}
          >
            <span>{item.title}</span>
            <span>{item.current?.period ?? "--"}</span>
            <span>{show(item.current?.value)}</span>
            <span>{signed(item.change)}</span>
            <span>{item.percent === null ? "--" : `${signed(item.percent)}%`}</span>
          </div>
        ))}
        <footer>
          不同指数的编制范围与基期不同，点位不可直接相减；日期不一致时不视为同期比较。
        </footer>
      </section>
      <div className="mi-wb-lower" ref={recordsRef}>
        <section>
          <header>
            <strong>发布记录</strong>
            <span>最近 {Math.min(observations.length, 12)} 期</span>
          </header>
          <div className="mi-wb-row labels">
            <span>发布日期</span>
            <span>指数点</span>
            <span>较前次</span>
          </div>
          {observations
            .slice(-12)
            .reverse()
            .map((point) => (
              <button
                type="button"
                className={`mi-wb-row${focused?.period === point.period ? " active" : ""}`}
                key={point.period}
                onClick={() => {
                  const position =
                    chart?.coords.findIndex((item) => item.period === point.period) ??
                    -1;
                  if (position >= 0) setSelectedIndex(position);
                }}
                disabled={!chart?.coords.some((item) => item.period === point.period)}
                aria-label={`定位 ${point.period}，${show(point.value)} 点`}
              >
                <span>{point.period}</span>
                <span>{show(point.value)}</span>
                <span>{signed(point.change)}</span>
              </button>
            ))}
        </section>
        <section className="mi-wb-method">
          <header>
            <strong>发布与计算口径</strong>
          </header>
          <p>
            本系统仅对农业农村部公开发布的指数计算前次变化、近三次均值与已获取区间高低值。不补造未发布日期，也不将发布日指数当成实时交易报价。
          </p>
          <dl>
            <dt>数据频率</dt>
            <dd>以官方发布为准</dd>
            <dt>数据单位</dt>
            <dd>指数点</dd>
            <dt>最近采集</dt>
            <dd>{new Date(latest.fetchedAt).toLocaleString("zh-CN")}</dd>
            <dt>同步状态</dt>
            <dd>
              {error || feed?.lastError
                ? "更新异常，显示已读取记录"
                : "最近一次同步成功"}
            </dd>
          </dl>
          <a href={latest.sourceUrl} target="_blank" rel="noopener noreferrer">
            农业农村部原始发布页 ↗
          </a>
        </section>
      </div>
    </div>
  );
}
