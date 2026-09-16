import { useEffect, useMemo, useState } from "react";

import type {
  MapAnnotation,
  MapAnnotationRepository,
  SaveMapAnnotation,
} from "../../application/ports/MapAnnotationRepository";
import "./map-annotation.css";

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

interface ProjectionMetadata {
  frameHeight: number;
  frameWidth: number;
  frameX: number;
  frameY: number;
  maxLatitude: number;
  maxLongitude: number;
  minLatitude: number;
  minLongitude: number;
}

export function MapAnnotationOverlay({
  active,
  bounds,
  repository,
  regionCode,
  administrativeLevel,
}: {
  active: boolean;
  bounds: AnnotationBounds;
  repository: MapAnnotationRepository;
  regionCode?: string;
  administrativeLevel?: SaveMapAnnotation["administrativeLevel"];
}) {
  const [annotation, setAnnotation] = useState<MapAnnotation>();
  const [armed, setArmed] = useState(false);
  const [start, setStart] = useState<PixelPoint>();
  const [preview, setPreview] = useState<PixelPoint>();
  const [issue, setIssue] = useState("");
  const [surfaceElement, setSurfaceElement] = useState<HTMLDivElement | null>(null);

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
  const shape = useMemo(
    () => annotation && shapeStyle(annotation, bounds, surfaceElement),
    [annotation, bounds, surfaceElement],
  );
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
    setStart(undefined);
    setPreview(undefined);
    setArmed(false);
    const first = toCoordinate(start, event.currentTarget, bounds);
    const last = toCoordinate(end, event.currentTarget, bounds);
    const dragged = Math.hypot(end.x - start.x, end.y - start.y) >= 5;
    const command: SaveMapAnnotation = dragged
      ? {
          type: "RECTANGLE",
          minLongitude: Math.min(first.longitude, last.longitude),
          maxLongitude: Math.max(first.longitude, last.longitude),
          minLatitude: Math.min(first.latitude, last.latitude),
          maxLatitude: Math.max(first.latitude, last.latitude),
          ...(regionCode ? { regionCode } : {}),
          ...(administrativeLevel ? { administrativeLevel } : {}),
        }
      : {
          type: "POINT",
          minLongitude: last.longitude,
          minLatitude: last.latitude,
          maxLongitude: null,
          maxLatitude: null,
          ...(regionCode ? { regionCode } : {}),
          ...(administrativeLevel ? { administrativeLevel } : {}),
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
  return (
    <div className="overview-map-annotation-layer">
      <div className="overview-map-annotation-actions">
        <button
          type="button"
          onClick={() => {
            setArmed((value) => !value);
            setStart(undefined);
            setPreview(undefined);
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
      <div
        className={`overview-map-annotation-surface${armed ? " is-armed" : ""}`}
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
      >
        {shape && (
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
      {annotation && (
        <aside
          aria-label="标注经纬度"
          role="dialog"
          className="overview-map-annotation-panel"
        >
          <strong>{annotation.type === "POINT" ? "点标注" : "矩形范围"}</strong>
          {annotation.type === "POINT" ? (
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
    </div>
  );
}

function toCoordinate(
  point: PixelPoint,
  surface: HTMLElement,
  bounds: AnnotationBounds,
) {
  const projection = projectionMetadata(surface);
  if (projection) {
    const transform = projectionTransform(projection);
    return {
      longitude: clamp(
        projection.minLongitude + (point.x - transform.originX) / transform.scale,
        projection.minLongitude,
        projection.maxLongitude,
      ),
      latitude: clamp(
        projection.maxLatitude -
          (point.y - transform.originY) /
            (transform.scale * transform.verticalCompression),
        projection.minLatitude,
        projection.maxLatitude,
      ),
    };
  }
  return {
    longitude:
      bounds.minLongitude +
      (point.x /
        Math.max(surface.clientWidth || surface.getBoundingClientRect().width, 1)) *
        (bounds.maxLongitude - bounds.minLongitude),
    latitude:
      bounds.maxLatitude -
      (point.y /
        Math.max(surface.clientHeight || surface.getBoundingClientRect().height, 1)) *
        (bounds.maxLatitude - bounds.minLatitude),
  };
}
function shapeStyle(
  value: MapAnnotation,
  bounds: AnnotationBounds,
  surface: HTMLElement | null,
) {
  const project = (longitude: number, latitude: number) => {
    const projection = surface && projectionMetadata(surface);
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
        (surface?.clientWidth || 100),
      y:
        ((bounds.maxLatitude - latitude) /
          (bounds.maxLatitude - bounds.minLatitude || 1)) *
        (surface?.clientHeight || 100),
    };
  };
  const lowerLeft = project(value.minLongitude, value.minLatitude);
  const upperRight = project(value.maxLongitude, value.maxLatitude);
  return value.type === "POINT"
    ? { left: lowerLeft.x, top: lowerLeft.y }
    : {
        left: lowerLeft.x,
        top: upperRight.y,
        width: upperRight.x - lowerLeft.x,
        height: lowerLeft.y - upperRight.y,
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
  };
  return Object.values(metadata).every(Number.isFinite) ? metadata : undefined;
}
function projectionTransform(value: ProjectionMetadata) {
  const insetX = value.frameWidth * 0.035,
    insetY = value.frameHeight * 0.035;
  const sourceWidth = Math.max(value.maxLongitude - value.minLongitude, 0.000001);
  const sourceHeight = Math.max(value.maxLatitude - value.minLatitude, 0.000001);
  const verticalCompression = value.frameWidth < 1300 ? 0.7 : 0.62;
  const scale = Math.min(
    (value.frameWidth - insetX * 2) / sourceWidth,
    (value.frameHeight - insetY * 2) / (sourceHeight * verticalCompression),
  );
  const drawnWidth = sourceWidth * scale,
    drawnHeight = sourceHeight * scale * verticalCompression;
  return {
    scale,
    verticalCompression,
    originX: value.frameX + (value.frameWidth - drawnWidth) / 2,
    originY:
      value.frameY +
      (value.frameHeight - drawnHeight) / 2 -
      (value.frameWidth < 1300 ? 12 : 0),
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
