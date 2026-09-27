import { expect, it } from "vitest";
import { formatQuoteSourceAge, quoteSourceAgeSeconds } from "./quoteSourceAge";

it("uses the backend heartbeat age so browser clock skew cannot change quote age", () => {
  expect(quoteSourceAgeSeconds("2026-09-25T11:59:00Z", "2026-09-25T12:00:01Z", 8)).toBe(
    69,
  );
  expect(formatQuoteSourceAge(69)).toBe("1 分 9 秒");
  expect(formatQuoteSourceAge(3_661)).toBe("1 小时 1 分");
  expect(formatQuoteSourceAge(90_000)).toBe("1 天 1 小时");
});

it("does not invent an age when provenance or heartbeat timing is unverified", () => {
  expect(quoteSourceAgeSeconds("bad", "2026-09-25T12:00:01Z", 0)).toBeNull();
  expect(quoteSourceAgeSeconds("2026-09-25T12:00:00Z", null, 0)).toBeNull();
  expect(
    quoteSourceAgeSeconds("2026-09-25T12:00:02Z", "2026-09-25T12:00:01Z", 5),
  ).toBeNull();
  expect(
    quoteSourceAgeSeconds("2026-09-25T12:00:00Z", "2026-09-25T12:00:01Z", null),
  ).toBeNull();
  expect(formatQuoteSourceAge(null)).toBe("待核验");
});
