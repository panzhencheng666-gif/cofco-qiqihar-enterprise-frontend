import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

import type { OverviewRepository } from "../../application/ports/OverviewRepository";
import { OverviewPage } from "./OverviewPage";

describe("OverviewPage", () => {
  it("loads server-owned options, real boundary geometry and approved indicators", async () => {
    const regions = vi.fn<OverviewRepository["regions"]>(() =>
      Promise.resolve([sampleRegion]),
    );
    const indicators = vi.fn<OverviewRepository["indicators"]>(() =>
      Promise.resolve([sampleIndicator]),
    );
    render(
      <OverviewPage
        repository={{ options: () => Promise.resolve(options), regions, indicators }}
      />,
    );
    expect(await screen.findByRole("heading", { name: "粮食商情总览" })).toBeVisible();
    expect(await screen.findByRole("img", { name: "行政区边界地图" })).toBeVisible();
    await waitFor(() =>
      expect(indicators).toHaveBeenCalledWith(
        expect.objectContaining({ regionCode: "230200" }),
      ),
    );
    expect(screen.getByText("核定播种面积")).toBeVisible();
    expect(screen.getByText("10")).toBeVisible();
    await userEvent.setup().type(screen.getByLabelText("市场年度"), "2026/27");
    await waitFor(() =>
      expect(indicators).toHaveBeenLastCalledWith(
        expect.objectContaining({ marketingYear: "2026/27" }),
      ),
    );
  });
});

const options = {
  products: [{ code: "CORN", label: "玉米" }],
  periods: [
    {
      code: "2026-Q3",
      label: "2026年第三季度",
      startsOn: "2026-07-01",
      endsOn: "2026-09-30",
    },
  ],
} as const;
const sampleRegion = {
  code: "230200",
  name: "齐齐哈尔市",
  level: "PREFECTURE" as const,
  approvedRecordCount: 1,
  boundaryGeoJson: JSON.stringify({
    type: "Polygon",
    coordinates: [
      [
        [123, 47],
        [124, 47],
        [124, 48],
        [123, 47],
      ],
    ],
  }),
};
const sampleIndicator = {
  code: "PRODUCTION_CULTIVATED_AREA",
  name: "核定播种面积",
  unitCode: "亩",
  value: "10",
  sourceDomain: "PRODUCTION" as const,
  sourceCount: 1,
  sourcePath: "/api/v1/production-records",
};
