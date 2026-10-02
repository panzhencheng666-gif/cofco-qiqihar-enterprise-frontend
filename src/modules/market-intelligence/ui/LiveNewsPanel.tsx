import { useEffect, useRef, useState } from "react";
import { findMetric, type AnalysisTopic } from "./metricCatalog";
import { VideoNewsList } from "./VideoNewsList";
import type { OfficialPlaybackSelection } from "./officialPlayback";
import { OfficialWebcastList, type WebcastSelection } from "./OfficialWebcastList";
import { createUnWebTvPlayer, loadUnWebTvSdk } from "./unWebTvPlayer";
import { videoIdFromUrl } from "./videoPlayback";
export { videoIdFromUrl } from "./videoPlayback";

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
        onAutoplayBlocked: () => void;
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
const autoplayStorageKey = "cofco-market-live-autoplay-v1";
const officialVideoStorageKey = "cofco-market-official-video-v1";

function readOfficialVideo(): Channel | null {
  try {
    const value: unknown = JSON.parse(
      localStorage.getItem(officialVideoStorageKey) ?? "null",
    );
    if (typeof value !== "object" || value === null) return null;
    const record = value as Record<string, unknown>;
    if (
      typeof record.id !== "string" ||
      !/^[A-Za-z0-9_-]{11}$/.test(record.id) ||
      typeof record.name !== "string" ||
      !record.name.trim() ||
      record.name.length > 300 ||
      record.category !== "官方通报"
    )
      return null;
    return { id: record.id, name: record.name, category: "官方通报" };
  } catch {
    return null;
  }
}

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

function readAutoplayPreference(): boolean {
  try {
    return localStorage.getItem(autoplayStorageKey) === "true";
  } catch {
    return false;
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
  const [officialVideo, setOfficialVideo] = useState(readOfficialVideo);
  const [officialWebcast, setOfficialWebcast] = useState<WebcastSelection | null>(null);
  const [officialMedia, setOfficialMedia] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [autoplay, setAutoplay] = useState(readAutoplayPreference);
  const [started, setStarted] = useState(
    () =>
      readAutoplayPreference() &&
      (readOfficialVideo() !== null ||
        readChannels().some((item) => item.category === "官方通报")),
  );
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [playerReady, setPlayerReady] = useState(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [playerError, setPlayerError] = useState("");
  const [playerEpoch, setPlayerEpoch] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [programmesOpen, setProgrammesOpen] = useState(false);
  const [programmeTab, setProgrammeTab] = useState<"频道" | "直播" | "视频">("频道");
  const [videoUrl, setVideoUrl] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [formError, setFormError] = useState("");
  const playerRef = useRef<YouTubePlayer | null>(null);
  const playerSlotRef = useRef<HTMLDivElement>(null);
  const screenRef = useRef<HTMLDivElement>(null);
  const visibleChannels = channels.filter((item) => item.category === category);
  const selected =
    officialMedia ??
    officialWebcast ??
    officialVideo ??
    visibleChannels.find((item) => item.id === selectedId) ??
    visibleChannels[0];
  const selectedVideoId = selected?.id;
  const selectedProvider = officialMedia
    ? "fao"
    : officialWebcast
      ? "un-webtv"
      : "youtube";

  useEffect(() => {
    if (!settingsOpen && !programmesOpen) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSettingsOpen(false);
        setProgrammesOpen(false);
      }
    };
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [settingsOpen, programmesOpen]);

  useEffect(() => {
    if (!started || !selectedVideoId) return;
    const slot = playerSlotRef.current;
    if (!slot) return;
    let cancelled = false;
    const mount = document.createElement("div");
    slot.replaceChildren(mount);
    if (selectedProvider === "fao") {
      const video = document.createElement("video");
      video.className = "mi-live-player";
      video.controls = true;
      video.playsInline = true;
      video.preload = "metadata";
      video.src = selectedVideoId;
      const play = () => {
        void video.play().catch(() => {
          if (!cancelled) {
            setAutoplayBlocked(true);
            setPlaying(false);
          }
        });
      };
      video.addEventListener(
        "canplay",
        () => {
          if (!cancelled) setPlayerReady(true);
        },
        { once: true },
      );
      video.addEventListener("playing", () => {
        if (!cancelled) {
          setPlaying(true);
          setAutoplayBlocked(false);
        }
      });
      for (const event of ["pause", "ended"])
        video.addEventListener(event, () => {
          if (!cancelled) setPlaying(false);
        });
      video.addEventListener("volumechange", () => {
        if (!cancelled) setMuted(video.muted);
      });
      video.addEventListener("error", () => {
        if (!cancelled) {
          setPlayerReady(false);
          setPlaying(false);
          setPlayerError("官方回看暂不可用，请重试。");
        }
      });
      mount.replaceWith(video);
      playerRef.current = {
        playVideo: play,
        pauseVideo: () => video.pause(),
        mute: () => {
          video.muted = true;
        },
        unMute: () => {
          video.muted = false;
        },
        destroy: () => {
          video.pause();
          video.removeAttribute("src");
          video.load();
        },
      };
      play();
      return () => {
        cancelled = true;
        playerRef.current?.destroy();
        playerRef.current = null;
        slot.replaceChildren();
      };
    }
    if (selectedProvider === "un-webtv" && officialWebcast) {
      const fail = (message: string) => {
        if (cancelled) return;
        setPlayerReady(false);
        setPlaying(false);
        setPlayerError(message);
      };
      const remaining = Date.parse(officialWebcast.validUntil) - Date.now();
      if (remaining <= 0) {
        fail("节目播放信息已过期，请重新选择节目。");
        return;
      }
      mount.id = `un-webtv-${crypto.randomUUID()}`;
      mount.className = "mi-live-player";
      void loadUnWebTvSdk()
        .then((api) => {
          if (cancelled) return;
          if (Date.parse(officialWebcast.validUntil) <= Date.now()) {
            fail("节目播放信息已过期，请重新选择节目。");
            return;
          }
          setAutoplayBlocked(false);
          const player = createUnWebTvPlayer(api, mount.id, selectedVideoId, {
            onReady: () => {
              if (cancelled) return;
              setPlayerReady(true);
              player.playVideo();
            },
            onPlaying: (value) => {
              if (cancelled) return;
              setPlaying(value);
              if (value) setAutoplayBlocked(false);
            },
            onMuted: (value) => {
              if (!cancelled) setMuted(value);
            },
            onBlocked: () => {
              if (cancelled) return;
              setAutoplayBlocked(true);
              setPlaying(false);
            },
            onError: () => fail("视频无法播放；请检查来源状态和播放权限。"),
          });
          playerRef.current = player;
        })
        .catch(() => fail("播放器连接失败，请稍后重试。"));
      const expiry = window.setTimeout(
        () => {
          playerRef.current?.destroy();
          playerRef.current = null;
          fail("节目播放信息已过期，请重新选择节目。");
          cancelled = true;
        },
        Math.min(remaining, 2147483647),
      );
      return () => {
        cancelled = true;
        window.clearTimeout(expiry);
        playerRef.current?.destroy();
        playerRef.current = null;
        slot.replaceChildren();
      };
    }
    loadYouTubeApi()
      .then((api) => {
        if (cancelled) return;
        setAutoplayBlocked(false);
        playerRef.current = new api.Player(mount, {
          videoId: selectedVideoId,
          playerVars: { autoplay: 1, origin: window.location.origin, rel: 0 },
          events: {
            onReady: () => {
              if (!cancelled) setPlayerReady(true);
            },
            onStateChange: (event) => {
              if (!cancelled) {
                setPlaying(event.data === 1);
                if (event.data === 1) setAutoplayBlocked(false);
              }
            },
            onAutoplayBlocked: () => {
              if (!cancelled) {
                setAutoplayBlocked(true);
                setPlayerReady(true);
                setPlaying(false);
              }
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
  }, [started, selectedVideoId, playerEpoch, selectedProvider, officialWebcast]);

  function saveChannels(next: Channel[]) {
    setChannels(next);
    localStorage.setItem(storageKey, JSON.stringify(next));
  }

  function rememberOfficialVideo(next: Channel | null) {
    setOfficialMedia(null);
    setOfficialWebcast(null);
    setOfficialVideo(next);
    try {
      if (next) localStorage.setItem(officialVideoStorageKey, JSON.stringify(next));
      else localStorage.removeItem(officialVideoStorageKey);
    } catch {
      // Storage denial must not prevent playback in the current session.
    }
  }

  function selectOfficialVideo(video: OfficialPlaybackSelection) {
    rememberOfficialVideo(
      "id" in video
        ? { ...video, name: video.name.slice(0, 300), category: "官方通报" }
        : null,
    );
    if ("mediaUrl" in video)
      setOfficialMedia({ id: video.mediaUrl, name: video.name.slice(0, 300) });
    setCategory("官方通报");
    setStarted(true);
    setPlaying(false);
    setMuted(false);
    setPlayerReady(false);
    setPlayerError("");
    setAutoplayBlocked(false);
    setPlayerEpoch((value) => value + 1);
    setProgrammesOpen(false);
  }

  function selectCategory(next: Category) {
    if (next === category) return;
    rememberOfficialVideo(null);
    setCategory(next);
    setSelectedId(null);
    setStarted(autoplay && channels.some((item) => item.category === next));
    setPlaying(false);
    setMuted(false);
    setPlayerReady(false);
    setPlayerError("");
  }

  function selectChannel(id: string) {
    if (!officialVideo && selectedVideoId === id) return;
    rememberOfficialVideo(null);
    setSelectedId(id);
    setStarted(autoplay);
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

  function setAutoplayPreference(enabled: boolean) {
    setAutoplay(enabled);
    localStorage.setItem(autoplayStorageKey, String(enabled));
    if (enabled && selectedVideoId && !started) {
      setPlayerError("");
      setPlayerReady(false);
      setPlaying(false);
      setStarted(true);
    }
  }

  function toggleMute() {
    if (!selected || !playerReady || !playerRef.current) return;
    if (muted) playerRef.current.unMute();
    else playerRef.current.mute();
    if (selectedProvider === "youtube") setMuted(!muted);
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
    rememberOfficialVideo(null);
    setSelectedId(id);
    setVideoUrl("");
    setDisplayName("");
    setFormError("");
    setSettingsOpen(false);
    setStarted(autoplay);
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
            <span>新闻视频与直播</span>
            <span aria-hidden="true">↗</span>
          </button>
          <small>
            {channels.length
              ? `${channels.length} 条本机视频配置`
              : "官方视频按源同步 · 站内直播待授权"}
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
            <button type="button" onClick={() => setProgrammesOpen(true)}>
              选择节目
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
          <div ref={screenRef} className="mi-live-screen">
            {selected && started ? (
              <div key="player" ref={playerSlotRef} className="mi-live-player" />
            ) : (
              <div key="empty" className="mi-live-empty">
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
            {selected &&
              started &&
              playerReady &&
              !playing &&
              !playerError &&
              !autoplayBlocked && <span className="mi-live-paused">已暂停</span>}
          </div>
          {selected && started && autoplayBlocked && !playerError && (
            <p role="status">浏览器阻止了自动播放，请点击播放继续。</p>
          )}
          <p className="mi-live-footnote">
            栏目筛选和视频控制仅作用于播放器；新闻与指标由服务端独立采集。自定义链接只保存在本机，播放时才连接视频平台。
          </p>
        </div>
      </section>
      {programmesOpen && (
        <div
          className="mi-live-settings-backdrop"
          role="presentation"
          onClick={() => setProgrammesOpen(false)}
        >
          <section
            className="mi-live-settings"
            role="dialog"
            aria-modal="true"
            aria-label="选择节目"
            onClick={(event) => event.stopPropagation()}
          >
            <header>
              <h2>选择节目</h2>
              <button
                type="button"
                aria-label="关闭节目选择"
                onClick={() => setProgrammesOpen(false)}
              >
                ×
              </button>
            </header>
            <div role="tablist" aria-label="节目类型">
              {(["频道", "直播", "视频"] as const).map((tab) => (
                <button
                  type="button"
                  key={tab}
                  role="tab"
                  aria-selected={programmeTab === tab}
                  onClick={() => setProgrammeTab(tab)}
                >
                  {tab}
                </button>
              ))}
            </div>
            <div role="tabpanel" aria-label={programmeTab}>
              {programmeTab === "直播" && (
                <OfficialWebcastList
                  onSelectOfficialVideo={selectOfficialVideo}
                  onSelectWebcast={(programme) => {
                    rememberOfficialVideo(null);
                    setOfficialWebcast(programme);
                    setCategory("官方通报");
                    setStarted(true);
                    setPlaying(false);
                    setMuted(false);
                    setPlayerReady(false);
                    setPlayerError("");
                    setAutoplayBlocked(false);
                    setPlayerEpoch((value) => value + 1);
                    setProgrammesOpen(false);
                  }}
                />
              )}
              {programmeTab === "视频" && (
                <VideoNewsList onSelectVideo={selectOfficialVideo} />
              )}
              {programmeTab === "频道" && (
                <div className="mi-live-channels" role="group" aria-label="已配置视频">
                  {channels.length === 0 && <p>尚未配置可播放频道。</p>}
                  {channels.map((item) => (
                    <button
                      type="button"
                      key={item.id}
                      aria-pressed={selected?.id === item.id}
                      onClick={() => {
                        selectCategory(item.category);
                        selectChannel(item.id);
                        setProgrammesOpen(false);
                      }}
                    >
                      {item.category} · {item.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      )}
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
            <label title="仅对已配置且有权观看的视频生效">
              <input
                type="checkbox"
                checked={autoplay}
                onChange={(event) => setAutoplayPreference(event.target.checked)}
              />
              选择自动播放
            </label>
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
