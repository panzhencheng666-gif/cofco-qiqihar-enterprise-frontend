import { useEffect, useState } from "react";
import { z } from "zod";
import { beijingInstantLabel } from "./newsTime";

const webcastSchema = z.object({
  sourceName: z.string(),
  title: z.string(),
  url: z.url(),
  startsAt: z.string(),
  fetchedAt: z.string(),
  sourcePageUrl: z.url(),
});
type Webcast = z.infer<typeof webcastSchema>;

export async function loadOfficialWebcasts(signal?: AbortSignal): Promise<Webcast[]> {
  const response = await fetch("/api/v1/market-intelligence/news/webcasts", {
    credentials: "same-origin",
    cache: "no-store",
    signal: signal ?? null,
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return z.object({ data: z.array(webcastSchema) }).parse(await response.json()).data;
}

export function OfficialWebcastList() {
  const [events, setEvents] = useState<Webcast[]>([]);
  const [error, setError] = useState(false);
  const [now, setNow] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    async function refresh() {
      if (document.hidden) return;
      try {
        setEvents(await loadOfficialWebcasts(controller.signal));
        setNow(Date.now());
        setError(false);
      } catch {
        if (!controller.signal.aborted) setError(true);
      }
    }
    void refresh();
    const onVisible = () => {
      void refresh();
    };
    const timer = window.setInterval(onVisible, 30_000);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      controller.abort();
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const upcoming = events.filter((event) => new Date(event.startsAt).getTime() > now);
  const recent = events.filter((event) => new Date(event.startsAt).getTime() <= now);
  const displayed = [
    ...upcoming.sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
    ...recent.sort((a, b) => b.startsAt.localeCompare(a.startsAt)),
  ].slice(0, 12);
  return (
    <section className="mi-video-news" aria-label="官方直播与回看列表">
      <header>
        <strong>官方直播与回看</strong>
        <span>{error ? "接口暂不可用" : `${events.length} 条已保存 · 按源更新`}</span>
      </header>
      <p>播出安排按 FAO 标注的罗马时间换算为北京时间；能否直播或回看以官方页面为准。</p>
      <div className="mi-video-news-list">
        {displayed.map((event) => (
          <article key={event.url} className="mi-video-news-item">
            <small>
              {event.sourceName} · {beijingInstantLabel(event.startsAt)} ·
              {new Date(event.startsAt).getTime() > now ? " 预告" : " 已到播出时间"}
            </small>
            <a href={event.url} target="_blank" rel="noopener noreferrer">
              <strong>{event.title}</strong>
              <span>打开官方直播或回看页 ↗</span>
            </a>
            <a
              href={event.sourcePageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mi-video-news-source-link"
            >
              查看 FAO webcast 目录 ↗
            </a>
          </article>
        ))}
        {displayed.length === 0 && (
          <span className="mi-news-pending">
            {error ? "直播目录接口暂不可用" : "等待官方 webcast 目录首次同步"}
          </span>
        )}
      </div>
    </section>
  );
}
