import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LiveNewsPanel, videoIdFromUrl } from "./LiveNewsPanel";

afterEach(() => {
  cleanup();
  localStorage.clear();
  delete window.YT;
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
