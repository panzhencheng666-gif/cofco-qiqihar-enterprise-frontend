import { act, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useDeferredMapSelection } from "./useDeferredMapSelection";
afterEach(() => vi.useRealTimers());
it("defers expensive single-click selection until the double-click window closes", async () => {
  vi.useFakeTimers();
  const select = vi.fn();
  const { result } = renderHook(() => useDeferredMapSelection());
  await act(() => result.current.schedule(select));
  expect(select).not.toHaveBeenCalled();
  await act(() => vi.advanceTimersByTime(219));
  expect(select).not.toHaveBeenCalled();
  await act(() => vi.advanceTimersByTime(1));
  expect(select).toHaveBeenCalledOnce();
});
it("cancels pending single-click selection on drill and on unmount", async () => {
  vi.useFakeTimers();
  const select = vi.fn();
  const { result, unmount } = renderHook(() => useDeferredMapSelection());
  await act(() => { result.current.schedule(select); result.current.cancel(); });
  await act(() => vi.runAllTimers());
  expect(select).not.toHaveBeenCalled();
  await act(() => result.current.schedule(select));
  unmount();
  await act(() => vi.runAllTimers());
  expect(select).not.toHaveBeenCalled();
});
