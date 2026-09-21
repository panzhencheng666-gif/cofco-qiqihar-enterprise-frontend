# Public Situation Map-First Visual Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn Public Situation into a continuous map-first three-dimensional satellite sand table without changing any existing non-Public-Situation map or business workflow.

**Architecture:** Keep the existing single persistent `FourRegionTerrainAtlas` MapLibre scene and change only its visual layer composition, default camera, and Public Situation layout CSS. Regression tests inspect the owned scene and stylesheet contracts; final proof comes from the managed runtime and a real browser because WebGL timing and layout cannot be accepted from component mocks alone.

**Tech Stack:** React 19, TypeScript, MapLibre GL, CSS, Vitest, Vite, managed macOS LaunchAgent runtime.

## Global Constraints

- Only Public Situation may change; Sample Points, Regional Data, Supply/Demand Balance, navigation, permissions, APIs, and submitted records remain unchanged.
- Exactly one MapLibre map, one canvas, zero legacy maps, and zero DOM markers may exist in Public Situation.
- Public tiles remain bounded to the four-region root extent; the display mask de-emphasizes non-governed context without claiming polygon-level network-byte clipping.
- The right inspector width is `clamp(390px, 27vw, 460px)` on desktop and retains the existing separate-row mobile behavior below 800px.
- No duplicate controls, fake metrics, placeholder data, decorative KPI walls, or additional map instance.
- TDD order is required for each code task: failing regression, minimal implementation, focused pass, then commit.

---

### Task 1: Integrate the Four-Region Surface

**Files:**

- Modify: `src/modules/overview/ui/components/FourRegionTerrainAtlas.tsx`
- Test: `src/modules/overview/ui/components/OperationalSituationMap.spec.tsx`

**Interfaces:**

- Consumes: existing `atlas-world-mask` and `atlas-regions` GeoJSON sources.
- Produces: an `atlas-regions-halo` MapLibre line layer and a lighter contextual mask; no public component signature changes.

- [ ] **Step 1: Write the failing visual-contract test**

Add assertions to the scene test:

```ts
expect(scene).toContain('id: "atlas-regions-halo"');
expect(scene).toContain('"fill-color": "#07130f"');
expect(scene).toContain('"fill-opacity": 0.68');
expect(scene).toContain("pitch: 30");
```

- [ ] **Step 2: Run the focused test and observe failure**

Run:

```bash
npm test -- --run src/modules/overview/ui/components/OperationalSituationMap.spec.tsx
```

Expected: FAIL because the halo, contextual mask values, and 30-degree default pitch are absent.

- [ ] **Step 3: Implement the continuous sand-table composition**

Change the MapLibre constructor and local layer installation to:

```ts
pitch: 30,
```

```ts
paint: {
  "fill-antialias": false,
  "fill-color": "#07130f",
  "fill-opacity": 0.68,
},
```

Add the restrained region halo between the region fill and final outline:

```ts
map.addLayer({
  id: "atlas-regions-halo",
  type: "line",
  source: "atlas-regions",
  paint: {
    "line-blur": 3,
    "line-color": ["case", ["==", ["get", "selected"], true], "#d8b861", "#f3f1e7"],
    "line-opacity": ["case", ["==", ["get", "selected"], true], 0.42, 0.2],
    "line-width": ["case", ["==", ["get", "selected"], true], 9, 6],
  },
});
```

Update `synchronizeChangedSources` so `atlas-regions-halo` follows `ADMINISTRATIVE` visibility.

- [ ] **Step 4: Run focused verification**

Run:

```bash
npm test -- --run src/modules/overview/ui/components/OperationalSituationMap.spec.tsx
```

Expected: 9 tests pass.

- [ ] **Step 5: Commit the map integration**

```bash
git add src/modules/overview/ui/components/FourRegionTerrainAtlas.tsx src/modules/overview/ui/components/OperationalSituationMap.spec.tsx
git commit -m "feat: integrate public situation terrain surface"
```

### Task 2: Make the Map the Primary Layout

**Files:**

- Modify: `src/modules/overview/ui/components/realistic-operational-situation.css`
- Modify: `src/modules/overview/ui/components/operational-situation.css`
- Test: `src/modules/overview/ui/components/OperationalSituationMap.spec.tsx`

**Interfaces:**

- Consumes: existing `.realistic-situation-control-stack`, `.realistic-situation-lower-rail`, and `.overview-data-mode.is-public_situation` DOM classes.
- Produces: a two-group desktop command strip, a narrower inspector variable, and the existing one-column responsive fallback.

- [ ] **Step 1: Write the failing layout-contract test**

Load both stylesheets in `OperationalSituationMap.spec.tsx` and assert:

```ts
expect(sceneStyles).toContain("grid-template-columns: auto auto");
expect(sceneStyles).toContain("--situation-timeline-height: 3.2rem");
expect(sceneStyles).toContain("border-radius: 10px");
expect(panelStyles).toContain("--command-details-width: clamp(390px, 27vw, 460px)");
```

- [ ] **Step 2: Run the focused test and observe failure**

Run:

```bash
npm test -- --run src/modules/overview/ui/components/OperationalSituationMap.spec.tsx
```

Expected: FAIL because the approved layout tokens are absent.

- [ ] **Step 3: Implement the desktop hierarchy**

In `realistic-operational-situation.css`, set:

```css
.realistic-situation-layer {
  --situation-timeline-height: 3.2rem;
}

.realistic-situation-control-stack {
  grid-template-columns: auto auto;
  align-items: start;
  width: fit-content;
  max-width: calc(100% - var(--situation-edge) * 2);
}

.realistic-situation-enhancement-notice,
.realistic-situation-layer-menu,
.regional-earth-annotation {
  grid-column: 1 / -1;
}
```

Use one shared 10px-radius dark glass surface for filters, modes, tools, caption, and timeline; use 7px button radii and a restrained gold active state. At `max-width: 920px`, restore `grid-template-columns: minmax(0, 1fr)` so controls wrap without overflow.

In `operational-situation.css`, add:

```css
.overview-command-center:has(.overview-data-mode.is-public_situation) {
  --command-details-width: clamp(390px, 27vw, 460px);
}

.overview-command-center.has-side-data-panel .overview-data-mode.is-public_situation {
  padding: 0;
  border-radius: 14px;
  background: rgb(238 241 234 / 93%);
}
```

- [ ] **Step 4: Run focused component and style verification**

Run:

```bash
npm test -- --run src/modules/overview/ui/components/OperationalSituationMap.spec.tsx src/modules/overview/ui/components/OperationalSituationMap.ui.spec.tsx
npm run format:check
npm run lint
```

Expected: both test files pass, Prettier reports all files formatted, and ESLint reports zero warnings.

- [ ] **Step 5: Commit the layout hierarchy**

```bash
git add src/modules/overview/ui/components/realistic-operational-situation.css src/modules/overview/ui/components/operational-situation.css src/modules/overview/ui/components/OperationalSituationMap.spec.tsx
git commit -m "feat: make public situation map first"
```

### Task 3: Verify, Deploy, and Accept the Managed Runtime

**Files:**

- Verify: all changed Public Situation source and test files.
- Deploy to: `/Users/federal/Library/Application Support/COFCO Qiqihar Enterprise/runtime/cofco-qiqihar-enterprise-frontend`

**Interfaces:**

- Consumes: commits from Tasks 1 and 2.
- Produces: a clean source checkpoint, synchronized central checkout and managed runtime, health readback, and browser acceptance evidence.

- [ ] **Step 1: Run the proportional automated gate**

Run:

```bash
npm run format:check && npm run lint && npm run architecture && npm run test && npm run build
```

Expected: formatting passes, ESLint has zero errors, dependency-cruiser has no violations, the complete Vitest suite passes except documented pre-existing skips, and Vite production build succeeds.

- [ ] **Step 2: Synchronize immutable commits**

Fast-forward the central checkout from the source branch, then fast-forward the managed runtime from the central checkout. Do not reset, overwrite, or discard unrelated work.

Expected: source, central checkout, and runtime resolve to the same commit and each working tree is clean.

- [ ] **Step 3: Build and restart the managed runtime**

Run `npm run build` in the managed frontend and restart `com.cofco.qiqihar.enterprise.local-stack` with `launchctl kickstart -k`.

Expected: backend readiness returns `{"status":"UP"}`, frontend health returns HTTP 200, and `/overview-monitoring/` returns HTTP 200.

- [ ] **Step 4: Perform real-browser acceptance**

Open `/overview-monitoring/#/overview`, select Public Situation, and verify:

```text
atlas count = 1
canvas count = 1
legacy map count = 0
DOM marker count = 0
viewer count = 1
created viewer count = 1
marker state = ready
enhancement state = ready or explicitly degraded with the local map still usable
control stack count = 1
lower rail count = 1
map annotation control count = 1
```

Visually confirm there is no hard black trapezoid, the inspector is narrower than 460px, controls and timeline do not overlap, and the map remains continuous while switching Sand Table, Fusion, and Imagery.

- [ ] **Step 5: Verify continuous detail and responsiveness**

Use the actual zoom controls to reach county, township, and village detail, then reset. Confirm roads, water, Chinese names, buildings, and public facilities appear by configured zoom level without a new canvas. Inspect desktop and responsive breakpoints through the browser; no horizontal overflow or inaccessible control is acceptable.

- [ ] **Step 6: Record final evidence**

Capture the final browser screenshot, recheck all three working trees, commit any evidence-only documentation if needed, and report the exact commit and the known polygon tile-network limitation without overstating it.
