# Overview Map Blender Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an optional Blender-authored 3D enhancement layer to the existing four-region MapLibre overview map and demonstrate it in a loopback-only local preview without publishing or production deployment.

**Architecture:** Keep MapLibre as the geographic and interaction authority. Generate a Web-Mercator-aligned GLB and manifest from the four authoritative prefecture boundaries with Blender, then load the asset through one Three.js-backed MapLibre custom layer. MapLibre continues to own labels, hit testing, drilldown, facilities, weather, railways, logistics, annotations, and fallbacks.

**Tech Stack:** Blender 5.2 LTS and `bpy`, Python 3 standard library, React 19, TypeScript 5.9, MapLibre GL 6.10, Three.js 0.184, Vitest 4.1, Vite 8.1, Playwright 1.62.

## Global Constraints

- Modify only `/Users/federal/Documents/Codex/2026-09-12/new-chat-3/work/github-integration-20260913/map`.
- Preserve all existing overview APIs, permissions, annotations, layer controls, timeline behavior, and administrative drilldown.
- Use region codes `230200`, `231100`, `150700`, and `232700`; do not invent or approximate administrative identities.
- MapLibre authoritative polygons remain the only source for selection and hit testing.
- Blender assets contain visual geometry only and never contain business metrics or saved user state.
- Bind local preview to `127.0.0.1`; do not publish, push, or run any production deployment command.
- A missing or failed GLB must leave the existing MapLibre map fully usable.
- Do not modify the separate dirty `cofco-qiqihar-enterprise-frontend` worktree.

---

## File Structure

- `scripts/blender/export-four-region-source.mjs`: read the local overview API and write a deterministic GeoJSON source file containing exactly the four authoritative prefectures.
- `scripts/blender/export-four-region-source.spec.mjs`: Node tests for response validation, ordering, and source provenance.
- `scripts/blender/generate-four-region-atlas.py`: Blender background script that projects GeoJSON to Web Mercator metres and exports the GLB and manifest.
- `scripts/blender/validate-four-region-atlas.py`: Blender background validation of object names, region metadata, materials, bounds, and mesh presence.
- `public/overview/blender/four-region-atlas.glb`: generated local-preview mesh asset.
- `public/overview/blender/four-region-atlas.json`: generated asset manifest with source revision, geographic origin, bounds, and named region objects.
- `src/modules/overview/ui/components/blenderAtlasContract.ts`: strict runtime parsing and selection-to-material state model.
- `src/modules/overview/ui/components/blenderAtlasContract.spec.ts`: contract, error, and selection-state tests.
- `src/modules/overview/ui/components/BlenderOverviewLayer.ts`: MapLibre custom-layer lifecycle and Three.js GLB loading.
- `src/modules/overview/ui/components/blenderOverviewLayer.spec.ts`: pure lifecycle and degradation tests.
- `src/modules/overview/ui/components/FourRegionTerrainAtlas.tsx`: register, synchronize, and remove the optional custom layer.
- `src/modules/overview/ui/components/OperationalSituationMap.tsx`: expose a local “立体增强” switch and non-blocking degradation message.
- `src/modules/overview/ui/components/OperationalSituationMap.spec.tsx`: preserve the current renderer contract and assert the optional Blender enhancement.
- `src/modules/overview/ui/components/realistic-operational-situation.css`: restrained control and loading-state styling.
- `scripts/capture-blender-overview-preview.mjs`: capture local root view and one drilldown view with verification metadata.

---

### Task 1: Export the authoritative four-region Blender source

**Files:**

- Create: `scripts/blender/export-four-region-source.mjs`
- Create: `scripts/blender/export-four-region-source.spec.mjs`
- Modify: `package.json`

**Interfaces:**

- Consumes: local `GET /api/v1/overview/regions?productCode=CORN&year=2026`, header `X-Actor: wang-yang`.
- Produces: `FeatureCollection<Polygon | MultiPolygon>` with feature properties `{ code, name, level, sourceName, sourceRevision }` ordered as `230200`, `231100`, `150700`, `232700`.

- [ ] **Step 1: Write the failing Node tests**

```js
import assert from "node:assert/strict";
import test from "node:test";
import { normalizeRootRegions } from "./export-four-region-source.mjs";

const boundary = JSON.stringify({
  type: "Polygon",
  coordinates: [
    [
      [123, 46],
      [124, 46],
      [124, 47],
      [123, 46],
    ],
  ],
});

test("exports exactly the governed four regions in stable order", () => {
  const data = [
    ["232700", "大兴安岭地区"],
    ["150700", "呼伦贝尔市"],
    ["231100", "黑河市"],
    ["230200", "齐齐哈尔市"],
  ].map(([code, name]) => ({
    code,
    name,
    level: "PREFECTURE",
    boundaryGeoJson: boundary,
  }));
  assert.deepEqual(
    normalizeRootRegions({ data }).features.map((feature) => feature.properties.code),
    ["230200", "231100", "150700", "232700"],
  );
});

test("rejects missing or context-only prefectures", () => {
  assert.throws(() => normalizeRootRegions({ data: [] }), /expected four regions/);
  assert.throws(
    () =>
      normalizeRootRegions({
        data: [
          {
            code: "230200",
            name: "齐齐哈尔市",
            level: "PREFECTURE",
            boundaryGeoJson: boundary,
            mapContextOnly: true,
          },
        ],
      }),
    /expected four regions/,
  );
});
```

- [ ] **Step 2: Run the tests and confirm RED**

Run: `node --test scripts/blender/export-four-region-source.spec.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `export-four-region-source.mjs`.

- [ ] **Step 3: Implement deterministic export and provenance**

```js
const REGION_ORDER = ["230200", "231100", "150700", "232700"];

export function normalizeRootRegions(payload) {
  const records = Array.isArray(payload?.data) ? payload.data : [];
  const byCode = new Map(
    records
      .filter((record) => !record.mapContextOnly && REGION_ORDER.includes(record.code))
      .map((record) => [record.code, record]),
  );
  if (byCode.size !== REGION_ORDER.length)
    throw new Error(`expected four regions, received ${byCode.size}`);
  return {
    type: "FeatureCollection",
    features: REGION_ORDER.map((code) => {
      const record = byCode.get(code);
      const geometry = JSON.parse(record.boundaryGeoJson);
      if (!geometry || !["Polygon", "MultiPolygon"].includes(geometry.type))
        throw new Error(`invalid boundary for ${code}`);
      return {
        type: "Feature",
        properties: { code, name: record.name, level: record.level },
        geometry,
      };
    }),
  };
}
```

The command entrypoint must require a numeric-loopback HTTP origin, fetch with `X-Actor`, add `generatedAt` only to a sidecar metadata object, and write JSON using stable feature order. Add `assets:blender:source` to `package.json`.

- [ ] **Step 4: Run tests and export the live local source**

Run:

```bash
node --test scripts/blender/export-four-region-source.spec.mjs
npm run assets:blender:source -- --output work/blender/four-regions.geojson
```

Expected: two tests PASS; export reports four named prefectures and HTTP 200 from `127.0.0.1:8090`.

- [ ] **Step 5: Commit the exporter**

```bash
git add package.json scripts/blender/export-four-region-source.mjs scripts/blender/export-four-region-source.spec.mjs
git commit -m "feat(overview): export governed Blender map source"
```

---

### Task 2: Generate and validate the Blender GLB

**Files:**

- Create: `scripts/blender/generate-four-region-atlas.py`
- Create: `scripts/blender/validate-four-region-atlas.py`
- Create: `public/overview/blender/four-region-atlas.glb`
- Create: `public/overview/blender/four-region-atlas.json`
- Modify: `package.json`

**Interfaces:**

- Consumes: Task 1 GeoJSON and `--source-revision` supplied from the API response.
- Produces: GLB objects named `region_230200`, `region_231100`, `region_150700`, `region_232700`; manifest shape below.

```ts
interface BlenderAtlasManifest {
  asset: "/overview-monitoring/overview/blender/four-region-atlas.glb";
  bounds: [west: number, south: number, east: number, north: number];
  generatedAt: string;
  origin: [longitude: number, latitude: number];
  projection: "EPSG:3857_LOCAL_METRES";
  regions: readonly { code: string; name: string; objectName: string }[];
  sourceRevision: string;
  version: 1;
}
```

- [ ] **Step 1: Create the Blender generator with exact projection and mesh rules**

Use the following projection; coordinates remain aligned with MapLibre's Web Mercator plane:

```python
EARTH_RADIUS_M = 6378137.0

def mercator_meters(longitude: float, latitude: float) -> tuple[float, float]:
    longitude_radians = math.radians(longitude)
    latitude_radians = math.radians(max(-85.05112878, min(85.05112878, latitude)))
    return (
        EARTH_RADIUS_M * longitude_radians,
        EARTH_RADIUS_M * math.log(math.tan(math.pi / 4.0 + latitude_radians / 2.0)),
    )
```

For each polygon, create a 2D cyclic curve from every authoritative exterior ring, convert it to a mesh, triangulate it, add a solidify thickness of `1200` metres, and apply a deterministic displacement texture with strength `900` metres only to the top surface. Use four restrained materials: deep jade, cool pine, dark teal, and forest slate. Store `region_code` and `region_name` as object custom properties. Do not simplify or rewrite the GeoJSON source.

- [ ] **Step 2: Add background export and validation commands**

```json
{
  "assets:blender:build": "blender --background --factory-startup --python scripts/blender/generate-four-region-atlas.py -- --input work/blender/four-regions.geojson --output public/overview/blender/four-region-atlas.glb --manifest public/overview/blender/four-region-atlas.json",
  "assets:blender:validate": "blender --background --factory-startup --python scripts/blender/validate-four-region-atlas.py -- --asset public/overview/blender/four-region-atlas.glb --manifest public/overview/blender/four-region-atlas.json"
}
```

The validator must fail unless all four named mesh objects exist, every object has at least one polygon, the manifest codes match the object custom properties, and the manifest projection equals `EPSG:3857_LOCAL_METRES`.

- [ ] **Step 3: Run Blender generation and validate GREEN**

Run:

```bash
npm run assets:blender:build
npm run assets:blender:validate
```

Expected: `BLENDER_ATLAS_OK regions=4` and `BLENDER_ATLAS_VALID objects=4`; Blender exits 0 both times.

- [ ] **Step 4: Inspect the generated asset in Blender**

Run: `open -a Blender public/overview/blender/four-region-atlas.glb`

Verify all four region objects render with distinct materials, no object is missing, and the camera sees the complete four-region extent. Close without modifying the generated asset.

- [ ] **Step 5: Commit the deterministic Blender pipeline and generated preview asset**

```bash
git add package.json scripts/blender public/overview/blender
git commit -m "feat(overview): generate four-region Blender atlas"
```

---

### Task 3: Add a typed Three.js custom-layer adapter

**Files:**

- Create: `src/modules/overview/ui/components/blenderAtlasContract.ts`
- Create: `src/modules/overview/ui/components/blenderAtlasContract.spec.ts`
- Create: `src/modules/overview/ui/components/BlenderOverviewLayer.ts`
- Create: `src/modules/overview/ui/components/blenderOverviewLayer.spec.ts`

**Interfaces:**

- Consumes: `BlenderAtlasManifest`, a MapLibre `Map`, and callbacks `{ onReady, onFailure }`.
- Produces: `createBlenderOverviewLayer(options): CustomLayerInterface & BlenderOverviewController`.

```ts
export interface BlenderOverviewController {
  dispose(): void;
  setEnabled(enabled: boolean): void;
  setSelectedRegion(code: string | undefined): void;
  setVisibleRegionCodes(codes: readonly string[]): void;
}
```

- [ ] **Step 1: Write failing contract and lifecycle tests**

```ts
it("accepts only the governed four-region manifest", () => {
  expect(
    parseBlenderAtlasManifest(validManifest).regions.map(({ code }) => code),
  ).toEqual(["230200", "231100", "150700", "232700"]);
  expect(() => parseBlenderAtlasManifest({ ...validManifest, regions: [] })).toThrow(
    "four governed regions",
  );
});

it("maps selection to restrained visual state", () => {
  expect(blenderRegionVisualState("230200", "230200", true)).toEqual({
    emissiveIntensity: 0.65,
    opacity: 1,
    raisedMeters: 900,
    visible: true,
  });
  expect(blenderRegionVisualState("231100", "230200", true).raisedMeters).toBe(0);
});
```

Lifecycle tests must use injected loader and renderer factories so they can assert one scene, one load, one repaint callback, and one disposal without WebGL.

- [ ] **Step 2: Run focused tests and confirm RED**

Run: `npm test -- --run src/modules/overview/ui/components/blenderAtlasContract.spec.ts src/modules/overview/ui/components/blenderOverviewLayer.spec.ts`

Expected: FAIL because the modules do not exist.

- [ ] **Step 3: Implement manifest parsing and the visual-state function**

```ts
const GOVERNED_CODES = ["230200", "231100", "150700", "232700"] as const;

export function blenderRegionVisualState(
  code: string,
  selectedCode: string | undefined,
  visible: boolean,
) {
  const selected = code === selectedCode;
  return {
    emissiveIntensity: selected ? 0.65 : 0.08,
    opacity: selectedCode && !selected ? 0.72 : 1,
    raisedMeters: selected ? 900 : 0,
    visible,
  } as const;
}
```

The parser must reject unknown projection, duplicate or missing codes, non-loopback-relative asset URLs, invalid bounds, and manifest versions other than `1`.

- [ ] **Step 4: Implement one shared-context MapLibre custom layer**

The layer must use `THREE.WebGLRenderer({ canvas: map.getCanvas(), context: gl, antialias: true })`, set `autoClear = false`, load with `GLTFLoader`, transform local metres with `MercatorCoordinate.fromLngLat(manifest.origin).meterInMercatorCoordinateUnits()`, and call `map.triggerRepaint()` only while a selection interpolation is active. `onRemove` and `dispose()` must release geometries, materials, textures, and the loader abort controller exactly once.

- [ ] **Step 5: Run focused tests GREEN and commit**

Run: `npm test -- --run src/modules/overview/ui/components/blenderAtlasContract.spec.ts src/modules/overview/ui/components/blenderOverviewLayer.spec.ts`

Expected: all focused tests PASS.

```bash
git add src/modules/overview/ui/components/blenderAtlasContract* src/modules/overview/ui/components/BlenderOverviewLayer.ts src/modules/overview/ui/components/blenderOverviewLayer.spec.ts
git commit -m "feat(overview): add Blender map custom layer"
```

---

### Task 4: Integrate enhancement, interaction, and fallback into the existing map

**Files:**

- Modify: `src/modules/overview/ui/components/FourRegionTerrainAtlas.tsx`
- Modify: `src/modules/overview/ui/components/OperationalSituationMap.tsx`
- Modify: `src/modules/overview/ui/components/OperationalSituationMap.spec.tsx`
- Modify: `src/modules/overview/ui/components/realistic-operational-situation.css`

**Interfaces:**

- Consumes: Task 3 `createBlenderOverviewLayer`, current `rootFeatures`, `features`, `selectedRegionCode`, and existing MapLibre click/drill handlers.
- Produces: an optional `blenderEnabled` visual enhancement that never changes geographic selection or drilldown.

- [ ] **Step 1: Extend the existing renderer-contract test RED**

```ts
it("adds Blender as an optional visual layer without replacing authoritative map interaction", () => {
  expect(scene).toContain('id: "atlas-blender-enhancement"');
  expect(scene).toContain("createBlenderOverviewLayer");
  expect(scene).toContain('layers: ["atlas-active-fill", "atlas-root-fill"]');
  expect(scene).toContain("props.onRegionSelect(region)");
  expect(scene).toContain("props.onRegionDrill(region)");
  expect(scene).toContain("DEGRADED_BLENDER");
});
```

- [ ] **Step 2: Add enhancement state and the local toggle**

Extend `TerrainEnhancementState` with `DEGRADED_BLENDER`. Add a `blenderEnabled` prop to `FourRegionTerrainAtlas`, defaulting to `true`, and a button labelled `立体增强` in the existing control stack. The pressed state must be exposed with `aria-pressed`; disabling removes/hides only the custom layer and leaves every MapLibre source visible.

- [ ] **Step 3: Register and synchronize the custom layer**

After MapLibre root/active sources are initialized, fetch `/overview-monitoring/overview/blender/four-region-atlas.json`, parse it, add the custom layer before `atlas-root-glow`, and retain its controller on `AtlasRuntime`. On every existing `synchronizeAtlas` call:

```ts
runtime.blenderLayer?.setEnabled(props.blenderEnabled ?? true);
runtime.blenderLayer?.setSelectedRegion(props.selectedRegionCode);
runtime.blenderLayer?.setVisibleRegionCodes(
  activeHierarchyFeatures(props).map(({ region }) => region.code),
);
```

Never attach Three.js pointer handlers. Existing `handleMapClick` remains the only selection/drill path. When the manifest or GLB fails, call `onEnhancementState("DEGRADED_BLENDER")`, remove the partial custom layer, and keep the current map ready.

- [ ] **Step 4: Enable intentional desktop rotation without breaking annotations**

Set `dragRotate: true` and enable touch rotation only while annotation mode is inactive. When `annotationActive` becomes true, disable rotation before installing rectangle gestures; restore it when annotation mode ends. Clamp pitch to the existing `34..68` range so panels and labels remain usable.

- [ ] **Step 5: Run focused tests and visual-state tests**

Run:

```bash
npm test -- --run src/modules/overview/ui/components/OperationalSituationMap.spec.tsx src/modules/overview/ui/components/fourRegionTerrainModel.spec.ts src/modules/overview/ui/components/mapAnnotationGesture.spec.ts
```

Expected: all tests PASS; existing click, drill, marker, and annotation assertions remain unchanged.

- [ ] **Step 6: Commit the integration**

```bash
git add src/modules/overview/ui/components/FourRegionTerrainAtlas.tsx src/modules/overview/ui/components/OperationalSituationMap.tsx src/modules/overview/ui/components/OperationalSituationMap.spec.tsx src/modules/overview/ui/components/realistic-operational-situation.css
git commit -m "feat(overview): integrate Blender terrain enhancement"
```

---

### Task 5: Produce and verify the loopback-only interactive preview

**Files:**

- Create: `scripts/capture-blender-overview-preview.mjs`
- Create: `outputs/blender-overview-root.png` outside the repository for user delivery.
- Create: `outputs/blender-overview-drilldown.png` outside the repository for user delivery.

**Interfaces:**

- Consumes: local backend `127.0.0.1:8090`, Vite `127.0.0.1:63200`, and the integrated map.
- Produces: two screenshots plus terminal evidence for renderer state, selected code, custom-layer presence, and fallback behavior.

- [ ] **Step 1: Add preview assertions**

The Playwright capture script must wait for:

```js
await page.waitForFunction(() => {
  const map = document.querySelector('[data-renderer="maplibre-four-region-terrain"]');
  return (
    map?.getAttribute("data-blender-state") === "ready" &&
    map?.querySelector("canvas") !== null
  );
});
```

It must capture the root scene, click the MapLibre-owned region layer through the accessible region control for 齐齐哈尔市, wait for a county layer, capture the drilldown, toggle `立体增强` off, and verify the map canvas and region controls remain usable.

- [ ] **Step 2: Run proportional automated verification**

Run:

```bash
npm run format:check
npm run lint
npm run architecture
npm test -- --run src/modules/overview/ui/components/blenderAtlasContract.spec.ts src/modules/overview/ui/components/blenderOverviewLayer.spec.ts src/modules/overview/ui/components/OperationalSituationMap.spec.tsx src/modules/overview/ui/components/fourRegionTerrainModel.spec.ts
npm run build
```

Expected: every command exits 0. Existing unrelated suites are not expanded unless a changed dependency requires them.

- [ ] **Step 3: Start the loopback preview and capture real-browser evidence**

Run `npm run dev`, wait for `http://127.0.0.1:63200/overview-monitoring/?embed=1#/overview`, then run:

```bash
node scripts/capture-blender-overview-preview.mjs \
  /Users/federal/Documents/Codex/2026-09-21/shi-f/outputs/blender-overview-root.png \
  /Users/federal/Documents/Codex/2026-09-21/shi-f/outputs/blender-overview-drilldown.png
```

Expected: JSON reports `blenderState: "ready"`, four region objects, a selected region after interaction, and `fallbackUsable: true` after disabling the layer.

- [ ] **Step 4: Perform local Safari acceptance**

Open the same loopback URL in Safari and check root view, mouse rotation, zoom, hover, region selection, first drilldown, layer toggle, right-side panel clearance, and MapLibre fallback. Record any Safari-only renderer warning without changing production configuration.

- [ ] **Step 5: Commit capture tooling, not generated user screenshots**

```bash
git add scripts/capture-blender-overview-preview.mjs
git commit -m "test(overview): capture Blender map preview"
git status --short --branch
```

Expected: the repository is clean and ahead only by the bounded local implementation commits. Do not push or deploy.

---

## Final Acceptance Checklist

- [ ] Blender 5.2 LTS generates and reopens the GLB successfully.
- [ ] The source exporter records exactly the four governed authoritative region codes.
- [ ] The existing MapLibre hit-testing and drilldown remain the interaction authority.
- [ ] Weather, storage facilities, railways, logistics, annotations, and timeline remain visible and usable.
- [ ] Hover/selection animation is restrained and stops requesting frames when idle.
- [ ] Disabling or failing the Blender layer leaves the existing map usable.
- [ ] Focused tests, lint, architecture, and build pass.
- [ ] Chrome and Safari loopback previews are inspected.
- [ ] No publish, push, or production deployment command is run.

---

## Scope Correction: Default Sample-Point Map

The default 总揽监测 entry is the sample-point map, not the public-situation tab. The finished preview must therefore load the same governed Blender asset into the existing `TerrainReliefBoundaryMap` root scene while preserving every sample-network contract.

**Additional files:**

- `src/modules/overview/ui/components/blenderReliefFoundation.ts`
- `src/modules/overview/ui/components/blenderReliefFoundation.spec.ts`
- `src/modules/overview/ui/components/TerrainReliefBoundaryMap.tsx`
- `src/modules/overview/ui/components/BoundaryMap.tsx`
- `src/modules/overview/ui/components/OverviewSampleNetworkToolbar.tsx`
- `src/modules/overview/ui/pages/OverviewPage.tsx`

**Required behavior:**

- [x] Load the GLB only when the visible authoritative features are exactly the four governed root regions.
- [x] Keep current, design, and historical sample layers, aggregate counts, exact coordinates, selection, and drilldown authoritative.
- [x] Expose a separate accessible `Blender 立体增强` switch without changing the selected sample layer.
- [x] Dispose the GLB and report `out-of-scope` after drilling below the four-region root.
- [x] Verify root enabled/disabled screenshots and a live drilldown containing actual and design sample markers.
