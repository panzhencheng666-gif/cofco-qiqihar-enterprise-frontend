import { afterEach, describe, expect, it, vi } from "vitest";

import { BrowserOverviewRealtimeStream } from "./BrowserOverviewRealtimeStream";

describe("BrowserOverviewRealtimeStream", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("uses the shared stream watermark even when the inbox has older notifications", async () => {
    const source = new FakeEventSource();
    const createEventSource = vi.fn(() => source as unknown as EventSource);
    const fetchResponse = vi.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            data: {
              currentSequence: 9000,
              items: [{ sequence: 1199 }, { sequence: 1203 }],
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );
    vi.stubGlobal("fetch", fetchResponse);

    const unsubscribe = new BrowserOverviewRealtimeStream(createEventSource).subscribe({
      onBusinessChange: vi.fn(),
      onConnected: vi.fn(),
      onDisconnected: vi.fn(),
    });

    await vi.waitFor(() =>
      expect(createEventSource).toHaveBeenCalledWith(
        "/api/v1/business-events/stream?after=9000",
      ),
    );
    expect(fetchResponse).toHaveBeenCalledWith("/api/v1/notifications", {
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    });
    unsubscribe();
  });

  it("does not replay history after cursor failure and retries only the cursor", async () => {
    vi.useFakeTimers();
    const createEventSource = vi.fn(
      () => new FakeEventSource() as unknown as EventSource,
    );
    const loadCursor = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue(9000);
    const unsubscribe = new BrowserOverviewRealtimeStream(
      createEventSource,
      loadCursor,
    ).subscribe({
      onBusinessChange: vi.fn(),
      onConnected: vi.fn(),
      onDisconnected: vi.fn(),
    });
    await vi.advanceTimersByTimeAsync(1000);
    expect(createEventSource).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(14000);
    expect(createEventSource).toHaveBeenCalledExactlyOnceWith(
      "/api/v1/business-events/stream?after=9000",
    );
    unsubscribe();
    vi.useRealTimers();
  });

  it("starts after the latest visible notification and delivers a business change", async () => {
    const source = new FakeEventSource();
    const createEventSource = vi.fn(() => source as unknown as EventSource);
    const onBusinessChange = vi.fn();
    const unsubscribe = new BrowserOverviewRealtimeStream(createEventSource, () =>
      Promise.resolve(1203),
    ).subscribe({
      onBusinessChange,
      onConnected: vi.fn(),
      onDisconnected: vi.fn(),
    });

    await vi.waitFor(() =>
      expect(createEventSource).toHaveBeenCalledWith(
        "/api/v1/business-events/stream?after=1203",
      ),
    );

    source.dispatch(
      new MessageEvent("business-change", {
        data: JSON.stringify({
          aggregateType: "SAMPLE_NETWORK_YEAR",
          actionCode: "SAMPLE_NETWORK_PUBLISHED",
          productCode: "CORN",
          regionCodes: ["230208"],
          surveyYear: 2025,
        }),
      }),
    );

    expect(onBusinessChange).toHaveBeenCalledWith({
      aggregateType: "SAMPLE_NETWORK_YEAR",
      actionCode: "SAMPLE_NETWORK_PUBLISHED",
      productCode: "CORN",
      regionCodes: ["230208"],
      surveyYear: 2025,
    });
    unsubscribe();
    expect(source.closed).toBe(true);
  });

  it("delivers a repeated stream sequence only once", async () => {
    const source = new FakeEventSource();
    const onBusinessChange = vi.fn();
    const unsubscribe = new BrowserOverviewRealtimeStream(
      () => source as unknown as EventSource,
      () => Promise.resolve(1203),
    ).subscribe({
      onBusinessChange,
      onConnected: vi.fn(),
      onDisconnected: vi.fn(),
    });

    await vi.waitFor(() => expect(source.listenerCount()).toBe(1));
    const payload = JSON.stringify({
      aggregateType: "SAMPLE_NETWORK_YEAR",
      actionCode: "SAMPLE_NETWORK_PUBLISHED",
      productCode: "CORN",
      regionCodes: ["230208"],
      surveyYear: 2025,
    });
    source.dispatch(
      new MessageEvent("business-change", {
        data: payload,
        lastEventId: "1204",
      }),
    );
    source.dispatch(
      new MessageEvent("business-change", {
        data: payload,
        lastEventId: "1204",
      }),
    );

    expect(onBusinessChange).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it("delivers the V158 design-coordinate dataset contract unchanged", async () => {
    const source = new FakeEventSource();
    const onBusinessChange = vi.fn();
    const unsubscribe = new BrowserOverviewRealtimeStream(
      () => source as unknown as EventSource,
      () => Promise.resolve(0),
    ).subscribe({
      onBusinessChange,
      onConnected: vi.fn(),
      onDisconnected: vi.fn(),
    });

    await vi.waitFor(() => expect(source.listenerCount()).toBe(1));
    source.dispatch(
      new MessageEvent("business-change", {
        data: JSON.stringify({
          aggregateType: "DESIGN_COORDINATE_DATASET",
          actionCode: "LEGACY_VILLAGE_DESIGN_COORDINATES_DELETED",
          productCode: null,
          regionCodes: ["230200"],
          surveyYear: null,
        }),
      }),
    );

    expect(onBusinessChange).toHaveBeenCalledWith({
      aggregateType: "DESIGN_COORDINATE_DATASET",
      actionCode: "LEGACY_VILLAGE_DESIGN_COORDINATES_DELETED",
      regionCodes: ["230200"],
    });
    unsubscribe();
  });

  it("keeps the formal sample aggregate id needed to retire a deleted selection", async () => {
    const source = new FakeEventSource();
    const onBusinessChange = vi.fn();
    const unsubscribe = new BrowserOverviewRealtimeStream(
      () => source as unknown as EventSource,
      () => Promise.resolve(0),
    ).subscribe({
      onBusinessChange,
      onConnected: vi.fn(),
      onDisconnected: vi.fn(),
    });

    await vi.waitFor(() => expect(source.listenerCount()).toBe(1));
    source.dispatch(
      new MessageEvent("business-change", {
        data: JSON.stringify({
          aggregateType: "FORMAL_SAMPLE_POINT",
          aggregateId: "94000000-0000-0000-0000-000000000001",
          actionCode: "FORMAL_SAMPLE_POINT_DELETED",
          productCode: null,
          regionCodes: ["230202"],
          surveyYear: null,
        }),
      }),
    );

    expect(onBusinessChange).toHaveBeenCalledWith({
      aggregateType: "FORMAL_SAMPLE_POINT",
      aggregateId: "94000000-0000-0000-0000-000000000001",
      actionCode: "FORMAL_SAMPLE_POINT_DELETED",
      regionCodes: ["230202"],
    });
    unsubscribe();
  });

  it("ignores malformed events instead of refreshing an unrelated selection", async () => {
    const source = new FakeEventSource();
    const onBusinessChange = vi.fn();
    new BrowserOverviewRealtimeStream(
      () => source as unknown as EventSource,
      () => Promise.resolve(0),
    ).subscribe({
      onBusinessChange,
      onConnected: vi.fn(),
      onDisconnected: vi.fn(),
    });

    await vi.waitFor(() => expect(source.listenerCount()).toBe(1));

    source.dispatch(
      new MessageEvent("business-change", {
        data: JSON.stringify({ regionCodes: ["230208"], surveyYear: "2026" }),
      }),
    );

    expect(onBusinessChange).not.toHaveBeenCalled();
  });

  it("does not open a stream after the subscriber has already left", async () => {
    let resolveCursor: ((cursor: number) => void) | undefined;
    const cursor = new Promise<number>((resolve) => {
      resolveCursor = resolve;
    });
    const createEventSource = vi.fn(
      () => new FakeEventSource() as unknown as EventSource,
    );
    const unsubscribe = new BrowserOverviewRealtimeStream(
      createEventSource,
      () => cursor,
    ).subscribe({
      onBusinessChange: vi.fn(),
      onConnected: vi.fn(),
      onDisconnected: vi.fn(),
    });

    unsubscribe();
    resolveCursor?.(42);
    await cursor;
    await Promise.resolve();

    expect(createEventSource).not.toHaveBeenCalled();
  });
});

class FakeEventSource {
  closed = false;
  onerror: ((event: Event) => void) | null = null;
  onopen: ((event: Event) => void) | null = null;
  private readonly listeners = new Map<string, EventListener>();

  addEventListener(type: string, listener: EventListener) {
    this.listeners.set(type, listener);
  }

  removeEventListener(type: string) {
    this.listeners.delete(type);
  }

  listenerCount() {
    return this.listeners.size;
  }

  dispatch(event: Event) {
    this.listeners.get(event.type)?.(event);
  }

  close() {
    this.closed = true;
  }
}
