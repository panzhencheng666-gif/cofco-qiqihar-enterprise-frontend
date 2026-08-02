# Task 5 Round 7 Java int32 contract fix plan

> **For agentic workers:** Execute inline with test-driven development. Do not modify the backend or any legacy repository.

**Goal:** Make every formal E2E list fixture use one browser-safe parser that exactly mirrors Java 21 `Integer.parseInt` digit, sign, and int32 range semantics before applying endpoint-specific pagination rules.

**Architecture:** `tests/e2e/support/java-int32.ts` owns the Java 21 decimal digit table and parser. Production and market fixtures import it; their existing key, multiplicity, blank, page-kind, product, object-type, and page-size whitelist checks remain endpoint-owned and fail closed.

**Tech stack:** TypeScript 5.9, Playwright 1.62.1, Chromium, Java 21.0.12 probe, Vitest 4.1.10.

## Global constraints

- Edit only `/Users/federal/Desktop/cofco-qiqihar-enterprise-frontend`.
- Use Java 21 `Character.digit(codePoint, 10)` semantics, including supplementary-plane code points.
- Accept one leading ASCII `+` or `-`; reject empty input, sign-only input, invalid code points, repeated signs, and values outside signed int32.
- Preserve every existing fail-closed list-query validation.
- Do not push.

### Task 1: Prove the missing Java digit behavior

**Files:**

- Modify: `tests/e2e/production-api-contract.e2e.ts`
- Modify: `tests/e2e/market-monitoring.e2e.ts`

- [ ] Add browser-originated successful list requests using full-width digits (`１２`) and Arabic-Indic digits (`١٢`), including an encoded leading plus sign.
- [ ] Preserve ordinary, max-int, malformed lexical, sign, negative semantic, and overflow probes.
- [ ] Run the targeted Chromium tests and record the expected 400-vs-200 RED failure.

### Task 2: Centralize exact Java 21 int32 parsing

**Files:**

- Create: `tests/e2e/support/java-int32.ts`
- Modify: `tests/e2e/fixtures/production-api.ts`
- Modify: `tests/e2e/fixtures/market-api.ts`

- [ ] Generate and verify decimal-zero code points with JDK 21.0.12 by scanning `Character.digit(cp, 10) == 0`.
- [ ] Implement `parseJavaInt32(value: string | null | undefined): number | undefined` by iterating Unicode code points, mapping only Java 21 decimal ranges, accumulating with `BigInt`, and enforcing `[-2147483648, 2147483647]`.
- [ ] Replace both fixture-local integer parsers with the shared parser; retain nonnegative page-number and formal page-size checks.
- [ ] Run the targeted Chromium tests and confirm GREEN.

### Task 3: Verify and deliver

**Files:**

- Create: `.superpowers/sdd/task-5-round7-java-int32-fix-report.md`

- [ ] Run `npm run verify`.
- [ ] Run the relevant Playwright contract and market tests with `--repeat-each=3`.
- [ ] Run `npm audit`, `npm run architecture`, and `git diff --check`.
- [ ] Review the final diff for duplicated parsers or weakened fail-closed checks.
- [ ] Write the SDD report with RED/GREEN and final evidence, commit on `codex/formal-rebuild`, and confirm `git status --porcelain` is empty.
