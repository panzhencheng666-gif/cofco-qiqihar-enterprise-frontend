import { describe, expect, it, vi } from "vitest";

import { BrowserOverviewRealtimeStream } from "./BrowserOverviewRealtimeStream";

describe("BrowserOverviewRealtimeStream", () => {
  it("delivers the product, regions, and survey year from a business-change event", () => {
    const source = new FakeEventSource();
    const onBusinessChange = vi.fn();
    const unsubscribe = new BrowserOverviewRealtimeStream(
      () => source as unknown as EventSource,
    ).subscribe({
      onBusinessChange,
      onConnected: vi.fn(),
      onDisconnected: vi.fn(),
    });

    source.dispatch(
      new MessageEvent("business-change", {
        data: JSON.stringify({
          productCode: "CORN",
          regionCodes: ["230208"],
          surveyYear: 2025,
        }),
      }),
    );

    expect(onBusinessChange).toHaveBeenCalledWith({
      productCode: "CORN",
      regionCodes: ["230208"],
      surveyYear: 2025,
    });
    unsubscribe();
    expect(source.closed).toBe(true);
  });

  it("ignores malformed events instead of refreshing an unrelated selection", () => {
    const source = new FakeEventSource();
    const onBusinessChange = vi.fn();
    new BrowserOverviewRealtimeStream(() => source as unknown as EventSource).subscribe(
      {
        onBusinessChange,
        onConnected: vi.fn(),
        onDisconnected: vi.fn(),
      },
    );

    source.dispatch(
      new MessageEvent("business-change", {
        data: JSON.stringify({ regionCodes: ["230208"], surveyYear: "2026" }),
      }),
    );

    expect(onBusinessChange).not.toHaveBeenCalled();
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

  dispatch(event: Event) {
    this.listeners.get(event.type)?.(event);
  }

  close() {
    this.closed = true;
  }
}
