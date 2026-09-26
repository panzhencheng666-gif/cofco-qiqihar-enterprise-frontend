import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AnalysisWindow } from "./AnalysisWindow";
import { findMetric } from "./metricCatalog";

vi.mock("./AnalysisCollectorStrip", () => ({ AnalysisCollectorStrip: () => null }));
const corn = {
  id: "dce-corn",
  name: "大商所玉米主力",
  group: "谷物",
  market: "中国",
  unit: "元/吨",
  cadence: "INTRADAY",
};
function payload(last = 2180, state = "RECONCILED") {
  return {
    data: {
      instruments: [corn],
      quotes: [
        {
          id: corn.id,
          last,
          previousClose: 2170,
          sourceAt: `2026-09-26T01:30:${last === 2190 ? "02" : "00"}Z`,
          provider: "合成测试源",
          state: "CURRENT",
        },
      ],
      gatewayState: state === "RECONCILED" ? "CONNECTED" : "SOURCE_ERROR",
      feedState: state,
      feedAgeSeconds: 0,
      feedPublishedAt: "2026-09-26T01:30:01Z",
      lastSuccessAt: "2026-09-26T01:30:01Z",
      lastError: null,
    },
  };
}
function open() {
  return render(
    <AnalysisWindow
      commodity="玉米"
      period="近7天"
      topic={findMetric(corn.name, "价格与成本")}
      onClose={() => {}}
      onSelectTopic={() => {}}
    />,
  );
}
function serve(...data: ReturnType<typeof payload>[]) {
  const fetch = vi.fn();
  data.forEach((item) =>
    fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(item) }),
  );
  vi.stubGlobal("fetch", fetch);
  return fetch;
}
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
});
describe("quote analysis route", () => {
  it("automatically replaces selected price and source time on polling", async () => {
    vi.useFakeTimers();
    const fetch = serve(payload(), payload(2190));
    open();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByLabelText("最新报价")).toHaveTextContent("2,180");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(screen.getByLabelText("最新报价")).toHaveTextContent("2,190");
    expect(screen.getByText("2026-09-26T01:30:02Z")).toBeVisible();
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(
      screen.queryByText("筛选、关注与情景配置仅保存在本机；无实时行情"),
    ).toBeNull();
  });
  it("marks recovery cache then removes price and comparison when permissions expire", async () => {
    serve(
      payload(),
      payload(2180, "RECOVERY_REQUIRED"),
      payload(2180, "ENTITLEMENT_ERROR"),
    );
    open();
    await waitFor(() =>
      expect(screen.getByLabelText("最新报价")).toHaveTextContent("2,180"),
    );
    fireEvent(document, new Event("visibilitychange"));
    expect(await screen.findByText("行情快照补齐中")).toBeVisible();
    expect(screen.getByLabelText("最新报价")).toHaveTextContent("缓存报价");
    fireEvent(document, new Event("visibilitychange"));
    expect(await screen.findByText("行情权限失效 · 报价已隐藏")).toBeVisible();
    expect(screen.getByLabelText("最新报价")).toHaveTextContent("--");
    expect(screen.queryByText("2,170")).toBeNull();
  });
  it("rejects a directory unit mismatch without inventing a conversion", async () => {
    const data = payload();
    data.data.instruments[0] = { ...corn, unit: "美分/蒲式耳" };
    serve(data);
    open();
    expect(await screen.findByText("目录单位不一致 · 报价未展示")).toBeVisible();
    expect(screen.getByLabelText("最新报价")).toHaveTextContent("--");
  });
  it("does not silently select among duplicate instrument names", async () => {
    const data = payload();
    data.data.instruments = [corn, { ...corn, id: "other-contract" }];
    serve(data);
    open();
    expect(await screen.findByText("标的对应关系待核验")).toBeVisible();
    expect(screen.getByLabelText("最新报价")).toHaveTextContent("--");
  });
  it("keeps an unmatched topic pending", async () => {
    const data = payload();
    data.data.instruments = [];
    data.data.quotes = [];
    serve(data);
    open();
    expect(await screen.findByText("标的尚未进入行情目录")).toBeVisible();
    expect(screen.getByLabelText("最新报价")).toHaveTextContent("--");
  });
});
