import { useEffect, useState } from "react";
import { z } from "zod";
import type { AnalysisTopic } from "./metricCatalog";
import { isNewsPublishedToday, newsPublicationLabel } from "./newsTime";

const headlineSchema = z.object({
  sourceCode: z.string(),
  sourceName: z.string(),
  region: z.enum(["domestic", "international"]),
  title: z.string(),
  url: z.string().url(),
  publishedAt: z.string(),
  publishedOn: z.iso.date(),
  publicationPrecision: z.enum(["date", "instant"]),
  fetchedAt: z.string(),
});
export type UnifiedHeadline = z.infer<typeof headlineSchema>;
type Filter = "all" | "domestic" | "international";

export async function loadLatestNews(signal?: AbortSignal): Promise<UnifiedHeadline[]> {
  const response = await fetch("/api/v1/market-intelligence/news/latest", {
    credentials: "same-origin",
    cache: "no-store",
    signal: signal ?? null,
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return z.object({ data: z.array(headlineSchema) }).parse(await response.json()).data;
}

export function visibleNews(
  items: UnifiedHeadline[],
  filter: Filter,
): UnifiedHeadline[] {
  if (filter !== "all")
    return items.filter((item) => item.region === filter).slice(0, 20);
  const domestic = items.filter((item) => item.region === "domestic").slice(0, 10);
  const international = items
    .filter((item) => item.region === "international")
    .slice(0, 10);
  return [...domestic, ...international].sort((a, b) =>
    b.publishedAt.localeCompare(a.publishedAt),
  );
}

export function UnifiedNewsRail({
  onSelect,
}: {
  onSelect: (topic: AnalysisTopic) => void;
}) {
  const [items, setItems] = useState<UnifiedHeadline[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [error, setError] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    async function refresh() {
      if (document.hidden) return;
      try {
        setItems(await loadLatestNews(controller.signal));
        setError(false);
      } catch {
        if (!controller.signal.aborted) setError(true);
      }
    }
    void refresh();
    const timer = window.setInterval(() => {
      void refresh();
    }, 30_000);
    const onVisible = () => {
      void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      controller.abort();
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
  const displayed = visibleNews(items, filter);
  const publishedToday = items.filter(
    (item) =>
      item.publicationPrecision === "instant" && isNewsPublishedToday(item.publishedOn),
  ).length;
  const dateOnlyToday = items.filter(
    (item) =>
      item.publicationPrecision === "date" && isNewsPublishedToday(item.publishedOn),
  ).length;
  return (
    <section className="mi-news-card mi-unified-news" aria-label="国内国际粮食资讯">
      <header>
        <strong>国内外粮食资讯</strong>
        <span>
          {error
            ? "来源暂不可用 · 显示已保存资讯"
            : `北京时间今日 ${publishedToday} · 来源仅标今日日期 ${dateOnlyToday} · 近期 ${items.length}`}
        </span>
      </header>
      <div className="mi-unified-news-filters" role="group" aria-label="资讯区域">
        {(
          [
            ["all", "全部"],
            ["domestic", "国内"],
            ["international", "国际"],
          ] as const
        ).map(([value, label]) => (
          <button
            type="button"
            key={value}
            aria-pressed={filter === value}
            onClick={() => setFilter(value)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="mi-news-card-scroll">
        {displayed.map((item) => {
          const content = (
            <>
              <span className="mi-news-headline-source">
                {item.sourceName} · {newsPublicationLabel(item)}
                {isNewsPublishedToday(item.publishedOn)
                  ? item.publicationPrecision === "instant"
                    ? " · 北京时间今日发布"
                    : " · 来源日期为今日"
                  : ""}
              </span>
              <strong>{item.title}</strong>
              <small>
                {item.sourceCode === "eia-today-in-energy"
                  ? "阅读官方原文 ↗"
                  : "原始来源与独立研判 ↗"}
              </small>
            </>
          );
          return item.sourceCode === "eia-today-in-energy" ? (
            <a
              key={`${item.sourceCode}:${item.url}`}
              className="mi-news-headline"
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              {content}
            </a>
          ) : (
            <button
              type="button"
              key={`${item.sourceCode}:${item.url}`}
              className="mi-news-headline"
              onClick={() =>
                onSelect({
                  id: `${item.region === "domestic" ? "moa-news" : "fao-news"}:${item.url}`,
                  title: item.title,
                  kind: "实时事件",
                  group: item.sourceName,
                })
              }
            >
              {content}
            </button>
          );
        })}
        {!displayed.length && (
          <p className="mi-news-pending">
            {error ? "官方资讯接口暂不可用" : "等待已核验来源首次同步"}
          </p>
        )}
      </div>
    </section>
  );
}
