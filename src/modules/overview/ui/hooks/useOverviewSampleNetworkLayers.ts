import { useCallback, useEffect, useMemo, useState } from "react";

import type { OverviewSamplePointRepository } from "../../application/ports/OverviewSamplePointRepository";
import type {
  OverviewSamplePointCategoryCode,
  OverviewSamplePointIcon,
  OverviewSamplePointList,
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
  applicable: boolean;
  catalog: OverviewSamplePointList | undefined;
  catalogState: SampleNetworkLoadState;
  categoryCode: OverviewSamplePointCategoryCode | undefined;
  comparison: SampleNetworkComparison | undefined;
  icons: readonly OverviewSamplePointIcon[];
  issue: string | undefined;
  mode: SampleNetworkLayerMode;
  region: OverviewSampleNetworkRegion | undefined;
  setCategoryCode: (categoryCode: OverviewSamplePointCategoryCode | undefined) => void;
  setMode: (mode: SampleNetworkLayerMode) => void;
  setShowExactDesignLocations: (show: boolean) => void;
  showExactDesignLocations: boolean;
  state: SampleNetworkLoadState;
  setTypeCode: (typeCode: string | undefined) => void;
  typeCode: string | undefined;
}

export function useOverviewSampleNetworkLayers({
  productCode,
  refreshSequence,
  region,
  repository,
  year,
}: {
  productCode: string;
  refreshSequence: number;
  region: OverviewSampleNetworkRegion | undefined;
  repository: OverviewSamplePointRepository | undefined;
  year: number | undefined;
}): OverviewSampleNetworkLayerModel {
  const applicable = year !== undefined && year >= 2026;
  const filterScopeKey = `${productCode}:${year ?? ""}`;
  const [mode, setMode] = useState<SampleNetworkLayerMode>("comparison");
  const [filterStateScopeKey, setFilterStateScopeKey] = useState(filterScopeKey);
  const [storedCategoryCode, setCategoryCodeState] =
    useState<OverviewSamplePointCategoryCode>();
  const [storedTypeCode, setTypeCodeState] = useState<string>();
  const [catalog, setCatalog] = useState<OverviewSamplePointList>();
  const [catalogState, setCatalogState] = useState<SampleNetworkLoadState>("idle");
  const [catalogIssue, setCatalogIssue] = useState<string>();
  const [actualIcons, setActualIcons] = useState<readonly OverviewSamplePointIcon[]>(
    [],
  );
  const [showExactDesignLocations, setShowExactDesignLocations] = useState(false);
  const [comparison, setComparison] = useState<SampleNetworkComparison>();
  const [state, setState] = useState<SampleNetworkLoadState>("idle");
  const [issue, setIssue] = useState<string>();
  const categoryCode =
    filterStateScopeKey === filterScopeKey ? storedCategoryCode : undefined;
  const typeCode = filterStateScopeKey === filterScopeKey ? storedTypeCode : undefined;
  const comparisonRegionCode =
    region?.level === "VILLAGE" ? region.parentCode : region?.code;
  const canLoad = Boolean(
    applicable && repository && productCode && comparisonRegionCode,
  );

  const setCategoryCode = useCallback(
    (next: OverviewSamplePointCategoryCode | undefined) => {
      setFilterStateScopeKey(filterScopeKey);
      setCategoryCodeState(next);
      setTypeCodeState(undefined);
    },
    [filterScopeKey],
  );
  const setTypeCode = useCallback(
    (next: string | undefined) => {
      setFilterStateScopeKey(filterScopeKey);
      setTypeCodeState(next);
    },
    [filterScopeKey],
  );

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (!active) return;
      setFilterStateScopeKey(filterScopeKey);
      setCategoryCodeState(undefined);
      setTypeCodeState(undefined);
    });
    return () => {
      active = false;
    };
  }, [filterScopeKey]);

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

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (!active) return;
      setCatalog(undefined);
      setCatalogState(canLoad ? "loading" : "idle");
      setCatalogIssue(undefined);
      setActualIcons([]);
    });
    if (!canLoad || !repository || year === undefined || !region) {
      return () => {
        active = false;
      };
    }
    repository
      .list({ productCode, regionCode: region.code, year })
      .then((next) => {
        if (!active) return;
        setCatalog(next);
        setCatalogState("ready");
      })
      .catch(() => {
        if (!active) return;
        setCatalog(undefined);
        setCatalogState("unavailable");
        setCatalogIssue("样本点分类加载失败，请稍后重试。");
      });
    return () => {
      active = false;
    };
  }, [canLoad, productCode, refreshSequence, region, repository, year]);

  const selectedCategory = catalog?.categories.find(
    (category) => category.code === categoryCode,
  );
  const actualKindCodes = useMemo(
    () =>
      categoryCode
        ? typeCode
          ? [typeCode]
          : (selectedCategory?.types.map(({ code }) => code) ?? [])
        : undefined,
    [categoryCode, selectedCategory, typeCode],
  );

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (!active) return;
      setActualIcons([]);
    });
    if (!canLoad || !repository || year === undefined || !region || !categoryCode) {
      return () => {
        active = false;
      };
    }
    repository
      .icons({
        categoryCode,
        productCode,
        regionCode: region.code,
        year,
        ...(typeCode ? { typeCode } : {}),
      })
      .then((next) => {
        if (!active) return;
        setActualIcons(next);
      })
      .catch(() => {
        if (!active) return;
        setActualIcons([]);
      });
    return () => {
      active = false;
    };
  }, [
    canLoad,
    categoryCode,
    productCode,
    refreshSequence,
    region,
    repository,
    typeCode,
    year,
  ]);

  const icons = useMemo(() => {
    if (!region) return [];
    const missingVillageParent = region.level === "VILLAGE" && !region.parentCode;
    if (missingVillageParent && mode !== "actual") return [];
    return sampleNetworkLayerIcons(mode, actualIcons, comparison, {
      ...(actualKindCodes ? { actualKindCodes } : {}),
      regionLevel: region.level,
      selectedRegionCode: region.code,
      ...(comparisonRegionCode
        ? { summaryAnchorRegionCode: comparisonRegionCode }
        : {}),
      showExactDesignLocations,
    });
  }, [
    actualIcons,
    actualKindCodes,
    comparison,
    comparisonRegionCode,
    mode,
    region,
    showExactDesignLocations,
  ]);

  return {
    applicable,
    catalog,
    catalogState,
    categoryCode,
    comparison,
    icons,
    issue: catalogIssue ?? issue,
    mode,
    region,
    setCategoryCode,
    setMode,
    setShowExactDesignLocations,
    showExactDesignLocations,
    state,
    setTypeCode,
    typeCode,
  };
}
