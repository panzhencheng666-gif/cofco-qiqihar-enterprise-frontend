import type {
  OverviewRealtimeCallbacks,
  OverviewRealtimeStream,
} from "../../application/ports/OverviewRealtimeStream";

export class BrowserOverviewRealtimeStream implements OverviewRealtimeStream {
  constructor(
    private readonly createEventSource: (url: string) => EventSource = (url) =>
      new EventSource(url),
  ) {}

  subscribe(callbacks: OverviewRealtimeCallbacks) {
    const source = this.createEventSource("/api/v1/business-events/stream");
    const onBusinessChange = () => callbacks.onBusinessChange();
    source.addEventListener("business-change", onBusinessChange);
    source.onopen = () => callbacks.onConnected();
    source.onerror = () => callbacks.onDisconnected();

    return () => {
      source.removeEventListener("business-change", onBusinessChange);
      source.close();
    };
  }
}
