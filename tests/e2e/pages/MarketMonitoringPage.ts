import { expect, type Page } from "@playwright/test";

import { marketProducts, type MarketProductCode } from "../fixtures/market-api";

export class MarketMonitoringPage {
  constructor(readonly page: Page) {}

  async goto(productCode: MarketProductCode) {
    await this.page.goto(`/#/pages/MARKET/MONITORING/${productCode}`);
    await expect(
      this.page.getByRole("heading", {
        name: `${marketProducts[productCode].name}市场采集`,
        exact: true,
      }),
    ).toBeVisible();
  }

  async openNew() {
    await this.page.getByRole("button", { name: "新建填报", exact: true }).click();
    await expect(this.page.getByRole("dialog", { name: "新建市场填报" })).toBeVisible();
  }
}
