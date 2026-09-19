import "./realistic-operational-situation.css";

import { lazy, Suspense, useEffect, useMemo, useState } from "react";

import type {
  OperationalFacilityCatalogue,
  StorageFacilityRelation,
} from "../../domain/operationalFacilities";
import type { OperationalSituationCatalogue } from "../../domain/operationalSituation";
import type { OverviewRegion } from "../../domain/overview";
import type { MapFeature } from "./boundaryGeometry";
import type {
  RealisticSceneCommand,
  RealisticSceneLayers,
} from "./RealisticOperationalSituationMap";
import { focusDepotCategory } from "./realisticSituationModel";
import {
  operationalSituationTimeline,
  type SituationTimelineItem,
} from "./operationalSituationTimeline";

const RealisticOperationalSituationMap = lazy(
  () => import("./RealisticOperationalSituationMap"),
);

export interface SituationMapBounds {
  maxLatitude: number;
  maxLongitude: number;
  minLatitude: number;
  minLongitude: number;
}

const DEFAULT_LAYERS: RealisticSceneLayers = {
  ADMINISTRATIVE: true,
  WEATHER: true,
  OWNED: true,
  LEASED: true,
  HISTORICAL_LEASED: true,
  RAILWAY: true,
  RAILWAY_ROUTE: true,
  LOGISTICS: true,
  INVENTORY: true,
};

const DEPOT_FILTERS: readonly {
  code: StorageFacilityRelation;
  label: string;
  shortLabel: string;
}[] = [
  { code: "OWNED", label: "自有库", shortLabel: "自" },
  { code: "LEASED", label: "租赁库", shortLabel: "租" },
  { code: "HISTORICAL_LEASED", label: "历史租赁库", shortLabel: "历" },
];

export function OperationalSituationMap({
  backdrop,
  bounds,
  canReturnToParent = false,
  facilities,
  features,
  onFacilitySelect,
  annotationActive = false,
  onAnnotationToggle,
  onRegionDrill,
  onRegionSelect,
  onReturnToParent,
  onTimelineSelect,
  selectedFacilityId,
  selectedRegionCode,
  situation,
}: {
  backdrop?: MapFeature;
  bounds: SituationMapBounds;
  canReturnToParent?: boolean;
  facilities: OperationalFacilityCatalogue;
  features: readonly MapFeature[];
  onFacilitySelect: (id: string) => void;
  annotationActive?: boolean;
  onAnnotationToggle?: () => void;
  onRegionDrill: (region: OverviewRegion) => void;
  onRegionSelect: (region: OverviewRegion) => void;
  onReturnToParent: () => void;
  onTimelineSelect?: (item: SituationTimelineItem | undefined) => void;
  selectedFacilityId?: string;
  selectedRegionCode?: string;
  situation: OperationalSituationCatalogue;
}) {
  const [layers, setLayers] = useState(DEFAULT_LAYERS);
  const [layerMenuOpen, setLayerMenuOpen] = useState(false);
  const [tiltDegrees, setTiltDegrees] = useState(52);
  const [command, setCommand] = useState<RealisticSceneCommand>();
  const timeline = useMemo(
    () => operationalSituationTimeline(situation, facilities),
    [facilities, situation],
  );
  const [timelineIndex, setTimelineIndex] = useState(() =>
    Math.max(0, timeline.length - 1),
  );
  const [timelineTouched, setTimelineTouched] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const boundedTimelineIndex = timelineTouched
    ? Math.min(timelineIndex, Math.max(0, timeline.length - 1))
    : Math.max(0, timeline.length - 1);
  const selectedTimeline = timeline[boundedTimelineIndex];
  const selectedTime = selectedTimeline?.occurredAt ?? situation.generatedAt;
  const visibleSituation = useMemo(
    () => ({
      ...situation,
      weather: situation.weather.filter(
        (item) => Date.parse(item.observedAt) <= Date.parse(selectedTime),
      ),
      publicEvents: situation.publicEvents.filter(
        (item) => Date.parse(item.observedAt) <= Date.parse(selectedTime),
      ),
      policyEvents: situation.policyEvents.filter(
        (item) =>
          item.publishedOn === null ||
          Date.parse(`${item.publishedOn}T00:00:00+08:00`) <= Date.parse(selectedTime),
      ),
      logisticsFlows: (situation.logisticsFlows ?? []).filter(
        (item) => Date.parse(item.occurredAt) <= Date.parse(selectedTime),
      ),
      inventories: (situation.inventories ?? []).filter(
        (item) => Date.parse(item.observedAt) <= Date.parse(selectedTime),
      ),
    }),
    [selectedTime, situation],
  );
  const currentLevel = features[0]?.region.level ?? backdrop?.region.level;

  useTimelinePlayback({
    playbackSpeed,
    playing,
    setPlaying,
    setTimelineIndex,
    timelineLength: timeline.length,
  });

  useEffect(() => {
    onTimelineSelect?.(selectedTimeline);
  }, [onTimelineSelect, selectedTimeline]);

  function issueCommand(type: RealisticSceneCommand["type"], tilt?: number) {
    setCommand({
      id: Date.now(),
      type,
      ...(tilt === undefined ? {} : { tiltDegrees: tilt }),
    });
  }

  function focusDepot(category: StorageFacilityRelation) {
    setLayers((current) => ({ ...current, ...focusDepotCategory(category) }));
  }

  function showAllDepots() {
    setLayers((current) => ({
      ...current,
      OWNED: true,
      LEASED: true,
      HISTORICAL_LEASED: true,
    }));
  }

  return (
    <section className="realistic-situation-layer" aria-label="公开运营态势地图">
      <Suspense
        fallback={
          <div className="realistic-situation-loading" role="status">
            <strong>正在建立写实三维地理场景</strong>
            <span>行政边界与本地地表将先出现，在线影像与地形随后增强。</span>
          </div>
        }
      >
        <RealisticOperationalSituationMap
          {...(backdrop ? { backdrop } : {})}
          bounds={bounds}
          {...(command ? { command } : {})}
          facilities={facilities}
          features={features}
          layers={layers}
          onFacilitySelect={onFacilitySelect}
          onRegionDrill={onRegionDrill}
          onRegionSelect={onRegionSelect}
          {...(selectedFacilityId ? { selectedFacilityId } : {})}
          {...(selectedRegionCode ? { selectedRegionCode } : {})}
          situation={visibleSituation}
        />
      </Suspense>

      <nav className="realistic-situation-filters" aria-label="公开态势筛选">
        <button
          aria-pressed={layers.WEATHER}
          type="button"
          onClick={() =>
            setLayers((current) => ({ ...current, WEATHER: !current.WEATHER }))
          }
        >
          实时天气
        </button>
        <button
          aria-pressed={layers.LOGISTICS}
          type="button"
          onClick={() =>
            setLayers((current) => ({ ...current, LOGISTICS: !current.LOGISTICS }))
          }
        >
          物流流向
        </button>
        <button
          aria-pressed={layers.INVENTORY}
          type="button"
          onClick={() =>
            setLayers((current) => ({ ...current, INVENTORY: !current.INVENTORY }))
          }
        >
          库存变化
        </button>
        <button
          aria-expanded={layerMenuOpen}
          type="button"
          onClick={() => setLayerMenuOpen((current) => !current)}
        >
          节点图层
        </button>
      </nav>

      {layerMenuOpen && (
        <section className="realistic-situation-layer-menu" aria-label="节点图层">
          <header>
            <strong>节点图层</strong>
            <button type="button" onClick={showAllDepots}>
              全部库点
            </button>
          </header>
          {DEPOT_FILTERS.map(({ code, label, shortLabel }) => (
            <button
              aria-pressed={layers[code]}
              className={`is-${code.toLowerCase()}`}
              key={code}
              type="button"
              onClick={() => focusDepot(code)}
            >
              <span aria-hidden="true">{shortLabel}</span>
              {label}
              <b>
                {
                  facilities.storageFacilities.filter(
                    (facility) => facility.relationType === code,
                  ).length
                }
              </b>
            </button>
          ))}
          <label>
            <input
              checked={layers.RAILWAY}
              type="checkbox"
              onChange={(event) =>
                setLayers((current) => ({ ...current, RAILWAY: event.target.checked }))
              }
            />
            <span className="is-locomotive" aria-hidden="true">
              ▰
            </span>
            白色内燃机车站点
            <b>{facilities.railwayFacilities.length}</b>
          </label>
          <label>
            <input
              checked={layers.RAILWAY_ROUTE}
              type="checkbox"
              onChange={(event) =>
                setLayers((current) => ({
                  ...current,
                  RAILWAY_ROUTE: event.target.checked,
                }))
              }
            />
            <span aria-hidden="true">—</span>
            铁路路径
            <b>{facilities.railwayRoutes.length}</b>
          </label>
        </section>
      )}

      <div className="realistic-situation-tools" aria-label="三维地图工具">
        {onAnnotationToggle && (
          <button
            aria-pressed={annotationActive}
            type="button"
            onClick={onAnnotationToggle}
          >
            标注
          </button>
        )}
        <button
          type="button"
          aria-label="放大地图"
          onClick={() => issueCommand("ZOOM_IN")}
        >
          ＋
        </button>
        <button
          type="button"
          aria-label="缩小地图"
          onClick={() => issueCommand("ZOOM_OUT")}
        >
          －
        </button>
        {canReturnToParent && (
          <button type="button" onClick={onReturnToParent}>
            返回上级
          </button>
        )}
        <button type="button" onClick={() => issueCommand("RESET")}>
          复位
        </button>
        <label>
          <span>俯视角 {tiltDegrees}°</span>
          <input
            aria-label="态势地图俯视角"
            max="78"
            min="30"
            step="4"
            type="range"
            value={tiltDegrees}
            onChange={(event) => {
              const next = Number(event.target.value);
              setTiltDegrees(next);
              issueCommand("SET_TILT", next);
            }}
          />
        </label>
      </div>

      <p className="realistic-situation-caption">
        {levelLabel(currentLevel)} ·
        单击查看，双击下钻；缩放将自动切换市、县、乡镇和村级信息。
      </p>

      <section className="realistic-situation-timeline" aria-label="真实态势时间轴">
        <button
          aria-label={playing ? "暂停态势播放" : "播放态势记录"}
          disabled={timeline.length < 2}
          type="button"
          onClick={() => {
            setTimelineTouched(true);
            if (!playing && boundedTimelineIndex >= timeline.length - 1)
              setTimelineIndex(0);
            setPlaying((current) => !current);
          }}
        >
          {playing ? "暂停" : "播放"}
        </button>
        <time dateTime={selectedTime}>{formatTimelineTime(selectedTime)}</time>
        <select
          aria-label="态势播放速度"
          value={playbackSpeed}
          onChange={(event) => setPlaybackSpeed(Number(event.target.value))}
        >
          <option value={1}>1×</option>
          <option value={2}>2×</option>
          <option value={4}>4×</option>
        </select>
        <input
          aria-label="态势时间点"
          disabled={!timeline.length}
          max={Math.max(0, timeline.length - 1)}
          min="0"
          type="range"
          value={boundedTimelineIndex}
          onChange={(event) => {
            setTimelineTouched(true);
            setPlaying(false);
            setTimelineIndex(Number(event.target.value));
          }}
        />
        <span>{selectedTimeline?.title ?? "暂无真实事件记录"}</span>
        <b>真实记录</b>
      </section>
    </section>
  );
}

function useTimelinePlayback({
  playbackSpeed,
  playing,
  setPlaying,
  setTimelineIndex,
  timelineLength,
}: {
  playbackSpeed: number;
  playing: boolean;
  setPlaying: (value: boolean) => void;
  setTimelineIndex: (updater: (current: number) => number) => void;
  timelineLength: number;
}) {
  useEffect(() => {
    if (!playing || timelineLength < 2) return undefined;
    const timer = window.setInterval(() => {
      setTimelineIndex((current) => {
        if (current >= timelineLength - 1) {
          setPlaying(false);
          return current;
        }
        return current + 1;
      });
    }, 1800 / playbackSpeed);
    return () => window.clearInterval(timer);
  }, [playbackSpeed, playing, setPlaying, setTimelineIndex, timelineLength]);
}

function levelLabel(level: OverviewRegion["level"] | undefined) {
  if (level === "VILLAGE") return "行政村级写实视图";
  if (level === "TOWNSHIP") return "乡镇级写实视图";
  if (level === "COUNTY") return "县级写实视图";
  return "四区域三维总览";
}

function formatTimelineTime(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(parsed);
}
