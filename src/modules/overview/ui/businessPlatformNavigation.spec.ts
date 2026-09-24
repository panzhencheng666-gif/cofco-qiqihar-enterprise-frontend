import { describe, expect, it } from "vitest";
import {
  businessPlatformLedgerUrl,
  businessDirectoryUrl,
  businessModuleUrl,
} from "./businessPlatformNavigation";

describe("business platform navigation", () => {
  it("returns to the enterprise app, not the map server", () => {
    expect(businessDirectoryUrl("http://127.0.0.1:63200")).toBe(
      "http://127.0.0.1:63182/#/我的工作/我的任务",
    );
    expect(businessDirectoryUrl("https://8.141.28.149")).toBe(
      "https://8.141.28.149/workbench/#/我的工作/我的任务",
    );
    expect(businessModuleUrl("#/供需分析/供需平衡", "https://8.141.28.149")).toBe(
      "https://8.141.28.149/workbench/#/供需分析/供需平衡",
    );
  });
  it("leaves map actions on the confirmed enterprise workbench", () => {
    const businessPlatformUrl = new URL(businessPlatformLedgerUrl());
    expect(businessPlatformUrl.pathname).toBe("/");
    expect(decodeURIComponent(businessPlatformUrl.hash)).toBe("#/work/pending");
  });
});
