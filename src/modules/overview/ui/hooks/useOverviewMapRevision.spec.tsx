import { act, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useOverviewRealtimeRefresh } from "./useOverviewRealtimeRefresh";
import type { OverviewRealtimeCallbacks } from "../../application/ports/OverviewRealtimeStream";
afterEach(() => vi.useRealTimers());
it("invalidates geography and samples for a map-only signal without a selected year", () => {
  vi.useFakeTimers();
  let callbacks!: OverviewRealtimeCallbacks;
  const stream = {
    subscribe: (next: OverviewRealtimeCallbacks) => {
      callbacks = next;
      return () => {};
    },
  };
  const { result } = renderHook(() =>
    useOverviewRealtimeRefresh(stream, {
      productCode: "CORN",
      regionCodes: ["230202"],
    }),
  );
  act(() => {
    callbacks.onBusinessChange({ aggregateType: "OVERVIEW_MAP", regionCodes: [] });
    vi.advanceTimersByTime(500);
  });
  expect(result.current.geographySequence).toBe(1);
  expect(result.current.samplePointSequence).toBe(1);
  expect(result.current.businessSequence).toBe(0);
});
