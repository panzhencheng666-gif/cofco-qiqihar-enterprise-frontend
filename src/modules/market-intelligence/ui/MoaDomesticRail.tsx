import { useEffect, useState } from "react";
import { z } from "zod";
import { metricCatalog, type AnalysisTopic } from "./metricCatalog";

const quoteSchema = z.object({
  series: z.string(),
  period: z.string(),
  value: z.number(),
  sourceUrl: z.string().url(),
  fetchedAt: z.string(),
});
const headlineSchema = z.object({
  title: z.string(),
  url: z.string().url(),
  publishedOn: z.string(),
  fetchedAt: z.string(),
});
const feedSchema = z.object({
  quotes: z.array(quoteSchema),
  headlines: z.array(headlineSchema),
  lastSuccessAt: z.string().nullable(),
  lastError: z.string().nullable(),
});
export type MoaFeed = z.infer<typeof feedSchema>;
export type MoaQuote = z.infer<typeof quoteSchema>;
export const chinaSeries = [
  "grain",
  "grain-oil",
  "edible-oil",
  "agri-200",
  "basket",
  "livestock",
  "aquatic",
  "vegetable",
  "fruit",
] as const;
const format = new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 2 });

export async function loadMoaFeed(signal?: AbortSignal): Promise<MoaFeed> {
  const response = await fetch("/api/v1/market-intelligence/china/overview", {
    credentials: "same-origin",
    cache: "no-store",
    signal: signal ?? null,
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return z.object({ data: feedSchema }).parse(await response.json()).data;
}

export function MoaDomesticRail({
  onSelect,
}: {
  onSelect: (topic: AnalysisTopic) => void;
}) {
  const [feed, setFeed] = useState<MoaFeed | null>(null);
  const [error, setError] = useState(false);
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
    const timer = window.setInterval(() => void refresh(), 30_000);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, []);
  const topics = metricCatalog.filter((topic) => topic.id.startsWith("china-index-"));
  return (
    <>
      <section className="mi-wb-rail" aria-label="国内官方批发价格指数">
        <header>
          <strong>国内官方批发价格指数</strong>
          <span>
            {feed?.lastSuccessAt
              ? "农业农村部 · 发布日"
              : error
                ? "接口暂不可用"
                : "来源同步中"}
          </span>
        </header>
        <div className="mi-wb-rail-labels">
          <span>序列</span>
          <span>最新</span>
          <span>较前次</span>
        </div>
        {topics.map((topic, index) => {
          const points =
            feed?.quotes
              .filter((quote) => quote.series === chinaSeries[index])
              .sort((a, b) => b.period.localeCompare(a.period)) ?? [];
          const latest = points[0];
          const previous = points[1];
          const change = latest && previous ? latest.value - previous.value : null;
          return (
            <button type="button" key={topic.id} onClick={() => onSelect(topic)}>
              <span>{topic.title}</span>
              <b>{latest ? format.format(latest.value) : "--"}</b>
              <em className={change !== null && change < 0 ? "down" : "up"}>
                {change === null
                  ? "--"
                  : `${change > 0 ? "+" : ""}${format.format(change)}`}
              </em>
            </button>
          );
        })}
        <footer>
          最新发布日 {feed?.quotes[0]?.period ?? "待接入"} · 发布频率依官方源
        </footer>
      </section>
    </>
  );
}
