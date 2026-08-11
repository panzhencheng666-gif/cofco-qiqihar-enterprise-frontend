export interface OverviewBusinessChange {
  productCode?: string;
  regionCodes: readonly string[];
  surveyYear?: number;
}

export interface OverviewRealtimeCallbacks {
  onBusinessChange: (change: OverviewBusinessChange) => void;
  onConnected: () => void;
  onDisconnected: () => void;
}

export interface OverviewRealtimeStream {
  subscribe(callbacks: OverviewRealtimeCallbacks): () => void;
}
