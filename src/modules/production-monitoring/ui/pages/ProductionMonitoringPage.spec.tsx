import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ProductionMonitoringPage } from "./ProductionMonitoringPage";
import type { ProductionRecordRepository } from "../../application/ports/ProductionRecordRepository";
import type { ProductionRecordDetail } from "../../domain/productionRecord";

describe("ProductionMonitoringPage", () => {
  it("uses one dynamic workbench for corn soybean and rice definitions", async () => {
    const definitions = new Map([
      ["CORN", definition("CORN", "玉米产情监测")],
      ["SOYBEAN", definition("SOYBEAN", "大豆产情监测")],
      ["RICE", definition("RICE", "稻谷产情监测")],
    ]);
    const { rerender } = render(
      <ProductionMonitoringPage
        loadRegionChildren={() => Promise.resolve([])}
        pageDefinitionGateway={{
          getDefinition: (key) => Promise.resolve(definitions.get(key.productCode!)!),
        }}
        pageKey={{ domain: "PRODUCTION", pageKind: "MONITORING", productCode: "CORN" }}
        repository={repositoryFixture()}
      />,
    );
    expect(
      await screen.findByRole("heading", { name: "玉米产情监测" }),
    ).toBeInTheDocument();

    rerender(
      <ProductionMonitoringPage
        loadRegionChildren={() => Promise.resolve([])}
        pageDefinitionGateway={{
          getDefinition: (key) => Promise.resolve(definitions.get(key.productCode!)!),
        }}
        pageKey={{
          domain: "PRODUCTION",
          pageKind: "MONITORING",
          productCode: "SOYBEAN",
        }}
        repository={repositoryFixture()}
      />,
    );
    expect(
      await screen.findByRole("heading", { name: "大豆产情监测" }),
    ).toBeInTheDocument();
  });

  it("renders only allowed database actions and dispatches real submit with version", async () => {
    const user = userEvent.setup();
    const submit = vi.fn(() => Promise.resolve(detail("PENDING_REVIEW", 8)));
    const repository = repositoryFixture({
      search: () =>
        Promise.resolve({
          items: [
            {
              id: "record-1",
              values: { PROD_STATUS: "草稿" },
              allowedActions: ["VIEW", "SUBMIT"],
              version: 7,
            },
          ],
          pageNumber: 0,
          pageSize: 20,
          totalElements: 1,
          totalPages: 1,
        }),
      submit,
    });

    render(
      <ProductionMonitoringPage
        loadRegionChildren={() => Promise.resolve([])}
        pageDefinitionGateway={{
          getDefinition: () => Promise.resolve(actionDefinition()),
        }}
        pageKey={{
          domain: "PRODUCTION",
          pageKind: "MONITORING",
          productCode: "SOYBEAN",
        }}
        repository={repository}
      />,
    );

    await user.click(await screen.findByRole("button", { name: "提交" }));
    await waitFor(() => expect(submit).toHaveBeenCalledWith("record-1", 7));
    expect(screen.queryByRole("button", { name: "审核" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "退回" })).not.toBeInTheDocument();
  });

  it("creates a draft from database fact definitions", async () => {
    const user = userEvent.setup();
    const create = vi.fn(() => Promise.resolve(detail("DRAFT", 0)));
    const repository = repositoryFixture({ create });
    render(
      <ProductionMonitoringPage
        loadRegionChildren={(parent) =>
          Promise.resolve(
            parent ? [] : [{ id: "230202", label: "龙沙区", level: "COUNTY" }],
          )
        }
        pageDefinitionGateway={{
          getDefinition: () => Promise.resolve(actionDefinition()),
        }}
        pageKey={{
          domain: "PRODUCTION",
          pageKind: "MONITORING",
          productCode: "SOYBEAN",
        }}
        repository={repository}
      />,
    );

    await user.click(await screen.findByRole("button", { name: "新建填报" }));
    const dialog = await screen.findByRole("dialog", { name: "新建产情填报" });
    expect(dialog).toBeVisible();
    await user.selectOptions(
      within(dialog).getByRole("combobox", { name: "对象类型" }),
      "FARMER",
    );
    await user.selectOptions(
      await screen.findByRole("combobox", { name: "地区 第1级" }),
      "230202",
    );
    await user.type(screen.getByLabelText("调查日期"), "2026-08-01");
    await user.type(screen.getByLabelText("种植面积（亩）"), "1.0000");
    await user.type(screen.getByLabelText("亩产（公斤/亩）"), "2.0000");
    await user.type(screen.getByLabelText("测试成本"), "3.0000");
    await user.click(screen.getByRole("button", { name: "保存草稿" }));

    await waitFor(() =>
      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({
          productCode: "SOYBEAN",
          objectTypeCode: "FARMER",
          regionCode: "230202",
          costs: { COST_TEST: "3.0000" },
        }),
      ),
    );
  });

  it("loads VIEW details and sends PUT with the loaded version and dynamic facts", async () => {
    const user = userEvent.setup();
    const saveDraft = vi.fn(() => Promise.resolve(detail("DRAFT", 8)));
    const repository = repositoryWithRow("VIEW", { saveDraft });
    renderPage(repository);

    await user.click(await screen.findByRole("button", { name: "查看" }));
    const dialog = await screen.findByRole("dialog", { name: "产情记录详情" });
    const cost = within(dialog).getByLabelText("测试成本");
    await user.clear(cost);
    await user.type(cost, "9.5000");
    await user.click(within(dialog).getByRole("button", { name: "保存草稿" }));

    await waitFor(() =>
      expect(saveDraft).toHaveBeenCalledWith(
        "record-1",
        7,
        expect.objectContaining({ costs: { COST_TEST: "9.5000" } }),
      ),
    );
  });

  it("dispatches approve and return with the row/detail versions", async () => {
    const user = userEvent.setup();
    const approve = vi.fn(() => Promise.resolve(detail("APPROVED", 8)));
    const approvedRepository = repositoryWithRow("APPROVE", { approve });
    const view = renderPage(approvedRepository);
    await user.click(await screen.findByRole("button", { name: "审核" }));
    await waitFor(() => expect(approve).toHaveBeenCalledWith("record-1", 7));

    view.unmount();
    const returnForCorrection = vi.fn(() => Promise.resolve(detail("RETURNED", 8)));
    renderPage(repositoryWithRow("RETURN", { returnForCorrection }));
    await user.click(await screen.findByRole("button", { name: "退回" }));
    const dialog = await screen.findByRole("dialog", { name: "退回产情记录" });
    await user.type(within(dialog).getByLabelText("退回原因"), "数据需复核");
    await user.click(within(dialog).getByRole("button", { name: "确认退回" }));
    await waitFor(() =>
      expect(returnForCorrection).toHaveBeenCalledWith("record-1", 7, "数据需复核"),
    );
  });

  it.each([
    [401, "登录已失效，请重新登录。"],
    [409, "记录已被其他用户修改，请刷新后重试。"],
  ])("shows a stable action error for HTTP %s", async (status, message) => {
    const user = userEvent.setup();
    const repository = repositoryWithRow("SUBMIT", {
      submit: () =>
        Promise.reject(Object.assign(new Error("write failed"), { status })),
    });
    renderPage(repository);

    await user.click(await screen.findByRole("button", { name: "提交" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(message);
  });
});

function renderPage(repository: ProductionRecordRepository) {
  return render(
    <ProductionMonitoringPage
      loadRegionChildren={() => Promise.resolve([])}
      pageDefinitionGateway={{
        getDefinition: () => Promise.resolve(actionDefinition()),
      }}
      pageKey={{
        domain: "PRODUCTION",
        pageKind: "MONITORING",
        productCode: "SOYBEAN",
      }}
      repository={repository}
    />,
  );
}

function repositoryWithRow(
  action: "VIEW" | "SUBMIT" | "APPROVE" | "RETURN",
  overrides: Partial<ProductionRecordRepository> = {},
) {
  return repositoryFixture({
    search: () =>
      Promise.resolve({
        items: [
          {
            id: "record-1",
            values: { PROD_STATUS: "草稿" },
            allowedActions: [action],
            version: 7,
          },
        ],
        pageNumber: 0,
        pageSize: 20,
        totalElements: 1,
        totalPages: 1,
      }),
    detail: () => Promise.resolve(detail("DRAFT", 7)),
    ...overrides,
  });
}

function repositoryFixture(
  overrides: Partial<ProductionRecordRepository> = {},
): ProductionRecordRepository {
  return {
    search: () =>
      Promise.resolve({
        items: [],
        pageNumber: 0,
        pageSize: 20,
        totalElements: 0,
        totalPages: 0,
      }),
    detail: () => Promise.resolve(detail("DRAFT", 0)),
    definition: () =>
      Promise.resolve({
        productCode: "SOYBEAN",
        objectTypeCode: null,
        groups: [
          { category: "QUALITY", fields: [] },
          {
            category: "COST",
            fields: [
              {
                code: "COST_TEST",
                label: "测试成本",
                valueType: "DECIMAL",
                unit: null,
                description: null,
                precision: 18,
                scale: 4,
              },
            ],
          },
          { category: "INSURANCE", fields: [] },
          { category: "SUBSIDY", fields: [] },
        ],
      }),
    create: () => Promise.resolve(detail("DRAFT", 0)),
    saveDraft: () => Promise.resolve(detail("DRAFT", 1)),
    submit: () => Promise.resolve(detail("PENDING_REVIEW", 1)),
    approve: () => Promise.resolve(detail("APPROVED", 2)),
    returnForCorrection: () => Promise.resolve(detail("RETURNED", 2)),
    ...overrides,
  };
}

function detail(status: string, version: number): ProductionRecordDetail {
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
    costs: { COST_TEST: "3.0000" },
    insurance: {},
    subsidies: {},
    allowedActions: status === "DRAFT" ? ["SAVE", "SUBMIT"] : [],
    version,
  };
}

function definition(productCode: string, title: string) {
  return {
    key: { domain: "PRODUCTION", pageKind: "MONITORING", productCode },
    title,
    breadcrumbs: [],
    filters: [],
    defaultContext: {},
    columnGroups: [],
    actions: [],
    pagination: { defaultPageSize: 20, pageSizeOptions: [20] },
  } as const;
}

function actionDefinition() {
  return {
    ...definition("SOYBEAN", "大豆产情监测"),
    filters: [
      {
        id: "objectTypeCode",
        label: "对象类型",
        control: "select",
        placeholder: "全部对象类型",
        options: [{ value: "FARMER", label: "农户" }],
      },
    ],
    columnGroups: [
      {
        id: "report",
        label: "填报信息",
        fields: [{ id: "PROD_STATUS", label: "状态", valueType: "TEXT" }],
      },
    ],
    actions: [
      { id: "NEW", label: "新建填报", scope: "page" },
      { id: "VIEW", label: "查看", scope: "row" },
      { id: "SUBMIT", label: "提交", scope: "row" },
      { id: "APPROVE", label: "审核", scope: "row" },
      { id: "RETURN", label: "退回", scope: "row" },
    ],
  } as const;
}
