# Overview Map Stabilization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stabilize every city, county, township, and village map interaction so selected geometry rises as one owned solid, ground outlines never duplicate it, navigation does not freeze, and displayed counts remain API-driven.

**Architecture:** Keep `TerrainReliefBoundaryMap` as the single renderer, but enforce explicit contracts through pure geometry tests and a small Playwright smoke matrix. Treat administrative geometry, renderer diagnostics, and business counts as separate contracts so visual fixes cannot silently hard-code backend data.

**Tech Stack:** React 19, TypeScript, Three.js, Vitest, Testing Library, Playwright, Vite.

## Global Constraints

- City, county, township, and village selections use the same ownership-aware lift pipeline.
- Township boundaries remain sourced from real administrative geometry.
- Village display cells may be synthetic, but must partition the township without gaps, holes, fragments, or unnamed hit areas.
- No business metric or sample-point count may be hard-coded; values must come from the overview API and selected region hierarchy.
- Do not stage, commit, reset, or overwrite unrelated changes in the shared dirty worktree.
- Before 2026-08-08, execute only Tasks 1 and 2 with `gpt-5.6-terra` at low reasoning; defer broader feature work unless a regression blocks use.

---

### Task 1: Cross-level relief ownership regression contract

**Files:**

- Modify: `src/modules/overview/ui/components/TerrainReliefBoundaryMap.tsx`
- Modify: `src/modules/overview/ui/components/terrainReliefGeometry.spec.ts`

**Interfaces:**

- Consumes: `reliefComponentKey(identity)` and renderer diagnostics on `[data-cap-ownership]`.
- Produces: deterministic segment ownership and diagnostics `suppressedGroundOutlineRegion`, `groundOutlinesSuppressed`, `selectionOverlayLayerCount`, and `duplicateInteractiveTopCount`.

- [ ] **Step 1: Add failing unit cases for ownership-aware ground segments**

```ts
expect(shouldShowGroundOutlineSegment(["230200"], "230200")).toBe(false);
expect(shouldShowGroundOutlineSegment(["150700"], "230200")).toBe(true);
expect(shouldShowGroundOutlineSegment(["230200", "150700"], "230200")).toBe(false);
```

- [ ] **Step 2: Run the focused test and confirm the new case fails before implementation**

Run: `npm test -- --run src/modules/overview/ui/components/terrainReliefGeometry.spec.ts`

Expected: the newly introduced ownership case fails while existing geometry tests remain green.

- [ ] **Step 3: Implement one ownership-aware line-segment buffer**

Build one deduplicated `LineSegmentsGeometry`, record all owning region codes for each normalized edge, and update only the buffer positions whose owners do not include the raised region. Do not hide the whole ground outline group.

- [ ] **Step 4: Run the focused test again**

Run: `npm test -- --run src/modules/overview/ui/components/terrainReliefGeometry.spec.ts`

Expected: all focused tests pass.

- [ ] **Step 5: Record completion in this plan without committing the shared worktree**

Mark Task 1 complete only after the focused test and visual diagnostics agree.

---

### Task 2: Browser smoke matrix for all four levels

**Files:**

- Create: `tests/e2e/overview-relief.e2e.ts`
- Modify only if a defect is reproduced: `src/modules/overview/ui/components/TerrainReliefBoundaryMap.tsx`

**Interfaces:**

- Consumes: accessible administrative label buttons, `进入下一级监测`, and renderer diagnostic data attributes.
- Produces: repeatable root/county/township/village selection coverage and a freeze regression guard.

- [ ] **Step 1: Add a Playwright helper that reads the renderer contract**

```ts
async function readReliefContract(page: Page) {
  return page.locator("[data-cap-ownership]").evaluate((node) => ({
    duplicateInteractiveTopCount: node.dataset.duplicateInteractiveTopCount,
    groundOutlinesSuppressed: node.dataset.groundOutlinesSuppressed,
    raisedSelectionComponentCount: node.dataset.raisedSelectionComponentCount,
    selectionOverlayLayerCount: node.dataset.selectionOverlayLayerCount,
    suppressedGroundOutlineRegion: node.dataset.suppressedGroundOutlineRegion,
  }));
}
```

- [ ] **Step 2: Add one city-level selection test**

Select 齐齐哈尔市 and assert `raisedSelectionComponentCount === "1"`, `selectionOverlayLayerCount === "0"`, `duplicateInteractiveTopCount === "0"`, and `suppressedGroundOutlineRegion === "230200"`.

- [ ] **Step 3: Add sequential county, township, and village navigation cases**

Use accessible labels and `进入下一级监测`. At every level, select one named region, assert exactly one raised component, close details, and assert `groundOutlinesSuppressed === "false"`.

- [ ] **Step 4: Add a repeated navigation freeze guard**

Repeat select/close/drill/reset interactions ten times and require every action plus renderer-ready diagnostic to finish within the test timeout. Do not assert frame-rate values.

- [ ] **Step 5: Run the focused E2E test**

Run: `npx playwright test tests/e2e/overview-relief.e2e.ts --workers=1`

Expected: all four levels pass without navigation timeout or page crash.

---

### Task 3: API-driven hierarchy and sample-point contract

**Files:**

- Modify: `src/modules/overview/infrastructure/http/HttpOverviewRepository.spec.ts`
- Modify: `src/modules/overview/ui/pages/OverviewPage.spec.tsx`
- Modify only if the contract fails: `src/modules/overview/ui/pages/OverviewPage.tsx`
- Modify only if the contract fails: `src/modules/overview/ui/components/OverviewCommandCenter.tsx`

**Interfaces:**

- Consumes: `/api/v1/overview/regions`, `/api/v1/overview/locations`, and the selected region code.
- Produces: selected-region sample count derived from returned village/location records.

- [ ] **Step 1: Add repository tests for selected-region query forwarding**

Assert that switching region codes changes the API query and that no fallback constant such as `2332` is returned by the repository.

- [ ] **Step 2: Add page tests for root and child sample counts**

Mock different API counts for root, city, county, and township selections. Assert the `样本点数量` panel changes after each selection.

- [ ] **Step 3: Implement only contract failures**

Keep the API response as the source of truth. Do not add display-only totals or region-name conditionals.

- [ ] **Step 4: Run repository and page tests**

Run: `npm test -- --run src/modules/overview/infrastructure/http/HttpOverviewRepository.spec.ts src/modules/overview/ui/pages/OverviewPage.spec.tsx`

Expected: both test files pass.

---

### Task 4: Final verification and handoff

**Files:**

- Modify: `docs/superpowers/plans/2026-08-05-overview-map-stabilization.md`

**Interfaces:**

- Consumes: Tasks 1-3 test evidence.
- Produces: one acceptance record listing commands, pass counts, remaining risks, and the local system URL.

- [ ] **Step 1: Run the full frontend verification suite**

Run: `npm test && npm run lint && npm run build && git diff --check`

Expected: zero failed tests, zero lint errors, successful production build, and no whitespace errors.

- [ ] **Step 2: Perform one manual browser pass**

Verify city, county, township, and village maps visually: no duplicate selected outline, blank socket, detached wall, unnamed clickable polygon, or missing parent coverage.

- [ ] **Step 3: Record exact evidence and remaining risks**

Add the test totals and any deferred issue to this document. Do not state completion if any level was not exercised.

## Self-Review

- Spec coverage: Tasks 1-2 cover geometry, interaction, and freezing; Task 3 covers dynamic backend linkage; Task 4 covers final acceptance.
- Placeholder scan: no TBD/TODO steps remain.
- Type consistency: renderer diagnostics use the existing `HTMLElement.dataset` string contract throughout.
