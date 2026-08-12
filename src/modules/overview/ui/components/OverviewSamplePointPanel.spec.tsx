import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { OverviewSamplePointRepository } from "../../application/ports/OverviewSamplePointRepository";
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
    },
  ],
  correctionSources: [],
};

describe("OverviewSamplePointPanel", () => {
  it("keeps category, scrollable list, and business information as separate sections", async () => {
    render(
      <OverviewSamplePointPanel
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
    const onIconsChange = vi.fn();

    render(
      <OverviewSamplePointPanel
        onIconsChange={onIconsChange}
        year={2026}
        region={{ code: "230202", level: "COUNTY", name: "龙沙区" }}
        repository={repository}
      />,
    );

    expect(await screen.findByRole("button", { name: "产情类 1" })).toBeVisible();
    expect(screen.queryByText("同一跨产品样本点")).not.toBeInTheDocument();
    expect(
      screen.getByText("请选择分类后逐条查看 1 个实体及坐标质量原因"),
    ).toBeVisible();
    expect(repository.icons).not.toHaveBeenCalled();
    expect(repository.detail).not.toHaveBeenCalled();
    expect(onIconsChange).toHaveBeenCalledWith([]);
  });

  it("explains blocked coordinates before classification and keeps each entity in the correction list", async () => {
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
    repository.list.mockResolvedValue(qualityList);
    repository.icons.mockResolvedValue([]);
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
      <OverviewSamplePointPanel
        onIconsChange={vi.fn()}
        year={2026}
        region={{ code: "230208", level: "COUNTY", name: "梅里斯达斡尔族区" }}
        repository={repository}
      />,
    );

    expect(
      await screen.findByText(
        "实体核对：可显示图标 0 个 + 坐标待纠正 3 个 = 共 3 个。",
      ),
    ).toBeVisible();
    expect(
      screen.getByText("请选择分类后逐条查看 3 个实体及坐标质量原因"),
    ).toBeVisible();

    await userEvent.click(screen.getByRole("button", { name: "市场类 3" }));
    expect(await screen.findByText("贸易商甲")).toBeVisible();
    expect(screen.getByText("贸易商乙")).toBeVisible();
    expect(screen.getByText("饲料厂丙")).toBeVisible();
    await userEvent.click(screen.getByText("贸易商甲"));
    expect(
      await within(screen.getByLabelText("所选样本点详情")).findByText(
        "坐标质量：重复坐标尚未核实",
      ),
    ).toBeVisible();
  });

  it("keeps the current-category correction count and full-catalog unresolved count visible together", async () => {
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
      <OverviewSamplePointPanel
        onIconsChange={vi.fn()}
        year={2026}
        region={{ code: "230208", level: "COUNTY", name: "梅里斯达斡尔族区" }}
        repository={repository}
      />,
    );

    expect(await screen.findByText("当前分类纠错数：4 条")).toBeVisible();
    expect(screen.getByText("全目录未解决数：7 条")).toBeVisible();

    await userEvent.click(screen.getByRole("button", { name: "市场类 1" }));

    expect(await screen.findByText("当前分类纠错数：1 条")).toBeVisible();
    expect(screen.getByText("全目录未解决数：7 条")).toBeVisible();
    expect(screen.getByText("当前条件下暂无样本点。")).toBeVisible();
  });

  it.each([
    ["COUNTY", "230202", "龙沙区"],
    ["TOWNSHIP", "230202997", "契约测试乡"],
    ["VILLAGE", "230202997001", "契约测试村"],
  ] as const)("publishes categorized icons at %s level", async (level, code, name) => {
    const repository = repositoryStub();
    const onIconsChange = vi.fn();

    render(
      <OverviewSamplePointPanel
        onIconsChange={onIconsChange}
        year={2026}
        region={{ code, level, name }}
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
      <OverviewSamplePointPanel
        onIconsChange={vi.fn()}
        year={2026}
        region={{ code: "230202", level: "COUNTY", name: "龙沙区" }}
        repository={repository}
      />,
    );

    await userEvent.click(await screen.findByRole("button", { name: "产情类 1" }));
    await userEvent.click(await screen.findByRole("button", { name: "农户 1" }));
    await userEvent.type(screen.getByLabelText("搜索样本点"), "同一");

    await waitFor(() =>
      expect(repository.list).toHaveBeenLastCalledWith({
        regionCode: "230202",
        categoryCode: "PRODUCTION",
        typeCode: "FARMER",
        query: "同一",
        year: 2026,
      }),
    );
    expect(repository.icons).toHaveBeenLastCalledWith({
      regionCode: "230202",
      categoryCode: "PRODUCTION",
      typeCode: "FARMER",
      query: "同一",
      year: 2026,
    });
  });

  it("clears the old list, icons, and detail immediately when a category is cancelled", async () => {
    const repository = repositoryStub();
    const onIconsChange = vi.fn();
    render(
      <OverviewSamplePointPanel
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

    expect(screen.queryByText("同一跨产品样本点")).not.toBeInTheDocument();
    expect(screen.queryByText("13900000000")).not.toBeInTheDocument();
    expect(onIconsChange).toHaveBeenLastCalledWith([]);
  });

  it("loads stable-id business detail without map geometry", async () => {
    const repository = repositoryStub();
    render(
      <OverviewSamplePointPanel
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
      year: 2026,
    });
    expect(screen.queryByText("123.9")).not.toBeInTheDocument();
  });

  it("refreshes the open classification, list, icons, and detail without losing filters", async () => {
    const repository = repositoryStub();
    const onIconsChange = vi.fn();
    const region = { code: "230202", level: "COUNTY" as const, name: "龙沙区" };
    const { rerender } = render(
      <OverviewSamplePointPanel
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
      <OverviewSamplePointPanel
        onIconsChange={onIconsChange}
        refreshSequence={1}
        year={2026}
        region={region}
        repository={repository}
      />,
    );

    await waitFor(() => {
      expect(repository.list).toHaveBeenCalledWith({
        regionCode: "230202",
        year: 2026,
      });
      expect(repository.list).toHaveBeenCalledWith({
        regionCode: "230202",
        categoryCode: "PRODUCTION",
        year: 2026,
      });
      expect(repository.icons).toHaveBeenCalledWith({
        regionCode: "230202",
        categoryCode: "PRODUCTION",
        year: 2026,
      });
      expect(repository.detail).toHaveBeenCalledWith({
        samplePointId: "94000000-0000-0000-0000-000000000001",
        regionCode: "230202",
        categoryCode: "PRODUCTION",
        year: 2026,
      });
    });
    expect(await screen.findByText("13900000000")).toBeVisible();
  });

  it("does not load detail from an external map-icon selection", async () => {
    const repository = repositoryStub();

    render(
      <OverviewSamplePointPanel
        onIconsChange={vi.fn()}
        year={2026}
        region={{ code: "230202997001", level: "VILLAGE", name: "契约测试村" }}
        repository={repository}
        {...({
          selectedSamplePointId: "94000000-0000-0000-0000-000000000001",
        } as Record<string, string>)}
      />,
    );

    await screen.findByRole("button", { name: "产情类 1" });
    expect(repository.detail).not.toHaveBeenCalled();
    expect(screen.queryByText("13900000000")).not.toBeInTheDocument();
  });
});

function repositoryStub() {
  return {
    aggregates: vi
      .fn<OverviewSamplePointRepository["aggregates"]>()
      .mockResolvedValue([]),
    list: vi.fn<OverviewSamplePointRepository["list"]>().mockResolvedValue(list),
    icons: vi.fn<OverviewSamplePointRepository["icons"]>().mockResolvedValue([
      {
        samplePointId: "94000000-0000-0000-0000-000000000001",
        name: "同一跨产品样本点",
        iconKey: "farmer",
        types: [{ code: "FARMER", name: "农户", iconKey: "farmer" }],
        longitude: 123.9,
        latitude: 47.3,
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
            CONTACT: { label: "联系方式", value: "13900000000", unitCode: null },
          },
        },
      ],
    }),
  };
}
