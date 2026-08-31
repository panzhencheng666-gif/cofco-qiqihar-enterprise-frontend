import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

import { OverviewSampleNetworkToolbar } from "./OverviewSampleNetworkToolbar";

describe("OverviewSampleNetworkToolbar", () => {
  it("exports the same formal sample inventory without adding a review step", async () => {
    const onExport = vi.fn();
    render(
      <OverviewSampleNetworkToolbar
        model={{
          applicable: true,
          catalog: undefined,
          catalogState: "idle",
          categoryCode: undefined,
          comparison: undefined,
          designPoints: [],
          designPointState: "idle",
          icons: [],
          issue: undefined,
          mode: "actual",
          region: undefined,
          setCategoryCode: vi.fn(),
          setMode: vi.fn(),
          setShowExactDesignLocations: vi.fn(),
          setTypeCode: vi.fn(),
          showExactDesignLocations: false,
          state: "ready",
          typeCode: undefined,
        }}
        onExport={onExport}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "导出正式样本清单" }));
    expect(onExport).toHaveBeenCalledTimes(1);
  });

  it("keeps the three map layers in one persistent control", async () => {
    const setMode = vi.fn();
    render(
      <OverviewSampleNetworkToolbar
        model={{
          applicable: true,
          catalog: undefined,
          catalogState: "idle",
          categoryCode: undefined,
          comparison: undefined,
          designPoints: [],
          designPointState: "idle",
          icons: [],
          issue: undefined,
          mode: "comparison",
          region: { code: "230231100", level: "TOWNSHIP", name: "兴农镇" },
          setCategoryCode: vi.fn(),
          setMode,
          setShowExactDesignLocations: vi.fn(),
          setTypeCode: vi.fn(),
          showExactDesignLocations: false,
          state: "loading",
          typeCode: undefined,
        }}
      />,
    );

    expect(screen.getByRole("button", { name: "对照显示" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await userEvent.click(screen.getByRole("button", { name: "设计样本" }));
    await waitFor(() => expect(setMode).toHaveBeenCalledWith("design"));
    expect(screen.getByRole("button", { name: "设计样本" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "对照显示" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(screen.getByText("正在同步样本网络")).toBeVisible();
  });

  it("keeps every selected year on the same sample and annual-layer contract", () => {
    render(
      <OverviewSampleNetworkToolbar
        model={{
          applicable: true,
          catalog: {
            regionCode: "230200",
            totalCount: 3,
            validCoordinateCount: 2,
            dataQualityIssueCount: 1,
            correctionSourceCount: 0,
            unresolvedSourceCount: 0,
            categories: [],
            items: [],
            correctionSources: [],
          },
          catalogState: "ready",
          categoryCode: undefined,
          comparison: {
            networkYear: 2024,
            networkStatus: "NOT_CREATED",
            designPointCount: 0,
            designCoordinateCount: 0,
            activeSamplePointCount: 3,
            approvedSubmissionSamplePointCount: 3,
            pendingVerificationDesignPointCount: 0,
            multipleActualPerDesignPointCount: 0,
            anomalyCount: 0,
            exactCoveredDesignPointCount: 0,
            representedDesignPointCount: 0,
            regionalAssociationDesignPointCount: 0,
            unrelatedDesignPointCount: 0,
            actualLevelCounts: {
              prefecture: 0,
              county: 0,
              township: 0,
              village: 3,
            },
            designPoints: [],
            actualPoints: [],
            relations: [],
          },
          designPoints: [],
          designPointState: "ready",
          icons: [],
          issue: undefined,
          mode: "comparison",
          region: { code: "230281", level: "COUNTY", name: "讷河市" },
          setCategoryCode: vi.fn(),
          setMode: vi.fn(),
          setShowExactDesignLocations: vi.fn(),
          setTypeCode: vi.fn(),
          showExactDesignLocations: false,
          state: "ready",
          typeCode: undefined,
        }}
      />,
    );

    expect(
      screen.queryByText(/固定设计样本|正式样本 3|地图按乡镇汇总/u),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "现有样本" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "对照显示" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "设计样本" })).toBeEnabled();
  });

  it("keeps the prefecture toolbar business-facing without implementation guidance", () => {
    render(
      <OverviewSampleNetworkToolbar
        model={{
          applicable: true,
          catalog: {
            regionCode: "230200",
            totalCount: 674,
            validCoordinateCount: 674,
            dataQualityIssueCount: 0,
            correctionSourceCount: 0,
            unresolvedSourceCount: 0,
            categories: [],
            items: [],
            correctionSources: [],
          },
          catalogState: "ready",
          categoryCode: undefined,
          comparison: {
            networkYear: 2026,
            networkStatus: "PUBLISHED",
            designPointCount: 2332,
            designCoordinateCount: 2332,
            activeSamplePointCount: 674,
            approvedSubmissionSamplePointCount: 674,
            pendingVerificationDesignPointCount: 2332,
            multipleActualPerDesignPointCount: 0,
            anomalyCount: 0,
            exactCoveredDesignPointCount: 0,
            representedDesignPointCount: 0,
            regionalAssociationDesignPointCount: 0,
            unrelatedDesignPointCount: 2332,
            actualLevelCounts: {
              prefecture: 0,
              county: 0,
              township: 0,
              village: 674,
            },
            designPoints: [],
            actualPoints: [],
            relations: [],
          },
          designPoints: [],
          designPointState: "ready",
          icons: [],
          issue: undefined,
          mode: "comparison",
          region: { code: "230200", level: "PREFECTURE", name: "齐齐哈尔市" },
          setCategoryCode: vi.fn(),
          setMode: vi.fn(),
          setShowExactDesignLocations: vi.fn(),
          setTypeCode: vi.fn(),
          showExactDesignLocations: false,
          state: "ready",
          typeCode: undefined,
        }}
      />,
    );

    expect(
      screen.queryByText(/固定设计样本|正式样本 674|地图按区县汇总/u),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "现有样本" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "设计样本" })).toBeEnabled();
  });
});
