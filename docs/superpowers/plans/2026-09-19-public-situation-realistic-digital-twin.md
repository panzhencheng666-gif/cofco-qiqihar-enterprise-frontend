# Public Situation Realistic Digital Twin Implementation Plan

> **Execution:** Implement task by task with bounded commits. This plan supersedes the visual implementation in `2026-09-19-public-situation-globe.md`; it reuses the existing APIs, hierarchy, permissions, realtime refresh, and persisted records.

**Goal:** Replace the current delayed, dashboard-like public map with a fast, realistic Cesium 3D geographic view and focused weather/node inspector, then add auditable XLSX facility import.

**Architecture:** Mount one persistent Cesium Viewer. Render administrative geometry, markers, and paths with Cesium primitives/collections. Load imagery/terrain progressively with a local fallback. Keep external weather access behind the backend cache. Extend the existing operational-facility controller and service for atomic workbook import.

**Tech stack:** React 19, TypeScript, CesiumJS 1.143, Spring Boot, PostgreSQL/PostGIS, Apache POI helpers, Vitest, Playwright.

## Constraints

- Local only; do not publish to the public internet.
- Preserve current navigation, business permissions, hierarchy, data contracts, and user records.
- Do not seed or fabricate facilities, weather, inventory, or logistics.
- Keep one writer and make a checkpoint commit after every task.

### Task 1: Lock the layer, icon, camera, and performance contracts

**Files**

- Create: `src/modules/overview/ui/components/realisticSituationModel.ts`
- Create: `src/modules/overview/ui/components/realisticSituationModel.spec.ts`
- Create: `src/modules/overview/ui/components/realisticSituationIcons.ts`
- Create: `src/modules/overview/ui/components/realisticSituationIcons.spec.ts`

- [ ] Add failing tests for category-exclusive depot filters, altitude-to-detail level, four-region camera framing, and stable feature identities.
- [ ] Add SVG/data-URL icons for green owned warehouse, yellow leased warehouse, gray historical warehouse, white diesel locomotive, and weather conditions.
- [ ] Add an instrumented viewer lifecycle seam that can assert one viewer and zero DOM markers across refresh/filter changes.
- [ ] Run focused tests and commit.

### Task 2: Replace the public map with the persistent realistic Cesium scene

**Files**

- Create: `src/modules/overview/ui/components/RealisticOperationalSituationMap.tsx`
- Modify: `src/modules/overview/ui/components/OperationalSituationMap.tsx`
- Create: `src/modules/overview/ui/components/realistic-operational-situation.css`
- Modify: `src/modules/overview/ui/pages/OverviewPage.tsx`
- Test: `src/modules/overview/ui/components/OperationalSituationMap.spec.tsx`

- [ ] Mount a Cesium Viewer immediately with local Natural Earth imagery; upgrade imagery and ArcGIS elevation asynchronously with error fallback and provider attribution.
- [ ] Render region boundaries and labels at level-dependent altitude, retain selected boundaries, and constrain root/local cameras to their governed extents.
- [ ] Render depot/rail/weather markers with billboard collections and paths with ground polylines; wire picking, filter state, selection, and hierarchy drill.
- [ ] Keep the viewer mounted while operational catalogues refresh and request rendering only for state changes or active weather animation.
- [ ] Verify cold first-use timing, focused unit tests, production build, and commit.

### Task 3: Rebuild the right inspector and dynamic selected-region weather

**Files**

- Create: `src/modules/overview/ui/components/RealisticWeatherScene.tsx`
- Rewrite: `src/modules/overview/ui/components/OperationalSituationPanel.tsx`
- Rewrite: `src/modules/overview/ui/components/operational-situation.css`
- Test: `src/modules/overview/ui/components/OperationalSituationPanel.spec.tsx`

- [ ] Replace the KPI/card wall with one selected-region header, a compact Weather/Depots/Railway/Logistics switch, and one active detail body.
- [ ] Drive the animated sky scene from the live weather code, precipitation, cloud, wind, observation time, and precision fields.
- [ ] Collapse provenance and remove default NASA/policy feed clutter while preserving accessible source links.
- [ ] Fix internal scrolling, narrow/wide layouts, Escape close, and map-control clearance.
- [ ] Run focused tests, visual browser acceptance, and commit.

### Task 4: Add atomic XLSX facility import to the existing backend aggregate

**Files**

- Modify: `src/main/java/com/cofco/qiqihar/graintrade/overview/api/OperationalFacilityController.java`
- Modify: `src/main/java/com/cofco/qiqihar/graintrade/overview/application/OperationalFacilityService.java`
- Create: `src/main/java/com/cofco/qiqihar/graintrade/overview/application/OperationalFacilityImportService.java`
- Create: `src/main/java/com/cofco/qiqihar/graintrade/overview/api/OperationalFacilityImportResult.java`
- Test: focused overview controller/service tests.

- [ ] Add a downloadable UTF-8 XLSX template with controlled relation/status values.
- [ ] Parse the workbook through existing helpers, validate access and all rows first, and write within one transaction only when no row errors exist.
- [ ] Return total/imported rows plus row number, field, and concrete reason; duplicate facility codes and invalid region access are errors.
- [ ] Audit every successful imported facility with the authenticated actor.
- [ ] Run focused backend tests and commit.

### Task 5: Add the frontend facility import flow

**Files**

- Modify: `src/modules/overview/infrastructure/http/HttpOverviewRegionalDataRepository.ts`
- Modify: `src/modules/overview/ui/components/StorageFacilityEditor.tsx`
- Test: `src/modules/overview/ui/components/StorageFacilityEditor.spec.tsx`

- [ ] Add template download, file selection, submit progress, atomic success refresh, and row/field/reason error table.
- [ ] Keep the existing single-record form and permission checks.
- [ ] Prove successful records come from the backend refresh rather than optimistic fixtures.
- [ ] Run focused tests and commit.

### Task 6: Performance, local runtime, and browser acceptance

**Files**

- Update managed-local runtime artifacts only after source verification.
- Sync the finalized overview module to the parity repository only after the formal frontend commit is stable.

- [ ] Run frontend tests, lint/type checks, and production build.
- [ ] Run focused backend tests against the isolated test database.
- [ ] Deploy to the managed local runtime and verify health/readiness.
- [ ] Measure cold and warm Public Situation entry, viewer count, DOM marker count, and network request behavior.
- [ ] Browser-verify four-region overview, all hierarchy levels, camera boundaries, live weather, all marker filters, routes, panel scrolling, form persistence, XLSX import, and refresh stability.
- [ ] Record source limitations separately from implementation defects and commit the final local checkpoint.

