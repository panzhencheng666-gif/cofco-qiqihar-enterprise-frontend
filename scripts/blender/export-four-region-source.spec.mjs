import assert from "node:assert/strict";
import test from "node:test";

import { normalizeRootRegions } from "./export-four-region-source.mjs";

const boundary = JSON.stringify({
  type: "Polygon",
  coordinates: [
    [
      [123, 46],
      [124, 46],
      [124, 47],
      [123, 46],
    ],
  ],
});

function rootRegion(code, name, overrides = {}) {
  return {
    boundaryGeoJson: boundary,
    code,
    level: "PREFECTURE",
    mapContextOnly: false,
    name,
    ...overrides,
  };
}

test("exports exactly the governed four regions in stable order", () => {
  const collection = normalizeRootRegions({
    data: [
      rootRegion("232700", "大兴安岭地区"),
      rootRegion("150700", "呼伦贝尔市"),
      rootRegion("231100", "黑河市"),
      rootRegion("230200", "齐齐哈尔市"),
    ],
  });

  assert.equal(collection.type, "FeatureCollection");
  assert.deepEqual(
    collection.features.map((feature) => feature.properties.code),
    ["230200", "231100", "150700", "232700"],
  );
  assert.equal(collection.features[0].geometry.type, "Polygon");
});

test("rejects missing or context-only prefectures", () => {
  assert.throws(
    () => normalizeRootRegions({ data: [] }),
    /expected four governed regions, received 0/,
  );
  assert.throws(
    () =>
      normalizeRootRegions({
        data: [
          rootRegion("230200", "齐齐哈尔市", { mapContextOnly: true }),
          rootRegion("231100", "黑河市"),
          rootRegion("150700", "呼伦贝尔市"),
          rootRegion("232700", "大兴安岭地区"),
        ],
      }),
    /expected four governed regions, received 3/,
  );
});

test("rejects malformed or non-polygon administrative geometry", () => {
  const otherRegions = [
    rootRegion("231100", "黑河市"),
    rootRegion("150700", "呼伦贝尔市"),
    rootRegion("232700", "大兴安岭地区"),
  ];

  assert.throws(
    () =>
      normalizeRootRegions({
        data: [
          rootRegion("230200", "齐齐哈尔市", { boundaryGeoJson: "not-json" }),
          ...otherRegions,
        ],
      }),
    /invalid boundary JSON for 230200/,
  );
  assert.throws(
    () =>
      normalizeRootRegions({
        data: [
          rootRegion("230200", "齐齐哈尔市", {
            boundaryGeoJson: JSON.stringify({ type: "Point", coordinates: [123, 46] }),
          }),
          ...otherRegions,
        ],
      }),
    /invalid boundary geometry for 230200/,
  );
});
