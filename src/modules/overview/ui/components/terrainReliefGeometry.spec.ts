import { describe, expect, it } from "vitest";
import * as THREE from "three";

import type { OverviewRegion } from "../../domain/overview";
import type { MapFeature, MapPointFeature } from "./boundaryGeometry";
import {
  createReliefOverlayLayout,
  OVERVIEW_DETAILS_MAP_SAFE_GAP,
  OVERVIEW_RELIEF_DEPTH,
  overviewDetailsPanelLeft,
  overviewReliefFrame,
  overviewSelectionConnector,
  pointInReliefPolygon,
  projectReliefOverlays,
  projectReliefScene,
  reliefCircleInsidePolygon,
  reliefDirectionalRectInsidePolygon,
  reliefRectInsidePolygon,
  type ReliefFrame,
} from "./terrainReliefGeometry";
import {
  applyReliefLayoutMatrix,
  createMovableComponentGeometries,
  COMPONENT_HIGHLIGHT_LIFT,
  createVisibleWallGeometries,
  measureWallCompleteness,
  overviewWideStageOffset,
  reframeReliefScene,
  RELIEF_LAYER_Z,
  reliefComponentKey,
  selectReliefRenderBodies,
  shouldShowGroundOutlineSegment,
} from "./TerrainReliefBoundaryMap";
import * as TerrainReliefBoundaryMapModule from "./TerrainReliefBoundaryMap";
import {
  createGeologicalWallMaterial,
  createTerrainSurfaceMaterial,
} from "./terrainReliefMaterials";

const frame: ReliefFrame = { x: 190, y: 188, width: 985, height: 510 };

const reliefRuntime =
  TerrainReliefBoundaryMapModule as typeof TerrainReliefBoundaryMapModule & {
    compactAdministrativeName?: (name: string) => string;
    createRetryableResourceLoader?: <T>(load: () => Promise<T>) => () => Promise<T>;
  };

function region(
  code: string,
  name: string,
  level: OverviewRegion["level"],
): OverviewRegion {
  return { code, name, level, approvedRecordCount: 0 };
}

function polygonFeature(
  code: string,
  coordinates: [number, number][],
  level: OverviewRegion["level"] = "COUNTY",
): MapFeature {
  return {
    region: region(code, code, level),
    geometry: {
      type: "Polygon",
      coordinates: [coordinates],
    },
  };
}

describe("projectReliefScene", () => {
  it("keeps a parent-direct sample bucket attached to a stable backdrop label", () => {
    const backdrop = polygonFeature(
      "230200",
      [
        [0, 0],
        [20, 0],
        [20, 10],
        [0, 10],
        [0, 0],
      ],
      "PREFECTURE",
    );
    backdrop.region.name = "齐齐哈尔市";
    const child = polygonFeature(
      "230281",
      [
        [2, 2],
        [8, 2],
        [8, 8],
        [2, 8],
        [2, 2],
      ],
      "COUNTY",
    );
    const baseScene = projectReliefScene({
      backdrop,
      features: [child],
      frame,
      points: [],
    });
    const scene = projectReliefOverlays(
      baseScene,
      [
        {
          anchorRegionCode: "230200",
          scopeKind: "PARENT_DIRECT",
          regionCode: "PARENT_DIRECT:230200",
          regionName: "齐齐哈尔市本级",
          regionLevel: "PREFECTURE",
          samplePointCount: 3,
          productionCount: 2,
          marketCount: 1,
          validCoordinateCount: 3,
          dataQualityIssueCount: 0,
          correctionSourceCount: 0,
          unresolvedSourceCount: 0,
        },
      ],
      [],
    );

    expect(scene.labels.find(({ region }) => region.code === "230200")).toBeDefined();
    expect(
      createReliefOverlayLayout(scene).labels.find(
        ({ region }) => region.code === "230200",
      )?.visible,
    ).toBe(true);
  });

  it("centers the fixed relief composition inside a wider command stage", () => {
    expect(overviewWideStageOffset(1920)).toBe(0);
    expect(overviewWideStageOffset(2048)).toBe(64);
    expect(overviewWideStageOffset(3456)).toBe(768);
  });

  it("reserves a clear band below the KPI cards for map controls", () => {
    const fullFrame = overviewReliefFrame(false);
    const detailsFrame = overviewReliefFrame(true, 1920);

    expect(fullFrame.y).toBeGreaterThanOrEqual(290);
    expect(detailsFrame.y).toBeGreaterThanOrEqual(290);
    expect(fullFrame.x).toBeGreaterThanOrEqual(176);
    expect(detailsFrame.x).toBeGreaterThanOrEqual(176);
    expect(fullFrame.y + fullFrame.height).toBeLessThanOrEqual(996);
    expect(detailsFrame.y + detailsFrame.height).toBeLessThanOrEqual(996);
  });

  it("clears a rejected terrain resource promise so the next load can retry", async () => {
    const createRetryableResourceLoader = reliefRuntime.createRetryableResourceLoader;
    expect(createRetryableResourceLoader).toBeTypeOf("function");
    if (!createRetryableResourceLoader) return;

    let attempts = 0;
    const load = createRetryableResourceLoader(() => {
      attempts += 1;
      return attempts === 1
        ? Promise.reject(new Error("terrain unavailable"))
        : Promise.resolve("terrain ready");
    });

    await expect(load()).rejects.toThrow("terrain unavailable");
    await expect(load()).resolves.toBe("terrain ready");
    expect(attempts).toBe(2);
  });

  it("projects only non-village aggregates from an independently computed interior anchor", () => {
    const county = polygonFeature(
      "230225",
      [
        [123, 47],
        [125, 47],
        [125, 49],
        [123, 49],
        [123, 47],
      ],
      "COUNTY",
    );
    const village = polygonFeature(
      "230225204201",
      [
        [123.2, 47.2],
        [123.8, 47.2],
        [123.8, 47.8],
        [123.2, 47.8],
        [123.2, 47.2],
      ],
      "VILLAGE",
    );
    const projection = projectReliefScene({
      features: [county, village],
      frame,
      points: [],
      samplePointAggregates: [
        {
          regionCode: county.region.code,
          regionName: county.region.name,
          regionLevel: "COUNTY",
          samplePointCount: 17,
          productionCount: 12,
          marketCount: 5,
          validCoordinateCount: 17,
          dataQualityIssueCount: 0,
          correctionSourceCount: 0,
          unresolvedSourceCount: 0,
        },
        {
          regionCode: village.region.code,
          regionName: village.region.name,
          regionLevel: "VILLAGE",
          samplePointCount: 3,
          productionCount: 2,
          marketCount: 1,
          validCoordinateCount: 3,
          dataQualityIssueCount: 0,
          correctionSourceCount: 0,
          unresolvedSourceCount: 0,
        },
      ],
    });

    expect(projection.samplePointAggregates).toHaveLength(1);
    expect(projection.samplePointAggregates[0]?.aggregate.samplePointCount).toBe(17);
    expect(typeof projection.samplePointAggregates[0]?.point.x).toBe("number");
    expect(typeof projection.samplePointAggregates[0]?.point.y).toBe("number");
    expect(projection.samplePointAggregates[0]?.point).toEqual(
      projection.features[0]?.anchor,
    );
    expect(projection.samplePointAggregates[0]?.point).not.toBe(
      projection.features[0]?.anchor,
    );
  });

  it("anchors the explicit local-sample bucket to the real parent backdrop", () => {
    const parent = polygonFeature(
      "230202",
      [
        [123, 47],
        [125, 47],
        [125, 49],
        [123, 49],
        [123, 47],
      ],
      "COUNTY",
    );
    const child = polygonFeature(
      "230202997",
      [
        [123.2, 47.2],
        [124, 47.2],
        [124, 48],
        [123.2, 48],
        [123.2, 47.2],
      ],
      "TOWNSHIP",
    );

    const projection = projectReliefScene({
      backdrop: parent,
      features: [child],
      frame,
      points: [],
      samplePointAggregates: [
        {
          regionCode: parent.region.code,
          regionName: "本级样本",
          regionLevel: "COUNTY",
          scopeKind: "PARENT_DIRECT",
          anchorRegionCode: parent.region.code,
          samplePointCount: 1,
          productionCount: 1,
          marketCount: 0,
          logisticsCount: 0,
          validCoordinateCount: 0,
          dataQualityIssueCount: 1,
          correctionSourceCount: 0,
          unresolvedSourceCount: 1,
        },
      ],
    });

    expect(projection.samplePointAggregates).toHaveLength(1);
    expect(projection.samplePointAggregates[0]?.aggregate.scopeKind).toBe(
      "PARENT_DIRECT",
    );
    expect(projection.samplePointAggregates[0]?.point).toEqual(
      projection.backdrop?.anchor,
    );
  });

  it("reframes an aggregate with its region surface when the detail frame opens", () => {
    const county = polygonFeature(
      "230225",
      [
        [123, 47],
        [125, 47],
        [125, 49],
        [123, 49],
        [123, 47],
      ],
      "COUNTY",
    );
    const fullProjection = projectReliefScene({
      features: [county],
      frame: overviewReliefFrame(false),
      points: [],
      samplePointAggregates: [
        {
          regionCode: county.region.code,
          regionName: county.region.name,
          regionLevel: "COUNTY",
          samplePointCount: 17,
          productionCount: 12,
          marketCount: 5,
          validCoordinateCount: 17,
          dataQualityIssueCount: 0,
          correctionSourceCount: 0,
          unresolvedSourceCount: 0,
        },
      ],
    });

    const detailProjection = reframeReliefScene(
      fullProjection,
      overviewReliefFrame(true),
    );

    expect(detailProjection.samplePointAggregates).toHaveLength(1);
    expect(detailProjection.samplePointAggregates[0]?.point).toEqual(
      detailProjection.features[0]?.anchor,
    );
    expect(detailProjection.samplePointAggregates[0]?.point).toEqual(
      detailProjection.labels[0]?.point,
    );
    expect(detailProjection.samplePointAggregates[0]?.point).not.toEqual(
      fullProjection.samplePointAggregates[0]?.point,
    );
  });

  it("projects village sample-point icons through the same immutable map frame", () => {
    const samplePointFrame = overviewReliefFrame(false);
    const projection = projectReliefScene({
      features: [
        polygonFeature(
          "230202997001",
          [
            [123, 47],
            [124, 47],
            [124, 48],
            [123, 48],
            [123, 47],
          ],
          "VILLAGE",
        ),
      ],
      frame: samplePointFrame,
      points: [],
      samplePointIcons: [
        {
          samplePointId: "94000000-0000-0000-0000-000000000001",
          name: "契约测试样本点",
          iconKey: "farmer",
          types: [{ code: "FARMER", name: "农户", iconKey: "farmer" }],
          longitude: 123.5,
          latitude: 47.5,
          dataQualityReason: null,
        },
      ],
    });

    expect(projection.samplePointIcons).toHaveLength(1);
    expect(projection.samplePointIcons[0]?.icon.samplePointId).toBe(
      "94000000-0000-0000-0000-000000000001",
    );
    expect(typeof projection.samplePointIcons[0]?.point.x).toBe("number");
    expect(typeof projection.samplePointIcons[0]?.point.y).toBe("number");
  });

  it("anchors a design coverage badge to the village interior instead of its design coordinate", () => {
    const village = polygonFeature(
      "230202997001",
      [
        [123, 47],
        [124, 47],
        [124, 48],
        [123, 48],
        [123, 47],
      ],
      "VILLAGE",
    );
    const projection = projectReliefScene({
      features: [village],
      frame: overviewReliefFrame(false),
      points: [],
      samplePointIcons: [
        {
          samplePointId: "design-coverage:230202997001",
          name: "契约测试村设计覆盖",
          iconKey: "design-coverage",
          layerType: "DESIGN_COVERAGE_BADGE",
          anchorRegionCode: "230202997001",
          villageRegionCode: "230202997001",
          types: [
            {
              code: "DESIGN_COVERAGE",
              name: "行政村设计覆盖",
              iconKey: "design-coverage",
            },
          ],
          longitude: 130,
          latitude: 55,
          dataQualityReason: null,
        },
      ],
    });

    expect(projection.samplePointIcons[0]?.anchorPoint).toEqual(
      projection.features[0]?.anchor,
    );
    expect(projection.samplePointIcons[0]?.icon.longitude).toBe(130);
    expect(projection.samplePointIcons[0]?.icon.latitude).toBe(55);
  });

  it("anchors an aggregated county actual badge to the current township summary", () => {
    const township = polygonFeature(
      "230202997",
      [
        [123, 47],
        [124, 47],
        [124, 48],
        [123, 48],
        [123, 47],
      ],
      "TOWNSHIP",
    );
    const projection = projectReliefScene({
      backdrop: township,
      features: [],
      frame: overviewReliefFrame(false),
      points: [],
      samplePointIcons: [
        {
          samplePointId: "regional-actual:COUNTY:230202",
          name: "龙沙区区域级现有样本（2个）",
          iconKey: "regional-actual",
          layerType: "REGIONAL_ACTUAL_BADGE",
          anchorRegionCode: "230202997",
          representedRegionCode: "230202",
          representedRegionName: "龙沙区",
          representedRegionLevel: "COUNTY",
          aggregateCount: 2,
          types: [
            {
              code: "TRADER",
              name: "区域级现有样本",
              iconKey: "regional-actual",
            },
          ],
          longitude: null,
          latitude: null,
          dataQualityReason: "MISSING_COORDINATE",
        },
      ],
    });

    expect(projection.samplePointIcons[0]?.anchorPoint).toEqual(
      projection.backdrop?.anchor,
    );
  });

  it("separates multiple ancestor summaries that share one township anchor", () => {
    const township = polygonFeature(
      "230202997",
      [
        [123, 47],
        [124, 47],
        [124, 48],
        [123, 48],
        [123, 47],
      ],
      "TOWNSHIP",
    );
    const ancestorBadges = [
      ["PREFECTURE", "230200", "齐齐哈尔市", 3],
      ["COUNTY", "230202", "龙沙区", 2],
      ["TOWNSHIP", "230202997", "契约测试乡", 1],
    ].map(([level, code, name, count]) => ({
      samplePointId: `regional-actual:${level}:${code}`,
      name: `${name}区域级现有样本（${count}个）`,
      iconKey: "regional-actual",
      layerType: "REGIONAL_ACTUAL_BADGE" as const,
      anchorRegionCode: "230202997",
      representedRegionCode: code as string,
      representedRegionName: name as string,
      representedRegionLevel: level as "PREFECTURE" | "COUNTY" | "TOWNSHIP",
      aggregateCount: count as number,
      types: [],
      longitude: null,
      latitude: null,
      dataQualityReason: "MISSING_COORDINATE",
    }));
    const projection = projectReliefScene({
      backdrop: township,
      features: [],
      frame: overviewReliefFrame(false),
      points: [],
      samplePointIcons: ancestorBadges,
    });

    expect(projection.samplePointIcons.map(({ icon }) => icon)).toEqual(ancestorBadges);
    expect(
      new Set(projection.samplePointIcons.map(({ point }) => `${point.x}:${point.y}`))
        .size,
    ).toBe(3);
    projection.samplePointIcons.forEach(({ anchorPoint }) => {
      expect(anchorPoint).toEqual(projection.backdrop?.anchor);
    });
  });

  it("keeps verified colocated entities on their exact governed coordinate", () => {
    const samplePointFrame = overviewReliefFrame(false);
    const shared = {
      name: "并址主体",
      iconKey: "trader",
      types: [{ code: "TRADER", name: "贸易商", iconKey: "trader" }],
      longitude: 123.5,
      latitude: 47.5,
      dataQualityReason: null,
    };
    const projection = projectReliefScene({
      features: [
        polygonFeature(
          "230202997001",
          [
            [123, 47],
            [124, 47],
            [124, 48],
            [123, 48],
            [123, 47],
          ],
          "VILLAGE",
        ),
      ],
      frame: samplePointFrame,
      points: [],
      samplePointIcons: [
        { ...shared, samplePointId: "94000000-0000-0000-0000-000000000011" },
        { ...shared, samplePointId: "94000000-0000-0000-0000-000000000012" },
        { ...shared, samplePointId: "94000000-0000-0000-0000-000000000013" },
      ],
    });

    expect(
      new Set(projection.samplePointIcons.map(({ point }) => `${point.x}:${point.y}`))
        .size,
    ).toBe(1);
    projection.samplePointIcons.forEach((projected) => {
      expect(projected).toHaveProperty("anchorPoint");
      expect(projected.point).toEqual(projected.anchorPoint);
      expect(projected.icon.longitude).toBe(123.5);
      expect(projected.icon.latitude).toBe(47.5);
    });
  });

  it("does not relocate nearby governed markers to presentation grid points", () => {
    const samplePointFrame = overviewReliefFrame(false);
    const projection = projectReliefScene({
      features: [
        polygonFeature(
          "230202997001",
          [
            [123, 47],
            [124, 47],
            [124, 48],
            [123, 48],
            [123, 47],
          ],
          "VILLAGE",
        ),
      ],
      frame: samplePointFrame,
      points: [],
      samplePointIcons: [
        {
          samplePointId: "94000000-0000-0000-0000-000000000021",
          name: "相邻市场样本",
          iconKey: "market",
          roles: [{ code: "MARKET", name: "市场类", iconKey: "market" }],
          types: [{ code: "TRADER", name: "贸易商", iconKey: "trader" }],
          longitude: 123.5,
          latitude: 47.5,
          dataQualityReason: null,
        },
        {
          samplePointId: "94000000-0000-0000-0000-000000000022",
          name: "相邻物流样本",
          iconKey: "logistics",
          roles: [{ code: "LOGISTICS", name: "物流类", iconKey: "logistics" }],
          types: [{ code: "RAIL", name: "铁路站点", iconKey: "logistics" }],
          longitude: 123.505,
          latitude: 47.505,
          dataQualityReason: null,
        },
      ],
    });

    const [market, logistics] = projection.samplePointIcons;
    expect(market?.anchorPoint).toEqual(market?.point);
    expect(logistics?.anchorPoint).toEqual(logistics?.point);
    expect(
      Math.hypot(
        (market?.point.x ?? 0) - (logistics?.point.x ?? 0),
        (market?.point.y ?? 0) - (logistics?.point.y ?? 0),
      ),
    ).toBeLessThan(52);
    expect(logistics?.icon.longitude).toBe(123.505);
    expect(logistics?.icon.latitude).toBe(47.505);
  });

  it("keeps every dense governed identity at its one true coordinate", () => {
    const projection = projectReliefScene({
      features: [
        polygonFeature(
          "230202997001",
          [
            [123, 47],
            [124, 47],
            [124, 48],
            [123, 48],
            [123, 47],
          ],
          "VILLAGE",
        ),
      ],
      frame: overviewReliefFrame(false),
      points: [],
      samplePointIcons: Array.from({ length: 36 }, (_, index) => ({
        samplePointId: `94000000-0000-0000-0000-${String(index + 100).padStart(12, "0")}`,
        name: `密集样本${index + 1}`,
        iconKey: index % 2 ? "market" : "production",
        roles: [
          index % 2
            ? { code: "MARKET" as const, name: "市场类", iconKey: "market" }
            : { code: "PRODUCTION" as const, name: "产情类", iconKey: "production" },
        ],
        types: [],
        longitude: 123.5,
        latitude: 47.5,
        dataQualityReason: null,
      })),
    });

    expect(projection.samplePointIcons).toHaveLength(36);
    projection.samplePointIcons.forEach((current) => {
      expect(current.icon.longitude).toBe(123.5);
      expect(current.icon.latitude).toBe(47.5);
      expect(current.point).toEqual(current.anchorPoint);
    });
    expect(
      new Set(projection.samplePointIcons.map(({ point }) => `${point.x}:${point.y}`))
        .size,
    ).toBe(1);
  });

  it("provides one non-reused professional SVG path for every retained object type", () => {
    const iconPaths = reliefRuntime.samplePointIconPathData;
    expect(iconPaths).toBeDefined();
    expect(Object.keys(iconPaths ?? {})).toEqual([
      "farmer",
      "village-committee",
      "agricultural-tech-station",
      "trader",
      "deep-processor",
      "wholesale-market",
      "reserve-enterprise",
      "breeding-factory",
      "feed-mill",
      "rice-mill",
      "rail-node",
      "road-node",
    ]);
    expect(new Set(Object.values(iconPaths ?? {})).size).toBe(12);
  });
  it("hides only the raised component's stationary ground outline", () => {
    expect(shouldShowGroundOutlineSegment(["230200"], "")).toBe(true);
    expect(shouldShowGroundOutlineSegment(["230200"], "230200")).toBe(false);
    expect(shouldShowGroundOutlineSegment(["150700"], "230200")).toBe(true);
    expect(shouldShowGroundOutlineSegment(["230200", "150700"], "230200")).toBe(false);
  });

  it("uses the approved compact names for long administrative labels", () => {
    expect(reliefRuntime.compactAdministrativeName?.("梅里斯达斡尔族区")).toBe(
      "梅里斯区",
    );
    expect(reliefRuntime.compactAdministrativeName?.("莫力达瓦达斡尔族自治旗")).toBe(
      "莫旗",
    );
    expect(
      reliefRuntime.compactAdministrativeName?.("友谊达斡尔族满族柯尔克孜族乡"),
    ).toBe("友谊乡");
  });

  it("uses the available map viewport outside the control and legend safe bands", () => {
    const openFrame = overviewReliefFrame(false);
    const detailsFrame = overviewReliefFrame(true);

    expect(openFrame.y).toBeGreaterThanOrEqual(220);
    expect(openFrame.y + openFrame.height).toBeGreaterThanOrEqual(980);
    expect(openFrame.y + openFrame.height).toBeLessThanOrEqual(1010);
    expect(openFrame.x).toBeGreaterThanOrEqual(176);
    expect(openFrame.x + openFrame.width).toBeGreaterThanOrEqual(1810);
    expect(detailsFrame.y).toBe(openFrame.y);
    expect(detailsFrame.height).toBe(openFrame.height);
    expect(detailsFrame.x + detailsFrame.width).toBeLessThanOrEqual(1320);
  });

  it("keeps the enlarged earth wall above the persistent footer", () => {
    [overviewReliefFrame(false), overviewReliefFrame(true)].forEach((safeFrame) => {
      expect(
        safeFrame.y + safeFrame.height + OVERVIEW_RELIEF_DEPTH,
      ).toBeLessThanOrEqual(1040);
    });
  });

  it("fits polygon geometry wholly inside the visual safe frame", () => {
    const feature = polygonFeature("A", [
      [0, 0],
      [8, 0],
      [8, 4],
      [0, 4],
      [0, 0],
    ]);

    const scene = projectReliefScene({ features: [feature], points: [], frame });
    const positions = scene.features.flatMap((item) =>
      item.polygons.flatMap((shape) => shape.rings.flatMap((ring) => ring.points)),
    );

    expect(positions.length).toBeGreaterThan(0);
    expect(Math.min(...positions.map((point) => point.x))).toBeGreaterThanOrEqual(
      frame.x,
    );
    expect(Math.max(...positions.map((point) => point.x))).toBeLessThanOrEqual(
      frame.x + frame.width,
    );
    expect(Math.min(...positions.map((point) => point.y))).toBeGreaterThanOrEqual(
      frame.y,
    );
    expect(Math.max(...positions.map((point) => point.y))).toBeLessThanOrEqual(
      frame.y + frame.height,
    );
  });

  it("keeps lower-level point locations inside both open and detail safe frames", () => {
    const points: MapPointFeature[] = [
      {
        position: [0, 0],
        region: region("A", "西南村", "VILLAGE"),
      },
      {
        position: [12, 8],
        region: region("B", "东北村", "VILLAGE"),
      },
    ];

    [overviewReliefFrame(false), overviewReliefFrame(true)].forEach((safeFrame) => {
      const scene = projectReliefScene({ features: [], points, frame: safeFrame });
      expect(scene.points).toHaveLength(2);
      scene.points.forEach(({ point }) => {
        expect(point.x).toBeGreaterThanOrEqual(safeFrame.x);
        expect(point.x).toBeLessThanOrEqual(safeFrame.x + safeFrame.width);
        expect(point.y).toBeGreaterThanOrEqual(safeFrame.y);
        expect(point.y).toBeLessThanOrEqual(safeFrame.y + safeFrame.height);
      });
    });
  });

  it("preserves every polygon and ring from MultiPolygon geometry", () => {
    const feature: MapFeature = {
      region: region("M", "多区", "PREFECTURE"),
      geometry: {
        type: "MultiPolygon",
        coordinates: [
          [
            [
              [0, 0],
              [4, 0],
              [4, 4],
              [0, 4],
              [0, 0],
            ],
          ],
          [
            [
              [6, 1],
              [8, 1],
              [8, 3],
              [6, 3],
              [6, 1],
            ],
          ],
        ],
      },
    };

    const scene = projectReliefScene({ features: [feature], points: [], frame });

    expect(scene.features[0]?.polygons).toHaveLength(2);
    expect(scene.features[0]?.polygons.every((shape) => shape.rings.length === 1)).toBe(
      true,
    );
    expect(
      scene.labels
        .filter(({ kind }) => kind === "region")
        .map(({ componentId }) => componentId),
    ).toEqual([0]);
  });

  it("keeps one recessed parent substrate beneath the movable child caps", () => {
    const parent = polygonFeature("P", [
      [0, 0],
      [12, 0],
      [12, 8],
      [0, 8],
      [0, 0],
    ]);
    const multipartChild: MapFeature = {
      region: region("T", "多片区乡镇", "TOWNSHIP"),
      geometry: {
        type: "MultiPolygon",
        coordinates: [
          [
            [
              [0, 0],
              [8, 0],
              [8, 8],
              [0, 8],
              [0, 0],
            ],
          ],
          [
            [
              [8, 0],
              [12, 0],
              [12, 8],
              [8, 8],
              [8, 0],
            ],
          ],
        ],
      },
    };

    const scene = projectReliefScene({
      backdrop: parent,
      features: [multipartChild],
      points: [],
      frame,
    });
    const bodies = selectReliefRenderBodies(scene);

    expect(bodies.tops).toEqual([scene.backdrop]);
    expect(bodies.outlines).toHaveLength(1);
    expect(bodies.outlines[0]?.polygons).toHaveLength(2);
    expect(bodies.outlines[0]?.region.code).toBe("T");
    expect(bodies.outlines.some(({ region }) => region.code === "P")).toBe(false);
    expect(bodies.walls).toEqual([scene.backdrop]);
  });

  it("keeps a backdrop-only empty state flat instead of extruding one giant wall", () => {
    const parent = polygonFeature("P", [
      [0, 0],
      [12, 0],
      [12, 8],
      [0, 8],
      [0, 0],
    ]);
    const scene = projectReliefScene({
      backdrop: parent,
      features: [],
      points: [],
      frame,
    });

    const bodies = selectReliefRenderBodies(scene);

    expect(bodies.outlines).toEqual([scene.backdrop]);
    expect(bodies.tops).toEqual([scene.backdrop]);
    expect(bodies.walls).toEqual([]);
  });

  it("uses passive map context as a seamless cap without drawing another administrative outline", () => {
    const parent = polygonFeature("P", [
      [0, 0],
      [12, 0],
      [12, 8],
      [0, 8],
      [0, 0],
    ]);
    const township = polygonFeature(
      "T",
      [
        [0, 0],
        [7, 0],
        [7, 8],
        [0, 8],
        [0, 0],
      ],
      "TOWNSHIP",
    );
    const passiveContext = polygonFeature(
      "CTX",
      [
        [7, 0],
        [12, 0],
        [12, 8],
        [7, 8],
        [7, 0],
      ],
      "TOWNSHIP",
    );
    passiveContext.region.mapContextOnly = true;

    const scene = projectReliefScene({
      backdrop: parent,
      features: [township, passiveContext],
      points: [],
      frame,
    });
    const bodies = selectReliefRenderBodies(scene);

    expect(scene.features.map(({ region }) => region.code)).toEqual(["T", "CTX"]);
    expect(bodies.outlines.map(({ region }) => region.code)).toEqual(["T"]);
    expect(bodies.tops).toEqual([scene.backdrop]);
    expect(bodies.walls).toEqual([scene.backdrop]);
  });

  it("keeps the terrain texture visible while the exact hovered region lifts", () => {
    const texture = new THREE.Texture();
    const surface = createTerrainSurfaceMaterial(texture, "hover");
    const selectedSurface = createTerrainSurfaceMaterial(texture, "selected");
    const wall = createGeologicalWallMaterial(texture, "hover");

    expect((surface.uniforms.surfaceTint?.value as THREE.Color).getHex()).toBe(
      0xf2c94c,
    );
    expect(surface.uniforms.surfaceTintStrength?.value).toBeCloseTo(0.12);
    expect(selectedSurface.uniforms.surfaceTintStrength?.value).toBeCloseTo(0.16);
    expect((wall.uniforms.wallTop?.value as THREE.Color).getHex()).toBe(0xffd76a);
    expect(wall.side).toBe(THREE.FrontSide);
    expect(COMPONENT_HIGHLIGHT_LIFT).toBeGreaterThanOrEqual(20);

    surface.dispose();
    selectedSurface.dispose();
    wall.dispose();
    texture.dispose();
  });

  it("raises one exact component with its own short wall", () => {
    const feature = polygonFeature(
      "T",
      [
        [0, 0],
        [8, 0],
        [8, 6],
        [0, 6],
        [0, 0],
      ],
      "TOWNSHIP",
    );
    const scene = projectReliefScene({ features: [feature], points: [], frame });
    const surface = scene.features[0];

    expect(surface).toBeDefined();
    const movableComponent = createMovableComponentGeometries(surface!);
    expect(movableComponent.tops).toHaveLength(1);
    expect(movableComponent.walls).toHaveLength(1);

    const positions = movableComponent.walls[0]!.getAttribute("position");
    const top = {
      x: positions.getX(0),
      y: positions.getY(0),
      z: positions.getZ(0),
    };
    const bottom = {
      x: positions.getX(1),
      y: positions.getY(1),
      z: positions.getZ(1),
    };

    // The administrative footprint stays fixed in x/y. Relief is a real
    // vertical extrusion from the map ground, never a translated 2-D curtain.
    expect(bottom.x).toBe(top.x);
    expect(bottom.y).toBe(top.y);
    expect(top.z).toBe(0);
    expect(bottom.z).toBe(-COMPONENT_HIGHLIGHT_LIFT);
  });

  it("composes details-layout fitting with z elevation in one canvas matrix", () => {
    const root = new THREE.Group();
    root.matrixAutoUpdate = false;
    applyReliefLayoutMatrix(root, {
      scaleX: 0.62,
      scaleY: 0.71,
      screenOffsetX: 0,
      screenOffsetY: 0,
      uvOffsetX: 0,
      uvOffsetY: 0,
      worldOffsetX: -180,
      worldOffsetY: 36,
    });

    const ground = new THREE.Vector3(220, -90, 0).applyMatrix4(root.matrix);
    const raised = new THREE.Vector3(220, -90, COMPONENT_HIGHLIGHT_LIFT).applyMatrix4(
      root.matrix,
    );

    expect(ground.x).toBeCloseTo(220 * 0.62 - 180, 6);
    expect(ground.y).toBeCloseTo(-90 * 0.71 + 36, 6);
    expect(raised.x).toBeCloseTo(ground.x, 6);
    expect(raised.y - ground.y).toBeCloseTo(COMPONENT_HIGHLIGHT_LIFT * 0.71, 6);
    expect(ground.z).toBeCloseTo(90 * 0.71, 6);
    expect(raised.z - ground.z).toBeCloseTo(COMPONENT_HIGHLIGHT_LIFT, 6);
  });

  it("keeps the ground outline behind the raised interaction cap", () => {
    expect(RELIEF_LAYER_Z.baseOutline).toBeGreaterThan(RELIEF_LAYER_Z.baseTop);
    expect(RELIEF_LAYER_Z.baseOutline).toBeLessThan(RELIEF_LAYER_Z.interactionTop);
    expect(RELIEF_LAYER_Z.interactionOutline).toBeGreaterThan(
      RELIEF_LAYER_Z.interactionTop,
    );
  });

  it("keeps every server-governed boundary vertex for the visible relief", () => {
    const denseEdge = Array.from(
      { length: 101 },
      (_, index) => [index / 10, 0] as [number, number],
    );
    const feature = polygonFeature("D", [...denseEdge, [10, 5], [0, 5], [0, 0]]);

    const scene = projectReliefScene({ features: [feature], points: [], frame });
    const points = scene.features[0]?.polygons[0]?.rings[0]?.points ?? [];

    expect(points).toHaveLength(feature.geometry.coordinates[0]?.length ?? 0);
    expect(points[0]).toEqual(points.at(-1));
  });

  it("uses the exact visible polygon for pointer hit testing", () => {
    const curvedEdge = Array.from({ length: 401 }, (_, index) => {
      const x = index / 20;
      return [x, Math.sin(x * 1.7) * 0.12] as [number, number];
    });
    const feature = polygonFeature("H", [
      ...curvedEdge,
      [20, 5],
      [0, 5],
      curvedEdge[0] as [number, number],
    ]);

    const scene = projectReliefScene({ features: [feature], points: [], frame });
    const visible = scene.features[0]?.polygons[0]?.rings[0]?.points ?? [];
    const hit = scene.features[0]?.hitPolygons[0]?.rings[0]?.points ?? [];

    expect(hit).toEqual(visible);
    expect(hit[0]).toEqual(hit.at(-1));
    expect(scene.features[0]?.polygons).toBe(scene.features[0]?.hitPolygons);
  });

  it("does not cut narrow bays into false holes or detached wall fragments", () => {
    const feature = polygonFeature("N", [
      [0, 0],
      [12, 0],
      [12, 7],
      [8.2, 7],
      [8.2, 2.2],
      [7.8, 2.2],
      [7.8, 7],
      [4.2, 7],
      [4.2, 2.2],
      [3.8, 2.2],
      [3.8, 7],
      [0, 7],
      [0, 0],
    ]);

    const scene = projectReliefScene({ features: [feature], points: [], frame });
    const ring = scene.features[0]?.polygons[0]?.rings[0]?.points ?? [];

    expect(ring).toHaveLength(13);
    expect(new Set(ring.map(({ x, y }) => `${x}:${y}`)).size).toBe(12);
  });

  it("marks only the parent surface as side-wall geometry", () => {
    const parent = polygonFeature(
      "P",
      [
        [0, 0],
        [10, 0],
        [10, 7],
        [0, 7],
        [0, 0],
      ],
      "PREFECTURE",
    );
    const child = polygonFeature("C", [
      [1, 1],
      [4, 1],
      [4, 4],
      [1, 4],
      [1, 1],
    ]);

    const scene = projectReliefScene({
      backdrop: parent,
      features: [child],
      points: [],
      frame,
    });

    expect(scene.backdrop?.hasSideWall).toBe(true);
    expect(scene.backdrop?.wallPolygons).toHaveLength(1);
    expect(scene.features[0]?.hasSideWall).toBe(false);
  });

  it("keeps every detached component flat except the governed primary shell", () => {
    const parent: MapFeature = {
      region: region("P", "碎片化乡镇", "TOWNSHIP"),
      geometry: {
        type: "MultiPolygon",
        coordinates: [
          [
            [
              [0, 0],
              [8, 0],
              [8, 6],
              [0, 6],
              [0, 0],
            ],
          ],
          [
            [
              [9, 1],
              [10, 1],
              [10, 2],
              [9, 2],
              [9, 1],
            ],
          ],
          [
            [
              [11, 3],
              [11.2, 3],
              [11.2, 3.2],
              [11, 3.2],
              [11, 3],
            ],
          ],
        ],
      },
    };

    const scene = projectReliefScene({
      backdrop: parent,
      features: [],
      points: [],
      frame,
    });
    const walls = scene.backdrop
      ? createVisibleWallGeometries([scene.backdrop], OVERVIEW_RELIEF_DEPTH)
      : [];

    expect(scene.backdrop?.polygons).toHaveLength(3);
    expect(scene.backdrop?.hitPolygons).toHaveLength(3);
    expect(scene.backdrop?.wallPolygons).toHaveLength(1);
    expect(walls).toHaveLength(1);
  });

  it("keeps a real-feature solid fallback without rebuilding a client-side union", () => {
    const north = polygonFeature("N", [
      [0, 5],
      [10, 5],
      [10, 10],
      [0, 10],
      [0, 5],
    ]);
    const south = polygonFeature("S", [
      [0, 0],
      [10, 0],
      [10, 5],
      [0, 5],
      [0, 0],
    ]);

    const scene = projectReliefScene({
      features: [north, south],
      points: [],
      frame,
    });
    const walls = createVisibleWallGeometries(scene.features, OVERVIEW_RELIEF_DEPTH);
    const wallVertexCount = walls.reduce(
      (count, wall) => count + wall.getAttribute("position").count,
      0,
    );

    expect(scene.platform).toBeUndefined();
    expect(scene.features.every(({ hasSideWall }) => !hasSideWall)).toBe(true);
    expect(walls).toHaveLength(0);
    expect(wallVertexCount).toBe(0);
  });

  it("builds a closed complete outer wall without turning holes into walls", () => {
    const feature: MapFeature = {
      region: region("H", "凹形含孔地区", "TOWNSHIP"),
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [0, 0],
            [8, 0],
            [8, 2],
            [4, 2],
            [4, 6],
            [0, 6],
            [0, 0],
          ],
          [
            [1, 1],
            [2, 1],
            [2, 2],
            [1, 2],
            [1, 1],
          ],
        ],
      },
    };
    const scene = projectReliefScene({
      backdrop: feature,
      features: [],
      points: [],
      frame,
    });
    const surface = scene.backdrop;
    expect(surface).toBeDefined();
    if (!surface) return;

    const metrics = measureWallCompleteness(surface);
    expect(metrics.expectedEdgeCount).toBeGreaterThanOrEqual(1);
    expect(metrics.generatedEdgeCount).toBe(metrics.expectedEdgeCount);
    expect(metrics.generatedPerimeter).toBeCloseTo(metrics.expectedPerimeter, 5);
    expect(metrics.completeness).toBeCloseTo(1, 6);
    expect(metrics.holeWallEdgeCount).toBe(0);
    expect(metrics.zeroLengthEdgeCount).toBe(0);
  });

  it("gives the outside wall directional shading instead of a flat pasted strip", () => {
    const feature = polygonFeature("W", [
      [0, 0],
      [4, -2],
      [9, 0],
      [9, 3],
      [6, 3],
      [4, 7],
      [0, 5],
      [0, 0],
    ]);
    const scene = projectReliefScene({
      backdrop: feature,
      features: [],
      points: [],
      frame,
    });
    const walls = scene.backdrop
      ? createVisibleWallGeometries([scene.backdrop], OVERVIEW_RELIEF_DEPTH)
      : [];
    const shade = walls[0]?.getAttribute("wallShade");
    const values = shade ? Array.from(shade.array as ArrayLike<number>) : [];

    expect(values.length).toBeGreaterThan(0);
    expect(Math.max(...values) - Math.min(...values)).toBeGreaterThan(0.05);
  });

  it("interpolates wall light continuously across shared boundary vertices", () => {
    const feature = polygonFeature("S", [
      [0, 0],
      [5, -3],
      [10, 0],
      [9, 6],
      [3, 8],
      [0, 0],
    ]);
    const scene = projectReliefScene({
      backdrop: feature,
      features: [],
      points: [],
      frame,
    });
    const geometry = scene.backdrop
      ? createVisibleWallGeometries([scene.backdrop], OVERVIEW_RELIEF_DEPTH)[0]
      : undefined;
    expect(geometry).toBeDefined();
    if (!geometry) return;

    const positions = geometry.getAttribute("position");
    const shades = geometry.getAttribute("wallShade");
    const shadesByPosition = new Map<string, number[]>();
    for (let index = 0; index < positions.count; index += 1) {
      const key = `${positions.getX(index).toFixed(3)}:${positions
        .getY(index)
        .toFixed(3)}:${positions.getZ(index).toFixed(3)}`;
      const values = shadesByPosition.get(key) ?? [];
      values.push(shades.getX(index));
      shadesByPosition.set(key, values);
    }
    const discontinuities = [...shadesByPosition.values()].filter(
      (values) => Math.max(...values) - Math.min(...values) > 0.0001,
    );
    expect(discontinuities).toHaveLength(0);
  });

  it("extrudes only the exact foreground boundary without inventing a silhouette", () => {
    const feature = polygonFeature("F", [
      [0, 0],
      [10, 0],
      [10, 8],
      [0, 8],
      [0, 0],
    ]);
    const scene = projectReliefScene({
      backdrop: feature,
      features: [],
      points: [],
      frame,
    });
    const geometry = scene.backdrop
      ? createVisibleWallGeometries([scene.backdrop], OVERVIEW_RELIEF_DEPTH)[0]
      : undefined;
    expect(geometry).toBeDefined();
    const positionCount = geometry?.getAttribute("position").count ?? 0;
    expect(positionCount).toBe(4);
    expect(geometry?.getIndex()?.count).toBe(6);
  });

  it("keeps wall face orientation stable when source ring winding differs", () => {
    const wallNormal = (points: readonly { x: number; y: number }[]) => {
      const geometry = createVisibleWallGeometries(
        [{ polygons: [{ rings: [{ isHole: false, points }] }] }],
        OVERVIEW_RELIEF_DEPTH,
      )[0];
      expect(geometry).toBeDefined();
      const position = geometry!.getAttribute("position");
      const index = geometry!.getIndex();
      expect(index).not.toBeNull();
      const vertices = [0, 1, 2].map((offset) => {
        const vertexIndex = index!.getX(offset);
        return new THREE.Vector3(
          position.getX(vertexIndex),
          position.getY(vertexIndex),
          position.getZ(vertexIndex),
        );
      });
      return new THREE.Vector3()
        .subVectors(vertices[1]!, vertices[0]!)
        .cross(new THREE.Vector3().subVectors(vertices[2]!, vertices[0]!))
        .normalize();
    };
    const clockwise = [
      { x: 0, y: 0 },
      { x: 0, y: 10 },
      { x: 10, y: 10 },
      { x: 10, y: 0 },
      { x: 0, y: 0 },
    ];
    const counterClockwise = [...clockwise].reverse();

    expect(wallNormal(counterClockwise).dot(wallNormal(clockwise))).toBeCloseTo(1, 6);
  });

  it("does not bridge the geological wall across detached map components", () => {
    const rectangle = (left: number, right: number) => ({
      rings: [
        {
          isHole: false,
          points: [
            { x: left, y: 0 },
            { x: right, y: 0 },
            { x: right, y: 10 },
            { x: left, y: 10 },
            { x: left, y: 0 },
          ],
        },
      ],
    });
    const geometry = createVisibleWallGeometries(
      [{ polygons: [rectangle(0, 10), rectangle(20, 30)] }],
      OVERVIEW_RELIEF_DEPTH,
    )[0];

    expect(geometry).toBeDefined();
    if (!geometry) return;
    const positions = geometry.getAttribute("position");
    const indices = geometry.getIndex();
    expect(indices).not.toBeNull();
    if (!indices) return;

    const wallSpans: number[] = [];
    for (let offset = 0; offset < indices.count; offset += 6) {
      const startIndex = indices.getX(offset);
      const endIndex = indices.getX(offset + 2);
      wallSpans.push(Math.abs(positions.getX(endIndex) - positions.getX(startIndex)));
    }
    expect(Math.max(...wallSpans)).toBeLessThanOrEqual(10.01);
    expect(wallSpans).not.toContain(20);
  });

  it("keeps dense real boundary chains continuous in the geological wall", () => {
    const denseForeground = Array.from({ length: 61 }, (_, index) => ({
      x: 60 - index,
      y: 10 + Math.sin(index * 0.35) * 0.08,
    }));
    const geometry = createVisibleWallGeometries(
      [
        {
          polygons: [
            {
              rings: [
                {
                  isHole: false,
                  points: [
                    { x: 0, y: 0 },
                    { x: 60, y: 0 },
                    ...denseForeground,
                    { x: 0, y: 0 },
                  ],
                },
              ],
            },
          ],
        },
      ],
      OVERVIEW_RELIEF_DEPTH,
    )[0];

    expect(geometry).toBeDefined();
    expect((geometry?.getIndex()?.count ?? 0) / 6).toBe(60);
  });

  it("does not turn shared polygons inside one administrative region into walls", () => {
    const north = polygonFeature("N", [
      [0, 4],
      [10, 4],
      [10, 8],
      [0, 8],
      [0, 4],
    ]);
    const south = polygonFeature("S", [
      [0, 0],
      [10, 0],
      [10, 4],
      [0, 4],
      [0, 0],
    ]);
    const scene = projectReliefScene({ features: [north, south], points: [], frame });
    const geometry = createVisibleWallGeometries(
      [{ polygons: scene.features.flatMap(({ polygons }) => polygons) }],
      OVERVIEW_RELIEF_DEPTH,
    )[0];
    const outerScene = projectReliefScene({
      features: [
        polygonFeature("O", [
          [0, 0],
          [10, 0],
          [10, 8],
          [0, 8],
          [0, 0],
        ]),
      ],
      points: [],
      frame,
    });
    const outerGeometry = createVisibleWallGeometries(
      [{ polygons: outerScene.features.flatMap(({ polygons }) => polygons) }],
      OVERVIEW_RELIEF_DEPTH,
    )[0];

    expect(geometry).toBeDefined();
    expect((geometry?.getIndex()?.count ?? 0) / 6).toBe(1);
    expect((outerGeometry?.getIndex()?.count ?? 0) / 6).toBe(1);
  });

  it("keeps every detached polygon inside one regional lift entity", () => {
    const feature: MapFeature = {
      region: region("M", "离散行政区", "VILLAGE"),
      geometry: {
        type: "MultiPolygon",
        coordinates: [
          [
            [
              [0, 0],
              [6, 0],
              [6, 5],
              [0, 5],
              [0, 0],
            ],
          ],
          [
            [
              [20, 10],
              [24, 10],
              [24, 14],
              [20, 14],
              [20, 10],
            ],
          ],
        ],
      },
    };
    const scene = projectReliefScene({
      backdrop: feature,
      features: [],
      points: [],
      frame,
    });
    const surface = scene.backdrop;
    expect(surface).toBeDefined();
    if (!surface) return;

    const entity = createMovableComponentGeometries(surface);
    expect(entity.tops).toHaveLength(2);
    expect(entity.walls).toHaveLength(1);
    expect(surface.raiseablePolygonIndices).toEqual([0, 1]);
    expect(reliefComponentKey({ regionCode: "M", componentId: 0 })).toBe("M::0");
  });

  it.each(["PREFECTURE", "COUNTY", "TOWNSHIP"] as const)(
    "uses one complete regional entity at the %s level",
    (level) => {
      const feature: MapFeature = {
        region: region(`R-${level}`, `${level}测试地区`, level),
        geometry: {
          type: "MultiPolygon",
          coordinates: [
            [
              [
                [0, 0],
                [8, 0],
                [8, 6],
                [0, 6],
                [0, 0],
              ],
            ],
            [
              [
                [10, 2],
                [12, 2],
                [12, 4],
                [10, 4],
                [10, 2],
              ],
            ],
          ],
        },
      };
      const scene = projectReliefScene({ features: [feature], points: [], frame });
      const surface = scene.features[0];
      expect(surface).toBeDefined();
      if (!surface) return;

      expect(scene.labels.filter(({ kind }) => kind === "region")).toHaveLength(1);
      expect(createMovableComponentGeometries(surface).tops).toHaveLength(2);
    },
  );

  it("keeps every real point while density-limiting labels", () => {
    const parent = polygonFeature(
      "P",
      [
        [0, 0],
        [10, 0],
        [10, 10],
        [0, 10],
        [0, 0],
      ],
      "PREFECTURE",
    );
    const points: MapPointFeature[] = Array.from({ length: 40 }, (_, index) => ({
      position: [(index % 10) + 0.25, Math.floor(index / 10) + 0.25] as const,
      region: region(`V${index}`, `行政村${index}`, "VILLAGE"),
    }));

    const scene = projectReliefScene({ backdrop: parent, features: [], points, frame });

    expect(scene.points).toHaveLength(40);
    expect(scene.labels.filter((label) => label.kind === "point")).toHaveLength(0);
  });

  it("labels administrative villages when the governed township view is readable", () => {
    const parent = polygonFeature(
      "P",
      [
        [0, 0],
        [10, 0],
        [10, 10],
        [0, 10],
        [0, 0],
      ],
      "TOWNSHIP",
    );
    const points: MapPointFeature[] = Array.from({ length: 8 }, (_, index) => ({
      position: [index + 0.5, 5] as const,
      region: region(`V${index}`, `行政村${index}`, "VILLAGE"),
    }));

    const scene = projectReliefScene({ backdrop: parent, features: [], points, frame });

    expect(scene.labels.filter((label) => label.kind === "point")).toHaveLength(8);
  });
});

describe("polygon-contained relief overlay layout", () => {
  const views = [
    ["总揽", "PREFECTURE"],
    ["地级市", "COUNTY"],
    ["区县", "TOWNSHIP"],
    ["乡镇", "VILLAGE"],
    ["行政村", "VILLAGE"],
  ] as const;

  it("reuses projected administrative geometry when only the sample layer changes", () => {
    const county = polygonFeature(
      "230225",
      [
        [0, 0],
        [20, 0],
        [20, 12],
        [0, 12],
        [0, 0],
      ],
      "COUNTY",
    );
    const base = projectReliefScene({
      features: [county],
      frame: overviewReliefFrame(false),
      points: [],
    });
    const overlay = projectReliefOverlays(
      base,
      [],
      [
        {
          samplePointId: "design-coverage:230225",
          name: "甘南县设计覆盖",
          iconKey: "design-coverage",
          layerType: "DESIGN_COVERAGE_BADGE",
          anchorRegionCode: county.region.code,
          aggregateCount: 95,
          types: [
            {
              code: "DESIGN_COVERAGE",
              name: "行政村设计覆盖",
              iconKey: "design-coverage",
            },
          ],
          longitude: null,
          latitude: null,
          dataQualityReason: null,
        },
      ],
    );

    expect(overlay.features).toBe(base.features);
    expect(overlay.labels).toBe(base.labels);
    expect(overlay.samplePointIcons).toHaveLength(1);
  });

  it("keeps an administrative label at the same anchor when sample layers change", () => {
    const county = polygonFeature(
      "230225",
      [
        [0, 0],
        [20, 0],
        [20, 12],
        [0, 12],
        [0, 0],
      ],
      "COUNTY",
    );
    county.region.name = "甘南县";
    const withoutSampleLayer = projectReliefScene({
      features: [county],
      frame: overviewReliefFrame(false),
      points: [],
    });
    const withDesignLayer = projectReliefScene({
      features: [county],
      frame: overviewReliefFrame(false),
      points: [],
      samplePointIcons: [
        {
          samplePointId: "design-coverage:230225",
          name: "甘南县设计覆盖",
          iconKey: "design-coverage",
          layerType: "DESIGN_COVERAGE_BADGE",
          anchorRegionCode: county.region.code,
          aggregateCount: 95,
          types: [
            {
              code: "DESIGN_COVERAGE",
              name: "行政村设计覆盖",
              iconKey: "design-coverage",
            },
          ],
          longitude: null,
          latitude: null,
          dataQualityReason: null,
        },
      ],
    });

    const baseLabel = createReliefOverlayLayout(withoutSampleLayer).labels[0];
    const designLabel = createReliefOverlayLayout(withDesignLayer).labels[0];

    expect(designLabel?.point).toEqual(baseLabel?.point);
    expect(designLabel?.scale).toEqual(baseLabel?.scale);
  });

  it("keeps an exact edge coordinate fixed while facing the glyph toward the region interior", () => {
    const village = polygonFeature(
      "230202997001",
      [
        [0, 0],
        [10, 10],
        [0, 10],
        [0, 0],
      ],
      "VILLAGE",
    );
    const scene = projectReliefScene({
      features: [village],
      frame: overviewReliefFrame(false),
      points: [],
      samplePointIcons: [
        {
          samplePointId: "94000000-0000-0000-0000-000000000001",
          name: "边缘正式样本",
          regionCode: village.region.code,
          iconKey: "farmer",
          layerType: "ANNUAL_ACTUAL",
          types: [{ code: "FARMER", name: "农户", iconKey: "farmer" }],
          longitude: 5,
          latitude: 5,
          dataQualityReason: null,
        },
      ],
    });

    const projected = scene.samplePointIcons[0];
    const placed = createReliefOverlayLayout(scene).samplePointIcons[0];

    expect(placed?.anchorPoint).toEqual(projected?.anchorPoint);
    expect(placed?.point).toEqual(projected?.point);
    expect(placed?.glyphPlacement).toBe("above-left");
    expect(placed?.glyphFootprint).toBeDefined();
    expect(
      reliefDirectionalRectInsidePolygon(
        placed!.anchorPoint,
        placed!.glyphFootprint,
        placed!.glyphPlacement,
        scene.features[0]!.polygons[0]!,
        placed!.scale,
      ),
    ).toBe(true);
  });

  it("keeps an acute-vertex identity visible as an anchored contained callout", () => {
    const village = polygonFeature(
      "230202997002",
      [
        [0, 0],
        [10, 5],
        [0, 10],
        [0, 0],
      ],
      "VILLAGE",
    );
    const scene = projectReliefScene({
      features: [village],
      frame: overviewReliefFrame(false),
      points: [],
      samplePointIcons: [
        {
          samplePointId: "94000000-0000-0000-0000-000000000002",
          name: "锐角顶点正式样本",
          regionCode: village.region.code,
          iconKey: "farmer",
          layerType: "ANNUAL_ACTUAL",
          types: [{ code: "FARMER", name: "农户", iconKey: "farmer" }],
          longitude: 10,
          latitude: 5,
          dataQualityReason: null,
        },
      ],
    });

    const projected = scene.samplePointIcons[0]!;
    const placed = createReliefOverlayLayout(scene).samplePointIcons[0]!;

    expect(placed.anchorPoint).toEqual(projected.anchorPoint);
    expect(placed.visible).toBe(true);
    expect(placed.glyphPlacement).toBe("center");
    expect(placed.point).not.toEqual(placed.anchorPoint);
    expect(
      reliefRectInsidePolygon(
        placed.point,
        {
          height: placed.glyphFootprint.height * placed.scale,
          width: placed.glyphFootprint.width * placed.scale,
        },
        scene.features[0]!.polygons[0]!,
      ),
    ).toBe(true);
  });

  it("uses a positive-clearance micro callout for a valid extremely narrow region", () => {
    const village = polygonFeature(
      "230202997003",
      [
        [0, 0],
        [10, 0.001],
        [0, 0.002],
        [0, 0],
      ],
      "VILLAGE",
    );
    const scene = projectReliefScene({
      features: [village],
      frame: overviewReliefFrame(false),
      points: [],
      samplePointIcons: [
        {
          samplePointId: "94000000-0000-0000-0000-000000000003",
          name: "狭长区域正式样本",
          regionCode: village.region.code,
          iconKey: "farmer",
          layerType: "ANNUAL_ACTUAL",
          types: [{ code: "FARMER", name: "农户", iconKey: "farmer" }],
          longitude: 10,
          latitude: 0.001,
          dataQualityReason: null,
        },
      ],
    });

    const placed = createReliefOverlayLayout(scene).samplePointIcons[0]!;
    expect(placed.visible).toBe(true);
    expect(placed.glyphPolygonContained).toBe(true);
    expect(placed.scale).toBeGreaterThan(0);
    expect(placed.scale).toBeLessThan(0.1);
    expect(
      reliefRectInsidePolygon(
        placed.point,
        {
          height: placed.glyphFootprint.height * placed.scale,
          width: placed.glyphFootprint.width * placed.scale,
        },
        scene.features[0]!.polygons[0]!,
      ),
    ).toBe(true);
  });

  it("contains a child identity in the displayed ancestor when its own boundary is not rendered", () => {
    const township = polygonFeature(
      "230202998",
      [
        [0, 0],
        [10, 0],
        [10, 10],
        [0, 10],
        [0, 0],
      ],
      "TOWNSHIP",
    );
    const scene = projectReliefScene({
      features: [township],
      frame: overviewReliefFrame(false),
      points: [],
      samplePointIcons: [
        {
          samplePointId: "94000000-0000-0000-0000-000000000004",
          name: "未单独绘制村界的正式样本",
          regionCode: "230202998001",
          iconKey: "farmer",
          layerType: "ANNUAL_ACTUAL",
          types: [{ code: "FARMER", name: "农户", iconKey: "farmer" }],
          longitude: 10,
          latitude: 5,
          dataQualityReason: null,
        },
      ],
    });

    const placed = createReliefOverlayLayout(scene).samplePointIcons[0]!;
    expect(placed.visible).toBe(true);
    expect(placed.glyphPolygonContained).toBe(true);
    expect(placed.glyphPlacement).toBe("left");
  });

  it("separates a design coverage badge from the actual aggregate at the same region anchor", () => {
    const county = polygonFeature(
      "230202",
      [
        [0, 0],
        [20, 0],
        [20, 12],
        [0, 12],
        [0, 0],
      ],
      "COUNTY",
    );
    county.region.name = "测试区";
    const scene = projectReliefScene({
      features: [county],
      frame: overviewReliefFrame(false),
      points: [],
      samplePointAggregates: [
        {
          regionCode: county.region.code,
          regionName: county.region.name,
          regionLevel: county.region.level,
          samplePointCount: 0,
          productionCount: 0,
          marketCount: 0,
          validCoordinateCount: 0,
          dataQualityIssueCount: 0,
          correctionSourceCount: 0,
          unresolvedSourceCount: 0,
        },
      ],
      samplePointIcons: [
        {
          samplePointId: "design-coverage:230202",
          name: "测试区设计覆盖",
          iconKey: "design-coverage",
          layerType: "DESIGN_COVERAGE_BADGE",
          anchorRegionCode: county.region.code,
          aggregateCount: 95,
          types: [
            {
              code: "DESIGN_COVERAGE",
              name: "行政村设计覆盖",
              iconKey: "design-coverage",
            },
          ],
          longitude: null,
          latitude: null,
          dataQualityReason: null,
        },
      ],
    });

    const layout = createReliefOverlayLayout(scene);
    const positionedIcons = layout.samplePointIcons;
    const aggregate = layout.samplePointAggregates[0];
    const designBadge = positionedIcons[0];

    expect(positionedIcons).toHaveLength(1);
    expect(aggregate?.visible).toBe(true);
    expect(designBadge?.visible).toBe(true);
    if (aggregate && designBadge) {
      expect(
        Math.hypot(
          designBadge.point.x - aggregate.point.x,
          designBadge.point.y - aggregate.point.y,
        ),
      ).toBeGreaterThanOrEqual(
        aggregate.radius * aggregate.scale + designBadge.radius * designBadge.scale + 2,
      );
    }
  });

  it.each(views)(
    "%s在右栏关闭、打开、关闭回位时约束完整 label bbox 与 aggregate footprint",
    (_view, level) => {
      const backdrop = polygonFeature(
        `parent-${level}`,
        [
          [0, 0],
          [20, 0],
          [20, 10],
          [0, 10],
          [0, 0],
        ],
        level === "PREFECTURE" ? "PREFECTURE" : "COUNTY",
      );
      const target = polygonFeature(
        `target-${level}`,
        [
          [1, 1],
          [2.5, 1],
          [2.5, 4],
          [1, 4],
          [1, 1],
        ],
        level,
      );
      target.region.name = "测试区";
      const neighbor = polygonFeature(
        `neighbor-${level}`,
        [
          [4, 1],
          [18, 1],
          [18, 9],
          [4, 9],
          [4, 1],
        ],
        level,
      );
      const aggregates =
        level === "VILLAGE"
          ? []
          : [
              {
                regionCode: target.region.code,
                regionName: target.region.name,
                regionLevel: level,
                samplePointCount: 1234,
                productionCount: 4,
                marketCount: 3,
                validCoordinateCount: 7,
                dataQualityIssueCount: 0,
                correctionSourceCount: 0,
                unresolvedSourceCount: 0,
              },
            ];
      const full = projectReliefScene({
        backdrop,
        features: [target, neighbor],
        frame: overviewReliefFrame(false),
        points: [],
        samplePointAggregates: aggregates,
      });
      const details = reframeReliefScene(full, overviewReliefFrame(true));
      const states = [
        { name: "closed", scene: full },
        { name: "open", scene: details },
        { name: "returned", scene: full },
      ] as const;
      const layouts = states.map(({ scene }) => createReliefOverlayLayout(scene));

      states.forEach(({ name, scene }, stateIndex) => {
        const surface = scene.features.find(
          ({ region: item }) => item.code === target.region.code,
        );
        const polygon = surface?.polygons[surface.primaryPolygonIndex];
        const label = layouts[stateIndex]?.labels.find(
          ({ region }) => region.code === target.region.code,
        );
        expect(polygon, `${name} polygon`).toBeDefined();
        expect(label, `${name} label`).toBeDefined();
        expect(label?.visible, `${name} label visibility`).toBe(true);
        if (polygon && label?.visible) {
          if (level !== "VILLAGE") {
            expect(
              label.footprint.width,
              `${name} count gutter width`,
            ).toBeGreaterThanOrEqual(72);
            expect(
              label.footprint.height,
              `${name} count gutter height`,
            ).toBeGreaterThanOrEqual(34);
          }
          expect(
            reliefRectInsidePolygon(
              label.point,
              {
                height: label.footprint.height * label.scale,
                width: label.footprint.width * label.scale,
              },
              polygon,
            ),
            `${name} complete label bbox`,
          ).toBe(true);
        }

        const aggregate = layouts[stateIndex]?.samplePointAggregates.find(
          ({ aggregate: item }) => item.regionCode === target.region.code,
        );
        if (level === "VILLAGE") {
          expect(aggregate).toBeUndefined();
        } else {
          expect(aggregate?.visible, `${name} aggregate visibility`).toBe(true);
          if (polygon && aggregate?.visible) {
            expect(
              reliefCircleInsidePolygon(
                aggregate.point,
                aggregate.radius * aggregate.scale,
                polygon,
              ),
              `${name} aggregate ring`,
            ).toBe(true);
          }
        }
      });

      expect(layouts[2]).toEqual(layouts[0]);
    },
  );

  it("keeps a small administrative surface named with an anchored fallback label", () => {
    const tiny = polygonFeature(
      "tiny",
      [
        [0, 0],
        [0.08, 0],
        [0.08, 0.08],
        [0, 0.08],
        [0, 0],
      ],
      "VILLAGE",
    );
    tiny.region.name = "无法容纳的行政村名称";
    const context = polygonFeature(
      "context",
      [
        [0, 0],
        [10, 0],
        [10, 10],
        [0, 10],
        [0, 0],
      ],
      "TOWNSHIP",
    );
    const scene = projectReliefScene({
      backdrop: context,
      features: [tiny],
      frame: overviewReliefFrame(true),
      points: [],
    });

    const surface = scene.features[0];
    const polygon = surface?.polygons[surface.primaryPolygonIndex];
    const label = createReliefOverlayLayout(scene).labels[0];

    expect(polygon).toBeDefined();
    expect(label).toBeDefined();
    expect(label?.visible).toBe(true);
    expect(label?.scale).toBe(1);
    if (polygon && label) {
      expect(pointInReliefPolygon(label.point, polygon)).toBe(true);
      expect(
        reliefRectInsidePolygon(
          label.point,
          {
            height: label.footprint.height * label.scale,
            width: label.footprint.width * label.scale,
          },
          polygon,
        ),
      ).toBe(false);
    }
  });

  it("keeps one typography scale across neighboring township labels", () => {
    const township = polygonFeature(
      "231102201",
      [
        [1, 1],
        [2.7, 1],
        [2.7, 2],
        [1, 2],
        [1, 1],
      ],
      "TOWNSHIP",
    );
    township.region.name = "四嘉子满族乡";
    const context = polygonFeature(
      "231102",
      [
        [0, 0],
        [20, 0],
        [20, 10],
        [0, 10],
        [0, 0],
      ],
      "COUNTY",
    );
    const scene = projectReliefScene({
      backdrop: context,
      features: [township],
      frame,
      points: [],
    });

    const label = createReliefOverlayLayout(scene).labels[0];

    expect(label?.visible).toBe(true);
    expect(label?.scale).toBe(1);
  });

  it.each([
    { height: 985, name: "formal screenshot", width: 1480 },
    { height: 1080, name: "1920×1080", width: 1920 },
    { height: 1080, name: "2048×1080", width: 2048 },
  ])(
    "$name keeps every details surface and overlay outside the fixed details panel",
    ({ height, width }) => {
      const stageScale = Math.min(1, height / 1080);
      const stageWidth = width / stageScale;
      const panelLeft = overviewDetailsPanelLeft(stageWidth);
      const panelSafeGap = OVERVIEW_DETAILS_MAP_SAFE_GAP;
      const target = polygonFeature(
        "responsive-target",
        [
          [0, 0],
          [20, 0],
          [20, 10],
          [0, 10],
          [0, 0],
        ],
        "PREFECTURE",
      );
      target.region.name = "响应式验收地区";
      const full = projectReliefScene({
        features: [target],
        frame: overviewReliefFrame(false),
        points: [],
        samplePointAggregates: [
          {
            regionCode: target.region.code,
            regionName: target.region.name,
            regionLevel: target.region.level,
            samplePointCount: 7,
            productionCount: 4,
            marketCount: 3,
            validCoordinateCount: 7,
            dataQualityIssueCount: 0,
            correctionSourceCount: 0,
            unresolvedSourceCount: 0,
          },
        ],
      });
      // The second argument is the live command-stage width. Before the
      // responsive safe-frame fix the function ignored it and left the map
      // under the fixed 540 px details panel at the formal screenshot ratio.
      const details = reframeReliefScene(full, overviewReliefFrame(true, stageWidth));
      const layout = createReliefOverlayLayout(details);
      const surfacePoints = details.features.flatMap(({ polygons }) =>
        polygons.flatMap(({ rings }) => rings.flatMap(({ points }) => points)),
      );
      const surfaceRight = Math.max(...surfacePoints.map(({ x }) => x));

      expect(panelLeft - surfaceRight).toBeGreaterThanOrEqual(panelSafeGap);

      layout.labels
        .filter(({ visible }) => visible)
        .forEach(({ footprint, point, scale }) => {
          expect(
            panelLeft - (point.x + (footprint.width * scale) / 2),
          ).toBeGreaterThanOrEqual(panelSafeGap);
        });
      layout.samplePointAggregates
        .filter(({ visible }) => visible)
        .forEach(({ point, radius, scale }) => {
          expect(panelLeft - (point.x + radius * scale)).toBeGreaterThanOrEqual(
            panelSafeGap,
          );
        });

      const connector = overviewSelectionConnector({
        height: 1080,
        width: stageWidth,
        x: layout.labels[0]?.point.x ?? 0,
        y: layout.labels[0]?.point.y ?? 0,
      });
      expect(connector.panelX).toBeLessThan(panelLeft);
      expect(connector.panelX).toBe(panelLeft - 7);
    },
  );
});
