import "maplibre-gl/dist/maplibre-gl.css";
import "./operational-facility.css";

import { useEffect, useMemo, useRef, useState } from "react";
import { Map as MapLibreMap, Marker } from "maplibre-gl";

import type {
  RailwayFacility,
  StorageFacility,
} from "../../domain/operationalFacilities";
import { OVERVIEW_VECTOR_STYLE } from "./MapAnnotationPrecisionMap";

interface FacilityMapBounds {
  maxLatitude: number;
  maxLongitude: number;
  minLatitude: number;
  minLongitude: number;
}

type FacilityMarker =
  | { id: string; kind: "STORAGE"; name: string; longitude: number; latitude: number }
  | { id: string; kind: "RAILWAY"; name: string; longitude: number; latitude: number };

export function OperationalFacilityMap({
  bounds,
  mode,
  onSelect,
  railwayFacilities,
  selectedId,
  storageFacilities,
}: {
  bounds: FacilityMapBounds;
  mode: "STORAGE_FACILITIES" | "RAILWAY_FACILITIES";
  onSelect: (id: string) => void;
  railwayFacilities: readonly RailwayFacility[];
  selectedId?: string;
  storageFacilities: readonly StorageFacility[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const [viewAngle, setViewAngle] = useState(60);

  const facilities: readonly FacilityMarker[] = useMemo(
    () =>
      mode === "STORAGE_FACILITIES"
        ? storageFacilities.flatMap((facility) =>
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
          )
        : railwayFacilities.map((facility) => ({
            id: facility.sourceId,
            kind: "RAILWAY" as const,
            name: facility.name,
            longitude: facility.longitude,
            latitude: facility.latitude,
          })),
    [mode, railwayFacilities, storageFacilities],
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
    map.on("style.load", () => {
      map.fitBounds(toMapBounds(bounds), {
        bearing: 0,
        duration: 0,
        padding: { bottom: 54, left: 54, right: 370, top: 160 },
        pitch: 30,
      });
      map.setMinZoom(map.getZoom());
      map.setMaxBounds(toMapBounds(bounds));
    });
    mapRef.current = map;
    return () => {
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
    markersRef.current = facilities.map((facility) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `operational-facility-marker is-${facility.kind.toLowerCase()}${
        facility.id === selectedId ? " is-selected" : ""
      }`;
      button.setAttribute("aria-label", `${facility.name}，查看详情`);
      button.innerHTML = markerSvg(facility.kind);
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        onSelect(facility.id);
      });
      return new Marker({ anchor: "bottom", element: button })
        .setLngLat([facility.longitude, facility.latitude])
        .addTo(map);
    });
    return () => {
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
    };
  }, [facilities, onSelect, selectedId]);

  useEffect(() => {
    mapRef.current?.easeTo({ duration: 180, pitch: 90 - viewAngle });
  }, [viewAngle]);

  function reset() {
    const map = mapRef.current;
    if (!map) return;
    map.setMaxBounds(null);
    map.fitBounds(toMapBounds(bounds), {
      bearing: 0,
      duration: 180,
      padding: { bottom: 54, left: 54, right: 370, top: 160 },
      pitch: 90 - viewAngle,
    });
    map.setMaxBounds(toMapBounds(bounds));
  }

  return (
    <section className="operational-facility-map-layer" aria-label="运营设施地理地图">
      <div
        aria-label="可拖动和缩放的精细地理底图"
        className="operational-facility-map"
        ref={containerRef}
      />
      <div className="operational-facility-map__tools" aria-label="地图视角工具">
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
            aria-label="地图视角"
            type="range"
            min="30"
            max="90"
            step="5"
            value={viewAngle}
            onChange={(event) => setViewAngle(Number(event.target.value))}
          />
        </label>
      </div>
      <p className="operational-facility-map__hint">
        按住鼠标左键可在当前行政边界内拖动，滚轮缩放会显示更精细的道路、河流与地名。
      </p>
    </section>
  );
}

function toMapBounds(bounds: FacilityMapBounds): [[number, number], [number, number]] {
  return [
    [bounds.minLongitude, bounds.minLatitude],
    [bounds.maxLongitude, bounds.maxLatitude],
  ];
}

function markerSvg(kind: FacilityMarker["kind"]) {
  if (kind === "STORAGE") {
    return '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M4 27V12l7 4v-5l7 5V8h8v19H4Z"/><path d="M21 4h5v4h-5zM8 21h4v6H8zm8 0h4v6h-4z"/></svg>';
  }
  return '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M8 3h16c3 0 5 2 5 5v12c0 3-2 5-5 5H8c-3 0-5-2-5-5V8c0-3 2-5 5-5Zm1 4v7h14V7H9Zm1 11a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm12 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z"/><path d="m9 25-4 5h4l2-3h10l2 3h4l-4-5H9Z"/></svg>';
}
