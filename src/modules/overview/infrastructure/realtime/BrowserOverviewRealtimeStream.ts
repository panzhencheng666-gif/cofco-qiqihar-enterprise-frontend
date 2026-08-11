import type {
  OverviewBusinessChange,
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
    const onBusinessChange = (event: Event) => {
      const change = parseBusinessChange(event);
      if (change) callbacks.onBusinessChange(change);
    };
    source.addEventListener("business-change", onBusinessChange);
    source.onopen = () => callbacks.onConnected();
    source.onerror = () => callbacks.onDisconnected();

    return () => {
      source.removeEventListener("business-change", onBusinessChange);
      source.close();
    };
  }
}

function parseBusinessChange(event: Event): OverviewBusinessChange | undefined {
  if (!(event instanceof MessageEvent) || typeof event.data !== "string")
    return undefined;
  try {
    const value = JSON.parse(event.data) as Record<string, unknown>;
    const regionCodes = value.regionCodes;
    const productCode = value.productCode;
    const surveyYear = value.surveyYear;
    if (
      !Array.isArray(regionCodes) ||
      !regionCodes.every((code) => typeof code === "string") ||
      (productCode !== null &&
        productCode !== undefined &&
        typeof productCode !== "string") ||
      (surveyYear !== null && surveyYear !== undefined && !Number.isInteger(surveyYear))
    ) {
      return undefined;
    }
    return {
      regionCodes,
      ...(typeof productCode === "string" ? { productCode } : {}),
      ...(typeof surveyYear === "number" ? { surveyYear } : {}),
    };
  } catch {
    return undefined;
  }
}
