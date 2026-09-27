import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { RosarioSpotRail } from "./RosarioSpotRail";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("shows the source publication date rather than the API fetch date", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            status: "PUBLISHED_DATA",
            sourceDate: "2026-09-24",
            fetchedAt: "2026-09-27T17:58:27Z",
            lastAttemptAt: "2026-09-27T17:58:20Z",
            sourceName: "granos.ar",
            sourceUrl: "https://granosar.lfcaucino.workers.dev/api/v1/pizarra",
            attribution: "granos.ar · Rosario CAC/BCR",
            market: "阿根廷罗萨里奥现货参考价",
            unit: "ARS/吨",
            observations: [{ crop: "maiz", name: "玉米", arsPerTonne: 296000 }],
            lastError: null,
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    ),
  );
  render(<RosarioSpotRail />);
  expect(await screen.findByText(/来源日期 2026-09-24/)).toBeVisible();
  expect(screen.getByText("296,000")).toBeVisible();
  expect(screen.getByText(/非交易所实时期货行情/)).toBeVisible();
  expect(screen.queryByText(/来源日期 2026-09-27/)).toBeNull();
});

it("labels retained data as cached when the upstream source is unavailable", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            status: "SOURCE_UNAVAILABLE",
            sourceDate: "2026-09-24",
            fetchedAt: "2026-09-25T12:00:00Z",
            lastAttemptAt: "2026-09-27T17:58:20Z",
            sourceName: "granos.ar",
            sourceUrl: "https://granosar.lfcaucino.workers.dev/api/v1/pizarra",
            attribution: "granos.ar · Rosario CAC/BCR",
            market: "阿根廷罗萨里奥现货参考价",
            unit: "ARS/吨",
            observations: [{ crop: "maiz", name: "玉米", arsPerTonne: 296000 }],
            lastError: "ROSARIO_SOURCE_UNAVAILABLE",
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    ),
  );
  render(<RosarioSpotRail />);
  expect(await screen.findByText(/所示为上次成功读取/)).toBeVisible();
  expect(screen.getByText("来源暂不可用")).toBeVisible();
});
