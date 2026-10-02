import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { VideoNewsList } from "./VideoNewsList";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("persistent official video news", () => {
  it("resolves an official detail page into the current player without external navigation", async () => {
    const url =
      "https://www.fao.org/markets-and-trade/news-and-events/multimedia/video-detail/soco-2026/en";
    const fetchMock = vi.fn().mockImplementation((request: string) =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            data: request.includes("/playback?")
              ? { id: "X4tcMkJQnfI" }
              : [
                  {
                    sourceName: "FAO",
                    title: "SOCO 2026",
                    url,
                    publishedOn: "2026-07-09",
                    fetchedAt: "2026-09-28T00:00:00Z",
                    sourcePageUrl:
                      "https://www.fao.org/markets-and-trade/news-and-events/multimedia/video-detail/en",
                  },
                ],
          }),
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const select = vi.fn();
    render(<VideoNewsList onSelectVideo={select} />);
    fireEvent.click(await screen.findByRole("button", { name: /SOCO 2026/ }));
    await waitFor(() =>
      expect(select).toHaveBeenCalledWith({ id: "X4tcMkJQnfI", name: "SOCO 2026" }),
    );
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      `/api/v1/market-intelligence/news/videos/playback?url=${encodeURIComponent(url)}`,
    );
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("keeps a failed player resolution in the window with a retry button", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((request: string) =>
        Promise.resolve({
          ok: !request.includes("/playback?"),
          status: 502,
          json: () =>
            Promise.resolve({
              data: [
                {
                  sourceName: "FAO",
                  title: "SOCO unavailable",
                  url: "https://www.fao.org/markets-and-trade/news-and-events/multimedia/video-detail/soco/en",
                  publishedOn: "2026-07-09",
                  fetchedAt: "2026-09-28T00:00:00Z",
                  sourcePageUrl:
                    "https://www.fao.org/markets-and-trade/news-and-events/multimedia/video-detail/en",
                },
              ],
            }),
        }),
      ),
    );
    const select = vi.fn();
    render(<VideoNewsList onSelectVideo={select} />);
    fireEvent.click(await screen.findByRole("button", { name: /SOCO unavailable/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "播放源暂不可用，请重试",
    );
    expect(screen.getByRole("button", { name: /SOCO unavailable/ })).toBeEnabled();
    expect(select).not.toHaveBeenCalled();
    expect(screen.queryByRole("link")).toBeNull();
  });
  it("does not offer in-window playback for a directory page", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            data: [
              {
                sourceName: "Publisher",
                title: "Directory only",
                url: "https://example.org/videos",
                publishedOn: "2026-09-28",
                fetchedAt: "2026-09-28T00:00:00Z",
                sourcePageUrl: "https://example.org/videos",
              },
            ],
          }),
      }),
    );
    render(<VideoNewsList onSelectVideo={() => {}} />);
    expect(await screen.findByText("Directory only")).toBeVisible();
    expect(screen.queryByRole("button", { name: /Directory only/ })).toBeNull();
    expect(screen.queryByRole("link", { name: /Directory only/ })).toBeNull();
    expect(screen.getByText("尚无可识别的站内播放源")).toBeVisible();
  });
  it("reloads saved entries on return and links to the publisher's video page", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          data: [
            {
              sourceName: "USDA NASS",
              title: "2022 Census of Agriculture Data Release Event",
              url: "https://www.youtube.com/watch?v=0EY87thoLuo",
              publishedOn: "2024-02-13",
              fetchedAt: "2026-09-27T00:00:00Z",
              sourcePageUrl:
                "https://www.nass.usda.gov/Newsroom/Video_Features/index.php",
            },
          ],
        }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const first = render(<VideoNewsList />);
    const link = await screen.findByRole("link", {
      name: /2022 Census of Agriculture Data Release Event/,
    });
    expect(link).toHaveAttribute("href", "https://www.youtube.com/watch?v=0EY87thoLuo");
    expect(screen.getByRole("link", { name: "查看官方视频目录 ↗" })).toHaveAttribute(
      "href",
      "https://www.nass.usda.gov/Newsroom/Video_Features/index.php",
    );
    expect(screen.getByText(/2024-02-13 · 来源仅提供日期/)).toBeVisible();
    first.unmount();
    render(<VideoNewsList />);
    expect(
      await screen.findByRole("link", {
        name: /2022 Census of Agriculture Data Release Event/,
      }),
    ).toBeVisible();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
