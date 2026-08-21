import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  OverviewRealtimeCallbacks,
  OverviewRealtimeStream,
} from "../../application/ports/OverviewRealtimeStream";
import { useOverviewRealtimeRefresh } from "./useOverviewRealtimeRefresh";

describe("useOverviewRealtimeRefresh", () => {
  afterEach(() => vi.useRealTimers());

  it("coalesces connection and business-event bursts, then polls only while disconnected", () => {
    vi.useFakeTimers();
    const stream = new FakeRealtimeStream();
    const { unmount } = render(<Harness stream={stream} />);

    expect(screen.getByText("0:0:0")).toBeInTheDocument();
    act(() => stream.callbacks.onConnected());
    act(() =>
      stream.callbacks.onBusinessChange({
        productCode: "CORN",
        regionCodes: ["230200"],
        surveyYear: 2026,
      }),
    );
    act(() => {
      stream.callbacks.onBusinessChange({
        productCode: "SOYBEAN",
        regionCodes: ["230200"],
        surveyYear: 2026,
      });
    });
    act(() =>
      stream.callbacks.onBusinessChange({
        productCode: "CORN",
        regionCodes: ["230200"],
        surveyYear: 2025,
      }),
    );
    expect(screen.getByText("0:0:0")).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(499);
    });
    expect(screen.getByText("0:0:0")).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.getByText("1:1:1")).toBeInTheDocument();

    act(() => {
      stream.callbacks.onDisconnected();
      vi.advanceTimersByTime(30_000);
    });
    expect(screen.getByText("1:1:1")).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(screen.getByText("2:2:2")).toBeInTheDocument();

    act(() => stream.callbacks.onConnected());
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(screen.getByText("3:3:3")).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(screen.getByText("3:3:3")).toBeInTheDocument();

    unmount();
    expect(stream.closed).toBe(true);
  });

  it("keeps one subscription and does not refresh samples when only product changes", () => {
    vi.useFakeTimers();
    const stream = new FakeRealtimeStream();
    const { rerender } = render(<Harness productCode="CORN" stream={stream} />);
    const callbacks = stream.callbacks;

    rerender(<Harness productCode="SOYBEAN" stream={stream} />);

    expect(stream.subscribeCalls).toBe(1);
    expect(stream.callbacks).toBe(callbacks);
    expect(screen.getByText("0:0:0")).toBeInTheDocument();
    act(() =>
      callbacks.onBusinessChange({
        productCode: "SOYBEAN",
        regionCodes: ["230200"],
        surveyYear: 2026,
      }),
    );
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(screen.getByText("1:1:1")).toBeInTheDocument();
  });

  it("does not refresh current business or sample points for another product", () => {
    vi.useFakeTimers();
    const stream = new FakeRealtimeStream();
    render(<Harness productCode="CORN" stream={stream} />);

    act(() => {
      stream.callbacks.onBusinessChange({
        productCode: "SOYBEAN",
        regionCodes: ["230200"],
        surveyYear: 2026,
      });
    });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(screen.getByText("0:0:1")).toBeInTheDocument();

    act(() => {
      stream.callbacks.onBusinessChange({
        productCode: "CORN",
        regionCodes: ["230200"],
        surveyYear: 2026,
      });
    });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(screen.getByText("1:1:2")).toBeInTheDocument();
  });

  it("turns a large historical replay into one refresh instead of rebuilding the map per event", () => {
    vi.useFakeTimers();
    const stream = new FakeRealtimeStream();
    render(<Harness stream={stream} />);

    act(() => {
      stream.callbacks.onConnected();
      for (let index = 0; index < 1_203; index += 1) {
        stream.callbacks.onBusinessChange({
          productCode: "CORN",
          regionCodes: ["230200"],
          surveyYear: 2026,
        });
      }
      vi.advanceTimersByTime(499);
    });
    expect(screen.getByText("0:0:0")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.getByText("1:1:1")).toBeInTheDocument();
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
    ) => {
      businessSequence: number;
      samplePointSequence: number;
      optionSequence: number;
    }
  )(stream, {
    productCode,
    regionCodes: ["230200"],
    year: 2026,
  });
  return (
    <span>
      {sequence.businessSequence}:{sequence.samplePointSequence}:
      {sequence.optionSequence}
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
