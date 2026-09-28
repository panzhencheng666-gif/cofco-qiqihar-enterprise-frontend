import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { VideoNewsList } from "./VideoNewsList";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("persistent official video news", () => {
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
