import { useEffect, useMemo, useState } from "react";

import type { OverviewSamplePointRepository } from "../../application/ports/OverviewSamplePointRepository";
import type {
  OverviewSamplePointIcon,
  SampleNetworkComparison,
  SampleNetworkLayerMode,
} from "../../domain/overviewSamplePoint";
import { sampleNetworkLayerIcons } from "../presentation/sampleNetworkLayers";

export type SampleNetworkLoadState = "idle" | "loading" | "ready" | "unavailable";

type RegionLevel = "PREFECTURE" | "COUNTY" | "TOWNSHIP" | "VILLAGE";

export interface OverviewSampleNetworkRegion {
  code: string;
  level: RegionLevel;
  name: string;
  parentCode?: string;
}

export interface OverviewSampleNetworkLayerModel {
  comparison: SampleNetworkComparison | undefined;
  icons: readonly OverviewSamplePointIcon[];
  issue: string | undefined;
  mode: SampleNetworkLayerMode;
  region: OverviewSampleNetworkRegion | undefined;
  setMode: (mode: SampleNetworkLayerMode) => void;
  setShowExactDesignLocations: (show: boolean) => void;
  showExactDesignLocations: boolean;
  state: SampleNetworkLoadState;
}

export function useOverviewSampleNetworkLayers({
  actualIcons,
  productCode,
  refreshSequence,
  region,
  repository,
  year,
}: {
  actualIcons: readonly OverviewSamplePointIcon[];
  productCode: string;
  refreshSequence: number;
  region: OverviewSampleNetworkRegion | undefined;
  repository: OverviewSamplePointRepository | undefined;
  year: number | undefined;
}): OverviewSampleNetworkLayerModel {
  const [mode, setMode] = useState<SampleNetworkLayerMode>("comparison");
  const [showExactDesignLocations, setShowExactDesignLocations] = useState(false);
  const [comparison, setComparison] = useState<SampleNetworkComparison>();
  const [state, setState] = useState<SampleNetworkLoadState>("idle");
  const [issue, setIssue] = useState<string>();
  const comparisonRegionCode =
    region?.level === "VILLAGE" ? region.parentCode : region?.code;
  const canLoad = Boolean(
    repository && productCode && year !== undefined && comparisonRegionCode,
  );

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (!active) return;
      setComparison(undefined);
      setState(canLoad ? "loading" : "idle");
      setIssue(undefined);
    });
    if (!canLoad || !repository || year === undefined || !comparisonRegionCode) {
      return () => {
        active = false;
      };
    }
    repository
      .comparison({ productCode, regionCode: comparisonRegionCode, year })
      .then((next) => {
        if (!active) return;
        setComparison(next);
        setState("ready");
      })
      .catch(() => {
        if (!active) return;
        setComparison(undefined);
        setState("unavailable");
        setIssue("设计样本点与年度样本网络加载失败，请稍后重试。");
      });
    return () => {
      active = false;
    };
  }, [canLoad, comparisonRegionCode, productCode, refreshSequence, repository, year]);

  const icons = useMemo(() => {
    if (!region) return [];
    const missingVillageParent = region.level === "VILLAGE" && !region.parentCode;
    if (missingVillageParent && mode !== "actual") return [];
    return sampleNetworkLayerIcons(mode, actualIcons, comparison, {
      regionLevel: region.level,
      selectedRegionCode: region.code,
      ...(comparisonRegionCode
        ? { summaryAnchorRegionCode: comparisonRegionCode }
        : {}),
      showExactDesignLocations,
    });
  }, [
    actualIcons,
    comparison,
    comparisonRegionCode,
    mode,
    region,
    showExactDesignLocations,
  ]);

  return {
    comparison,
    icons,
    issue,
    mode,
    region,
    setMode,
    setShowExactDesignLocations,
    showExactDesignLocations,
    state,
  };
}
