import { describe, expect, it } from "vitest";
import {
  formalSamplePointDetailSchema,
  isCategorizedFormalSamplePoint,
  presentFormalSnapshot,
} from "./formalSamplePointProjection";

describe("formal schematic placement", () => {
  it("maps display coordinates while preserving reported values", () => {
    const point = formalSamplePointDetailSchema.parse({
      data: {
        id: "fa120000-0000-0000-0000-000000000010",
        kindCode: "SURVEY_SITE",
        canonicalName: "区内示意样本",
        regionCode: "230202",
        objectTypeCode: "FARMER",
        objectTypeName: "农户",
        businessDomain: "PRODUCTION",
        address: "填报地址",
        approvalState: "APPROVED",
        locationState: "VALID",
        longitude: 125.94,
        latitude: 48.31,
        displayLongitude: 123.94,
        displayLatitude: 47.31,
        locationMode: "REGION_SCHEMATIC",
        effectiveFrom: "2026-01-01",
        effectiveTo: null,
        version: 0,
        annualObservationCount: 0,
        networkMembershipCount: 0,
      },
    }).data;
    if (!isCategorizedFormalSamplePoint(point))
      throw new Error("Expected categorized sample");
    const snapshot = presentFormalSnapshot([point], {
      regionCode: "230202",
      regionName: "龙沙区",
    });
    expect(snapshot.icons[0]).toMatchObject({
      longitude: 123.94,
      latitude: 47.31,
      locationMode: "REGION_SCHEMATIC",
    });
    expect(point.longitude).toBe(125.94);
    expect(snapshot.list.items).toHaveLength(1);
  });
});
