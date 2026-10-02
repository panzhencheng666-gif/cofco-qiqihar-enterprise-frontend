import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { NewsDiscoveryRail } from "./NewsDiscoveryRail";

const item = {
  sourceHost: "news.example",
  title: "Wheat harvest update",
  url: "https://news.example/grain",
  publishedAt: null,
  publishedOn: "2026-09-28",
  publicationPrecision: "DATE",
  reviewedAt: "2026-09-28T16:00:00Z",
};
const snapshot = {
  state: "CONFIGURED",
  searchState: "CANDIDATES",
  lastSearchCompletedAt: "2026-09-28T16:00:00Z",
  observedAt: "2026-09-28T16:01:00Z",
  items: [item],
};
function response(data: unknown, ok = true) {
  return { ok, status: ok ? 200 : 503, json: () => Promise.resolve({ data }) };
}
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it("renders source date without pretending it is a Beijing instant", async () => {
  const fetcher = vi.fn().mockResolvedValue(response(snapshot));
  vi.stubGlobal("fetch", fetcher);
  render(<NewsDiscoveryRail />);
  expect(
    await screen.findByRole("link", { name: /Wheat harvest update/ }),
  ).toHaveAttribute("href", item.url);
  expect(screen.getByText(/2026-09-28 · 来源仅提供日期/)).toBeVisible();
  expect(screen.getByText(/找到候选，不代表全部通过审核/)).toBeVisible();
  expect(fetcher).toHaveBeenCalledWith(
    "/api/v1/market-intelligence/news/discovery",
    expect.objectContaining({ cache: "no-store", credentials: "same-origin" }),
  );
});
it("distinguishes disabled from successful empty search", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      response({
        ...snapshot,
        state: "DISABLED",
        searchState: "NOT_EVALUATED",
        items: [],
      }),
    ),
  );
  render(<NewsDiscoveryRail />);
  expect(await screen.findByText("公开网络发现未启用")).toBeVisible();
  expect(screen.queryByText(/采集成功/)).not.toBeInTheDocument();
});
it("explains a spent search budget and candidates waiting for source approval", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      response({
        ...snapshot,
        searchState: "FAILED",
        searchReason: "BUDGET_CLOSED",
        nextSearchAt: "2026-09-29T00:00:00Z",
        pendingReviewCount: 49,
        awaitingSourceCount: 49,
        items: [],
      }),
    ),
  );
  render(<NewsDiscoveryRail />);
  expect(await screen.findByText(/搜索额度已用尽或授权已到期/)).toBeVisible();
  expect(screen.getByText(/49 条新闻等待核验，其中 49 条等待来源准入/)).toBeVisible();
  expect(screen.queryByText(/最近搜索失败/)).not.toBeInTheDocument();
  expect(screen.queryByText(/下次搜索/)).not.toBeInTheDocument();
});
it("shows the next scheduled search separately from the last completed search", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      response({
        ...snapshot,
        searchReason: "CANDIDATES",
        nextSearchAt: "2026-09-28T16:05:00Z",
        pendingReviewCount: 1,
        awaitingSourceCount: 0,
      }),
    ),
  );
  render(<NewsDiscoveryRail />);
  expect(await screen.findByText(/下次搜索 2026\/09\/29 00:05 北京时间/)).toBeVisible();
});
it("labels expired search and retained verified history", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(response({ ...snapshot, state: "EXPIRED" })),
  );
  render(<NewsDiscoveryRail />);
  expect(await screen.findByText(/搜索授权窗口已结束/)).toBeVisible();
  expect(screen.getByRole("link", { name: /Wheat harvest update/ })).toBeVisible();
});
it("refresh button fetches again and removes prior items on failure", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(response(snapshot))
    .mockResolvedValue(response(null, false));
  vi.stubGlobal("fetch", fetcher);
  render(<NewsDiscoveryRail />);
  await screen.findByRole("link", { name: /Wheat harvest update/ });
  fireEvent.click(screen.getByRole("button", { name: "刷新发现结果" }));
  expect(await screen.findByText("发现接口暂不可用")).toBeVisible();
  expect(
    screen.queryByRole("link", { name: /Wheat harvest update/ }),
  ).not.toBeInTheDocument();
  expect(fetcher).toHaveBeenCalledTimes(2);
});
it("rejects unsafe links", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        response({ ...snapshot, items: [{ ...item, url: "javascript:alert(1)" }] }),
      ),
  );
  render(<NewsDiscoveryRail />);
  expect(await screen.findByText("发现接口暂不可用")).toBeVisible();
  expect(screen.queryByRole("link")).not.toBeInTheDocument();
});
it("formats precise publication time in Beijing time", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      response({
        ...snapshot,
        items: [
          {
            ...item,
            publicationPrecision: "INSTANT",
            publishedAt: "2026-09-27T18:00:00Z",
          },
        ],
      }),
    ),
  );
  render(<NewsDiscoveryRail />);
  expect(await screen.findByText(/2026\/09\/28 02:00 北京时间/)).toBeVisible();
});
it("polls again after thirty seconds and aborts on unmount", async () => {
  vi.useFakeTimers();
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(response(snapshot))
    .mockResolvedValue(
      response({ ...snapshot, items: [{ ...item, title: "New grain update" }] }),
    );
  vi.stubGlobal("fetch", fetcher);
  const view = render(<NewsDiscoveryRail />);
  await act(async () => {
    await Promise.resolve();
  });
  expect(fetcher).toHaveBeenCalledTimes(1);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(30_000);
  });
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(screen.getByRole("link", { name: /New grain update/ })).toBeVisible();
  expect(
    screen.queryByRole("link", { name: /Wheat harvest update/ }),
  ).not.toBeInTheDocument();
  view.unmount();
  await vi.advanceTimersByTimeAsync(30_000);
  expect(fetcher).toHaveBeenCalledTimes(2);
});
it("cleans up an in-flight request instead of writing after unmount", () => {
  const fetcher = vi.fn().mockReturnValue(new Promise(() => {}));
  vi.stubGlobal("fetch", fetcher);
  const view = render(<NewsDiscoveryRail />);
  expect(fetcher).toHaveBeenCalledTimes(1);
  const options = fetcher.mock.calls[0]?.[1] as RequestInit | undefined;
  view.unmount();
  expect(options?.signal?.aborted).toBe(true);
});
it("rejects an instant whose Beijing date disagrees with the response", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      response({
        ...snapshot,
        items: [
          {
            ...item,
            publicationPrecision: "INSTANT",
            publishedAt: "2026-09-26T18:00:00Z",
          },
        ],
      }),
    ),
  );
  render(<NewsDiscoveryRail />);
  expect(await screen.findByText("发现接口暂不可用")).toBeVisible();
});
it("times out a stalled fetch and permits a subsequent refresh", async () => {
  vi.useFakeTimers();
  vi.stubGlobal(
    "fetch",
    vi.fn(
      (_url, options: RequestInit) =>
        new Promise((_resolve, reject) => {
          options.signal?.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError")),
          );
        }),
    ),
  );
  render(<NewsDiscoveryRail />);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(12_000);
  });
  expect(screen.getByText("发现接口暂不可用")).toBeVisible();
  expect(screen.getByRole("button", { name: "刷新发现结果" })).toBeEnabled();
});
