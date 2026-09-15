import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useReliefLabelPriority } from "./useReliefLabelPriority";

afterEach(() => vi.useRealTimers());

describe("relief label selection priority", () => {
  it("keeps the first-click target stable through the layout double-click interval", async () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(
      ({ code }) => useReliefLabelPriority(code),
      {
        initialProps: { code: "first" },
      },
    );
    rerender({ code: "second" });
    expect(result.current).toBe("first");
    await act(() => vi.advanceTimersByTime(219));
    expect(result.current).toBe("first");
    await act(() => vi.advanceTimersByTime(1));
    expect(result.current).toBe("second");
  });

  it("cancels stale priority changes when drilling or choosing another region", async () => {
    vi.useFakeTimers();
    const { result, rerender, unmount } = renderHook(
      ({ code }) => useReliefLabelPriority(code),
      {
        initialProps: { code: "first" },
      },
    );
    rerender({ code: "second" });
    await act(() => vi.advanceTimersByTime(150));
    rerender({ code: "third" });
    await act(() => vi.advanceTimersByTime(70));
    expect(result.current).toBe("first");
    await act(() => vi.advanceTimersByTime(150));
    expect(result.current).toBe("third");
    rerender({ code: "fourth" });
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
