import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { beijingInstantLabel } from "./newsTime";
import {
  isFaoProgrammePage,
  loadOfficialPlayback,
  type OfficialPlaybackSelection,
} from "./officialPlayback";

const playbackSchema = z.object({
  provider: z.literal("un-webtv"),
  entryId: z.string().regex(/^1_[a-z0-9]{8}$/),
  admission: z.literal("APPROVED"),
  status: z.enum(["LIVE", "RECORDING"]),
  validUntil: z.iso.datetime(),
});
export type WebcastSelection = { id: string; name: string; validUntil: string };

const webcastSchema = z.object({
  sourceName: z.string(),
  title: z.string(),
  url: z.url(),
  startsAt: z.string(),
  fetchedAt: z.string(),
  sourcePageUrl: z.url(),
  playback: playbackSchema.optional().catch(undefined),
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

function canPlay(event: Webcast, now: number): boolean {
  if (!event.playback || Date.parse(event.playback.validUntil) <= now) return false;
  const source = new URL(event.url);
  const asset = event.playback.entryId.replace("1_", "k1");
  return (
    source.origin === "https://webtv.un.org" &&
    !source.username &&
    !source.password &&
    source.pathname === `/en/asset/${asset.slice(0, 3)}/${asset}`
  );
}

export function OfficialWebcastList({
  onSelectWebcast,
  onSelectOfficialVideo,
}: {
  onSelectWebcast?: (selection: WebcastSelection) => void;
  onSelectOfficialVideo?: (selection: OfficialPlaybackSelection) => void;
} = {}) {
  const [events, setEvents] = useState<Webcast[]>([]);
  const [error, setError] = useState(false);
  const [now, setNow] = useState(0);
  const [loading, setLoading] = useState<string | null>(null);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const selectionRequest = useRef<AbortController | null>(null);
  useEffect(() => () => selectionRequest.current?.abort(), []);
  async function selectFao(event: Webcast) {
    selectionRequest.current?.abort();
    const controller = new AbortController();
    selectionRequest.current = controller;
    setLoading(event.url);
    setPlaybackError(null);
    try {
      const playback = await loadOfficialPlayback(event.url, controller.signal);
      if (!controller.signal.aborted)
        onSelectOfficialVideo?.({ ...playback, name: event.title });
    } catch {
      if (!controller.signal.aborted) setPlaybackError(event.url);
    } finally {
      if (!controller.signal.aborted) setLoading(null);
    }
  }
  useEffect(() => {
    const controller = new AbortController();
    async function refresh() {
      if (document.hidden) return;
      try {
        setEvents(await loadOfficialWebcasts(controller.signal));
        setNow(Date.now());
        setError(false);
      } catch {
        if (!controller.signal.aborted) {
          setEvents([]);
          setError(true);
        }
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
      <p>播出时间为北京时间；点击已播节目在当前窗口播放，未开始的节目显示预告。</p>
      <p>
        <a
          href="https://webtv.un.org/en/schedule"
          target="_blank"
          rel="noopener noreferrer"
        >
          UN Web TV 官方直播与节目安排 ↗
        </a>
      </p>
      <div className="mi-video-news-list">
        {displayed.map((event) => (
          <article key={event.url} className="mi-video-news-item">
            <small>
              {event.sourceName} · {beijingInstantLabel(event.startsAt)} ·
              {new Date(event.startsAt).getTime() > now ? " 预告" : " 已到播出时间"}
            </small>
            {onSelectWebcast ? (
              onSelectOfficialVideo && isFaoProgrammePage(event.url) ? (
                <button
                  type="button"
                  disabled={loading !== null || Date.parse(event.startsAt) > now}
                  onClick={() => void selectFao(event)}
                >
                  <strong>{event.title}</strong>
                  <span>
                    {Date.parse(event.startsAt) > now
                      ? "尚未开始"
                      : loading === event.url
                        ? "正在加载播放源…"
                        : "在本窗口播放"}
                  </span>
                </button>
              ) : canPlay(event, now) ? (
                <button
                  type="button"
                  onClick={() => {
                    if (canPlay(event, Date.now()) && event.playback)
                      onSelectWebcast({
                        id: event.playback.entryId,
                        name: event.title.slice(0, 300),
                        validUntil: event.playback.validUntil,
                      });
                  }}
                >
                  <strong>{event.title}</strong>
                  <span>
                    在本窗口加载{event.playback?.status === "LIVE" ? "直播" : "回看"}
                  </span>
                </button>
              ) : (
                <div>
                  <strong>{event.title}</strong>
                  <p>暂无有效的站内播放信息</p>
                </div>
              )
            ) : (
              <a href={event.url} target="_blank" rel="noopener noreferrer">
                <strong>{event.title}</strong>
                <span>打开官方直播或回看页 ↗</span>
              </a>
            )}
            {playbackError === event.url && (
              <p role="alert">节目尚未提供播放源或暂不可用，请重试</p>
            )}
            {onSelectWebcast &&
              (!onSelectOfficialVideo || !isFaoProgrammePage(event.url)) && (
                <a
                  href={event.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mi-video-news-source-link"
                >
                  来源节目资料（站外）
                </a>
              )}
            {!onSelectOfficialVideo && (
              <a
                href={event.sourcePageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mi-video-news-source-link"
              >
                查看来源目录 ↗
              </a>
            )}
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
