import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type ComponentProps, useState } from "react";
import { describe, expect, it, vi } from "vitest";

import type { OverviewSamplePointRepository } from "../../application/ports/OverviewSamplePointRepository";
import type { OverviewSamplePointIcon } from "../../domain/overviewSamplePoint";
import { OverviewSamplePointPanel } from "./OverviewSamplePointPanel";

const list = {
  regionCode: "230202997001",
  totalCount: 1,
  validCoordinateCount: 1,
  dataQualityIssueCount: 0,
  correctionSourceCount: 0,
  unresolvedSourceCount: 0,
  categories: [
    {
      code: "PRODUCTION" as const,
      name: "产情类",
      count: 1,
      types: [{ code: "FARMER", name: "农户", iconKey: "farmer", count: 1 }],
    },
    {
      code: "MARKET" as const,
      name: "市场类",
      count: 1,
      types: [{ code: "TRADER", name: "贸易商", iconKey: "trader", count: 1 }],
    },
  ],
  items: [
    {
      samplePointId: "94000000-0000-0000-0000-000000000001",
      name: "同一跨产品样本点",
      regionCode: "230202997001",
      regionName: "契约测试村",
      locationState: "VALID",
      dataQualityReason: null,
      categories: [{ code: "PRODUCTION" as const, name: "产情类" }],
      types: [{ code: "FARMER", name: "农户", iconKey: "farmer" }],
      products: [{ code: "CORN", name: "玉米" }],
      latestBusinessDate: "2026-08-05",
      summaryValues: {
        SAMPLE_CONTACT: {
          label: "样本点联系方式",
          value: "13900000000",
          unitCode: null,
        },
        SURVEYOR_NAME: { label: "调研人", value: "王雷", unitCode: null },
        SURVEYOR_PHONE: {
          label: "调研人联系方式",
          value: "13800000000",
          unitCode: null,
        },
        CULTIVATED_AREA_MU: { label: "种植面积", value: "10", unitCode: "亩" },
      },
    },
  ],
  correctionSources: [],
};

describe("OverviewSamplePointPanel", () => {
  it("keeps category, scrollable list, and business information as separate sections", async () => {
    render(
      <PanelHarness
        onIconsChange={vi.fn()}
        year={2026}
        region={{ code: "230202997", level: "TOWNSHIP", name: "契约测试乡" }}
        repository={repositoryStub()}
      />,
    );

    expect(await screen.findByRole("heading", { name: "样本点分类" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "样本点列表" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "样本点业务信息" })).toBeVisible();
    expect(screen.getByLabelText("样本点列表")).toHaveClass(
      "overview-sample-point-list",
    );
  });

  it("shows category counts but no concrete result before a category is selected", async () => {
    const repository = repositoryStub();
    const onIconsChange = vi.fn<(icons: readonly OverviewSamplePointIcon[]) => void>();

    render(
      <PanelHarness
        onIconsChange={onIconsChange}
        year={2026}
        region={{ code: "230202", level: "COUNTY", name: "龙沙区" }}
        repository={repository}
      />,
    );

    expect(await screen.findByRole("button", { name: "产情类 1" })).toBeVisible();
    expect(screen.queryByText("同一跨产品样本点")).not.toBeInTheDocument();
    expect(screen.getByText("请选择分类后查看 1 个样本点")).toBeVisible();
    expect(repository.icons).not.toHaveBeenCalled();
    expect(repository.detail).not.toHaveBeenCalled();
    expect(onIconsChange).toHaveBeenCalledWith([]);
  });

  it("shows every drawable entity and explains coordinate warnings in the active filter", async () => {
    const qualityItems = (
      [
        ["94000000-0000-0000-0000-000000000011", "贸易商甲", "TRADER", "贸易商"],
        ["94000000-0000-0000-0000-000000000012", "贸易商乙", "TRADER", "贸易商"],
        ["94000000-0000-0000-0000-000000000013", "饲料厂丙", "FEED_MILL", "饲料厂"],
      ] as const
    ).map(([samplePointId, name, code, typeName]) => ({
      samplePointId,
      name,
      regionCode: "230208",
      regionName: "梅里斯达斡尔族区",
      locationState: "VALID",
      dataQualityReason: "DUPLICATE_COORDINATE_UNVERIFIED",
      categories: [{ code: "MARKET" as const, name: "市场类" }],
      types: [
        { code, name: typeName, iconKey: code === "TRADER" ? "trader" : "feed-mill" },
      ],
      products: [{ code: "CORN", name: "玉米" }],
      latestBusinessDate: "2026-08-05",
      summaryValues: {},
    }));
    const qualityList = {
      ...list,
      totalCount: 3,
      validCoordinateCount: 0,
      dataQualityIssueCount: 3,
      correctionSourceCount: 0,
      unresolvedSourceCount: 3,
      categories: [
        { code: "PRODUCTION" as const, name: "产情类", count: 0, types: [] },
        {
          code: "MARKET" as const,
          name: "市场类",
          count: 3,
          types: [
            { code: "TRADER", name: "贸易商", iconKey: "trader", count: 2 },
            { code: "FEED_MILL", name: "饲料厂", iconKey: "feed-mill", count: 1 },
          ],
        },
      ],
      items: qualityItems,
    };
    const repository = repositoryStub();
    const publishedNetwork = await repository.comparison({
      productCode: "CORN",
      regionCode: "230208997",
      year: 2026,
    });
    repository.comparison.mockClear();
    repository.comparison.mockResolvedValue({
      ...publishedNetwork,
      activeSamplePointCount: qualityItems.length,
      actualPoints: qualityItems.map((item) => ({
        samplePointId: item.samplePointId,
        samplePointName: item.name,
        samplePointKindCode: item.types[0]!.code,
        membershipStatusCode: "ACTIVE",
        locatedRegionCode: item.regionCode,
        locatedRegionName: item.regionName,
        locatedRegionLevel: "COUNTY",
        actualLongitude: 123.5,
        actualLatitude: 47.5,
        locationState: "VALID",
      })),
    });
    repository.list.mockResolvedValue(qualityList);
    repository.icons.mockResolvedValue(
      qualityItems.map((item) => ({
        samplePointId: item.samplePointId,
        name: item.name,
        iconKey: item.types[0]!.iconKey,
        types: item.types,
        longitude: 123.5,
        latitude: 47.5,
        dataQualityReason: "DUPLICATE_COORDINATE_UNVERIFIED",
      })),
    );
    repository.detail.mockResolvedValue({
      samplePointId: qualityItems[0]!.samplePointId,
      name: qualityItems[0]!.name,
      regionCode: "230208",
      regionName: "梅里斯达斡尔族区",
      locationState: "VALID",
      dataQualityReason: "DUPLICATE_COORDINATE_UNVERIFIED",
      associations: [],
    });

    render(
      <PanelHarness
        onIconsChange={vi.fn()}
        year={2026}
        region={{ code: "230208997", level: "TOWNSHIP", name: "契约测试乡" }}
        repository={repository}
      />,
    );

    expect(await screen.findByText("请选择分类后查看 3 个样本点")).toBeVisible();
    expect(screen.getByRole("button", { name: "产情类 0" })).toBeDisabled();

    await userEvent.click(screen.getByRole("button", { name: "市场类 3" }));
    expect(
      await screen.findByText("精确业务图标 3 个，其中 3 个坐标重合待核验"),
    ).toBeVisible();
    expect(await screen.findByText("贸易商甲")).toBeVisible();
    expect(screen.getByText("贸易商乙")).toBeVisible();
    expect(screen.getByText("饲料厂丙")).toBeVisible();
    expect(
      within(screen.getByRole("button", { name: /贸易商甲/ })).getByText(
        "地图已显示 · 坐标重合待核验",
      ),
    ).toBeVisible();
    await userEvent.click(screen.getByText("贸易商甲"));
    expect(
      await within(screen.getByLabelText("所选样本点详情")).findByText("贸易商甲"),
    ).toBeVisible();
    expect(screen.getByText("坐标重合待核验，地图按原始坐标显示")).toBeVisible();
  });

  it("keeps governance correction diagnostics out of the ordinary business panel", async () => {
    const catalog = {
      ...list,
      totalCount: 3,
      validCoordinateCount: 0,
      dataQualityIssueCount: 3,
      correctionSourceCount: 4,
      unresolvedSourceCount: 7,
    };
    const market = {
      ...catalog,
      correctionSourceCount: 1,
      unresolvedSourceCount: 7,
      items: [],
    };
    const repository = repositoryStub();
    repository.list.mockResolvedValueOnce(catalog).mockResolvedValueOnce(market);

    render(
      <PanelHarness
        onIconsChange={vi.fn()}
        year={2026}
        region={{ code: "230208", level: "COUNTY", name: "梅里斯达斡尔族区" }}
        repository={repository}
      />,
    );

    expect(await screen.findByText("请选择分类后查看 3 个样本点")).toBeVisible();
    expect(screen.queryByText(/纠错数|未解决数|稳定主体/)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "市场类 1" }));

    expect(screen.queryByText(/纠错数|未解决数|稳定主体/)).not.toBeInTheDocument();
    expect(screen.getByText("当前条件下暂无样本点。")).toBeVisible();
  });

  it.each([
    ["TOWNSHIP", "230202997", "契约测试乡"],
    ["VILLAGE", "230202997001", "契约测试村"],
  ] as const)("publishes categorized icons at %s level", async (level, code, name) => {
    const repository = repositoryStub();
    const onIconsChange = vi.fn();

    render(
      <PanelHarness
        onIconsChange={onIconsChange}
        year={2026}
        region={{
          code,
          level,
          name,
          ...(level === "VILLAGE" ? { parentCode: "230202997" } : {}),
        }}
        repository={repository}
      />,
    );

    await screen.findByRole("button", { name: "产情类 1" });
    expect(repository.icons).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "产情类 1" }));

    await waitFor(() =>
      expect(repository.icons).toHaveBeenCalledWith({
        regionCode: code,
        categoryCode: "PRODUCTION",
        productCode: "CORN",
        year: 2026,
      }),
    );
    expect(onIconsChange).toHaveBeenLastCalledWith([
      expect.objectContaining({ samplePointId: list.items[0]?.samplePointId }),
    ]);
  });

  it("uses one category, type, and search query for the list and icons", async () => {
    const repository = repositoryStub();
    render(
      <PanelHarness
        onIconsChange={vi.fn()}
        year={2026}
        region={{ code: "230202997", level: "TOWNSHIP", name: "契约测试乡" }}
        repository={repository}
      />,
    );

    await userEvent.click(await screen.findByRole("button", { name: "产情类 1" }));
    await userEvent.click(await screen.findByRole("button", { name: "农户 1" }));
    await userEvent.type(screen.getByLabelText("搜索样本点"), "同一");

    await waitFor(() =>
      expect(repository.list).toHaveBeenLastCalledWith({
        regionCode: "230202997",
        categoryCode: "PRODUCTION",
        productCode: "CORN",
        typeCode: "FARMER",
        query: "同一",
        year: 2026,
      }),
    );
    expect(repository.icons).toHaveBeenLastCalledWith({
      regionCode: "230202997",
      categoryCode: "PRODUCTION",
      productCode: "CORN",
      typeCode: "FARMER",
      query: "同一",
      year: 2026,
    });
  });

  it("keeps an active category stable when its button is clicked again", async () => {
    const repository = repositoryStub();
    const onIconsChange = vi.fn();
    render(
      <PanelHarness
        onIconsChange={onIconsChange}
        year={2026}
        region={{ code: "230202", level: "COUNTY", name: "龙沙区" }}
        repository={repository}
      />,
    );

    const category = await screen.findByRole("button", { name: "产情类 1" });
    await userEvent.click(category);
    await userEvent.click(await screen.findByText("同一跨产品样本点"));
    expect(await screen.findByText("13900000000")).toBeVisible();

    await userEvent.click(category);

    expect(
      within(screen.getByLabelText("样本点列表")).getByText("同一跨产品样本点"),
    ).toBeVisible();
    expect(
      within(screen.getByLabelText("所选样本点详情")).getByText("13900000000"),
    ).toBeVisible();
    expect(onIconsChange).toHaveBeenLastCalledWith([]);
  });

  it("loads stable-id business detail without map geometry", async () => {
    const repository = repositoryStub();
    render(
      <PanelHarness
        onIconsChange={vi.fn()}
        year={2026}
        region={{ code: "230202", level: "COUNTY", name: "龙沙区" }}
        repository={repository}
      />,
    );

    await userEvent.click(await screen.findByRole("button", { name: "产情类 1" }));
    await userEvent.click(await screen.findByText("同一跨产品样本点"));

    expect(await screen.findByText("13900000000")).toBeInTheDocument();
    expect(repository.detail).toHaveBeenCalledWith({
      samplePointId: "94000000-0000-0000-0000-000000000001",
      regionCode: "230202",
      categoryCode: "PRODUCTION",
      productCode: "CORN",
      year: 2026,
    });
    expect(screen.queryByText("123.9")).not.toBeInTheDocument();
  });

  it("defaults to the latest approved month and keeps earlier months selectable", async () => {
    const repository = repositoryStub();
    const baseAssociation = {
      categoryCode: "PRODUCTION" as const,
      categoryName: "产情类",
      sourceRole: "SURVEY" as const,
      typeCode: "FARMER",
      typeName: "农户",
      productCode: "CORN",
      productName: "玉米",
      sourceVersion: 0,
    };
    repository.detail.mockResolvedValue({
      samplePointId: "94000000-0000-0000-0000-000000000001",
      name: "同一跨产品样本点",
      regionCode: "230202997001",
      regionName: "契约测试村",
      locationState: "VALID",
      dataQualityReason: null,
      associations: [
        {
          ...baseAssociation,
          occurrenceDate: "2026-05-05",
          businessValues: {
            CULTIVATED_AREA_MU: {
              label: "种植面积",
              value: "10",
              unitCode: "亩",
            },
          },
        },
        {
          ...baseAssociation,
          occurrenceDate: "2026-09-05",
          businessValues: {
            CULTIVATED_AREA_MU: {
              label: "种植面积",
              value: "15",
              unitCode: "亩",
            },
          },
        },
      ],
    });

    render(
      <PanelHarness
        onIconsChange={vi.fn()}
        year={2026}
        region={{ code: "230202", level: "COUNTY", name: "龙沙区" }}
        repository={repository}
      />,
    );

    await userEvent.click(await screen.findByRole("button", { name: "产情类 1" }));
    await userEvent.click(await screen.findByText("同一跨产品样本点"));

    expect(await screen.findByRole("button", { name: "2026年9月" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByText("15 亩")).toBeVisible();
    expect(screen.queryByText("10 亩")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "2026年5月" }));
    expect(screen.getByText("10 亩")).toBeVisible();
    expect(screen.queryByText("15 亩")).not.toBeInTheDocument();
  });

  it("refreshes the open classification, list, icons, and detail without losing filters", async () => {
    const repository = repositoryStub();
    const onIconsChange = vi.fn();
    const region = {
      code: "230202997",
      level: "TOWNSHIP" as const,
      name: "契约测试乡",
    };
    const { rerender } = render(
      <PanelHarness
        onIconsChange={onIconsChange}
        refreshSequence={0}
        year={2026}
        region={region}
        repository={repository}
      />,
    );

    await userEvent.click(await screen.findByRole("button", { name: "产情类 1" }));
    await userEvent.click(await screen.findByText("同一跨产品样本点"));
    expect(await screen.findByText("13900000000")).toBeVisible();
    repository.list.mockClear();
    repository.icons.mockClear();
    repository.detail.mockClear();

    rerender(
      <PanelHarness
        onIconsChange={onIconsChange}
        refreshSequence={1}
        year={2026}
        region={region}
        repository={repository}
      />,
    );

    await waitFor(() => {
      expect(repository.list).toHaveBeenCalledWith({
        regionCode: "230202997",
        productCode: "CORN",
        year: 2026,
      });
      expect(repository.list).toHaveBeenCalledWith({
        regionCode: "230202997",
        categoryCode: "PRODUCTION",
        productCode: "CORN",
        year: 2026,
      });
      expect(repository.icons).toHaveBeenCalledWith({
        regionCode: "230202997",
        categoryCode: "PRODUCTION",
        productCode: "CORN",
        year: 2026,
      });
      expect(repository.detail).toHaveBeenCalledWith({
        samplePointId: "94000000-0000-0000-0000-000000000001",
        regionCode: "230202997",
        categoryCode: "PRODUCTION",
        productCode: "CORN",
        year: 2026,
      });
    });
    expect(await screen.findByText("13900000000")).toBeVisible();
  });

  it("clears a stale selection when realtime refresh removes the sample point", async () => {
    const repository = repositoryStub();
    const onIconsChange = vi.fn();
    const region = { code: "230202", level: "COUNTY" as const, name: "龙沙区" };
    const { rerender } = render(
      <PanelHarness
        onIconsChange={onIconsChange}
        refreshSequence={0}
        year={2026}
        region={region}
        repository={repository}
      />,
    );

    await userEvent.click(await screen.findByRole("button", { name: "产情类 1" }));
    await userEvent.click(await screen.findByText("同一跨产品样本点"));
    expect(await screen.findByText("13900000000")).toBeVisible();

    repository.list.mockResolvedValue({
      ...list,
      totalCount: 0,
      validCoordinateCount: 0,
      categories: [
        { code: "PRODUCTION" as const, name: "产情类", count: 0, types: [] },
        { code: "MARKET" as const, name: "市场类", count: 0, types: [] },
      ],
      items: [],
    });
    repository.icons.mockResolvedValue([]);

    rerender(
      <PanelHarness
        onIconsChange={onIconsChange}
        refreshSequence={1}
        year={2026}
        region={region}
        repository={repository}
      />,
    );

    expect(await screen.findByText("当前条件下暂无样本点。")).toBeVisible();
    await waitFor(() => {
      expect(screen.queryByText("13900000000")).not.toBeInTheDocument();
      expect(repository.detail).toHaveBeenCalledTimes(2);
    });
  });

  it("loads detail from an external map-icon selection", async () => {
    const repository = repositoryStub();
    const baseProps = {
      onIconsChange: vi.fn(),
      onSelectedSamplePointChange: vi.fn(),
      productCode: "CORN",
      year: 2026,
      region: { code: "230202997001", level: "VILLAGE" as const, name: "契约测试村" },
      repository,
    };

    const { rerender } = render(
      <OverviewSamplePointPanel {...baseProps} selectedSamplePointId={undefined} />,
    );

    await userEvent.click(await screen.findByRole("button", { name: "产情类 1" }));
    rerender(
      <OverviewSamplePointPanel
        {...baseProps}
        selectedSamplePointId="94000000-0000-0000-0000-000000000001"
      />,
    );

    expect(await screen.findByText("13900000000")).toBeVisible();
    expect(repository.detail).toHaveBeenCalledWith({
      categoryCode: "PRODUCTION",
      productCode: "CORN",
      regionCode: "230202997001",
      samplePointId: "94000000-0000-0000-0000-000000000001",
      year: 2026,
    });
  });

  it("switches between actual, design, and comparison layers without changing actual icons", async () => {
    const repository = repositoryStub();
    const onIconsChange = vi.fn();

    render(
      <PanelHarness
        onIconsChange={onIconsChange}
        year={2026}
        region={{ code: "230202997", level: "TOWNSHIP", name: "契约测试乡" }}
        repository={repository}
      />,
    );

    expect(await screen.findByRole("group", { name: "地图样本点图层" })).toBeVisible();
    expect(screen.getByRole("button", { name: "只看现有" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await userEvent.click(screen.getByRole("button", { name: "只看设计" }));

    await waitFor(() =>
      expect(onIconsChange).toHaveBeenLastCalledWith([
        expect.objectContaining({
          iconKey: "design-reference",
          layerType: "DESIGN_COVERAGE_BADGE",
          samplePointId: "design-coverage:230202997001",
        }),
      ]),
    );
    expect(repository.comparison).toHaveBeenCalledWith({
      productCode: "CORN",
      regionCode: "230202997",
      year: 2026,
    });
    expect(screen.getByText("设计行政村 1 个 · 年度现有样本点 1 个")).toBeVisible();
    expect(screen.getByText(/行政村展示分区（非权威边界）/)).toBeVisible();
    expect(screen.getByRole("heading", { name: "设计覆盖信息" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "产情类 1" })).not.toBeInTheDocument();
  });

  it("loads the parent township comparison when a village is selected", async () => {
    const repository = repositoryStub();
    const onIconsChange = vi.fn();

    render(
      <PanelHarness
        onIconsChange={onIconsChange}
        year={2026}
        region={{
          code: "230202997001",
          level: "VILLAGE",
          name: "契约测试村",
          parentCode: "230202997",
        }}
        repository={repository}
      />,
    );

    await waitFor(() =>
      expect(repository.comparison).toHaveBeenCalledWith({
        productCode: "CORN",
        regionCode: "230202997",
        year: 2026,
      }),
    );
    await userEvent.click(screen.getByRole("button", { name: "只看设计" }));
    await waitFor(() =>
      expect(onIconsChange).toHaveBeenLastCalledWith([
        expect.objectContaining({
          anchorRegionCode: "230202997001",
          visualState: "selected",
        }),
      ]),
    );
  });

  it("does not invent design counts or governance facts while comparison is loading", async () => {
    const repository = repositoryStub();
    repository.comparison.mockReturnValue(new Promise(() => undefined));

    render(
      <PanelHarness
        onIconsChange={vi.fn()}
        year={2026}
        region={{ code: "230202997", level: "TOWNSHIP", name: "契约测试乡" }}
        repository={repository}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "只看设计" }));
    expect(screen.getAllByText("正在同步年度样本网络")[0]).toBeVisible();
    expect(
      screen.queryByText(/已审核 0 个|待坐标治理登记|精确对应 0/),
    ).not.toBeInTheDocument();
  });

  it("does not invent design counts or governance facts when comparison is unavailable", async () => {
    const repository = repositoryStub();
    repository.comparison.mockRejectedValue(new Error("unavailable"));

    render(
      <PanelHarness
        onIconsChange={vi.fn()}
        year={2026}
        region={{ code: "230202997", level: "TOWNSHIP", name: "契约测试乡" }}
        repository={repository}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "只看设计" }));
    expect((await screen.findAllByText("年度样本网络不可用"))[0]).toBeVisible();
    expect(
      screen.queryByText(/已审核 0 个|待坐标治理登记|精确对应 0/),
    ).not.toBeInTheDocument();
  });

  it("fails closed when a village has no parent township", async () => {
    const repository = repositoryStub();
    const onIconsChange = vi.fn();

    render(
      <PanelHarness
        onIconsChange={onIconsChange}
        year={2026}
        region={{ code: "230202997001", level: "VILLAGE", name: "孤立测试村" }}
        repository={repository}
      />,
    );

    await userEvent.click(await screen.findByRole("button", { name: "产情类 1" }));
    await waitFor(() => expect(onIconsChange).toHaveBeenLastCalledWith([]));
    await userEvent.click(screen.getByRole("button", { name: "网络覆盖对照" }));
    expect(
      await screen.findByText(
        "父乡镇信息缺失，网络对照不可用，请先治理行政区层级关系。",
      ),
    ).toBeVisible();
    expect(repository.comparison).not.toHaveBeenCalled();
    expect(onIconsChange).toHaveBeenLastCalledWith([]);
  });

  it("applies the selected category to precise icons and regional summaries", async () => {
    const repository = repositoryStub();
    const current = await repository.comparison({
      productCode: "CORN",
      regionCode: "230202997",
      year: 2026,
    });
    repository.comparison.mockClear();
    repository.comparison.mockResolvedValue({
      ...current,
      activeSamplePointCount: 2,
      actualLevelCounts: { prefecture: 0, county: 1, township: 0, village: 1 },
      actualPoints: [
        ...current.actualPoints,
        {
          samplePointId: "94000000-0000-0000-0000-000000000099",
          samplePointName: "龙沙区区域样本",
          samplePointKindCode: "TRADER",
          membershipStatusCode: "ACTIVE",
          locatedRegionCode: "230202",
          locatedRegionName: "龙沙区",
          locatedRegionLevel: "COUNTY",
          actualLongitude: null,
          actualLatitude: null,
          locationState: "MISSING_COORDINATE",
        },
      ],
    });
    const onIconsChange = vi.fn<(icons: readonly OverviewSamplePointIcon[]) => void>();

    render(
      <PanelHarness
        onIconsChange={onIconsChange}
        year={2026}
        region={{ code: "230202997", level: "TOWNSHIP", name: "契约测试乡" }}
        repository={repository}
      />,
    );

    await userEvent.click(await screen.findByRole("button", { name: "产情类 1" }));
    expect(await screen.findByText("精确业务图标 1 个")).toBeVisible();
    expect(screen.getByText("当前筛选区域汇总标识 0 个")).toBeVisible();
    await waitFor(() => {
      const layers = onIconsChange.mock.calls.at(-1)?.[0] ?? [];
      expect(
        layers.filter((icon) => icon.layerType === "REGIONAL_ACTUAL_BADGE"),
      ).toHaveLength(0);
      expect(
        layers.filter((icon) => !icon.layerType || icon.layerType === "ANNUAL_ACTUAL"),
      ).toHaveLength(1);
    });
  });

  it("shows registered coordinate sources as coverage rather than all-or-nothing", async () => {
    const repository = repositoryStub();
    const current = await repository.comparison({
      productCode: "CORN",
      regionCode: "230202997",
      year: 2026,
    });
    repository.comparison.mockClear();
    repository.comparison.mockResolvedValue({
      ...current,
      designPointCount: 2,
      designPoints: [
        ...current.designPoints,
        {
          ...current.designPoints[0]!,
          villageRegionCode: "230202997002",
          villageName: "无来源测试村",
          coordinateSourceName: null,
        },
      ],
    });

    render(
      <PanelHarness
        onIconsChange={vi.fn()}
        year={2026}
        region={{ code: "230202997", level: "TOWNSHIP", name: "契约测试乡" }}
        repository={repository}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "只看设计" }));
    expect(await screen.findByText("已登记 1 / 总数 2")).toBeVisible();
  });

  it("keeps historical REVIEWED coordinates pending and disables the exact-location toggle", async () => {
    const repository = repositoryStub();

    render(
      <PanelHarness
        onIconsChange={vi.fn()}
        year={2026}
        region={{ code: "230202997", level: "TOWNSHIP", name: "契约测试乡" }}
        repository={repository}
      />,
    );

    await userEvent.click(await screen.findByRole("button", { name: "只看设计" }));
    expect(
      screen.getByRole("checkbox", { name: "显示权威核验精确位置（0）" }),
    ).toBeDisabled();
    expect(screen.getByText("权威核验通过 0 个 · 待核验 1 个")).toBeVisible();
  });

  it.each([
    ["PREFECTURE", "230200", "齐齐哈尔市"],
    ["COUNTY", "230202", "龙沙区"],
  ] as const)(
    "keeps the current-sample data source connected at %s level",
    async (level, code, name) => {
      const repository = repositoryStub();

      render(
        <PanelHarness
          onIconsChange={vi.fn()}
          year={2026}
          region={{ code, level, name }}
          repository={repository}
        />,
      );

      await userEvent.click(await screen.findByRole("button", { name: "产情类 1" }));
      await waitFor(() =>
        expect(repository.icons).toHaveBeenCalledWith({
          categoryCode: "PRODUCTION",
          productCode: "CORN",
          regionCode: code,
          year: 2026,
        }),
      );
      expect(
        screen.queryByText("当前层级使用聚合统计，不显示单个样本点图标。"),
      ).not.toBeInTheDocument();
      expect(screen.queryByText(/地图显示 1 个/)).not.toBeInTheDocument();
      expect(screen.queryByText(/因坐标缺失或无效暂不显示/)).not.toBeInTheDocument();
    },
  );
});

function repositoryStub() {
  return {
    aggregates: vi
      .fn<OverviewSamplePointRepository["aggregates"]>()
      .mockResolvedValue([]),
    comparison: vi.fn<OverviewSamplePointRepository["comparison"]>().mockResolvedValue({
      networkYear: 2026,
      networkStatus: "PUBLISHED",
      designPointCount: 1,
      designCoordinateCount: 1,
      activeSamplePointCount: 1,
      approvedSubmissionSamplePointCount: 1,
      pendingVerificationDesignPointCount: 1,
      multipleActualPerDesignPointCount: 0,
      anomalyCount: 0,
      exactCoveredDesignPointCount: 1,
      representedDesignPointCount: 0,
      regionalAssociationDesignPointCount: 0,
      unrelatedDesignPointCount: 0,
      actualLevelCounts: { prefecture: 0, county: 0, township: 0, village: 1 },
      designPoints: [
        {
          villageRegionCode: "230202997001",
          villageName: "契约测试村",
          townshipRegionCode: "230202997",
          townshipName: "契约测试乡",
          countyRegionCode: "230202",
          countyName: "龙沙区",
          designLongitude: 123.8,
          designLatitude: 47.2,
          coordinateReviewStatus: "REVIEWED",
          coordinateSourceName: "村委会驻地复核",
        },
      ],
      actualPoints: [
        {
          samplePointId: "94000000-0000-0000-0000-000000000001",
          samplePointName: "同一跨产品样本点",
          samplePointKindCode: "FARMER",
          membershipStatusCode: "ACTIVE",
          locatedRegionCode: "230202997001",
          locatedRegionName: "契约测试村",
          locatedRegionLevel: "VILLAGE",
          actualLongitude: 123.9,
          actualLatitude: 47.3,
          locationState: "VALID",
        },
      ],
      relations: [
        {
          samplePointId: "94000000-0000-0000-0000-000000000001",
          designVillageRegionCode: "230202997001",
          relationType: "EXACT_VILLAGE",
          evidenceReference: null,
          reviewStatus: "APPROVED",
          createdBy: "system",
          createdAt: "2026-08-23T01:00:00Z",
          reviewedBy: null,
          reviewedAt: null,
        },
      ],
    }),
    list: vi.fn<OverviewSamplePointRepository["list"]>().mockResolvedValue(list),
    icons: vi.fn<OverviewSamplePointRepository["icons"]>().mockResolvedValue([
      {
        samplePointId: "94000000-0000-0000-0000-000000000001",
        name: "同一跨产品样本点",
        iconKey: "farmer",
        types: [{ code: "FARMER", name: "农户", iconKey: "farmer" }],
        longitude: 123.9,
        latitude: 47.3,
        dataQualityReason: null,
      },
    ]),
    detail: vi.fn<OverviewSamplePointRepository["detail"]>().mockResolvedValue({
      samplePointId: "94000000-0000-0000-0000-000000000001",
      name: "同一跨产品样本点",
      regionCode: "230202997001",
      regionName: "契约测试村",
      locationState: "VALID",
      dataQualityReason: null,
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
          sourceVersion: 0,
          businessValues: {
            SAMPLE_CONTACT: {
              label: "样本点联系方式",
              value: "13900000000",
              unitCode: null,
            },
          },
        },
      ],
    }),
  };
}

function PanelHarness(
  props: Omit<
    ComponentProps<typeof OverviewSamplePointPanel>,
    "onSelectedSamplePointChange" | "productCode" | "selectedSamplePointId"
  >,
) {
  const [selectedSamplePointId, setSelectedSamplePointId] = useState<string>();
  return (
    <OverviewSamplePointPanel
      {...props}
      onSelectedSamplePointChange={setSelectedSamplePointId}
      productCode="CORN"
      selectedSamplePointId={selectedSamplePointId}
    />
  );
}
