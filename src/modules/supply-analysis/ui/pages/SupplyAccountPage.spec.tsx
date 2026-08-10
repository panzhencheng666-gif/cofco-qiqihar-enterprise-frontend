import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

import type { SupplyAccountRepository } from "../../application/ports/SupplyAccountRepository";
import { SupplyAccountPage } from "./SupplyAccountPage";

describe("SupplyAccountPage", () => {
  it("explains formula/sign, exposes approved-source reason drilldown, and runs with mandatory reasons", async () => {
    const user = userEvent.setup();
    const run = vi.fn<SupplyAccountRepository["run"]>(() => Promise.resolve(account));
    const repository: SupplyAccountRepository = {
      approveManualInput: () => Promise.resolve(),
      createInputSet: () => Promise.resolve(inputSet),
      find: () => Promise.resolve([account]),
      loadInputWorkspace: () => Promise.resolve(workspace),
      releaseSource: () => Promise.resolve(),
      run,
    };
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    render(
      <SupplyAccountPage
        loadRegionChildren={() => Promise.resolve([])}
        pageDefinitionGateway={{ getDefinition: () => Promise.resolve(definition) }}
        pageKey={{ domain: "SUPPLY", pageKind: "ACCOUNT", productCode: "RICE" }}
        periodRepository={periodRepository}
        repository={repository}
        routeQuery={{ values: { regionCode: "230200", periodCode: "2026-Q3" } }}
      />,
    );

    expect(await screen.findByRole("heading", { name: /供需平衡账户/ })).toBeVisible();
    expect(screen.getAllByText(/调查期末库存 － 采用后账面期末库存/)).toHaveLength(2);
    expect(
      screen.queryByText(/SURVEYED_ENDING_INVENTORY|ADOPTED_ENDING_INVENTORY/),
    ).not.toBeInTheDocument();
    expect(screen.getByText("-0.250")).toBeVisible();
    expect(screen.getByText("采用核定物流来源")).toBeVisible();
    expect(screen.getByText("已审核 · 数据质量通过")).toBeVisible();
    expect(screen.getAllByText("已发布").length).toBeGreaterThan(0);
    expect(screen.getByText(/库存差额在允许范围内/)).toBeVisible();
    expect(screen.queryByText("FORMAL")).not.toBeInTheDocument();
    expect(screen.queryByText("WITHIN_TOLERANCE")).not.toBeInTheDocument();
    expect(screen.getByText(/正式批准调整/)).toBeVisible();
    expect(screen.queryByText(/试算调整建议/)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "查看来源" }));
    expect(open).toHaveBeenCalledWith(
      "/api/v1/logistics-records/event-1",
      "_blank",
      "noopener,noreferrer",
    );

    await user.click(screen.getByRole("button", { name: "重新计算" }));
    expect(screen.getByRole("button", { name: "执行计算" })).toBeDisabled();
    await user.type(
      screen.getByRole("textbox", { name: "调整建议理由" }),
      "库存差异经复核",
    );
    await user.click(screen.getByRole("button", { name: "执行计算" }));
    await waitFor(() =>
      expect(run).toHaveBeenCalledWith(
        expect.objectContaining({
          productCode: "RICE",
          regionCode: "230200",
          periodCode: "2026-Q3",
          inputSetId: "input-set-1",
          adjustmentProposalReason: "库存差异经复核",
          expectedDecisionVersion: 0,
        }),
      ),
    );
    open.mockRestore();
  });

  it("does not let a late account response replace the newly selected product", async () => {
    const user = userEvent.setup();
    let resolveRice!: (value: readonly [typeof account]) => void;
    const rice = new Promise<readonly [typeof account]>((resolve) => {
      resolveRice = resolve;
    });
    const cornAccount = {
      ...account,
      productCode: "CORN",
      regionCode: "230201",
      periodCode: "2027-Q1",
      surveyYear: 2027,
      surveyQuarter: "Q1",
      marketingYear: "2027/28",
      inputSetId: "input-set-corn",
      decisionVersion: 5,
      sources: [{ ...account.sources[0], reason: "玉米当前来源" }],
    } as const;
    const run = vi.fn<SupplyAccountRepository["run"]>(() =>
      Promise.resolve(cornAccount),
    );
    const repository: SupplyAccountRepository = {
      approveManualInput: () => Promise.resolve(),
      createInputSet: () => Promise.resolve(inputSet),
      find: (criteria) =>
        criteria.productCode === "RICE" ? rice : Promise.resolve([cornAccount]),
      loadInputWorkspace: (criteria) =>
        Promise.resolve({
          ...workspace,
          productCode: criteria.productCode,
          regionCode: criteria.regionCode,
          periodCode: criteria.periodCode,
          surveyYear: criteria.periodCode === "2027-Q1" ? 2027 : 2026,
          surveyQuarter: criteria.periodCode === "2027-Q1" ? "Q1" : "Q3",
          marketingYear: criteria.periodCode === "2027-Q1" ? "2027/28" : "2026/27",
        }),
      releaseSource: () => Promise.resolve(),
      run,
    };
    const gateway = {
      getDefinition: (key: typeof definition.key) =>
        Promise.resolve({
          ...definition,
          key,
          title: key.productCode === "RICE" ? "稻谷供需账户" : "玉米供需账户",
        }),
    };
    const view = render(
      <SupplyAccountPage
        loadRegionChildren={() => Promise.resolve([])}
        pageDefinitionGateway={gateway}
        pageKey={{ domain: "SUPPLY", pageKind: "ACCOUNT", productCode: "RICE" }}
        periodRepository={periodRepository}
        repository={repository}
        routeQuery={{ values: { regionCode: "230200", periodCode: "2026-Q3" } }}
      />,
    );
    view.rerender(
      <SupplyAccountPage
        loadRegionChildren={() => Promise.resolve([])}
        pageDefinitionGateway={gateway}
        pageKey={{ domain: "SUPPLY", pageKind: "ACCOUNT", productCode: "CORN" }}
        periodRepository={periodRepository}
        repository={repository}
        routeQuery={{ values: { regionCode: "230201", periodCode: "2027-Q1" } }}
      />,
    );
    expect(await screen.findByText("玉米当前来源")).toBeVisible();
    resolveRice([account]);
    await waitFor(() => expect(screen.getByText("玉米当前来源")).toBeVisible());
    expect(screen.queryByText("采用核定物流来源")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "重新计算" }));
    await user.type(
      screen.getByRole("textbox", { name: "调整建议理由" }),
      "玉米本期调整建议",
    );
    await user.click(screen.getByRole("button", { name: "执行计算" }));
    await waitFor(() =>
      expect(run).toHaveBeenCalledWith(
        expect.objectContaining({
          productCode: "CORN",
          regionCode: "230201",
          periodCode: "2027-Q1",
          inputSetId: "input-set-corn",
          expectedDecisionVersion: 5,
        }),
      ),
    );
  });

  it("builds an explicit input set from database-owned roles and released sources", async () => {
    const user = userEvent.setup();
    const createInputSet = vi.fn<SupplyAccountRepository["createInputSet"]>(() =>
      Promise.resolve(inputSet),
    );
    const repository: SupplyAccountRepository = {
      approveManualInput: () => Promise.resolve(),
      createInputSet,
      find: () => Promise.resolve([account]),
      loadInputWorkspace: () => Promise.resolve(workspace),
      releaseSource: () => Promise.resolve(),
      run: () => Promise.resolve(account),
    };
    render(
      <SupplyAccountPage
        loadRegionChildren={() => Promise.resolve([])}
        pageDefinitionGateway={{ getDefinition: () => Promise.resolve(definition) }}
        pageKey={{ domain: "SUPPLY", pageKind: "ACCOUNT", productCode: "RICE" }}
        periodRepository={periodRepository}
        repository={repository}
        routeQuery={{ values: { regionCode: "230200", periodCode: "2026-Q3" } }}
      />,
    );

    await user.click(await screen.findByRole("button", { name: "确认数据来源" }));
    expect(screen.getByRole("heading", { name: "确认供需数据来源" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "区域外流入" })).toBeVisible();
    expect(screen.getByText("物流监测 · 1.0000 万吨 · 数据质量通过")).toBeVisible();
    expect(screen.queryByText("LOGISTICS")).not.toBeInTheDocument();
    expect(screen.queryByText("SUPPLY")).not.toBeInTheDocument();
    expect(screen.getByText("暂无可采用的已审核来源")).toBeVisible();
    expect(screen.queryByLabelText("其他供给人工核定值")).not.toBeInTheDocument();
    const otherSupply = screen
      .getByRole("heading", { name: "其他供给" })
      .closest("section");
    expect(otherSupply).not.toBeNull();
    await user.click(
      within(otherSupply!).getByText("没有合适来源？填写拟采用数值", {
        selector: "summary",
      }),
    );
    expect(screen.getByLabelText("其他供给拟采用数值")).toBeVisible();
    expect(screen.getByLabelText("其他供给调整原因与数据出处")).toBeVisible();
    expect(screen.queryByText("人工核定值")).not.toBeInTheDocument();
    expect(screen.queryByText("核定依据")).not.toBeInTheDocument();
    await user.type(
      screen.getByRole("textbox", { name: "本次数据来源说明" }),
      "采用已审核来源",
    );
    await user.click(screen.getByRole("button", { name: "确认本次数据来源" }));

    await waitFor(() =>
      expect(createInputSet).toHaveBeenCalledWith({
        productCode: "RICE",
        regionCode: "230200",
        periodCode: "2026-Q3",
        reason: "采用已审核来源",
        expectedVersion: 1,
        items: [{ roleCode: "EXTERNAL_INFLOW", sourceReleaseId: "release-1" }],
      }),
    );
  });

  it("loads period options from master data and restores the selected historical version", async () => {
    const user = userEvent.setup();
    const q3v1 = {
      ...account,
      id: "q3-v1",
      inventoryReconciliationDifference: "-1.250",
    } as const;
    const q3v2 = {
      ...account,
      id: "q3-v2",
      resultVersion: 2,
      supersedesResultVersion: 1,
      inventoryReconciliationDifference: "-0.125",
    } as const;
    const q1v1 = {
      ...account,
      id: "q1-v1",
      periodCode: "2027-Q1",
      surveyYear: 2027,
      surveyQuarter: "Q1",
      marketingYear: "2027/28",
      inventoryReconciliationDifference: "0.375",
    } as const;
    const find = vi.fn<SupplyAccountRepository["find"]>((criteria) =>
      Promise.resolve(criteria.periodCode === "2027-Q1" ? [q1v1] : [q3v2, q3v1]),
    );
    const repository: SupplyAccountRepository = {
      approveManualInput: () => Promise.resolve(),
      createInputSet: () => Promise.resolve(inputSet),
      find,
      loadInputWorkspace: (criteria) =>
        Promise.resolve({
          ...workspace,
          periodCode: criteria.periodCode,
          surveyYear: criteria.periodCode === "2027-Q1" ? 2027 : 2026,
          surveyQuarter: criteria.periodCode === "2027-Q1" ? "Q1" : "Q3",
          marketingYear: criteria.periodCode === "2027-Q1" ? "2027/28" : "2026/27",
        }),
      releaseSource: () => Promise.resolve(),
      run: () => Promise.resolve(q3v2),
    };
    const renderPage = (routeQuery: { values: Record<string, string> }) =>
      render(
        <SupplyAccountPage
          loadRegionChildren={() => Promise.resolve([])}
          pageDefinitionGateway={{ getDefinition: () => Promise.resolve(definition) }}
          pageKey={{ domain: "SUPPLY", pageKind: "ACCOUNT", productCode: "RICE" }}
          periodRepository={periodRepository}
          repository={repository}
          routeQuery={routeQuery}
        />,
      );

    const first = renderPage({ values: { regionCode: "230200", periodCode: "2026-Q3" } });
    expect(await screen.findByText("-0.125")).toBeVisible();
    expect(screen.getByRole("option", { name: /2026年第三季度/ })).toBeVisible();
    expect(screen.getByText(/当前范围：产品 RICE；调查期间 2026年 Q3；营销年度2026\/27/)).toBeVisible();

    await user.selectOptions(screen.getByLabelText("历史结果版本"), "q3-v1");
    expect(await screen.findByText("-1.250")).toBeVisible();
    first.unmount();

    const restored = renderPage({
      values: { regionCode: "230200", periodCode: "2026-Q3", version: "q3-v1" },
    });
    expect(await screen.findByText("-1.250")).toBeVisible();
    await user.selectOptions(screen.getByLabelText("调查期间"), "2027-Q1");
    await user.click(screen.getByRole("button", { name: "查询" }));
    expect(await screen.findByText("0.375")).toBeVisible();
    expect(screen.getByText(/调查期间 2027年 Q1；营销年度2027\/28/)).toBeVisible();
    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({ periodCode: "2027-Q1" }),
    );
    restored.unmount();
  });
});

const account = {
  id: "run-1",
  productCode: "RICE",
  regionCode: "230200",
  periodCode: "2026-Q3",
  surveyYear: 2026,
  surveyQuarter: "Q3",
  periodPrecision: "QUARTER",
  marketingYear: "2026/27",
  resultVersion: 1,
  supersedesResultVersion: null,
  decisionVersion: 0,
  resultState: "PUBLISHED",
  temporalGovernanceState: "CONFIRMED",
  validationCodes: [],
  totalSupply: "10.000",
  totalUse: "8.000",
  calculatedEndingInventory: "2.000",
  approvedAdjustment: "1.000",
  adoptedEndingInventory: "3.000",
  surveyedEndingInventory: "2.750",
  inventoryReconciliationDifference: "-0.250",
  inputSetId: "input-set-1",
  legacyReadOnly: false,
  balanced: true,
  publishable: true,
  balanceReason: "WITHIN_TOLERANCE",
  adjustmentProposal: null,
  adjustmentAudit: {
    value: "1.000",
    reason: "库存差异经复核",
    actor: "reviewer",
    decidedAt: "2026-08-03T00:00:00Z",
    decisionVersion: 0,
  },
  formula: {
    code: "SUPPLY_BALANCE",
    version: 1,
    name: "供需平衡账户",
    precision: 18,
    scale: 3,
    roundingMode: "HALF_UP",
    tolerance: "0.500",
    differenceCode: "INVENTORY_RECONCILIATION_DIFFERENCE",
    differenceLabel: "库存核对差额（调查期末库存－采用后账面期末库存）",
    differenceExpression: "SURVEYED_ENDING_INVENTORY - ADOPTED_ENDING_INVENTORY",
    expressions: [
      {
        resultCode: "INVENTORY_RECONCILIATION_DIFFERENCE",
        label: "库存核对差额",
        expression: "SURVEYED_ENDING_INVENTORY - ADOPTED_ENDING_INVENTORY",
        sortOrder: 50,
      },
    ],
  },
  sources: [
    {
      roleCode: "EXTERNAL_INFLOW",
      roleLabel: "区域外流入",
      groupCode: "SUPPLY",
      sourceDomain: "LOGISTICS",
      sourceRecordId: "event-1",
      sourceVersion: 2,
      sourceFieldCode: "ROUTE_VOLUME",
      unitCode: "万吨",
      approvalState: "APPROVED",
      approvedAt: "2026-08-03T00:00:00Z",
      qualityState: "PASSED",
      sourceValue: "1.0000",
      adoptedValue: "1.0000",
      reason: "采用核定物流来源",
      drillDownRoute: "/api/v1/logistics-records/event-1",
    },
  ],
} as const;
const workspace = {
  productCode: "RICE",
  regionCode: "230200",
  periodCode: "2026-Q3",
  surveyYear: 2026,
  surveyQuarter: "Q3",
  periodPrecision: "QUARTER",
  marketingYear: "2026/27",
  inputSetVersion: 1,
  latestInputSetId: "input-set-1",
  decisionVersion: 0,
  roles: [
    {
      code: "EXTERNAL_INFLOW",
      label: "区域外流入",
      groupCode: "SUPPLY",
      required: true,
      sortOrder: 30,
      manualAllowed: true,
      manualDecisionVersion: 0,
      selectedReleaseId: "release-1",
      releases: [
        {
          id: "release-1",
          sourceDomain: "LOGISTICS",
          sourceRecordId: "event-1",
          sourceVersion: 2,
          sourceFieldCode: "ROUTE_VOLUME",
          value: "1.0000",
          unitCode: "万吨",
          qualityState: "PASSED",
          approvedAt: "2026-08-03T00:00:00Z",
        },
      ],
    },
    {
      code: "OTHER_SUPPLY",
      label: "其他供给",
      groupCode: "SUPPLY",
      required: false,
      sortOrder: 40,
      manualAllowed: true,
      manualDecisionVersion: 0,
      selectedReleaseId: null,
      releases: [],
    },
  ],
} as const;
const inputSet = {
  id: "input-set-2",
  version: 2,
  productCode: "RICE",
  regionCode: "230200",
  periodCode: "2026-Q3",
  surveyYear: 2026,
  surveyQuarter: "Q3",
  periodPrecision: "QUARTER",
  marketingYear: "2026/27",
} as const;
const definition = {
  key: { domain: "SUPPLY", pageKind: "ACCOUNT", productCode: "RICE" },
  title: "稻谷供需账户",
  breadcrumbs: [{ id: "SUPPLY", label: "供需分析" }],
  filters: [
    {
      id: "regionCode",
      label: "地区",
      control: "region-hierarchy" as const,
      placeholder: "请选择地区",
      options: [],
    },
    {
      id: "periodCode",
      label: "调查期间",
      control: "select" as const,
      placeholder: "请选择调查年度或季度",
      options: [],
    },
    {
      id: "version",
      label: "结果版本",
      control: "text" as const,
      placeholder: "请输入结果版本",
      options: [],
    },
  ],
  defaultContext: {},
  columnGroups: [
    {
      id: "LEDGER",
      label: "供需账户",
      fields: [
        { id: "SUP_ITEM", label: "供需账户项目", valueType: "TEXT" },
        { id: "SUP_SOURCE_VALUE", label: "来源值", valueType: "DECIMAL" },
        { id: "SUP_ADOPTED_VALUE", label: "采用值", valueType: "DECIMAL" },
        { id: "SUP_REASON", label: "采用调整理由", valueType: "TEXT" },
        { id: "SUP_SOURCE_STATUS", label: "来源状态", valueType: "TEXT" },
      ],
    },
  ],
  actions: [
    { id: "VIEW_SOURCE", label: "查看来源", scope: "row" as const },
    { id: "RUN", label: "重新计算", scope: "page" as const },
    { id: "ADJUST", label: "确认数据来源", scope: "page" as const },
  ],
  pagination: { defaultPageSize: 20, pageSizeOptions: [20] },
};

const periodRepository = {
  getSupplySurveyPeriods: () =>
    Promise.resolve([
      {
        id: "2026",
        name: "2026年度",
        surveyYear: 2026,
        surveyQuarter: null,
        precision: "YEAR" as const,
        marketingYearCode: "2026/27",
        marketingYearName: "2026/27营销年度",
      },
      {
        id: "2026-Q3",
        name: "2026年第三季度",
        surveyYear: 2026,
        surveyQuarter: "Q3" as const,
        precision: "QUARTER" as const,
        marketingYearCode: "2026/27",
        marketingYearName: "2026/27营销年度",
      },
      {
        id: "2027-Q1",
        name: "2027年第一季度",
        surveyYear: 2027,
        surveyQuarter: "Q1" as const,
        precision: "QUARTER" as const,
        marketingYearCode: "2027/28",
        marketingYearName: "2027/28营销年度",
      },
    ]),
};
