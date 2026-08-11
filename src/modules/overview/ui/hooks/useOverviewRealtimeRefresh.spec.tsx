import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  OverviewRealtimeCallbacks,
  OverviewRealtimeStream,
} from "../../application/ports/OverviewRealtimeStream";
import { useOverviewRealtimeRefresh } from "./useOverviewRealtimeRefresh";

describe("useOverviewRealtimeRefresh", () => {
  afterEach(() => vi.useRealTimers());

  it("compensates on connect, refreshes on change, and polls only while disconnected", () => {
    vi.useFakeTimers();
    const stream = new FakeRealtimeStream();
    const { unmount } = render(<Harness stream={stream} />);

    expect(screen.getByText("0:0")).toBeInTheDocument();
    act(() => stream.callbacks.onConnected());
    expect(screen.getByText("1:1")).toBeInTheDocument();
    act(() =>
      stream.callbacks.onBusinessChange({
        productCode: "CORN",
        regionCodes: ["230200"],
        surveyYear: 2026,
      }),
    );
    expect(screen.getByText("2:2")).toBeInTheDocument();

    act(() =>
      stream.callbacks.onBusinessChange({
        productCode: "SOYBEAN",
        regionCodes: ["230200"],
        surveyYear: 2026,
      }),
    );
    expect(screen.getByText("2:3")).toBeInTheDocument();

    act(() =>
      stream.callbacks.onBusinessChange({
        productCode: "CORN",
        regionCodes: ["230200"],
        surveyYear: 2025,
      }),
    );
    expect(screen.getByText("2:3")).toBeInTheDocument();

    act(() => {
      stream.callbacks.onDisconnected();
      vi.advanceTimersByTime(30_000);
    });
    expect(screen.getByText("3:4")).toBeInTheDocument();

    act(() => stream.callbacks.onConnected());
    expect(screen.getByText("4:5")).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(screen.getByText("4:5")).toBeInTheDocument();

    unmount();
    expect(stream.closed).toBe(true);
  });

  it("keeps one subscription and does not refresh samples when only product changes", () => {
    const stream = new FakeRealtimeStream();
    const { rerender } = render(<Harness productCode="CORN" stream={stream} />);
    const callbacks = stream.callbacks;

    rerender(<Harness productCode="SOYBEAN" stream={stream} />);

    expect(stream.subscribeCalls).toBe(1);
    expect(stream.callbacks).toBe(callbacks);
    expect(screen.getByText("0:0")).toBeInTheDocument();
    act(() =>
      callbacks.onBusinessChange({
        productCode: "SOYBEAN",
        regionCodes: ["230200"],
        surveyYear: 2026,
      }),
    );
    expect(screen.getByText("1:1")).toBeInTheDocument();
  });
});

function Harness({
  productCode = "CORN",
  stream,
}: {
  productCode?: string;
  stream: OverviewRealtimeStream;
}) {
  const sequence = (
    useOverviewRealtimeRefresh as unknown as (
      stream: OverviewRealtimeStream,
      selection: unknown,
    ) => { businessSequence: number; samplePointSequence: number }
  )(stream, {
    productCode,
    regionCodes: ["230200"],
    year: 2026,
  });
  return (
    <span>
      {sequence.businessSequence}:{sequence.samplePointSequence}
    </span>
  );
}

class FakeRealtimeStream implements OverviewRealtimeStream {
  callbacks!: OverviewRealtimeCallbacks;
  closed = false;
  subscribeCalls = 0;

  subscribe(callbacks: OverviewRealtimeCallbacks) {
    this.subscribeCalls += 1;
    this.callbacks = callbacks;
    return () => {
      this.closed = true;
    };
  }
}
