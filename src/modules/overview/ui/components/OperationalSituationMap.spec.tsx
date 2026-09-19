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
  const sceneStyles = readFileSync(
    resolve("src/modules/overview/ui/components/realistic-operational-situation.css"),
    "utf8",
  );
  const panelStyles = readFileSync(
    resolve("src/modules/overview/ui/components/operational-situation.css"),
    "utf8",
  );
  const overviewPage = readFileSync(
    resolve("src/modules/overview/ui/pages/OverviewPage.tsx"),
    "utf8",
  );

  it("creates one continuous terrain map with real elevation", () => {
    expect(scene.match(/new MapLibreMap/g)).toHaveLength(1);
    expect(scene).toContain("map.setTerrain");
    expect(scene).not.toContain('type: "globe"');
    expect(terrainStyle).not.toContain("REALISTIC_ROOT_BOUNDS");
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

  it("uses terrain-first perspective without a dark administrative cutout", () => {
    expect(scene).not.toContain('id: "atlas-regions-halo"');
    expect(scene).not.toContain('id: "atlas-world-mask"');
    expect(scene).not.toContain('"fill-color": "#07130f"');
    expect(scene).toContain("pitch: 48");
    expect(scene).toContain("terrainExaggeration");
  });

  it("keeps geography continuous and labels only system Chinese regions", () => {
    expect(scene).not.toContain('map.addSource("atlas-world-mask"');
    expect(scene).not.toContain("createTerrainSurfaceMask(");
    expect(scene).not.toContain("terrainFootprint(");
    expect(scene).toContain('"text-field": ["get", "name"]');
    expect(scene).not.toContain("World_Boundaries_and_Places");
    expect(terrainStyle).toContain('"source-layer": "transportation"');
    expect(terrainStyle).toContain('"source-layer": "building"');
    expect(terrainStyle).toContain('"source-layer": "poi"');
  });

  it("focuses the chosen region geometry instead of drifting outside it", () => {
    expect(scene).toContain("terrainFocusBounds(");
    expect(scene).toContain("props.selectedRegionCode");
    expect(scene).toContain(
      'if (changed.has("regions") || boundsKey !== runtime.lastBoundsKey)',
    );
    const fitAtlas = scene.slice(scene.indexOf("function fitAtlas"));
    expect(fitAtlas.indexOf("map.setMinZoom(1.5)")).toBeLessThan(
      fitAtlas.indexOf("map.easeTo({"),
    );
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

  it("keeps the map primary with one compact command strip and inspector", () => {
    expect(sceneStyles).toContain("grid-template-columns: auto auto");
    expect(sceneStyles).toContain("--situation-timeline-height: 3.2rem");
    expect(sceneStyles).toContain("border-radius: 10px");
    expect(panelStyles).toContain("--command-details-width: clamp(390px, 27vw, 460px)");
  });

  it("removes the legacy root minimum width only for public-situation narrow desktops", () => {
    expect(panelStyles).toContain("@media (max-width: 1180px)");
    expect(panelStyles).toContain("html:has(.overview-data-mode.is-public_situation)");
    expect(panelStyles).toContain("overflow-x: clip");
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
