import "./realistic-operational-situation.css";

import { lazy, Suspense, useEffect, useEffectEvent, useMemo, useState } from "react";

import type {
  MapAnnotation,
  MapAnnotationRepository,
  SaveMapAnnotation,
} from "../../application/ports/MapAnnotationRepository";
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
  TerrainEnhancementState,
} from "./FourRegionTerrainAtlas";
import { focusDepotCategory } from "./realisticSituationModel";
import { weatherObservationFresh } from "./liveWeatherPresentation";
import { weatherSpriteKind } from "./weatherSpriteKind";
import {
  operationalSituationTimeline,
  type SituationTimelineItem,
} from "./operationalSituationTimeline";

const FourRegionTerrainAtlas = lazy(() => import("./FourRegionTerrainAtlas"));
import { PublicRegionSearch, type PublicRegionSearchProps } from "./PublicRegionSearch";

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
  rootFeatures,
  onFacilitySelect,
  annotationActive = false,
  annotationAdministrativeLevel,
  annotationRepository,
  onAnnotationArmedChange,
  onAnnotationToggle,
  onRegionDrill,
  onRegionSelect,
  onReturnToParent,
  onTimelineSelect,
  selectedFacilityId,
  selectedRegionCode,
  situation,
  regionSearch,
}: {
  backdrop?: MapFeature;
  bounds: SituationMapBounds;
  canReturnToParent?: boolean;
  facilities: OperationalFacilityCatalogue;
  features: readonly MapFeature[];
  rootFeatures: readonly MapFeature[];
  onFacilitySelect: (id: string) => void;
  annotationActive?: boolean;
  annotationAdministrativeLevel?: SaveMapAnnotation["administrativeLevel"];
  annotationRepository?: MapAnnotationRepository;
  onAnnotationArmedChange?: (armed: boolean) => void;
  onAnnotationToggle?: () => void;
  onRegionDrill: (region: OverviewRegion) => void;
  onRegionSelect: (region: OverviewRegion) => void;
  onReturnToParent: () => void;
  onTimelineSelect?: (item: SituationTimelineItem | undefined) => void;
  selectedFacilityId?: string;
  selectedRegionCode?: string;
  situation: OperationalSituationCatalogue;
  regionSearch?: Omit<PublicRegionSearchProps, "onSelect">;
}) {
  const [layers, setLayers] = useState(DEFAULT_LAYERS);
  const [layerMenuOpen, setLayerMenuOpen] = useState(false);
  const [enhancementState, setEnhancementState] =
    useState<TerrainEnhancementState>("LOADING");
  const [command, setCommand] = useState<RealisticSceneCommand>();
  const [focusRequest, setFocusRequest] = useState<{
    id: number;
    region: OverviewRegion;
  }>();
  const [weatherClock, setWeatherClock] = useState(Date.now);
  useEffect(() => {
    const timer = window.setInterval(() => setWeatherClock(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const [annotation, setAnnotation] = useState<MapAnnotation>();
  const [annotationDraft, setAnnotationDraft] = useState<readonly [number, number]>();
  const [annotationIssue, setAnnotationIssue] = useState("");
  const [annotationPending, setAnnotationPending] = useState(false);
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

  const notifyTimeline = useEffectEvent((item: SituationTimelineItem | undefined) =>
    onTimelineSelect?.(item),
  );
  useEffect(() => {
    if (timelineTouched) notifyTimeline(selectedTimeline);
  }, [selectedTimeline, timelineTouched]);

  useEffect(() => {
    if (!annotationRepository) return;
    let live = true;
    annotationRepository
      .current()
      .then((value) => {
        if (live) setAnnotation(value);
      })
      .catch(() => {
        if (live) setAnnotationIssue("已保存标注读取失败，请重试。");
      });
    return () => {
      live = false;
    };
  }, [annotationRepository]);

  useEffect(() => {
    onAnnotationArmedChange?.(annotationActive);
    return () => onAnnotationArmedChange?.(false);
  }, [annotationActive, onAnnotationArmedChange]);

  function issueCommand(type: RealisticSceneCommand["type"]) {
    if (type === "RESET") setFocusRequest(undefined);
    setCommand({
      id: Date.now(),
      type,
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

  function toggleAnnotation() {
    setLayerMenuOpen(false);
    setAnnotationDraft(undefined);
    setAnnotationIssue("");
    onAnnotationToggle?.();
  }

  async function persistAnnotation(
    longitude: number,
    latitude: number,
    end?: readonly [number, number],
  ) {
    if (!annotationRepository || annotationPending) return;
    const scope = {
      ...(selectedRegionCode ? { regionCode: selectedRegionCode } : {}),
      ...(annotationAdministrativeLevel
        ? { administrativeLevel: annotationAdministrativeLevel }
        : {}),
    };
    const command: SaveMapAnnotation = !end
      ? {
          type: "POINT",
          minLongitude: longitude,
          minLatitude: latitude,
          ...scope,
        }
      : {
          type: "RECTANGLE",
          minLongitude: Math.min(end[0], longitude),
          minLatitude: Math.min(end[1], latitude),
          maxLongitude: Math.max(end[0], longitude),
          maxLatitude: Math.max(end[1], latitude),
          ...scope,
        };
    setAnnotationPending(true);
    setAnnotationIssue("");
    try {
      setAnnotation(await annotationRepository.save(command));
      setAnnotationDraft(undefined);
      setAnnotationIssue("标注已保存到当前账号。");
    } catch {
      setAnnotationIssue("标注保存失败，请重新选择位置后重试。");
    } finally {
      setAnnotationPending(false);
    }
  }

  async function deleteAnnotation() {
    if (!annotationRepository || annotationPending) return;
    setAnnotationPending(true);
    setAnnotationIssue("");
    try {
      await annotationRepository.delete();
      setAnnotation(undefined);
      setAnnotationDraft(undefined);
      setAnnotationIssue("已删除当前账号保存的地图标注。");
    } catch {
      setAnnotationIssue("标注删除失败，请稍后重试。");
    } finally {
      setAnnotationPending(false);
    }
  }

  return (
    <section className="realistic-situation-layer" aria-label="公开运营态势地图">
      <Suspense
        fallback={
          <div className="realistic-situation-loading" role="status">
            <strong>正在建立四区域地形态势图</strong>
            <span>正在载入四区域边界、卫星地表和业务图层。</span>
          </div>
        }
      >
        <FourRegionTerrainAtlas
          {...(annotation ? { annotation } : {})}
          annotationActive={annotationActive}
          {...(annotationDraft ? { annotationDraft } : {})}
          {...(backdrop ? { backdrop } : {})}
          bounds={bounds}
          {...(command ? { command } : {})}
          {...(focusRequest ? { focusRequest } : {})}
          facilities={facilities}
          features={features}
          rootFeatures={rootFeatures}
          layers={layers}
          onFacilitySelect={onFacilitySelect}
          onEnhancementState={setEnhancementState}
          onAnnotationPosition={(longitude, latitude) => {
            void persistAnnotation(longitude, latitude);
          }}
          onAnnotationRectangle={(start, end) => {
            void persistAnnotation(start[0], start[1], end);
          }}
          onRegionDrill={(region) => {
            setFocusRequest(undefined);
            onRegionDrill(region);
          }}
          onRegionSelect={(region) => {
            setPlaying(false);
            setTimelineTouched(false);
            onRegionSelect(region);
          }}
          onWeatherSelect={(code) => {
            const item = timeline.findLast(
              (entry) => entry.category === "WEATHER" && entry.regionCode === code,
            );
            onTimelineSelect?.(item);
          }}
          {...(selectedFacilityId ? { selectedFacilityId } : {})}
          {...(selectedRegionCode ? { selectedRegionCode } : {})}
          situation={visibleSituation}
          weatherHistorical={timelineTouched}
          surfaceMode="IMAGERY"
        />
      </Suspense>

      <div className="realistic-situation-control-stack">
        {regionSearch && (
          <PublicRegionSearch
            {...regionSearch}
            onSelect={(region) => {
              setPlaying(false);
              setTimelineTouched(false);
              setFocusRequest({ id: Date.now(), region });
              onRegionSelect(region);
            }}
          />
        )}
        {layers.WEATHER && (
          <p className="situation-weather-status" role="status">
            {timelineTouched ? "历史观测" : "观测驱动动画"} ·
            点击云雨图标查看地区与观测时间
            {!visibleSituation.weather.length
              ? " · 暂无天气观测"
              : visibleSituation.weather.some(
                    (weather) =>
                      !weatherObservationFresh(weather.observedAt, weatherClock),
                  )
                ? " · 部分观测超过90分钟或时间异常，已静态弱化"
                : " · 随最新观测同步"}
            {visibleSituation.weather.some(
              (weather) => weatherSpriteKind(weather) === "UNKNOWN",
            ) && " · 问号表示云况数据缺失，不推断晴天"}
          </p>
        )}
        {currentLevel === "VILLAGE" && (
          <p className="realistic-situation-enhancement-notice" role="status">
            村名位置仍待空间核验，可点击名称查看该村资料；不展示推算村界。
          </p>
        )}
        {enhancementState === "DEGRADED" && (
          <p className="realistic-situation-enhancement-notice" role="status">
            在线卫星影像暂不可用，已降级为地形底图；地区搜索与业务图层仍可操作。
          </p>
        )}
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

        {layerMenuOpen && !annotationActive && (
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
                  setLayers((current) => ({
                    ...current,
                    RAILWAY: event.target.checked,
                  }))
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

        {annotationActive && annotationRepository && (
          <section className="regional-earth-annotation" aria-label="地图标注工具">
            <header>
              <div>
                <strong>地图标注</strong>
                <span>单击标记经纬度；按住左键拖拽框选范围</span>
              </div>
              <button type="button" onClick={toggleAnnotation}>
                完成
              </button>
            </header>
            <div>
              {annotation && (
                <button
                  className="is-danger"
                  disabled={annotationPending}
                  type="button"
                  onClick={() => void deleteAnnotation()}
                >
                  删除标注
                </button>
              )}
            </div>
            <p role="status">
              {annotationIssue ||
                "单击保存点位，按住左键拖拽保存范围；退出标注后拖动地图。"}
            </p>
            {annotation && (
              <output aria-label="标注经纬度">
                {annotation.type === "POINT"
                  ? `经度 ${annotation.minLongitude.toFixed(6)}° · 纬度 ${annotation.minLatitude.toFixed(6)}°`
                  : `西南 ${annotation.minLongitude.toFixed(6)}°, ${annotation.minLatitude.toFixed(6)}°；东北 ${annotation.maxLongitude.toFixed(6)}°, ${annotation.maxLatitude.toFixed(6)}°`}
              </output>
            )}
          </section>
        )}
      </div>

      <div className="realistic-situation-lower-rail">
        <p className="realistic-situation-caption">
          {levelLabel(currentLevel)} ·
          单击地区逐层下钻；四区域总览按可视区完整适配，滚轮缩放查看地表细节。
        </p>

        <div className="realistic-situation-tools" aria-label="三维地图工具">
          {onAnnotationToggle && (
            <button
              aria-pressed={annotationActive}
              type="button"
              onClick={toggleAnnotation}
            >
              地图标注
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
            <button
              type="button"
              onClick={() => {
                setFocusRequest(undefined);
                onReturnToParent();
              }}
            >
              返回上级
            </button>
          )}
          <button type="button" onClick={() => issueCommand("RESET")}>
            复位
          </button>
        </div>
      </div>

      <p className="realistic-situation-credits">
        四区域卫星地表：Esri World Imagery · 降水雷达：RainViewer ·
        行政边界：平台治理数据
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
        <span title="默认展示各地区最新观测；播放或拖动时间轴可逐条回看历史记录。">
          {timelineTouched
            ? `回放记录：${selectedTimeline?.title ?? "暂无真实事件记录"}`
            : "实时总览 · 齐齐哈尔、呼伦贝尔、黑河、大兴安岭"}
        </span>
        <button
          type="button"
          disabled={!timelineTouched}
          onClick={() => {
            setPlaying(false);
            setTimelineTouched(false);
            onTimelineSelect?.(undefined);
          }}
        >
          返回实时总览
        </button>
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
  const [pageVisible, setPageVisible] = useState(
    () => typeof document === "undefined" || document.visibilityState !== "hidden",
  );
  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    const updatePageVisibility = () =>
      setPageVisible(document.visibilityState !== "hidden");
    document.addEventListener("visibilitychange", updatePageVisibility);
    return () => document.removeEventListener("visibilitychange", updatePageVisibility);
  }, []);
  useEffect(() => {
    if (!pageVisible || !playing || timelineLength < 2) return undefined;
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
  }, [
    pageVisible,
    playbackSpeed,
    playing,
    setPlaying,
    setTimelineIndex,
    timelineLength,
  ]);
}

function levelLabel(level: OverviewRegion["level"] | undefined) {
  if (level === "VILLAGE") return "行政村级写实视图";
  if (level === "TOWNSHIP") return "乡镇级写实视图";
  if (level === "COUNTY") return "县级写实视图";
  return "四区域地形总览";
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
