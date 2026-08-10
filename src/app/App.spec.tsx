import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

import { App, type AppDependencies } from "./App";
import type { MarketCollectionCriteria } from "../modules/market-monitoring/domain/marketCollection";
import type { MarketCollectionRepository } from "../modules/market-monitoring/application/ports/MarketCollectionRepository";
import type { ListPageDefinition } from "../shared/application/page-definition";
import type { ProductionRecordRepository } from "../modules/production-monitoring/application/ports/ProductionRecordRepository";
import type { ProductionRecordDetail } from "../modules/production-monitoring/domain/productionRecord";

type ProductionSearchPage = Awaited<ReturnType<ProductionRecordRepository["search"]>>;

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

    expect(await screen.findByRole("button", { name: "大豆市场采集" })).toBeVisible();
    expect(screen.getByRole("button", { name: "玉米市场采集" })).toBeVisible();
    expect(screen.getByRole("button", { name: "稻谷市场采集" })).toBeVisible();
    expect(await screen.findByRole("heading", { name: "大豆市场采集" })).toBeVisible();
    await waitFor(() => expect(searches).toHaveLength(1));
    expect(searches[0]).toMatchObject({
      productCode: "SOYBEAN_FIXTURE",
      pageKind: "MONITORING",
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

    await user.click(screen.getByRole("button", { name: "稻谷市场采集" }));
    expect(await screen.findByRole("heading", { name: "稻谷市场采集" })).toBeVisible();

    window.history.back();
    expect(await screen.findByRole("heading", { name: "大豆市场采集" })).toBeVisible();
    expect(await screen.findByText("记录21")).toBeVisible();

    window.history.back();
    expect(await screen.findByText("记录1")).toBeVisible();
    expect(screen.getByRole("textbox", { name: "关键词" })).toHaveValue("北安");

    window.history.forward();
    expect(await screen.findByText("记录21")).toBeVisible();
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

    expect(await screen.findByRole("heading", { name: "大豆市场采集" })).toBeVisible();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "列表查询失败，请稍后重试。",
    );
    expect(screen.getByRole("table", { name: "大豆市场采集" })).toBeVisible();

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
    expect(screen.getByRole("button", { name: "大豆市场采集" })).toBeVisible();
  });

  it("rejects an unsupported logistics page kind", async () => {
    window.history.replaceState(null, "", "#/pages/LOGISTICS/QUALITY/SOYBEAN_FIXTURE");
    render(
      <App
        dependencies={dependenciesFixture(() => Promise.resolve(page([], 0, 20, 0)))}
      />,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent("页面地址无效");
    expect(window.location.hash).toBe("#/pages/LOGISTICS/QUALITY/SOYBEAN_FIXTURE");
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

  it("rejects an unsupported production page kind before definition or list requests", async () => {
    window.history.replaceState(null, "", "#/pages/PRODUCTION/QUALITY/SOYBEAN_FIXTURE");
    const dependencies = dependenciesFixture(() => Promise.resolve(page([], 0, 20, 0)));
    const definitionRequest = vi.spyOn(
      dependencies.pageDefinitionGateway,
      "getDefinition",
    );
    const productionSearch: ProductionRecordRepository["search"] = vi.fn(() =>
      Promise.resolve({
        items: [],
        pageNumber: 0,
        pageSize: 20,
        totalElements: 0,
        totalPages: 0,
      }),
    );
    dependencies.productionRecordRepository = productionRepository(productionSearch);

    render(<App dependencies={dependencies} />);

    expect(await screen.findByRole("alert")).toHaveTextContent("页面地址无效");
    expect(definitionRequest).not.toHaveBeenCalled();
    expect(productionSearch).not.toHaveBeenCalled();
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
    expect(await screen.findByRole("button", { name: "大豆市场采集" })).toBeVisible();
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

  it.each(["create", "saveDraft", "submit", "approve", "return"] as const)(
    "never refreshes the old query when deferred %s settles inside a pending history restore",
    async (writeKind) => {
      window.history.replaceState(
        null,
        "",
        "#/pages/PRODUCTION/MONITORING/SOYBEAN?pageNumber=0&pageSize=20",
      );
      const user = userEvent.setup();
      const writeResult = deferred<ProductionRecordDetail>();
      const searches: Array<{
        pageNumber: number;
        values: Readonly<Record<string, string>>;
      }> = [];
      const latestSearches: ReturnType<typeof deferred<ProductionSearchPage>>[] = [];
      const dependencies = dependenciesFixture(() =>
        Promise.resolve(page([], 0, 20, 0)),
      );
      dependencies.masterDataRepository.getProducts = () =>
        Promise.resolve([{ id: "SOYBEAN", name: "大豆" }]);
      dependencies.pageDefinitionGateway.getDefinition = () =>
        Promise.resolve(productionWriteDefinitionFixture());
      const create = vi.fn(() => writeResult.promise);
      const saveDraft = vi.fn(() => writeResult.promise);
      const submit = vi.fn(() => writeResult.promise);
      const approve = vi.fn(() => writeResult.promise);
      const returnForCorrection = vi.fn(() => writeResult.promise);
      dependencies.productionRecordRepository = {
        search: (criteria) => {
          searches.push({
            pageNumber: criteria.pageNumber,
            values: { ...criteria.values },
          });
          if (
            criteria.pageNumber === 1 &&
            criteria.values.objectTypeCode === "FARMER"
          ) {
            const pending = deferred<ProductionSearchPage>();
            latestSearches.push(pending);
            if (latestSearches.length === 1) {
              writeResult.resolve(productionDetail("DRAFT", 8));
            }
            return pending.promise;
          }
          return Promise.resolve({
            items: [
              {
                id: "record-1",
                values: { PROD_STATUS: "可写记录" },
                allowedActions: ["VIEW", "SUBMIT", "APPROVE", "RETURN"],
                version: 7,
              },
            ],
            pageNumber: criteria.pageNumber,
            pageSize: criteria.pageSize,
            totalElements: 1,
            totalPages: 1,
          });
        },
        detail: () =>
          Promise.resolve({
            ...productionDetail("DRAFT", 7),
            allowedActions: ["SAVE"],
          }),
        definition: (_productCode, objectTypeCode) =>
          Promise.resolve(productionFormDefinitionFixture(objectTypeCode ?? null)),
        create,
        saveDraft,
        submit,
        approve,
        returnForCorrection,
      };

      render(<App dependencies={dependencies} />);
      if (writeKind === "create") {
        await user.click(await screen.findByRole("button", { name: "新建填报" }));
        await user.click(
          within(await screen.findByRole("dialog", { name: "新建产情填报" })).getByRole(
            "button",
            { name: "保存草稿" },
          ),
        );
      } else if (writeKind === "saveDraft") {
        await user.click(await screen.findByRole("button", { name: "查看" }));
        await user.click(
          within(await screen.findByRole("dialog", { name: "产情记录详情" })).getByRole(
            "button",
            { name: "保存草稿" },
          ),
        );
      } else if (writeKind === "submit") {
        await user.click(await screen.findByRole("button", { name: "提交" }));
      } else if (writeKind === "approve") {
        await user.click(await screen.findByRole("button", { name: "审核" }));
      } else {
        await user.click(await screen.findByRole("button", { name: "退回" }));
        const dialog = await screen.findByRole("dialog", { name: "退回产情记录" });
        await user.type(within(dialog).getByLabelText("退回原因"), "历史恢复竞态");
        await user.click(within(dialog).getByRole("button", { name: "确认退回" }));
      }
      const selectedWrite = {
        create,
        saveDraft,
        submit,
        approve,
        return: returnForCorrection,
      }[writeKind];
      await waitFor(() => expect(selectedWrite).toHaveBeenCalledTimes(1));

      window.history.pushState(
        null,
        "",
        "#/pages/PRODUCTION/MONITORING/SOYBEAN?pageNumber=1&pageSize=20&filter.objectTypeCode=FARMER",
      );
      window.history.back();
      await waitFor(() => expect(window.location.hash).toContain("pageNumber=0"));
      window.history.forward();

      await waitFor(() => expect(searches).toHaveLength(3));
      expect(searches.slice(1)).toEqual([
        { pageNumber: 1, values: { objectTypeCode: "FARMER" } },
        { pageNumber: 1, values: { objectTypeCode: "FARMER" } },
      ]);
      expect(latestSearches).toHaveLength(2);

      await act(async () => {
        latestSearches[1]!.resolve({
          items: [
            {
              id: "latest",
              values: { PROD_STATUS: "最新结果" },
              allowedActions: [],
              version: 1,
            },
          ],
          pageNumber: 1,
          pageSize: 20,
          totalElements: 21,
          totalPages: 2,
        });
        await Promise.resolve();
      });
      expect(await screen.findByText("最新结果")).toBeVisible();
      await act(async () => {
        latestSearches[0]!.resolve({
          items: [
            {
              id: "stale",
              values: { PROD_STATUS: "过期恢复结果" },
              allowedActions: [],
              version: 1,
            },
          ],
          pageNumber: 1,
          pageSize: 20,
          totalElements: 21,
          totalPages: 2,
        });
        await Promise.resolve();
      });

      expect(screen.getByText("最新结果")).toBeVisible();
      expect(screen.queryByText("过期恢复结果")).not.toBeInTheDocument();
      expect(window.location.hash).toBe(
        "#/pages/PRODUCTION/MONITORING/SOYBEAN?pageNumber=1&pageSize=20&filter.objectTypeCode=FARMER",
      );
    },
  );
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
      getBusinessPeriods: () => Promise.resolve([]),
      getSupplySurveyPeriods: () => Promise.resolve([]),
      getProducts: () =>
        Promise.resolve([
          { id: "SOYBEAN_FIXTURE", name: "大豆" },
          { id: "CORN_FIXTURE", name: "玉米" },
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
        Promise.resolve(
          definitionFixture(key.productCode ?? "SOYBEAN_FIXTURE", key.pageKind),
        ),
    },
    marketCollectionRepository: marketRepository(search),
    workItemRepository: {
      search: () => Promise.reject(new Error("not called")),
    },
  };
}

function marketRepository(
  search: MarketCollectionRepository["search"],
): MarketCollectionRepository {
  const unused = () => Promise.reject(new Error("not called"));
  return {
    search,
    detail: unused,
    definition: unused,
    create: unused,
    saveDraft: unused,
    submit: unused,
    approve: unused,
    returnForCorrection: unused,
  };
}

function productionRepository(
  search: ProductionRecordRepository["search"],
): ProductionRecordRepository {
  const unused = () => Promise.reject(new Error("not called"));
  return {
    search,
    detail: unused,
    definition: unused,
    create: unused,
    saveDraft: unused,
    submit: unused,
    approve: unused,
    returnForCorrection: unused,
  };
}

function definitionFixture(
  productCode: string,
  pageKind = "MONITORING",
): ListPageDefinition {
  const productName =
    productCode === "RICE_FIXTURE"
      ? "稻谷"
      : productCode === "CORN_FIXTURE"
        ? "玉米"
        : "大豆";
  return {
    key: { domain: "MARKET", pageKind, productCode },
    title: `${productName}${pageKind === "MONITORING" ? "市场采集" : "质量指标"}`,
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

function productionDefinitionFixture(): ListPageDefinition {
  return {
    key: { domain: "PRODUCTION", pageKind: "MONITORING", productCode: "SOYBEAN" },
    title: "大豆产情监测",
    breadcrumbs: [],
    filters: [
      {
        id: "objectTypeCode",
        label: "对象类型",
        control: "select",
        placeholder: "全部对象类型",
        options: [{ value: "FARMER", label: "农户" }],
      },
    ],
    defaultContext: {},
    columnGroups: [
      {
        id: "base",
        label: "基本信息",
        fields: [{ id: "PROD_STATUS", label: "状态", valueType: "TEXT" }],
      },
    ],
    actions: [{ id: "SUBMIT", label: "提交", scope: "row" }],
    pagination: { defaultPageSize: 20, pageSizeOptions: [20] },
  };
}

function productionWriteDefinitionFixture(): ListPageDefinition {
  return {
    ...productionDefinitionFixture(),
    actions: [
      { id: "NEW", label: "新建填报", scope: "page" },
      { id: "VIEW", label: "查看", scope: "row" },
      { id: "SUBMIT", label: "提交", scope: "row" },
      { id: "APPROVE", label: "审核", scope: "row" },
      { id: "RETURN", label: "退回", scope: "row" },
    ],
  };
}

function productionFormDefinitionFixture(objectTypeCode: string | null) {
  return {
    productCode: "SOYBEAN",
    objectTypeCode,
    groups: [
      { category: "QUALITY", label: "质量指标", sortOrder: 10, fields: [] },
      { category: "COST", label: "生产成本", sortOrder: 20, fields: [] },
      { category: "INSURANCE", label: "农业保险", sortOrder: 30, fields: [] },
      { category: "SUBSIDY", label: "农业补贴", sortOrder: 40, fields: [] },
    ],
  };
}

function productionDetail(status: string, version: number): ProductionRecordDetail {
  return {
    id: "record-1",
    productCode: "SOYBEAN",
    objectTypeCode: "FARMER",
    regionCode: "230202",
    cultivarCode: null,
    surveyDate: "2026-08-01",
    reportedAt: "2026-08-02T08:00:00+08:00",
    cultivatedAreaMu: "1.0000",
    yieldPerMuKilograms: "2.0000",
    estimatedOutputKilograms: "2.0000",
    status,
    returnReason: null,
    quality: {},
    costs: {},
    insurance: {},
    subsidies: {},
    allowedActions: [],
    version,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

function records(count: number, first = 1) {
  return Array.from({ length: count }, (_, index) => ({
    id: `record-${String(first + index)}`,
    values: { subjectName: `记录${String(first + index)}` },
    allowedActions: [],
    version: 0,
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
