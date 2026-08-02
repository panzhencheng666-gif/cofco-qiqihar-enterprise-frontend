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
      "车板费用",
      "包装费用",
      "运费",
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
      .getByRole("combobox", { name: "监测对象" })
      .selectOption(product.objectType);
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
    expect(header).not.toBeNull();
    expect(sidebar).not.toBeNull();
    expect(main).not.toBeNull();
    expect(query).not.toBeNull();
    expect(sidebar!.width).toBe(230);
    expect(main!.x).toBeGreaterThanOrEqual(sidebar!.x + sidebar!.width - 1);
    expect(main!.y).toBeGreaterThanOrEqual(header!.y + header!.height - 1);
    expect(query!.height).toBeLessThan(120);
    expect(await ledger.evaluate((node) => node.scrollWidth > node.clientWidth)).toBe(
      true,
    );
    await expect(page.locator(".ledger-footer")).toBeVisible();
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
  await editor.getByRole("textbox", { name: "车板费用" }).fill("40");
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
  await editor.getByRole("textbox", { name: "运费" }).fill("70");
  await expect(editor.getByRole("textbox", { name: "实际成交价" })).toHaveValue(
    "2422.0000",
  );
  await editor.getByRole("button", { name: "保存草稿", exact: true }).click();
  await expect(editor).toBeHidden();
  await page.getByRole("button", { name: "提交", exact: true }).click();
  await expect(page.getByText("待审核", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "审核通过", exact: true }).click();
  await expect(page.getByText("已审核", { exact: true })).toBeVisible();

  const staleStatus = await page.evaluate(async () =>
    fetch("/api/v1/market-records/CORN-record/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ version: 12 }),
    }).then((response) => response.status),
  );
  expect(staleStatus).toBe(409);
  await expect(page.getByText("已审核", { exact: true })).toBeVisible();

  await market.openNew();
  const createEditor = page.getByRole("dialog", { name: "新建市场填报" });
  await createEditor
    .getByRole("combobox", { name: "监测对象" })
    .selectOption("DEEP_PROCESSOR");
  await createEditor
    .getByRole("combobox", { name: "地区 第1级" })
    .selectOption("230200");
  await createEditor.getByRole("textbox", { name: "交易日期" }).fill("2026-08-03");
  await createEditor
    .getByRole("combobox", { name: "购销方向" })
    .selectOption("PURCHASE");
  await createEditor.getByRole("textbox", { name: "采购基础价" }).fill("2000");
  await createEditor.getByRole("textbox", { name: "车板费用" }).fill("30");
  await createEditor.getByRole("combobox", { name: "包装形式" }).selectOption("BULK");
  await createEditor.getByRole("textbox", { name: "包装费用" }).fill("10");
  await createEditor.getByRole("textbox", { name: "运费" }).fill("50");
  await createEditor.getByRole("textbox", { name: "水分" }).fill("14.5");
  await createEditor.getByRole("textbox", { name: "采购量" }).fill("120");
  await expect(createEditor.getByRole("textbox", { name: "实际成交价" })).toHaveValue(
    "2090.0000",
  );
  await createEditor.getByRole("button", { name: "保存草稿", exact: true }).click();
  await expect(createEditor).toBeHidden();
  await expect(page.getByText("2090.0000", { exact: true })).toBeVisible();
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
