import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { SourceSyncRail } from "./SourceSyncRail";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("keeps an older publication date distinct from the latest successful collection", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          data: [
            {
              code: "moa-department-news",
              name: "农业农村部动态",
              cadence: "2 分钟轮询",
              lastAttemptAt: "2026-10-02T03:47:00Z",
              lastSuccessAt: "2026-10-02T03:46:00Z",
              latestPublishedOn: "2026-09-30",
              lastError: "IOException",
            },
          ],
        }),
    }),
  );
  render(<SourceSyncRail />);
  expect(
    await screen.findByText(/上次成功采集 2026\/10\/02 11:46 北京时间/),
  ).toBeVisible();
  expect(screen.getByText("源发布日期 2026-09-30")).toBeVisible();
  expect(screen.getByText("最近采集失败")).toBeVisible();
});
