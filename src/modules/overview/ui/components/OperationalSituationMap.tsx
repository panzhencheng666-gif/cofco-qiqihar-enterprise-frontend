import "maplibre-gl/dist/maplibre-gl.css";
import "./operational-situation.css";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Map as MapLibreMap,
  Marker,
  type GeoJSONSource,
  type MapLayerMouseEvent,
} from "maplibre-gl";

import type { OperationalFacilityCatalogue } from "../../domain/operationalFacilities";
import type { OperationalSituationCatalogue } from "../../domain/operationalSituation";
import type { OverviewRegion } from "../../domain/overview";
import type { MapFeature } from "./boundaryGeometry";
import { administrativeGeoJson, emptyCollection } from "./mapAnnotationPrecisionData";
import {
  operationalMarkers,
  railwayRouteGeoJson,
  type OperationalLayerCode,
} from "./operationalSituationMapData";
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

type LayerCode = OperationalLayerCode | "ADMINISTRATIVE" | "RAILWAY_ROUTE";

const ADMIN_SOURCE = "situation-admin-regions";
const ROUTE_SOURCE = "situation-railway-routes";
const LAYER_LABELS: Readonly<Record<LayerCode, string>> = {
  ADMINISTRATIVE: "行政边界",
  RAILWAY_ROUTE: "铁路线路",
  STORAGE: "库点",
  RAILWAY: "铁路站点",
  PUBLIC_EVENT: "公开事件",
};
const MARKER_LABELS: Readonly<Record<OperationalLayerCode, string>> = {
  STORAGE: "库点",
  RAILWAY: "铁路",
  PUBLIC_EVENT: "公开事件",
};

export function OperationalSituationMap({
  backdrop,
  bounds,
  canReturnToParent = false,
  facilities,
  features,
  onFacilitySelect,
  onRegionDrill,
  onRegionSelect,
  onReturnToParent,
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
  onRegionDrill: (region: OverviewRegion) => void;
  onRegionSelect: (region: OverviewRegion) => void;
  onReturnToParent: () => void;
  selectedFacilityId?: string;
  selectedRegionCode?: string;
  situation: OperationalSituationCatalogue;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const fittedZoomRef = useRef(0);
  const interactiveZoomRef = useRef(false);
  const navigationLockRef = useRef(false);
  const viewAngleRef = useRef(60);
  const callbacksRef = useRef({
    canReturnToParent,
    onRegionDrill,
    onRegionSelect,
    onReturnToParent,
    selectedRegionCode,
  });
  const [viewAngle, setViewAngle] = useState(60);
  const [layers, setLayers] = useState<Record<LayerCode, boolean>>({
    ADMINISTRATIVE: true,
    RAILWAY_ROUTE: true,
    STORAGE: true,
    RAILWAY: true,
    PUBLIC_EVENT: true,
  });
  const allMarkers = useMemo(
    () => operationalMarkers(facilities, situation),
    [facilities, situation],
  );
  const visibleMarkers = useMemo(
    () =>
      allMarkers.filter(
        (marker) => layers[marker.kind] && insideBounds(marker, bounds),
      ),
    [allMarkers, bounds, layers],
  );
  const regionByCode = useMemo(
    () =>
      new Map(
        [...(backdrop ? [backdrop] : []), ...features].map(({ region }) => [
          region.code,
          region,
        ]),
      ),
    [backdrop, features],
  );
  const regionByCodeRef = useRef(regionByCode);
  const mapDataRef = useRef({
    backdrop,
    features,
    routes: facilities.railwayRoutes,
    selectedRegionCode,
  });

  useEffect(() => {
    callbacksRef.current = {
      canReturnToParent,
      onRegionDrill,
      onRegionSelect,
      onReturnToParent,
      selectedRegionCode,
    };
  }, [
    canReturnToParent,
    onRegionDrill,
    onRegionSelect,
    onReturnToParent,
    selectedRegionCode,
  ]);
  useEffect(() => {
    regionByCodeRef.current = regionByCode;
  }, [regionByCode]);
  useEffect(() => {
    mapDataRef.current = {
      backdrop,
      features,
      routes: facilities.railwayRoutes,
      selectedRegionCode,
    };
  }, [backdrop, facilities.railwayRoutes, features, selectedRegionCode]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    interactiveZoomRef.current = false;
    navigationLockRef.current = false;
    const map = new MapLibreMap({
      attributionControl: { compact: true },
      bearing: 0,
      center: [
        (bounds.minLongitude + bounds.maxLongitude) / 2,
        (bounds.minLatitude + bounds.maxLatitude) / 2,
      ],
      container,
      doubleClickZoom: false,
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
    const fitVisibleBounds = () => {
      fitSituationMap(map, bounds, container, viewAngleRef.current);
      fittedZoomRef.current = map.getZoom();
    };
    map.on("style.load", () => {
      addSituationLayers(map);
      const data = mapDataRef.current;
      updateSource(
        map,
        ADMIN_SOURCE,
        administrativeGeoJson(data.backdrop, data.features, data.selectedRegionCode),
      );
      updateSource(map, ROUTE_SOURCE, railwayRouteGeoJson(data.routes));
      fitVisibleBounds();
    });
    map.on("click", "situation-admin-fill", (event) => {
      const region = eventRegion(event, regionByCodeRef.current);
      if (region) callbacksRef.current.onRegionSelect(region);
    });
    map.on("dblclick", "situation-admin-fill", (event) => {
      event.preventDefault();
      const region = eventRegion(event, regionByCodeRef.current);
      if (region && region.level !== "VILLAGE")
        callbacksRef.current.onRegionDrill(region);
    });
    map.on("mouseenter", "situation-admin-fill", () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", "situation-admin-fill", () => {
      map.getCanvas().style.cursor = "";
    });
    map.on("zoomstart", (event) => {
      if (event.originalEvent) interactiveZoomRef.current = true;
    });
    map.on("zoomend", () => {
      const interactiveZoom = interactiveZoomRef.current;
      interactiveZoomRef.current = false;
      if (!interactiveZoom || navigationLockRef.current) return;
      const delta = map.getZoom() - fittedZoomRef.current;
      const selected = callbacksRef.current.selectedRegionCode
        ? regionByCodeRef.current.get(callbacksRef.current.selectedRegionCode)
        : undefined;
      if (delta >= 1.2 && selected && selected.level !== "VILLAGE") {
        navigationLockRef.current = true;
        callbacksRef.current.onRegionDrill(selected);
      } else if (delta <= -0.2 && callbacksRef.current.canReturnToParent) {
        navigationLockRef.current = true;
        callbacksRef.current.onReturnToParent();
      }
    });
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
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      mapRef.current = null;
      map.remove();
    };
  }, [bounds]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;
    updateSource(
      map,
      ADMIN_SOURCE,
      administrativeGeoJson(backdrop, features, selectedRegionCode),
    );
  }, [backdrop, features, selectedRegionCode]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;
    updateSource(map, ROUTE_SOURCE, railwayRouteGeoJson(facilities.railwayRoutes));
  }, [facilities.railwayRoutes]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;
    setVisibility(
      map,
      ["situation-admin-fill", "situation-admin-line", "situation-admin-label"],
      layers.ADMINISTRATIVE,
    );
    setVisibility(
      map,
      ["situation-railway-route", "situation-railway-route-label"],
      layers.RAILWAY_ROUTE,
    );
  }, [layers.ADMINISTRATIVE, layers.RAILWAY_ROUTE]);

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
        `${MARKER_LABELS[marker.kind]}：${marker.name}`,
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
    fitSituationMap(map, bounds, container, viewAngle);
    fittedZoomRef.current = map.getZoom();
  }, [bounds, viewAngle]);

  function reset() {
    const map = mapRef.current;
    const container = containerRef.current;
    if (!map || !container) return;
    fitSituationMap(map, bounds, container, viewAngle);
    fittedZoomRef.current = map.getZoom();
    navigationLockRef.current = false;
  }

  function zoom(direction: "in" | "out") {
    const map = mapRef.current;
    if (!map) return;
    if (
      direction === "out" &&
      callbacksRef.current.canReturnToParent &&
      map.getZoom() <= fittedZoomRef.current + 0.05
    ) {
      navigationLockRef.current = true;
      callbacksRef.current.onReturnToParent();
      return;
    }
    interactiveZoomRef.current = true;
    if (direction === "in") map.zoomIn();
    else map.zoomOut();
  }

  const currentLevel = features[0]?.region.level ?? backdrop?.region.level;
  return (
    <section className="operational-situation-map-layer" aria-label="公开运营态势地图">
      <div
        aria-label="融合行政边界、运营节点和真实铁路路径的精细地理底图"
        className="operational-situation-map"
        ref={containerRef}
      />
      <details className="situation-layer-switcher">
        <summary>图层</summary>
        <div aria-label="公开态势图层">
          {(Object.keys(LAYER_LABELS) as LayerCode[]).map((code) => (
            <label key={code}>
              <input
                checked={layers[code]}
                type="checkbox"
                onChange={(event) =>
                  setLayers((current) => ({
                    ...current,
                    [code]: event.target.checked,
                  }))
                }
              />
              <span>{LAYER_LABELS[code]}</span>
              <b>{layerCount(code, allMarkers, facilities, features)}</b>
            </label>
          ))}
        </div>
      </details>
      <div className="situation-map-tools" aria-label="态势地图工具">
        <button
          type="button"
          aria-label="放大地图"
          onClick={() => zoom("in")}
        >
          +
        </button>
        <button
          type="button"
          aria-label="缩小地图"
          onClick={() => zoom("out")}
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
        当前为{levelLabel(currentLevel)}
        ；单击区域查看详情，双击或选中后放大进入下一级，缩小返回上一级。
      </p>
    </section>
  );
}

function addSituationLayers(map: MapLibreMap) {
  map.addSource(ROUTE_SOURCE, { type: "geojson", data: emptyCollection() });
  map.addLayer({
    id: "situation-railway-route",
    type: "line",
    source: ROUTE_SOURCE,
    paint: {
      "line-color": "#ffd35f",
      "line-opacity": 0.82,
      "line-width": ["interpolate", ["linear"], ["zoom"], 4, 1.2, 10, 3.2],
      "line-dasharray": [1.5, 1],
    },
  });
  map.addLayer({
    id: "situation-railway-route-label",
    type: "symbol",
    source: ROUTE_SOURCE,
    minzoom: 7,
    layout: {
      "symbol-placement": "line",
      "text-field": ["get", "name"],
      "text-font": ["Noto Sans Regular"],
      "text-size": 11,
    },
    paint: {
      "text-color": "#fff0ac",
      "text-halo-color": "#092535",
      "text-halo-width": 1.5,
    },
  });
  map.addSource(ADMIN_SOURCE, { type: "geojson", data: emptyCollection() });
  map.addLayer({
    id: "situation-admin-fill",
    type: "fill",
    source: ADMIN_SOURCE,
    paint: {
      "fill-color": ["case", ["==", ["get", "selected"], true], "#ffd35f", "#2ed1dc"],
      "fill-opacity": ["case", ["==", ["get", "selected"], true], 0.22, 0.055],
    },
  });
  map.addLayer({
    id: "situation-admin-line",
    type: "line",
    source: ADMIN_SOURCE,
    paint: {
      "line-color": ["case", ["==", ["get", "selected"], true], "#ffe785", "#d8fbff"],
      "line-opacity": 0.96,
      "line-width": ["interpolate", ["linear"], ["zoom"], 4, 1.2, 10, 3],
    },
  });
  map.addLayer({
    id: "situation-admin-label",
    type: "symbol",
    source: ADMIN_SOURCE,
    layout: {
      "text-field": ["get", "name"],
      "text-font": ["Noto Sans Regular"],
      "text-size": ["interpolate", ["linear"], ["zoom"], 4, 12, 10, 16],
    },
    paint: {
      "text-color": "#f5fdff",
      "text-halo-color": "#06283a",
      "text-halo-width": 2,
    },
  });
}

function fitSituationMap(
  map: MapLibreMap,
  bounds: SituationMapBounds,
  container: HTMLElement,
  viewAngle: number,
) {
  fitOperationalMap(
    map,
    toMapBounds(bounds),
    calculateOperationalMapPadding(container, 150),
    90 - viewAngle,
  );
}

function updateSource(
  map: MapLibreMap,
  id: string,
  data: Parameters<GeoJSONSource["setData"]>[0],
) {
  const source = map.getSource<GeoJSONSource>(id);
  if (source) void source.setData(data);
}

function setVisibility(map: MapLibreMap, ids: readonly string[], visible: boolean) {
  ids.forEach((id) => {
    if (map.getLayer(id))
      map.setLayoutProperty(id, "visibility", visible ? "visible" : "none");
  });
}

function eventRegion(
  event: MapLayerMouseEvent,
  byCode: ReadonlyMap<string, OverviewRegion>,
) {
  const properties: unknown = event.features?.[0]?.properties;
  if (!properties || typeof properties !== "object") return undefined;
  const code = (properties as Record<string, unknown>).regionCode;
  return typeof code === "string" ? byCode.get(code) : undefined;
}

function insideBounds(
  marker: { longitude: number; latitude: number },
  bounds: SituationMapBounds,
) {
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

function markerSymbol(kind: OperationalLayerCode) {
  if (kind === "STORAGE") return '<span aria-hidden="true">库</span>';
  if (kind === "RAILWAY") return '<span aria-hidden="true">铁</span>';
  return '<span aria-hidden="true">!</span>';
}

function layerCount(
  code: LayerCode,
  markers: ReturnType<typeof operationalMarkers>,
  facilities: OperationalFacilityCatalogue,
  features: readonly MapFeature[],
) {
  if (code === "ADMINISTRATIVE") return features.length;
  if (code === "RAILWAY_ROUTE") return facilities.railwayRoutes.length;
  return markers.filter((marker) => marker.kind === code).length;
}

function levelLabel(level?: OverviewRegion["level"]) {
  if (level === "COUNTY") return "县级分区";
  if (level === "TOWNSHIP") return "乡镇级分区";
  if (level === "VILLAGE") return "村级分区";
  return "市级分区";
}
