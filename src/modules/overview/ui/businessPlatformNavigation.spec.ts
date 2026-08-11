import { describe, expect, it } from "vitest";
import { businessPlatformLedgerUrl } from "./businessPlatformNavigation";

describe("business platform navigation", () => {
  it("leaves map actions on the confirmed enterprise workbench", () => {
    const businessPlatformUrl = new URL(businessPlatformLedgerUrl());
    expect(businessPlatformUrl.pathname).toBe("/");
    expect(decodeURIComponent(businessPlatformUrl.hash)).toBe("#/work/pending");
  });
});
