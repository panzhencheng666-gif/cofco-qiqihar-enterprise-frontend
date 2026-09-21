import { act, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useDeferredMapSelection } from "./useDeferredMapSelection";
afterEach(() => vi.useRealTimers());
it("defers expensive single-click selection until the double-click window closes", () => {
  vi.useFakeTimers();
  const select = vi.fn();
  const { result } = renderHook(() => useDeferredMapSelection());
  void act(() => result.current.schedule(select));
  expect(select).not.toHaveBeenCalled();
  void act(() => vi.advanceTimersByTime(219));
  expect(select).not.toHaveBeenCalled();
  void act(() => vi.advanceTimersByTime(1));
  expect(select).toHaveBeenCalledOnce();
});
it("cancels pending single-click selection on drill and on unmount", () => {
  vi.useFakeTimers();
  const select = vi.fn();
  const { result, unmount } = renderHook(() => useDeferredMapSelection());
  void act(() => {
    result.current.schedule(select);
    result.current.cancel();
  });
  void act(() => vi.runAllTimers());
  expect(select).not.toHaveBeenCalled();
  void act(() => result.current.schedule(select));
  unmount();
  void act(() => vi.runAllTimers());
  expect(select).not.toHaveBeenCalled();
});
