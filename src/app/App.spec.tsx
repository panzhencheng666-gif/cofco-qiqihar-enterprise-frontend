import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { App, type AppDependencies } from "./App";
import type { MarketCollectionCriteria } from "../modules/market-monitoring/domain/marketCollection";
import type { ListPageDefinition } from "../shared/application/page-definition";

describe("App production composition", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/");
  });

  it("drives products, initial search, submit, pagination and browser history through one context", async () => {
    const user = userEvent.setup();
    const searches: MarketCollectionCriteria[] = [];
    const dependencies = dependenciesFixture((criteria) => {
      searches.push(criteria);
      return Promise.resolve(
        page(
          criteria.pageNumber === 1 ? records(1, 21) : records(20),
          criteria.pageNumber ?? 0,
          20,
          21,
        ),
      );
    });

    render(<App dependencies={dependencies} />);

    expect(await screen.findByRole("button", { name: "大豆质量指标" })).toBeVisible();
    expect(screen.getByRole("button", { name: "稻谷质量指标" })).toBeVisible();
    expect(screen.queryByText("玉米质量指标")).not.toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "大豆质量指标" })).toBeVisible();
    await waitFor(() => expect(searches).toHaveLength(1));
    expect(searches[0]).toMatchObject({
      productCode: "SOYBEAN_FIXTURE",
      pageKind: "QUALITY",
      pageNumber: 0,
      pageSize: 20,
    });

    await user.type(screen.getByRole("textbox", { name: "关键词" }), "北安");
    await user.click(screen.getByRole("button", { name: "查询" }));
    await waitFor(() => expect(searches).toHaveLength(2));
    expect(searches[1]).toMatchObject({ values: { keyword: "北安" } });
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
        : Promise.resolve(page(records(1), 0, 20, 1));
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

  it("whitelists deep-link filters and pagination against the loaded definition", async () => {
    window.history.replaceState(
      null,
      "",
      "#/pages/MARKET/QUALITY/SOYBEAN_FIXTURE?pageNumber=-3&pageSize=999&filter.keyword=%E5%8C%97%E5%AE%89&filter.unknown=discard",
    );
    const searches: Array<Record<string, unknown>> = [];
    render(
      <App
        dependencies={dependenciesFixture((criteria) => {
          searches.push(criteria);
          return Promise.resolve(page([], 0, 20, 0));
        })}
      />,
    );

    await waitFor(() => expect(searches).toHaveLength(1));
    expect(searches[0]).toMatchObject({
      pageNumber: 0,
      pageSize: 20,
      values: { keyword: "北安" },
    });
    expect(searches[0]).not.toHaveProperty("values.unknown");
    expect(window.location.hash).toContain("pageSize=20");
    expect(window.location.hash).not.toContain("unknown");
  });

  it("handles damaged encoding and mismatched navigation context without throwing", async () => {
    window.history.replaceState(
      null,
      "",
      "#/pages/LOGISTICS/QUALITY/%E0%A4%A?filter.keyword=%E0%A4%A",
    );

    expect(() =>
      render(
        <App
          dependencies={dependenciesFixture(() => Promise.resolve(page([], 0, 20, 0)))}
        />,
      ),
    ).not.toThrow();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "页面地址无效，请从业务导航进入。",
    );
    expect(screen.getByRole("button", { name: "大豆质量指标" })).toBeVisible();
  });

  it("normalizes a valid deep link whose domain does not belong to dynamic navigation", async () => {
    window.history.replaceState(null, "", "#/pages/LOGISTICS/QUALITY/SOYBEAN_FIXTURE");
    render(
      <App
        dependencies={dependenciesFixture(() => Promise.resolve(page([], 0, 20, 0)))}
      />,
    );

    expect(await screen.findByRole("heading", { name: "大豆质量指标" })).toBeVisible();
    expect(window.location.hash).toMatch(/^#\/pages\/MARKET\/QUALITY\/SOYBEAN_FIXTURE/);
  });

  it("revalidates filter and page-size state arriving through browser history", async () => {
    const searches: Array<Record<string, unknown>> = [];
    render(
      <App
        dependencies={dependenciesFixture((criteria) => {
          searches.push(criteria);
          return Promise.resolve(page([], 0, 20, 0));
        })}
      />,
    );
    await waitFor(() => expect(searches).toHaveLength(1));

    window.history.replaceState(
      null,
      "",
      "#/pages/MARKET/QUALITY/SOYBEAN_FIXTURE?pageSize=777&filter.unknown=discard&filter.keyword=history",
    );
    window.dispatchEvent(new PopStateEvent("popstate"));

    await waitFor(() => expect(searches).toHaveLength(2));
    expect(searches[1]).toMatchObject({
      pageSize: 20,
      values: { keyword: "history" },
    });
    expect(window.location.hash).not.toContain("unknown");
    expect(window.location.hash).not.toContain("777");
  });

  it("rejects a page definition whose context differs from the requested navigation", async () => {
    const dependencies = dependenciesFixture(() => Promise.resolve(page([], 0, 20, 0)));
    dependencies.pageDefinitionGateway = {
      getDefinition: () => Promise.resolve(definitionFixture("RICE_FIXTURE")),
    };
    render(<App dependencies={dependencies} />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "页面上下文与页面定义不一致。",
    );
  });

  it("retries dynamic product navigation after an initial failure", async () => {
    const user = userEvent.setup();
    let attempts = 0;
    const dependencies = dependenciesFixture(() => Promise.resolve(page([], 0, 20, 0)));
    dependencies.masterDataRepository.getProducts = () => {
      attempts += 1;
      return attempts === 1
        ? Promise.reject(new Error("offline"))
        : Promise.resolve([{ id: "SOYBEAN_FIXTURE", name: "大豆" }]);
    };
    render(<App dependencies={dependencies} />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "产品导航加载失败，请稍后重试。",
    );
    await user.click(screen.getByRole("button", { name: "重试产品导航" }));
    expect(await screen.findByRole("button", { name: "大豆质量指标" })).toBeVisible();
    expect(attempts).toBe(2);
  });

  it.each([
    ["CORN", "玉米产情监测"],
    ["SOYBEAN", "大豆产情监测"],
    ["RICE", "稻谷产情监测"],
  ])("preserves canonical production deep link for %s", async (productCode, title) => {
    window.history.replaceState(
      null,
      "",
      `#/pages/PRODUCTION/MONITORING/${productCode}`,
    );
    const dependencies = dependenciesFixture(() => Promise.resolve(page([], 0, 20, 0)));
    dependencies.masterDataRepository.getProducts = () =>
      Promise.resolve([
        { id: "CORN", name: "玉米" },
        { id: "SOYBEAN", name: "大豆" },
        { id: "RICE", name: "稻谷" },
      ]);
    dependencies.pageDefinitionGateway.getDefinition = (key) =>
      Promise.resolve({
        ...definitionFixture(key.productCode!),
        key,
        title,
      });
    dependencies.productionRecordRepository = {
      search: () =>
        Promise.resolve({
          ...page([], 0, 20, 0),
          items: [],
        }),
      detail: () => Promise.reject(new Error("not called")),
      definition: () => Promise.reject(new Error("not called")),
      create: () => Promise.reject(new Error("not called")),
      saveDraft: () => Promise.reject(new Error("not called")),
      submit: () => Promise.reject(new Error("not called")),
      approve: () => Promise.reject(new Error("not called")),
      returnForCorrection: () => Promise.reject(new Error("not called")),
    };

    render(<App dependencies={dependencies} />);

    expect(await screen.findByRole("heading", { name: title })).toBeVisible();
    expect(window.location.hash).toBe(
      `#/pages/PRODUCTION/MONITORING/${productCode}?pageNumber=0&pageSize=20`,
    );
  });
});

function dependenciesFixture(
  search: (criteria: {
    productCode: string;
    pageKind: string;
    pageNumber: number;
    pageSize: number;
    values: Readonly<Record<string, string>>;
  }) => Promise<ReturnType<typeof page>>,
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
      getDefinition: (key) =>
        Promise.resolve(definitionFixture(key.productCode ?? "SOYBEAN_FIXTURE")),
    },
    marketCollectionRepository: {
      search,
    },
    workItemRepository: {
      search: () => Promise.reject(new Error("not called")),
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

function records(count: number, first = 1) {
  return Array.from({ length: count }, (_, index) => ({
    id: `record-${String(first + index)}`,
    values: { subjectName: `记录${String(first + index)}` },
  }));
}

function page(
  items: ReturnType<typeof records>,
  pageNumber: number,
  pageSize: number,
  totalElements: number,
) {
  return {
    items,
    pageNumber,
    pageSize,
    totalElements,
    totalPages: Math.ceil(totalElements / pageSize),
  };
}
