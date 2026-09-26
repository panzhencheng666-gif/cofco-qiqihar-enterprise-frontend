import { useState } from "react";
import { useMarketQuoteBoard } from "./useMarketQuoteBoard";
import type { AnalysisTopic } from "./metricCatalog";
import { findMetric } from "./metricCatalog";

const number = new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 3 });
const cadenceText = {
  INTRADAY: "盘中",
  DAILY: "按日发布",
  WEEKLY: "按周发布",
  MONTHLY: "按月发布",
};
const groupOrder = [
  "谷物",
  "油脂油料",
  "农副产品",
  "全球指数",
  "原油与能源",
  "贵金属与大宗",
  "汇率",
  "航运与陆运",
  "农资与成本",
];

export function MarketQuoteRail({
  onSelect,
}: {
  onSelect: (topic: AnalysisTopic) => void;
}) {
  const { board, error, hidePrices, sourceUnavailable, label, feedAge } =
    useMarketQuoteBoard();
  const [group, setGroup] = useState("谷物");

  const groups = [...new Set(board?.instruments.map((item) => item.group) ?? [])].sort(
    (left, right) =>
      (groupOrder.indexOf(left) < 0 ? groupOrder.length : groupOrder.indexOf(left)) -
      (groupOrder.indexOf(right) < 0 ? groupOrder.length : groupOrder.indexOf(right)),
  );
  const selectedGroup = groups.includes(group) ? group : (groups[0] ?? group);
  const rows = board?.instruments.filter((item) => item.group === selectedGroup) ?? [];
  const quotes = new Map(board?.quotes.map((item) => [item.id, item]) ?? []);

  return (
    <section className="mi-quote-rail" aria-label="跨市场授权行情监控">
      <header>
        <strong>跨市场行情监控</strong>
        <span role="status">{label ?? "正在读取行情"}</span>
      </header>
      <nav aria-label="行情类别" className="mi-quote-groups">
        {groups.map((item) => (
          <button
            key={item}
            type="button"
            aria-pressed={selectedGroup === item}
            onClick={() => setGroup(item)}
          >
            {item}
          </button>
        ))}
      </nav>
      <div className="mi-quote-columns">
        <span>市场 / 标的</span>
        <span>最新</span>
        <span>变动</span>
      </div>
      <div
        className="mi-quote-scroll"
        tabIndex={0}
        role="region"
        aria-label={`${selectedGroup}行情，可滚动`}
      >
        {rows.map((instrument) => {
          const quote = hidePrices ? undefined : quotes.get(instrument.id);
          const cached = Boolean(quote && sourceUnavailable);
          const diff = quote?.previousClose ? quote.last - quote.previousClose : null;
          const pct =
            diff !== null && quote?.previousClose
              ? (diff / quote.previousClose) * 100
              : null;
          return (
            <button
              key={instrument.id}
              type="button"
              onClick={() => {
                const topic = findMetric(instrument.name, "价格与成本");
                onSelect({
                  ...topic,
                  unit: topic.unit ?? instrument.unit,
                  group:
                    topic.group === topic.kind
                      ? instrument.group
                      : (topic.group ?? instrument.group),
                });
              }}
              title={
                quote
                  ? `${quote.provider} · 源时间 ${quote.sourceAt} · ${cached ? "来源中断，显示最后一次成功接收的缓存报价" : quote.state === "CURRENT" ? "与发布频率匹配" : "数据已过期"}`
                  : "授权行情待接入"
              }
            >
              <span className="mi-quote-name">
                <strong>{instrument.name}</strong>
                <small>
                  {instrument.market} · {instrument.unit} ·{" "}
                  {cadenceText[instrument.cadence]}
                  {cached && " · 缓存报价"}
                  {!cached && quote?.state === "STALE" && " · 报价已过期"}
                </small>
                <small>{quote ? `源时间 ${quote.sourceAt}` : "尚无可展示报价"}</small>
              </span>
              <b className={cached || quote?.state === "STALE" ? "stale" : ""}>
                {quote ? number.format(quote.last) : "--"}
              </b>
              <span
                className={
                  cached || quote?.state === "STALE" || pct === null
                    ? "pending"
                    : pct >= 0
                      ? "up"
                      : "down"
                }
              >
                {pct === null
                  ? "待接入"
                  : `${pct > 0 ? "+" : ""}${number.format(pct)}%`}
              </span>
            </button>
          );
        })}
        {!board && <p>{error ? "行情目录读取失败" : "正在读取行情目录"}</p>}
      </div>
      <footer>
        {board?.lastSuccessAt
          ? `${sourceUnavailable ? "最近成功接收" : "最近同步"} ${new Date(board.lastSuccessAt).toLocaleString("zh-CN")}`
          : "尚无已授权行情报文"}
        <span> · 每 10 秒检查</span>
        <span
          title={
            board?.feedPublishedAt
              ? `采集器报文发布时间 ${board.feedPublishedAt}；不代表交易所行情延迟`
              : "尚无采集器心跳信息"
          }
        >
          {feedAge === null
            ? " · 采集心跳待核验"
            : ` · 采集心跳 ${Math.floor(feedAge)} 秒（非行情延迟）`}
        </span>
      </footer>
    </section>
  );
}
