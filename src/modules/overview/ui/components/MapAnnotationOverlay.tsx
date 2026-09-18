import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { createPortal } from "react-dom";

import type {
  MapAnnotation,
  MapAnnotationRepository,
  SaveMapAnnotation,
} from "../../application/ports/MapAnnotationRepository";
import type { OverviewRegion } from "../../domain/overview";
import type { OverviewSamplePointIcon } from "../../domain/overviewSamplePoint";
import type { MapFeature } from "./boundaryGeometry";
import type { MapAnnotationPrecisionMapHandle } from "./MapAnnotationPrecisionMap";
import "./map-annotation.css";

const MapAnnotationPrecisionMap = lazy(() =>
  import("./MapAnnotationPrecisionMap").then(({ MapAnnotationPrecisionMap }) => ({
    default: MapAnnotationPrecisionMap,
  })),
);

export interface AnnotationBounds {
  minLongitude: number;
  minLatitude: number;
  maxLongitude: number;
  maxLatitude: number;
}

interface PixelPoint {
  x: number;
  y: number;
}

interface MapViewTransform {
  panX: number;
  panY: number;
  rotation: number;
  zoom: number;
}

interface ProjectionMetadata {
  frameHeight: number;
  frameWidth: number;
  frameX: number;
  frameY: number;
  maxLatitude: number;
  maxLongitude: number;
  minLatitude: number;
  minLongitude: number;
  viewportHeight: number;
  viewportWidth: number;
}

export function MapAnnotationOverlay({
  active,
  bounds,
  repository,
  regionCode,
  administrativeLevel,
  onArmedChange,
  backdrop,
  features,
  onRegionDrill,
  onRegionSelect,
  onSamplePointSelect,
  samplePointIcons,
  selectedRegionCode,
  selectedSamplePointId,
}: {
  active: boolean;
  bounds: AnnotationBounds;
  repository: MapAnnotationRepository;
  regionCode?: string;
  administrativeLevel?: SaveMapAnnotation["administrativeLevel"];
  onArmedChange?: (armed: boolean) => void;
  backdrop?: MapFeature;
  features?: readonly MapFeature[];
  onRegionDrill?: (region: OverviewRegion) => void;
  onRegionSelect?: (region: OverviewRegion) => void;
  onSamplePointSelect?: (samplePointId: string) => void;
  samplePointIcons?: readonly OverviewSamplePointIcon[];
  selectedRegionCode?: string;
  selectedSamplePointId?: string;
}) {
  const [annotation, setAnnotation] = useState<MapAnnotation>();
  const [armed, setArmed] = useState(false);
  const [start, setStart] = useState<PixelPoint>();
  const [preview, setPreview] = useState<PixelPoint>();
  const [issue, setIssue] = useState("");
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<PixelPoint>({ x: 0, y: 0 });
  const rotation = 0;
  const [panning, setPanning] = useState(false);
  const [precisionMapReady, setPrecisionMapReady] = useState(false);
  const [precisionMapIssue, setPrecisionMapIssue] = useState("");
  const [viewAngle, setViewAngle] = useState(60);
  const [detailLevel, setDetailLevel] = useState<"REGION" | "GEOGRAPHY" | "SAMPLE">(
    "REGION",
  );
  const [surfaceElement, setSurfaceElement] = useState<HTMLDivElement | null>(null);
  const [, setProjectionRevision] = useState(0);
  const [lockedScope, setLockedScope] = useState<{
    regionCode?: string;
    administrativeLevel?: SaveMapAnnotation["administrativeLevel"];
  }>();
  const armedRef = useRef(false);
  const panRef = useRef(pan);
  const zoomRef = useRef(zoom);
  const panGestureRef = useRef<
    | {
        moved: boolean;
        origin: PixelPoint;
        pointerId: number;
        start: PixelPoint;
      }
    | undefined
  >(undefined);
  const suppressClickRef = useRef(false);
  const precisionMapRef = useRef<MapAnnotationPrecisionMapHandle>(null);
  const precisionMapReadyRef = useRef(false);
  const onArmedChangeRef = useRef(onArmedChange);
  useEffect(() => {
    onArmedChangeRef.current = onArmedChange;
  }, [onArmedChange]);
  useEffect(() => {
    panRef.current = pan;
  }, [pan]);
  useEffect(() => {
    zoomRef.current = zoom;
    const surface = surfaceElement;
    if (!surface) return;
    const viewport = viewportSize(surface);
    const bounded = clampPanToViewport(panRef.current, viewport, zoom);
    if (bounded.x !== panRef.current.x || bounded.y !== panRef.current.y)
      setPan(bounded);
  }, [surfaceElement, zoom]);
  useEffect(() => {
    precisionMapReadyRef.current = precisionMapReady;
  }, [precisionMapReady]);
  const changeArmed = useCallback(
    (
      next: boolean,
      scope?: {
        regionCode?: string;
        administrativeLevel?: SaveMapAnnotation["administrativeLevel"];
      },
    ) => {
      if (armedRef.current === next) return;
      armedRef.current = next;
      setArmed(next);
      setLockedScope(next ? scope : undefined);
      setStart(undefined);
      setPreview(undefined);
      onArmedChangeRef.current?.(next);
    },
    [],
  );

  useEffect(
    () => () => {
      if (armedRef.current) {
        armedRef.current = false;
        onArmedChangeRef.current?.(false);
      }
    },
    [],
  );
  useEffect(() => {
    if (!active) changeArmed(false);
  }, [active, changeArmed]);

  useEffect(() => {
    if (!active) return;
    let live = true;
    repository
      .current()
      .then((value) => {
        if (live) setAnnotation(value);
      })
      .catch(() => {
        if (live) setIssue("标注加载失败，请重试。");
      });
    return () => {
      live = false;
    };
  }, [active, repository]);
  useEffect(() => {
    const stage = surfaceElement?.closest<HTMLElement>(
      ".overview-map-annotation-stage",
    );
    if (!stage) return;
    stage.style.setProperty("--annotation-map-zoom", String(zoom));
    stage.style.setProperty("--annotation-map-pan-x", `${pan.x}px`);
    stage.style.setProperty("--annotation-map-pan-y", `${pan.y}px`);
    stage.style.setProperty("--annotation-map-rotation", `${rotation}deg`);
    return () => {
      stage.style.removeProperty("--annotation-map-zoom");
      stage.style.removeProperty("--annotation-map-pan-x");
      stage.style.removeProperty("--annotation-map-pan-y");
      stage.style.removeProperty("--annotation-map-rotation");
    };
  }, [pan.x, pan.y, rotation, surfaceElement, zoom]);
  useEffect(() => {
    const surface = surfaceElement;
    if (!surface) return;
    const stage = surface.closest<HTMLElement>(".overview-map-annotation-stage");
    if (!stage) return;
    const mapSelector =
      ".overview-terrain-relief-map, .overview-map-fallback, .overview-map-loading";
    const isMapEvent = (event: Event) => {
      const map = stage.querySelector<HTMLElement>(mapSelector);
      return map && event.target instanceof Node && map.contains(event.target);
    };
    let suppressClearTimer: number | undefined;
    const pointerDown = (event: PointerEvent) => {
      if (
        precisionMapReadyRef.current ||
        armedRef.current ||
        event.button !== 0 ||
        !isMapEvent(event)
      )
        return;
      suppressClickRef.current = false;
      panGestureRef.current = {
        moved: false,
        origin: panRef.current,
        pointerId: event.pointerId,
        start: { x: event.clientX, y: event.clientY },
      };
      setPanning(true);
    };
    const pointerMove = (event: PointerEvent) => {
      const gesture = panGestureRef.current;
      if (armedRef.current || gesture?.pointerId !== event.pointerId) return;
      const screenDeltaX = event.clientX - gesture.start.x;
      const screenDeltaY = event.clientY - gesture.start.y;
      gesture.moved ||= Math.hypot(screenDeltaX, screenDeltaY) >= 5;
      if (!gesture.moved) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const rect = surface.getBoundingClientRect();
      const deltaX =
        screenDeltaX * ((surface.clientWidth || rect.width) / Math.max(rect.width, 1));
      const deltaY =
        screenDeltaY *
        ((surface.clientHeight || rect.height) / Math.max(rect.height, 1));
      setPan(
        clampPanToViewport(
          { x: gesture.origin.x + deltaX, y: gesture.origin.y + deltaY },
          viewportSize(surface),
          zoomRef.current,
        ),
      );
    };
    const finishPan = (event: PointerEvent) => {
      const gesture = panGestureRef.current;
      if (gesture?.pointerId !== event.pointerId) return;
      suppressClickRef.current = gesture.moved;
      if (suppressClearTimer) window.clearTimeout(suppressClearTimer);
      suppressClearTimer = window.setTimeout(() => {
        suppressClickRef.current = false;
      });
      panGestureRef.current = undefined;
      setPanning(false);
    };
    const suppressDraggedClick = (event: MouseEvent) => {
      if (!suppressClickRef.current || !isMapEvent(event)) return;
      suppressClickRef.current = false;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    };
    const wheel = (event: WheelEvent) => {
      if (precisionMapReadyRef.current || armedRef.current || !isMapEvent(event))
        return;
      event.preventDefault();
      setZoom((value) => clamp(value + (event.deltaY < 0 ? 0.1 : -0.1), 0.8, 2));
    };
    stage.addEventListener("pointerdown", pointerDown);
    window.addEventListener("pointermove", pointerMove, true);
    window.addEventListener("pointerup", finishPan);
    window.addEventListener("pointercancel", finishPan);
    stage.addEventListener("click", suppressDraggedClick, true);
    stage.addEventListener("wheel", wheel, { passive: false });
    return () => {
      if (suppressClearTimer) window.clearTimeout(suppressClearTimer);
      stage.removeEventListener("pointerdown", pointerDown);
      window.removeEventListener("pointermove", pointerMove, true);
      window.removeEventListener("pointerup", finishPan);
      window.removeEventListener("pointercancel", finishPan);
      stage.removeEventListener("click", suppressDraggedClick, true);
      stage.removeEventListener("wheel", wheel);
    };
  }, [surfaceElement]);
  useLayoutEffect(() => {
    const map = surfaceElement
      ?.closest(".overview-map-annotation-stage")
      ?.querySelector<HTMLElement>(".overview-terrain-relief-map");
    if (!map) return;
    const update = () => setProjectionRevision((current) => current + 1);
    const mutation = new MutationObserver(update);
    mutation.observe(map, {
      attributes: true,
      attributeFilter: [
        "data-projection-source-min-x",
        "data-projection-source-max-x",
        "data-projection-source-min-y",
        "data-projection-source-max-y",
        "data-projection-frame-x",
        "data-projection-frame-y",
        "data-projection-frame-width",
        "data-projection-frame-height",
      ],
    });
    const resize =
      typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(update);
    resize?.observe(map);
    return () => {
      mutation.disconnect();
      resize?.disconnect();
    };
  }, [surfaceElement]);
  const viewTransform = { panX: pan.x, panY: pan.y, rotation, zoom };
  const shape =
    annotation && shapeStyle(annotation, bounds, surfaceElement, viewTransform);
  if (!active) return null;
  const point = (event: React.PointerEvent<HTMLDivElement>): PixelPoint => {
    const rect = event.currentTarget.getBoundingClientRect();
    const xRatio = Math.max(
      0,
      Math.min(1, (event.clientX - rect.left) / Math.max(rect.width, 1)),
    );
    const yRatio = Math.max(
      0,
      Math.min(1, (event.clientY - rect.top) / Math.max(rect.height, 1)),
    );
    return {
      x: xRatio * (event.currentTarget.clientWidth || rect.width),
      y: yRatio * (event.currentTarget.clientHeight || rect.height),
    };
  };
  const finish = async (event: React.PointerEvent<HTMLDivElement>) => {
    if (!armed || !start) return;
    const end = point(event);
    changeArmed(false);
    const coordinate = (value: PixelPoint) =>
      precisionMapReady
        ? (precisionMapRef.current?.unproject(value) ??
          toCoordinate(value, event.currentTarget, bounds, viewTransform))
        : toCoordinate(value, event.currentTarget, bounds, viewTransform);
    const last = coordinate(end);
    const dragged = Math.hypot(end.x - start.x, end.y - start.y) >= 5;
    const rectangleCorners = dragged
      ? [start, { x: start.x, y: end.y }, end, { x: end.x, y: start.y }].map((corner) =>
          coordinate(corner),
        )
      : [];
    const command: SaveMapAnnotation = dragged
      ? {
          type: "RECTANGLE",
          minLongitude: Math.min(...rectangleCorners.map(({ longitude }) => longitude)),
          maxLongitude: Math.max(...rectangleCorners.map(({ longitude }) => longitude)),
          minLatitude: Math.min(...rectangleCorners.map(({ latitude }) => latitude)),
          maxLatitude: Math.max(...rectangleCorners.map(({ latitude }) => latitude)),
          ...(lockedScope?.regionCode ? { regionCode: lockedScope.regionCode } : {}),
          ...(lockedScope?.administrativeLevel
            ? { administrativeLevel: lockedScope.administrativeLevel }
            : {}),
        }
      : {
          type: "POINT",
          minLongitude: last.longitude,
          minLatitude: last.latitude,
          maxLongitude: null,
          maxLatitude: null,
          ...(lockedScope?.regionCode ? { regionCode: lockedScope.regionCode } : {}),
          ...(lockedScope?.administrativeLevel
            ? { administrativeLevel: lockedScope.administrativeLevel }
            : {}),
        };
    try {
      setIssue("");
      setAnnotation(await repository.save(command));
    } catch {
      setIssue("标注保存失败，请重试。");
    }
  };
  const remove = async () => {
    try {
      await repository.delete();
      setAnnotation(undefined);
    } catch {
      setIssue("标注删除失败，请重试。");
    }
  };
  const controls = (
    <>
      <div className="overview-map-annotation-actions">
        <button
          type="button"
          onClick={() => {
            changeArmed(!armed, {
              ...(regionCode ? { regionCode } : {}),
              ...(administrativeLevel ? { administrativeLevel } : {}),
            });
          }}
        >
          {armed ? "浏览地图" : "开始标注"}
        </button>
        {annotation && (
          <button
            type="button"
            onClick={() => {
              void remove();
            }}
          >
            删除标注
          </button>
        )}
      </div>
      <div className="overview-map-annotation-zoom">
        <button
          aria-label="放大地图"
          disabled={armed}
          type="button"
          onClick={() => {
            if (precisionMapReady) precisionMapRef.current?.zoomIn();
            else setZoom((value) => Math.min(2, value + 0.2));
          }}
        >
          ＋
        </button>
        <button
          aria-label="缩小地图"
          disabled={armed}
          type="button"
          onClick={() => {
            if (precisionMapReady) precisionMapRef.current?.zoomOut();
            else setZoom((value) => Math.max(1, value - 0.2));
          }}
        >
          －
        </button>
        <label className="overview-map-view-angle">
          <span>视角 {viewAngle}°</span>
          <input
            aria-label="地图视角"
            disabled={armed || !precisionMapReady}
            max="90"
            min="30"
            step="5"
            type="range"
            value={viewAngle}
            onChange={(event) => {
              const angle = Number(event.currentTarget.value);
              setViewAngle(angle);
              precisionMapRef.current?.setViewAngle(angle);
            }}
          />
        </label>
        <button
          aria-label="复位地图视角"
          disabled={armed}
          type="button"
          onClick={() => {
            if (precisionMapReady) {
              setViewAngle(60);
              precisionMapRef.current?.reset();
            } else {
              setZoom(1);
              setPan({ x: 0, y: 0 });
            }
          }}
        >
          复位
        </button>
      </div>
      {(annotation || armed) && (
        <aside
          aria-label="标注经纬度"
          role="dialog"
          className="overview-map-annotation-panel"
        >
          <strong>
            {!annotation
              ? "标注工作区"
              : annotation.type === "POINT"
                ? "点标注"
                : "矩形范围"}
          </strong>
          {!annotation ? (
            <span>当前行政层级已锁定，请在地图中点击或拖动标注。</span>
          ) : annotation.type === "POINT" ? (
            <>
              <span>经度：{format(annotation.minLongitude)}</span>
              <span>纬度：{format(annotation.minLatitude)}</span>
            </>
          ) : (
            <>
              <span>
                经度范围：{format(annotation.minLongitude)} ～{" "}
                {format(annotation.maxLongitude)}
              </span>
              <span>
                纬度范围：{format(annotation.minLatitude)} ～{" "}
                {format(annotation.maxLatitude)}
              </span>
            </>
          )}
        </aside>
      )}
      {issue && (
        <p role="alert" className="overview-map-annotation-issue">
          {issue}
        </p>
      )}
      {precisionMapReady && (
        <p className="overview-map-detail-level" aria-live="polite">
          当前细节：
          {detailLevel === "SAMPLE"
            ? samplePointIcons?.length
              ? "样本点、道路与环境纹理"
              : "道路、地名与环境纹理"
            : detailLevel === "GEOGRAPHY"
              ? "道路、河流与地名"
              : "行政区域"}
        </p>
      )}
      {precisionMapIssue && !precisionMapReady && (
        <p className="overview-map-annotation-issue is-precision-map" role="status">
          {precisionMapIssue}
        </p>
      )}
    </>
  );
  const controlsHost = surfaceElement?.closest(".overview-command-center");
  return (
    <div
      className={`overview-map-annotation-layer${precisionMapReady ? " has-precision-map" : ""}`}
    >
      <div
        className={`overview-map-annotation-surface${armed ? " is-armed" : " is-browsing"}${panning ? " is-panning" : ""}${precisionMapReady ? " has-precision-map" : ""}`}
        data-testid="map-annotation-surface"
        ref={setSurfaceElement}
        onPointerDown={(event) => {
          if (!armed || event.button !== 0) return;
          event.preventDefault();
          event.stopPropagation();
          const value = point(event);
          setStart(value);
          setPreview(value);
          event.currentTarget.setPointerCapture?.(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (start) {
            event.preventDefault();
            event.stopPropagation();
            setPreview(point(event));
          }
        }}
        onPointerUp={(event) => {
          event.preventDefault();
          event.stopPropagation();
          void finish(event);
        }}
        onPointerCancel={() => {
          setStart(undefined);
          setPreview(undefined);
        }}
      >
        <Suspense fallback={null}>
          <MapAnnotationPrecisionMap
            ref={precisionMapRef}
            bounds={bounds}
            features={features ?? []}
            samplePointIcons={samplePointIcons ?? []}
            viewAngle={viewAngle}
            {...(annotation ? { annotation } : {})}
            {...(backdrop ? { backdrop } : {})}
            {...(onRegionDrill ? { onRegionDrill } : {})}
            {...(onRegionSelect ? { onRegionSelect } : {})}
            {...(onSamplePointSelect ? { onSamplePointSelect } : {})}
            {...(selectedRegionCode ? { selectedRegionCode } : {})}
            {...(selectedSamplePointId ? { selectedSamplePointId } : {})}
            onDetailLevelChange={setDetailLevel}
            onReady={() => {
              setPrecisionMapReady(true);
              setPrecisionMapIssue("");
            }}
            onUnavailable={() => {
              setPrecisionMapReady(false);
              setPrecisionMapIssue("精细地理底图暂不可用，已保留行政区地图浏览。");
            }}
          />
        </Suspense>
        {shape && !precisionMapReady && (
          <span
            aria-label={
              annotation?.type === "POINT" ? "已保存点标注" : "已保存矩形标注"
            }
            className={`overview-map-annotation-shape is-${annotation?.type.toLowerCase()}`}
            style={shape}
          />
        )}
        {start && preview && (
          <span
            aria-hidden="true"
            className="overview-map-annotation-preview"
            style={pixelRectangle(start, preview)}
          />
        )}
      </div>
      {controlsHost ? createPortal(controls, controlsHost) : controls}
    </div>
  );
}

function toCoordinate(
  point: PixelPoint,
  surface: HTMLElement,
  bounds: AnnotationBounds,
  view: MapViewTransform = { panX: 0, panY: 0, rotation: 0, zoom: 1 },
) {
  const projection = projectionMetadata(surface);
  if (projection) {
    const transform = projectionTransform(projection);
    const untransformed = untransformViewPoint(
      point,
      projection.viewportWidth,
      projection.viewportHeight,
      view,
    );
    return {
      longitude: clamp(
        projection.minLongitude +
          (untransformed.x - transform.originX) / transform.scale,
        projection.minLongitude,
        projection.maxLongitude,
      ),
      latitude: clamp(
        projection.maxLatitude -
          (untransformed.y - transform.originY) /
            (transform.scale * transform.verticalCompression),
        projection.minLatitude,
        projection.maxLatitude,
      ),
    };
  }
  const viewport = viewportSize(surface);
  const untransformed = untransformViewPoint(
    point,
    viewport.width,
    viewport.height,
    view,
  );
  return {
    longitude:
      bounds.minLongitude +
      (untransformed.x / viewport.width) * (bounds.maxLongitude - bounds.minLongitude),
    latitude:
      bounds.maxLatitude -
      (untransformed.y / viewport.height) * (bounds.maxLatitude - bounds.minLatitude),
  };
}
function shapeStyle(
  value: MapAnnotation,
  bounds: AnnotationBounds,
  surface: HTMLElement | null,
  view: MapViewTransform = { panX: 0, panY: 0, rotation: 0, zoom: 1 },
) {
  const projection = surface ? projectionMetadata(surface) : undefined;
  const viewport = projection
    ? { height: projection.viewportHeight, width: projection.viewportWidth }
    : surface
      ? viewportSize(surface)
      : { height: 100, width: 100 };
  const projectBase = (longitude: number, latitude: number) => {
    if (projection) {
      const transform = projectionTransform(projection);
      return {
        x: transform.originX + (longitude - projection.minLongitude) * transform.scale,
        y:
          transform.originY +
          (projection.maxLatitude - latitude) *
            transform.scale *
            transform.verticalCompression,
      };
    }
    return {
      x:
        ((longitude - bounds.minLongitude) /
          (bounds.maxLongitude - bounds.minLongitude || 1)) *
        viewport.width,
      y:
        ((bounds.maxLatitude - latitude) /
          (bounds.maxLatitude - bounds.minLatitude || 1)) *
        viewport.height,
    };
  };
  const lowerLeft = projectBase(value.minLongitude, value.minLatitude);
  if (value.type === "POINT") {
    const point = transformViewPoint(lowerLeft, viewport.width, viewport.height, view);
    return { left: point.x, top: point.y };
  }
  const upperRight = projectBase(value.maxLongitude, value.maxLatitude);
  const center = transformViewPoint(
    {
      x: (lowerLeft.x + upperRight.x) / 2,
      y: (lowerLeft.y + upperRight.y) / 2,
    },
    viewport.width,
    viewport.height,
    view,
  );
  const width = Math.abs(upperRight.x - lowerLeft.x) * view.zoom;
  const height = Math.abs(lowerLeft.y - upperRight.y) * view.zoom;
  return {
    left: center.x - width / 2,
    top: center.y - height / 2,
    width,
    height,
    transform: `rotate(${view.rotation}deg)`,
    transformOrigin: "center center",
  };
}
function projectionMetadata(surface: HTMLElement): ProjectionMetadata | undefined {
  const map = surface
    .closest(".overview-map-annotation-stage")
    ?.querySelector<HTMLElement>(".overview-terrain-relief-map");
  if (!map) return undefined;
  const value = (name: string) => Number(map.dataset[name]);
  const metadata = {
    minLongitude: value("projectionSourceMinX"),
    maxLongitude: value("projectionSourceMaxX"),
    minLatitude: value("projectionSourceMinY"),
    maxLatitude: value("projectionSourceMaxY"),
    frameX: value("projectionFrameX"),
    frameY: value("projectionFrameY"),
    frameWidth: value("projectionFrameWidth"),
    frameHeight: value("projectionFrameHeight"),
    viewportWidth: map.clientWidth || viewportSize(surface).width,
    viewportHeight: map.clientHeight || viewportSize(surface).height,
  };
  return Object.values(metadata).every(Number.isFinite) ? metadata : undefined;
}
function projectionTransform(value: ProjectionMetadata) {
  const insetX = value.frameWidth * 0.035,
    insetY = value.frameHeight * 0.035;
  const sourceWidth = Math.max(value.maxLongitude - value.minLongitude, 0.000001);
  const sourceHeight = Math.max(value.maxLatitude - value.minLatitude, 0.000001);
  const verticalCompression = value.frameWidth < 1300 ? 0.7 : 0.62;
  const fittedScale = Math.min(
    (value.frameWidth - insetX * 2) / sourceWidth,
    (value.frameHeight - insetY * 2) / (sourceHeight * verticalCompression),
  );
  const drawnWidth = sourceWidth * fittedScale,
    drawnHeight = sourceHeight * fittedScale * verticalCompression;
  const baseOriginX = value.frameX + (value.frameWidth - drawnWidth) / 2;
  const baseOriginY =
    value.frameY +
    (value.frameHeight - drawnHeight) / 2 -
    (value.frameWidth < 1300 ? 12 : 0);
  return {
    scale: fittedScale,
    verticalCompression,
    originX: baseOriginX,
    originY: baseOriginY,
  };
}
function viewportSize(surface: HTMLElement) {
  const rect = surface.getBoundingClientRect();
  return {
    width: Math.max(surface.clientWidth || rect.width, 1),
    height: Math.max(surface.clientHeight || rect.height, 1),
  };
}

function clampPanToViewport(
  pan: PixelPoint,
  viewport: { width: number; height: number },
  zoom: number,
) {
  const maxX = Math.max(0, (viewport.width * (zoom - 1)) / 2);
  const maxY = Math.max(0, (viewport.height * (zoom - 1)) / 2);
  return {
    x: Math.round(clamp(pan.x, -maxX, maxX) * 1_000) / 1_000,
    y: Math.round(clamp(pan.y, -maxY, maxY) * 1_000) / 1_000,
  };
}

function transformViewPoint(
  point: PixelPoint,
  viewportWidth: number,
  viewportHeight: number,
  view: MapViewTransform,
) {
  const center = { x: viewportWidth / 2, y: viewportHeight / 2 };
  const angle = (view.rotation * Math.PI) / 180;
  const scaledX = (point.x - center.x) * view.zoom;
  const scaledY = (point.y - center.y) * view.zoom;
  return {
    x: center.x + scaledX * Math.cos(angle) - scaledY * Math.sin(angle) + view.panX,
    y: center.y + scaledX * Math.sin(angle) + scaledY * Math.cos(angle) + view.panY,
  };
}

function untransformViewPoint(
  point: PixelPoint,
  viewportWidth: number,
  viewportHeight: number,
  view: MapViewTransform,
) {
  const center = { x: viewportWidth / 2, y: viewportHeight / 2 };
  const angle = (-view.rotation * Math.PI) / 180;
  const translatedX = point.x - center.x - view.panX;
  const translatedY = point.y - center.y - view.panY;
  return {
    x:
      center.x +
      (translatedX * Math.cos(angle) - translatedY * Math.sin(angle)) / view.zoom,
    y:
      center.y +
      (translatedX * Math.sin(angle) + translatedY * Math.cos(angle)) / view.zoom,
  };
}
function pixelRectangle(a: PixelPoint, b: PixelPoint) {
  return {
    left: Math.min(a.x, b.x),
    top: Math.min(a.y, b.y),
    width: Math.abs(a.x - b.x),
    height: Math.abs(a.y - b.y),
  };
}
function format(value: number) {
  return value.toFixed(6);
}
function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}
