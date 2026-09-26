import { useEffect, useRef, useState } from "react";
import { findMetric, type AnalysisTopic } from "./metricCatalog";

type PlayerStateEvent = { data: number };
type YouTubePlayer = {
  playVideo: () => void;
  pauseVideo: () => void;
  mute: () => void;
  unMute: () => void;
  destroy: () => void;
};
type YouTubeApi = {
  Player: new (
    element: HTMLElement,
    options: {
      videoId: string;
      playerVars: { autoplay: number; origin: string; rel: number };
      events: {
        onReady: () => void;
        onStateChange: (event: PlayerStateEvent) => void;
        onError: () => void;
      };
    },
  ) => YouTubePlayer;
};

declare global {
  interface Window {
    YT?: YouTubeApi;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let youtubeApiPromise: Promise<YouTubeApi> | null = null;

function loadYouTubeApi(): Promise<YouTubeApi> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (youtubeApiPromise) return youtubeApiPromise;
  youtubeApiPromise = new Promise<YouTubeApi>((resolve, reject) => {
    const priorReady = window.onYouTubeIframeAPIReady;
    const script = document.createElement("script");
    const timeout = window.setTimeout(() => fail(), 12000);
    let settled = false;
    function restoreReady() {
      if (priorReady) window.onYouTubeIframeAPIReady = priorReady;
      else delete window.onYouTubeIframeAPIReady;
    }
    function fail() {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      restoreReady();
      script.remove();
      youtubeApiPromise = null;
      reject(new Error("YouTube player API unavailable"));
    }
    window.onYouTubeIframeAPIReady = () => {
      priorReady?.();
      if (!window.YT?.Player) return fail();
      settled = true;
      window.clearTimeout(timeout);
      restoreReady();
      resolve(window.YT);
    };
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.onerror = fail;
    document.head.appendChild(script);
  });
  return youtubeApiPromise;
}

const categories = ["官方通报", "行业媒体", "国际新闻"] as const;
type Category = (typeof categories)[number];
type Channel = { id: string; name: string; category: Category };
const storageKey = "cofco-market-live-channels-v1";

function readChannels(): Channel[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(storageKey) ?? "[]");
    if (!Array.isArray(value)) return [];
    return (value as unknown[])
      .filter((item): item is Channel => {
        if (typeof item !== "object" || item === null) return false;
        const record = item as Record<string, unknown>;
        return (
          typeof record.id === "string" &&
          /^[A-Za-z0-9_-]{11}$/.test(record.id) &&
          typeof record.name === "string" &&
          record.name.length <= 60 &&
          categories.includes(record.category as Category)
        );
      })
      .slice(0, 20);
  } catch {
    return [];
  }
}

export function videoIdFromUrl(value: string): string | null {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:") return null;
    const host = url.hostname.toLowerCase();
    let id: string | null = null;
    if (host === "youtu.be") id = url.pathname.split("/")[1] ?? null;
    if (["youtube.com", "www.youtube.com", "m.youtube.com"].includes(host)) {
      if (url.pathname === "/watch") id = url.searchParams.get("v");
      else if (url.pathname.startsWith("/live/"))
        id = url.pathname.split("/")[2] ?? null;
    }
    return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

export function LiveNewsPanel({
  onSelect,
}: {
  onSelect: (topic: AnalysisTopic) => void;
}) {
  const [category, setCategory] = useState<Category>("官方通报");
  const [channels, setChannels] = useState(readChannels);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [started, setStarted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [playerReady, setPlayerReady] = useState(false);
  const [playerError, setPlayerError] = useState("");
  const [playerEpoch, setPlayerEpoch] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [videoUrl, setVideoUrl] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [formError, setFormError] = useState("");
  const playerRef = useRef<YouTubePlayer | null>(null);
  const playerSlotRef = useRef<HTMLDivElement>(null);
  const screenRef = useRef<HTMLDivElement>(null);
  const visibleChannels = channels.filter((item) => item.category === category);
  const selected =
    visibleChannels.find((item) => item.id === selectedId) ?? visibleChannels[0];
  const selectedVideoId = selected?.id;

  useEffect(() => {
    if (!settingsOpen) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSettingsOpen(false);
    };
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [settingsOpen]);

  useEffect(() => {
    if (!started || !selectedVideoId) return;
    const slot = playerSlotRef.current;
    if (!slot) return;
    let cancelled = false;
    const mount = document.createElement("div");
    slot.replaceChildren(mount);
    loadYouTubeApi()
      .then((api) => {
        if (cancelled) return;
        playerRef.current = new api.Player(mount, {
          videoId: selectedVideoId,
          playerVars: { autoplay: 1, origin: window.location.origin, rel: 0 },
          events: {
            onReady: () => {
              if (!cancelled) setPlayerReady(true);
            },
            onStateChange: (event) => {
              if (!cancelled) setPlaying(event.data === 1);
            },
            onError: () => {
              if (!cancelled) {
                setPlayerError("视频无法播放；请检查链接和播放权限。");
                setPlaying(false);
              }
            },
          },
        });
      })
      .catch(() => {
        if (!cancelled) setPlayerError("播放器连接失败，请稍后重试。");
      });
    return () => {
      cancelled = true;
      playerRef.current?.destroy();
      playerRef.current = null;
      slot.replaceChildren();
    };
  }, [started, selectedVideoId, playerEpoch]);

  function saveChannels(next: Channel[]) {
    setChannels(next);
    localStorage.setItem(storageKey, JSON.stringify(next));
  }

  function selectCategory(next: Category) {
    setCategory(next);
    setSelectedId(null);
    setStarted(false);
    setPlaying(false);
    setMuted(false);
    setPlayerReady(false);
    setPlayerError("");
  }

  function selectChannel(id: string) {
    setSelectedId(id);
    setStarted(false);
    setPlaying(false);
    setMuted(false);
    setPlayerReady(false);
    setPlayerError("");
  }

  function togglePlayback() {
    if (!selected) return;
    if (!started) {
      setStarted(true);
      return;
    }
    if (playerError) {
      setPlayerError("");
      setPlayerReady(false);
      setPlaying(false);
      setPlayerEpoch((value) => value + 1);
      return;
    }
    if (!playerReady) return;
    if (playing) playerRef.current?.pauseVideo();
    else playerRef.current?.playVideo();
  }

  function toggleMute() {
    if (!selected || !playerReady || !playerRef.current) return;
    if (muted) playerRef.current.unMute();
    else playerRef.current.mute();
    setMuted(!muted);
  }

  function addChannel() {
    const id = videoIdFromUrl(videoUrl);
    if (!id) {
      setFormError(
        "请输入 HTTPS YouTube 视频或 /live/ 链接；频道主页无法确定当前直播视频。",
      );
      return;
    }
    if (channels.some((item) => item.id === id)) {
      setFormError("这条视频已在频道列表中。");
      return;
    }
    if (channels.length >= 20) {
      setFormError("本机最多保存 20 条视频，请先移除旧条目。");
      return;
    }
    const next: Channel = {
      id,
      name: displayName.trim().slice(0, 60) || `视频 ${id}`,
      category,
    };
    saveChannels([...channels, next]);
    setSelectedId(id);
    setVideoUrl("");
    setDisplayName("");
    setFormError("");
    setSettingsOpen(false);
    setStarted(false);
    setPlaying(false);
    setPlayerReady(false);
    setPlayerError("");
  }

  function removeChannel(id: string) {
    saveChannels(channels.filter((item) => item.id !== id));
    if (selectedId === id) {
      setSelectedId(null);
      setStarted(false);
      setPlaying(false);
      setPlayerReady(false);
      setPlayerError("");
    }
  }

  return (
    <div className="mi-overview-live">
      <section className="mi-overview-panel wide mi-live-panel" aria-label="新闻直播">
        <header>
          <button
            type="button"
            onClick={() => onSelect(findMetric("新闻直播", "实时事件"))}
            aria-label="进入新闻直播分析工作台"
            title="打开新闻直播的独立分析界面"
          >
            <span>新闻直播</span>
            <span aria-hidden="true">↗</span>
          </button>
          <small>
            {channels.length
              ? `${channels.length} 条本机视频配置`
              : "视频源与授权待接入"}
          </small>
        </header>
        <div className="mi-overview-body">
          <div className="mi-live-toolbar" aria-label="直播控制">
            <button
              type="button"
              onClick={togglePlayback}
              disabled={!selected || (started && !playerReady && !playerError)}
              title={
                selected ? "播放或暂停当前视频" : "先在设置中添加有播放权的视频链接"
              }
            >
              {playerError
                ? "↻ 重试"
                : started && !playerReady
                  ? "载入中"
                  : playing
                    ? "Ⅱ 暂停"
                    : "▶ 播放"}
            </button>
            <button
              type="button"
              onClick={toggleMute}
              disabled={!playerReady}
              title="切换当前视频静音状态"
            >
              {muted ? "静音中" : "声音"}
            </button>
            <button
              type="button"
              onClick={() => void screenRef.current?.requestFullscreen()}
              disabled={!playerReady}
              title="将当前视频区域放大到全屏"
            >
              全屏
            </button>
            <button
              type="button"
              onClick={() => {
                setFormError("");
                setSettingsOpen(true);
              }}
              title="管理本机视频链接与栏目"
            >
              ⚙ 设置
            </button>
          </div>
          <div className="mi-live-sources" role="group" aria-label="直播栏目">
            {categories.map((item) => (
              <button
                type="button"
                key={item}
                aria-pressed={category === item}
                onClick={() => selectCategory(item)}
                title={`筛选${item}栏目的视频`}
              >
                {item}
              </button>
            ))}
          </div>
          {visibleChannels.length > 0 && (
            <div className="mi-live-channels" role="group" aria-label="已配置视频">
              {visibleChannels.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  aria-pressed={selected?.id === item.id}
                  onClick={() => selectChannel(item.id)}
                  title={`选择${item.name}`}
                >
                  {item.name}
                </button>
              ))}
            </div>
          )}
          <div ref={screenRef} className="mi-live-screen">
            {selected && started ? (
              <div ref={playerSlotRef} className="mi-live-player" />
            ) : (
              <div className="mi-live-empty">
                <span className="mi-live-pulse" />
                {selected
                  ? `${selected.name} · 点击播放`
                  : `${category}视频源与播放授权待接入`}
              </div>
            )}
            {playerError && (
              <span className="mi-live-paused" role="alert">
                {playerError}
              </span>
            )}
            {selected && started && playerReady && !playing && !playerError && (
              <span className="mi-live-paused">已暂停</span>
            )}
          </div>
          <p className="mi-live-footnote">
            栏目筛选和视频控制仅作用于播放器；新闻与指标由服务端独立采集。自定义链接只保存在本机，播放时才连接视频平台。
          </p>
        </div>
      </section>
      {settingsOpen && (
        <div
          className="mi-live-settings-backdrop"
          role="presentation"
          onClick={() => setSettingsOpen(false)}
        >
          <section
            className="mi-live-settings"
            role="dialog"
            aria-modal="true"
            aria-label="直播频道设置"
            onClick={(event) => event.stopPropagation()}
          >
            <header>
              <h2>直播频道设置</h2>
              <button
                type="button"
                onClick={() => setSettingsOpen(false)}
                aria-label="关闭直播频道设置"
              >
                ×
              </button>
            </header>
            <p>
              官方直播目录和播放授权尚未接入。可添加你有权观看的 YouTube
              视频链接作本机预览；这不会成为系统新闻数据源，也不保证该视频正在直播。
            </p>
            <div className="mi-live-settings-list">
              {channels.length === 0 && <span>本机尚无视频配置</span>}
              {channels.map((item) => (
                <div key={item.id}>
                  <span>
                    {item.category} · {item.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeChannel(item.id)}
                    aria-label={`移除${item.name}`}
                  >
                    移除
                  </button>
                </div>
              ))}
            </div>
            <label>
              视频链接
              <input
                type="url"
                value={videoUrl}
                onChange={(event) => setVideoUrl(event.target.value)}
                placeholder="https://www.youtube.com/live/…"
              />
            </label>
            <label>
              显示名称
              <input
                value={displayName}
                maxLength={60}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="可选"
              />
            </label>
            <label>
              归入栏目
              <select
                value={category}
                onChange={(event) => selectCategory(event.target.value as Category)}
              >
                {categories.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
            {formError && (
              <p role="alert" className="mi-live-settings-error">
                {formError}
              </p>
            )}
            <button type="button" className="mi-live-settings-add" onClick={addChannel}>
              保存到本机
            </button>
          </section>
        </div>
      )}
    </div>
  );
}
