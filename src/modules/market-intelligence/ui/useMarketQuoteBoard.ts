import { useEffect, useState } from "react";
import { z } from "zod";
const instrumentSchema = z.object({
  id: z.string(),
  name: z.string(),
  group: z.string(),
  market: z.string(),
  unit: z.string(),
  cadence: z.enum(["INTRADAY", "DAILY", "WEEKLY", "MONTHLY"]),
});
const quoteSchema = z.object({
  id: z.string(),
  last: z.number(),
  previousClose: z.number().nullable(),
  sourceAt: z.string(),
  provider: z.string(),
  state: z.enum(["CURRENT", "STALE"]),
});
const boardSchema = z.object({
  instruments: z.array(instrumentSchema),
  quotes: z.array(quoteSchema),
  gatewayState: z.string(),
  lastSuccessAt: z.string().nullable(),
  feedState: z.string().optional(),
  feedPublishedAt: z.string().nullable().optional(),
  feedAgeSeconds: z.number().nonnegative().nullable().optional(),
  lastError: z.string().nullable().optional(),
});
type Board = z.infer<typeof boardSchema>;

const statusText: Record<string, string> = {
  PENDING_AUTHORIZATION: "行情授权待核验",
  PENDING_CONFIGURATION: "授权源待配置",
  WAITING_FIRST_TICK: "等待首笔行情",
  SOURCE_ERROR: "行情源同步失败",
  STALE_DATA: "行情源已连接 · 报价已过期",
  CONNECTED: "授权行情源已连接",
};
const feedStatusText: Record<string, string> = {
  NEW: "行情采集待启动",
  STARTING: "行情采集启动中",
  WAITING_DATA: "等待首笔行情",
  PENDING_AUTHORIZATION: "行情授权待核验",
  ENTITLEMENT_ERROR: "行情权限失效 · 报价已隐藏",
  SESSION_LOST: "行情会话已失效 · 报价已隐藏",
  CLOSED: "行情采集已停止 · 报价已隐藏",
  SOURCE_ERROR: "行情源同步失败",
  INVALID_OR_UNREACHABLE: "行情源不可达或报文无效",
  RECONNECTING: "行情连接恢复中",
  RECOVERY_REQUIRED: "行情快照补齐中",
};
const hiddenPriceStates = new Set([
  "NEW",
  "STARTING",
  "WAITING_DATA",
  "PENDING_AUTHORIZATION",
  "ENTITLEMENT_ERROR",
  "SESSION_LOST",
  "CLOSED",
  "SOURCE_ERROR",
]);
export function useMarketQuoteBoard() {
  const [board, setBoard] = useState<Board | null>(null);
  const [error, setError] = useState(false);
  const [receivedAt, setReceivedAt] = useState<number | null>(null);
  const [now, setNow] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let latestRequest = 0;
    async function refresh() {
      if (document.hidden) return;
      const request = ++latestRequest;
      try {
        const response = await fetch("/api/v1/market-intelligence/quotes/overview", {
          credentials: "same-origin",
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const body = z.object({ data: boardSchema }).parse(await response.json());
        if (controller.signal.aborted || request !== latestRequest) return;
        const received = performance.now();
        setReceivedAt(received);
        setNow(received);
        setBoard(body.data);
        setError(false);
      } catch {
        if (!controller.signal.aborted && request === latestRequest) setError(true);
      }
    }
    void refresh();
    const timer = window.setInterval(() => void refresh(), 10_000);
    const clock = window.setInterval(() => setNow(performance.now()), 1_000);
    const onVisible = () => void refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      controller.abort();
      window.clearInterval(timer);
      window.clearInterval(clock);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  // Age advances even when a later API request hangs. This measures the
  // collector heartbeat, never exchange-to-screen quote latency.
  const elapsed = receivedAt === null ? 0 : Math.max(0, (now - receivedAt) / 1000);
  const responseExpired = receivedAt !== null && elapsed > 30;
  const feedAge = board?.feedAgeSeconds == null ? null : board.feedAgeSeconds + elapsed;
  const heartbeatExpired =
    (feedAge !== null && feedAge > 30) ||
    board?.lastError === "QUOTE_FEED_HEARTBEAT_STALE";
  const healthyFeed =
    (board?.feedState === "RECONCILED" || board?.feedState === "STALE_DATA") &&
    feedAge !== null &&
    Number.isFinite(Date.parse(board?.feedPublishedAt ?? ""));
  const hidePrices =
    board?.gatewayState === "PENDING_AUTHORIZATION" ||
    board?.gatewayState === "PENDING_CONFIGURATION" ||
    hiddenPriceStates.has(board?.feedState ?? "");
  const sourceUnavailable =
    error ||
    responseExpired ||
    heartbeatExpired ||
    !healthyFeed ||
    !["CONNECTED", "STALE_DATA"].includes(board?.gatewayState ?? "");
  const label = error
    ? "行情接口不可用"
    : hidePrices
      ? (feedStatusText[board?.feedState ?? ""] ??
        statusText[board?.gatewayState ?? ""])
      : responseExpired
        ? "行情状态更新已超时"
        : heartbeatExpired
          ? "采集心跳已过期"
          : board?.lastError === "QUOTE_FEED_OUT_OF_ORDER_HEALTH"
            ? "采集状态乱序 · 等待新报文"
            : (feedStatusText[board?.feedState ?? ""] ??
              (board && !healthyFeed
                ? "采集状态待核验"
                : statusText[board?.gatewayState ?? ""]));
  return { board, error, hidePrices, sourceUnavailable, label, feedAge };
}
