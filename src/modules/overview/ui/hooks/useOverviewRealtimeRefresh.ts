import { useEffect, useState } from "react";

import type { OverviewRealtimeStream } from "../../application/ports/OverviewRealtimeStream";

const FALLBACK_POLL_INTERVAL_MS = 30_000;

export function useOverviewRealtimeRefresh(
  stream: OverviewRealtimeStream,
  fallbackPollIntervalMs = FALLBACK_POLL_INTERVAL_MS,
) {
  const [sequence, setSequence] = useState(0);

  useEffect(() => {
    let fallbackTimer: number | undefined;
    const refresh = () => setSequence((current) => current + 1);
    const stopFallback = () => {
      if (fallbackTimer === undefined) return;
      window.clearInterval(fallbackTimer);
      fallbackTimer = undefined;
    };
    const startFallback = () => {
      if (fallbackTimer !== undefined) return;
      fallbackTimer = window.setInterval(refresh, fallbackPollIntervalMs);
    };
    const unsubscribe = stream.subscribe({
      onBusinessChange: refresh,
      onConnected: () => {
        stopFallback();
        refresh();
      },
      onDisconnected: startFallback,
    });
    return () => {
      stopFallback();
      unsubscribe();
    };
  }, [fallbackPollIntervalMs, stream]);

  return sequence;
}
