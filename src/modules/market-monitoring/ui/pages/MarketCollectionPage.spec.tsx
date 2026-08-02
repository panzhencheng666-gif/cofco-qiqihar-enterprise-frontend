import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrictMode } from "react";
import { vi } from "vitest";

import type { MarketCollectionRepository } from "../../application/ports/MarketCollectionRepository";
import { MarketRepositoryFailure } from "../../application/ports/MarketCollectionRepository";
import type {
  MarketCoreCapability,
  MarketCoreControlType,
  MarketFormDefinition,
  MarketRecordDetail,
} from "../../domain/marketCollection";
import type {
  ListPageDefinition,
  ListQueryState,
} from "../../../../shared/application/page-definition";
import { MarketCollectionPage } from "./MarketCollectionPage";

describe("MarketCollectionPage", () => {
  it("loads its initial context and fields from the requested page definition", async () => {
    const definition: ListPageDefinition = {
      key: { domain: "MARKET", pageKind: "COLLECTION", productCode: "FIXTURE" },
      title: "测试产品采集表",
      breadcrumbs: [{ id: "market", label: "市场监测" }],
      filters: [
        {
          id: "businessDate",
          label: "采集日期",
          control: "date",
          placeholder: "选择日期",
          options: [],
        },
      ],
      defaultContext: { businessDate: "2032-04-05" },
      columnGroups: [
        {
          id: "fixture-group",
          label: "测试字段组",
          fields: [{ id: "fixture-field", label: "测试业务字段", valueType: "TEXT" }],
        },
      ],
      actions: [],
      pagination: { defaultPageSize: 20, pageSizeOptions: [20] },
    };

    render(
      <MarketCollectionPage
        loadRegionChildren={() => Promise.resolve([])}
        pageDefinitionGateway={{ getDefinition: () => Promise.resolve(definition) }}
        pageKey={definition.key}
        repository={repository(() =>
          Promise.resolve({
            items: [],
            pageNumber: 0,
            pageSize: 20,
            totalElements: 0,
            totalPages: 0,
          }),
        )}
      />,
    );

    const table = await screen.findByRole("table", { name: "测试产品采集表" });
    expect(screen.getByLabelText("采集日期")).toHaveValue("2032-04-05");
    expect(
      within(table).getByRole("columnheader", { name: "测试业务字段" }),
    ).toBeVisible();
  });

  it("runs a paging command once under StrictMode", async () => {
    const user = userEvent.setup();
    const pageDefinition = definition();
    const search = vi.fn((query: ListQueryState) =>
      Promise.resolve({
        items: [],
        pageNumber: query.pageNumber,
        pageSize: query.pageSize,
        totalElements: 21,
        totalPages: 2,
      }),
    );
    const committed = vi.fn();
    render(
      <StrictMode>
        <MarketCollectionPage
          loadRegionChildren={() => Promise.resolve([])}
          onQueryCommitted={committed}
          pageDefinitionGateway={{
            getDefinition: () => Promise.resolve(pageDefinition),
          }}
          pageKey={pageDefinition.key}
          repository={repository(search)}
        />
      </StrictMode>,
    );

    await waitFor(() => expect(search).toHaveBeenCalledTimes(1));
    await user.click(screen.getByRole("button", { name: "下一页" }));
    await waitFor(() => expect(search).toHaveBeenCalledTimes(2));
    expect(committed).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["CORN", "DEEP_PROCESSOR", "水分", "采购量"],
    ["SOYBEAN", "DEEP_PROCESSOR", "蛋白", "采购量"],
    ["RICE", "RICE_MILL", "出米率", "采购量"],
  ] as const)(
    "creates %s / %s from database core fields and ordered Chinese groups",
    async (productCode, objectTypeCode, qualityLabel, purchaseLabel) => {
      const user = userEvent.setup();
      const create = vi.fn<MarketCollectionRepository["create"]>(() =>
        Promise.resolve(detail(productCode, objectTypeCode)),
      );
      const repo = repositoryFixture({
        create,
        definition: (_product, object) =>
          Promise.resolve(formDefinition(productCode, object ?? null, qualityLabel)),
      });
      render(page(productCode, repo, actionDefinition(productCode, "NEW")));

      await user.click(await screen.findByRole("button", { name: "新建填报" }));
      const dialog = await screen.findByRole("dialog", { name: "新建市场填报" });
      expect(within(dialog).getByRole("combobox", { name: "动态对象" })).toBeVisible();
      expect(within(dialog).getByRole("combobox", { name: "动态方向" })).toBeVisible();
      expect(within(dialog).getByRole("combobox", { name: "动态包装" })).toBeVisible();
      expect(within(dialog).getByLabelText("自动成交")).toHaveAttribute("readonly");
      await user.selectOptions(
        within(dialog).getByRole("combobox", { name: "动态对象" }),
        objectTypeCode,
      );
      expect(
        await within(dialog).findByRole("group", { name: "质量指标" }),
      ).toBeVisible();
      expect(within(dialog).getByRole("group", { name: "采购与成交" })).toBeVisible();
      await user.type(within(dialog).getByLabelText(qualityLabel), "14.6");
      await user.type(within(dialog).getByLabelText(purchaseLabel), "12");
      await user.click(within(dialog).getByRole("button", { name: "保存草稿" }));

      await waitFor(() => expect(create).toHaveBeenCalledOnce());
      expect(create.mock.calls[0]?.[0]).toEqual(
        expect.objectContaining({
          productCode,
          facts: { QUALITY_DYNAMIC: "14.6", PURCHASE_VOLUME: "12" },
        }),
      );
      expect(create.mock.calls[0]?.[0].coreValues.MKT_OBJECT_TYPE).toBe(objectTypeCode);
    },
  );

  it("uses a user-entered return reason and the loaded detail version", async () => {
    const user = userEvent.setup();
    const returnForCorrection = vi.fn(() =>
      Promise.resolve(detail("SOYBEAN", "TRADER", "RETURNED", 8)),
    );
    const repo = repositoryFixture({
      search: () => Promise.resolve(rowPage("RETURN")),
      detail: () => Promise.resolve(detail("SOYBEAN", "TRADER", "PENDING_REVIEW", 7)),
      returnForCorrection,
    });
    render(page("SOYBEAN", repo, actionDefinition("SOYBEAN", "RETURN")));

    await user.click(await screen.findByRole("button", { name: "退回" }));
    const dialog = await screen.findByRole("dialog", { name: "退回市场记录" });
    await user.type(within(dialog).getByLabelText("退回原因"), "请复核采购凭证");
    await user.click(within(dialog).getByRole("button", { name: "确认退回" }));
    await waitFor(() =>
      expect(returnForCorrection).toHaveBeenCalledWith("record-1", 7, "请复核采购凭证"),
    );
  });

  it.each([
    ["AUTHENTICATION", "登录已失效，请重新登录。"],
    ["CONFLICT", "记录已被其他用户修改，请刷新后重试。"],
    ["VALIDATION", "填报内容校验失败，请检查后重试。"],
  ] as const)("shows an independent %s action alert", async (kind, message) => {
    const user = userEvent.setup();
    const repo = repositoryFixture({
      search: () => Promise.resolve(rowPage("SUBMIT")),
      submit: () => Promise.reject(new MarketRepositoryFailure(kind)),
    });
    render(page("CORN", repo, actionDefinition("CORN", "SUBMIT")));
    await user.click(await screen.findByRole("button", { name: "提交" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(message);
    expect(within(alert).getByRole("button", { name: "重试操作" })).toBeVisible();
    expect(within(alert).getByRole("button", { name: "关闭操作错误" })).toBeVisible();
  });

  it("retries only the refresh after a successful create whose refresh fails", async () => {
    const user = userEvent.setup();
    const search = vi
      .fn()
      .mockResolvedValueOnce(emptyPage())
      .mockRejectedValueOnce(new Error("refresh failed"))
      .mockResolvedValueOnce(emptyPage());
    const create = vi.fn<MarketCollectionRepository["create"]>(() =>
      Promise.resolve(detail("CORN", "FEED_MILL")),
    );
    const repo = repositoryFixture({
      search,
      create,
      definition: (_product, object) =>
        Promise.resolve(formDefinition("CORN", object ?? null, "水分")),
    });
    render(page("CORN", repo, actionDefinition("CORN", "NEW")));

    await user.click(await screen.findByRole("button", { name: "新建填报" }));
    await user.click(
      within(await screen.findByRole("dialog")).getByRole("button", {
        name: "保存草稿",
      }),
    );

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("记录已保存，但列表刷新失败");
    await user.click(within(alert).getByRole("button", { name: "重试操作" }));
    await waitFor(() => expect(search).toHaveBeenCalledTimes(3));
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("retries only the refresh after a successful submit whose refresh fails", async () => {
    const user = userEvent.setup();
    const search = vi
      .fn()
      .mockResolvedValueOnce(rowPage("SUBMIT"))
      .mockRejectedValueOnce(new Error("refresh failed"))
      .mockResolvedValueOnce(rowPage("VIEW"));
    const submit = vi.fn(() =>
      Promise.resolve(detail("CORN", "TRADER", "PENDING_REVIEW", 8)),
    );
    const repo = repositoryFixture({ search, submit });
    render(page("CORN", repo, actionDefinition("CORN", "SUBMIT")));

    await user.click(await screen.findByRole("button", { name: "提交" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("状态已变更，但列表刷新失败");
    await user.click(within(alert).getByRole("button", { name: "重试操作" }));
    await waitFor(() => expect(search).toHaveBeenCalledTimes(3));
    expect(submit).toHaveBeenCalledTimes(1);
  });

  it("retries only the refresh after a successful return whose refresh fails", async () => {
    const user = userEvent.setup();
    const search = vi
      .fn()
      .mockResolvedValueOnce(rowPage("RETURN"))
      .mockRejectedValueOnce(new Error("refresh failed"))
      .mockResolvedValueOnce(rowPage("VIEW"));
    const returnForCorrection = vi.fn(() =>
      Promise.resolve(detail("SOYBEAN", "TRADER", "RETURNED", 8)),
    );
    const repo = repositoryFixture({
      search,
      detail: () => Promise.resolve(detail("SOYBEAN", "TRADER", "PENDING_REVIEW", 7)),
      returnForCorrection,
    });
    render(page("SOYBEAN", repo, actionDefinition("SOYBEAN", "RETURN")));

    await user.click(await screen.findByRole("button", { name: "退回" }));
    const dialog = await screen.findByRole("dialog", { name: "退回市场记录" });
    await user.type(within(dialog).getByLabelText("退回原因"), "请复核采购凭证");
    await user.click(within(dialog).getByRole("button", { name: "确认退回" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("状态已变更，但列表刷新失败");
    await user.click(within(alert).getByRole("button", { name: "重试操作" }));
    await waitFor(() => expect(search).toHaveBeenCalledTimes(3));
    expect(returnForCorrection).toHaveBeenCalledTimes(1);
  });

  it("keeps the newest object definition and prunes hidden facts", async () => {
    const user = userEvent.setup();
    const first = deferred<MarketFormDefinition>();
    const second = deferred<MarketFormDefinition>();
    const create = vi.fn<MarketCollectionRepository["create"]>(() =>
      Promise.resolve(detail("SOYBEAN", "TYPE_B")),
    );
    const repo = repositoryFixture({
      create,
      definition: (_product, object) => {
        if (object === "TYPE_A") return first.promise;
        if (object === "TYPE_B") return second.promise;
        return Promise.resolve(formDefinition("SOYBEAN", null, "仅 A 字段"));
      },
    });
    render(page("SOYBEAN", repo, twoObjectDefinition()));
    await user.click(await screen.findByRole("button", { name: "新建填报" }));
    const dialog = await screen.findByRole("dialog", { name: "新建市场填报" });
    await user.type(within(dialog).getByLabelText("仅 A 字段"), "8");
    const object = within(dialog).getByRole("combobox", { name: "动态对象" });
    await user.selectOptions(object, "TYPE_A");
    await user.selectOptions(object, "TYPE_B");
    second.resolve(formDefinition("SOYBEAN", "TYPE_B", "仅 B 字段"));
    first.resolve(formDefinition("SOYBEAN", "TYPE_A", "仅 A 字段"));
    expect(await within(dialog).findByLabelText("仅 B 字段")).toBeVisible();
    expect(within(dialog).queryByLabelText("仅 A 字段")).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "保存草稿" }));
    await waitFor(() => expect(create).toHaveBeenCalledOnce());
    expect(create.mock.calls[0]?.[0].coreValues.MKT_OBJECT_TYPE).toBe("TYPE_B");
    expect(create.mock.calls[0]?.[0].facts).toEqual({});
  });

  it("ignores a deferred NEW definition after switching product context", async () => {
    const user = userEvent.setup();
    const corn = deferred<MarketFormDefinition>();
    const repo = repositoryFixture({
      definition: (product) =>
        product === "CORN"
          ? corn.promise
          : Promise.resolve(formDefinition("SOYBEAN", null, "蛋白")),
    });
    const view = render(page("CORN", repo, actionDefinition("CORN", "NEW")));
    await user.click(await screen.findByRole("button", { name: "新建填报" }));
    view.rerender(page("SOYBEAN", repo, actionDefinition("SOYBEAN", "NEW")));
    await act(async () => {
      corn.resolve(formDefinition("CORN", null, "水分"));
      await Promise.resolve();
    });
    await screen.findByRole("heading", { name: "SOYBEAN市场采集" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("guards row commands synchronously and disables actions until refresh completes", async () => {
    const pending = deferred<MarketRecordDetail>();
    const submit = vi.fn(() => pending.promise);
    const repo = repositoryFixture({
      search: () => Promise.resolve(rowPage("SUBMIT")),
      submit,
    });
    render(page("CORN", repo, actionDefinition("CORN", "SUBMIT")));
    const button = await screen.findByRole("button", { name: "提交" });

    fireEvent.click(button);
    fireEvent.click(button);

    expect(submit).toHaveBeenCalledTimes(1);
    expect(button).toBeDisabled();
    pending.resolve(detail("CORN", "TRADER", "PENDING_REVIEW", 8));
    await waitFor(() => expect(button).toBeEnabled());
  });

  it("keeps a double-click conflict to one same-version request", async () => {
    const pending = deferred<MarketRecordDetail>();
    const submit = vi.fn(() => pending.promise);
    const repo = repositoryFixture({
      search: () => Promise.resolve(rowPage("SUBMIT")),
      submit,
    });
    render(page("CORN", repo, actionDefinition("CORN", "SUBMIT")));
    const button = await screen.findByRole("button", { name: "提交" });

    fireEvent.click(button);
    fireEvent.click(button);
    expect(submit).toHaveBeenCalledTimes(1);

    pending.reject(new MarketRepositoryFailure("CONFLICT"));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "记录已被其他用户修改，请刷新后重试。",
    );
    expect(submit).toHaveBeenCalledTimes(1);
    expect(button).toBeEnabled();
  });

  it("shows an explicit definition contract error instead of silently hiding fields", async () => {
    const user = userEvent.setup();
    const repo = repositoryFixture({
      definition: () => Promise.reject(new MarketRepositoryFailure("DEFINITION")),
    });
    render(page("CORN", repo, actionDefinition("CORN", "NEW")));

    await user.click(await screen.findByRole("button", { name: "新建填报" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "市场表单定义包含不受支持的字段，请联系管理员。",
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders and submits a database-defined generic text core field", async () => {
    const user = userEvent.setup();
    const create = vi.fn<MarketCollectionRepository["create"]>(() =>
      Promise.resolve(detail("CORN", "FEED_MILL")),
    );
    const repo = repositoryFixture({
      create,
      definition: (_product, object) => {
        const definition = formDefinition("CORN", object ?? null, "水分");
        return Promise.resolve({
          ...definition,
          coreFields: [
            ...definition.coreFields,
            core("DB_SOURCE_NOTE", "数据库来源说明", "TEXT"),
          ],
        });
      },
    });
    render(page("CORN", repo, actionDefinition("CORN", "NEW")));

    await user.click(await screen.findByRole("button", { name: "新建填报" }));
    const dialog = await screen.findByRole("dialog", { name: "新建市场填报" });
    await user.type(within(dialog).getByLabelText("数据库来源说明"), "产地直采");
    await user.click(within(dialog).getByRole("button", { name: "保存草稿" }));

    await waitFor(() => expect(create).toHaveBeenCalledOnce());
    expect(create.mock.calls[0]?.[0].coreValues.DB_SOURCE_NOTE).toBe("产地直采");
  });

  it("updates the exact actual-price preview and shows server-owned reported time and descriptions", async () => {
    const user = userEvent.setup();
    const repo = repositoryFixture({
      search: () => Promise.resolve(rowPage("VIEW")),
      detail: () => Promise.resolve(detail("CORN", "TRADER")),
      definition: () => Promise.resolve(formDefinition("CORN", "TRADER", "水分", true)),
    });
    render(page("CORN", repo, actionDefinition("CORN", "VIEW")));
    await user.click(await screen.findByRole("button", { name: "提交" }));
    const dialog = await screen.findByRole("dialog", { name: "市场记录详情" });

    expect(within(dialog).getByLabelText("动态填报时间")).toHaveValue(
      "2026-08-02T08:00:00+08:00",
    );
    expect(within(dialog).getByText("采购基础价不含组成费用")).toBeVisible();
    const preview = within(dialog).getByLabelText("自动成交");
    expect(preview).toHaveValue("2420.0000");
    await user.clear(within(dialog).getByLabelText("动态车板组成"));
    expect(preview).toHaveValue("");
    await user.type(within(dialog).getByLabelText("动态车板组成"), "40");
    expect(preview).toHaveValue("2424.0000");
  });
});

function definition(): ListPageDefinition {
  return {
    key: { domain: "MARKET", pageKind: "COLLECTION", productCode: "FIXTURE" },
    title: "测试产品采集表",
    breadcrumbs: [],
    filters: [],
    defaultContext: {},
    columnGroups: [],
    actions: [],
    pagination: { defaultPageSize: 20, pageSizeOptions: [20] },
  };
}

function repository(
  search: MarketCollectionRepository["search"],
): MarketCollectionRepository {
  const unavailable = () => Promise.reject(new Error("not used"));
  return {
    search,
    detail: unavailable,
    definition: unavailable,
    create: unavailable,
    saveDraft: unavailable,
    submit: unavailable,
    approve: unavailable,
    returnForCorrection: unavailable,
  };
}

function repositoryFixture(
  overrides: Partial<MarketCollectionRepository> = {},
): MarketCollectionRepository {
  const base = repository(() => Promise.resolve(emptyPage()));
  return {
    ...base,
    definition: (_product, object) =>
      Promise.resolve(formDefinition("SOYBEAN", object ?? null, "蛋白")),
    detail: () => Promise.resolve(detail("SOYBEAN", "TRADER")),
    create: () => Promise.resolve(detail("SOYBEAN", "TRADER")),
    saveDraft: () => Promise.resolve(detail("SOYBEAN", "TRADER")),
    submit: () => Promise.resolve(detail("SOYBEAN", "TRADER", "PENDING_REVIEW", 1)),
    approve: () => Promise.resolve(detail("SOYBEAN", "TRADER", "APPROVED", 2)),
    returnForCorrection: () =>
      Promise.resolve(detail("SOYBEAN", "TRADER", "RETURNED", 2)),
    ...overrides,
  };
}

function page(
  productCode: string,
  repo: MarketCollectionRepository,
  pageDefinition: ListPageDefinition,
) {
  return (
    <MarketCollectionPage
      loadRegionChildren={() => Promise.resolve([])}
      pageDefinitionGateway={{ getDefinition: () => Promise.resolve(pageDefinition) }}
      pageKey={{ domain: "MARKET", pageKind: "MONITORING", productCode }}
      repository={repo}
    />
  );
}

function actionDefinition(productCode: string, action: string): ListPageDefinition {
  return {
    key: { domain: "MARKET", pageKind: "MONITORING", productCode },
    title: `${productCode}市场采集`,
    breadcrumbs: [],
    filters: [],
    defaultContext: {},
    columnGroups: [
      {
        id: "market",
        label: "动态市场组",
        fields: [{ id: "MKT_STATUS", label: "动态状态", valueType: "TEXT" }],
      },
    ],
    actions: [
      {
        id: action,
        label: action === "NEW" ? "新建填报" : action === "RETURN" ? "退回" : "提交",
        scope: action === "NEW" ? "page" : "row",
      },
    ],
    pagination: { defaultPageSize: 20, pageSizeOptions: [20] },
  };
}

function twoObjectDefinition() {
  return actionDefinition("SOYBEAN", "NEW");
}

function formDefinition(
  productCode: string,
  objectTypeCode: string | null,
  qualityLabel: string,
  includeMetadata = false,
): MarketFormDefinition {
  const objectOptions =
    objectTypeCode === null
      ? [
          { value: "DEEP_PROCESSOR", label: "深加工", sortOrder: 10 },
          { value: "RICE_MILL", label: "米厂", sortOrder: 20 },
          { value: "TYPE_A", label: "类型甲", sortOrder: 30 },
          { value: "TYPE_B", label: "类型乙", sortOrder: 40 },
        ]
      : [];
  return {
    productCode,
    objectTypeCode,
    coreFields: [
      core("MKT_OBJECT_TYPE", "动态对象", "SELECT", objectOptions),
      core("MKT_REGION", "动态地区", "REGION_HIERARCHY"),
      core("MKT_TRADE_DATE", "动态日期", "DATE"),
      ...(includeMetadata
        ? [core("MKT_REPORTED_AT", "动态填报时间", "READONLY_DATETIME")]
        : []),
      core("MKT_TRADE_DIRECTION", "动态方向", "SELECT", [
        { value: "PURCHASE", label: "采购", sortOrder: 10 },
        { value: "SALE", label: "销售", sortOrder: 20 },
      ]),
      core(
        "MKT_PURCHASE_BASE_PRICE",
        "动态采购基础价",
        "DECIMAL",
        [],
        includeMetadata ? "采购基础价不含组成费用" : null,
      ),
      core("MKT_SALE_BASE_PRICE", "动态销售基础价", "DECIMAL"),
      core("MKT_CARRIAGE_BOARD_AMOUNT", "动态车板组成", "DECIMAL"),
      core("MKT_PACKAGING_FORM", "动态包装", "SELECT", [
        { value: "BULK", label: "散粮", sortOrder: 10 },
      ]),
      core("MKT_PACKAGING_AMOUNT", "动态包装组成", "DECIMAL"),
      core("MKT_FREIGHT_AMOUNT", "动态运费组成", "DECIMAL"),
      core("MKT_ACTUAL_TRADE_PRICE", "自动成交", "READONLY_DECIMAL"),
    ],
    groups:
      objectTypeCode === null
        ? [group("QUALITY", "质量指标", qualityLabel, qualityCode(qualityLabel))]
        : [
            group("QUALITY", "质量指标", qualityLabel, qualityCode(qualityLabel)),
            group("PURCHASE", "采购与成交", "采购量", "PURCHASE_VOLUME"),
            { category: "SALES", label: "销售", sortOrder: 30, fields: [] },
            { category: "PROCESSING", label: "加工生产", sortOrder: 40, fields: [] },
            { category: "INVENTORY", label: "库存", sortOrder: 50, fields: [] },
          ],
  };
}

function qualityCode(label: string) {
  return label === "仅 A 字段"
    ? "A_ONLY"
    : label === "仅 B 字段"
      ? "B_ONLY"
      : "QUALITY_DYNAMIC";
}

function core(
  code: string,
  label: string,
  controlType: string,
  options: { value: string; label: string; sortOrder: number }[] = [],
  description: string | null = null,
) {
  return {
    code,
    label,
    controlType: controlType as MarketCoreControlType,
    capability: capability(code),
    required: false,
    unit: controlType.includes("DECIMAL") ? "元/吨" : null,
    description,
    precision: controlType.includes("DECIMAL") ? 18 : null,
    scale: controlType.includes("DECIMAL") ? 4 : null,
    sortOrder: 10,
    options,
  };
}

function capability(code: string): MarketCoreCapability {
  if (code === "MKT_OBJECT_TYPE") return "OBJECT_TYPE_CONTEXT";
  if (code === "MKT_TRADE_DIRECTION") return "PRICE_DIRECTION";
  if (code === "MKT_PURCHASE_BASE_PRICE") return "PURCHASE_BASE_PRICE";
  if (code === "MKT_SALE_BASE_PRICE") return "SALE_BASE_PRICE";
  if (
    code === "MKT_CARRIAGE_BOARD_AMOUNT" ||
    code === "MKT_PACKAGING_AMOUNT" ||
    code === "MKT_FREIGHT_AMOUNT"
  ) {
    return "PRICE_COMPONENT";
  }
  if (code === "MKT_ACTUAL_TRADE_PRICE") return "ACTUAL_TRADE_PRICE";
  return "GENERIC";
}

function group(category: string, label: string, fieldLabel: string, code: string) {
  return {
    category,
    label,
    sortOrder: category === "QUALITY" ? 10 : 20,
    fields: [
      {
        code,
        label: fieldLabel,
        valueType: "DECIMAL",
        unit: null,
        description: null,
        precision: 18,
        scale: 4,
        sortOrder: 10,
      },
    ],
  };
}

function detail(
  productCode: string,
  objectTypeCode: string,
  status = "DRAFT",
  version = 0,
): MarketRecordDetail {
  return {
    id: "record-1",
    productCode,
    coreValues: {
      MKT_OBJECT_TYPE: objectTypeCode,
      MKT_REGION: "230200",
      MKT_TRADE_DATE: "2026-08-01",
      MKT_REPORTED_AT: "2026-08-02T08:00:00+08:00",
      MKT_TRADE_DIRECTION: "PURCHASE",
      MKT_PURCHASE_BASE_PRICE: "2300.0000",
      MKT_SALE_BASE_PRICE: null,
      MKT_CARRIAGE_BOARD_AMOUNT: "36.0000",
      MKT_PACKAGING_AMOUNT: "12.0000",
      MKT_FREIGHT_AMOUNT: "72.0000",
      MKT_PACKAGING_FORM: "BULK",
      MKT_ACTUAL_TRADE_PRICE: "2420.0000",
    },
    facts: {},
    status,
    returnReason: null,
    allowedActions: ["VIEW", "SAVE"],
    version,
  };
}

function rowPage(action: string) {
  return {
    items: [
      {
        id: "record-1",
        values: { MKT_STATUS: "动态状态" },
        allowedActions: [action],
        version: 7,
      },
    ],
    pageNumber: 0,
    pageSize: 20,
    totalElements: 1,
    totalPages: 1,
  };
}

function emptyPage() {
  return {
    items: [],
    pageNumber: 0,
    pageSize: 20,
    totalElements: 0,
    totalPages: 0,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((next, fail) => {
    resolve = next;
    reject = fail;
  });
  return { promise, reject, resolve };
}
