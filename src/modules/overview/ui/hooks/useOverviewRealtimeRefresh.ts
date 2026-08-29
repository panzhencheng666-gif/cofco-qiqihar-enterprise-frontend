import { useEffect, useRef, useState } from "react";

import type {
  OverviewBusinessChange,
  OverviewRealtimeStream,
} from "../../application/ports/OverviewRealtimeStream";

const FALLBACK_POLL_INTERVAL_MS = 30_000;
const REALTIME_REFRESH_DEBOUNCE_MS = 500;

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
    let refreshTimer: number | undefined;
    let pendingBusinessRefresh = false;
    let pendingSamplePointRefresh = false;
    let pendingOptionRefresh = false;
    const flushRefresh = () => {
      refreshTimer = undefined;
      const refreshBusiness = pendingBusinessRefresh;
      const refreshSamplePoints = pendingSamplePointRefresh;
      const refreshOptions = pendingOptionRefresh;
      pendingBusinessRefresh = false;
      pendingSamplePointRefresh = false;
      pendingOptionRefresh = false;
      if (refreshBusiness) setBusinessSequence((current) => current + 1);
      if (refreshSamplePoints) setSamplePointSequence((current) => current + 1);
      if (refreshOptions) setOptionSequence((current) => current + 1);
    };
    const scheduleRefresh = ({
      business = false,
      samplePoints = false,
      options = false,
    }: {
      business?: boolean;
      samplePoints?: boolean;
      options?: boolean;
    }) => {
      pendingBusinessRefresh ||= business;
      pendingSamplePointRefresh ||= samplePoints;
      pendingOptionRefresh ||= options;
      if (refreshTimer !== undefined) window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(flushRefresh, REALTIME_REFRESH_DEBOUNCE_MS);
    };
    const refreshAll = () => {
      scheduleRefresh({ business: true, samplePoints: true, options: true });
    };
    const refreshChange = (change: OverviewBusinessChange) => {
      const currentSelection = selectionRef.current;
      const selectedRegions = currentSelection.regionKey
        ? currentSelection.regionKey.split("|")
        : [];
      const affectsSelection = affectsYearAndRegion(
        change,
        currentSelection.year,
        selectedRegions,
      );
      const affectsProduct =
        change.productCode === undefined ||
        change.productCode === currentSelection.productCode;
      if (change.aggregateType === "SAMPLE_NETWORK_YEAR") {
        scheduleRefresh({
          options: true,
          samplePoints: affectsSelection,
        });
        return;
      }
      scheduleRefresh({
        options: true,
        samplePoints: affectsSelection && affectsProduct,
        business: affectsSelection && affectsProduct,
      });
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
      if (refreshTimer !== undefined) window.clearTimeout(refreshTimer);
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
  if (year === undefined) return false;
  if (change.surveyYear !== undefined && change.surveyYear !== year) return false;
  return (
    change.regionCodes.length === 0 ||
    selectedRegions.length === 0 ||
    change.regionCodes.some((regionCode) => selectedRegions.includes(regionCode))
  );
}
