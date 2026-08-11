import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { OverviewSamplePointRepository } from "../../application/ports/OverviewSamplePointRepository";
import { OverviewSamplePointPanel } from "./OverviewSamplePointPanel";

const aggregate = {
  regionCode: "230202997001",
  regionName: "契约测试村",
  regionLevel: "VILLAGE" as const,
  samplePointCount: 3,
  unresolvedSourceCount: 1,
};

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
    { code: "MARKET" as const, name: "市场类", count: 0, types: [] },
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
        productCode="CORN"
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

  it("keeps aggregate counts independent while filtering a township list", async () => {
    const repository = repositoryStub();
    const onAggregatesChange = vi.fn();
    const onIconsChange = vi.fn();

    render(
      <OverviewSamplePointPanel
        onAggregatesChange={onAggregatesChange}
        onIconsChange={onIconsChange}
        parentCode="230202997"
        productCode="CORN"
        region={{ code: "230202997", level: "TOWNSHIP", name: "契约测试乡" }}
        repository={repository}
      />,
    );

    await screen.findByText("同一跨产品样本点");
    await userEvent.click(screen.getByRole("button", { name: "产情类 1" }));

    await waitFor(() =>
      expect(repository.list).toHaveBeenLastCalledWith({
        productCode: "CORN",
        regionCode: "230202997",
        categoryCode: "PRODUCTION",
      }),
    );
    expect(repository.aggregates).toHaveBeenCalledTimes(1);
    expect(onAggregatesChange).toHaveBeenCalledWith([aggregate]);
    expect(repository.icons).not.toHaveBeenCalled();
    expect(onIconsChange).toHaveBeenLastCalledWith([]);
  });

  it("publishes icons only after a village category is selected", async () => {
    const repository = repositoryStub();
    const onIconsChange = vi.fn();

    render(
      <OverviewSamplePointPanel
        onAggregatesChange={vi.fn()}
        onIconsChange={onIconsChange}
        parentCode="230202997"
        productCode="CORN"
        region={{ code: "230202997001", level: "VILLAGE", name: "契约测试村" }}
        repository={repository}
      />,
    );

    await screen.findByText("同一跨产品样本点");
    expect(repository.icons).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "产情类 1" }));

    await waitFor(() =>
      expect(repository.icons).toHaveBeenCalledWith({
        productCode: "CORN",
        regionCode: "230202997001",
        categoryCode: "PRODUCTION",
      }),
    );
    expect(onIconsChange).toHaveBeenLastCalledWith([
      expect.objectContaining({ samplePointId: list.items[0]?.samplePointId }),
    ]);
  });

  it("loads stable-id business detail without map geometry", async () => {
    const repository = repositoryStub();
    render(
      <OverviewSamplePointPanel
        onAggregatesChange={vi.fn()}
        onIconsChange={vi.fn()}
        parentCode="230202997"
        productCode="CORN"
        region={{ code: "230202997001", level: "VILLAGE", name: "契约测试村" }}
        repository={repository}
      />,
    );

    await userEvent.click(await screen.findByText("同一跨产品样本点"));

    expect(await screen.findByText("13900000000")).toBeInTheDocument();
    expect(repository.detail).toHaveBeenCalledWith(
      "94000000-0000-0000-0000-000000000001",
      "230202997001",
      "CORN",
    );
    expect(screen.queryByText("123.9")).not.toBeInTheDocument();
  });

  it("loads the same stable-id detail when a village map icon is selected", async () => {
    const repository = repositoryStub();

    const { rerender } = render(
      <OverviewSamplePointPanel
        onIconsChange={vi.fn()}
        productCode="CORN"
        region={{ code: "230202997001", level: "VILLAGE", name: "契约测试村" }}
        repository={repository}
      />,
    );

    rerender(
      <OverviewSamplePointPanel
        onIconsChange={vi.fn()}
        productCode="CORN"
        region={{ code: "230202997001", level: "VILLAGE", name: "契约测试村" }}
        repository={repository}
        selectedSamplePointId="94000000-0000-0000-0000-000000000001"
      />,
    );

    expect(await screen.findByText("13900000000")).toBeInTheDocument();
    expect(repository.detail).toHaveBeenCalledWith(
      "94000000-0000-0000-0000-000000000001",
      "230202997001",
      "CORN",
    );
  });
});

function repositoryStub(): OverviewSamplePointRepository & {
  aggregates: ReturnType<typeof vi.fn>;
  detail: ReturnType<typeof vi.fn>;
  icons: ReturnType<typeof vi.fn>;
  list: ReturnType<typeof vi.fn>;
} {
  return {
    aggregates: vi.fn().mockResolvedValue([aggregate]),
    list: vi.fn().mockResolvedValue(list),
    icons: vi.fn().mockResolvedValue([
      {
        samplePointId: list.items[0]?.samplePointId,
        name: "同一跨产品样本点",
        types: [{ code: "FARMER", name: "农户" }],
        longitude: 123.9,
        latitude: 47.3,
      },
    ]),
    detail: vi.fn().mockResolvedValue({
      samplePointId: list.items[0]?.samplePointId,
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
