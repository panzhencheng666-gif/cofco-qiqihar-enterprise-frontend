import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

import type { SupplyAccountRepository } from "../../application/ports/SupplyAccountRepository";
import { SupplyAccountPage } from "./SupplyAccountPage";

describe("SupplyAccountPage", () => {
  it("explains formula/sign, exposes approved-source reason drilldown, and runs with mandatory reasons", async () => {
    const user = userEvent.setup();
    const run = vi.fn<SupplyAccountRepository["run"]>(() => Promise.resolve(account));
    const repository: SupplyAccountRepository = {
      find: () => Promise.resolve([account]),
      run,
    };
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    render(
      <SupplyAccountPage
        loadRegionChildren={() => Promise.resolve([])}
        pageDefinitionGateway={{ getDefinition: () => Promise.resolve(definition) }}
        pageKey={{ domain: "SUPPLY", pageKind: "ACCOUNT", productCode: "RICE" }}
        repository={repository}
        routeQuery={{ values: { regionCode: "230200", marketingYear: "2026/27" } }}
      />,
    );

    expect(await screen.findByRole("heading", { name: /供需平衡账户/ })).toBeVisible();
    expect(
      screen.getAllByText(/SURVEYED_ENDING_INVENTORY - ADOPTED_ENDING_INVENTORY/),
    ).toHaveLength(2);
    expect(screen.getByText("-0.250")).toBeVisible();
    expect(screen.getByText("采用核定物流来源")).toBeVisible();
    expect(screen.getByText("APPROVED / PASSED")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "查看来源" }));
    expect(open).toHaveBeenCalledWith(
      "/api/v1/logistics-records/event-1",
      "_blank",
      "noopener,noreferrer",
    );

    await user.click(screen.getByRole("button", { name: "重新计算" }));
    expect(screen.getByRole("button", { name: "执行计算" })).toBeDisabled();
    await user.type(
      screen.getByRole("textbox", { name: "来源采用理由" }),
      "采用核定来源",
    );
    await user.type(
      screen.getByRole("textbox", { name: "调整理由" }),
      "库存差异经复核",
    );
    await user.click(screen.getByRole("button", { name: "执行计算" }));
    await waitFor(() =>
      expect(run).toHaveBeenCalledWith(
        expect.objectContaining({
          productCode: "RICE",
          regionCode: "230200",
          marketingYear: "2026/27",
          adoptionReason: "采用核定来源",
          adjustmentReason: "库存差异经复核",
          expectedDecisionVersion: 0,
        }),
      ),
    );
    open.mockRestore();
  });

  it("does not let a late account response replace the newly selected product", async () => {
    let resolveRice!: (value: readonly [typeof account]) => void;
    const rice = new Promise<readonly [typeof account]>((resolve) => {
      resolveRice = resolve;
    });
    const cornAccount = {
      ...account,
      productCode: "CORN",
      sources: [{ ...account.sources[0], reason: "玉米当前来源" }],
    } as const;
    const repository: SupplyAccountRepository = {
      find: (criteria) =>
        criteria.productCode === "RICE" ? rice : Promise.resolve([cornAccount]),
      run: () => Promise.reject(new Error("not called")),
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
        repository={repository}
        routeQuery={{ values: { regionCode: "230200", marketingYear: "2026/27" } }}
      />,
    );
    view.rerender(
      <SupplyAccountPage
        loadRegionChildren={() => Promise.resolve([])}
        pageDefinitionGateway={gateway}
        pageKey={{ domain: "SUPPLY", pageKind: "ACCOUNT", productCode: "CORN" }}
        repository={repository}
        routeQuery={{ values: { regionCode: "230200", marketingYear: "2026/27" } }}
      />,
    );
    expect(await screen.findByText("玉米当前来源")).toBeVisible();
    resolveRice([account]);
    await waitFor(() => expect(screen.getByText("玉米当前来源")).toBeVisible());
    expect(screen.queryByText("采用核定物流来源")).not.toBeInTheDocument();
  });
});

const account = {
  id: "run-1",
  productCode: "RICE",
  regionCode: "230200",
  marketingYear: "2026/27",
  resultVersion: 1,
  decisionVersion: 0,
  resultState: "FORMAL",
  validationCodes: [],
  totalSupply: "10.000",
  totalUse: "8.000",
  calculatedEndingInventory: "2.000",
  approvedAdjustment: "1.000",
  adoptedEndingInventory: "3.000",
  surveyedEndingInventory: "2.750",
  inventoryReconciliationDifference: "-0.250",
  balanced: true,
  publishable: true,
  balanceReason: "WITHIN_TOLERANCE",
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
      id: "marketingYear",
      label: "营销年度",
      control: "text" as const,
      placeholder: "请输入营销年度",
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
    { id: "ADJUST", label: "声明采用/调整", scope: "page" as const },
  ],
  pagination: { defaultPageSize: 20, pageSizeOptions: [20] },
};
