import { useEffect, useState } from "react";
import { z } from "zod";
import type { AnalysisTopic } from "./metricCatalog";

export const faoHeadlineSchema = z.object({
  title: z.string(),
  url: z.string().url(),
  publishedAt: z.string(),
  fetchedAt: z.string(),
});
export const faoFeedSchema = z.object({
  headlines: z.array(faoHeadlineSchema),
  lastSuccessAt: z.string().nullable(),
  lastError: z.string().nullable(),
});
export type FaoHeadline = z.infer<typeof faoHeadlineSchema>;

export async function loadFaoNews(signal?: AbortSignal) {
  const response = await fetch("/api/v1/market-intelligence/news/fao", {
    credentials: "same-origin",
    cache: "no-store",
    signal: signal ?? null,
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const body: unknown = await response.json();
  return z.object({ data: faoFeedSchema }).parse(body).data;
}

const riskPattern =
  /flood|drought|climate|crisis|shortfall|price|supply|crop|resilien|soil|trade|hunger|food security/i;
const dateFormat = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: "UTC",
});

function HeadlineList({
  title,
  items,
  available,
  onSelect,
}: {
  title: string;
  items: FaoHeadline[];
  available: boolean;
  onSelect: (topic: AnalysisTopic) => void;
}) {
  return (
    <section className="mi-news-card" aria-label={title}>
      <header>
        <strong>{title}</strong>
        <span>{available ? `FAO · ${items.length} 条` : "新闻源待接入"}</span>
      </header>
      <div className="mi-news-card-scroll">
        {items.length ? (
          items.map((item) => (
            <button
              type="button"
              key={item.url}
              className="mi-news-headline"
              onClick={() =>
                onSelect({
                  id: `fao-news:${item.url}`,
                  title: item.title,
                  kind: "实时事件",
                  group: "FAO 新闻",
                })
              }
            >
              <span className="mi-news-headline-source">
                FAO 新闻 · {dateFormat.format(new Date(item.publishedAt))}
              </span>
              <strong>{item.title}</strong>
              <small>查看来源与独立研判界面 ↗</small>
            </button>
          ))
        ) : (
          <p className="mi-news-pending">
            {available
              ? "当前分类暂无可核验新闻"
              : "等待官方新闻源同步；不展示模拟标题。"}
          </p>
        )}
      </div>
    </section>
  );
}

export function FaoNewsRail({
  onSelect,
}: {
  onSelect: (topic: AnalysisTopic) => void;
}) {
  const [headlines, setHeadlines] = useState<FaoHeadline[]>([]);
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    async function refresh() {
      try {
        const feed = await loadFaoNews(controller.signal);
        setHeadlines(feed.headlines);
        setAvailable(Boolean(feed.lastSuccessAt));
      } catch {
        if (!controller.signal.aborted) setAvailable(false);
      }
    }
    void refresh();
    const timer = window.setInterval(() => void refresh(), 30_000);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, []);
  return (
    <>
      <HeadlineList
        title="FAO 最新新闻"
        items={headlines.slice(0, 10)}
        available={available}
        onSelect={onSelect}
      />
      <HeadlineList
        title="供应与风险观察"
        items={headlines.filter((item) => riskPattern.test(item.title)).slice(0, 10)}
        available={available}
        onSelect={onSelect}
      />
    </>
  );
}
