import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LiveNewsPanel } from "./LiveNewsPanel";
import { OfficialWebcastList } from "./OfficialWebcastList";

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

function programmes(playbackOverrides = {}) {
  return ["1_kfcwu5kc", "1_66cn2v34"].map((entryId, index) => ({
    sourceName: "UN Web TV",
    title: `Test programme ${index + 1}`,
    url:
      index === 0
        ? "https://webtv.un.org/en/asset/k1k/k1kfcwu5kc"
        : "https://webtv.un.org/en/asset/k16/k166cn2v34",
    sourcePageUrl: "https://webtv.un.org/en/schedule",
    startsAt: "2026-09-28T09:00:00Z",
    fetchedAt: new Date().toISOString(),
    playback: {
      provider: "un-webtv",
      entryId,
      admission: "APPROVED",
      status: "LIVE",
      validUntil: new Date(Date.now() + 60000).toISOString(),
      ...playbackOverrides,
    },
  }));
}

function catalogue(data: unknown[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ data }) }),
  );
  render(<LiveNewsPanel onSelect={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "选择节目" }));
  fireEvent.click(screen.getByRole("tab", { name: "直播" }));
}

describe("admitted official live programme selection", () => {
  it.each([401, 403, 503, "network"])(
    "withdraws cached playback when catalogue refresh fails with %s",
    async (failure) => {
      const request = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: programmes() }),
      });
      if (failure === "network") request.mockRejectedValue(new Error("offline"));
      else request.mockResolvedValue({ ok: false, status: failure });
      vi.stubGlobal("fetch", request);
      const onSelect = vi.fn();
      render(<OfficialWebcastList onSelectWebcast={onSelect} />);
      await screen.findByRole("button", { name: /Test programme 1/ });
      fireEvent(document, new Event("visibilitychange"));
      await screen.findByText("直播目录接口暂不可用");
      expect(
        screen.queryByRole("button", { name: /Test programme/ }),
      ).not.toBeInTheDocument();
      expect(onSelect).not.toHaveBeenCalled();
      expect(
        screen.getByRole("link", { name: /UN Web TV 官方直播与节目安排/ }),
      ).toBeInTheDocument();
    },
  );
  it("loads two selected entries into the same panel and controls SDK state", async () => {
    const instances: Array<{
      play: ReturnType<typeof vi.fn>;
      destroy: ReturnType<typeof vi.fn>;
      loadMedia: ReturnType<typeof vi.fn>;
      muted: boolean;
      events: EventTarget;
      target: HTMLElement | null;
    }> = [];
    const setup = vi.fn((config: { targetId: string }) => {
      const events = new EventTarget();
      const player = {
        target: document.getElementById(config.targetId),
        events,
        muted: false,
        play: vi.fn(() => {
          events.dispatchEvent(new Event("playing"));
        }),
        pause: vi.fn(),
        destroy: vi.fn(),
        loadMedia: vi.fn(async () => {}),
        ready: async () => {},
        addEventListener: events.addEventListener.bind(events),
        removeEventListener: events.removeEventListener.bind(events),
      };
      instances.push(player);
      return player;
    });
    vi.stubGlobal("KalturaPlayer", { setup });
    catalogue(programmes());
    fireEvent.click(await screen.findByRole("button", { name: /Test programme 1/ }));
    await waitFor(() => expect(setup).toHaveBeenCalledOnce());
    expect(instances[0]!.target).toHaveClass("mi-live-player");
    expect(screen.queryByRole("dialog", { name: "选择节目" })).not.toBeInTheDocument();
    await screen.findByRole("button", { name: /暂停/ });
    fireEvent.click(screen.getByRole("button", { name: "声音" }));
    expect(instances[0]!.muted).toBe(true);
    await act(() => instances[0]!.events.dispatchEvent(new Event("volumechange")));
    expect(screen.getByRole("button", { name: "静音中" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "选择节目" }));
    fireEvent.click(await screen.findByRole("button", { name: /Test programme 2/ }));
    await waitFor(() => expect(setup).toHaveBeenCalledTimes(2));
    expect(instances[0]!.destroy).toHaveBeenCalledOnce();
    expect(instances[1]!.loadMedia).toHaveBeenCalledWith({
      entryId: "1_66cn2v34",
    });
    fireEvent.click(screen.getByRole("button", { name: "国际新闻" }));
    expect(instances[1]!.destroy).toHaveBeenCalledOnce();
  });

  it.each([
    { admission: "PENDING" },
    { validUntil: "2000-01-01T00:00:00Z" },
    { provider: "other" },
    { entryId: "https://evil.example/video" },
    { status: "UNAVAILABLE" },
  ])(
    "does not expose playback for unadmitted or expired metadata %j",
    async (overrides) => {
      const setup = vi.fn();
      vi.stubGlobal("KalturaPlayer", { setup });
      catalogue(programmes(overrides));
      await screen.findByText("Test programme 1");
      expect(
        screen.queryByRole("button", { name: /Test programme/ }),
      ).not.toBeInTheDocument();
      expect(setup).not.toHaveBeenCalled();
    },
  );

  it("does not trust playback metadata on a non-official source URL", async () => {
    const data = programmes();
    data[0]!.url = "https://webtv.un.org.evil.example/video";
    catalogue([data[0]]);
    await screen.findByText("Test programme 1");
    expect(
      screen.queryByRole("button", { name: /Test programme/ }),
    ).not.toBeInTheDocument();
  });

  it("rejects an entry ID that belongs to a different official programme", async () => {
    const data = programmes();
    data[0]!.playback.entryId = data[1]!.playback.entryId;
    catalogue([data[0]]);
    await screen.findByText("Test programme 1");
    expect(
      screen.queryByRole("button", { name: /Test programme/ }),
    ).not.toBeInTheDocument();
  });

  it("keeps a clearly attributed programme reference without pretending it plays in-app", async () => {
    const item = { ...programmes()[0]!, playback: undefined };
    catalogue([item]);
    expect(
      await screen.findByRole("link", { name: "来源节目资料（站外）" }),
    ).toHaveAttribute("href", item.url);
    expect(
      screen.queryByRole("button", { name: /Test programme/ }),
    ).not.toBeInTheDocument();
  });
});
