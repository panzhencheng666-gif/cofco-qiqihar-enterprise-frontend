import { useEffect, useState } from "react";
import { loadLatestNews, type UnifiedHeadline } from "./UnifiedNewsRail";
import { ChinaIndexAnalysisPanel } from "./ChinaIndexAnalysisPanel";
import { metricCatalog } from "./metricCatalog";

const publicationDay = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "numeric",
  day: "numeric",
  timeZone: "UTC",
});

export function MoaNewsAnalysisPanel({
  title,
  sourceUrl,
}: {
  title: string;
  sourceUrl?: string;
}) {
  const [headlines, setHeadlines] = useState<UnifiedHeadline[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "unavailable">("loading");
  const [indexId, setIndexId] = useState(
    /农产品批发价格200指数/.test(title) ? "china-index-4" : "china-index-1",
  );
  useEffect(() => {
    const controller = new AbortController();
    async function refresh() {
      if (document.hidden) return;
      try {
        setHeadlines(await loadLatestNews(controller.signal));
        setStatus("ready");
      } catch {
        if (!controller.signal.aborted) setStatus("unavailable");
      }
    }
    void refresh();
    const timer = window.setInterval(() => void refresh(), 30_000);
    const onVisible = () => void refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      controller.abort();
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
  const article = headlines.find(
    (item) =>
      item.region === "domestic" &&
      (sourceUrl?.startsWith("https://")
        ? item.url === sourceUrl
        : item.title === title),
  );
  const indices = metricCatalog.filter((item) => item.id.startsWith("china-index-"));
  return (
    <div className="mi-news-analysis mi-moa-event-analysis">
      <div className="mi-news-analysis-source">
        <div>
          <small>{article?.sourceName ?? "农业农村部"} / 原始发布</small>
          <strong>{title}</strong>
          <span>
            {article
              ? `发布日期 ${publicationDay.format(new Date(article.publishedAt))} · 采集 ${new Date(article.fetchedAt).toLocaleString("zh-CN")}`
              : status === "unavailable"
                ? "新闻源暂不可用，等待重新同步"
                : status === "ready"
                  ? "当前列表未找到这条发布记录"
                  : "正在读取官方发布记录"}
          </span>
        </div>
        {article && (
          <a href={article.url} target="_blank" rel="noopener noreferrer">
            查看原文 ↗
          </a>
        )}
      </div>
      <div className="mi-news-analysis-controls">
        <div>
          <strong>事件时间 · 国内指数</strong>
          <span>对照同日及相邻发布记录；发布日期不代表新闻发生的精确时刻。</span>
        </div>
        <label>
          指数
          <select value={indexId} onChange={(event) => setIndexId(event.target.value)}>
            {indices.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title}
              </option>
            ))}
          </select>
        </label>
      </div>
      <ChinaIndexAnalysisPanel
        key={indexId}
        topicId={indexId}
        event={article ? { date: article.publishedAt.slice(0, 10), title } : undefined}
      />
      <div className="mi-news-analysis-method">
        <strong>证据边界</strong>
        <span>
          已接入：官方标题、发布日期、原文链接及国内公开指数。点击“查看原文”阅读官方全文。
        </span>
        <span>
          新闻正文抽取、跨源核验与事件影响模型尚未接入；同日和相邻发布记录只是时间对照，不输出因果判断。
        </span>
      </div>
    </div>
  );
}
