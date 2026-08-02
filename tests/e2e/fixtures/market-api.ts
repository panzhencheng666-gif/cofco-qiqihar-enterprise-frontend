import type { Page, Route } from "@playwright/test";

import { parseJavaInt32 } from "../support/java-int32";

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

type MarketRecordStatus = "DRAFT" | "PENDING_REVIEW" | "RETURNED" | "APPROVED";

interface FixtureRecord {
  id: string;
  productCode: MarketProductCode;
  objectTypeCode: string;
  regionCode: string;
  tradeDate: string;
  reportedAt: string;
  direction: "PURCHASE" | "SALE";
  purchaseBasePrice: string | null;
  saleBasePrice: string | null;
  carriageBoardAmount: string;
  packagingAmount: string;
  freightAmount: string;
  packagingForm: string | null;
  actualTradePrice: string;
  status: MarketRecordStatus;
  returnReason: string | null;
  facts: Record<string, string>;
  version: number;
}

type FixtureDraft = Pick<
  FixtureRecord,
  | "productCode"
  | "objectTypeCode"
  | "regionCode"
  | "tradeDate"
  | "direction"
  | "purchaseBasePrice"
  | "saleBasePrice"
  | "carriageBoardAmount"
  | "packagingAmount"
  | "freightAmount"
  | "packagingForm"
  | "facts"
>;

export interface MarketWriteRequest {
  method: string;
  path: string;
  body: unknown;
  status: number;
}

export class MarketApiRoutes {
  readonly listQueries: MarketListQuery[] = [];
  readonly unexpectedRequests: string[] = [];
  readonly returnBodies: unknown[] = [];
  readonly writes: MarketWriteRequest[] = [];

  private pendingSubmit: { body: unknown; recordId: string; route: Route } | undefined;
  private readonly records = new Map<string, FixtureRecord>();
  private readonly waiters = new Set<() => void>();
  private nextId = 1;

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
          data: url.searchParams.has("parentCode")
            ? []
            : [{ id: "230200", label: "齐齐哈尔市", level: "PREFECTURE" }],
        });
        return;
      }
      if (
        request.method() === "GET" &&
        url.pathname === "/api/v1/regions/230200/path"
      ) {
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
      if (url.pathname === "/api/v1/market-records" && request.method() === "POST") {
        await this.create(route, request.postDataJSON());
        return;
      }
      if (request.method() === "GET" && detail) {
        const record = this.record(detail[1]!);
        if (!record) {
          await json(route, { error: { code: "MARKET_RECORD_NOT_FOUND" } }, 404);
          return;
        }
        await json(route, recordDetail(record));
        return;
      }
      if (request.method() === "PUT" && detail) {
        await this.update(route, detail[1]!, request.postDataJSON());
        return;
      }
      if (request.method() === "POST" && submit) {
        if (this.holdSubmit) {
          this.pendingSubmit = {
            body: request.postDataJSON(),
            recordId: submit[1]!,
            route,
          };
          this.notify();
        } else {
          await this.transition(route, submit[1]!, request.postDataJSON(), "submit");
        }
        return;
      }
      if (request.method() === "POST" && approve) {
        await this.transition(route, approve[1]!, request.postDataJSON(), "approve");
        return;
      }
      if (request.method() === "POST" && returned) {
        this.returnBodies.push(request.postDataJSON());
        await this.transition(route, returned[1]!, request.postDataJSON(), "return");
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
    const body = pending.body as { version?: unknown };
    if (body.version !== 7)
      throw new Error(`Expected version 7, got ${String(body.version)}`);
    this.pendingSubmit = undefined;
    await this.transition(pending.route, pending.recordId, body, "submit");
  }

  recordCount(productCode: MarketProductCode) {
    this.seed(productCode);
    return [...this.records.values()].filter(
      (record) => record.productCode === productCode,
    ).length;
  }

  private async list(route: Route, url: URL) {
    const parameters = url.searchParams;
    const keys = [...parameters.keys()];
    const unique = new Set(keys);
    const productCode = productOrUndefined(parameters.get("productCode"));
    const pageNumber = parseJavaInt32(parameters.get("pageNumber"));
    const pageSize = parseJavaInt32(parameters.get("pageSize"));
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
      pageNumber >= 0 &&
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
    this.seed(query.productCode);
    await json(
      route,
      listResponse(
        query,
        [...this.records.values()].filter(
          (record) => record.productCode === query.productCode,
        ),
      ),
    );
  }

  private async create(route: Route, body: unknown) {
    const draft = validDraft(body);
    if (!draft) {
      await this.writeError(route, "POST", "/api/v1/market-records", body, 400);
      return;
    }
    const record: FixtureRecord = {
      id: `${draft.productCode}-created-${this.nextId++}`,
      ...draft,
      reportedAt: "2026-08-03T09:00:00+08:00",
      actualTradePrice: actualPrice(draft),
      status: "DRAFT",
      returnReason: null,
      version: 0,
    };
    this.records.set(record.id, record);
    this.writes.push({
      method: "POST",
      path: "/api/v1/market-records",
      body,
      status: 201,
    });
    await json(route, recordDetail(record), 201);
  }

  private async update(route: Route, id: string, body: unknown) {
    const current = this.record(id);
    const draft = validVersionedDraft(body);
    if (!current || !draft) {
      await this.writeError(route, "PUT", `/api/v1/market-records/${id}`, body, 400);
      return;
    }
    if (
      draft.version !== current.version ||
      !["DRAFT", "RETURNED"].includes(current.status) ||
      draft.productCode !== current.productCode
    ) {
      await this.writeError(route, "PUT", `/api/v1/market-records/${id}`, body, 409);
      return;
    }
    const next: FixtureRecord = {
      ...current,
      ...draft,
      actualTradePrice: actualPrice(draft),
      status: "DRAFT",
      returnReason: null,
      version: current.version + 1,
    };
    this.records.set(id, next);
    this.writes.push({
      method: "PUT",
      path: `/api/v1/market-records/${id}`,
      body,
      status: 200,
    });
    await json(route, recordDetail(next));
  }

  private async transition(
    route: Route,
    id: string,
    body: unknown,
    action: "submit" | "approve" | "return",
  ) {
    const current = this.record(id);
    const command = validCommand(body, action);
    const path = `/api/v1/market-records/${id}/${action}`;
    if (!current || !command) {
      await this.writeError(route, "POST", path, body, 400);
      return;
    }
    const validState =
      (action === "submit" && ["DRAFT", "RETURNED"].includes(current.status)) ||
      ((action === "approve" || action === "return") &&
        current.status === "PENDING_REVIEW");
    if (command.version !== current.version || !validState) {
      await this.writeError(route, "POST", path, body, 409);
      return;
    }
    const next: FixtureRecord = {
      ...current,
      status:
        action === "submit"
          ? "PENDING_REVIEW"
          : action === "approve"
            ? "APPROVED"
            : "RETURNED",
      returnReason: action === "return" ? command.reason : null,
      version: current.version + 1,
    };
    this.records.set(id, next);
    this.writes.push({ method: "POST", path, body, status: 200 });
    await json(route, recordDetail(next));
  }

  private async writeError(
    route: Route,
    method: string,
    path: string,
    body: unknown,
    status: 400 | 409,
  ) {
    this.writes.push({ method, path, body, status });
    await json(
      route,
      {
        error: { code: status === 409 ? "VERSION_CONFLICT" : "INVALID_MARKET_RECORD" },
      },
      status,
    );
  }

  private record(id: string) {
    const productCode = productOrUndefined(id.split("-", 1)[0] ?? null);
    if (!productCode) return undefined;
    this.seed(productCode);
    return this.records.get(id);
  }

  private seed(productCode: MarketProductCode) {
    const id = `${productCode}-record`;
    if (this.records.has(id)) return;
    const item = marketProducts[productCode];
    this.records.set(id, {
      id,
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
      status: "DRAFT",
      returnReason: null,
      facts: { [item.qualityCode]: "14.2000", PURCHASE_VOLUME: "100.0000" },
      version: 7,
    });
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
            field("MKT_REPORTED_AT", "填报时间", "DATETIME"),
            field(
              "MKT_PURCHASE_BASE_PRICE",
              "采购基础价",
              "DECIMAL",
              "采购基础价未包含车板、包装和运费组成",
            ),
            field(
              "MKT_SALE_BASE_PRICE",
              "销售基础价",
              "DECIMAL",
              "销售基础价未包含车板、包装和运费组成",
            ),
            field("MKT_CARRIAGE_BOARD_AMOUNT", "车板费用", "DECIMAL"),
            field("MKT_PACKAGING_AMOUNT", "包装费用", "DECIMAL"),
            field("MKT_FREIGHT_AMOUNT", "运费", "DECIMAL"),
            field(
              "MKT_ACTUAL_TRADE_PRICE",
              "实际成交价",
              "DECIMAL",
              "实际成交价已包含车板、包装和运费组成",
            ),
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
        core("MKT_REPORTED_AT", "填报时间", "READONLY_DATETIME"),
        core("MKT_TRADE_DIRECTION", "购销方向", "SELECT", [
          { value: "PURCHASE", label: "采购", sortOrder: 10 },
          { value: "SALE", label: "销售", sortOrder: 20 },
        ]),
        core(
          "MKT_PURCHASE_BASE_PRICE",
          "采购基础价",
          "DECIMAL",
          [],
          "采购基础价未包含车板、包装和运费组成",
        ),
        core(
          "MKT_SALE_BASE_PRICE",
          "销售基础价",
          "DECIMAL",
          [],
          "销售基础价未包含车板、包装和运费组成",
        ),
        core("MKT_CARRIAGE_BOARD_AMOUNT", "车板费用", "DECIMAL"),
        core("MKT_PACKAGING_FORM", "包装形式", "SELECT", [
          { value: "BULK", label: "散粮", sortOrder: 10 },
        ]),
        core("MKT_PACKAGING_AMOUNT", "包装费用", "DECIMAL"),
        core("MKT_FREIGHT_AMOUNT", "运费", "DECIMAL"),
        core(
          "MKT_ACTUAL_TRADE_PRICE",
          "实际成交价",
          "READONLY_DECIMAL",
          [],
          "实际成交价已包含车板、包装和运费组成",
        ),
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

function listResponse(query: MarketListQuery, records: FixtureRecord[]) {
  const item = marketProducts[query.productCode];
  return {
    data: {
      items: records.map((record) => ({
        id: record.id,
        values: {
          MKT_OBJECT_TYPE: objectLabel(record.objectTypeCode),
          MKT_REPORTED_AT: record.reportedAt,
          MKT_PURCHASE_BASE_PRICE: record.purchaseBasePrice,
          MKT_SALE_BASE_PRICE: record.saleBasePrice,
          MKT_CARRIAGE_BOARD_AMOUNT: record.carriageBoardAmount,
          MKT_PACKAGING_AMOUNT: record.packagingAmount,
          MKT_FREIGHT_AMOUNT: record.freightAmount,
          MKT_ACTUAL_TRADE_PRICE: record.actualTradePrice,
          MKT_REGION: "齐齐哈尔市",
          MKT_TRADE_DATE: record.tradeDate,
          MKT_TRADE_DIRECTION: record.direction === "PURCHASE" ? "采购" : "销售",
          MKT_PACKAGING_FORM: record.packagingForm === "BULK" ? "散粮" : null,
          MKT_STATUS: statusLabel(record.status),
          [item.qualityCode]: record.facts[item.qualityCode] ?? null,
        },
        allowedActions: allowedActions(record.status),
        version: record.version,
      })),
      pageNumber: query.pageNumber,
      pageSize: query.pageSize,
      totalElements: 2,
      totalPages: 2,
    },
  };
}

function recordDetail(record: FixtureRecord) {
  return {
    data: {
      ...record,
      allowedActions: allowedActions(record.status),
    },
  };
}

function allowedActions(status: MarketRecordStatus) {
  if (status === "DRAFT" || status === "RETURNED") {
    return ["VIEW", "SAVE", "SUBMIT"];
  }
  if (status === "PENDING_REVIEW") return ["VIEW", "APPROVE", "RETURN"];
  return ["VIEW"];
}

function statusLabel(status: MarketRecordStatus) {
  if (status === "DRAFT") return "草稿";
  if (status === "PENDING_REVIEW") return "待审核";
  if (status === "RETURNED") return "已退回";
  return "已审核";
}

const draftKeys = new Set([
  "productCode",
  "objectTypeCode",
  "regionCode",
  "tradeDate",
  "direction",
  "purchaseBasePrice",
  "saleBasePrice",
  "carriageBoardAmount",
  "packagingAmount",
  "freightAmount",
  "packagingForm",
  "facts",
]);

function validDraft(value: unknown): FixtureDraft | undefined {
  if (!plainObject(value) || !exactKeys(value, draftKeys)) return undefined;
  const productCode = productOrUndefined(stringValue(value.productCode));
  if (!productCode) return undefined;
  const item = marketProducts[productCode];
  const direction = value.direction;
  const purchaseBasePrice = nullableDecimal(value.purchaseBasePrice);
  const saleBasePrice = nullableDecimal(value.saleBasePrice);
  const carriageBoardAmount = decimal(value.carriageBoardAmount);
  const packagingAmount = decimal(value.packagingAmount);
  const freightAmount = decimal(value.freightAmount);
  if (
    typeof value.objectTypeCode !== "string" ||
    !new Set([item.objectType, "BREEDING_ENTERPRISE", "FEED_ENTERPRISE"]).has(
      value.objectTypeCode,
    ) ||
    value.regionCode !== "230200" ||
    typeof value.tradeDate !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value.tradeDate) ||
    (direction !== "PURCHASE" && direction !== "SALE") ||
    purchaseBasePrice === undefined ||
    saleBasePrice === undefined ||
    (direction === "PURCHASE" &&
      (purchaseBasePrice === null || saleBasePrice !== null)) ||
    (direction === "SALE" && (saleBasePrice === null || purchaseBasePrice !== null)) ||
    carriageBoardAmount === undefined ||
    packagingAmount === undefined ||
    freightAmount === undefined ||
    (value.packagingForm !== null && value.packagingForm !== "BULK") ||
    !validFacts(value.facts, productCode)
  ) {
    return undefined;
  }
  return {
    productCode,
    objectTypeCode: value.objectTypeCode,
    regionCode: value.regionCode,
    tradeDate: value.tradeDate,
    direction,
    purchaseBasePrice,
    saleBasePrice,
    carriageBoardAmount,
    packagingAmount,
    freightAmount,
    packagingForm: value.packagingForm,
    facts: value.facts,
  };
}

function validVersionedDraft(value: unknown) {
  if (!plainObject(value)) return undefined;
  const { version, ...draft } = value;
  if (!Number.isInteger(version) || (version as number) < 0) return undefined;
  const result = validDraft(draft);
  return result ? { ...result, version: version as number } : undefined;
}

function validCommand(value: unknown, action: "submit" | "approve" | "return") {
  if (!plainObject(value)) return undefined;
  const keys =
    action === "return" ? new Set(["version", "reason"]) : new Set(["version"]);
  if (
    !exactKeys(value, keys) ||
    !Number.isInteger(value.version) ||
    (value.version as number) < 0 ||
    (action === "return" &&
      (typeof value.reason !== "string" || value.reason.trim() === ""))
  ) {
    return undefined;
  }
  return {
    version: value.version as number,
    reason: action === "return" ? (value.reason as string) : null,
  };
}

function validFacts(
  value: unknown,
  productCode: MarketProductCode,
): value is Record<string, string> {
  if (!plainObject(value)) return false;
  const allowed = new Set([
    marketProducts[productCode].qualityCode,
    "PURCHASE_VOLUME",
    "PROCESSING_VOLUME",
    "INVENTORY_VOLUME",
  ]);
  return Object.entries(value).every(
    ([key, fact]) => allowed.has(key) && decimal(fact) !== undefined,
  );
}

function actualPrice(draft: FixtureDraft) {
  const base =
    draft.direction === "PURCHASE" ? draft.purchaseBasePrice! : draft.saleBasePrice!;
  const total = [
    base,
    draft.carriageBoardAmount,
    draft.packagingAmount,
    draft.freightAmount,
  ].reduce((sum, value) => sum + decimalUnits(value), 0n);
  return `${total / 10_000n}.${String(total % 10_000n).padStart(4, "0")}`;
}

function decimalUnits(value: string) {
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole!) * 10_000n + BigInt(fraction.padEnd(4, "0"));
}

function nullableDecimal(value: unknown): string | null | undefined {
  if (value === null) return null;
  return decimal(value);
}

function decimal(value: unknown): string | undefined {
  return typeof value === "string" && /^(0|[1-9]\d*)(\.\d{1,4})?$/.test(value)
    ? value
    : undefined;
}

function exactKeys(value: Record<string, unknown>, expected: Set<string>) {
  const keys = Object.keys(value);
  return keys.length === expected.size && keys.every((key) => expected.has(key));
}

function plainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : null;
}

function field(
  code: string,
  label: string,
  valueType: string,
  description: string | null = null,
) {
  return { code, label, valueType, unit: null, description };
}

function core(
  code: string,
  label: string,
  controlType: string,
  options: { value: string; label: string; sortOrder: number }[] = [],
  description: string | null = null,
) {
  return {
    code,
    label,
    controlType,
    unit: controlType.includes("DECIMAL") ? "元/吨" : null,
    description,
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

async function json(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}
