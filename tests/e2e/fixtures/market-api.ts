import type { Page, Request, Route } from "@playwright/test";

export type MarketProductCode = "CORN" | "SOYBEAN" | "RICE";

const listKeys = new Set([
  "productCode",
  "pageKind",
  "pageNumber",
  "pageSize",
  "filter.objectTypeCode",
]);

export const marketProducts = {
  CORN: {
    name: "玉米",
    objectType: "DEEP_PROCESSOR",
    qualityCode: "CORN_MOISTURE",
    qualityLabel: "水分",
  },
  SOYBEAN: {
    name: "大豆",
    objectType: "DEEP_PROCESSOR",
    qualityCode: "SOYBEAN_PROTEIN",
    qualityLabel: "蛋白质",
  },
  RICE: {
    name: "稻谷",
    objectType: "RICE_MILL",
    qualityCode: "RICE_MILLING_YIELD",
    qualityLabel: "出米率",
  },
} as const;

export interface MarketListQuery {
  productCode: MarketProductCode;
  pageNumber: number;
  pageSize: number;
  objectTypeCode?: string;
}

export class MarketApiRoutes {
  readonly listQueries: MarketListQuery[] = [];
  readonly unexpectedRequests: string[] = [];
  readonly returnBodies: unknown[] = [];

  private pendingSubmit: { request: Request; route: Route } | undefined;
  private readonly waiters = new Set<() => void>();

  constructor(private readonly holdSubmit = false) {}

  async install(page: Page) {
    await page.route("**/api/v1/**", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const definition = /^\/api\/v1\/page-definitions\/MARKET\/MONITORING$/.exec(
        url.pathname,
      );
      const detail = /^\/api\/v1\/market-records\/([^/]+)$/.exec(url.pathname);
      const submit = /^\/api\/v1\/market-records\/([^/]+)\/submit$/.exec(url.pathname);
      const approve = /^\/api\/v1\/market-records\/([^/]+)\/approve$/.exec(
        url.pathname,
      );
      const returned = /^\/api\/v1\/market-records\/([^/]+)\/return$/.exec(
        url.pathname,
      );

      if (
        request.method() === "GET" &&
        url.pathname === "/api/v1/master-data/products"
      ) {
        await json(route, {
          data: Object.entries(marketProducts).map(([id, product]) => ({
            id,
            name: product.name,
          })),
        });
        return;
      }
      if (request.method() === "GET" && url.pathname === "/api/v1/regions") {
        await json(route, {
          data: [{ id: "230200", label: "齐齐哈尔市", level: "PREFECTURE" }],
        });
        return;
      }
      if (request.method() === "GET" && definition) {
        const productCode = product(url.searchParams.get("productCode"));
        await json(route, pageDefinition(productCode));
        return;
      }
      if (
        request.method() === "GET" &&
        url.pathname === "/api/v1/market-record-definitions"
      ) {
        const productCode = product(url.searchParams.get("productCode"));
        const objectTypeCode = url.searchParams.get("objectTypeCode");
        await json(route, formDefinition(productCode, objectTypeCode));
        return;
      }
      if (url.pathname === "/api/v1/market-records" && request.method() === "GET") {
        await this.list(route, url);
        return;
      }
      if (request.method() === "GET" && detail) {
        await json(route, recordDetail(productFromRecord(detail[1]!)));
        return;
      }
      if (request.method() === "POST" && submit) {
        if (this.holdSubmit) {
          this.pendingSubmit = { request, route };
          this.notify();
        } else {
          await json(route, recordDetail(productFromRecord(submit[1]!), 8));
        }
        return;
      }
      if (request.method() === "POST" && approve) {
        await json(route, recordDetail(productFromRecord(approve[1]!), 8));
        return;
      }
      if (request.method() === "POST" && returned) {
        this.returnBodies.push(request.postDataJSON());
        await json(route, recordDetail(productFromRecord(returned[1]!), 8));
        return;
      }

      this.unexpectedRequests.push(`${request.method()} ${url.pathname}${url.search}`);
      this.notify();
      await json(route, { error: { code: "UNEXPECTED_E2E_REQUEST" } }, 404);
    });
  }

  waitForSubmit() {
    return this.waitUntil(() => this.pendingSubmit !== undefined);
  }

  async releaseSubmit() {
    const pending = this.pendingSubmit;
    if (!pending) throw new Error("No pending market submit");
    const body = pending.request.postDataJSON() as { version?: unknown };
    if (body.version !== 7)
      throw new Error(`Expected version 7, got ${String(body.version)}`);
    this.pendingSubmit = undefined;
    await json(pending.route, recordDetail("SOYBEAN", 8));
  }

  private async list(route: Route, url: URL) {
    const parameters = url.searchParams;
    const keys = [...parameters.keys()];
    const unique = new Set(keys);
    const productCode = productOrUndefined(parameters.get("productCode"));
    const pageNumber = integer(parameters.get("pageNumber"), 0);
    const pageSize = integer(parameters.get("pageSize"), 1);
    const valid =
      keys.length === unique.size &&
      keys.every((key) => listKeys.has(key)) &&
      [...parameters.values()].every((value) => value.trim() !== "") &&
      ["productCode", "pageKind", "pageNumber", "pageSize"].every((key) =>
        parameters.has(key),
      ) &&
      productCode !== undefined &&
      parameters.get("pageKind") === "MONITORING" &&
      pageNumber !== undefined &&
      pageSize !== undefined &&
      [20, 50, 100].includes(pageSize);
    if (!valid) {
      this.unexpectedRequests.push(`GET ${url.pathname}${url.search}`);
      this.notify();
      await json(route, { error: { code: "INVALID_E2E_MARKET_LIST_QUERY" } }, 400);
      return;
    }
    const query: MarketListQuery = {
      productCode,
      pageNumber,
      pageSize,
      ...(parameters.has("filter.objectTypeCode")
        ? { objectTypeCode: parameters.get("filter.objectTypeCode")! }
        : {}),
    };
    this.listQueries.push(query);
    this.notify();
    await json(route, listResponse(query));
  }

  private waitUntil(predicate: () => boolean) {
    if (predicate()) return Promise.resolve();
    return new Promise<void>((resolve) => {
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

function pageDefinition(productCode: MarketProductCode) {
  const item = marketProducts[productCode];
  return {
    data: {
      domain: "MARKET",
      pageKind: "MONITORING",
      productCode,
      title: `${item.name}市场采集`,
      breadcrumbs: [{ code: "MARKET", label: "市场监测" }],
      filters: [
        {
          code: "objectTypeCode",
          label: "监测对象",
          control: "select",
          placeholder: "全部监测对象",
          options: [{ value: item.objectType, label: objectLabel(item.objectType) }],
        },
      ],
      defaultContext: {},
      columnGroups: [
        {
          code: "base",
          label: "价格构成",
          fields: [
            field("MKT_OBJECT_TYPE", "监测对象", "TEXT"),
            field("MKT_PURCHASE_BASE_PRICE", "采购基础价", "DECIMAL"),
            field("MKT_CARRIAGE_BOARD_AMOUNT", "车板费用", "DECIMAL"),
            field("MKT_PACKAGING_AMOUNT", "包装费用", "DECIMAL"),
            field("MKT_FREIGHT_AMOUNT", "运费", "DECIMAL"),
            field("MKT_ACTUAL_TRADE_PRICE", "实际成交价", "DECIMAL"),
            field("MKT_REGION", "地区", "TEXT"),
            field("MKT_TRADE_DATE", "交易日期", "DATE"),
            field("MKT_TRADE_DIRECTION", "购销方向", "TEXT"),
            field("MKT_PACKAGING_FORM", "包装形式", "TEXT"),
            field("MKT_STATUS", "状态", "TEXT"),
          ],
        },
        {
          code: "quality",
          label: "质量指标",
          fields: [field(item.qualityCode, item.qualityLabel, "DECIMAL")],
        },
      ],
      actions: [
        { code: "NEW", label: "新建填报", scope: "page" },
        { code: "VIEW", label: "查看", scope: "row" },
        { code: "SUBMIT", label: "提交", scope: "row" },
        { code: "APPROVE", label: "审核通过", scope: "row" },
        { code: "RETURN", label: "退回", scope: "row" },
      ],
      pagination: { defaultPageSize: 20, pageSizeOptions: [20, 50, 100] },
    },
  };
}

function formDefinition(
  productCode: MarketProductCode,
  requestedObject: string | null,
) {
  const item = marketProducts[productCode];
  const objectTypeCode = requestedObject ?? null;
  return {
    data: {
      productCode,
      objectTypeCode,
      coreFields: [
        core("MKT_OBJECT_TYPE", "监测对象", "SELECT", [
          {
            value: item.objectType,
            label: objectLabel(item.objectType),
            sortOrder: 10,
          },
          { value: "BREEDING_ENTERPRISE", label: "养殖企业", sortOrder: 20 },
          { value: "FEED_ENTERPRISE", label: "饲料企业", sortOrder: 30 },
        ]),
        core("MKT_REGION", "地区", "REGION_HIERARCHY"),
        core("MKT_TRADE_DATE", "交易日期", "DATE"),
        core("MKT_TRADE_DIRECTION", "购销方向", "SELECT", [
          { value: "PURCHASE", label: "采购", sortOrder: 10 },
          { value: "SALE", label: "销售", sortOrder: 20 },
        ]),
        core("MKT_PURCHASE_BASE_PRICE", "采购基础价", "DECIMAL"),
        core("MKT_SALE_BASE_PRICE", "销售基础价", "DECIMAL"),
        core("MKT_CARRIAGE_BOARD_AMOUNT", "车板费用", "DECIMAL"),
        core("MKT_PACKAGING_FORM", "包装形式", "SELECT", [
          { value: "BULK", label: "散粮", sortOrder: 10 },
        ]),
        core("MKT_PACKAGING_AMOUNT", "包装费用", "DECIMAL"),
        core("MKT_FREIGHT_AMOUNT", "运费", "DECIMAL"),
        core("MKT_ACTUAL_TRADE_PRICE", "实际成交价", "READONLY_DECIMAL"),
      ],
      groups: [
        group("QUALITY", "质量指标", item.qualityCode, item.qualityLabel, 10),
        group("PURCHASE", "采购与成交", "PURCHASE_VOLUME", "采购量", 20),
        group("PROCESSING", "加工生产", "PROCESSING_VOLUME", "加工量", 30),
        group("INVENTORY", "库存", "INVENTORY_VOLUME", "库存量", 40),
      ],
    },
  };
}

function listResponse(query: MarketListQuery) {
  const item = marketProducts[query.productCode];
  return {
    data: {
      items: [
        {
          id: `${query.productCode}-record`,
          values: {
            MKT_OBJECT_TYPE: objectLabel(item.objectType),
            MKT_PURCHASE_BASE_PRICE: "2300.0000",
            MKT_CARRIAGE_BOARD_AMOUNT: "36.0000",
            MKT_PACKAGING_AMOUNT: "12.0000",
            MKT_FREIGHT_AMOUNT: "72.0000",
            MKT_ACTUAL_TRADE_PRICE: "2420.0000",
            MKT_REGION: "齐齐哈尔市",
            MKT_TRADE_DATE: "2026-08-01",
            MKT_TRADE_DIRECTION: "采购",
            MKT_PACKAGING_FORM: "散粮",
            MKT_STATUS: "草稿",
            [item.qualityCode]: "14.2000",
          },
          allowedActions: ["VIEW", "SUBMIT", "APPROVE", "RETURN"],
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

function recordDetail(productCode: MarketProductCode, version = 7) {
  const item = marketProducts[productCode];
  return {
    data: {
      id: `${productCode}-record`,
      productCode,
      objectTypeCode: item.objectType,
      regionCode: "230200",
      tradeDate: "2026-08-01",
      reportedAt: "2026-08-03T08:00:00+08:00",
      direction: "PURCHASE",
      purchaseBasePrice: "2300.0000",
      saleBasePrice: null,
      carriageBoardAmount: "36.0000",
      packagingAmount: "12.0000",
      freightAmount: "72.0000",
      packagingForm: "BULK",
      actualTradePrice: "2420.0000",
      status: version === 7 ? "DRAFT" : "PENDING_REVIEW",
      returnReason: null,
      facts: { [item.qualityCode]: "14.2000", PURCHASE_VOLUME: "100.0000" },
      allowedActions: ["VIEW", "SAVE", "SUBMIT", "APPROVE", "RETURN"],
      version,
    },
  };
}

function field(code: string, label: string, valueType: string) {
  return { code, label, valueType, unit: null, description: null };
}

function core(
  code: string,
  label: string,
  controlType: string,
  options: { value: string; label: string; sortOrder: number }[] = [],
) {
  return {
    code,
    label,
    controlType,
    unit: controlType.includes("DECIMAL") ? "元/吨" : null,
    precision: controlType.includes("DECIMAL") ? 18 : null,
    scale: controlType.includes("DECIMAL") ? 4 : null,
    sortOrder: 10,
    options,
  };
}

function group(
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
        unit: "吨",
        description: null,
        precision: 18,
        scale: 4,
        sortOrder: 10,
      },
    ],
  };
}

function objectLabel(code: string) {
  return code === "RICE_MILL"
    ? "米厂"
    : code === "DEEP_PROCESSOR"
      ? "深加工企业"
      : code;
}

function product(value: string | null): MarketProductCode {
  const result = productOrUndefined(value);
  if (!result) throw new Error(`Unexpected market product: ${String(value)}`);
  return result;
}

function productOrUndefined(value: string | null) {
  return value === "CORN" || value === "SOYBEAN" || value === "RICE"
    ? value
    : undefined;
}

function productFromRecord(id: string) {
  return product(id.split("-", 1)[0] ?? null);
}

function integer(value: string | null, minimum: number) {
  if (value === null || !/^(0|[1-9][0-9]*)$/.test(value)) return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= minimum && parsed <= 2147483647
    ? parsed
    : undefined;
}

async function json(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}
