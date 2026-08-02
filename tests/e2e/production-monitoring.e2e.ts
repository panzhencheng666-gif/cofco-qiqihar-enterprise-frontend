import { expect, test } from "@playwright/test";

import {
  ProductionApiRoutes,
  productionProducts,
  type ProductionProductCode,
} from "./fixtures/production-api";
import { ProductionMonitoringPage } from "./pages/ProductionMonitoringPage";

const canonicalProducts = Object.keys(productionProducts) as ProductionProductCode[];

for (const productCode of canonicalProducts) {
  const product = productionProducts[productCode];

  test(`${productCode} renders its canonical list and four-category form`, async ({
    page,
  }) => {
    const api = new ProductionApiRoutes();
    await api.install(page);
    const monitoring = new ProductionMonitoringPage(page);

    await monitoring.goto(productCode);

    expect(new URL(page.url()).hash).toBe(
      `#/pages/PRODUCTION/MONITORING/${productCode}?pageNumber=0&pageSize=20`,
    );
    await expect(
      page.getByRole("button", {
        name: `${product.name}产情监测`,
        exact: true,
      }),
    ).toHaveAttribute("aria-current", "page");
    for (const navigationProduct of Object.values(productionProducts)) {
      await expect(
        page.getByRole("button", {
          name: `${navigationProduct.name}产情监测`,
          exact: true,
        }),
      ).toBeVisible();
    }
    await expect(
      page.getByRole("columnheader", { name: product.qualityLabel, exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText(api.listLabel(productCode), { exact: true }),
    ).toBeVisible();
    await expect(page.getByText(product.qualityValue, { exact: true })).toBeVisible();

    await monitoring.openNewForm(productCode);
    const dialog = page.getByRole("dialog", { name: "新建产情填报" });
    for (const groupName of ["质量指标", "生产成本", "农业保险", "农业补贴"]) {
      await expect(dialog.getByRole("group", { name: groupName })).toBeVisible();
    }
    await expect(
      dialog.getByRole("textbox", { name: product.qualityLabel, exact: true }),
    ).toBeVisible();
    await dialog.getByRole("button", { name: "关闭", exact: true }).click();
    await expect(dialog).toBeHidden();
    expect(api.unexpectedRequests).toEqual([]);
  });
}

test("pending submit refresh keeps the latest filtered page across real back and forward navigation", async ({
  page,
}) => {
  const api = new ProductionApiRoutes({ holdLatestPage: true });
  await api.install(page);
  const monitoring = new ProductionMonitoringPage(page);

  await monitoring.goto("SOYBEAN");

  await page.getByRole("button", { name: "提交", exact: true }).click();
  await api.waitForSubmit();

  await monitoring.searchForObjectType("FARMER");
  expect(new URL(page.url()).hash).toBe(
    "#/pages/PRODUCTION/MONITORING/SOYBEAN?pageNumber=0&pageSize=20&filter.objectTypeCode=FARMER",
  );

  await monitoring.nextPageButton.click();
  await api.waitForPendingLatestCount(1);
  expect(new URL(page.url()).hash).toBe(
    "#/pages/PRODUCTION/MONITORING/SOYBEAN?pageNumber=1&pageSize=20&filter.objectTypeCode=FARMER",
  );

  const backResponse = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return (
      url.pathname === "/api/v1/production-records" &&
      url.searchParams.get("pageNumber") === "0" &&
      url.searchParams.get("filter.objectTypeCode") === "FARMER"
    );
  });
  await page.goBack();
  await backResponse;
  await expect(page).toHaveURL(
    /#\/pages\/PRODUCTION\/MONITORING\/SOYBEAN\?pageNumber=0&pageSize=20&filter\.objectTypeCode=FARMER$/,
  );

  await page.goForward();
  await api.waitForPendingLatestCount(2);
  await expect(page).toHaveURL(
    /#\/pages\/PRODUCTION\/MONITORING\/SOYBEAN\?pageNumber=1&pageSize=20&filter\.objectTypeCode=FARMER$/,
  );

  const queriesBeforeWriteResolution = api.listQueries.length;
  await api.releaseSubmit();
  await api.waitForPendingLatestCount(3);
  expect(api.listQueries.slice(queriesBeforeWriteResolution)).toEqual([
    {
      productCode: "SOYBEAN",
      pageNumber: 1,
      pageSize: 20,
      objectTypeCode: "FARMER",
    },
  ]);
  expect(
    api.listQueries.filter(
      (query) => query.pageNumber === 0 && query.objectTypeCode === undefined,
    ),
  ).toHaveLength(1);

  await api.releasePendingLatest(2, "最新筛选结果");
  await expect(page.getByText("最新筛选结果", { exact: true })).toBeVisible();

  await api.releasePendingLatest(1, "过期前进结果");
  await api.releasePendingLatest(0, "过期翻页结果");
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );

  await expect(page.getByText("最新筛选结果", { exact: true })).toBeVisible();
  await expect(page.getByText("过期前进结果", { exact: true })).toHaveCount(0);
  await expect(page.getByText("过期翻页结果", { exact: true })).toHaveCount(0);
  await expect(monitoring.objectTypeFilter).toHaveValue("FARMER");
  await expect(page.getByText("第 2 / 2 页", { exact: true })).toBeVisible();
  expect(new URL(page.url()).hash).toBe(
    "#/pages/PRODUCTION/MONITORING/SOYBEAN?pageNumber=1&pageSize=20&filter.objectTypeCode=FARMER",
  );
  expect(api.unexpectedRequests).toEqual([]);
});
