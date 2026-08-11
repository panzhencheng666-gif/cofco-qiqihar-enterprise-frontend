# Overview Spatial Narration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the approved bright three-dimensional overview presentation using only governed Qiqihar, Heihe, and Hulunbuir boundaries, with click-driven production, market, and supply-balance narratives plus local browser voice narration.

**Architecture:** Keep query orchestration in `OverviewPage`, geometry rendering behind `BoundaryMap`, Cesium lifecycle in one adapter component, and Web Speech behind a UI hook. Derive the three presentation chapters deterministically from `OverviewIndicator`; do not introduce new business calculations or frontend facts.

**Tech Stack:** React 19, TypeScript 5.9, CesiumJS 1.143, Vitest/Testing Library, CSS, browser Web Speech API.

## Global Constraints

- The old frontend, backend, and dashboard repositories remain read-only.
- The first map level contains only backend-returned real boundaries for 齐齐哈尔市、黑河市、呼伦贝尔市.
- The page is read-only leadership presentation; it has no reporting, editing, approval, or import action.
- Values, periods, products, regions, boundaries, sources, and units come from the new backend.
- No fake zero, trend, total, terrain, region, or business record may fill an empty state.
- Coverage totals are returned by the new backend; the frontend never hardcodes `232` townships or `2,332` villages.
- Qiqihar statistics include the nine counties/county-level cities plus Meilisi only; the six other urban districts remain master data but are excluded from monitoring scope.
- `PRODUCTION` forms 产情脉络, `MARKET` forms 市场脉络, and `SUPPLY` plus `LOGISTICS` forms 供需平衡.
- Voice narration uses only the already displayed data and does not send business data to an external service.
- The overview route uses a full-viewport presentation shell; every other business route keeps the existing enterprise shell unchanged.
- Verification is risk-based; run the affected tests and gates once, then the complete release gate only at release-candidate time.

---

### Task 1: Deterministic narrative model

**Files:**

- Create: `src/modules/overview/ui/presentation/overviewNarrative.ts`
- Test: `src/modules/overview/ui/presentation/overviewNarrative.spec.ts`

**Interfaces:**

- Consumes: `OverviewIndicator`, selected region/product/period labels.
- Produces: `groupOverviewIndicators(indicators)` and `buildOverviewTranscript(context)`.

- [ ] **Step 1: Write failing grouping and transcript tests**

Assert that production and market remain separate, logistics joins the supply chapter, missing chapters say “当前条件下暂无已核定数据”, and the transcript contains only supplied values.

- [ ] **Step 2: Run the target test and confirm failure**

Run: `npm test -- --run src/modules/overview/ui/presentation/overviewNarrative.spec.ts`

Expected: FAIL because `overviewNarrative.ts` does not exist.

- [ ] **Step 3: Implement typed, pure presentation functions**

Define:

```ts
export type OverviewChapterCode = "PRODUCTION" | "MARKET" | "SUPPLY";

export interface OverviewChapter {
  code: OverviewChapterCode;
  label: string;
  indicators: readonly OverviewIndicator[];
}

export function groupOverviewIndicators(
  indicators: readonly OverviewIndicator[],
): readonly OverviewChapter[];

export function buildOverviewTranscript(context: {
  regionName?: string;
  productLabel: string;
  periodLabel?: string;
  chapters: readonly OverviewChapter[];
}): string;
```

The transcript must use `formatIndicatorValue` only for present values and must not infer totals or trends.

- [ ] **Step 4: Run the target test once and confirm pass**

Run the Task 1 command; expected all Task 1 tests pass.

### Task 2: Voice narration state machine

**Files:**

- Create: `src/modules/overview/ui/hooks/useOverviewNarration.ts`
- Test: `src/modules/overview/ui/hooks/useOverviewNarration.spec.tsx`

**Interfaces:**

- Consumes: current transcript string.
- Produces: `{ availability, state, start, pauseOrResume, stop }`, where state is `idle | speaking | paused | ended | error`.

- [ ] **Step 1: Write failing Web Speech adapter tests**

Provide a test `SpeechSynthesis` double and assert `zh-CN`, start, pause, resume, stop, transcript-change cancellation, and unmount cancellation. Assert unsupported browsers return `availability: "unsupported"` without throwing.

- [ ] **Step 2: Run the target test and confirm failure**

Run: `npm test -- --run src/modules/overview/ui/hooks/useOverviewNarration.spec.tsx`

Expected: FAIL because the hook does not exist.

- [ ] **Step 3: Implement the hook without global business state**

Create one `SpeechSynthesisUtterance` per start, set `lang = "zh-CN"`, rate `0.94`, and wire `onend`/`onerror`. Cancel on transcript change and cleanup. Never call a network API.

- [ ] **Step 4: Run the target test once and confirm pass**

Run the Task 2 command; expected all Task 2 tests pass.

### Task 3: Spatial presentation components

**Files:**

- Create: `src/modules/overview/ui/components/RegionNarrative.tsx`
- Create: `src/modules/overview/ui/components/RegionNarrative.spec.tsx`
- Modify: `src/modules/overview/ui/components/BoundaryMap.tsx`
- Modify: `src/modules/overview/ui/components/CesiumBoundaryMap.tsx`
- Modify: `src/modules/overview/ui/components/boundaryGeometry.ts`

**Interfaces:**

- Consumes: actual `MapFeature[]`, selection/drill callbacks, grouped chapters, transcript and narration controls.
- Produces: a keyboard-accessible map with an explicit `2D 兼容模式` status when WebGL/Cesium is unavailable, and a read-only narrative component.

- [ ] **Step 1: Write failing narrative and map-state tests**

Assert the narrative renders three chapters, source counts, empty chapter copy, transcript, and voice controls. Assert fallback uses the same parsed boundary geometry and exposes its compatibility status.

- [ ] **Step 2: Run both target tests and confirm the new expectations fail**

Run:

`npm test -- --run src/modules/overview/ui/components/RegionNarrative.spec.tsx src/modules/overview/ui/pages/OverviewPage.spec.tsx`

- [ ] **Step 3: Implement focused components and repair Cesium initialization**

Keep WebGL capability and Cesium-runtime failures distinct. Configure an alpha-capable Cesium context, render only backend polygons, fit the camera to those polygons, expose a renderer-ready callback, and use the SVG only when real WebGL/Cesium initialization fails. Do not place a permanent SVG below a working Cesium canvas.

- [ ] **Step 4: Run Task 3 tests once and confirm pass**

Run the Task 3 command; expected all Task 3 tests pass.

### Task 4: Approved overview composition

**Files:**

- Modify: `src/modules/overview/ui/pages/OverviewPage.tsx`
- Modify: `src/modules/overview/ui/pages/OverviewPage.spec.tsx`
- Modify: `src/app/styles/global.css`
- Modify: `src/app/App.tsx`

**Interfaces:**

- Consumes: repository results, `BoundaryMap`, pure narrative functions, `RegionNarrative`.
- Produces: the approved spatial presentation within the unchanged enterprise shell.

- [ ] **Step 1: Extend the page test with user flows**

Assert no indicators are requested before a region click; after clicking 黑河市, the response is grouped into 产情脉络、市场脉络、供需平衡; changing a filter clears the prior transcript; no formal period preserves the real map and uses an explicit readiness message.

- [ ] **Step 2: Run the page test and confirm failure**

Run: `npm test -- --run src/modules/overview/ui/pages/OverviewPage.spec.tsx`

- [ ] **Step 3: Implement the page and its design tokens**

Use a full-viewport overview presentation shell with an approximately `58%` map field, contextual narrative layer, continuous three-chapter lower rail, no cards or thick panel borders, and responsive vertical stacking below 960 px. Hide the enterprise top/side navigation only on the overview route. Ensure focus styles and reduced-motion handling.

- [ ] **Step 4: Run page and presentation tests once**

Run:

`npm test -- --run src/modules/overview/ui/pages/OverviewPage.spec.tsx src/modules/overview/ui/components/RegionNarrative.spec.tsx src/modules/overview/ui/hooks/useOverviewNarration.spec.tsx src/modules/overview/ui/presentation/overviewNarrative.spec.ts`

Expected: all affected tests pass.

### Task 5: Proportional verification and visual acceptance

**Files:**

- Modify only if a verified defect is found in Task 1–4 files.

**Interfaces:**

- Consumes: complete overview implementation.
- Produces: current build evidence and one browser acceptance record.

- [ ] **Step 1: Run static gates once**

Run: `npm run format:check`, `npm run lint`, `npm run architecture`, and `npm run build`.

Expected: all exit 0; architecture reports no cross-layer or cross-module violation.

- [ ] **Step 2: Inspect the formal page in the browser once at 1280×720 and one wide viewport**

Verify actual root labels are exactly 齐齐哈尔市、黑河市、呼伦贝尔市; map occupies only the spatial portion; lower content has no meaningless blank region; click changes narrative; voice controls change state; no business edit action exists.

- [ ] **Step 3: Re-run only the gate affected by any repair**

Do not repeat the entire suite for a CSS-only repair. Run the final full frontend verification only when this visual is accepted and becomes a release candidate.
