import { useEffect, useState } from "react";
import { z } from "zod";
import { videoIdFromUrl } from "./videoPlayback";

const videoSchema = z.object({
  sourceName: z.string(),
  title: z.string(),
  url: z.url(),
  publishedOn: z.iso.date(),
  fetchedAt: z.string(),
  sourcePageUrl: z.url(),
});
type Video = z.infer<typeof videoSchema>;

export async function loadVideoNews(signal?: AbortSignal): Promise<Video[]> {
  const response = await fetch("/api/v1/market-intelligence/news/videos", {
    credentials: "same-origin",
    cache: "no-store",
    signal: signal ?? null,
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return z.object({ data: z.array(videoSchema) }).parse(await response.json()).data;
}

export function VideoNewsList({
  onSelectVideo,
}: {
  onSelectVideo?: (video: { id: string; name: string }) => void;
}) {
  const [videos, setVideos] = useState<Video[]>([]);
  const [error, setError] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    async function refresh() {
      if (document.hidden) return;
      try {
        setVideos(await loadVideoNews(controller.signal));
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

  return (
    <section className="mi-video-news" aria-label="官方视频新闻列表">
      <header>
        <strong>官方视频新闻</strong>
        <span>{error ? "接口暂不可用" : `${videos.length} 条已保存 · 按源更新`}</span>
      </header>
      <p>
        {onSelectVideo
          ? "发布日期由来源页面提供；选择视频将在本窗口请求官方播放器，能否播放以平台返回为准。录像不代表正在直播。"
          : "发布日期由来源页面提供；点击后在发布方平台观看。直播节目与站内播放授权尚待核实。"}
      </p>
      <div className="mi-video-news-list">
        {videos.map((video) => (
          <article key={video.url} className="mi-video-news-item">
            <small>
              {video.sourceName} · {video.publishedOn} · 来源仅提供日期
            </small>
            {onSelectVideo ? (
              videoIdFromUrl(video.url) ? (
                <button
                  type="button"
                  onClick={() => {
                    const id = videoIdFromUrl(video.url);
                    if (id) onSelectVideo({ id, name: video.title });
                  }}
                >
                  <strong>{video.title}</strong>
                  <span>在本窗口加载视频</span>
                </button>
              ) : (
                <div>
                  <strong>{video.title}</strong>
                  <p>尚无可识别的站内播放源</p>
                </div>
              )
            ) : (
              <a href={video.url} target="_blank" rel="noopener noreferrer">
                <strong>{video.title}</strong>
                <span>前往发布方视频页观看 ↗</span>
              </a>
            )}
            <a
              href={video.sourcePageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mi-video-news-source-link"
            >
              查看官方视频目录 ↗
            </a>
          </article>
        ))}
        {videos.length === 0 && (
          <span className="mi-news-pending">
            {error ? "视频新闻接口暂不可用" : "等待官方视频目录首次同步"}
          </span>
        )}
      </div>
    </section>
  );
}
