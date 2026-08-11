# Supply Period and Version History Implementation Plan

> **For agentic workers:** Execute inline in the three user-selected existing worktrees. Do not create another worktree, do not delegate, and do not touch production/market/logistics acceptance coverage.

**Goal:** Make the supply-demand loop addressable by required survey year plus nullable quarter and append-only so annual/quarterly snapshots and multiple revisions remain independently queryable after refresh.

**Architecture:** PostgreSQL owns the temporal invariant. Every new supply source, manual decision, confirmed input set, decision, calculation, and result version stores `survey_year`, nullable `survey_quarter`, and `YEAR/QUARTER` precision under a governed supply-period key; legacy rows retain their data with `PENDING_GOVERNANCE` when annual versus quarterly intent cannot be proven. The backend keeps marketing year separate, expands a year query to annual plus quarterly snapshots, limits a quarter query to that quarter, and both frontends use supply survey-period master data without manufacturing codes or dates.

**Tech Stack:** PostgreSQL/Flyway, Java 21/Spring Boot/JdbcClient, React/TypeScript/Vitest, Playwright/Chromium.

## Global Constraints

- Preserve all pre-existing uncommitted work in all three repositories.
- Do not hardcode period options or derive marketing years in clients.
- New period data must never overwrite another period; published results are immutable and revisions append a linked version.
- Do not rerun unrelated production, market, logistics, full-UI, or full-suite verification.
- Expand verification only when a shared primitive changes or direct evidence is insufficient, and state the reason first.

## Change to Risk to Minimum Verification

| Change                                       | Primary risk                                                                           | Minimum verification                                                                                                                                                |
| -------------------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V87 temporal/history migration               | loss or guessed annual/quarter assignment; migration fails on empty/existing databases | Flyway empty replay plus an existing-V86 ambiguous fixture; assert data retained, governance flags, nullable quarter, precision, and replay idempotence             |
| Survey-period append-only repository/service | annual/quarter overwrite, mutable published row, broken version chain                  | `SupplyAccountRestIntegrationTest` with annual, Q3, Q4 and two Q3 versions; assert year expansion, quarter exact read, predecessor link, immutable update rejection |
| Period/version HTTP contract                 | clients omit or invent period, lifecycle values drift                                  | targeted backend MockMvc test and both HTTP repository contract tests                                                                                               |
| Formal frontend period switch                | wrong period response shown, refresh loses selected historical context                 | targeted `SupplyAccountPage.spec.tsx` using two periods and delayed responses                                                                                       |
| Prototype frontend period switch             | marketing year fallback/hardcode, summary omits scope, history replaced                | targeted `RealtimeSupplyBalancePanel.spec.tsx` with two backend periods and two version lists                                                                       |
| Real stack behavior                          | unit mocks hide PostgreSQL/HTTP/browser mismatch                                       | one bounded PostgreSQL + HTTP + Chromium supply scenario covering two periods/two versions and console/HTTP errors                                                  |

## Task 1: Temporal Migration and Backend Contract

**Files:**

- Create: `/Users/federal/Desktop/cofco-qiqihar-enterprise-backend/src/main/resources/db/migration/V87__preserve_supply_period_and_revision_history.sql`
- Modify: supply application records, repository interface/implementation, service/controller, result state enum, and only supply/master-data integration tests.

- [x] Add failing migration and REST assertions for YEAR/QUARTER precision, annual/Q3/Q4 history, two Q3 versions, pending governance, and immutable published history.
- [x] Run only the named migration/REST test methods and confirm their expected failures.
- [x] Implement the additive migration, survey-period append-only persistence, lifecycle mapping, and version predecessor link.
- [x] Re-run the same named tests until green.

## Task 2: Formal Frontend Period History

**Files:**

- Modify: `/Users/federal/Desktop/cofco-qiqihar-enterprise-frontend/src/modules/supply-analysis/**`
- Modify: corresponding supply HTTP/page tests and `/Users/federal/Desktop/cofco-qiqihar-enterprise-frontend/src/app/App.tsx` only if dependency wiring is required.

- [x] Add tests proving backend-owned survey-period options, annual/quarter requests, unambiguous history selection, and stale-response protection.
- [x] Run only the supply page, supply HTTP, and supply-period master-data repository tests.
- [x] Implement survey fields, lifecycle labels, current-scope display, and period-scoped refresh.
- [x] Re-run the same targeted test files until green.

## Task 3: Prototype Frontend Period History

**Files:**

- Modify: `/Users/federal/Desktop/cofco-qiqihar-enterprise-web/src/platform/api/realtimeBusinessRepository.ts`
- Modify: `/Users/federal/Desktop/cofco-qiqihar-enterprise-web/src/prototype/realtime/RealtimeSupplyBalancePanel.tsx`
- Modify: their two targeted spec files only.

- [x] Add a test proving annual/Q3/Q4 master periods load independent history and the full current scope is visible.
- [x] Run only the repository and supply-balance panel spec files.
- [x] Remove generic-period/marketing-year fallbacks, pass the governed survey key through every supply operation, and preserve selected history.
- [x] Re-run the same two spec files until green.

## Task 4: Bounded Integration and Review

- [x] Run the two affected frontend typechecks; do not repeat production builds.
- [x] Start an isolated PostgreSQL/backend/frontend stack and run one supply-only Chromium path for annual/Q3/Q4 and two Q3 versions.
- [x] Capture HTTP and console error evidence; do not run unrelated E2E files.
- [x] Review only this task's file boundary and record deferred platform-wide temporal work.
