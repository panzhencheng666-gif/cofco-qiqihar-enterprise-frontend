# Overview Golden Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the formal overview screen to match the approved 16:9 golden reference while rendering governed geography and audited business data only.

**Architecture:** Replace the current MapLibre/Cesium/legacy Three map path with one fixed Three.js 2.5D canvas. The canvas renders the pastoral background and GeoJSON-derived raised surface with the same screen-space texture coordinates; React keeps filters, business panels and hierarchy state outside the renderer.

**Tech Stack:** React 19, TypeScript 5.9, Three.js 0.184, Vite 8, Vitest, Browser/IAB.

## Global Constraints

- Modify only the formal frontend repository; old repositories remain read-only.
- The accepted image is the only visual reference and may not be shipped as static UI.
- No region, boundary, business value, trend, chart or count may be invented or hardcoded.
- The map camera is fixed; zoom, pan, rotation and position changes are disabled.
- Missing real boundaries produce an explicit governed-data empty state.
- Complete this overview phase and stop for the user's personal acceptance before any next task.

---

### Task 1: Lock geometry and data contracts

**Files:**

- Create: `src/modules/overview/ui/components/terrainReliefGeometry.ts`
- Create: `src/modules/overview/ui/components/terrainReliefGeometry.spec.ts`

**Interfaces:**

- Consumes: `MapFeature[]`, `MapPointFeature[]`, fixed safe-frame dimensions.
- Produces: projected polygon rings, child outlines, label anchors, point anchors and a stable picking identifier.

- [ ] Test Polygon and MultiPolygon projection into a fixed safe frame.
- [ ] Test that all projected coordinates remain inside the top, bottom, left and right occlusion margins.
- [ ] Test that a parent backdrop produces outer sides while children produce top outlines only.
- [ ] Test that points keep real coordinates and labels are density-limited without dropping the point itself.

### Task 2: Build the single-canvas terrain relief renderer

**Files:**

- Create: `src/modules/overview/ui/components/TerrainReliefBoundaryMap.tsx`
- Modify: `src/modules/overview/ui/components/BoundaryMap.tsx`

**Interfaces:**

- Consumes: the existing `BoundaryMap` props and projected geometry from Task 1.
- Produces: one fixed WebGL canvas, clickable regions/points, selection position, drill callbacks and renderer-ready status.

- [ ] Render `/overview/command-terrain-v2.png` as the only background inside the Three scene.
- [ ] Render the governed parent surface with matching screen-space texture UVs, outer cyan side walls and contact shadow.
- [ ] Render child outlines and gold selected overlay without internal floating slabs.
- [ ] Render density-safe labels and real location points; use ray picking for shapes and accessible DOM controls for labels.
- [ ] Disable camera interaction and keep every hierarchy inside the same safe frame.
- [ ] Keep the existing real-GeoJSON SVG only as explicit WebGL fallback.

### Task 3: Recompose the approved screen

**Files:**

- Create: `src/modules/overview/ui/components/GoldenOverviewScreen.tsx`
- Modify: `src/modules/overview/ui/pages/OverviewPage.tsx`
- Modify: `src/app/styles/global.css`

**Interfaces:**

- Consumes: repository-backed `OverviewDashboard`, filters, map, selection and hierarchy navigation.
- Produces: the approved header, KPI band, central map, conditional detail panel, four-chart rail and footer.

- [ ] Use the approved 1920×1080 internal stage and preserve the image's relative geometry.
- [ ] Keep the map fixed when the detail panel opens; show details only after a region click.
- [ ] Preserve exact visible labels from the reference and do not add presentation copy.
- [ ] Display audited values or governed empty states only.
- [ ] Keep all controls functional while preserving the accepted container model.

### Task 4: Real hierarchy and interaction tests

**Files:**

- Modify: `src/modules/overview/ui/pages/OverviewPage.spec.tsx`
- Test: `src/modules/overview/ui/components/terrainReliefGeometry.spec.ts`

**Interfaces:**

- Consumes: existing repository test doubles.
- Produces: regression evidence for scope switching, selection, drill, return, details and no-fake-data rules.

- [ ] Test overall/city/county/township/village responses without replacing missing boundaries.
- [ ] Test detail visibility only after click and correct clearing on filter changes.
- [ ] Test that the map remains fixed after commands and details changes.
- [ ] Run the focused overview tests and TypeScript check once.

### Task 5: Golden browser verification

**Files:**

- Modify only files with a browser-proven mismatch.

**Interfaces:**

- Consumes: the completed formal route and accepted concept.
- Produces: a 1920×1080 screenshot and a fidelity ledger covering at least five concrete comparisons.

- [ ] Verify the backend on port 8090 and the formal frontend route.
- [ ] Capture overall, city, county, township, village, selected, drilled, returned and detail-expanded states.
- [ ] Use `view_image` on the accepted concept and latest 1920×1080 browser screenshot in the same QA pass.
- [ ] Correct layout, texture, clarity, occlusion, label density and interaction mismatches until no material visual defect remains.
- [ ] Run only affected tests after fixes, then one production build.
- [ ] Stop and present the overview for the user's personal acceptance; do not start the next phase.
