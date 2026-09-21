import { expect, it } from "vitest";
import type { OverviewRegion } from "../../domain/overview";
import { searchPublicRegions } from "./publicRegionSearchModel";

const region = (
  code: string,
  name: string,
  level: OverviewRegion["level"],
  parentCode?: string,
): OverviewRegion => ({
  code,
  name,
  level,
  ...(parentCode ? { parentCode } : {}),
  approvedRecordCount: null,
});
const root = region("1", "齐齐哈尔市", "PREFECTURE");
const rows = [
  root,
  region("11", "依安县", "COUNTY", "1"),
  region("111", "新兴镇", "TOWNSHIP", "11"),
  region("1111", "兴福村", "VILLAGE", "111"),
  region("12", "克山县", "COUNTY", "1"),
  region("121", "新兴镇", "TOWNSHIP", "12"),
  region("9", "范围外", "COUNTY", "8"),
];

it("distinguishes duplicate names with full ancestor paths and excludes outside rows", () => {
  expect(
    searchPublicRegions(rows, [root], "新兴", "TOWNSHIP").matches.map(
      (item) => item.path,
    ),
  ).toEqual(["齐齐哈尔市 / 依安县 / 新兴镇", "齐齐哈尔市 / 克山县 / 新兴镇"]);
  expect(searchPublicRegions(rows, [root], "范围外", "ALL").total).toBe(0);
});
it("searches parent names, filters levels and caps visible results", () => {
  const result = searchPublicRegions(rows, [root], " 齐齐哈尔 ", "TOWNSHIP", 1);
  expect(result.total).toBe(2);
  expect(result.matches).toHaveLength(1);
  expect(searchPublicRegions(rows, [root], "兴福", "VILLAGE").matches[0]?.path).toBe(
    "齐齐哈尔市 / 依安县 / 新兴镇 / 兴福村",
  );
});

it("ranks exact region names before earlier inserted descendant path matches before limiting", () => {
  const county = region("21", "阿荣旗", "COUNTY", "1");
  const town = region("211", "那吉镇", "TOWNSHIP", "21");
  const village = region("2111", "向阳村", "VILLAGE", "211");
  const result = searchPublicRegions(
    [root, town, village, county],
    [root],
    "阿荣旗",
    "ALL",
    1,
  );
  expect(result.total).toBe(3);
  expect(result.matches[0]?.region.code).toBe(county.code);
});
