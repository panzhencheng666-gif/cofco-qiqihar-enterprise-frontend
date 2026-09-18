import "maplibre-gl/dist/maplibre-gl.css";
import "./operational-situation.css";

import { useEffect, useMemo, useRef, useState } from "react";
import { Map as MapLibreMap, Marker } from "maplibre-gl";

import type { OperationalFacilityCatalogue } from "../../domain/operationalFacilities";
import type { OperationalSituationCatalogue } from "../../domain/operationalSituation";
import { OVERVIEW_VECTOR_STYLE } from "./overviewVectorStyle";
import {
  calculateOperationalMapPadding,
  fitOperationalMap,
} from "./operationalMapViewport";

export interface SituationMapBounds {
  maxLatitude: number;
  maxLongitude: number;
  minLatitude: number;
  minLongitude: number;
}

type LayerCode = "STORAGE" | "RAILWAY" | "WEATHER" | "PUBLIC_EVENT";
type SituationMarker = {
  id: string;
  kind: LayerCode;
  name: string;
  longitude: number;
  latitude: number;
};

const LAYER_LABELS: Readonly<Record<LayerCode, string>> = {
  STORAGE: "库点",
  RAILWAY: "铁路",
  WEATHER: "天气",
  PUBLIC_EVENT: "公开事件",
};

export function OperationalSituationMap({
  bounds,
  facilities,
  onFacilitySelect,
  selectedFacilityId,
  situation,
}: {
  bounds: SituationMapBounds;
  facilities: OperationalFacilityCatalogue;
  onFacilitySelect: (id: string) => void;
  selectedFacilityId?: string;
  situation: OperationalSituationCatalogue;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const viewAngleRef = useRef(60);
  const [viewAngle, setViewAngle] = useState(60);
  const [layers, setLayers] = useState<Record<LayerCode, boolean>>({
    STORAGE: true,
    RAILWAY: true,
    WEATHER: true,
    PUBLIC_EVENT: true,
  });
  const allMarkers = useMemo<readonly SituationMarker[]>(
    () => [
      ...facilities.storageFacilities.flatMap((facility) =>
        facility.longitude === null || facility.latitude === null
          ? []
          : [
              {
                id: facility.code,
                kind: "STORAGE" as const,
                name: facility.name,
                longitude: facility.longitude,
                latitude: facility.latitude,
              },
            ],
      ),
      ...facilities.railwayFacilities.map((facility) => ({
        id: facility.sourceId,
        kind: "RAILWAY" as const,
        name: facility.name,
        longitude: facility.longitude,
        latitude: facility.latitude,
      })),
      ...situation.weather.map((weather) => ({
        id: weather.rootRegionCode,
        kind: "WEATHER" as const,
        name: `${weather.regionName}：${weather.risk}`,
        longitude: weather.longitude,
        latitude: weather.latitude,
      })),
      ...situation.publicEvents.map((event) => ({
        id: event.eventId,
        kind: "PUBLIC_EVENT" as const,
        name: event.title,
        longitude: event.longitude,
        latitude: event.latitude,
      })),
    ],
    [facilities, situation],
  );
  const visibleMarkers = useMemo(
    () =>
      allMarkers.filter(
        (marker) => layers[marker.kind] && insideBounds(marker, bounds),
      ),
    [allMarkers, bounds, layers],
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const map = new MapLibreMap({
      attributionControl: { compact: true },
      bearing: 0,
      center: [
        (bounds.minLongitude + bounds.maxLongitude) / 2,
        (bounds.minLatitude + bounds.maxLatitude) / 2,
      ],
      container,
      dragRotate: false,
      fadeDuration: 0,
      maxPitch: 60,
      pitch: 30,
      renderWorldCopies: false,
      style:
        import.meta.env.VITE_OVERVIEW_VECTOR_STYLE_URL?.trim() || OVERVIEW_VECTOR_STYLE,
    });
    map.keyboard.disableRotation();
    map.touchZoomRotate.disableRotation();
    const fitVisibleBounds = (duration = 0) => {
      fitSituationMap(map, bounds, container, viewAngleRef.current, duration);
    };
    map.on("style.load", fitVisibleBounds);
    const commandCenter = container.closest(".overview-command-center");
    const observed = [
      container,
      commandCenter?.querySelector<HTMLElement>(".overview-data-mode"),
      commandCenter?.querySelector<HTMLElement>(".overview-command-tools"),
    ].filter((element): element is HTMLElement => element instanceof HTMLElement);
    let resizeFrame = 0;
    const scheduleFit = () => {
      cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(() => {
        map.resize();
        if (map.isStyleLoaded()) fitVisibleBounds();
      });
    };
    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? undefined
        : new ResizeObserver(scheduleFit);
    observed.forEach((element) => resizeObserver?.observe(element));
    window.addEventListener("resize", scheduleFit);
    mapRef.current = map;
    return () => {
      cancelAnimationFrame(resizeFrame);
      resizeObserver?.disconnect();
      window.removeEventListener("resize", scheduleFit);
      map.off("style.load", fitVisibleBounds);
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      mapRef.current = null;
      map.remove();
    };
  }, [bounds]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = visibleMarkers.map((marker) => {
      const isFacility = marker.kind === "STORAGE" || marker.kind === "RAILWAY";
      const element = document.createElement(isFacility ? "button" : "div");
      element.className = `situation-map-marker is-${marker.kind.toLowerCase()}`;
      if (isFacility) {
        (element as HTMLButtonElement).type = "button";
        element.classList.toggle("is-selected", marker.id === selectedFacilityId);
        element.setAttribute("aria-pressed", String(marker.id === selectedFacilityId));
        element.addEventListener("click", (event) => {
          event.stopPropagation();
          onFacilitySelect(marker.id);
        });
      } else {
        element.setAttribute("role", "img");
      }
      element.setAttribute(
        "aria-label",
        `${LAYER_LABELS[marker.kind]}：${marker.name}`,
      );
      element.innerHTML = markerSymbol(marker.kind);
      return new Marker({ anchor: "center", element })
        .setLngLat([marker.longitude, marker.latitude])
        .addTo(map);
    });
    return () => {
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
    };
  }, [onFacilitySelect, selectedFacilityId, visibleMarkers]);

  useEffect(() => {
    viewAngleRef.current = viewAngle;
    const map = mapRef.current;
    const container = containerRef.current;
    if (!map || !container || !map.isStyleLoaded()) return;
    fitSituationMap(map, bounds, container, viewAngle, 180);
  }, [bounds, viewAngle]);

  function reset() {
    const map = mapRef.current;
    if (!map) return;
    const container = containerRef.current;
    if (!container) return;
    fitSituationMap(map, bounds, container, viewAngle, 180);
  }

  return (
    <section className="operational-situation-map-layer" aria-label="公开运营态势地图">
      <div
        aria-label="融合运营节点、天气和公开事件的精细地理底图"
        className="operational-situation-map"
        ref={containerRef}
      />
      <div className="situation-layer-switcher" aria-label="公开态势图层">
        <strong>态势图层</strong>
        {(Object.keys(LAYER_LABELS) as LayerCode[]).map((code) => (
          <label key={code}>
            <input
              checked={layers[code]}
              type="checkbox"
              onChange={(event) =>
                setLayers((current) => ({ ...current, [code]: event.target.checked }))
              }
            />
            <span>{LAYER_LABELS[code]}</span>
            <b>
              {
                allMarkers.filter(
                  (marker) => marker.kind === code && insideBounds(marker, bounds),
                ).length
              }
            </b>
          </label>
        ))}
      </div>
      <div className="situation-map-tools" aria-label="态势地图工具">
        <button
          type="button"
          aria-label="放大地图"
          onClick={() => mapRef.current?.zoomIn()}
        >
          +
        </button>
        <button
          type="button"
          aria-label="缩小地图"
          onClick={() => mapRef.current?.zoomOut()}
        >
          −
        </button>
        <button type="button" onClick={reset}>
          复位
        </button>
        <label>
          <span>视角 {viewAngle}°</span>
          <input
            aria-label="态势地图视角"
            type="range"
            min="30"
            max="90"
            step="5"
            value={viewAngle}
            onChange={(event) => setViewAngle(Number(event.target.value))}
          />
        </label>
      </div>
      <p className="situation-map-caption">
        当前范围显示 {visibleMarkers.length} 个来源可追溯的态势要素；公开事件为 NASA
        EONET 最近 30 天开放事件快照。
      </p>
    </section>
  );
}

function fitSituationMap(
  map: MapLibreMap,
  bounds: SituationMapBounds,
  container: HTMLElement,
  viewAngle: number,
  duration: number,
) {
  void duration;
  fitOperationalMap(
    map,
    toMapBounds(bounds),
    calculateOperationalMapPadding(container, 175),
    90 - viewAngle,
  );
}

function insideBounds(marker: SituationMarker, bounds: SituationMapBounds) {
  return (
    marker.longitude >= bounds.minLongitude &&
    marker.longitude <= bounds.maxLongitude &&
    marker.latitude >= bounds.minLatitude &&
    marker.latitude <= bounds.maxLatitude
  );
}

function toMapBounds(bounds: SituationMapBounds): [[number, number], [number, number]] {
  return [
    [bounds.minLongitude, bounds.minLatitude],
    [bounds.maxLongitude, bounds.maxLatitude],
  ];
}

function markerSymbol(kind: LayerCode) {
  if (kind === "STORAGE") return '<span aria-hidden="true">库</span>';
  if (kind === "RAILWAY") return '<span aria-hidden="true">铁</span>';
  if (kind === "WEATHER") return '<span aria-hidden="true">气</span>';
  return '<span aria-hidden="true">!</span>';
}
