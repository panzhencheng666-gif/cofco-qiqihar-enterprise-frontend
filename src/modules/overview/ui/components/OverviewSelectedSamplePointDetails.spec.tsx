import { render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";

import type { OverviewSamplePointRepository } from "../../application/ports/OverviewSamplePointRepository";
import { OverviewSelectedSamplePointDetails } from "./OverviewSelectedSamplePointDetails";

describe("OverviewSelectedSamplePointDetails", () => {
  it("loads only the selected sample's governed business detail", async () => {
    const detail = vi.fn<OverviewSamplePointRepository["detail"]>(() =>
      Promise.resolve({
        samplePointId: "94000000-0000-0000-0000-000000000001",
        name: "兴农村农户样本",
        regionCode: "230231100001",
        regionName: "兴农村",
        locationState: "VALID",
        dataQualityReason: null,
        roles: [{ code: "PRODUCTION", name: "产情类", iconKey: "production" }],
        associations: [
          {
            categoryCode: "PRODUCTION",
            categoryName: "产情类",
            sourceRole: "SURVEY",
            typeCode: "FARMER",
            typeName: "农户",
            productCode: "CORN",
            productName: "玉米",
            occurrenceDate: "2026-08-05",
            sourceVersion: 2,
            businessValues: {
              CULTIVATED_AREA_MU: {
                label: "种植面积",
                value: "120",
                unitCode: "亩",
              },
            },
          },
        ],
      }),
    );
    const repository = {
      aggregates: vi.fn(),
      comparison: vi.fn(),
      list: vi.fn(),
      icons: vi.fn(),
      detail,
    } as unknown as OverviewSamplePointRepository;

    render(
      <OverviewSelectedSamplePointDetails
        categoryCode="PRODUCTION"
        icon={{
          samplePointId: "94000000-0000-0000-0000-000000000001",
          name: "兴农村农户样本",
          iconKey: "production",
          roles: [{ code: "PRODUCTION", name: "产情类", iconKey: "production" }],
          types: [{ code: "FARMER", name: "农户", iconKey: "farmer" }],
          longitude: 123.5,
          latitude: 47.5,
          dataQualityReason: null,
        }}
        productCode="CORN"
        regionCode="230200"
        repository={repository}
        year={2026}
      />,
    );

    expect(await screen.findByText("兴农村农户样本")).toBeVisible();
    expect(screen.getByText("产情类 · 农户 · 兴农村")).toBeVisible();
    expect(
      document.querySelector(".overview-selected-sample-point-role-icons img"),
    ).toHaveAttribute("src", expect.stringContaining("production-rice.svg"));
    expect(
      document.querySelector(".overview-selected-sample-point-role-icons"),
    ).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByText("种植面积")).toBeVisible();
    expect(screen.getByText("120 亩")).toBeVisible();
    expect(
      screen.getByText("审核来源历史：调研填报 · 业务日期 2026年8月5日 · 第2版"),
    ).toBeVisible();
    await waitFor(() =>
      expect(detail).toHaveBeenCalledWith({
        categoryCode: "PRODUCTION",
        productCode: "CORN",
        regionCode: "230200",
        samplePointId: "94000000-0000-0000-0000-000000000001",
        year: 2026,
      }),
    );
  });

  it("shows retirement metadata and the last maintained business snapshot", async () => {
    const historicalDetail = vi.fn(() =>
      Promise.resolve({
        samplePointId: "94000000-0000-0000-0000-000000000001",
        name: "兴农村历史农户样本",
        regionCode: "230231100001",
        retiredAt: "2026-09-04T01:30:00Z",
        retirementYear: 2026,
        retirementReason: "年度样本调整",
        retiredBy: "production-tester",
        roles: [
          {
            code: "PRODUCTION" as const,
            name: "产情类",
            iconKey: "production" as const,
          },
        ],
        lastBusinessData: [
          {
            categoryCode: "PRODUCTION" as const,
            categoryName: "产情类",
            sourceRole: "SURVEY" as const,
            typeCode: "FARMER",
            typeName: "农户",
            productCode: "CORN",
            productName: "玉米",
            occurrenceDate: "2026-08-05",
            sourceVersion: 2,
            businessValues: {
              CULTIVATED_AREA_MU: {
                label: "种植面积",
                value: "120",
                unitCode: "亩",
              },
            },
          },
        ],
      }),
    );
    const currentDetail = vi.fn();
    const repository = {
      aggregates: vi.fn(),
      comparison: vi.fn(),
      list: vi.fn(),
      icons: vi.fn(),
      detail: currentDetail,
      historicalDetail,
    } as unknown as OverviewSamplePointRepository;

    render(
      <OverviewSelectedSamplePointDetails
        historical
        icon={{
          samplePointId: "94000000-0000-0000-0000-000000000001",
          name: "兴农村历史农户样本",
          iconKey: "farmer",
          roles: [{ code: "PRODUCTION", name: "产情类", iconKey: "production" }],
          types: [{ code: "FARMER", name: "农户", iconKey: "farmer" }],
          longitude: 123.5,
          latitude: 47.5,
          dataQualityReason: null,
        }}
        productCode="CORN"
        regionCode="230200"
        repository={repository}
        year={2026}
      />,
    );

    expect(await screen.findByText("淘汰时间：2026年9月4日")).toBeVisible();
    expect(screen.getByText("淘汰原因：年度样本调整")).toBeVisible();
    expect(screen.getByRole("heading", { name: "最后一次维护快照" })).toBeVisible();
    expect(screen.getByText("种植面积")).toBeVisible();
    expect(screen.getByText("120 亩")).toBeVisible();
    expect(historicalDetail).toHaveBeenCalledWith({
      productCode: "CORN",
      regionCode: "230200",
      samplePointId: "94000000-0000-0000-0000-000000000001",
      year: 2026,
    });
    expect(currentDetail).not.toHaveBeenCalled();
  });
});
