import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OfficialWebcastList } from "./OfficialWebcastList";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("official webcast schedule", () => {
  it("shows the source event time in Beijing and reloads the official link", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          data: [
            {
              sourceName: "FAO Webcast",
              title: "Grain market webcast",
              url: "https://www.fao.org/webcast/detail/grain-market-event/en",
              startsAt: "2026-09-25T09:30:00Z",
              fetchedAt: "2026-09-27T00:00:00Z",
              sourcePageUrl: "https://www.fao.org/webcast/",
            },
          ],
        }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const first = render(<OfficialWebcastList />);
    expect(
      await screen.findByRole("link", { name: /Grain market webcast/ }),
    ).toHaveAttribute(
      "href",
      "https://www.fao.org/webcast/detail/grain-market-event/en",
    );
    expect(screen.getByText(/2026\/09\/25 17:30 北京时间/)).toBeVisible();
    first.unmount();
    render(<OfficialWebcastList />);
    expect(
      await screen.findByRole("link", { name: /Grain market webcast/ }),
    ).toBeVisible();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
