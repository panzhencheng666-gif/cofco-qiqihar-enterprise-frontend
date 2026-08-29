import type { OverviewRegion } from "../../domain/overview";
import type {
  OverviewSamplePointAggregate,
  OverviewSamplePointIcon,
} from "../../domain/overviewSamplePoint";
import {
  flattenCoordinates,
  type Geometry,
  type MapFeature,
  type MapPointFeature,
  type OverviewMapSelectionPoint,
  type Position,
} from "./boundaryGeometry";

export interface ReliefFrame {
  height: number;
  width: number;
  x: number;
  y: number;
}

export interface ReliefPoint {
  x: number;
  y: number;
}

export interface ReliefRing {
  isHole: boolean;
  points: readonly ReliefPoint[];
}

export interface ReliefPolygon {
  rings: readonly ReliefRing[];
}

export interface ReliefSurface {
  anchor: ReliefPoint;
  hasSideWall: boolean;
  /**
   * A display-only, coarser copy used exclusively for ray casting. The visible
   * top, outline and selected relief always keep `polygons`; separating the
   * two prevents Three.js from triangulating every high-resolution boundary
   * merely to detect a pointer hit.
   */
  hitPolygons: readonly ReliefPolygon[];
  /**
   * Stable index of the largest valid outer component. Region labels use this
   * component for hover/selection so a label never raises every detached part
   * of the same MultiPolygon.
   */
  primaryPolygonIndex: number;
  polygons: readonly ReliefPolygon[];
  /**
   * Components that passed the display-governance size gate. A secondary
   * component stays flat in the parent platform and does not affect framing,
   * but it may be raised independently when the user hits that exact mesh.
   */
  raiseablePolygonIndices: readonly number[];
  /**
   * Only these components form the always-raised parent platform. The
   * canonical primary component alone establishes the main geological base;
   * verified secondary components remain truthful flat outlines until the
   * user explicitly hits them. This prevents a remote enclave or bad source
   * fragment from shrinking the main map or becoming an unexplained high wall.
   */
  wallPolygons: readonly ReliefPolygon[];
  region: OverviewRegion;
}

/**
 * The raised earth platform underneath sibling administrative regions.
 * It intentionally has no business identity: siblings keep independent hit
 * areas and outlines, while their shared borders never create duplicate walls.
 */
export interface ReliefPlatform {
  polygons: readonly ReliefPolygon[];
}

export interface ReliefLocationPoint {
  point: ReliefPoint;
  region: OverviewRegion;
}

export interface ReliefSamplePointIcon {
  anchorPoint: ReliefPoint;
  icon: OverviewSamplePointIcon;
  point: ReliefPoint;
}

export interface ReliefSamplePointAggregate {
  aggregate: OverviewSamplePointAggregate;
  point: ReliefPoint;
}

export interface ReliefOverlayFootprint {
  height: number;
  width: number;
}

export interface ReliefOverlayPlacement {
  point: ReliefPoint;
  scale: number;
  visible: boolean;
}

export interface ReliefLabelPlacement extends ReliefOverlayPlacement, ReliefLabel {
  footprint: ReliefOverlayFootprint;
}

export interface ReliefSamplePointAggregatePlacement
  extends ReliefOverlayPlacement, ReliefSamplePointAggregate {
  radius: number;
}

export interface ReliefSamplePointIconPlacement
  extends ReliefOverlayPlacement, ReliefSamplePointIcon {
  glyphFootprint: ReliefOverlayFootprint;
  glyphPolygonContained: boolean;
  glyphPlacement:
    | "above"
    | "above-left"
    | "above-right"
    | "below"
    | "below-left"
    | "below-right"
    | "center"
    | "left"
    | "right";
  radius: number;
}

export interface ReliefOverlayLayout {
  labels: readonly ReliefLabelPlacement[];
  samplePointAggregates: readonly ReliefSamplePointAggregatePlacement[];
  samplePointIcons: readonly ReliefSamplePointIconPlacement[];
}

export interface ReliefLabel {
  componentId?: number;
  kind: "region" | "point";
  point: ReliefPoint;
  region: OverviewRegion;
}

export interface ReliefSceneProjection {
  backdrop?: ReliefSurface;
  diagnostics?: {
    sourceBoundsMs: number;
    surfaceProjectionMs: number;
    totalMs: number;
    unionMs: number;
  };
  features: readonly ReliefSurface[];
  frame: ReliefFrame;
  labels: readonly ReliefLabel[];
  platform?: ReliefPlatform;
  points: readonly ReliefLocationPoint[];
  samplePointAggregates: readonly ReliefSamplePointAggregate[];
  samplePointIcons: readonly ReliefSamplePointIcon[];
  sourceBounds?: SourceBounds;
}

interface SourceBounds {
  maxX: number;
  maxY: number;
  minX: number;
  minY: number;
}

const FRAME_INSET = 0.035;
const MAX_POINT_LABELS = 24;
const OVERLAY_CANDIDATE_STEPS = 24;
const OVERLAY_SAFE_MARGIN = 2;
const COMPARISON_MARKER_GAP = 8;
const MIN_AGGREGATE_SCALE = 0.58;
const RELIEF_SAMPLE_POINT_ICON_RADIUS = 17;
export const RELIEF_SAMPLE_POINT_AGGREGATE_RADIUS = 34;
export const OVERVIEW_RELIEF_DEPTH = 34;
export const OVERVIEW_DETAILS_MAP_SAFE_GAP = 32;
const OVERVIEW_DETAILS_PANEL_RIGHT = 11;
export const OVERVIEW_DETAILS_PANEL_WIDTH = 540;
const OVERVIEW_MINIMUM_STAGE_WIDTH = 1280;

const COMPACT_ADMINISTRATIVE_NAME_OVERRIDES: Readonly<Record<string, string>> = {
  梅里斯达斡尔族区: "梅里斯区",
  莫力达瓦达斡尔族自治旗: "莫旗",
};

export function compactAdministrativeName(name: string) {
  const overriddenName = COMPACT_ADMINISTRATIVE_NAME_OVERRIDES[name];
  if (overriddenName) return overriddenName;
  if (name.length <= 6) return name;
  const suffix = name.match(/(街道|苏木|民族乡|乡|镇|村)$/u)?.[0] ?? "";
  return `${name.slice(0, 2)}${suffix}`;
}

/**
 * Fixed 1920×1080 presentation frames. They reserve the KPI band, a dedicated
 * map-control band, the left legend rail, persistent footer, and (when open)
 * the detail drawer. Administrative geometry never renders beneath controls;
 * the relief depth and its contact shadow still remain above the footer.
 */
export function overviewDetailsPanelLeft(stageWidth: number) {
  return (
    Math.max(stageWidth, OVERVIEW_MINIMUM_STAGE_WIDTH) -
    OVERVIEW_DETAILS_PANEL_RIGHT -
    OVERVIEW_DETAILS_PANEL_WIDTH
  );
}

export function overviewReliefFrame(
  detailsOpen: boolean,
  stageWidth = 1920,
): ReliefFrame {
  const x = 180;
  const right = detailsOpen
    ? Math.min(
        1300,
        overviewDetailsPanelLeft(stageWidth) - OVERVIEW_DETAILS_MAP_SAFE_GAP,
      )
    : 1820;
  return {
    x,
    y: 290,
    width: Math.max(1, right - x),
    height: 706,
  };
}

export function overviewSelectionConnector(point: OverviewMapSelectionPoint) {
  const panelX = overviewDetailsPanelLeft(point.width) - 7;
  const panelY = Math.round(point.height * 0.286);
  const bendX = panelX - 70;
  const bendY = Math.max(panelY, point.y - 78);
  return { bendX, bendY, panelX, panelY };
}

export function projectReliefScene({
  backdrop,
  features,
  frame,
  points,
  samplePointAggregates = [],
  samplePointIcons = [],
}: {
  backdrop?: MapFeature;
  features: readonly MapFeature[];
  frame: ReliefFrame;
  points: readonly MapPointFeature[];
  samplePointAggregates?: readonly OverviewSamplePointAggregate[];
  samplePointIcons?: readonly OverviewSamplePointIcon[];
}): ReliefSceneProjection {
  const startedAt = performance.now();
  // Framing is a presentation concern, not a geometry mutation. Only each
  // region's canonical component participates in fit bounds; all original
  // MultiPolygon components are still projected, outlined and hit-testable.
  // A far-away enclave therefore cannot collapse the principal map into one
  // corner of the safe frame.
  const geometryPositions = [
    ...(backdrop ? canonicalGeometryPositions(backdrop.geometry) : []),
    ...features.flatMap(({ geometry }) => canonicalGeometryPositions(geometry)),
  ];
  const sourcePositions = geometryPositions.length
    ? geometryPositions
    : points.map(({ position }) => position);
  const bounds = calculateSourceBounds(sourcePositions);
  if (!bounds) {
    return {
      features: [],
      frame,
      labels: [],
      points: [],
      samplePointAggregates: [],
      samplePointIcons: [],
    };
  }
  const sourceBoundsReadyAt = performance.now();

  const project = createProjector(bounds, frame);
  const projectedBackdrop = backdrop
    ? projectSurface(backdrop, project, true)
    : undefined;
  const projectedFeatures = features.map((feature) =>
    projectSurface(feature, project, false),
  );
  const surfacesReadyAt = performance.now();
  const unionReadyAt = performance.now();
  const projectedPoints = points.map(({ position, region }) => ({
    point: project(position),
    region,
  }));
  const projectedSurfaces = [projectedBackdrop, ...projectedFeatures].filter(
    (surface): surface is ReliefSurface => Boolean(surface),
  );
  const surfaceByRegion = new Map(
    projectedSurfaces.map((surface) => [surface.region.code, surface]),
  );
  const pointByRegion = new Map(
    projectedPoints.map((location) => [location.region.code, location.point]),
  );
  const projectedSamplePointIcons = expandRegionalSummaryBadges(
    samplePointIcons.flatMap((icon) => {
      if (icon.anchorRegionCode) {
        const regionAnchor =
          surfaceByRegion.get(icon.anchorRegionCode)?.anchor ??
          pointByRegion.get(icon.anchorRegionCode);
        if (!regionAnchor) return [];
        const anchorPoint = { ...regionAnchor };
        return [{ anchorPoint, icon, point: { ...anchorPoint } }];
      }
      if (icon.longitude === null || icon.latitude === null) return [];
      const anchorPoint = project([icon.longitude, icon.latitude]);
      // Formal sample markers are exact coordinate evidence. Presentation layout
      // must never replace that evidence with an in-polygon collision position.
      return [{ anchorPoint, icon, point: { ...anchorPoint } }];
    }),
    projectedSurfaces,
  );
  // One administrative region is one map entity even when its source geometry
  // is a MultiPolygon. A single canonical label selects the complete boundary;
  // detached components must never become independently raised overlays.
  const aggregateByRegion = new Map(
    samplePointAggregates
      .filter(({ regionLevel }) => regionLevel !== "VILLAGE")
      .map((aggregate) => [
        aggregate.anchorRegionCode ?? aggregate.regionCode,
        aggregate,
      ]),
  );
  const labels: ReliefLabel[] = projectedFeatures.flatMap((surface) =>
    surface.raiseablePolygonIndices.length
      ? [
          {
            componentId: surface.primaryPolygonIndex,
            kind: "region" as const,
            point: surface.anchor,
            region: surface.region,
          },
        ]
      : [],
  );
  const parentDirectAggregate = projectedBackdrop
    ? aggregateByRegion.get(projectedBackdrop.region.code)
    : undefined;
  if (projectedBackdrop && parentDirectAggregate?.scopeKind === "PARENT_DIRECT") {
    labels.push({
      componentId: projectedBackdrop.primaryPolygonIndex,
      kind: "region",
      point: projectedBackdrop.anchor,
      region: projectedBackdrop.region,
    });
  }
  if (projectedPoints.length <= MAX_POINT_LABELS) {
    projectedPoints.forEach(({ point, region }) => {
      labels.push({ kind: "point", point, region });
    });
  }
  const projectedSamplePointAggregates: ReliefSamplePointAggregate[] = [];
  const projectedAggregateRegions = new Set<string>();
  projectedSurfaces.forEach((surface) => {
    const aggregate = aggregateByRegion.get(surface.region.code);
    if (!aggregate || surface.region.level === "VILLAGE") return;
    const primaryPolygon = surface.polygons[surface.primaryPolygonIndex];
    if (!primaryPolygon) return;
    projectedAggregateRegions.add(surface.region.code);
    projectedSamplePointAggregates.push({
      aggregate,
      point: reliefPolygonInteriorAnchor(primaryPolygon),
    });
  });
  projectedPoints.forEach(({ point, region }) => {
    const aggregate = aggregateByRegion.get(region.code);
    if (
      !aggregate ||
      region.level === "VILLAGE" ||
      projectedAggregateRegions.has(region.code)
    ) {
      return;
    }
    projectedAggregateRegions.add(region.code);
    projectedSamplePointAggregates.push({ aggregate, point: { ...point } });
  });

  return {
    ...(projectedBackdrop ? { backdrop: projectedBackdrop } : {}),
    diagnostics: {
      sourceBoundsMs: sourceBoundsReadyAt - startedAt,
      surfaceProjectionMs: surfacesReadyAt - sourceBoundsReadyAt,
      totalMs: performance.now() - startedAt,
      unionMs: unionReadyAt - surfacesReadyAt,
    },
    features: projectedFeatures,
    frame,
    labels,
    points: projectedPoints,
    samplePointAggregates: projectedSamplePointAggregates,
    samplePointIcons: projectedSamplePointIcons,
    sourceBounds: bounds,
  };
}

export function projectReliefOverlays(
  scene: ReliefSceneProjection,
  samplePointAggregates: readonly OverviewSamplePointAggregate[],
  samplePointIcons: readonly OverviewSamplePointIcon[],
): ReliefSceneProjection {
  if (!scene.sourceBounds) {
    return { ...scene, samplePointAggregates: [], samplePointIcons: [] };
  }
  const project = createProjector(scene.sourceBounds, scene.frame);
  const surfaces = [...(scene.backdrop ? [scene.backdrop] : []), ...scene.features];
  const surfaceByRegion = new Map(
    surfaces.map((surface) => [surface.region.code, surface]),
  );
  const pointByRegion = new Map(
    scene.points.map((location) => [location.region.code, location.point]),
  );
  const projectedIcons = expandRegionalSummaryBadges(
    samplePointIcons.flatMap((icon) => {
      if (icon.anchorRegionCode) {
        const anchor =
          surfaceByRegion.get(icon.anchorRegionCode)?.anchor ??
          pointByRegion.get(icon.anchorRegionCode);
        if (!anchor) return [];
        const anchorPoint = { ...anchor };
        return [{ anchorPoint, icon, point: { ...anchorPoint } }];
      }
      if (icon.longitude === null || icon.latitude === null) return [];
      const anchorPoint = project([icon.longitude, icon.latitude]);
      return [{ anchorPoint, icon, point: { ...anchorPoint } }];
    }),
    surfaces,
  );
  const aggregateByRegion = new Map(
    samplePointAggregates
      .filter(({ regionLevel }) => regionLevel !== "VILLAGE")
      .map((aggregate) => [
        aggregate.anchorRegionCode ?? aggregate.regionCode,
        aggregate,
      ]),
  );
  const projectedAggregates: ReliefSamplePointAggregate[] = [];
  const projectedRegions = new Set<string>();
  surfaces.forEach((surface) => {
    const aggregate = aggregateByRegion.get(surface.region.code);
    const polygon = surface.polygons[surface.primaryPolygonIndex];
    if (!aggregate || surface.region.level === "VILLAGE" || !polygon) return;
    projectedRegions.add(surface.region.code);
    projectedAggregates.push({
      aggregate,
      point: reliefPolygonInteriorAnchor(polygon),
    });
  });
  scene.points.forEach(({ point, region }) => {
    const aggregate = aggregateByRegion.get(region.code);
    if (!aggregate || region.level === "VILLAGE" || projectedRegions.has(region.code)) {
      return;
    }
    projectedRegions.add(region.code);
    projectedAggregates.push({ aggregate, point: { ...point } });
  });
  const backdropDirectAggregate = scene.backdrop
    ? aggregateByRegion.get(scene.backdrop.region.code)
    : undefined;
  const labels = scene.backdrop
    ? [
        ...scene.labels.filter(
          ({ region }) => region.code !== scene.backdrop?.region.code,
        ),
        ...(backdropDirectAggregate?.scopeKind === "PARENT_DIRECT"
          ? [
              {
                componentId: scene.backdrop.primaryPolygonIndex,
                kind: "region" as const,
                point: scene.backdrop.anchor,
                region: scene.backdrop.region,
              },
            ]
          : []),
      ]
    : scene.labels;
  return {
    ...scene,
    labels,
    samplePointAggregates: projectedAggregates,
    samplePointIcons: projectedIcons,
  };
}

/**
 * Regional summary badges explicitly do not represent precise coordinates. If
 * several administrative-level summaries share one regional anchor, separate
 * only those badges. Exact annual and approved design locations never enter
 * this presentation-only path.
 */
function expandRegionalSummaryBadges(
  icons: readonly ReliefSamplePointIcon[],
  surfaces: readonly ReliefSurface[],
) {
  const groups = new Map<string, ReliefSamplePointIcon[]>();
  icons
    .filter(({ icon }) => icon.layerType === "REGIONAL_ACTUAL_BADGE")
    .forEach((icon) => {
      const key = `${icon.anchorPoint.x.toFixed(12)}:${icon.anchorPoint.y.toFixed(12)}`;
      groups.set(key, [...(groups.get(key) ?? []), icon]);
    });

  groups.forEach((group) => {
    if (group.length < 2) return;
    const anchor = group[0]?.anchorPoint;
    if (!anchor) return;
    const polygon = surfaces
      .flatMap(({ polygons }) => polygons)
      .find((candidate) => pointInReliefPolygon(anchor, candidate));
    if (!polygon) return;
    const occupied = new Set([reliefPointKey(anchor)]);
    [...group]
      .sort((left, right) =>
        left.icon.samplePointId.localeCompare(right.icon.samplePointId),
      )
      .slice(1)
      .forEach((entry, index) => {
        const point = regionalSummaryDisplayPoint(
          anchor,
          polygon,
          index + 1,
          group.length,
          occupied,
        );
        entry.point = point;
        occupied.add(reliefPointKey(point));
      });
  });
  return icons;
}

function regionalSummaryDisplayPoint(
  anchor: ReliefPoint,
  polygon: ReliefPolygon,
  ordinal: number,
  count: number,
  occupied: ReadonlySet<string>,
) {
  const preferredAngle = -Math.PI / 2 + (Math.PI * 2 * ordinal) / count;
  for (const radius of [30, 24, 18, 14, 10, 7, 4, 2, 1, 0.5]) {
    for (let index = 0; index < 48; index += 1) {
      const step = Math.ceil(index / 2);
      const angleOffset = index === 0 ? 0 : ((index % 2 ? step : -step) * Math.PI) / 24;
      const candidate = {
        x: anchor.x + Math.cos(preferredAngle + angleOffset) * radius,
        y: anchor.y + Math.sin(preferredAngle + angleOffset) * radius,
      };
      if (
        pointInReliefPolygon(candidate, polygon) &&
        !occupied.has(reliefPointKey(candidate))
      ) {
        return candidate;
      }
    }
  }
  return anchor;
}

function reliefPointKey(point: ReliefPoint) {
  return `${point.x.toFixed(6)}:${point.y.toFixed(6)}`;
}

function projectSurface(
  feature: MapFeature,
  project: (position: Position) => ReliefPoint,
  hasSideWall: boolean,
): ReliefSurface {
  // The backend already supplies a topology-safe coverage simplification.
  // Simplifying each sibling again in screen space breaks shared vertices and
  // can turn narrow bays into false holes, duplicate strokes and detached wall
  // fragments. Visible, hit-test and wall geometry therefore share this exact
  // projected coverage.
  const polygons = projectGeometry(feature.geometry, project);
  const polygonsByArea = [...polygons].sort(
    (left, right) => reliefPolygonArea(right) - reliefPolygonArea(left),
  );
  const largestPolygon = polygonsByArea[0];
  const primaryPolygonIndex = largestPolygon ? polygons.indexOf(largestPolygon) : 0;
  // The indices remain useful for coverage diagnostics, but interaction treats
  // every component as part of one indivisible administrative-region entity.
  const raiseablePolygonIndices = polygons
    .map((polygon, index) => ({ index, area: reliefPolygonArea(polygon) }))
    .filter(({ area }) => area > 0.01)
    .map(({ index }) => index);

  return {
    anchor: largestPolygon
      ? reliefPolygonInteriorAnchor(largestPolygon)
      : { x: 0, y: 0 },
    hasSideWall,
    hitPolygons: polygons,
    primaryPolygonIndex,
    polygons,
    raiseablePolygonIndices,
    // The source geometry is never dissolved or invented. The canonical
    // parent component is the permanent platform; secondary components can be
    // raised only through their component-aware interaction overlay.
    wallPolygons: hasSideWall && largestPolygon ? [largestPolygon] : [],
    region: feature.region,
  };
}

function canonicalGeometryPositions(geometry: Geometry): Position[] {
  const polygons = geometryPolygons(geometry);
  const canonical = polygons.reduce<Position[][] | undefined>((largest, candidate) => {
    if (!largest) return candidate;
    return sourcePolygonArea(candidate) > sourcePolygonArea(largest)
      ? candidate
      : largest;
  }, undefined);
  return canonical?.flat() ?? flattenCoordinates(geometry);
}

function sourcePolygonArea(rings: readonly Position[][]) {
  return rings.reduce((area, ring, index) => {
    let signed = 0;
    ring.forEach(([x, y], pointIndex) => {
      const next = ring[(pointIndex + 1) % ring.length];
      if (next) signed += x * next[1] - next[0] * y;
    });
    const ringArea = Math.abs(signed / 2);
    return area + (index === 0 ? ringArea : -ringArea);
  }, 0);
}

function reliefPolygonArea(polygon: ReliefPolygon) {
  return polygon.rings.reduce(
    (area, ring) => area + (ring.isHole ? -1 : 1) * polygonArea(ring.points),
    0,
  );
}

function projectGeometry(
  geometry: Geometry,
  project: (position: Position) => ReliefPoint,
): ReliefPolygon[] {
  return geometryPolygons(geometry).map((rings) => ({
    rings: rings.map((ring, index) => ({
      isHole: index > 0,
      points: ring.map(project),
    })),
  }));
}

function squaredSegmentDistance(
  point: ReliefPoint,
  start: ReliefPoint,
  end: ReliefPoint,
) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (dx === 0 && dy === 0) {
    const pointDx = point.x - start.x;
    const pointDy = point.y - start.y;
    return pointDx * pointDx + pointDy * pointDy;
  }
  const ratio = Math.max(
    0,
    Math.min(
      1,
      ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy),
    ),
  );
  const projectedX = start.x + ratio * dx;
  const projectedY = start.y + ratio * dy;
  const projectedDx = point.x - projectedX;
  const projectedDy = point.y - projectedY;
  return projectedDx * projectedDx + projectedDy * projectedDy;
}

function geometryPolygons(geometry: Geometry): Position[][][] {
  return geometry.type === "Polygon"
    ? [geometry.coordinates as Position[][]]
    : (geometry.coordinates as Position[][][]);
}

function calculateSourceBounds(
  positions: readonly Position[],
): SourceBounds | undefined {
  if (!positions.length) return undefined;
  const xs = positions.map(([longitude]) => longitude);
  const ys = positions.map(([, latitude]) => latitude);
  return {
    maxX: Math.max(...xs),
    maxY: Math.max(...ys),
    minX: Math.min(...xs),
    minY: Math.min(...ys),
  };
}

function createProjector(bounds: SourceBounds, frame: ReliefFrame) {
  const insetX = frame.width * FRAME_INSET;
  const insetY = frame.height * FRAME_INSET;
  const availableWidth = frame.width - insetX * 2;
  const availableHeight = frame.height - insetY * 2;
  const sourceWidth = Math.max(bounds.maxX - bounds.minX, 0.000001);
  const sourceHeight = Math.max(bounds.maxY - bounds.minY, 0.000001);
  // The approved presentation view is a low-oblique relief map. Compressing
  // latitude in screen space gives the same footprint as a fixed pitched
  // camera while keeping the terrain texture and every interaction coordinate
  // on one immutable canvas. 0.62 also lets the three-prefecture overview use
  // the whole safe width instead of shrinking into the centre.
  const verticalCompression = frame.width < 1300 ? 0.7 : 0.62;
  const scale = Math.min(
    availableWidth / sourceWidth,
    availableHeight / (sourceHeight * verticalCompression),
  );
  const drawnWidth = sourceWidth * scale;
  const drawnHeight = sourceHeight * scale * verticalCompression;
  const originX = frame.x + (frame.width - drawnWidth) / 2;
  const originY =
    frame.y + (frame.height - drawnHeight) / 2 - (frame.width < 1300 ? 12 : 0);

  return ([longitude, latitude]: Position): ReliefPoint => ({
    x: originX + (longitude - bounds.minX) * scale,
    y: originY + (bounds.maxY - latitude) * scale * verticalCompression,
  });
}

function polygonArea(points: readonly ReliefPoint[]) {
  return Math.abs(signedArea(points));
}

function signedArea(points: readonly ReliefPoint[]) {
  let area = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    if (!current || !next) continue;
    area += current.x * next.y - next.x * current.y;
  }
  return area / 2;
}

function polygonCentroid(points: readonly ReliefPoint[]): ReliefPoint {
  if (!points.length) return { x: 0, y: 0 };
  const area = signedArea(points);
  if (Math.abs(area) < 0.001) {
    return {
      x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
      y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
    };
  }
  let x = 0;
  let y = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    if (!current || !next) continue;
    const cross = current.x * next.y - next.x * current.y;
    x += (current.x + next.x) * cross;
    y += (current.y + next.y) * cross;
  }
  const divisor = 6 * area;
  return { x: x / divisor, y: y / divisor };
}

/**
 * Deterministic point-on-surface anchor. A centroid may fall in a hole or
 * outside a concave administrative polygon, so labels use the deepest valid
 * sample inside the real component instead. No source coordinates change.
 */
export function reliefPolygonInteriorAnchor(polygon: ReliefPolygon): ReliefPoint {
  const outer = polygon.rings.find(({ isHole }) => !isHole)?.points ?? [];
  if (!outer.length) return { x: 0, y: 0 };
  const centroid = polygonCentroid(outer);
  const candidates: ReliefPoint[] = [centroid];
  const xs = outer.map(({ x }) => x);
  const ys = outer.map(({ y }) => y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const steps = 12;
  for (let yIndex = 1; yIndex < steps; yIndex += 1) {
    for (let xIndex = 1; xIndex < steps; xIndex += 1) {
      candidates.push({
        x: minX + ((maxX - minX) * xIndex) / steps,
        y: minY + ((maxY - minY) * yIndex) / steps,
      });
    }
  }
  const inside = candidates.filter((point) => pointInReliefPolygon(point, polygon));
  const positiveClearance = inside.filter(
    (point) => distanceToPolygonEdges(point, polygon) > 0,
  );
  const scanlineInterior = reliefScanlineInteriorPoint(polygon);
  if (scanlineInterior) positiveClearance.push(scanlineInterior);
  if (!positiveClearance.length) return outer[0] ?? { x: 0, y: 0 };
  return positiveClearance.reduce((best, candidate) =>
    distanceToPolygonEdges(candidate, polygon) > distanceToPolygonEdges(best, polygon)
      ? candidate
      : best,
  );
}

/** Finds a strict interior point even when a narrow polygon misses the regular grid. */
function reliefScanlineInteriorPoint(polygon: ReliefPolygon): ReliefPoint | undefined {
  const outer = polygon.rings.find(({ isHole }) => !isHole)?.points ?? [];
  for (let edgeIndex = 0; edgeIndex < outer.length; edgeIndex += 1) {
    const start = outer[edgeIndex];
    const end = outer[(edgeIndex + 1) % outer.length];
    if (!start || !end || start.y === end.y) continue;
    const y = (start.y + end.y) / 2;
    const intersections = polygon.rings
      .flatMap(({ points }) =>
        points.flatMap((point, index) => {
          const next = points[(index + 1) % points.length];
          if (!next || point.y > y === next.y > y) return [];
          return [point.x + ((y - point.y) * (next.x - point.x)) / (next.y - point.y)];
        }),
      )
      .sort((left, right) => left - right);
    const candidates: ReliefPoint[] = [];
    for (let index = 0; index + 1 < intersections.length; index += 1) {
      const candidate = {
        x: (intersections[index]! + intersections[index + 1]!) / 2,
        y,
      };
      if (
        pointInReliefPolygon(candidate, polygon) &&
        distanceToPolygonEdges(candidate, polygon) > 0
      ) {
        candidates.push(candidate);
      }
    }
    if (candidates.length) {
      return candidates.reduce((best, candidate) =>
        distanceToPolygonEdges(candidate, polygon) >
        distanceToPolygonEdges(best, polygon)
          ? candidate
          : best,
      );
    }
  }
  return undefined;
}

export function pointInReliefPolygon(point: ReliefPoint, polygon: ReliefPolygon) {
  const outer = polygon.rings.find(({ isHole }) => !isHole);
  if (!outer || classifyPointInReliefRing(point, outer.points) === "outside")
    return false;
  return !polygon.rings.some(
    ({ isHole, points }) =>
      isHole && classifyPointInReliefRing(point, points) === "inside",
  );
}

function classifyPointInReliefRing(
  point: ReliefPoint,
  ring: readonly ReliefPoint[],
): "boundary" | "inside" | "outside" {
  let inside = false;
  for (
    let index = 0, previous = ring.length - 1;
    index < ring.length;
    previous = index, index += 1
  ) {
    const current = ring[index];
    const before = ring[previous];
    if (!current || !before) continue;
    if (squaredSegmentDistance(point, current, before) <= 1e-12) return "boundary";
    const crosses =
      current.y > point.y !== before.y > point.y &&
      point.x <
        ((before.x - current.x) * (point.y - current.y)) /
          (before.y - current.y || Number.EPSILON) +
          current.x;
    if (crosses) inside = !inside;
  }
  return inside ? "inside" : "outside";
}

export function distanceToPolygonEdges(point: ReliefPoint, polygon: ReliefPolygon) {
  return Math.min(
    ...polygon.rings.flatMap(({ points }) =>
      points.map((start, index) => {
        const end = points[(index + 1) % points.length] ?? start;
        return Math.sqrt(squaredSegmentDistance(point, start, end));
      }),
    ),
  );
}

export function reliefRectInsidePolygon(
  point: ReliefPoint,
  footprint: ReliefOverlayFootprint,
  polygon: ReliefPolygon,
  margin = 0,
) {
  const halfWidth = footprint.width / 2 + margin;
  const halfHeight = footprint.height / 2 + margin;
  const corners = [
    { x: point.x - halfWidth, y: point.y - halfHeight },
    { x: point.x + halfWidth, y: point.y - halfHeight },
    { x: point.x + halfWidth, y: point.y + halfHeight },
    { x: point.x - halfWidth, y: point.y + halfHeight },
  ];
  if (
    ![...corners, point].every((candidate) => pointInReliefPolygon(candidate, polygon))
  ) {
    return false;
  }
  const rectangleEdges = corners.map((start, index) => ({
    end: corners[(index + 1) % corners.length] as ReliefPoint,
    start,
  }));
  const minX = point.x - halfWidth;
  const maxX = point.x + halfWidth;
  const minY = point.y - halfHeight;
  const maxY = point.y + halfHeight;
  for (const ring of polygon.rings) {
    for (let index = 0; index < ring.points.length; index += 1) {
      const start = ring.points[index];
      const end = ring.points[(index + 1) % ring.points.length];
      if (!start || !end) continue;
      if (start.x > minX && start.x < maxX && start.y > minY && start.y < maxY) {
        return false;
      }
      if (
        rectangleEdges.some((rectangle) =>
          reliefSegmentsProperlyIntersect(rectangle.start, rectangle.end, start, end),
        )
      ) {
        return false;
      }
    }
  }
  return true;
}

export function reliefCircleInsidePolygon(
  point: ReliefPoint,
  radius: number,
  polygon: ReliefPolygon,
  margin = 0,
) {
  return (
    pointInReliefPolygon(point, polygon) &&
    distanceToPolygonEdges(point, polygon) >= radius + margin
  );
}

export function reliefLabelFootprint(label: ReliefLabel): ReliefOverlayFootprint {
  const fontSize =
    label.kind === "point"
      ? 12
      : label.region.level === "COUNTY"
        ? 16
        : label.region.level === "TOWNSHIP"
          ? 18
          : 20;
  const letterSpacing =
    label.region.level === "COUNTY" || label.region.level === "TOWNSHIP"
      ? 0.025
      : 0.045;
  const glyphCount = Array.from(compactAdministrativeName(label.region.name)).length;
  const baseHeight = fontSize + 6;
  const baseWidth = Math.ceil(glyphCount * fontSize * (1 + letterSpacing) + 14);
  const canDisplayAggregateCount =
    label.kind === "region" && label.region.level !== "VILLAGE";
  return {
    height: canDisplayAggregateCount ? baseHeight + 12 : baseHeight,
    width: canDisplayAggregateCount ? Math.max(baseWidth, 72) : baseWidth,
  };
}

export function createReliefOverlayLayout(
  scene: ReliefSceneProjection,
): ReliefOverlayLayout {
  const surfaces = [...scene.features, ...(scene.backdrop ? [scene.backdrop] : [])];
  const surfaceByRegion = new Map(
    surfaces.map((surface) => [surface.region.code, surface]),
  );
  const samplePointAggregates = scene.samplePointAggregates.map((item) => {
    const surface = surfaceByRegion.get(
      item.aggregate.anchorRegionCode ?? item.aggregate.regionCode,
    );
    const polygon = surface?.polygons[surface.primaryPolygonIndex ?? 0];
    if (!polygon) {
      return {
        ...item,
        radius: RELIEF_SAMPLE_POINT_AGGREGATE_RADIUS,
        scale: 1,
        visible: true,
      };
    }
    return {
      ...item,
      ...placeReliefCircleInsidePolygon(
        polygon,
        item.point,
        RELIEF_SAMPLE_POINT_AGGREGATE_RADIUS,
      ),
      radius: RELIEF_SAMPLE_POINT_AGGREGATE_RADIUS,
    };
  });
  const aggregateByRegion = new Map(
    samplePointAggregates.map((item) => [
      item.aggregate.anchorRegionCode ?? item.aggregate.regionCode,
      item,
    ]),
  );
  const samplePointIcons = scene.samplePointIcons.map((item) => {
    const regionCode = samplePointIconRegionCode(item.icon);
    const aggregate = regionCode ? aggregateByRegion.get(regionCode) : undefined;
    const governedSurface = regionCode ? surfaceByRegion.get(regionCode) : undefined;
    const displayedSurface =
      governedSurface ??
      surfaces.find((candidate) =>
        candidate.polygons.some((polygon) =>
          pointInReliefPolygon(item.anchorPoint, polygon),
        ),
      );
    const polygon =
      displayedSurface?.polygons.find((candidate) =>
        pointInReliefPolygon(item.anchorPoint, candidate),
      ) ?? governedSurface?.polygons[governedSurface.primaryPolygonIndex ?? 0];
    const glyphFootprint = reliefSamplePointGlyphFootprint(
      item.icon,
      scene.frame.width < 1300,
    );
    if (
      item.icon.layerType !== "DESIGN_COVERAGE_BADGE" ||
      !aggregate?.visible ||
      !polygon
    ) {
      return {
        ...item,
        ...((item.icon.layerType ?? "ANNUAL_ACTUAL") === "ANNUAL_ACTUAL" && polygon
          ? placeExactReliefGlyphInsidePolygon(
              item.anchorPoint,
              displayedSurface?.anchor,
              polygon,
              glyphFootprint,
            )
          : {
              glyphPlacement: "center" as const,
              glyphPolygonContained: true,
              scale: 1,
              visible: true,
            }),
        glyphFootprint,
        radius: RELIEF_SAMPLE_POINT_ICON_RADIUS,
      };
    }
    return {
      ...item,
      ...placeReliefComparisonBadge(
        polygon,
        item.point,
        RELIEF_SAMPLE_POINT_ICON_RADIUS,
        aggregate,
      ),
      glyphPlacement: "center" as const,
      glyphFootprint,
      glyphPolygonContained: true,
      radius: RELIEF_SAMPLE_POINT_ICON_RADIUS,
    };
  });
  const labels = scene.labels.map((label) => {
    const footprint = reliefLabelFootprint(label);
    const surface = surfaceByRegion.get(label.region.code);
    const polygon = surface?.polygons[surface.primaryPolygonIndex ?? 0];
    if (!polygon) {
      return { ...label, footprint, scale: 1, visible: true };
    }
    return {
      ...label,
      footprint,
      // Administrative names belong to the boundary layer. Sample-network
      // modes are independent overlays and must never make the same region
      // name jump between actual, design, and comparison views.
      ...placeReliefRectInsidePolygon(polygon, label.point, footprint, []),
    };
  });
  return { labels, samplePointAggregates, samplePointIcons };
}

function samplePointIconRegionCode(icon: OverviewSamplePointIcon) {
  return icon.anchorRegionCode ?? icon.villageRegionCode ?? icon.regionCode;
}

export function inwardGlyphPlacement(
  anchor: ReliefPoint,
  interior?: ReliefPoint,
): ReliefSamplePointIconPlacement["glyphPlacement"] {
  if (!interior) return "above";
  const dx = interior.x - anchor.x;
  const dy = interior.y - anchor.y;
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? "right" : "left";
  return dy >= 0 ? "below" : "above";
}

export function reliefSamplePointGlyphFootprint(
  icon: OverviewSamplePointIcon,
  compact = false,
): ReliefOverlayFootprint {
  const roleCount = Math.max(1, icon.roles?.length ?? 1);
  const multiRoleSize = compact ? 26 : 34;
  const singleRoleSize = compact ? 30 : 42;
  const width =
    roleCount === 1
      ? singleRoleSize
      : Math.max(singleRoleSize, roleCount * multiRoleSize - (roleCount - 1) * 9);
  return { height: compact ? 34 : 48, width };
}

export function reliefDirectionalRectInsidePolygon(
  anchor: ReliefPoint,
  footprint: ReliefOverlayFootprint,
  placement: ReliefSamplePointIconPlacement["glyphPlacement"],
  polygon: ReliefPolygon,
  scale = 1,
) {
  if (placement === "center") {
    return reliefRectInsidePolygon(
      anchor,
      { height: footprint.height * scale, width: footprint.width * scale },
      polygon,
    );
  }
  const width = footprint.width * scale;
  const height = footprint.height * scale;
  const center =
    placement === "above"
      ? { x: anchor.x, y: anchor.y - height / 2 }
      : placement === "above-left"
        ? { x: anchor.x - width / 2, y: anchor.y - height / 2 }
        : placement === "above-right"
          ? { x: anchor.x + width / 2, y: anchor.y - height / 2 }
          : placement === "below"
            ? { x: anchor.x, y: anchor.y + height / 2 }
            : placement === "below-left"
              ? { x: anchor.x - width / 2, y: anchor.y + height / 2 }
              : placement === "below-right"
                ? { x: anchor.x + width / 2, y: anchor.y + height / 2 }
                : placement === "left"
                  ? { x: anchor.x - width / 2, y: anchor.y }
                  : { x: anchor.x + width / 2, y: anchor.y };
  return reliefRectInsidePolygon(center, { height, width }, polygon);
}

function placeExactReliefGlyphInsidePolygon(
  anchor: ReliefPoint,
  interior: ReliefPoint | undefined,
  polygon: ReliefPolygon,
  footprint: ReliefOverlayFootprint,
): Pick<
  ReliefSamplePointIconPlacement,
  "glyphPlacement" | "glyphPolygonContained" | "point" | "scale" | "visible"
> {
  const preferred = inwardGlyphPlacement(anchor, interior);
  const placements = (
    [
      preferred,
      "above",
      "below",
      "left",
      "right",
      "above-left",
      "above-right",
      "below-left",
      "below-right",
    ] as const
  ).filter((placement, index, values) => values.indexOf(placement) === index);
  const scales = [1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.15, 0.1];
  for (const scale of scales) {
    const placement = placements.find((candidate) =>
      reliefDirectionalRectInsidePolygon(anchor, footprint, candidate, polygon, scale),
    );
    if (placement) {
      return {
        glyphPlacement: placement,
        glyphPolygonContained: true,
        point: anchor,
        scale,
        visible: true,
      };
    }
  }
  // A finite axis-aligned glyph cannot share an acute polygon vertex as one of
  // its edges/corners. Keep the governed coordinate as anchor and use the
  // nearest contained cartographic callout instead of hiding a formal identity.
  const calloutCandidates = reliefPlacementCandidates(polygon, anchor);
  for (const point of calloutCandidates) {
    for (const scale of scales) {
      const scaled = {
        height: footprint.height * scale,
        width: footprint.width * scale,
      };
      if (reliefRectInsidePolygon(point, scaled, polygon)) {
        return {
          glyphPlacement: "center",
          glyphPolygonContained: true,
          point,
          scale,
          visible: true,
        };
      }
    }
  }
  const safeInterior = [
    ...(interior && pointInReliefPolygon(interior, polygon) ? [interior] : []),
    ...calloutCandidates,
  ].reduce<ReliefPoint | undefined>((best, candidate) => {
    if (!best) return candidate;
    return distanceToPolygonEdges(candidate, polygon) >
      distanceToPolygonEdges(best, polygon)
      ? candidate
      : best;
  }, undefined);
  if (safeInterior) {
    const clearance = distanceToPolygonEdges(safeInterior, polygon);
    const halfDiagonal = Math.hypot(footprint.width / 2, footprint.height / 2);
    const scale = Math.min(0.1, (clearance * 0.9) / halfDiagonal);
    if (
      scale > 0 &&
      reliefRectInsidePolygon(
        safeInterior,
        { height: footprint.height * scale, width: footprint.width * scale },
        polygon,
      )
    ) {
      return {
        glyphPlacement: "center",
        glyphPolygonContained: true,
        point: safeInterior,
        scale,
        visible: true,
      };
    }
  }
  // Valid administrative polygons have a positive-area point-on-surface. If a
  // malformed render polygon violates that invariant, keep the formal identity
  // out of the visual layer rather than asserting a false contained position.
  return {
    glyphPlacement: "center",
    glyphPolygonContained: false,
    point: anchor,
    scale: 0,
    visible: false,
  };
}

function placeReliefComparisonBadge(
  polygon: ReliefPolygon,
  preferred: ReliefPoint,
  radius: number,
  aggregate: ReliefSamplePointAggregatePlacement,
): ReliefOverlayPlacement {
  const aggregateRadius = aggregate.radius * aggregate.scale;
  const offset = aggregateRadius + radius + COMPARISON_MARKER_GAP;
  const diagonal = offset / Math.sqrt(2);
  const directionalCandidates = [
    { x: aggregate.point.x + diagonal, y: aggregate.point.y - diagonal },
    { x: aggregate.point.x + offset, y: aggregate.point.y },
    { x: aggregate.point.x - diagonal, y: aggregate.point.y - diagonal },
    { x: aggregate.point.x - offset, y: aggregate.point.y },
    { x: aggregate.point.x + diagonal, y: aggregate.point.y + diagonal },
    { x: aggregate.point.x - diagonal, y: aggregate.point.y + diagonal },
    { x: aggregate.point.x, y: aggregate.point.y - offset },
    { x: aggregate.point.x, y: aggregate.point.y + offset },
  ];
  const minimumDistance = aggregateRadius + radius + OVERLAY_SAFE_MARGIN;
  const candidates = [
    ...directionalCandidates,
    ...reliefPlacementCandidates(polygon, preferred),
  ];
  const point = candidates.find(
    (candidate) =>
      reliefCircleInsidePolygon(candidate, radius, polygon, OVERLAY_SAFE_MARGIN) &&
      Math.hypot(candidate.x - aggregate.point.x, candidate.y - aggregate.point.y) >=
        minimumDistance,
  );
  if (point) return { point, scale: 1, visible: true };

  return {
    ...placeReliefCircleInsidePolygon(polygon, preferred, radius),
    visible: false,
  };
}

function placeReliefCircleInsidePolygon(
  polygon: ReliefPolygon,
  preferred: ReliefPoint,
  radius: number,
): ReliefOverlayPlacement {
  const candidates = reliefPlacementCandidates(polygon, preferred);
  const best = candidates.reduce<ReliefPoint | undefined>((current, candidate) => {
    if (!current) return candidate;
    const candidateDistance = distanceToPolygonEdges(candidate, polygon);
    const currentDistance = distanceToPolygonEdges(current, polygon);
    if (candidateDistance > currentDistance + 0.001) return candidate;
    if (Math.abs(candidateDistance - currentDistance) > 0.001) return current;
    return squaredPointDistance(candidate, preferred) <
      squaredPointDistance(current, preferred)
      ? candidate
      : current;
  }, undefined);
  if (!best) return { point: preferred, scale: MIN_AGGREGATE_SCALE, visible: false };
  const availableRadius = Math.max(
    0,
    distanceToPolygonEdges(best, polygon) - OVERLAY_SAFE_MARGIN,
  );
  const scale = Math.min(1, Math.floor((availableRadius / radius) * 1000) / 1000);
  return {
    point: best,
    scale: Math.max(scale, MIN_AGGREGATE_SCALE),
    visible:
      scale >= MIN_AGGREGATE_SCALE &&
      reliefCircleInsidePolygon(best, radius * scale, polygon, OVERLAY_SAFE_MARGIN),
  };
}

function placeReliefRectInsidePolygon(
  polygon: ReliefPolygon,
  preferred: ReliefPoint,
  footprint: ReliefOverlayFootprint,
  exclusions: readonly { point: ReliefPoint; radius: number }[],
): ReliefOverlayPlacement {
  const candidates = reliefPlacementCandidates(polygon, preferred);
  const scaled = { height: footprint.height, width: footprint.width };
  const point = candidates.find(
    (candidate) =>
      reliefRectInsidePolygon(candidate, scaled, polygon, OVERLAY_SAFE_MARGIN) &&
      exclusions.every(
        (exclusion) =>
          !reliefCircleIntersectsRect(
            exclusion.point,
            exclusion.radius,
            candidate,
            scaled,
          ),
      ),
  );
  if (point) return { point, scale: 1, visible: true };
  return {
    point: candidates[0] ?? preferred,
    scale: 1,
    visible: true,
  };
}

function reliefPlacementCandidates(polygon: ReliefPolygon, preferred: ReliefPoint) {
  const outer = polygon.rings.find(({ isHole }) => !isHole)?.points ?? [];
  if (!outer.length) return [];
  const xs = outer.map(({ x }) => x);
  const ys = outer.map(({ y }) => y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const candidates: ReliefPoint[] = pointInReliefPolygon(preferred, polygon)
    ? [{ ...preferred }]
    : [];
  for (let yIndex = 1; yIndex < OVERLAY_CANDIDATE_STEPS; yIndex += 1) {
    for (let xIndex = 1; xIndex < OVERLAY_CANDIDATE_STEPS; xIndex += 1) {
      const candidate = {
        x: minX + ((maxX - minX) * xIndex) / OVERLAY_CANDIDATE_STEPS,
        y: minY + ((maxY - minY) * yIndex) / OVERLAY_CANDIDATE_STEPS,
      };
      if (pointInReliefPolygon(candidate, polygon)) candidates.push(candidate);
    }
  }
  return candidates.sort(
    (left, right) =>
      squaredPointDistance(left, preferred) - squaredPointDistance(right, preferred),
  );
}

function reliefCircleIntersectsRect(
  circle: ReliefPoint,
  radius: number,
  rectangle: ReliefPoint,
  footprint: ReliefOverlayFootprint,
) {
  const closestX = Math.max(
    rectangle.x - footprint.width / 2,
    Math.min(circle.x, rectangle.x + footprint.width / 2),
  );
  const closestY = Math.max(
    rectangle.y - footprint.height / 2,
    Math.min(circle.y, rectangle.y + footprint.height / 2),
  );
  return Math.hypot(circle.x - closestX, circle.y - closestY) < radius;
}

function squaredPointDistance(left: ReliefPoint, right: ReliefPoint) {
  const dx = left.x - right.x;
  const dy = left.y - right.y;
  return dx * dx + dy * dy;
}

function reliefSegmentsProperlyIntersect(
  a: ReliefPoint,
  b: ReliefPoint,
  c: ReliefPoint,
  d: ReliefPoint,
) {
  const cross = (start: ReliefPoint, end: ReliefPoint, point: ReliefPoint) =>
    (end.x - start.x) * (point.y - start.y) - (end.y - start.y) * (point.x - start.x);
  const abC = cross(a, b, c);
  const abD = cross(a, b, d);
  const cdA = cross(c, d, a);
  const cdB = cross(c, d, b);
  return abC * abD < 0 && cdA * cdB < 0;
}
