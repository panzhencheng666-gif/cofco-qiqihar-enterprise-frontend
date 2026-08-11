import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { OverviewSamplePointRepository } from "../../application/ports/OverviewSamplePointRepository";
import { OverviewSamplePointPanel } from "./OverviewSamplePointPanel";

const list = {
  regionCode: "230202997001",
  totalCount: 1,
  unresolvedSourceCount: 1,
  categories: [
    {
      code: "PRODUCTION" as const,
      name: "产情类",
      count: 1,
      types: [{ code: "FARMER", name: "农户", count: 1 }],
    },
    {
      code: "MARKET" as const,
      name: "市场类",
      count: 1,
      types: [{ code: "TRADER", name: "贸易商", count: 1 }],
    },
    { code: "LOGISTICS" as const, name: "物流节点", count: 0, types: [] },
  ],
  items: [
    {
      samplePointId: "94000000-0000-0000-0000-000000000001",
      name: "同一跨产品样本点",
      regionCode: "230202997001",
      regionName: "契约测试村",
      locationState: "VALID",
      categories: [{ code: "PRODUCTION" as const, name: "产情类" }],
      types: [{ code: "FARMER", name: "农户" }],
      products: [{ code: "CORN", name: "玉米" }],
    },
  ],
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
    expect(screen.getByText("请选择分类后查看样本点")).toBeVisible();
    expect(repository.icons).not.toHaveBeenCalled();
    expect(repository.detail).not.toHaveBeenCalled();
    expect(onIconsChange).toHaveBeenCalledWith([]);
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
        types: [{ code: "FARMER", name: "农户" }],
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
