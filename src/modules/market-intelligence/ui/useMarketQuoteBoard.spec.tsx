import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useMarketQuoteBoard } from "./useMarketQuoteBoard";

const response = (state = "CONNECTED", lastSuccessAt = "2026-09-25T12:00:01Z") => ({
  ok: true,
  json: () =>
    Promise.resolve({
      data: {
        instruments: [],
        quotes: [],
        gatewayState: state,
        lastSuccessAt,
        feedState: "RECONCILED",
        feedPublishedAt: "2026-09-25T12:00:01Z",
        feedAgeSeconds: 0,
        lastError: null,
      },
    }),
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it("accepts repeated 11-second responses without overlapping polling", async () => {
  vi.useFakeTimers();
  let completed = 0;
  const fetcher = vi.fn(
    () =>
      new Promise((resolve) =>
        setTimeout(() => {
          completed += 1;
          resolve(response("CONNECTED", `2026-09-25T12:00:0${completed}Z`));
        }, 11_000),
      ),
  );
  vi.stubGlobal("fetch", fetcher);
  const { result } = renderHook(useMarketQuoteBoard);
  await act(() => vi.advanceTimersByTimeAsync(11_000));
  expect(result.current.board?.gatewayState).toBe("CONNECTED");
  expect(fetcher).toHaveBeenCalledTimes(1);
  await act(() => vi.advanceTimersByTimeAsync(30_000));
  expect(fetcher).toHaveBeenCalledTimes(3);
  expect(result.current.board?.lastSuccessAt).toBe("2026-09-25T12:00:02Z");
  expect(result.current.board?.gatewayState).toBe("CONNECTED");
});

it("times out a hung request, retries, and ignores its late response", async () => {
  vi.useFakeTimers();
  let finish!: (value: ReturnType<typeof response>) => void;
  let oldSignal!: AbortSignal;
  const fetcher = vi
    .fn()
    .mockImplementationOnce((_url: string, options: { signal: AbortSignal }) => {
      oldSignal = options.signal;
      return new Promise((resolve) => {
        finish = resolve;
      });
    })
    .mockResolvedValue(response());
  vi.stubGlobal("fetch", fetcher);
  const { result } = renderHook(useMarketQuoteBoard);
  await act(() => vi.advanceTimersByTimeAsync(20_000));
  expect(oldSignal.aborted).toBe(true);
  await act(() => vi.advanceTimersByTimeAsync(10_000));
  expect(result.current.board?.gatewayState).toBe("CONNECTED");
  await act(async () => {
    finish(response("SOURCE_ERROR"));
    await Promise.resolve();
  });
  expect(result.current.board?.gatewayState).toBe("CONNECTED");
  expect(result.current.error).toBe(false);
});

it("reports a timeout even if fetch never settles and cancels on unmount", async () => {
  vi.useFakeTimers();
  const signals: AbortSignal[] = [];
  const fetcher = vi.fn((_url: string, options: { signal: AbortSignal }) => {
    signals.push(options.signal);
    return new Promise(() => {});
  });
  vi.stubGlobal("fetch", fetcher);
  const { result, unmount } = renderHook(useMarketQuoteBoard);
  await act(() => vi.advanceTimersByTimeAsync(20_000));
  expect(result.current.error).toBe(true);
  await act(() => vi.advanceTimersByTimeAsync(10_000));
  unmount();
  expect(signals.every((signal) => signal.aborted)).toBe(true);
  const calls = fetcher.mock.calls.length;
  await act(() => vi.advanceTimersByTimeAsync(60_000));
  expect(fetcher).toHaveBeenCalledTimes(calls);
  expect(vi.getTimerCount()).toBe(0);
});
