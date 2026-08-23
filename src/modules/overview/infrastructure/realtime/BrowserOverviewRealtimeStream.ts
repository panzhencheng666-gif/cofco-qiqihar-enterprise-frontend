import type {
  OverviewBusinessChange,
  OverviewRealtimeCallbacks,
  OverviewRealtimeStream,
} from "../../application/ports/OverviewRealtimeStream";

export class BrowserOverviewRealtimeStream implements OverviewRealtimeStream {
  constructor(
    private readonly createEventSource: (url: string) => EventSource = (url) =>
      new EventSource(url),
    private readonly loadInitialCursor: () => Promise<number> = loadLatestVisibleNotificationSequence,
  ) {}

  subscribe(callbacks: OverviewRealtimeCallbacks) {
    let source: EventSource | undefined;
    let closed = false;
    const onBusinessChange = (event: Event) => {
      const change = parseBusinessChange(event);
      if (change) callbacks.onBusinessChange(change);
    };
    const connect = (cursor: number) => {
      if (closed) return;
      const safeCursor = Number.isSafeInteger(cursor) ? Math.max(0, cursor) : 0;
      source = this.createEventSource(
        `/api/v1/business-events/stream?after=${safeCursor}`,
      );
      source.addEventListener("business-change", onBusinessChange);
      source.onopen = () => callbacks.onConnected();
      source.onerror = () => callbacks.onDisconnected();
    };
    void this.loadInitialCursor().then(connect, () => connect(0));

    return () => {
      closed = true;
      source?.removeEventListener("business-change", onBusinessChange);
      source?.close();
    };
  }
}

async function loadLatestVisibleNotificationSequence(): Promise<number> {
  const response = await fetch("/api/v1/notifications", {
    credentials: "same-origin",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`Notification cursor request failed: ${response.status}`);
  }
  const payload = (await response.json()) as {
    data?: { items?: Array<{ sequence?: unknown }> };
  };
  return (payload.data?.items ?? []).reduce((latest, item) => {
    const sequence = item.sequence;
    return typeof sequence === "number" &&
      Number.isSafeInteger(sequence) &&
      sequence >= 0
      ? Math.max(latest, sequence)
      : latest;
  }, 0);
}

function parseBusinessChange(event: Event): OverviewBusinessChange | undefined {
  if (!(event instanceof MessageEvent) || typeof event.data !== "string")
    return undefined;
  try {
    const value = JSON.parse(event.data) as Record<string, unknown>;
    const regionCodes = value.regionCodes;
    const aggregateType = value.aggregateType;
    const actionCode = value.actionCode;
    const productCode = value.productCode;
    const surveyYear = value.surveyYear;
    if (
      !Array.isArray(regionCodes) ||
      !regionCodes.every((code) => typeof code === "string") ||
      (aggregateType !== null &&
        aggregateType !== undefined &&
        typeof aggregateType !== "string") ||
      (actionCode !== null &&
        actionCode !== undefined &&
        typeof actionCode !== "string") ||
      (productCode !== null &&
        productCode !== undefined &&
        typeof productCode !== "string") ||
      (surveyYear !== null && surveyYear !== undefined && !Number.isInteger(surveyYear))
    ) {
      return undefined;
    }
    return {
      regionCodes,
      ...(typeof aggregateType === "string" ? { aggregateType } : {}),
      ...(typeof actionCode === "string" ? { actionCode } : {}),
      ...(typeof productCode === "string" ? { productCode } : {}),
      ...(typeof surveyYear === "number" ? { surveyYear } : {}),
    };
  } catch {
    return undefined;
  }
}
