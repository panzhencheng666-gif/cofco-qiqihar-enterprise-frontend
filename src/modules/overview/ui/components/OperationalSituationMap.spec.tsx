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
    resolve("src/modules/overview/ui/components/satelliteSurfaceTexture.ts"),
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

  it("renders the governed four regions across one fixed visible globe", () => {
    expect(scene.match(/new THREE\.WebGLRenderer/g)).toHaveLength(1);
    expect(scene).toContain("projectReliefScene(");
    expect(scene).toContain("createFourRegionGlobeBackdrop(");
    expect(scene).toContain("createCurvedSatelliteSurfaceMaterial(");
    expect(scene).toContain('data-globe-mode="fixed-visible-hemisphere"');
    expect(scene).toContain('data-region-visibility="all-four-front-hemisphere"');
    expect(scene).toContain('data-renderer="three-fixed-four-region-globe"');
    expect(scene).not.toContain("OrbitControls");
    expect(scene).not.toContain("MapLibreMap");
    expect(scene).not.toContain("maplibre-gl");
    expect(scene).not.toContain("TerrainReliefBoundaryMap");
    expect(wrapper).not.toContain("态势地图俯视角");
    expect(overviewPage).toContain("{!publicSituationMode && (");
    expect(overviewPage).toContain("rootFeatures={rootMapFeatures}");
  });

  it("maps satellite detail onto raised region caps instead of a satellite ground plane", () => {
    expect(scene).toContain("loadSatelliteSurfaceTexture(");
    expect(scene).toContain("createCurvedSatelliteSurfaceMaterial(");
    expect(scene).toContain('data-surface-confinement="region-meshes-only"');
    expect(scene).not.toContain("new THREE.PlaneGeometry");
    expect(terrainStyle).toContain("satelliteTilePlan");
    expect(terrainStyle).toContain("World_Imagery/MapServer/tile");
  });

  it("uses only platform-supplied hierarchy features and labels", () => {
    expect(scene).toContain("props.features");
    expect(scene).toContain("props.rootFeatures");
    expect(scene).toContain("projection.labels");
    expect(scene).not.toContain("OpenFreeMap");
    expect(scene).not.toContain("World_Boundaries_and_Places");
    expect(scene).not.toContain('"source-layer": "place"');
  });

  it("changes satellite detail without cropping or rotating the four regions", () => {
    expect(scene).toContain("runtimeRef.current");
    expect(scene).toContain("updateOperationalLayers(");
    expect(scene).toContain("applyCommand(");
    expect(scene).toContain("satelliteDetailRevision");
    expect(scene).not.toContain("contentRoot.rotation");
    expect(scene).not.toContain("contentRoot.scale.setScalar");
    expect(scene).not.toContain("changedAtlasSources(");
  });

  it("renders operational nodes inside the same WebGL scene without DOM markers", () => {
    expect(scene).toContain("buildOperationalMarkers(");
    expect(scene).toContain("buildOperationalLines(");
    expect(scene).not.toMatch(/new\s+Marker\s*\(/);
    expect(scene).toContain('data-dom-markers="0"');
  });

  it("selects and drills through the actual administrative polygon", () => {
    expect(scene).toContain("raycaster.intersectObjects");
    expect(scene).toContain("onRegionSelect");
    expect(scene).toContain("onRegionDrill");
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
    expect(scene).toContain("buildAnnotationObjects(");
  });

  it("pauses timeline animation while the page is hidden", () => {
    expect(wrapper).toContain('document.addEventListener("visibilitychange"');
    expect(wrapper).toContain('document.visibilityState !== "hidden"');
  });
});
