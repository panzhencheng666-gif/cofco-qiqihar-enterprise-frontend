# County And Deeper Sample-Point Icons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace county-and-deeper aggregate markers with governed concrete sample-point icons selected from the right-panel category filters on formal 63182.

**Architecture:** Keep the existing recursive authorized-region repository query. Restrict aggregates to overview/prefecture contexts, allow icon queries for county/township/village, and make the frontend panel own one atomic filter/result state whose list and icons share the same request fields.

**Tech Stack:** Java 21, Spring Boot 4.1, PostgreSQL/PostGIS, React 19, TypeScript 5.9, Vitest, Testing Library, Playwright.

## Global Constraints

- Preserve map geometry, administrative boundaries, basemap, camera, labels, right-panel proportions and structure, first-frame readiness, toolbar removals, and region drill-down.
- Render no invented zero, aggregate, icon, list item, or detail on API failure.
- Draw only committed, approved, authorized, product-matching records with valid coordinates.
- Do not touch 64185, annual, 24h, phase eight, production, cloud, release, tags, main, or history rewriting.

---

### Task 1: Lock the backend query contract

**Files:**

- Modify: `../cofco-qiqihar-enterprise-backend/src/test/java/com/cofco/qiqihar/graintrade/overview/interfaceadapter/OverviewSamplePointRestIntegrationTest.java`
- Modify: `../cofco-qiqihar-enterprise-backend/src/main/java/com/cofco/qiqihar/graintrade/overview/application/OverviewSamplePointRepository.java`
- Modify: `../cofco-qiqihar-enterprise-backend/src/main/java/com/cofco/qiqihar/graintrade/overview/application/OverviewSamplePointService.java`
- Modify: `../cofco-qiqihar-enterprise-backend/src/main/java/com/cofco/qiqihar/graintrade/overview/infrastructure/JdbcOverviewSamplePointRepository.java`
- Modify: `../cofco-qiqihar-enterprise-backend/src/main/java/com/cofco/qiqihar/graintrade/overview/interfaceadapter/OverviewSamplePointController.java`

**Interfaces:** `icons(productCode, regionCode, categoryCode, typeCode, query, authorizedRegionCodes)` and filtered `detail(productCode, samplePointId, regionCode, categoryCode, typeCode, authorizedRegionCodes)`.

- [ ] Add integration assertions that overview/prefecture aggregates succeed, deeper aggregates fail, prefecture icons fail, county/township/village icons recursively return the same authorized product/category/type/search set, and filtered detail returns only associations reachable from the filtered list.
- [ ] Run the focused Maven integration test with JDK 21 and confirm failures are the current village-only and unfiltered-detail behavior.
- [ ] Replace the village-only service guard with `COUNTY|TOWNSHIP|VILLAGE`, use existing navigation authorization, normalize icon search, filter icon rows with the same predicate as list rows, and apply category/type to detail rows.
- [ ] Re-run the focused integration test and require zero failures.

### Task 2: Make right-panel transitions atomic

**Files:**

- Modify: `src/modules/overview/application/ports/OverviewSamplePointRepository.ts`
- Modify: `src/modules/overview/infrastructure/http/HttpOverviewSamplePointRepository.ts`
- Modify: `src/modules/overview/infrastructure/http/HttpOverviewSamplePointRepository.spec.ts`
- Modify: `src/modules/overview/ui/components/OverviewSamplePointPanel.tsx`
- Modify: `src/modules/overview/ui/components/OverviewSamplePointPanel.spec.tsx`

**Interfaces:** list and icons share `{ productCode, regionCode, categoryCode, typeCode?, query? }`; detail consumes the selected stable id plus the same product/region/category/type boundary.

- [ ] Add failing tests for no initial result rows/icons/detail, category-wide results at county/township/village, type narrowing, cancellation/switch/search immediate cleanup, stale-response rejection, API failure, and list-only detail selection.
- [ ] Run the two focused Vitest files and confirm the new assertions fail for the expected stale/list/village-only behavior.
- [ ] Split category-count state from filtered-result state; synchronously clear results/icons/detail before each filter transition; send identical query fields to list and icons; remove the map-selected detail path.
- [ ] Re-run the focused Vitest files and require zero failures and no unhandled rejection.

### Task 3: Enforce the two aggregate levels without changing the map

**Files:**

- Modify: `src/modules/overview/ui/pages/OverviewPage.tsx`
- Modify: `src/modules/overview/ui/pages/OverviewPage.spec.tsx`
- Modify: `src/modules/overview/ui/components/BoundaryMap.tsx`
- Modify: `src/modules/overview/ui/components/TerrainReliefBoundaryMap.tsx`

**Interfaces:** `SamplePointAggregateStatus` gains an explicit hidden state; concrete map icons are non-interactive location symbols.

- [ ] Add failing page/map tests that root and prefecture parents show aggregates, county/township/village contexts show names without rings or aggregate wording, and map icons do not request detail.
- [ ] Run the focused page and geometry tests and confirm the deeper-level aggregate assertions fail.
- [ ] Gate aggregate requests by map parent level, clear aggregate state on deeper entry, pass the hidden status to accessible and WebGL labels, key the right panel by product and region, and render concrete icons as non-interactive symbols.
- [ ] Re-run the focused tests and require zero failures.

### Task 4: Prove the formal runtime behavior

**Files:**

- Create outside Git: formal 63182 Playwright capture script, screenshots, and JSON evidence under the task visualization directory.

- [ ] Run backend focused and full tests, frontend focused and full tests, lint, architecture, formatting check, and production build.
- [ ] Start or non-destructively restart the formal local stack and require all health checks to pass.
- [ ] On formal 63182 traverse overview → city → county → township → village; exercise category, type, cancellation, switching, product, right-panel close/open and reload; record request/response evidence without credentials or personal values.
- [ ] Capture 1440×900 and 1920×1080 screenshots plus renderer geometry diagnostics; verify administrative feature/backdrop identifiers and camera/layout attributes remain unchanged while deeper aggregate marker count is zero.

### Task 5: Review, commit, push, and hand off

**Files:**

- Create outside Git: structured phase handoff in the task visualization directory.

- [ ] Inspect all three runtime worktrees, generated files, secret patterns, `git diff --check`, exact unstaged diff, and exact cached diff.
- [ ] Stage only explicit phase paths in repositories that changed; do not use broad add commands.
- [ ] Commit once per changed repository on its existing branch, then ordinary-push each existing private `origin`.
- [ ] Verify local HEAD, upstream and `git ls-remote` SHA equality, write completed/passed/failed/uncompleted/risk boundaries into the handoff, and stop.
