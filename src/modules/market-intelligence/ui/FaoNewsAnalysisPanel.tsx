import { useEffect, useState } from "react";
import { loadFaoNews, type FaoHeadline } from "./FaoNewsRail";
import { metricCatalog } from "./metricCatalog";
import { WorldBankMonthlyPanel } from "./WorldBankMonthlyPanel";

const dateFormat = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});

export function FaoNewsAnalysisPanel({ title }: { title: string }) {
  const [article, setArticle] = useState<FaoHeadline | null>(null);
  const [marketId, setMarketId] = useState("world-bank-monthly-1");
  const [range, setRange] = useState("近1年");
  const [status, setStatus] = useState("读取来源中");
  useEffect(() => {
    const controller = new AbortController();
    loadFaoNews(controller.signal)
      .then((feed) => {
        setArticle(feed.headlines.find((item) => item.title === title) ?? null);
        setStatus(feed.lastSuccessAt ? "来源已核验" : "来源同步待完成");
      })
      .catch(() => {
        if (!controller.signal.aborted) setStatus("新闻源暂不可用");
      });
    return () => controller.abort();
  }, [title]);
  const markets = metricCatalog.filter((item) =>
    item.id.startsWith("world-bank-monthly-"),
  );
  return (
    <div className="mi-news-analysis">
      <div className="mi-news-analysis-source">
        <div>
          <small>FAO NEWSROOM / 原始发布</small>
          <strong>{title}</strong>
          <span>
            {article
              ? `发布时间 ${dateFormat.format(new Date(article.publishedAt))} UTC · 采集时间 ${dateFormat.format(new Date(article.fetchedAt))} UTC`
              : status}
          </span>
        </div>
        {article && (
          <a href={article.url} target="_blank" rel="noopener noreferrer">
            查看 FAO 原文 ↗
          </a>
        )}
      </div>
      <div className="mi-news-analysis-controls">
        <div>
          <strong>关联市场观察</strong>
          <span>切换真实月度基准序列；并列观察不代表新闻造成价格变化</span>
        </div>
        <label>
          周期
          <select value={range} onChange={(event) => setRange(event.target.value)}>
            <option>近1年</option>
            <option>近5年</option>
          </select>
        </label>
      </div>
      <div className="mi-news-analysis-markets" aria-label="选择关联市场">
        {markets.map((market) => (
          <button
            type="button"
            key={market.id}
            aria-pressed={marketId === market.id}
            onClick={() => setMarketId(market.id)}
          >
            {market.title.replace("国际", "").replace("月均价", "")}
          </button>
        ))}
      </div>
      <WorldBankMonthlyPanel
        key={`${marketId}-${range}`}
        topicId={marketId}
        range={range}
      />
      <div className="mi-news-analysis-method">
        <strong>自动研判状态</strong>
        <span>已接入：FAO 原始标题与发布时间、世界银行国际商品月均价及环比/同比。</span>
        <span>
          待接入：文章全文授权、事件实体抽取、多源核验、事件与行情的统计关联。当前不输出因果或涨跌预测。
        </span>
      </div>
    </div>
  );
}
