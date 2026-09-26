import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MarketQuoteRail } from "./MarketQuoteRail";

const instrument = {
  id: "sse-composite",
  name: "上证指数",
  group: "全球指数",
  market: "中国",
  unit: "点",
  cadence: "INTRADAY",
};
const quote = {
  id: "sse-composite",
  last: 2180,
  previousClose: 2170,
  sourceAt: "2026-09-25T12:00:00Z",
  provider: "授权测试源",
  state: "CURRENT",
};

function board(gatewayState: string) {
  return {
    ok: true,
    data: {
      instruments: [instrument],
      quotes: [quote],
      gatewayState,
      lastSuccessAt: "2026-09-25T12:00:01Z",
      feedState: "RECONCILED",
      feedPublishedAt: "2026-09-25T12:00:01Z",
      feedAgeSeconds: 0,
      lastError: null as string | null,
    },
  };
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("market quote source interruption", () => {
  it("puts grain and agricultural products in separate scrollable groups without sample prices", async () => {
    const grain = {
      ...instrument,
      id: "dce-corn",
      name: "大商所玉米主力",
      group: "谷物",
      unit: "元/吨",
    };
    const agricultural = {
      ...instrument,
      id: "dce-egg",
      name: "大商所鸡蛋主力",
      group: "农副产品",
      unit: "元/500千克",
    };
    const response = board("PENDING_AUTHORIZATION");
    response.data.instruments = [instrument, agricultural, grain];
    response.data.quotes = [];
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(response),
      }),
    );
    render(<MarketQuoteRail onSelect={() => {}} />);
    expect(await screen.findByText("大商所玉米主力")).toBeVisible();
    expect(screen.getByRole("button", { name: "谷物" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByText("--")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "农副产品" }));
    expect(screen.getByText("大商所鸡蛋主力")).toBeVisible();
    expect(screen.queryByText("大商所玉米主力")).toBeNull();
  });

  it("ignores an older supplier failure that arrives after a newer healthy response", async () => {
    vi.useFakeTimers();
    let releaseFirst: (() => void) | undefined;
    const first = new Promise<unknown>((resolve) => {
      releaseFirst = () =>
        resolve({ ok: true, json: () => Promise.resolve(board("SOURCE_ERROR")) });
    });
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockReturnValueOnce(first)
        .mockResolvedValue({
          ok: true,
          json: () => Promise.resolve(board("CONNECTED")),
        }),
    );
    render(<MarketQuoteRail onSelect={() => {}} />);
    await act(() => vi.advanceTimersByTimeAsync(30_000));
    expect(screen.getByText("授权行情源已连接")).toBeVisible();

    await act(async () => {
      releaseFirst?.();
      await first;
    });
    expect(screen.getByText("授权行情源已连接")).toBeVisible();
    expect(screen.queryByText("行情源同步失败")).toBeNull();
    expect(screen.queryByText(/缓存报价/)).toBeNull();
  });

  it("ignores an older rejected request after a newer healthy response", async () => {
    vi.useFakeTimers();
    let rejectFirst: (() => void) | undefined;
    const first = new Promise<unknown>((_resolve, reject) => {
      rejectFirst = () => reject(new Error("older request failed"));
    });
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockReturnValueOnce(first)
        .mockResolvedValue({
          ok: true,
          json: () => Promise.resolve(board("CONNECTED")),
        }),
    );
    render(<MarketQuoteRail onSelect={() => {}} />);
    await act(() => vi.advanceTimersByTimeAsync(30_000));
    expect(screen.getByText("授权行情源已连接")).toBeVisible();

    await act(async () => {
      rejectFirst?.();
      await first.catch(() => undefined);
    });
    expect(screen.getByText("授权行情源已连接")).toBeVisible();
    expect(screen.queryByText("行情接口不可用")).toBeNull();
  });

  it("identifies retained quotes as cache when the supplier fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(board("CONNECTED")),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(board("SOURCE_ERROR")),
        }),
    );
    render(<MarketQuoteRail onSelect={() => {}} />);
    expect(await screen.findByText("授权行情源已连接")).toBeVisible();
    expect(screen.getByText("+0.461%")).toBeVisible();

    fireEvent(document, new Event("visibilitychange"));
    expect(await screen.findByText("行情源同步失败")).toBeVisible();
    expect(screen.getByText(/缓存报价/)).toBeVisible();
    expect(screen.getByText("2,180")).toHaveClass("stale");
    expect(screen.getByText("+0.461%")).toHaveClass("pending");
    expect(screen.getByText(/最近成功接收/)).toBeVisible();
  });

  it("does not show cached quote as live when its own API stops responding", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(board("CONNECTED")),
        })
        .mockRejectedValueOnce(new Error("network down")),
    );
    render(<MarketQuoteRail onSelect={() => {}} />);
    expect(await screen.findByText("授权行情源已连接")).toBeVisible();

    fireEvent(document, new Event("visibilitychange"));
    await waitFor(() => expect(screen.getByText("行情接口不可用")).toBeVisible());
    expect(screen.getByText(/缓存报价/)).toBeVisible();
    expect(screen.getByText("2,180")).toHaveClass("stale");
  });
});

describe("market feed health", () => {
  function serve(response: ReturnType<typeof board>) {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(response),
      }),
    );
  }

  it.each([
    ["RECOVERY_REQUIRED", "行情快照补齐中"],
    ["RECONNECTING", "行情连接恢复中"],
    ["INVALID_OR_UNREACHABLE", "行情源不可达或报文无效"],
  ])("labels %s and retains only visibly cached prices", async (state, label) => {
    const response = board("SOURCE_ERROR");
    response.data.feedState = state;
    serve(response);
    render(<MarketQuoteRail onSelect={() => {}} />);
    expect(await screen.findByText(label)).toBeVisible();
    expect(screen.getByText("2,180")).toHaveClass("stale");
    expect(screen.getByText(/缓存报价/)).toBeVisible();
    expect(screen.getByText(/采集心跳 0 秒/)).toBeVisible();
    expect(screen.getByText(/源时间/)).toBeVisible();
  });

  it.each(["ENTITLEMENT_ERROR", "PENDING_AUTHORIZATION", "SESSION_LOST", "CLOSED"])(
    "hides retained prices for %s",
    async (state) => {
      const response = board("SOURCE_ERROR");
      response.data.feedState = state;
      serve(response);
      render(<MarketQuoteRail onSelect={() => {}} />);
      expect(await screen.findByText("上证指数")).toBeVisible();
      expect(screen.queryByText("2,180")).toBeNull();
      expect(screen.getByText("--")).toBeVisible();
    },
  );

  it("shows expired heartbeat even if the backend still says connected", async () => {
    const response = board("CONNECTED");
    response.data.feedAgeSeconds = 31;
    serve(response);
    render(<MarketQuoteRail onSelect={() => {}} />);
    expect(await screen.findByText("采集心跳已过期")).toBeVisible();
    expect(screen.getByText("2,180")).toHaveClass("stale");
  });

  it("ages the last response while subsequent API requests hang", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(board("CONNECTED")),
        })
        .mockImplementation(() => new Promise(() => {})),
    );
    render(<MarketQuoteRail onSelect={() => {}} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByText("授权行情源已连接")).toBeVisible();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(31_000);
    });
    expect(screen.getByText("行情接口不可用")).toBeVisible();
    expect(screen.getByText("2,180")).toHaveClass("stale");
  });

  it("does not expose raw backend errors and does not trust unknown feed states", async () => {
    const response = board("CONNECTED");
    response.data.feedState = "UNKNOWN_NEW_STATE";
    response.data.lastError = "secret internal endpoint";
    serve(response);
    render(<MarketQuoteRail onSelect={() => {}} />);
    expect(await screen.findByText("采集状态待核验")).toBeVisible();
    expect(screen.getByText("2,180")).toHaveClass("stale");
    expect(screen.queryByText(/secret internal endpoint/)).toBeNull();
  });
  it("keeps old responses without heartbeat metadata visibly unverified", async () => {
    const response = board("CONNECTED");
    const legacy: Record<string, unknown> = { ...response.data };
    delete legacy.feedState;
    delete legacy.feedAgeSeconds;
    delete legacy.feedPublishedAt;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: legacy }),
      }),
    );
    render(<MarketQuoteRail onSelect={() => {}} />);
    expect(await screen.findByText("采集状态待核验")).toBeVisible();
    expect(screen.getByText("2,180")).toHaveClass("stale");
  });

  it("shows newly received price and source time after snapshot recovery", async () => {
    const recovering = board("SOURCE_ERROR");
    recovering.data.feedState = "RECOVERY_REQUIRED";
    const recovered = board("CONNECTED");
    recovered.data.quotes = [
      { ...quote, last: 2190, sourceAt: "2026-09-25T12:00:02Z" },
    ];
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(recovering) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(recovered) }),
    );
    render(<MarketQuoteRail onSelect={() => {}} />);
    expect(await screen.findByText("行情快照补齐中")).toBeVisible();
    fireEvent(document, new Event("visibilitychange"));
    expect(await screen.findByText("2,190")).toBeVisible();
    expect(screen.getByText("2,190")).not.toHaveClass("stale");
    expect(screen.getByText("源时间 2026-09-25T12:00:02Z")).toBeVisible();
    expect(screen.queryByText(/缓存报价/)).toBeNull();
  });
});
