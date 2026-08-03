import { expect, test } from "@playwright/test";

test("logistics review and supply provenance calculation close one Chromium workflow", async ({
  page,
}) => {
  let logisticsStatus = "DRAFT";
  let logisticsVersion = 7;
  let logisticsCreateBody: Record<string, unknown> | undefined;
  let runBody: Record<string, unknown> | undefined;
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const json = (body: unknown, status = 200) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(body),
      });
    if (url.pathname === "/api/v1/master-data/products")
      return json({ data: products });
    if (url.pathname === "/api/v1/regions")
      return json({
        data: [{ id: "230200", label: "齐齐哈尔市", level: "PREFECTURE" }],
      });
    if (url.pathname === "/api/v1/regions/230200/path")
      return json({
        data: [{ id: "230200", label: "齐齐哈尔市", level: "PREFECTURE" }],
      });
    if (url.pathname === "/api/v1/page-definitions/LOGISTICS/MONITORING")
      return json(logisticsDefinition);
    if (url.pathname === "/api/v1/logistics-record-definitions")
      return json(logisticsEditorDefinition);
    if (url.pathname === "/api/v1/page-definitions/SUPPLY/ACCOUNT")
      return json(supplyDefinition);
    if (url.pathname === "/api/v1/logistics-records" && request.method() === "GET")
      return json({
        data: {
          items: [
            {
              ...logisticsRecord,
              status: logisticsStatus,
              version: logisticsVersion,
              values: {
                ...logisticsRecord.values,
                LOG_STATUS: logisticsStatus,
              },
              displayValues: {
                ...logisticsRecord.displayValues,
                LOG_STATUS: logisticsStatus === "DRAFT" ? "草稿" : "待审核",
              },
              allowedActions:
                logisticsStatus === "DRAFT"
                  ? ["VIEW", "SUBMIT"]
                  : ["VIEW", "APPROVE", "RETURN"],
            },
          ],
          pageNumber: 0,
          pageSize: 20,
          totalElements: 1,
          totalPages: 1,
        },
      });
    if (url.pathname === "/api/v1/logistics-records" && request.method() === "POST") {
      logisticsCreateBody = request.postDataJSON() as Record<string, unknown>;
      return json({ data: logisticsRecord }, 201);
    }
    if (url.pathname.endsWith("/submit") && request.method() === "POST") {
      expect(request.postDataJSON()).toEqual({ version: 7 });
      logisticsStatus = "PENDING_REVIEW";
      logisticsVersion = 8;
      return json({
        data: {
          ...logisticsRecord,
          status: logisticsStatus,
          version: logisticsVersion,
          allowedActions: ["VIEW", "APPROVE", "RETURN"],
        },
      });
    }
    if (url.pathname === "/api/v1/supply-accounts" && request.method() === "GET")
      return json({ data: [supplyAccount] });
    if (
      url.pathname === "/api/v1/supply-accounts/runs" &&
      request.method() === "POST"
    ) {
      runBody = request.postDataJSON() as Record<string, unknown>;
      return json({ data: supplyAccount });
    }
    return json({ error: { code: "UNEXPECTED_E2E_REQUEST" } }, 404);
  });

  await page.goto("/#/pages/LOGISTICS/MONITORING/CORN");
  await expect(page.getByRole("heading", { name: "玉米物流监测" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "铁路" })).toBeVisible();
  await page.getByRole("button", { name: "新建物流记录" }).click();
  await page.getByRole("textbox", { name: "运单编号" }).fill("WB-2026-001");
  await page.getByRole("button", { name: "保存草稿" }).click();
  await expect
    .poll(() => logisticsCreateBody)
    .toEqual({
      productCode: "CORN",
      values: { LOG_REFERENCE: "WB-2026-001" },
    });
  await page.getByRole("button", { name: "提交" }).click();
  await expect(page.getByRole("cell", { name: "待审核" })).toBeVisible();

  await page.goto(
    "/#/pages/SUPPLY/ACCOUNT/CORN?filter.regionCode=230200&filter.marketingYear=2026%2F27",
  );
  await expect(page.getByRole("heading", { name: /供需平衡账户/ })).toBeVisible();
  await expect(page.getByText("-0.250")).toBeVisible();
  await expect(page.getByText("采用核定物流来源")).toBeVisible();
  await expect(page.getByText(/平衡状态：已平衡/)).toBeVisible();
  await expect(page.getByText(/可发布/)).toBeVisible();
  await page.getByRole("button", { name: "重新计算" }).click();
  await page.getByRole("textbox", { name: "调整建议理由" }).fill("库存差异经复核");
  await page.getByRole("button", { name: "执行计算" }).click();
  await expect
    .poll(() => runBody)
    .toMatchObject({
      productCode: "CORN",
      regionCode: "230200",
      marketingYear: "2026/27",
      inputSetId: "input-set-9",
      expectedDecisionVersion: 4,
      adjustmentProposalReason: "库存差异经复核",
    });
});

const products = [
  { id: "CORN", name: "玉米" },
  { id: "SOYBEAN", name: "大豆" },
  { id: "RICE", name: "稻谷" },
];
const logisticsDefinition = {
  data: {
    domain: "LOGISTICS",
    pageKind: "MONITORING",
    productCode: "CORN",
    title: "玉米物流监测",
    breadcrumbs: [{ code: "LOGISTICS", label: "物流监测" }],
    filters: [],
    defaultContext: {},
    columnGroups: [
      {
        code: "ROUTE",
        label: "物流流向与数量",
        fields: [
          {
            code: "LOG_TRANSPORT_MODE",
            label: "运输方式",
            valueType: "TEXT",
            unit: null,
            description: "运输明细，不单独重复汇总",
          },
          {
            code: "LOG_ROUTE_VOLUME",
            label: "运量",
            valueType: "DECIMAL",
            unit: "吨",
            description: null,
          },
          {
            code: "LOG_STATUS",
            label: "状态",
            valueType: "TEXT",
            unit: null,
            description: null,
          },
        ],
      },
    ],
    actions: [
      { code: "NEW", label: "新建物流记录", scope: "page" },
      { code: "SUBMIT", label: "提交", scope: "row" },
      { code: "APPROVE", label: "审核通过", scope: "row" },
      { code: "RETURN", label: "退回补充", scope: "row" },
    ],
    pagination: { defaultPageSize: 20, pageSizeOptions: [20] },
  },
};
const logisticsEditorDefinition = {
  data: {
    productCode: "CORN",
    fields: [
      {
        code: "LOG_REFERENCE",
        label: "运单编号",
        controlType: "TEXT",
        unit: null,
        precision: null,
        scale: null,
        required: true,
        readOnly: false,
        sortOrder: 10,
        options: [],
      },
    ],
    actions: [{ code: "NEW", label: "新建物流记录", scope: "PAGE", sortOrder: 10 }],
  },
};
const supplyDefinition = {
  data: {
    domain: "SUPPLY",
    pageKind: "ACCOUNT",
    productCode: "CORN",
    title: "玉米供需账户",
    breadcrumbs: [{ code: "SUPPLY", label: "供需分析" }],
    filters: [
      {
        code: "regionCode",
        label: "地区",
        control: "region-hierarchy",
        placeholder: "请选择地区",
        options: [],
      },
      {
        code: "marketingYear",
        label: "营销年度",
        control: "text",
        placeholder: "请输入营销年度",
        options: [],
      },
    ],
    defaultContext: {},
    columnGroups: [
      {
        code: "LEDGER",
        label: "供需账户",
        fields: [
          {
            code: "SUP_ITEM",
            label: "供需账户项目",
            valueType: "TEXT",
            unit: null,
            description: null,
          },
          {
            code: "SUP_REASON",
            label: "采用调整理由",
            valueType: "TEXT",
            unit: null,
            description: null,
          },
          {
            code: "SUP_SOURCE_STATUS",
            label: "来源状态",
            valueType: "TEXT",
            unit: null,
            description: null,
          },
        ],
      },
    ],
    actions: [
      { code: "VIEW_SOURCE", label: "查看来源", scope: "row" },
      { code: "RUN", label: "重新计算", scope: "page" },
    ],
    pagination: { defaultPageSize: 20, pageSizeOptions: [20] },
  },
};
const logisticsRecord = {
  id: "event-1",
  productCode: "CORN",
  values: {
    LOG_TRANSPORT_MODE: "RAIL",
    LOG_ROUTE_VOLUME: "10.000",
    LOG_STATUS: "DRAFT",
  },
  displayValues: {
    LOG_TRANSPORT_MODE: "铁路",
    LOG_ROUTE_VOLUME: "10.000 吨",
    LOG_STATUS: "草稿",
  },
  status: "DRAFT",
  returnReason: null,
  allowedActions: ["VIEW", "SUBMIT"],
  version: 7,
};
const supplyAccount = {
  id: "run-1",
  productCode: "CORN",
  regionCode: "230200",
  marketingYear: "2026/27",
  resultVersion: 9,
  decisionVersion: 4,
  resultState: "FORMAL",
  validationCodes: [],
  totalSupply: "10.000",
  totalUse: "8.000",
  calculatedEndingInventory: "2.000",
  approvedAdjustment: "1.000",
  adoptedEndingInventory: "3.000",
  surveyedEndingInventory: "2.750",
  inventoryReconciliationDifference: "-0.250",
  inputSetId: "input-set-9",
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
    decisionVersion: 4,
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
};
