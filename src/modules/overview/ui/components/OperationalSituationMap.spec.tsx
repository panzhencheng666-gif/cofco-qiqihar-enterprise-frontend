/// <reference types="node" />
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("four-region terrain public situation scene", () => {
  const scenePath = resolve(
    "src/modules/overview/ui/components/FourRegionTerrainAtlas.tsx",
  );
  const scene = existsSync(scenePath) ? readFileSync(scenePath, "utf8") : "";
  const terrainStyle = readFileSync(
    resolve("src/modules/overview/ui/components/fourRegionTerrainStyle.ts"),
    "utf8",
  );
  const wrapper = readFileSync(
    resolve("src/modules/overview/ui/components/OperationalSituationMap.tsx"),
    "utf8",
  );
  const overviewPage = readFileSync(
    resolve("src/modules/overview/ui/pages/OverviewPage.tsx"),
    "utf8",
  );

  it("creates one globe-projected terrain map constrained to the four-region extent", () => {
    expect(scene.match(/new MapLibreMap/g)).toHaveLength(1);
    expect(scene).toContain('type: "globe"');
    expect(scene).toContain("map.setTerrain");
    expect(terrainStyle).toContain("REALISTIC_ROOT_BOUNDS.minLongitude");
    expect(terrainStyle).toContain("REALISTIC_ROOT_BOUNDS.maxLatitude");
    expect(scene).toContain("renderWorldCopies: false");
    expect(scene).toContain('localIdeographFontFamily: "sans-serif"');
    expect(scene).toContain("FOUR_REGION_BASE_STYLE");
    expect(scene).toContain("installTerrainEnhancements(");
    expect(scene).toContain("window.setTimeout(");
    expect(scene).toContain("window.clearTimeout(");
    expect(scene.indexOf("installAtlasLayers(map)")).toBeLessThan(
      scene.indexOf("installTerrainEnhancements("),
    );
    expect(overviewPage).toContain("{!publicSituationMode && (");
  });

  it("waits for the MapLibre style before enabling globe projection", () => {
    const loadHandler = scene.indexOf('map.on("load", () => {');
    const projection = scene.indexOf('map.setProjection({ type: "globe" })');

    expect(loadHandler).toBeGreaterThanOrEqual(0);
    expect(projection).toBeGreaterThan(loadHandler);
  });

  it("hides every non-governed place and labels only system Chinese regions", () => {
    expect(scene).toContain('map.addSource("atlas-world-mask"');
    expect(scene).toContain("createTerrainSurfaceMask(");
    expect(scene).toContain("terrainFootprint(");
    expect(scene).toContain('id: "atlas-world-mask"');
    expect(scene).toContain('"text-field": ["get", "name"]');
    expect(scene).not.toContain("World_Boundaries_and_Places");
    expect(terrainStyle).toContain('"source-layer": "transportation"');
    expect(terrainStyle).toContain('"source-layer": "building"');
    expect(terrainStyle).toContain('"source-layer": "poi"');
  });

  it("renders operational nodes as WebGL symbols without DOM map markers", () => {
    expect(scene).toContain('id: "atlas-operational-markers"');
    expect(scene).toContain("map.addImage");
    expect(scene).not.toMatch(/new\s+Marker\s*\(/);
    expect(scene).toContain('data-dom-markers="0"');
    expect(scene).toContain('["get", "selected"]');
    expect(scene).toContain("loadSvgMarkerImage(source)");
    expect(scene).not.toContain("runtime.map.loadImage(source)");
  });

  it("updates only changed public-situation sources during parent rerenders", () => {
    expect(scene).toContain("changedAtlasSources(");
    expect(scene).toContain("runtime.sourceReferences");
    expect(scene).toContain("runtime.lastLayerVisibilityKey");
    expect(scene).not.toContain("if (runtime?.ready) synchronize(runtime, props)");
  });

  it("selects and drills through the actual administrative polygon", () => {
    expect(scene).toContain('map.on("click", "atlas-regions-fill"');
    expect(scene).toContain('map.on("dblclick", "atlas-regions-fill"');
    expect(scene).toContain('mapFeatureStringProperty(event, "code")');
    expect(scene).not.toContain("nearest");
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
    expect(scene).toContain("onAnnotationPosition");
    expect(scene).toContain('map.addSource("atlas-annotation"');
  });

  it("pauses timeline animation while the page is hidden", () => {
    expect(wrapper).toContain('document.addEventListener("visibilitychange"');
    expect(wrapper).toContain('document.visibilityState !== "hidden"');
  });
});
