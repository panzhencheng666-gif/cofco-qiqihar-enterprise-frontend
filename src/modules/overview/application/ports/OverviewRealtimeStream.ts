export interface OverviewRealtimeCallbacks {
  onBusinessChange: () => void;
  onConnected: () => void;
  onDisconnected: () => void;
}

export interface OverviewRealtimeStream {
  subscribe(callbacks: OverviewRealtimeCallbacks): () => void;
}
