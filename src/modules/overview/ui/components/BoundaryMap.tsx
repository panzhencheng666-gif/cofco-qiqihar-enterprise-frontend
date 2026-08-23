import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";

import type { OverviewRegion } from "../../domain/overview";
import type {
  OverviewSamplePointAggregate,
  OverviewSamplePointIcon,
} from "../../domain/overviewSamplePoint";
import { samplePointAggregateLabel } from "../presentation/samplePointAggregateRing";
import { publicAssetUrl } from "../../../../shared/assets/publicAssetUrl";
import {
  flattenCoordinates,
  type MapFeature,
  type MapPointFeature,
  type OverviewMapCommand,
  type OverviewMapSelectionPoint,
} from "./boundaryGeometry";

const TerrainReliefBoundaryMap = lazy(() => import("./TerrainReliefBoundaryMap"));

export { toMapFeature, toMapPointFeature } from "./boundaryGeometry";
export type { OverviewMapCommand, OverviewMapSelectionPoint } from "./boundaryGeometry";

export type SamplePointAggregateStatus = "hidden" | "loading" | "ready" | "unavailable";

const EMPTY_SAMPLE_POINT_AGGREGATES: readonly OverviewSamplePointAggregate[] = [];
const EMPTY_SAMPLE_POINT_ICONS: readonly OverviewSamplePointIcon[] = [];

export function BoundaryMap({
  backdrop,
  features,
  onDrill,
  onSamplePointSelect,
  onSelect,
  onSelectionPosition,
  points,
  samplePointAggregates = EMPTY_SAMPLE_POINT_AGGREGATES,
  samplePointAggregateStatus,
  samplePointIcons = EMPTY_SAMPLE_POINT_ICONS,
  selectedCode,
  selectedSamplePointId,
  command,
}: {
  backdrop?: MapFeature;
  features: readonly MapFeature[];
  onDrill: (region: OverviewRegion) => void;
  onSamplePointSelect?: (samplePointId: string) => void;
  onSelect: (region: OverviewRegion) => void;
  onSelectionPosition?: (position: OverviewMapSelectionPoint | undefined) => void;
  points: readonly MapPointFeature[];
  samplePointAggregates?: readonly OverviewSamplePointAggregate[];
  samplePointAggregateStatus?: SamplePointAggregateStatus;
  samplePointIcons?: readonly OverviewSamplePointIcon[];
  selectedCode: string;
  selectedSamplePointId?: string;
  command?: OverviewMapCommand;
}) {
  const [webGlEnabled, setWebGlEnabled] = useState(canRenderWebGlMap);
  const [fallbackReason, setFallbackReason] = useState("");
  const sceneRevision = useMemo(
    () => ({ backdrop, features, points, samplePointAggregates, samplePointIcons }),
    [backdrop, features, points, samplePointAggregates, samplePointIcons],
  );
  const [readySceneRevision, setReadySceneRevision] = useState<object>();
  const sceneReady = readySceneRevision === sceneRevision;
  const activateFallback = useCallback((reason: string) => {
    setFallbackReason(reason);
    setWebGlEnabled(false);
  }, []);
  const confirmSceneReady = useCallback(
    () => setReadySceneRevision(sceneRevision),
    [sceneRevision],
  );
  useEffect(() => {
    if (!webGlEnabled || sceneReady) return;
    const timeout = window.setTimeout(
      () => activateFallback("三维引擎初始化超时"),
      30000,
    );
    return () => window.clearTimeout(timeout);
  }, [activateFallback, sceneReady, webGlEnabled]);
  const bounds = mapBounds(features, points, backdrop);
  if ((!features.length && !points.length && !backdrop) || !bounds) {
    return (
      <p className="overview-empty">当前范围尚无可显示的经核验行政区边界或来源点位。</p>
    );
  }
  if (!webGlEnabled) {
    return (
      <div className="overview-map-fallback">
        <TerrainScenePlaceholder
          message="三维地表场景暂不可用"
          reason={fallbackReason}
        />
        <BoundaryMapAccessibility
          features={features}
          points={points}
          samplePointAggregates={samplePointAggregates}
          samplePointIcons={samplePointIcons}
          {...(onSamplePointSelect ? { onSamplePointSelect } : {})}
          {...(selectedSamplePointId ? { selectedSamplePointId } : {})}
          {...(samplePointAggregateStatus ? { samplePointAggregateStatus } : {})}
          onDrill={onDrill}
          onSelect={onSelect}
        />
      </div>
    );
  }
  return (
    <Suspense
      fallback={
        <div className="overview-map-loading" role="status">
          <TerrainScenePlaceholder message="正在建立地面一体化地理场景" />
          <BoundaryMapAccessibility
            features={features}
            points={points}
            samplePointAggregates={samplePointAggregates}
            samplePointIcons={samplePointIcons}
            {...(onSamplePointSelect ? { onSamplePointSelect } : {})}
            {...(selectedSamplePointId ? { selectedSamplePointId } : {})}
            {...(samplePointAggregateStatus ? { samplePointAggregateStatus } : {})}
            onDrill={onDrill}
            onSelect={onSelect}
          />
        </div>
      }
    >
      <TerrainReliefBoundaryMap
        {...(backdrop ? { backdrop } : {})}
        {...(command ? { command } : {})}
        features={features}
        points={points}
        samplePointAggregates={samplePointAggregates}
        {...(samplePointAggregateStatus ? { samplePointAggregateStatus } : {})}
        samplePointIcons={samplePointIcons}
        {...(onSamplePointSelect ? { onSamplePointSelect } : {})}
        {...(selectedSamplePointId ? { selectedSamplePointId } : {})}
        selectedCode={selectedCode}
        onDrill={onDrill}
        onSelect={onSelect}
        {...(onSelectionPosition ? { onSelectionPosition } : {})}
        onUnavailable={activateFallback}
        onReady={confirmSceneReady}
      />
      {!sceneReady && (
        <div
          className="overview-terrain-readiness-overlay"
          data-style-state="preparing"
          role="status"
        >
          <TerrainScenePlaceholder message="正在完成地表首帧，请稍候" />
        </div>
      )}
    </Suspense>
  );
}

function BoundaryMapAccessibility({
  features,
  points,
  samplePointAggregates,
  samplePointIcons,
  onSamplePointSelect,
  selectedSamplePointId,
  samplePointAggregateStatus,
  onDrill,
  onSelect,
}: {
  features: readonly MapFeature[];
  points: readonly MapPointFeature[];
  samplePointAggregates: readonly OverviewSamplePointAggregate[];
  samplePointIcons: readonly OverviewSamplePointIcon[];
  onSamplePointSelect?: (samplePointId: string) => void;
  selectedSamplePointId?: string;
  samplePointAggregateStatus?: SamplePointAggregateStatus;
  onDrill: (region: OverviewRegion) => void;
  onSelect: (region: OverviewRegion) => void;
}) {
  return (
    <div className="overview-map-accessibility-layer overview-sr-only">
      <span aria-label="行政区边界地图" role="img" />
      {features.map(({ region }) => (
        <button
          aria-label={accessibleRegionLabel(
            region,
            samplePointAggregates,
            samplePointAggregateStatus,
          )}
          key={`accessible-boundary-${region.code}`}
          onClick={() => onSelect(region)}
          onDoubleClick={() => onDrill(region)}
          type="button"
        />
      ))}
      {points.map(({ region }) => (
        <button
          aria-label={`${region.name}，${locationStatusLabel(region.locationReviewStatus)}`}
          key={`accessible-point-${region.code}`}
          onClick={() => onSelect(region)}
          onDoubleClick={() => onDrill(region)}
          type="button"
        />
      ))}
      {samplePointIcons.map((icon) => (
        <button
          aria-label={
            icon.layerType === "DESIGN_COVERAGE_BADGE"
              ? `${icon.name}，行政村展示分区覆盖徽标，不代表精确经纬度`
              : icon.layerType === "DESIGN_EXACT_LOCATION"
                ? `${icon.name}，已审核设计样本点精确位置`
                : icon.layerType === "REGIONAL_ACTUAL_BADGE"
                  ? `${icon.name}，仅确认到行政区域，不显示伪造图钉`
                  : `${icon.name}，${icon.types.map((type) => type.name).join("、")}，点击查看样本点详情`
          }
          aria-pressed={
            icon.layerType && icon.layerType !== "ANNUAL_ACTUAL"
              ? undefined
              : selectedSamplePointId === icon.samplePointId
          }
          key={`accessible-sample-point-${icon.samplePointId}`}
          onClick={
            icon.layerType && icon.layerType !== "ANNUAL_ACTUAL"
              ? undefined
              : () => onSamplePointSelect?.(icon.samplePointId)
          }
          type="button"
        />
      ))}
    </div>
  );
}

function accessibleRegionLabel(
  region: OverviewRegion,
  aggregates: readonly OverviewSamplePointAggregate[],
  status?: SamplePointAggregateStatus,
) {
  if (!status) {
    return region.approvedRecordCount === null
      ? `${region.name}，年度业务统计加载中`
      : `${region.name}，已核定 ${region.approvedRecordCount} 条`;
  }
  if (status === "hidden") return region.name;
  if (status === "loading") return `${region.name}，样本点聚合数据加载中`;
  if (status === "unavailable") return `${region.name}，样本点聚合数据不可用`;
  const aggregate = aggregates.find(({ regionCode }) => regionCode === region.code);
  return aggregate
    ? `${region.name}，${samplePointAggregateLabel(aggregate)}`
    : `${region.name}，样本点聚合数据不可用`;
}

/**
 * Never substitute a low-fidelity polygon map while the real relief engine is
 * loading. A full-frame copy of the registered terrain keeps the composition
 * stable without inventing a second visual path that can be mistaken for the
 * finished map.
 */
function TerrainScenePlaceholder({
  message,
  reason,
}: {
  message: string;
  reason?: string;
}) {
  return (
    <div className="overview-terrain-placeholder">
      <img
        alt=""
        aria-hidden="true"
        src={publicAssetUrl("overview/command-terrain-v2.webp")}
      />
      <span title={reason || undefined}>{message}</span>
    </div>
  );
}

function canRenderWebGlMap() {
  if (
    typeof window === "undefined" ||
    typeof document === "undefined" ||
    typeof ResizeObserver === "undefined"
  ) {
    return false;
  }
  const canvas = document.createElement("canvas");
  return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
}

function mapBounds(
  features: readonly MapFeature[],
  pointFeatures: readonly MapPointFeature[],
  backdrop?: MapFeature,
) {
  const positions = [
    ...(backdrop ? flattenCoordinates(backdrop.geometry) : []),
    ...features.flatMap(({ geometry }) => flattenCoordinates(geometry)),
    ...pointFeatures.map(({ position }) => position),
  ];
  if (!positions.length) return undefined;
  const xs = positions.map(([x]) => x);
  const ys = positions.map(([, y]) => y);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}

function locationStatusLabel(status?: string) {
  if (status === "DERIVED_FROM_VILLAGE_POINTS") return "位置由村点推导";
  if (status === "AUTO_MATCHED_PENDING_SPATIAL_QA") return "来源点位待空间校核";
  return "来源点位";
}
