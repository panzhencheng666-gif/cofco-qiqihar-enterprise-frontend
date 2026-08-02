# Task 5 Round 7 Java int32 contract fix report

## Scope and scan

The fix changes only the formal enterprise frontend. The formal backend and every legacy repository remained read-only.

Repository-wide searches covered E2E fixtures, mock API routes, and query parsing/validation. They found two formal mock list parsers with Java-int32-equivalent responsibilities:

- `tests/e2e/fixtures/production-api.ts` used an ASCII-only signed parser while claiming to mirror Java integer parsing.
- `tests/e2e/fixtures/market-api.ts` independently used a stricter unsigned ASCII parser.

Both now import one implementation from `tests/e2e/support/java-int32.ts`. The `Number` conversions in `src/app/App.tsx` normalize already-decoded client hash state; they neither claim to mirror Java nor implement a mock backend contract, so they were intentionally left unchanged.

## Java 21 contract evidence

A JDK 21.0.12 probe scanned every Unicode code point for `Character.digit(codePoint, 10) == 0` and produced the committed decimal-zero table. Directed probes confirmed:

- full-width `１２` parses as 12;
- Arabic-Indic `١٢` parses as 12;
- encoded leading plus with full-width `+２０` parses as 20;
- superscript `²`, Roman numeral `Ⅻ`, exponent notation, and repeated signs are not decimal integer input.

The shared browser-safe parser iterates Unicode code points, maps only the JDK 21 decimal ranges, permits one leading ASCII sign, accumulates with `BigInt`, and returns a number only inside signed int32 range. Production and market fixtures apply their existing nonnegative page-number and configured page-size rules after parsing.

## TDD evidence

RED: the targeted Chromium run executed six tests. The production fixture returned 400 for all three new full-width/Arabic-Indic positive probes, and the market fixture returned 400 for both positive probes; the other four scenarios passed.

GREEN: after introducing the shared parser and removing both local parsers, the same targeted run passed 6/6. Browser fetch coverage now includes ASCII, encoded plus, full-width, Arabic-Indic, supplementary-plane decimal digits, maximum int32, exponent/decimal/NaN/Infinity, whitespace, sign-only/repeated-sign, non-decimal Unicode, and overflow. Existing unknown/missing/duplicate/blank key handling, `pageKind=MONITORING`, product/object whitelists, three-product DOM cases, and pending-write navigation races remain in the same gates.

## Fresh verification

- `npm run verify`: passed formatting, ESLint, dependency-cruiser (57 modules / 153 dependencies), concurrent read-only architecture probe, 15 Vitest files / 97 tests, TypeScript/Vite production build, and 10 Chromium tests.
- Targeted production-contract plus market E2E repeat: 18/18 passed with `--repeat-each=3`.
- Independent `npm run architecture`: passed with zero dependency violations and one read-only probe test.
- `npm audit --audit-level=high`: 0 vulnerabilities.
- Final diff and worktree checks are performed immediately before and after commit. No push is performed.
