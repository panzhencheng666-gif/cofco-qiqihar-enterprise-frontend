import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LiveNewsPanel, videoIdFromUrl } from "./LiveNewsPanel";

afterEach(() => {
  cleanup();
  localStorage.clear();
  delete window.YT;
  vi.unstubAllGlobals();
});

describe("live video URL gate", () => {
  it("accepts an explicit HTTPS YouTube video without trusting a channel page", () => {
    expect(videoIdFromUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(
      "dQw4w9WgXcQ",
    );
    expect(videoIdFromUrl("https://youtube.com/live/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(videoIdFromUrl("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(videoIdFromUrl("https://www.youtube.com/@channel/live")).toBeNull();
  });

  it("rejects an insecure, unrelated, or disguised host", () => {
    expect(videoIdFromUrl("http://youtube.com/watch?v=dQw4w9WgXcQ")).toBeNull();
    expect(
      videoIdFromUrl("https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ"),
    ).toBeNull();
    expect(videoIdFromUrl("https://example.com/live/dQw4w9WgXcQ")).toBeNull();
  });
});

describe("live video controls", () => {
  it.each([false, true])(
    "restores an official programme with autoplay=%s",
    async (autoplay) => {
      localStorage.setItem("cofco-market-live-autoplay-v1", String(autoplay));
      localStorage.setItem(
        "cofco-market-official-video-v1",
        JSON.stringify({ id: "0EY87thoLuo", name: "官方录像", category: "官方通报" }),
      );
      const loadedIds: string[] = [];
      window.YT = {
        Player: class {
          constructor(_element: HTMLElement, options: { videoId: string }) {
            loadedIds.push(options.videoId);
          }
          playVideo() {}
          pauseVideo() {}
          mute() {}
          unMute() {}
          destroy() {}
        },
      };
      render(<LiveNewsPanel onSelect={() => {}} />);
      if (autoplay) {
        await waitFor(() => expect(loadedIds).toEqual(["0EY87thoLuo"]));
      } else {
        expect(screen.getByText("官方录像 · 点击播放")).toBeVisible();
        expect(screen.getByRole("button", { name: "▶ 播放" })).toBeEnabled();
        expect(loadedIds).toEqual([]);
      }
      fireEvent.click(screen.getByRole("button", { name: "行业媒体" }));
      expect(localStorage.getItem("cofco-market-official-video-v1")).toBeNull();
    },
  );

  it("offers manual playback after autoplay is blocked without claiming playback", async () => {
    localStorage.setItem("cofco-market-live-autoplay-v1", "true");
    localStorage.setItem(
      "cofco-market-live-channels-v1",
      JSON.stringify([{ id: "0EY87thoLuo", name: "官方录像", category: "官方通报" }]),
    );
    let stateChange: ((event: { data: number }) => void) | undefined;
    let playRequests = 0;
    window.YT = {
      Player: class {
        constructor(
          _element: HTMLElement,
          options: {
            events: {
              onReady: () => void;
              onStateChange: (event: { data: number }) => void;
              onAutoplayBlocked?: () => void;
            };
          },
        ) {
          stateChange = options.events.onStateChange;
          options.events.onReady();
          options.events.onAutoplayBlocked?.();
        }
        playVideo() {
          playRequests += 1;
        }
        pauseVideo() {}
        mute() {}
        unMute() {}
        destroy() {}
      },
    };
    render(<LiveNewsPanel onSelect={() => {}} />);
    expect(await screen.findByRole("status")).toHaveTextContent(
      "浏览器阻止了自动播放，请点击播放继续。",
    );
    expect(screen.getByRole("button", { name: "▶ 播放" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "▶ 播放" }));
    expect(playRequests).toBe(1);
    expect(screen.queryByRole("button", { name: "Ⅱ 暂停" })).toBeNull();
    expect(screen.getByRole("status")).toBeVisible();
    act(() => stateChange?.({ data: 1 }));
    expect(screen.getByRole("button", { name: "Ⅱ 暂停" })).toBeEnabled();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it.each(["category", "channel"])(
    "preserves a ready player when reselecting its current %s",
    async (selection) => {
      localStorage.setItem("cofco-market-live-autoplay-v1", "true");
      localStorage.setItem(
        "cofco-market-live-channels-v1",
        JSON.stringify([{ id: "0EY87thoLuo", name: "官方录像", category: "官方通报" }]),
      );
      let constructions = 0;
      window.YT = {
        Player: class {
          constructor(
            _element: HTMLElement,
            options: {
              events: {
                onReady: () => void;
                onStateChange: (event: { data: number }) => void;
              };
            },
          ) {
            constructions += 1;
            options.events.onReady();
            options.events.onStateChange({ data: 1 });
          }
          playVideo() {}
          pauseVideo() {}
          mute() {}
          unMute() {}
          destroy() {}
        },
      };
      render(<LiveNewsPanel onSelect={() => {}} />);
      expect(await screen.findByRole("button", { name: "Ⅱ 暂停" })).toBeEnabled();
      if (selection === "category") {
        fireEvent.click(screen.getByRole("button", { name: "官方通报" }));
      } else {
        fireEvent.click(screen.getByRole("button", { name: "选择节目" }));
        fireEvent.click(screen.getByRole("button", { name: "官方通报 · 官方录像" }));
        expect(screen.queryByRole("dialog", { name: "选择节目" })).toBeNull();
      }
      expect(screen.getByRole("button", { name: "Ⅱ 暂停" })).toBeEnabled();
      expect(screen.getByRole("button", { name: "声音" })).toBeEnabled();
      expect(constructions).toBe(1);
    },
  );

  it("does not start loading an empty category when autoplay is enabled", () => {
    localStorage.setItem("cofco-market-live-autoplay-v1", "true");
    render(<LiveNewsPanel onSelect={() => {}} />);
    for (const category of ["行业媒体", "国际新闻", "官方通报"]) {
      fireEvent.click(screen.getByRole("button", { name: category }));
      expect(screen.queryByRole("button", { name: "载入中" })).toBeNull();
      expect(screen.getByRole("button", { name: "▶ 播放" })).toBeDisabled();
      expect(screen.getByText(`${category}视频源与播放授权待接入`)).toBeVisible();
    }
  });

  it("keeps the ready player usable when autoplay is enabled during playback", async () => {
    localStorage.setItem(
      "cofco-market-live-channels-v1",
      JSON.stringify([{ id: "0EY87thoLuo", name: "官方录像", category: "官方通报" }]),
    );
    let constructions = 0;
    window.YT = {
      Player: class {
        constructor(
          _element: HTMLElement,
          options: {
            events: {
              onReady: () => void;
              onStateChange: (event: { data: number }) => void;
            };
          },
        ) {
          constructions += 1;
          options.events.onReady();
          options.events.onStateChange({ data: 1 });
        }
        playVideo() {}
        pauseVideo() {}
        mute() {}
        unMute() {}
        destroy() {}
      },
    };
    render(<LiveNewsPanel onSelect={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "▶ 播放" }));
    expect(await screen.findByRole("button", { name: "Ⅱ 暂停" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "⚙ 设置" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "选择自动播放" }));
    expect(screen.getByRole("button", { name: "Ⅱ 暂停" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "声音" })).toBeEnabled();
    expect(constructions).toBe(1);
    expect(localStorage.getItem("cofco-market-live-autoplay-v1")).toBe("true");
  });

  it("selects a persisted official video into the main player without opening a publisher link", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            data: [
              {
                sourceName: "USDA NASS",
                title: "Official census recording",
                url: "https://www.youtube.com/watch?v=0EY87thoLuo",
                publishedOn: "2024-02-13",
                fetchedAt: "2026-09-28T00:00:00Z",
                sourcePageUrl:
                  "https://www.nass.usda.gov/Newsroom/Video_Features/index.php",
              },
            ],
          }),
      }),
    );
    const loadedIds: string[] = [];
    window.YT = {
      Player: class {
        constructor(_element: HTMLElement, options: { videoId: string }) {
          loadedIds.push(options.videoId);
        }
        playVideo() {}
        pauseVideo() {}
        mute() {}
        unMute() {}
        destroy() {}
      },
    };
    render(<LiveNewsPanel onSelect={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "选择节目" }));
    fireEvent.click(screen.getByRole("tab", { name: "视频" }));
    fireEvent.click(
      await screen.findByRole("button", { name: /Official census recording/ }),
    );
    expect(screen.queryByRole("dialog", { name: "选择节目" })).toBeNull();
    await waitFor(() => expect(loadedIds).toEqual(["0EY87thoLuo"]));
    expect(localStorage.getItem("cofco-market-live-channels-v1")).toBeNull();
    expect(
      JSON.parse(localStorage.getItem("cofco-market-official-video-v1") ?? "null"),
    ).toEqual({
      id: "0EY87thoLuo",
      name: "Official census recording",
      category: "官方通报",
    });
    cleanup();
    render(<LiveNewsPanel onSelect={() => {}} />);
    expect(screen.getByText("Official census recording · 点击播放")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "⚙ 设置" }));
    fireEvent.change(screen.getByRole("textbox", { name: "视频链接" }), {
      target: { value: "https://youtu.be/VerxO14wiHI" },
    });
    fireEvent.click(screen.getByRole("button", { name: "保存到本机" }));
    fireEvent.click(screen.getByRole("button", { name: "▶ 播放" }));
    await waitFor(() => expect(loadedIds).toEqual(["0EY87thoLuo", "VerxO14wiHI"]));
    expect(localStorage.getItem("cofco-market-official-video-v1")).toBeNull();
  });

  it("keeps the player primary and opens the programme directory only on demand", () => {
    render(<LiveNewsPanel onSelect={() => {}} />);
    expect(screen.queryByRole("region", { name: "官方直播与回看列表" })).toBeNull();
    expect(screen.queryByRole("region", { name: "官方视频新闻列表" })).toBeNull();
    expect(screen.queryByRole("checkbox", { name: "选择自动播放" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "选择节目" }));
    expect(screen.getByRole("dialog", { name: "选择节目" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "关闭节目选择" }));
    expect(screen.queryByRole("dialog", { name: "选择节目" })).toBeNull();
    expect(screen.getByRole("button", { name: "▶ 播放" })).toBeVisible();
  });

  it("persists an opt-in autoplay choice and starts the selected local video", async () => {
    localStorage.setItem(
      "cofco-market-live-channels-v1",
      JSON.stringify([{ id: "dQw4w9WgXcQ", name: "测试视频", category: "官方通报" }]),
    );
    let playerConstructed = false;
    window.YT = {
      Player: class {
        constructor() {
          playerConstructed = true;
        }
        playVideo() {}
        pauseVideo() {}
        mute() {}
        unMute() {}
        destroy() {}
      },
    };

    render(<LiveNewsPanel onSelect={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "⚙ 设置" }));
    const toggle = screen.getByRole("checkbox", { name: "选择自动播放" });
    expect(toggle).not.toBeChecked();

    fireEvent.click(toggle);
    expect(localStorage.getItem("cofco-market-live-autoplay-v1")).toBe("true");
    await waitFor(() => expect(playerConstructed).toBe(true));
  });

  it("clears an old validation error when settings are reopened", () => {
    render(<LiveNewsPanel onSelect={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "⚙ 设置" }));
    fireEvent.change(screen.getByRole("textbox", { name: "视频链接" }), {
      target: { value: "https://example.com/video" },
    });
    fireEvent.click(screen.getByRole("button", { name: "保存到本机" }));
    expect(screen.getByRole("alert")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "关闭直播频道设置" }));
    fireEvent.click(screen.getByRole("button", { name: "⚙ 设置" }));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("changes play and pause status only after the player reports its actual state", async () => {
    localStorage.setItem(
      "cofco-market-live-channels-v1",
      JSON.stringify([{ id: "dQw4w9WgXcQ", name: "测试视频", category: "官方通报" }]),
    );
    const pauseVideo = vi.fn();
    let stateChange: ((event: { data: number }) => void) | undefined;
    window.YT = {
      Player: class {
        constructor(
          _element: HTMLElement,
          options: {
            events: {
              onReady: () => void;
              onStateChange: (event: { data: number }) => void;
            };
          },
        ) {
          stateChange = options.events.onStateChange;
          options.events.onReady();
        }
        playVideo() {}
        pauseVideo = pauseVideo;
        mute() {}
        unMute() {}
        destroy() {}
      },
    };
    render(<LiveNewsPanel onSelect={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "▶ 播放" }));
    await waitFor(() => expect(stateChange).toBeTypeOf("function"));
    expect(screen.getByRole("button", { name: "▶ 播放" })).toBeEnabled();

    stateChange?.({ data: 1 });
    fireEvent.click(await screen.findByRole("button", { name: "Ⅱ 暂停" }));
    expect(pauseVideo).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Ⅱ 暂停" })).toBeVisible();

    stateChange?.({ data: 2 });
    expect(await screen.findByRole("button", { name: "▶ 播放" })).toBeVisible();
  });
});
