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

    expect(screen.getByText("0")).toBeInTheDocument();
    act(() => stream.callbacks.onConnected());
    expect(screen.getByText("1")).toBeInTheDocument();
    act(() => stream.callbacks.onBusinessChange());
    expect(screen.getByText("2")).toBeInTheDocument();

    act(() => {
      stream.callbacks.onDisconnected();
      vi.advanceTimersByTime(30_000);
    });
    expect(screen.getByText("3")).toBeInTheDocument();

    act(() => stream.callbacks.onConnected());
    expect(screen.getByText("4")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(60_000));
    expect(screen.getByText("4")).toBeInTheDocument();

    unmount();
    expect(stream.closed).toBe(true);
  });
});

function Harness({ stream }: { stream: OverviewRealtimeStream }) {
  const sequence = useOverviewRealtimeRefresh(stream);
  return <span>{sequence}</span>;
}

class FakeRealtimeStream implements OverviewRealtimeStream {
  callbacks!: OverviewRealtimeCallbacks;
  closed = false;

  subscribe(callbacks: OverviewRealtimeCallbacks) {
    this.callbacks = callbacks;
    return () => {
      this.closed = true;
    };
  }
}
