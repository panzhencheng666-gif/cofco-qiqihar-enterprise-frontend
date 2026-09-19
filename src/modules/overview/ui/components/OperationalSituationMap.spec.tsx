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

  it("renders a full-bleed four-region terrain atlas without the empty globe shell", () => {
    expect(scene).toContain("MapLibreMap");
    expect(scene).toContain('data-renderer="maplibre-four-region-terrain"');
    expect(scene).toContain('data-region-visibility="governed-four-region-mask"');
    expect(scene).toContain("fitOperationalMap(");
    expect(scene).not.toContain("createFourRegionGlobeBackdrop(");
    expect(scene).not.toContain("new THREE.WebGLRenderer");
    expect(scene).not.toContain("TerrainReliefBoundaryMap");
    expect(wrapper).not.toContain("态势地图俯视角");
    expect(overviewPage).toContain("{!publicSituationMode && (");
    expect(overviewPage).toContain("rootFeatures={rootMapFeatures}");
  });

  it("streams multiresolution satellite tiles, terrain, roads and buildings while zooming", () => {
    expect(scene).toContain("FOUR_REGION_REMOTE_SOURCES");
    expect(scene).toContain("FOUR_REGION_DETAIL_LAYERS");
    expect(scene).toContain("map.setTerrain");
    expect(scene).toContain('map.on("zoom"');
    expect(terrainStyle).toContain("World_Imagery/MapServer/tile/{z}/{y}/{x}");
    expect(terrainStyle).toContain('id: "atlas-buildings"');
    expect(terrainStyle).toContain('id: "atlas-road-labels"');
    expect(terrainStyle).not.toContain("World_Imagery/MapServer/export");
  });

  it("raises the four roots and active hierarchy without an artificial earth shell", () => {
    expect(scene).toContain('id: "atlas-root-plinth"');
    expect(scene).toContain('id: "atlas-active-plinth"');
    expect(scene).toContain('"fill-extrusion-height"');
    expect(sceneStyles).not.toContain("cosmic-noise");
    expect(sceneStyles).not.toContain("clip-path: ellipse");
    expect(sceneStyles).not.toContain(".realistic-situation-layer::after");
  });

  it("keeps the four root boundaries separate from only the current parent's children", () => {
    expect(scene).toContain('"atlas-root-regions"');
    expect(scene).toContain('"atlas-active-regions"');
    expect(scene).toContain('"atlas-region-mask"');
    expect(scene).toContain("activeHierarchyFeatures(");
    expect(scene).toContain("feature.region.parentCode === contextCode");
    expect(scene).not.toContain("projection.labels");
  });

  it("places exactly one governed label point for each administrative feature", () => {
    expect(scene).toContain('const ROOT_LABEL_SOURCE = "atlas-root-labels"');
    expect(scene).toContain('const ACTIVE_LABEL_SOURCE = "atlas-active-labels"');
    expect(scene).toContain("regionLabelCollection(props.rootFeatures)");
    expect(scene).toContain("regionLabelCollection(active)");
    expect(scene).toContain("function regionLabelCollection(");
  });

  it("supports Google-style continuous zoom and pan without map rotation", () => {
    expect(scene).toContain("map.zoomIn");
    expect(scene).toContain("map.zoomOut");
    expect(scene).toContain("dragRotate: false");
    expect(scene).toContain("map.keyboard.disableRotation");
    expect(scene).toContain("map.touchZoomRotate.disableRotation");
    expect(scene).toContain("renderWorldCopies: false");
  });

  it("renders operational nodes inside the same WebGL scene without DOM markers", () => {
    expect(scene).toContain("markerCollection(");
    expect(scene).toContain("railwayCollection(");
    expect(scene).toContain("logisticsCollection(");
    expect(scene).not.toMatch(/new\s+Marker\s*\(/);
    expect(scene).toContain('data-dom-markers="0"');
  });

  it("uses animated weather and recognizable railway and grain-depot icons", () => {
    expect(scene).toContain("realisticSituationIcon(");
    expect(scene).toContain("realisticWeatherIcon(");
    expect(scene).toContain("liveWeatherKind(weather)");
    expect(scene).toContain('id: "atlas-weather-pulse"');
    expect(scene).toContain('"icon-image"');
    expect(scene).toContain("requestAnimationFrame");
    expect(scene).toContain('"atlas-icon-railway"');
    expect(scene).toContain('"atlas-icon-depot-owned"');
    expect(scene).toContain('id: "atlas-inventory"');
    expect(scene).toContain('type: "symbol"');
  });

  it("refits only when the map viewport changes and keeps a continuous terrain backdrop", () => {
    expect(scene).toContain("scheduleAtlasResize(runtime)");
    expect(scene).toContain("resizeAnimationFrameId");
    expect(scene).toContain("viewportWidth");
    expect(scene).toContain("viewportHeight");
    expect(scene).not.toContain('"fill-opacity": 0.96');
    expect(terrainStyle).toContain('"background-color": "#223b38"');
    expect(sceneStyles).toContain("linear-gradient");
  });

  it("single-clicks the visible administrative polygon into the next level", () => {
    expect(scene).toContain("queryRenderedFeatures");
    expect(scene).toContain("onRegionSelect");
    expect(scene).toContain("onRegionDrill");
    expect(scene).toContain('region.level !== "VILLAGE"');
    expect(scene).not.toContain('addEventListener("dblclick"');
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

  it("mounts the public inspector only after a region is selected", () => {
    expect(overviewPage).toContain(
      "const operationalSelectedRegion = selectedRegionSnapshot;",
    );
    expect(overviewPage).toContain(
      "(operationalMapMode && Boolean(operationalSelectedRegion))",
    );
    expect(overviewPage).toContain(
      "!publicSituationMode || operationalSelectedRegion ? (",
    );
    expect(overviewPage).toContain("showBusinessMetrics={!publicSituationMode}");
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
    expect(scene).toContain("annotationCollection(");
    expect(scene).toContain("props.annotationActive");
  });

  it("pauses timeline animation while the page is hidden", () => {
    expect(wrapper).toContain('document.addEventListener("visibilitychange"');
    expect(wrapper).toContain('document.visibilityState !== "hidden"');
  });
});
