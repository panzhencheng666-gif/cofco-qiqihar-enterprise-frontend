import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { App, type AppDependencies } from "./App";
import type { ListPageDefinition } from "../shared/application/page-definition";

describe("App production composition", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/");
  });

  it("drives products, initial search, submit, pagination and browser history through one context", async () => {
    const user = userEvent.setup();
    const searches: Array<Record<string, string | number | undefined>> = [];
    const dependencies = dependenciesFixture((criteria) => {
      searches.push(criteria);
      return Promise.resolve(records(21));
    });

    render(<App dependencies={dependencies} />);

    expect(await screen.findByRole("button", { name: "大豆质量指标" })).toBeVisible();
    expect(screen.getByRole("button", { name: "稻谷质量指标" })).toBeVisible();
    expect(screen.queryByText("玉米质量指标")).not.toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "大豆质量指标" })).toBeVisible();
    await waitFor(() => expect(searches).toHaveLength(1));
    expect(searches[0]).toMatchObject({
      productCode: "SOYBEAN_FIXTURE",
      pageNumber: 0,
      pageSize: 20,
    });

    await user.type(screen.getByRole("textbox", { name: "关键词" }), "北安");
    await user.click(screen.getByRole("button", { name: "查询" }));
    await waitFor(() => expect(searches).toHaveLength(2));
    expect(searches[1]).toMatchObject({ keyword: "北安" });
    expect(window.location.hash).toContain("filter.keyword=%E5%8C%97%E5%AE%89");

    await user.click(screen.getByRole("button", { name: "下一页" }));
    await waitFor(() => expect(searches).toHaveLength(3));
    expect(searches[2]).toMatchObject({ pageNumber: 1 });
    expect(screen.getByText("记录21")).toBeVisible();

    const soybeanLocation = "#/pages/MARKET/QUALITY/SOYBEAN_FIXTURE";
    await user.click(screen.getByRole("button", { name: "稻谷质量指标" }));
    expect(await screen.findByRole("heading", { name: "稻谷质量指标" })).toBeVisible();
    const riceLocation = window.location.hash;

    window.history.replaceState(null, "", soybeanLocation);
    window.dispatchEvent(new PopStateEvent("popstate"));
    expect(await screen.findByRole("heading", { name: "大豆质量指标" })).toBeVisible();

    window.history.replaceState(null, "", riceLocation);
    window.dispatchEvent(new PopStateEvent("popstate"));
    expect(await screen.findByRole("heading", { name: "稻谷质量指标" })).toBeVisible();
  });

  it("keeps the workbench mounted and retries a failed real search adapter call", async () => {
    const user = userEvent.setup();
    let attempts = 0;
    const dependencies = dependenciesFixture(() => {
      attempts += 1;
      return attempts === 1
        ? Promise.reject(new Error("offline"))
        : Promise.resolve(records(1));
    });

    render(<App dependencies={dependencies} />);

    expect(await screen.findByRole("heading", { name: "大豆质量指标" })).toBeVisible();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "列表查询失败，请稍后重试。",
    );
    expect(screen.getByRole("table", { name: "大豆质量指标" })).toBeVisible();

    await user.click(screen.getByRole("button", { name: "重试列表查询" }));
    expect(await screen.findByText("记录1")).toBeVisible();
    expect(attempts).toBe(2);
  });
});

function dependenciesFixture(
  search: (
    criteria: Record<string, string | number | undefined>,
  ) => Promise<ReturnType<typeof records>>,
): AppDependencies {
  return {
    masterDataRepository: {
      getProducts: () =>
        Promise.resolve([
          { id: "SOYBEAN_FIXTURE", name: "大豆" },
          { id: "RICE_FIXTURE", name: "稻谷" },
        ]),
      getCultivars: () => Promise.resolve([]),
      getMarketObjectTypes: () => Promise.resolve([]),
      getMonitoringPeriods: () => Promise.resolve([]),
      getRegionRoots: () => Promise.resolve([]),
      getRegionChildren: () => Promise.resolve([]),
      getRegionPath: () => Promise.resolve([]),
    },
    pageDefinitionGateway: {
      getDefinition: (key) => Promise.resolve(definitionFixture(key.productCode)),
    },
    marketCollectionRepository: {
      getDefinition: () => Promise.reject(new Error("legacy definition unused")),
      search,
    },
  };
}

function definitionFixture(productCode: string): ListPageDefinition {
  const productName = productCode === "RICE_FIXTURE" ? "稻谷" : "大豆";
  return {
    key: { domain: "MARKET", pageKind: "QUALITY", productCode },
    title: `${productName}质量指标`,
    breadcrumbs: [{ id: "market", label: "市场监测" }],
    filters: [
      {
        id: "keyword",
        label: "关键词",
        control: "text",
        placeholder: "输入关键词",
        options: [],
      },
    ],
    defaultContext: {},
    columnGroups: [
      {
        id: "base",
        label: "基本信息",
        fields: [{ id: "subjectName", label: "监测对象", valueType: "TEXT" }],
      },
    ],
    actions: [],
    pagination: { defaultPageSize: 20, pageSizeOptions: [20] },
  };
}

function records(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: `record-${String(index + 1)}`,
    collectionDate: "",
    submittedAt: "",
    subjectName: `记录${String(index + 1)}`,
    objectTypeName: "",
    regionName: "",
    cultivarName: "",
    status: "",
    values: {},
  }));
}
