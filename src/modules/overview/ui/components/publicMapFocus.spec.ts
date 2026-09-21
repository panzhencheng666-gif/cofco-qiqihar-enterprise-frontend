import { describe, expect, it } from "vitest";
import { publicMapFocus } from "./publicMapFocus";
import type { OverviewRegion } from "../../domain/overview";

const village: OverviewRegion = {
  code: "v",
  name: "村",
  level: "VILLAGE",
  approvedRecordCount: null,
  locationGeoJson: '{"type":"Point","coordinates":[123,48]}',
  boundaryGeoJson:
    '{"type":"Polygon","coordinates":[[[120,40],[130,40],[130,50],[120,40]]]}',
};
describe("public map search camera", () => {
  it("uses the village point, never its generated polygon", () => {
    const focus = publicMapFocus(village)!;
    expect(focus.minLongitude).toBeGreaterThan(122.9);
    expect(focus.maxLongitude).toBeLessThan(123.1);
  });
  it("fits real administrative geometry for counties", () => {
    expect(publicMapFocus({ ...village, level: "COUNTY" })).toEqual({
      minLongitude: 120,
      maxLongitude: 130,
      minLatitude: 40,
      maxLatitude: 50,
    });
  });
  it("does not fabricate a village location without a valid point", () => {
    expect(
      publicMapFocus({
        ...village,
        locationGeoJson: '{"type":"Point","coordinates":[999,48]}',
      }),
    ).toBeUndefined();
  });
});
