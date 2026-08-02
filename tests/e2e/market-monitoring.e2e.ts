import { expect, test } from "@playwright/test";

import {
  MarketApiRoutes,
  marketProducts,
  type MarketProductCode,
} from "./fixtures/market-api";
import { MarketMonitoringPage } from "./pages/MarketMonitoringPage";

const products = Object.keys(marketProducts) as MarketProductCode[];

for (const productCode of products) {
  test(`${productCode} renders backend-defined price composition and applicable facts`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    const api = new MarketApiRoutes();
    await api.install(page);
    const market = new MarketMonitoringPage(page);
    const product = marketProducts[productCode];

    await market.goto(productCode);

    expect(new URL(page.url()).hash).toBe(
      `#/pages/MARKET/MONITORING/${productCode}?pageNumber=0&pageSize=20`,
    );
    for (const item of Object.values(marketProducts)) {
      await expect(
        page.getByRole("button", { name: `${item.name}市场采集`, exact: true }),
      ).toBeVisible();
    }
    for (const header of [
      "填报时间",
      "市场车板组成",
      "市场包装组成",
      "市场运费组成",
      "市场来源说明",
      product.qualityLabel,
    ]) {
      await expect(
        page.getByRole("columnheader", { name: header, exact: true }),
      ).toBeVisible();
    }
    await expect(page.getByText("2420.0000", { exact: true })).toBeVisible();
    const purchaseHeader = page.getByRole("columnheader", {
      name: "采购基础价",
      exact: true,
    });
    const saleHeader = page.getByRole("columnheader", {
      name: "销售基础价",
      exact: true,
    });
    const actualHeader = page.getByRole("columnheader", {
      name: "实际成交价",
      exact: true,
    });
    await expect(purchaseHeader).toContainText("采购基础价未包含车板、包装和运费组成");
    await expect(saleHeader).toContainText("销售基础价未包含车板、包装和运费组成");
    await expect(actualHeader).toContainText("实际成交价已包含车板、包装和运费组成");
    for (const action of ["查看", "提交"]) {
      await expect(
        page.getByRole("button", { name: action, exact: true }),
      ).toBeVisible();
    }

    await market.openNew();
    const dialog = page.getByRole("dialog", { name: "新建市场填报" });
    await dialog
      .getByRole("combobox", { name: "对象类型" })
      .selectOption(product.defaultObject);
    await expect(dialog.getByRole("group", { name: "质量指标" })).toBeVisible();
    await expect(dialog.getByRole("group", { name: "采购与成交" })).toBeVisible();
    await expect(
      dialog.getByRole("textbox", { name: product.qualityLabel }),
    ).toBeVisible();
    await expect(dialog.getByRole("textbox", { name: "采购量" })).toBeVisible();
    await expect(
      dialog.getByText("采购基础价未包含车板、包装和运费组成"),
    ).toBeVisible();
    await expect(
      dialog.getByText("销售基础价未包含车板、包装和运费组成"),
    ).toBeVisible();
    await expect(dialog.getByRole("textbox", { name: "实际成交价" })).toHaveAttribute(
      "readonly",
      "",
    );
    await dialog.getByRole("button", { name: "关闭", exact: true }).click();

    const header = await page.locator(".enterprise-header").boundingBox();
    const sidebar = await page.locator(".enterprise-sidebar").boundingBox();
    const main = await page.locator(".enterprise-main").boundingBox();
    const query = await page.locator(".enterprise-query-bar").boundingBox();
    const ledger = page.locator(".ledger-scroll");
    const footer = page.locator(".ledger-footer");
    const tableHeader = page.locator(".ledger-scroll thead");
    const firstRow = page.locator(".ledger-scroll tbody tr").first();
    expect(header).not.toBeNull();
    expect(sidebar).not.toBeNull();
    expect(main).not.toBeNull();
    expect(query).not.toBeNull();
    const ledgerBox = await ledger.boundingBox();
    const footerBox = await footer.boundingBox();
    const tableHeaderBox = await tableHeader.boundingBox();
    const firstRowBox = await firstRow.boundingBox();
    expect(ledgerBox).not.toBeNull();
    expect(footerBox).not.toBeNull();
    expect(tableHeaderBox).not.toBeNull();
    expect(firstRowBox).not.toBeNull();
    expect(sidebar!.width).toBe(230);
    expect(main!.x).toBeGreaterThanOrEqual(sidebar!.x + sidebar!.width - 1);
    expect(main!.y).toBeGreaterThanOrEqual(header!.y + header!.height - 1);
    expect(query!.height).toBeLessThan(120);
    expect(ledgerBox!.y + ledgerBox!.height).toBeLessThanOrEqual(footerBox!.y + 1);
    expect(tableHeaderBox!.y + tableHeaderBox!.height).toBeLessThanOrEqual(
      firstRowBox!.y + 1,
    );
    const rowActions = [
      page.getByRole("button", { name: "查看", exact: true }),
      page.getByRole("button", { name: "提交", exact: true }),
    ];
    const actionBoxes = await Promise.all(
      rowActions.map((action) => action.boundingBox()),
    );
    expect(actionBoxes.every((box) => box !== null)).toBe(true);
    expect(actionBoxes[0]!.x + actionBoxes[0]!.width).toBeLessThanOrEqual(
      actionBoxes[1]!.x,
    );
    const horizontal = await ledger.evaluate((node) => {
      node.scrollLeft = node.scrollWidth;
      return {
        clientWidth: node.clientWidth,
        scrollLeft: node.scrollLeft,
        scrollWidth: node.scrollWidth,
      };
    });
    expect(horizontal.scrollWidth).toBeGreaterThan(horizontal.clientWidth);
    expect(horizontal.scrollLeft).toBeGreaterThan(0);
    await expect(
      page.getByRole("columnheader", { name: product.qualityLabel, exact: true }),
    ).toBeVisible();
    await expect(footer).toBeVisible();
    await page.getByRole("button", { name: "下一页" }).click();
    await expect(page).toHaveURL(/pageNumber=1/);
    await page.getByRole("button", { name: "上一页" }).click();
    await expect(page).toHaveURL(/pageNumber=0/);
    expect(api.unexpectedRequests).toEqual([]);
  });
}

test("market writes follow the real draft, review, return, and approval workflow", async ({
  page,
}) => {
  const api = new MarketApiRoutes();
  await api.install(page);
  const market = new MarketMonitoringPage(page);
  await market.goto("CORN");

  await page.getByRole("button", { name: "查看", exact: true }).click();
  let editor = page.getByRole("dialog", { name: "市场记录详情" });
  await expect(editor.getByRole("textbox", { name: "填报时间" })).toHaveValue(
    "2026-08-03T08:00:00+08:00",
  );
  await expect(editor.getByText("采购基础价未包含车板、包装和运费组成")).toBeVisible();
  await editor.getByRole("textbox", { name: "车板组成" }).fill("40");
  await expect(editor.getByRole("textbox", { name: "实际成交价" })).toHaveValue(
    "2424.0000",
  );
  await editor.getByRole("button", { name: "保存草稿", exact: true }).click();
  await expect(editor).toBeHidden();
  await expect(page.getByText("2424.0000", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "提交", exact: true }).click();
  await expect(page.getByText("待审核", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "退回", exact: true }).click();
  const returnDialog = page.getByRole("dialog", { name: "退回市场记录" });
  await returnDialog.getByRole("textbox", { name: "退回原因" }).fill("请复核采购凭证");
  await returnDialog.getByRole("button", { name: "确认退回" }).click();
  await expect(returnDialog).toBeHidden();
  await expect(page.getByText("已退回", { exact: true })).toBeVisible();
  expect(api.returnBodies).toEqual([{ version: 9, reason: "请复核采购凭证" }]);

  await page.getByRole("button", { name: "查看", exact: true }).click();
  editor = page.getByRole("dialog", { name: "市场记录详情" });
  await editor.getByRole("textbox", { name: "运费组成" }).fill("70");
  await expect(editor.getByRole("textbox", { name: "实际成交价" })).toHaveValue(
    "2422.0000",
  );
  await editor.getByRole("button", { name: "保存草稿", exact: true }).click();
  await expect(editor).toBeHidden();
  await page.getByRole("button", { name: "提交", exact: true }).click();
  await expect(page.getByText("待审核", { exact: true })).toBeVisible();

  const staleResult = await page.evaluate(async () => {
    const read = async () => {
      const response = await fetch("/api/v1/market-records/CORN-record");
      const body: unknown = await response.json();
      if (typeof body !== "object" || body === null || !("data" in body)) {
        throw new Error("Missing market detail data");
      }
      return body.data as { status: string; version: number; facts: unknown };
    };
    const before = await read();
    const status = await fetch("/api/v1/market-records/CORN-record/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ version: before.version - 1 }),
    }).then((response) => response.status);
    const after = await read();
    return { after, before, status };
  });
  expect(staleResult.before.status).toBe("PENDING_REVIEW");
  expect(staleResult.before.version).toBe(12);
  expect(staleResult.status).toBe(409);
  expect(staleResult.after).toEqual(staleResult.before);

  await page.getByRole("button", { name: "审核通过", exact: true }).click();
  await expect(page.getByText("已审核", { exact: true })).toBeVisible();

  await market.openNew();
  const createEditor = page.getByRole("dialog", { name: "新建市场填报" });
  await createEditor
    .getByRole("combobox", { name: "对象类型" })
    .selectOption("DEEP_PROCESSOR");
  await createEditor
    .getByRole("combobox", { name: "地区 第1级" })
    .selectOption("230200");
  await createEditor.getByRole("textbox", { name: "交易日期" }).fill("2026-08-03");
  await createEditor
    .getByRole("combobox", { name: "买卖方向" })
    .selectOption("PURCHASE");
  await createEditor.getByRole("textbox", { name: "采购基础价" }).fill("2000");
  await createEditor.getByRole("textbox", { name: "车板组成" }).fill("30");
  await createEditor.getByRole("combobox", { name: "包装形态" }).selectOption("BULK");
  await createEditor.getByRole("textbox", { name: "包装组成" }).fill("10");
  await createEditor.getByRole("textbox", { name: "运费组成" }).fill("50");
  await createEditor
    .getByRole("textbox", { name: "来源说明", exact: true })
    .fill("新粮采购");
  await createEditor.getByRole("textbox", { name: "水分" }).fill("14.5");
  await createEditor.getByRole("textbox", { name: "采购量" }).fill("120");
  await expect(createEditor.getByRole("textbox", { name: "实际成交价" })).toHaveValue(
    "2090.0000",
  );
  await createEditor.getByRole("button", { name: "保存草稿", exact: true }).click();
  await expect(createEditor).toBeHidden();
  await expect(page.getByText("2090.0000", { exact: true })).toBeVisible();
  await expect(page.getByText("新粮采购", { exact: true })).toBeVisible();
  expect(api.recordCount("CORN")).toBe(2);

  const beforeRejectedCreate = api.recordCount("CORN");
  const invalidStatus = await page.evaluate(async () =>
    fetch("/api/v1/market-records", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productCode: "CORN", unexpected: true }),
    }).then((response) => response.status),
  );
  expect(invalidStatus).toBe(400);
  expect(api.recordCount("CORN")).toBe(beforeRejectedCreate);

  const pseudocodeStatuses = await page.evaluate(async () => {
    const legacyFact = ["CORN", "MOISTURE"].join("_");
    const legacyObject = ["BREEDING", "ENTERPRISE"].join("_");
    const coreValues = {
      MKT_OBJECT_TYPE: "DEEP_PROCESSOR",
      MKT_REGION: "230200",
      MKT_TRADE_DATE: "2026-08-03",
      MKT_TRADE_DIRECTION: "PURCHASE",
      MKT_PURCHASE_BASE_PRICE: "2000",
      MKT_CARRIAGE_BOARD_AMOUNT: "30",
      MKT_PACKAGING_FORM: "BULK",
      MKT_PACKAGING_AMOUNT: "10",
      MKT_FREIGHT_AMOUNT: "50",
    };
    const request = (body: unknown) =>
      fetch("/api/v1/market-records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then((response) => response.status);
    return Promise.all([
      request({ productCode: "CORN", coreValues, facts: { [legacyFact]: "1" } }),
      request({
        productCode: "CORN",
        coreValues: { ...coreValues, MKT_OBJECT_TYPE: legacyObject },
        facts: { MOISTURE: "1" },
      }),
      ...["+1", "1e3", "1E3"].map((value) =>
        request({
          productCode: "CORN",
          coreValues: { ...coreValues, MKT_PURCHASE_BASE_PRICE: value },
          facts: { MOISTURE: "1" },
        }),
      ),
    ]);
  });
  expect(pseudocodeStatuses).toEqual([400, 400, 400, 400, 400]);
  expect(api.recordCount("CORN")).toBe(beforeRejectedCreate);
  expect(
    api.writes
      .filter((write) => write.status < 400)
      .map((write) => `${write.method} ${write.path}`),
  ).toEqual([
    "PUT /api/v1/market-records/CORN-record",
    "POST /api/v1/market-records/CORN-record/submit",
    "POST /api/v1/market-records/CORN-record/return",
    "PUT /api/v1/market-records/CORN-record",
    "POST /api/v1/market-records/CORN-record/submit",
    "POST /api/v1/market-records/CORN-record/approve",
    "POST /api/v1/market-records",
  ]);
  expect(api.unexpectedRequests).toEqual([]);
});

test("market fixture fails closed and pending submit refresh follows back/forward state", async ({
  page,
}) => {
  const api = new MarketApiRoutes(true);
  await api.install(page);
  const market = new MarketMonitoringPage(page);
  await market.goto("SOYBEAN");

  const invalidStatus = await page.evaluate(async () =>
    fetch(
      "/api/v1/market-records?productCode=SOYBEAN&pageKind=MONITORING&pageNumber=0&pageSize=20&unknown=1",
    ).then((response) => response.status),
  );
  expect(invalidStatus).toBe(400);
  expect(api.unexpectedRequests).toHaveLength(1);
  api.unexpectedRequests.length = 0;

  const javaIntegerStatuses = await page.evaluate(async () =>
    Promise.all(
      [
        "/api/v1/market-records?productCode=SOYBEAN&pageKind=MONITORING&pageNumber=１２&pageSize=２０",
        "/api/v1/market-records?productCode=SOYBEAN&pageKind=MONITORING&pageNumber=١٢&pageSize=%2B٢٠",
      ].map(async (path) => (await fetch(path)).status),
    ),
  );
  expect(javaIntegerStatuses).toEqual([200, 200]);
  expect(api.listQueries.slice(-2)).toEqual([
    { productCode: "SOYBEAN", pageNumber: 12, pageSize: 20 },
    { productCode: "SOYBEAN", pageNumber: 12, pageSize: 20 },
  ]);
  expect(api.unexpectedRequests).toEqual([]);

  await page.getByRole("button", { name: "提交", exact: true }).click();
  await api.waitForSubmit();
  await page.getByRole("combobox", { name: "监测对象" }).selectOption("DEEP_PROCESSOR");
  await page.getByRole("button", { name: "查询", exact: true }).click();
  await expect(page).toHaveURL(/filter\.objectTypeCode=DEEP_PROCESSOR$/);
  await page.getByRole("button", { name: "下一页" }).click();
  await expect(page).toHaveURL(/pageNumber=1.*filter\.objectTypeCode=DEEP_PROCESSOR$/);
  await page.goBack();
  await expect(page).toHaveURL(/pageNumber=0.*filter\.objectTypeCode=DEEP_PROCESSOR$/);
  await page.goForward();
  await expect(page).toHaveURL(/pageNumber=1.*filter\.objectTypeCode=DEEP_PROCESSOR$/);

  const before = api.listQueries.length;
  await api.releaseSubmit();
  await expect.poll(() => api.listQueries.length).toBeGreaterThan(before);
  expect(api.listQueries.at(-1)).toEqual({
    productCode: "SOYBEAN",
    pageNumber: 1,
    pageSize: 20,
    objectTypeCode: "DEEP_PROCESSOR",
  });
  expect(api.unexpectedRequests).toEqual([]);
});
