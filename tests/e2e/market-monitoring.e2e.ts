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
      "采购基础价",
      "车板费用",
      "包装费用",
      "运费",
      "实际成交价",
      product.qualityLabel,
    ]) {
      await expect(
        page.getByRole("columnheader", { name: header, exact: true }),
      ).toBeVisible();
    }
    await expect(page.getByText("2420.0000", { exact: true })).toBeVisible();
    for (const action of ["查看", "提交", "审核通过", "退回"]) {
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
