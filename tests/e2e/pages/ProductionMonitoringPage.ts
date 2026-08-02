import { expect, type Page } from "@playwright/test";

import {
  productionProducts,
  type ProductionProductCode,
} from "../fixtures/production-api";

export class ProductionMonitoringPage {
  readonly nextPageButton;
  readonly objectTypeFilter;
  readonly searchButton;

  constructor(readonly page: Page) {
    this.nextPageButton = page.getByRole("button", { name: "下一页" });
    this.objectTypeFilter = page.getByRole("combobox", { name: "对象类型" });
    this.searchButton = page.getByRole("button", { name: "查询", exact: true });
  }

  async goto(productCode: ProductionProductCode) {
    const definitionResponse = this.page.waitForResponse((response) => {
      const url = new URL(response.url());
      return (
        response.request().method() === "GET" &&
        url.pathname === "/api/v1/page-definitions/PRODUCTION/MONITORING" &&
        url.searchParams.get("productCode") === productCode
      );
    });
    const firstListResponse = this.page.waitForResponse((response) => {
      const url = new URL(response.url());
      return (
        response.request().method() === "GET" &&
        url.pathname === "/api/v1/production-records" &&
        url.searchParams.get("productCode") === productCode &&
        url.searchParams.get("pageNumber") === "0"
      );
    });
    await this.page.goto(`/#/pages/PRODUCTION/MONITORING/${productCode}`);
    await Promise.all([definitionResponse, firstListResponse]);
    await expect(
      this.page.getByRole("heading", {
        name: `${productionProducts[productCode].name}产情监测`,
        exact: true,
      }),
    ).toBeVisible();
  }

  async openNewForm(productCode: ProductionProductCode) {
    const response = this.page.waitForResponse((candidate) => {
      const url = new URL(candidate.url());
      return (
        candidate.request().method() === "GET" &&
        url.pathname === "/api/v1/production-record-definitions" &&
        url.searchParams.get("productCode") === productCode &&
        !url.searchParams.has("objectTypeCode")
      );
    });
    await this.page.getByRole("button", { name: "新建填报", exact: true }).click();
    await response;
    await expect(this.page.getByRole("dialog", { name: "新建产情填报" })).toBeVisible();
  }

  async searchForObjectType(objectTypeCode: "FARMER" | "VILLAGE") {
    await this.objectTypeFilter.selectOption(objectTypeCode);
    const response = this.page.waitForResponse((candidate) => {
      const url = new URL(candidate.url());
      return (
        candidate.request().method() === "GET" &&
        url.pathname === "/api/v1/production-records" &&
        url.searchParams.get("pageNumber") === "0" &&
        url.searchParams.get("filter.objectTypeCode") === objectTypeCode
      );
    });
    await this.searchButton.click();
    await response;
  }
}
