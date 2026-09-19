# Public Situation Globe Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the delayed flat public-situation screen with an immediately available four-region globe overview that drills to county, township, and village, presents live weather in the requested alert style, and keeps logistics, inventory, facilities, and annotations in one map.

**Architecture:** Keep the existing OverviewPage, region hierarchy, permissions, MapLibre map, API clients, and database contracts. Mount one MapLibre instance for the whole public-situation session, switch it between globe overview and pitched local detail cameras, update sources in place, and load operational datasets independently so a slow feed never removes the map. Weather and business changes continue to enter through the backend and existing refresh channel; village weather inherits the selected township observation when no smaller public observation exists.

**Tech Stack:** React 19, TypeScript, MapLibre GL JS 6.1, Spring Boot, PostgreSQL/PostGIS, Vitest, Playwright.

## Global Constraints

- Keep all work local; do not publish to the public internet.
- Preserve the current navigation, administrative hierarchy, permissions, sample workflows, and persisted user data.
- Show the four roots 齐齐哈尔、黑河、呼伦贝尔、大兴安岭 on first entry without manual panning.
- Never generate owned or leased facilities with AI; these are persisted business submissions.
- Poll local APIs only; external weather refresh remains backend cached, rate-limited, and single-flight.
- Display railway stations with a white train glyph.
- Keep map and side panel usable while any operational feed refreshes.

---

### Task 1: Persistent first paint and region transitions

**Files:**
- Modify: `src/modules/overview/ui/pages/OverviewPage.tsx`
- Modify: `src/modules/overview/ui/components/OperationalSituationMap.tsx`
- Modify: `src/modules/overview/ui/components/OverviewDataModePanel.tsx`
- Test: `src/modules/overview/ui/pages/OverviewPage.spec.tsx`

**Interfaces:**
- Consumes: existing `OperationalFacilityCatalogue`, `OperationalSituationCatalogue`, `MapFeature[]`, and hierarchy callbacks.
- Produces: a mounted public map with optional operational datasets and an in-place `syncing` state.

- [ ] Add a failing page test proving the public map remains rendered during initial feed loading and region changes.
- [ ] Stop clearing the last successful facility catalogue before a refresh and separate initial absence from background synchronization.
- [ ] Allow the public map to mount from boundary data before facilities/weather arrive by using empty typed catalogues.
- [ ] Keep the MapLibre instance outside `bounds` dependency changes; update GeoJSON sources and call `fitSituationMap` instead.
- [ ] Run `npm test -- OverviewPage.spec.tsx OperationalSituationMap.spec.tsx` and commit the passing change.

### Task 2: Four-region globe and automatic hierarchy camera

**Files:**
- Create: `src/modules/overview/ui/components/publicSituationViewport.ts`
- Test: `src/modules/overview/ui/components/publicSituationViewport.spec.ts`
- Modify: `src/modules/overview/ui/components/OperationalSituationMap.tsx`
- Modify: `src/modules/overview/ui/components/operational-situation.css`

**Interfaces:**
- Consumes: root bounds and the current administrative level.
- Produces: `publicSituationCamera(level, bounds)` and `publicSituationProjection(level)`.

- [ ] Add tests for root globe projection, lower-level Mercator detail projection, and camera padding.
- [ ] Set MapLibre `projection: { type: "globe" }` for the four-region root and use atmospheric sky/fog where supported.
- [ ] Animate `fitBounds` on region selection and hierarchy changes without rebuilding the map.
- [ ] Render route lines as animated directional trails and keep region boundaries above the terrain basemap.
- [ ] Run focused map tests and commit the passing change.

### Task 3: Live weather effects and alert detail

**Files:**
- Modify: `src/modules/overview/domain/operationalSituation.ts`
- Modify: `src/modules/overview/infrastructure/http/HttpOverviewRegionalDataRepository.ts`
- Create: `src/modules/overview/ui/components/LiveWeatherEffect.tsx`
- Modify: `src/modules/overview/ui/components/OperationalSituationMap.tsx`
- Modify: `src/modules/overview/ui/components/OperationalSituationPanel.tsx`
- Test: `src/modules/overview/ui/components/OperationalSituationPanel.spec.tsx`
- Modify backend: `src/main/java/com/cofco/qiqihar/graintrade/overview/application/OperationalSituationCatalogue.java`
- Modify backend: `src/main/java/com/cofco/qiqihar/graintrade/overview/infrastructure/JdbcOperationalSituationRepository.java`
- Modify backend: `src/main/java/com/cofco/qiqihar/graintrade/regionalproduction/application/RegionalPublicDataRefreshWorker.java`

**Interfaces:**
- Consumes: cached Open-Meteo observations and selected hierarchy region.
- Produces: observation weather code, wind, cloud cover, source time, alert narrative, and a map effect derived only from those values.

- [ ] Extend the weather contract with weather code, wind speed/direction, cloud cover, and a precision label while remaining backward compatible.
- [ ] Refresh selected-region weather through the backend cache and single-flight guard; exact prefecture/county/town observations use representative coordinates and village detail declares township inheritance.
- [ ] Render rain, snow, cloud, wind, or clear effects from the live observation and stop using generic standalone weather pins.
- [ ] Replace the right weather card with the requested alert composition: title, animated visual, observation time, crop, evidence chain, concise description, and compact source links.
- [ ] Run frontend weather tests and focused backend weather tests, then commit.

### Task 4: Persisted facilities, inventory, logistics, and annotations

**Files:**
- Modify the existing operational facility backend aggregate and controller instead of adding a second catalogue.
- Add a forward-only Flyway migration for facility submission metadata, inventory snapshots, and logistics movements.
- Modify the public map and panel to use those persisted records and existing realtime refresh events.
- Reuse the existing map annotation overlay in public-situation mode and remove its duplicate top-level mode button.

**Interfaces:**
- Consumes: authenticated work unit, current region permission, facility form values, inventory snapshots, logistics movements, and existing annotation repository.
- Produces: auditable facility CRUD, live inventory deltas, directional logistics flows, and annotations on the public map.

- [ ] Add authorization and validation tests for owned, leased, and historical-leased facility create/update/archive operations.
- [ ] Add business forms whose submit path persists the facility; no runtime seed or AI insertion is allowed.
- [ ] Stream/poll persisted inventory and logistics revisions through the existing overview realtime refresh path and animate only recorded movements.
- [ ] Mount the existing annotation overlay and editing controls in public situation and remove the duplicate map-annotation mode entry.
- [ ] Run focused backend/frontend tests and commit.

### Task 5: Local acceptance and packaging

**Files:**
- Update only the managed local runtime after source verification passes.

**Interfaces:**
- Consumes: committed source artifacts.
- Produces: local browser acceptance evidence with no public deployment.

- [ ] Run frontend unit tests, lint, and production build.
- [ ] Run focused backend tests against the dedicated test database.
- [ ] Deploy to the managed local runtime and verify health endpoints.
- [ ] In the browser verify: immediate four-region globe, region click without blank replacement, city to county to township to village drill, live weather refresh, white railway icons, submitted facility persistence, inventory/logistics movement, annotation editing, and side-panel scrolling.
- [ ] Record remaining upstream-data limitations separately from implementation defects.
