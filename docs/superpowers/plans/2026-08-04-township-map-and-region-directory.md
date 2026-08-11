# Township Map and Region Directory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make township the terminal interactive map level, isolate every hover to one gold township component, and move all village discovery into searchable backend-driven detail lists.

**Architecture:** Keep governed source geometry immutable and split presentation responsibilities: all real township components form the flat terrain cap, while only the pointer-hit component may receive a gold overlay. `OverviewPage` owns descendant loading through existing repository methods and passes a typed region directory to a focused searchable directory component in the detail panel.

**Tech Stack:** React 19, TypeScript, Three.js, Vitest/Testing Library, existing Spring/PostgreSQL overview APIs.

## Global Constraints

- The map terminal level is `TOWNSHIP`; no village boundary, point, label, or drill action is rendered.
- Hovering one township component makes only that component gold.
- Geography and directory values come from backend APIs; no administrative names or counts are hard-coded.
- Existing source GeoJSON is not rewritten or replaced with inferred village geometry.

---

### Task 1: Lock the Map at Township Level

**Files:**

- Modify: `src/modules/overview/ui/pages/OverviewPage.spec.tsx`
- Modify: `src/modules/overview/ui/pages/OverviewPage.tsx`
- Modify: `src/modules/overview/ui/components/OverviewCommandCenter.tsx`

**Interfaces:**

- Consumes: `OverviewRegion.level` and existing `onDrill` callbacks.
- Produces: `drillDown(region)` that returns for `TOWNSHIP` and `VILLAGE`; terminal township detail copy without a next-level action.

- [ ] Write a failing page test that drills city → county → township, asserts no village `regions()` request occurs, and asserts the township detail has no “进入下一级监测” button.
- [ ] Run `npx vitest run src/modules/overview/ui/pages/OverviewPage.spec.tsx` and confirm the new test fails on the current village drill.
- [ ] Change `prefetchRegionChildren` and `drillDown` to stop at `TOWNSHIP`; render “乡镇为地图最下层” in the detail actions.
- [ ] Re-run the page test and confirm it passes.

### Task 2: Add Backend-Driven Searchable Region Directory

**Files:**

- Create: `src/modules/overview/ui/components/RegionDirectorySearch.tsx`
- Modify: `src/modules/overview/domain/overview.ts`
- Modify: `src/modules/overview/ui/pages/OverviewPage.tsx`
- Modify: `src/modules/overview/ui/components/OverviewCommandCenter.tsx`
- Modify: `src/modules/overview/ui/pages/OverviewPage.spec.tsx`
- Modify: `src/app/styles/global.css`

**Interfaces:**

- Produces: `OverviewRegionDirectory` with `counties`, `townships`, `villages`, `loading`, and optional `error`.
- Produces: `<RegionDirectorySearch label regions />`, a local-search combobox/list whose displayed count equals `regions.length`.
- Consumes: `repository.regions({ parentCode })` for prefecture counties and `repository.locations({ ancestorCode, level })` for township/village descendants.

- [ ] Write failing tests selecting a prefecture and a township, asserting parallel directory calls and searchable county/township/village names.
- [ ] Run the page test and confirm the directory assertions fail.
- [ ] Add a selection-scoped effect that starts county, township, and village requests together with `Promise.all`, guards stale responses, and stores an empty/error state without changing map navigation.
- [ ] Replace code/audit/latest-time detail rows with administrative level plus three searchable count/name controls.
- [ ] Add compact detail-panel styles and `content-visibility` for long option lists.
- [ ] Re-run the page test and confirm it passes.

### Task 3: Replace Fragmented Relief with Component-Isolated Gold Hover

**Files:**

- Modify: `src/modules/overview/ui/components/terrainReliefGeometry.spec.ts`
- Modify: `src/modules/overview/ui/components/terrainReliefGeometry.ts`
- Modify: `src/modules/overview/ui/components/TerrainReliefBoundaryMap.tsx`

**Interfaces:**

- Consumes: `ReliefSurface.polygons`, `primaryPolygonIndex`, and component-aware hit targets.
- Produces: a flat base cap containing every governed polygon component, primary-only permanent outlines, and exactly one gold hover overlay keyed by `regionCode::componentId`.

- [ ] Add failing geometry tests proving all base polygons remain available while `raiseablePolygonIndices` contains only the governed primary component and detached components cannot be raised together.
- [ ] Run the geometry test and confirm it fails against the current primary-only base rendering contract.
- [ ] Build earth top geometries from complete feature surfaces, keep permanent outlines and hit meshes on the governed primary component, and keep parent wall geometry on the parent shell only.
- [ ] Change hover surface, side wall, and hover outline materials to gold and expose `goldHoverComponentCount` diagnostics.
- [ ] Re-run geometry tests and confirm they pass.

### Task 4: Production Verification

**Files:**

- Verify only; no committed screenshot artifacts.

**Interfaces:**

- Consumes: completed Tasks 1–3.
- Produces: fresh automated and browser evidence.

- [ ] Run targeted overview tests and confirm zero failures.
- [ ] Run `npm run build` and confirm TypeScript/Vite exit successfully.
- [ ] Reload `http://127.0.0.1:63200/#/overview` at 1920×1080 in the in-app browser.
- [ ] Exercise overall → city → county → township; confirm township is terminal, no village map labels exist, directory search returns village names, one hover is gold, duplicate outlines are zero, and console errors are zero.
- [ ] Save final screenshots outside the repository and report any remaining data limitation without claiming false completion.
