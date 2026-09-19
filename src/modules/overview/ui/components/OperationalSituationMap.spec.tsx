/// <reference types="node" />
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("realistic public situation scene", () => {
  const scene = readFileSync(
    resolve("src/modules/overview/ui/components/RealisticOperationalSituationMap.tsx"),
    "utf8",
  );
  const wrapper = readFileSync(
    resolve("src/modules/overview/ui/components/OperationalSituationMap.tsx"),
    "utf8",
  );

  it("uses one Cesium viewer with local imagery before online enhancement", () => {
    expect(scene.match(/new runtime\.Viewer/g)).toHaveLength(1);
    expect(scene).toContain('publicAssetUrl("Cesium/Assets/Textures/NaturalEarthII")');
    expect(scene).toContain("ArcGisMapServerImageryProvider.fromUrl");
    expect(scene).toContain("ArcGISTiledElevationTerrainProvider.fromUrl");
    expect(scene).toContain('dataset.imageryState = "local-fallback"');
    expect(scene).toContain('dataset.terrainState = "ellipsoid-fallback"');
  });

  it("renders operational nodes as Cesium collections without DOM map markers", () => {
    expect(scene).toContain("new runtime.BillboardCollection");
    expect(scene).toContain("new runtime.PointPrimitiveCollection");
    expect(scene).not.toContain("maplibre-gl");
    expect(scene).not.toMatch(/new\s+Marker\s*\(/);
    expect(scene).toContain('data-dom-markers="0"');
  });

  it("keeps depot categories independently focusable", () => {
    expect(wrapper).toContain('code: "OWNED"');
    expect(wrapper).toContain('code: "LEASED"');
    expect(wrapper).toContain('code: "HISTORICAL_LEASED"');
    expect(wrapper).toContain("focusDepotCategory(category)");
    expect(wrapper).toContain("白色内燃机车站点");
  });
});
