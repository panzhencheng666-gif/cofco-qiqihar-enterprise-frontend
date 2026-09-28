import { describe, expect, it } from "vitest";
import {
  beijingCalendarDay,
  isNewsPublishedToday,
  newsPublicationLabel,
} from "./newsTime";

describe("source publication time in Beijing", () => {
  it("uses the Beijing date across UTC midnight", () => {
    expect(beijingCalendarDay(new Date("2026-09-27T16:30:00Z"))).toBe("2026-09-28");
    expect(isNewsPublishedToday("2026-09-28", new Date("2026-09-27T16:30:00Z"))).toBe(
      true,
    );
    expect(isNewsPublishedToday("2026-09-27", new Date("2026-09-27T16:30:00Z"))).toBe(
      false,
    );
  });

  it("does not manufacture a clock time for date-only sources", () => {
    expect(
      newsPublicationLabel({
        publishedAt: "2026-09-27T00:00:00Z",
        publishedOn: "2026-09-27",
        publicationPrecision: "date",
      }),
    ).toBe("2026-09-27 · 来源仅提供日期");
    expect(
      newsPublicationLabel({
        publishedAt: "2026-09-27T16:30:00Z",
        publishedOn: "2026-09-28",
        publicationPrecision: "instant",
      }),
    ).toContain("2026/09/28 00:30");
  });
});
