import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { RegionalRailwayPanel } from "./RegionalRailwayPanel";

it("separates local facilities from neighbouring reference stations and preserves sources", () => {
  render(
    <RegionalRailwayPanel
      regionName="龙镇"
      railway={{
        regionCode: "231182101",
        boundaryAvailable: true,
        sourceAsOf: "2026-09-15T05:06:23Z",
        facilities: [
          {
            sourceId: "node/1",
            name: "龙镇",
            kind: "station",
            longitude: 126.7,
            latitude: 48.6,
            operator: "铁路公司",
            reference: "59696",
            status: "运营情况待核验",
            service: "业务范围待核验",
            locationRelation: "WITHIN",
            distanceKm: 0,
            nearbyLines: "北黑铁路",
            sourceUrl: "https://www.openstreetmap.org/node/1",
          },
          {
            sourceId: "node/2",
            name: "邻区站",
            kind: "station",
            longitude: 126.8,
            latitude: 48.7,
            operator: "",
            reference: "",
            status: "地图标注停用",
            service: "业务范围待核验",
            locationRelation: "NEARBY",
            distanceKm: 3.2,
            nearbyLines: "北黑铁路",
            sourceUrl: "https://www.openstreetmap.org/node/2",
          },
        ],
        lines: [
          {
            name: "北黑铁路",
            mappedTrackKm: 12.3,
            usage: "main",
            electrification: "no",
            gauge: "1435",
            operator: "铁路公司",
            sourceUrl: "https://www.openstreetmap.org/way/3",
          },
        ],
      }}
    />,
  );
  expect(screen.getByRole("link", { name: "查看龙镇地图来源" })).toHaveAttribute(
    "href",
    "https://www.openstreetmap.org/node/1",
  );
  expect(screen.queryByText("邻区站")).not.toBeInTheDocument();
  expect(screen.getByText(/地图轨道长度/)).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: /邻近设施/ }));
  expect(screen.getByText("邻区站")).toBeVisible();
  expect(screen.getByText(/距所选地区边界 3.2 公里/)).toBeVisible();
  expect(screen.getByText(/地图标注停用/)).toBeVisible();
});

it("does not claim zero stations when local boundary or catalogue is unavailable", () => {
  render(
    <RegionalRailwayPanel
      regionName="某村"
      railway={{
        regionCode: "230221100001",
        boundaryAvailable: false,
        sourceAsOf: null,
        facilities: [],
        lines: [],
      }}
    />,
  );
  expect(screen.getByText(/缺少本级边界/)).toBeVisible();
  expect(screen.queryByText(/0 个站/)).not.toBeInTheDocument();
});
