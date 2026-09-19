/// <reference types="node" />
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("regional earth public situation scene", () => {
  const scene = readFileSync(
    resolve("src/modules/overview/ui/components/RegionalEarthScene.tsx"),
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
    expect(scene).toContain("World_Transportation");
    expect(scene).toContain("World_Boundaries_and_Places");
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

  it("edits account annotations inside the same earth scene", () => {
    expect(wrapper).toContain("地图标注");
    expect(wrapper).toContain("annotationRepository.save(command)");
    expect(wrapper).toContain("annotationRepository.delete()");
    expect(scene).toContain("handleAnnotationPosition");
    expect(scene).toContain('id: "saved-map-annotation"');
  });

  it("keeps the geography continuous instead of painting an isolated region plate", () => {
    expect(scene).toContain("World_Boundaries_and_Places");
    expect(scene).toContain("selected ? 0.075 : 0.001");
    expect(scene).not.toContain("extrudedHeight");
  });
});
