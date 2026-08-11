import { useEffect, useRef, useState } from "react";

import type {
  OverviewBusinessChange,
  OverviewRealtimeStream,
} from "../../application/ports/OverviewRealtimeStream";

const FALLBACK_POLL_INTERVAL_MS = 30_000;

export function useOverviewRealtimeRefresh(
  stream: OverviewRealtimeStream,
  selection: {
    productCode: string;
    regionCodes: readonly string[];
    year?: number;
  },
  fallbackPollIntervalMs = FALLBACK_POLL_INTERVAL_MS,
) {
  const [businessSequence, setBusinessSequence] = useState(0);
  const [samplePointSequence, setSamplePointSequence] = useState(0);
  const [optionSequence, setOptionSequence] = useState(0);
  const regionKey = [...selection.regionCodes].sort().join("|");
  const selectionRef = useRef({
    productCode: selection.productCode,
    regionKey,
    year: selection.year,
  });

  useEffect(() => {
    selectionRef.current = {
      productCode: selection.productCode,
      regionKey,
      year: selection.year,
    };
  }, [regionKey, selection.productCode, selection.year]);

  useEffect(() => {
    let fallbackTimer: number | undefined;
    const refreshAll = () => {
      setBusinessSequence((current) => current + 1);
      setSamplePointSequence((current) => current + 1);
      setOptionSequence((current) => current + 1);
    };
    const refreshChange = (change: OverviewBusinessChange) => {
      const currentSelection = selectionRef.current;
      const selectedRegions = currentSelection.regionKey
        ? currentSelection.regionKey.split("|")
        : [];
      setOptionSequence((current) => current + 1);
      if (!affectsYearAndRegion(change, currentSelection.year, selectedRegions)) return;
      setSamplePointSequence((current) => current + 1);
      if (change.productCode === currentSelection.productCode) {
        setBusinessSequence((current) => current + 1);
      }
    };
    const stopFallback = () => {
      if (fallbackTimer === undefined) return;
      window.clearInterval(fallbackTimer);
      fallbackTimer = undefined;
    };
    const startFallback = () => {
      if (fallbackTimer !== undefined) return;
      fallbackTimer = window.setInterval(refreshAll, fallbackPollIntervalMs);
    };
    const unsubscribe = stream.subscribe({
      onBusinessChange: refreshChange,
      onConnected: () => {
        stopFallback();
        refreshAll();
      },
      onDisconnected: startFallback,
    });
    return () => {
      stopFallback();
      unsubscribe();
    };
  }, [fallbackPollIntervalMs, stream]);

  return { businessSequence, optionSequence, samplePointSequence };
}

function affectsYearAndRegion(
  change: OverviewBusinessChange,
  year: number | undefined,
  selectedRegions: readonly string[],
) {
  if (year === undefined || change.surveyYear !== year) return false;
  return (
    selectedRegions.length === 0 ||
    change.regionCodes.some((regionCode) => selectedRegions.includes(regionCode))
  );
}
