import type { Page, Request, Route } from "@playwright/test";

import { parseJavaInt32 } from "../support/java-int32";

export type ProductionProductCode = "CORN" | "SOYBEAN" | "RICE";
export type ProductionObjectTypeCode =
  "FARMER" | "VILLAGE_COMMITTEE" | "AGRICULTURAL_TECH_STATION";

const productionListRequiredKeys = [
  "productCode",
  "pageKind",
  "pageNumber",
  "pageSize",
] as const;
const productionListOptionalKeys = ["filter.objectTypeCode"] as const;
const productionListAllowedKeys = new Set<string>([
  ...productionListRequiredKeys,
  ...productionListOptionalKeys,
]);
export const productionProducts = {
  CORN: {
    name: "玉米",
    qualityCode: "MOISTURE",
    qualityLabel: "水分",
    qualityValue: "14.2000",
  },
  SOYBEAN: {
    name: "大豆",
    qualityCode: "PROTEIN",
    qualityLabel: "蛋白",
    qualityValue: "39.1000",
  },
  RICE: {
    name: "稻谷",
    qualityCode: "MILLING_YIELD",
    qualityLabel: "出米率",
    qualityValue: "68.5000",
  },
} as const;

export interface ProductionListQuery {
  productCode: ProductionProductCode;
  pageNumber: number;
  pageSize: number;
  objectTypeCode?: ProductionObjectTypeCode;
}

interface PendingListResponse {
  query: ProductionListQuery;
  route: Route;
  released: boolean;
}

export class ProductionApiRoutes {
  readonly listQueries: ProductionListQuery[] = [];
  readonly unexpectedRequests: string[] = [];

  private readonly holdLatestPage: boolean;
  private readonly waiters = new Set<() => void>();
  private readonly pendingLatest: PendingListResponse[] = [];
  private pendingSubmit: { request: Request; route: Route } | undefined;

  constructor({ holdLatestPage = false }: { holdLatestPage?: boolean } = {}) {
    this.holdLatestPage = holdLatestPage;
  }

  async install(page: Page) {
    await page.route("**/api/v1/**", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const productDefinitionMatch =
        /^\/api\/v1\/page-definitions\/PRODUCTION\/MONITORING$/.exec(url.pathname);
      const cultivarsMatch =
        /^\/api\/v1\/master-data\/products\/(CORN|SOYBEAN|RICE)\/cultivars$/.exec(
          url.pathname,
        );
      const submitMatch = /^\/api\/v1\/production-records\/([^/]+)\/submit$/.exec(
        url.pathname,
      );

      if (
        request.method() === "GET" &&
        url.pathname === "/api/v1/master-data/products"
      ) {
        await fulfillJson(route, {
          data: Object.entries(productionProducts).map(([id, product]) => ({
            id,
            name: product.name,
          })),
        });
        return;
      }
      if (request.method() === "GET" && cultivarsMatch) {
        await fulfillJson(route, {
          data: [{ id: `${cultivarsMatch[1]}-DEFAULT`, name: "默认品种" }],
        });
        return;
      }
      if (request.method() === "GET" && productDefinitionMatch) {
        const productCode = requireProductCode(url.searchParams.get("productCode"));
        await fulfillJson(route, pageDefinition(productCode));
        return;
      }
      if (
        request.method() === "GET" &&
        url.pathname === "/api/v1/production-record-definitions"
      ) {
        const productCode = requireProductCode(url.searchParams.get("productCode"));
        await fulfillJson(route, formDefinition(productCode));
        return;
      }
      if (url.pathname === "/api/v1/production-records") {
        await this.handleList(route, url);
        return;
      }
      if (request.method() === "POST" && submitMatch) {
        this.pendingSubmit = { request, route };
        this.notify();
        return;
      }

      this.unexpectedRequests.push(`${request.method()} ${url.pathname}${url.search}`);
      this.notify();
      await fulfillJson(route, { error: "Unexpected E2E API request" }, 404);
    });
  }

  listLabel(productCode: ProductionProductCode, pageNumber = 0) {
    return `${productionProducts[productCode].name}第${String(pageNumber + 1)}页状态`;
  }

  waitForPendingLatestCount(count: number) {
    return this.waitUntil(
      () => this.pendingLatest.filter((pending) => !pending.released).length >= count,
    );
  }

  waitForSubmit() {
    return this.waitUntil(() => this.pendingSubmit !== undefined);
  }

  async releaseSubmit() {
    const pending = this.pendingSubmit;
    if (!pending) throw new Error("No pending submit request");
    const body = pending.request.postDataJSON() as { version?: unknown };
    if (body.version !== 7) {
      throw new Error(`Expected submit version 7, received ${String(body.version)}`);
    }
    this.pendingSubmit = undefined;
    await fulfillJson(pending.route, productionDetail("SOYBEAN"));
  }

  async releasePendingLatest(index: number, statusLabel: string) {
    const pending = this.pendingLatest[index];
    if (!pending) throw new Error(`No pending latest-page request at index ${index}`);
    if (pending.released)
      throw new Error(`Pending request ${index} was already released`);
    pending.released = true;
    await fulfillJson(pending.route, listResponse(pending.query, statusLabel));
  }

  private async handleList(route: Route, url: URL) {
    const request = route.request();
    if (
      request.method() !== "GET" ||
      !hasStrictProductionListParameters(url.searchParams)
    ) {
      await this.rejectList(route, url);
      return;
    }
    const productCode = productCodeOrUndefined(singleValue(url, "productCode"));
    const pageNumber = formalPageNumber(singleValue(url, "pageNumber"));
    const pageSize = formalPageSize(singleValue(url, "pageSize"));
    const pageKind = singleValue(url, "pageKind");
    const objectTypeValue = optionalSingleValue(url, "filter.objectTypeCode");
    const objectTypeCode = objectTypeCodeOrUndefined(objectTypeValue);
    if (
      productCode === undefined ||
      pageKind !== "MONITORING" ||
      pageNumber === undefined ||
      pageSize === undefined ||
      objectTypeValue === null ||
      (objectTypeValue !== undefined && objectTypeCode === undefined)
    ) {
      await this.rejectList(route, url);
      return;
    }
    const query: ProductionListQuery = {
      productCode,
      pageNumber,
      pageSize,
      ...(objectTypeCode === undefined ? {} : { objectTypeCode }),
    };
    this.listQueries.push(query);

    if (this.holdLatestPage && pageNumber === 1 && objectTypeCode === "FARMER") {
      this.pendingLatest.push({
        query,
        route,
        released: false,
      });
      this.notify();
      return;
    }

    this.notify();
    await fulfillJson(
      route,
      listResponse(query, this.listLabel(productCode, pageNumber)),
    );
  }

  private async rejectList(route: Route, url: URL) {
    this.unexpectedRequests.push(
      `${route.request().method()} ${url.pathname}${url.search}`,
    );
    this.notify();
    await fulfillJson(
      route,
      { error: { code: "INVALID_E2E_PRODUCTION_LIST_QUERY" } },
      400,
    );
  }

  private waitUntil(predicate: () => boolean): Promise<void> {
    if (predicate()) return Promise.resolve();
    return new Promise((resolve) => {
      const waiter = () => {
        if (!predicate()) return;
        this.waiters.delete(waiter);
        resolve();
      };
      this.waiters.add(waiter);
    });
  }

  private notify() {
    for (const waiter of [...this.waiters]) waiter();
  }
}

function pageDefinition(productCode: ProductionProductCode) {
  const product = productionProducts[productCode];
  return {
    data: {
      domain: "PRODUCTION",
      pageKind: "MONITORING",
      productCode,
      title: `${product.name}产情监测`,
      breadcrumbs: [
        { code: "PRODUCTION", label: "产情监测" },
        { code: productCode, label: product.name },
      ],
      filters: [
        {
          code: "objectTypeCode",
          label: "对象类型",
          control: "select",
          placeholder: "全部对象类型",
          options: [
            { value: "FARMER", label: "农户" },
            { value: "VILLAGE_COMMITTEE", label: "村委会" },
            { value: "AGRICULTURAL_TECH_STATION", label: "农技站" },
          ],
        },
      ],
      defaultContext: {},
      columnGroups: [
        {
          code: "base",
          label: "填报信息",
          fields: [
            {
              code: "PROD_STATUS",
              label: "状态",
              valueType: "TEXT",
              unit: null,
              description: null,
            },
            {
              code: product.qualityCode,
              label: product.qualityLabel,
              valueType: "DECIMAL",
              unit: "%",
              description: null,
            },
          ],
        },
      ],
      actions: [
        { code: "NEW", label: "新建填报", scope: "page" },
        { code: "SUBMIT", label: "提交", scope: "row" },
      ],
      pagination: { defaultPageSize: 20, pageSizeOptions: [20, 50, 100] },
    },
  };
}

function formDefinition(productCode: ProductionProductCode) {
  const product = productionProducts[productCode];
  return {
    data: {
      productCode,
      objectTypeCode: null,
      groups: [
        factGroup("QUALITY", "质量指标", product.qualityCode, product.qualityLabel, 10),
        factGroup("COST", "生产成本", "LAND_RENT", "地租", 20),
        factGroup("INSURANCE", "农业保险", "INSURANCE_AMOUNT", "保险金额", 30),
        factGroup("SUBSIDY", "农业补贴", "SUBSIDY_AMOUNT", "补贴金额", 40),
      ],
    },
  };
}

function factGroup(
  category: string,
  label: string,
  code: string,
  fieldLabel: string,
  sortOrder: number,
) {
  return {
    category,
    label,
    sortOrder,
    fields: [
      {
        code,
        label: fieldLabel,
        valueType: "DECIMAL",
        unit: "元",
        description: null,
        precision: 18,
        scale: 4,
        sortOrder: 10,
      },
    ],
  };
}

function listResponse(query: ProductionListQuery, statusLabel: string) {
  const product = productionProducts[query.productCode];
  return {
    data: {
      items: [
        {
          id: `${query.productCode}-record`,
          values: {
            PROD_STATUS: statusLabel,
            [product.qualityCode]: product.qualityValue,
          },
          allowedActions: ["SUBMIT"],
          version: 7,
        },
      ],
      pageNumber: query.pageNumber,
      pageSize: query.pageSize,
      totalElements: 2,
      totalPages: 2,
    },
  };
}

function productionDetail(productCode: ProductionProductCode) {
  const product = productionProducts[productCode];
  return {
    data: {
      id: `${productCode}-record`,
      productCode,
      objectTypeCode: "FARMER",
      regionCode: "230202",
      cultivarCode: null,
      surveyDate: "2026-08-01",
      reportedAt: "2026-08-03T08:00:00+08:00",
      cultivatedAreaMu: "1.0000",
      yieldPerMuKilograms: "2.0000",
      estimatedOutputKilograms: "2.0000",
      status: "PENDING_REVIEW",
      returnReason: null,
      quality: { [product.qualityCode]: product.qualityValue },
      costs: { LAND_RENT: "120.0000" },
      insurance: { INSURANCE_AMOUNT: "30.0000" },
      subsidies: { SUBSIDY_AMOUNT: "25.0000" },
      allowedActions: ["VIEW", "APPROVE", "RETURN"],
      version: 8,
    },
  };
}

function requireProductCode(value: string | null): ProductionProductCode {
  if (value === "CORN" || value === "SOYBEAN" || value === "RICE") return value;
  throw new Error(`Unexpected product code: ${String(value)}`);
}

function productCodeOrUndefined(value: string | undefined) {
  return value === "CORN" || value === "SOYBEAN" || value === "RICE"
    ? value
    : undefined;
}

function objectTypeCodeOrUndefined(
  value: string | null | undefined,
): ProductionObjectTypeCode | undefined {
  return value === "FARMER" ||
    value === "VILLAGE_COMMITTEE" ||
    value === "AGRICULTURAL_TECH_STATION"
    ? value
    : undefined;
}

function formalPageNumber(value: string | undefined) {
  const parsed = parseJavaInt32(value);
  return parsed !== undefined && parsed >= 0 ? parsed : undefined;
}

function formalPageSize(value: string | undefined) {
  const parsed = parseJavaInt32(value);
  return parsed !== undefined && parsed >= 1 && [20, 50, 100].includes(parsed)
    ? parsed
    : undefined;
}

function hasStrictProductionListParameters(parameters: URLSearchParams) {
  const counts = new Map<string, number>();
  for (const [name, value] of parameters) {
    if (!productionListAllowedKeys.has(name) || value.trim() === "") return false;
    const count = (counts.get(name) ?? 0) + 1;
    if (count > 1) return false;
    counts.set(name, count);
  }
  return (
    productionListRequiredKeys.every((name) => counts.get(name) === 1) &&
    productionListOptionalKeys.every((name) => (counts.get(name) ?? 0) <= 1)
  );
}

function singleValue(url: URL, name: string) {
  const values = url.searchParams.getAll(name);
  return values.length === 1 && values[0] !== "" ? values[0] : undefined;
}

function optionalSingleValue(url: URL, name: string) {
  const values = url.searchParams.getAll(name);
  if (values.length === 0) return undefined;
  return values.length === 1 && values[0] !== "" ? values[0] : null;
}

async function fulfillJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}
