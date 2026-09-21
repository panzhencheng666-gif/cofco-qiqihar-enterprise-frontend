# Public Situation Map Immediate Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep every enabled depot and railway marker independently visible at every zoom, show complete region-scoped facility lists, and make imagery failures and map gestures degrade quickly instead of leaving a blank or indefinitely blurry map.

**Architecture:** Add a pure deterministic screen-space marker layout module and feed its output into the existing MapLibre GeoJSON sources after settled camera events. Reuse the existing governed facility directory in the public inspector. Separate remote enhancement health from the local WebGL scene so imagery, terrain, or vector failures never remove boundaries, markers, or interaction.

**Tech Stack:** React 19, TypeScript 5.9, MapLibre GL 6, GeoJSON, Vitest 4, Testing Library, CSS.

## Global Constraints

- Preserve the four-region scene, administrative drill-down, permissions, navigation, business data, and user-owned working-tree changes.
- Every enabled storage or railway facility has an independent marker; aggregation is prohibited.
- Marker size scales with zoom, but collision placement never hides an enabled marker.
- Visual displacement never mutates governed longitude/latitude or region ownership.
- Nearby railway facilities stay separate from within-region totals.
- Remote-source failure never blocks local boundaries, nodes, or interaction.
- Commercial credentials never enter the frontend bundle or Git.
- Follow RED-GREEN-REFACTOR and commit only task-owned files.

---

### Task 1: Deterministic all-marker layout

**Files:**
- Create: `src/modules/overview/ui/components/operationalMarkerLayout.ts`
- Create: `src/modules/overview/ui/components/operationalMarkerLayout.spec.ts`

**Interfaces:**

```ts
export interface ProjectedOperationalMarker {
  id: string;
  x: number;
  y: number;
}

export interface OperationalMarkerLayoutItem extends ProjectedOperationalMarker {
  anchorX: number;
  anchorY: number;
  displaced: boolean;
}

export function layoutOperationalMarkers(
  markers: readonly ProjectedOperationalMarker[],
  options: {
    gapPx: number;
    viewportWidth: number;
    viewportHeight: number;
    marginPx: number;
  },
): OperationalMarkerLayoutItem[];
```

- [ ] **Step 1: Write failing pure-layout tests**

Test that 160 identical coordinates return 160 unique display centers and every input ID exactly once. Test identical output for reversed input order. Test anchors remain unchanged and display centers stay inside the viewport margin.

```ts
const markers = Array.from({ length: 160 }, (_, index) => ({
  id: `node-${index}`,
  x: 400,
  y: 300,
}));
const result = layoutOperationalMarkers(markers, {
  gapPx: 14,
  viewportWidth: 1000,
  viewportHeight: 700,
  marginPx: 7,
});
expect(result.map(({ id }) => id).sort()).toEqual(
  markers.map(({ id }) => id).sort(),
);
expect(new Set(result.map(({ x, y }) => `${x}:${y}`))).toHaveLength(160);
```

- [ ] **Step 2: Verify RED**

Run `npm test -- src/modules/overview/ui/components/operationalMarkerLayout.spec.ts`.

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement deterministic placement**

Sort by ID, keep an anchor when it is available, and search fixed-angle concentric rings at `gapPx` increments. Reject candidates outside the viewport margin or within `gapPx` of an occupied center. Return output sorted by ID with original coordinates in `anchorX` and `anchorY`. Throw on non-finite inputs or an unusable viewport; never silently drop a marker.

- [ ] **Step 4: Verify GREEN**

Run the command from Step 2. Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/overview/ui/components/operationalMarkerLayout.ts \
  src/modules/overview/ui/components/operationalMarkerLayout.spec.ts
git commit -m "feat(overview): lay out every operational marker"
```

### Task 2: Render all facilities with zoom-proportional size

**Files:**
- Modify: `src/modules/overview/ui/components/fourRegionTerrainStyle.ts`
- Modify: `src/modules/overview/ui/components/fourRegionTerrainStyle.spec.ts`
- Modify: `src/modules/overview/ui/components/FourRegionTerrainAtlas.tsx`
- Modify: `src/modules/overview/ui/components/OperationalSituationMap.spec.tsx`

**Interfaces:**
- Consumes: `layoutOperationalMarkers` from Task 1.
- Produces: internal `refreshOperationalMarkerSources(runtime)` for marker and leader GeoJSON.

- [ ] **Step 1: Write failing renderer tests**

Require the shared icon-size expression without a selected-size branch:

```ts
expect(FACILITY_ICON_SIZE).toEqual([
  "interpolate", ["linear"], ["zoom"],
  4, 0.44,
  7, 0.56,
  10, 0.69,
  13, 0.81,
]);
```

Require `icon-allow-overlap: true`, `icon-ignore-placement: true`, `MARKER_LEADER_SOURCE`, `atlas-operational-marker-leaders`, one `moveend` listener, and `refreshOperationalMarkerSources(runtime)`.

- [ ] **Step 2: Verify RED**

Run:

```bash
npm test -- src/modules/overview/ui/components/fourRegionTerrainStyle.spec.ts \
  src/modules/overview/ui/components/OperationalSituationMap.spec.tsx
```

Expected: FAIL on size, overlap, leader, and settled-camera assertions.

- [ ] **Step 3: Add marker candidates and WebGL leader data**

Create one candidate per enabled storage and railway facility. Retain `anchorLongitude` and `anchorLatitude`. Project candidates, run the pure layout, unproject display centers, update the marker source, and update a leader line source from governed anchor to display point. Keep weather outside operational layout. Add a selected halo circle layer instead of changing icon size.

Use this exact symbol policy:

```ts
layout: {
  "icon-allow-overlap": true,
  "icon-ignore-placement": true,
  "icon-image": facilityIconExpression,
  "icon-size": FACILITY_ICON_SIZE,
}
```

Refresh on initialization, `moveend`, and settled resize, not every zoom frame. On layout failure, render every marker at its governed coordinate with overlap enabled.

- [ ] **Step 4: Preserve governed click ownership**

When a displaced marker is clicked, query the administrative region at the projected anchor coordinate, not under the displaced icon.

- [ ] **Step 5: Verify GREEN**

Run Task 1 and Task 2 focused tests. Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add src/modules/overview/ui/components/fourRegionTerrainStyle.ts \
  src/modules/overview/ui/components/fourRegionTerrainStyle.spec.ts \
  src/modules/overview/ui/components/FourRegionTerrainAtlas.tsx \
  src/modules/overview/ui/components/OperationalSituationMap.spec.tsx
git commit -m "fix(overview): keep all facility markers visible"
```

### Task 3: Complete region facility directory

**Files:**
- Modify: `src/modules/overview/ui/components/OperationalFacilityPanel.tsx`
- Modify: `src/modules/overview/ui/components/OperationalFacilityPanel.spec.tsx`
- Modify: `src/modules/overview/ui/components/OperationalSituationPanel.tsx`
- Modify: `src/modules/overview/ui/components/OperationalSituationPanel.spec.tsx`
- Modify: `src/modules/overview/ui/components/operational-situation.css`

**Interfaces:**
- Consumes: the region-scoped catalogue already loaded by `OverviewPage` and the shared `selectedFacilityId`.
- Produces: complete list controls that call the existing `onFacilitySelect(id)` callback.

- [ ] **Step 1: Write failing directory tests**

Use two storage records and three railway records (two `WITHIN`, one `NEARBY`). Assert tabs named `库点 2` and `铁路 2`, both storage category counts, `境内站点 2`, `邻近站点 1`, and all three railway list entries. Click the last entry and assert its exact source ID reaches `onFacilitySelect`.

- [ ] **Step 2: Verify RED**

```bash
npm test -- src/modules/overview/ui/components/OperationalFacilityPanel.spec.tsx \
  src/modules/overview/ui/components/OperationalSituationPanel.spec.tsx
```

Expected: FAIL because the public inspector tabs lack counts and render only one active card.

- [ ] **Step 3: Reuse the governed directory**

Render `OperationalFacilityPanel` from `STORAGE` and `RAILWAY` modes. Pass `selectedFacilityId` and forward selection. Preserve storage create/edit/archive and source notices. Add exact summaries for storage categories, within stations, nearby stations, and lines. Give list buttons accessible names ending in `库点记录` or `铁路站点记录`.

Use a bounded scroll container and `content-visibility: auto` for long lists; add no dependency.

- [ ] **Step 4: Verify GREEN**

Run Step 2. Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/overview/ui/components/OperationalFacilityPanel.tsx \
  src/modules/overview/ui/components/OperationalFacilityPanel.spec.tsx \
  src/modules/overview/ui/components/OperationalSituationPanel.tsx \
  src/modules/overview/ui/components/OperationalSituationPanel.spec.tsx \
  src/modules/overview/ui/components/operational-situation.css
git commit -m "feat(overview): list every regional facility"
```

### Task 4: Fast, explicit remote-imagery degradation

**Files:**
- Create: `src/modules/overview/ui/components/remoteMapEnhancement.ts`
- Create: `src/modules/overview/ui/components/remoteMapEnhancement.spec.ts`
- Modify: `src/modules/overview/ui/components/FourRegionTerrainAtlas.tsx`
- Modify: `src/modules/overview/ui/components/fourRegionTerrainModel.ts`
- Modify: `src/modules/overview/ui/components/fourRegionTerrainModel.spec.ts`
- Modify: `src/modules/overview/ui/components/OperationalSituationMap.tsx`
- Modify: `src/modules/overview/ui/components/OperationalSituationMap.ui.spec.tsx`

**Interfaces:**

```ts
export type RemoteEnhancementId =
  | "satellite"
  | "terrain-dem"
  | "hillshade-dem"
  | "openmaptiles";

export interface RemoteEnhancementStatus {
  failed: ReadonlySet<RemoteEnhancementId>;
  pending: ReadonlySet<RemoteEnhancementId>;
}

export function enhancementTimeoutMs(id: RemoteEnhancementId): number;
export function nextEnhancementStatus(
  current: RemoteEnhancementStatus,
  event: { id: RemoteEnhancementId; type: "READY" | "FAILED" },
): RemoteEnhancementStatus;
```

- [ ] **Step 1: Write failing state tests**

Assert independent source readiness, idempotent failures, and bounded deadlines:

```ts
expect(enhancementTimeoutMs("satellite")).toBe(8000);
expect(enhancementTimeoutMs("terrain-dem")).toBe(6000);
expect(enhancementTimeoutMs("hillshade-dem")).toBe(6000);
expect(enhancementTimeoutMs("openmaptiles")).toBe(8000);
```

Assert a satellite timeout maps to `DEGRADED_IMAGERY` without changing local scene readiness.

- [ ] **Step 2: Verify RED**

```bash
npm test -- src/modules/overview/ui/components/remoteMapEnhancement.spec.ts \
  src/modules/overview/ui/components/fourRegionTerrainModel.spec.ts \
  src/modules/overview/ui/components/OperationalSituationMap.ui.spec.tsx
```

Expected: FAIL because bounded enhancement state and explicit timeout handling do not exist.

- [ ] **Step 3: Implement independent deadlines and fallback**

Start one timeout per remote source after installation. Clear it when `sourcedata` and `map.isSourceLoaded(id)` report readiness. On timeout or source error, hide only the failed enhancement layers; keep the local matte surface, authoritative polygons, markers, leaders, controls, and inspector. Display concrete Chinese status such as `卫星影像暂不可用，已保留行政边界和业务节点`. Never recreate the map instance. Clean up all timers on unmount.

- [ ] **Step 4: Stabilize gesture loading**

Use:

```ts
fadeDuration: 0,
refreshExpiredTiles: false,
```

Keep parent tiles while target tiles load and refresh marker layout on `moveend`, not every `zoom` frame. Do not add unbounded frontend prefetch; the follow-on same-origin gateway owns cache prewarming.

- [ ] **Step 5: Verify GREEN**

Run Step 2. Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/modules/overview/ui/components/remoteMapEnhancement.ts \
  src/modules/overview/ui/components/remoteMapEnhancement.spec.ts \
  src/modules/overview/ui/components/FourRegionTerrainAtlas.tsx \
  src/modules/overview/ui/components/fourRegionTerrainModel.ts \
  src/modules/overview/ui/components/fourRegionTerrainModel.spec.ts \
  src/modules/overview/ui/components/OperationalSituationMap.tsx \
  src/modules/overview/ui/components/OperationalSituationMap.ui.spec.tsx
git commit -m "fix(overview): degrade unavailable imagery quickly"
```

### Task 5: Focused regression and real-browser acceptance

**Files:**
- Modify only when a failing assertion identifies a defect in files already owned by Tasks 1-4.
- Record evidence in the handoff; do not add screenshots or ad hoc QA HTML to Git.

- [ ] **Step 1: Run the complete focused suite**

```bash
npm test -- src/modules/overview/ui/components/operationalMarkerLayout.spec.ts \
  src/modules/overview/ui/components/fourRegionTerrainStyle.spec.ts \
  src/modules/overview/ui/components/fourRegionTerrainModel.spec.ts \
  src/modules/overview/ui/components/OperationalSituationMap.spec.tsx \
  src/modules/overview/ui/components/OperationalSituationMap.ui.spec.tsx \
  src/modules/overview/ui/components/OperationalFacilityPanel.spec.tsx \
  src/modules/overview/ui/components/OperationalSituationPanel.spec.tsx \
  src/modules/overview/ui/pages/OverviewPage.spec.tsx
```

Expected: PASS without unhandled promise rejections or React warnings.

- [ ] **Step 2: Run static checks and production build**

Run, one command at a time: `npm run format:check`, `npm run lint`, `npm run architecture`, `npm run build`, and `git diff --check`.

Expected: every command exits 0. Collect every result immediately.

- [ ] **Step 3: Run local real-browser acceptance**

Verify in Chrome and Safari:

- four-region minimum zoom shows every enabled facility independently;
- icons shrink together at minimum zoom and grow continuously when zooming;
- repeated wheel zoom and rapid drag do not hide or randomly reshuffle IDs after settling;
- same-coordinate markers expand with governed-coordinate leaders;
- selecting 齐齐哈尔市 and opening 库点/铁路 shows exact API counts and every list item;
- clicking list and map items selects the same ID;
- blocking satellite, terrain, and vector sources individually leaves boundaries, nodes, and inspector usable within the deadline;
- local evidence is not called deployed or cross-machine acceptance.

- [ ] **Step 4: Inspect the final boundary**

Run `git status --short --branch` and `git diff --check HEAD~4..HEAD`.

Expected: only Task 1-4 files and the spec/plan belong to this work. Pre-existing changes in `BoundaryMap.tsx`, `TerrainReliefBoundaryMap.tsx`, `terrainReliefSource*`, and `regional-perf-qa.html` remain untouched.

### Follow-on plan boundary

After Task 5 passes, write a separate backend/deployment plan for the commercial monthly imagery gateway, provider credentials, licensed cache/prewarming, monthly atomic version switching, acquisition metadata, and cross-machine/public acceptance. Do not call commercial imagery complete from this frontend plan.
