import type { Page, Route } from "@playwright/test";

import { parseJavaInt32 } from "../support/java-int32";
import {
  marketFactDefinitions,
  marketProducts,
  type MarketFactCode,
  type MarketProductCode,
} from "./market-contract";

export { marketProducts } from "./market-contract";
export type { MarketProductCode } from "./market-contract";

const listKeys = new Set([
  "productCode",
  "pageKind",
  "pageNumber",
  "pageSize",
  "filter.objectTypeCode",
]);
const draftKeys = new Set(["productCode", "coreValues", "facts"]);
const editableCoreCodes = new Set([
  "MKT_OBJECT_TYPE",
  "MKT_REGION",
  "MKT_TRADE_DATE",
  "MKT_TRADE_DIRECTION",
  "MKT_PURCHASE_BASE_PRICE",
  "MKT_SALE_BASE_PRICE",
  "MKT_CARRIAGE_BOARD_AMOUNT",
  "MKT_PACKAGING_FORM",
  "MKT_PACKAGING_AMOUNT",
  "MKT_FREIGHT_AMOUNT",
  "MKT_SOURCE_NOTE",
]);
const amountCodes = [
  "MKT_CARRIAGE_BOARD_AMOUNT",
  "MKT_PACKAGING_AMOUNT",
  "MKT_FREIGHT_AMOUNT",
] as const;

export interface MarketListQuery {
  productCode: MarketProductCode;
  pageNumber: number;
  pageSize: number;
  objectTypeCode?: string;
}

type MarketRecordStatus = "DRAFT" | "PENDING_REVIEW" | "RETURNED" | "APPROVED";

interface FixtureDraft {
  productCode: MarketProductCode;
  coreValues: Record<string, string | null>;
  facts: Record<string, string>;
}

interface FixtureRecord extends FixtureDraft {
  id: string;
  status: MarketRecordStatus;
  returnReason: string | null;
  version: number;
}

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
          data: Object.entries(marketProducts).map(([id, item]) => ({
            id,
            name: item.name,
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
        await json(route, pageDefinition(product(url.searchParams.get("productCode"))));
        return;
      }
      if (
        request.method() === "GET" &&
        url.pathname === "/api/v1/market-record-definitions"
      ) {
        const productCode = product(url.searchParams.get("productCode"));
        const requestedObject = url.searchParams.get("objectTypeCode");
        if (requestedObject && !objectContract(productCode, requestedObject)) {
          await json(route, { error: { code: "INVALID_MARKET_RECORD" } }, 400);
          return;
        }
        await json(route, formDefinition(productCode, requestedObject));
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
    if (body.version !== 7) {
      throw new Error(`Expected version 7, got ${String(body.version)}`);
    }
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
    const productCode = productOrUndefined(parameters.get("productCode"));
    const pageNumber = parseJavaInt32(parameters.get("pageNumber"));
    const pageSize = parseJavaInt32(parameters.get("pageSize"));
    const objectTypeCode = parameters.get("filter.objectTypeCode");
    const valid =
      keys.length === new Set(keys).size &&
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
      [20, 50, 100].includes(pageSize) &&
      (!objectTypeCode || objectContract(productCode, objectTypeCode) !== undefined);
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
      ...(objectTypeCode ? { objectTypeCode } : {}),
    };
    this.listQueries.push(query);
    this.notify();
    this.seed(productCode);
    const records = [...this.records.values()].filter(
      (record) =>
        record.productCode === productCode &&
        (!objectTypeCode || record.coreValues.MKT_OBJECT_TYPE === objectTypeCode),
    );
    await json(route, listResponse(query, records));
  }

  private async create(route: Route, body: unknown) {
    const draft = validDraft(body);
    if (!draft) {
      await this.writeError(route, "POST", "/api/v1/market-records", body, 400);
      return;
    }
    const record: FixtureRecord = {
      id: `${draft.productCode}-created-${this.nextId++}`,
      ...serverDraft(draft, "2026-08-03T09:00:00+08:00"),
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
      ...serverDraft(draft, "2026-08-03T09:00:00+08:00"),
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
        error: {
          code:
            status === 409 ? "MARKET_RECORD_VERSION_CONFLICT" : "INVALID_MARKET_RECORD",
        },
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
      coreValues: {
        MKT_OBJECT_TYPE: item.defaultObject,
        MKT_REGION: "230200",
        MKT_TRADE_DATE: "2026-08-01",
        MKT_REPORTED_AT: "2026-08-03T08:00:00+08:00",
        MKT_TRADE_DIRECTION: "PURCHASE",
        MKT_PURCHASE_BASE_PRICE: "2300.0000",
        MKT_SALE_BASE_PRICE: null,
        MKT_CARRIAGE_BOARD_AMOUNT: "36.0000",
        MKT_PACKAGING_FORM: "BULK",
        MKT_PACKAGING_AMOUNT: "12.0000",
        MKT_FREIGHT_AMOUNT: "72.0000",
        MKT_SOURCE_NOTE: "产地直采",
        MKT_ACTUAL_TRADE_PRICE: "2420.0000",
      },
      facts: {
        [item.qualityCode]: "14.2000",
        PURCHASE_VOLUME: "100.0000",
      },
      status: "DRAFT",
      returnReason: null,
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
          options: objectEntries(productCode).map(([value, contract], index) => ({
            value,
            label: contract.label,
            sortOrder: (index + 1) * 10,
          })),
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
            field("MKT_SOURCE_NOTE", "来源说明", "TEXT"),
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
          fields: [
            factField(item.qualityCode, marketFactDefinitions[item.qualityCode]),
          ],
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
  const applicableFacts = requestedObject
    ? objectContract(productCode, requestedObject)!.facts
    : [];
  return {
    data: {
      productCode,
      objectTypeCode: requestedObject,
      coreFields: [
        core(
          "MKT_OBJECT_TYPE",
          "监测对象",
          "SELECT",
          "OBJECT_TYPE_CONTEXT",
          true,
          objectEntries(productCode).map(([value, contract], index) => ({
            value,
            label: contract.label,
            sortOrder: (index + 1) * 10,
          })),
        ),
        core("MKT_REGION", "地区", "REGION_HIERARCHY", "GENERIC", true),
        core("MKT_TRADE_DATE", "交易日期", "DATE", "GENERIC", true),
        core("MKT_REPORTED_AT", "填报时间", "READONLY_DATETIME", "GENERIC", false),
        core("MKT_TRADE_DIRECTION", "购销方向", "SELECT", "PRICE_DIRECTION", true, [
          { value: "PURCHASE", label: "采购", sortOrder: 10 },
          { value: "SALE", label: "销售", sortOrder: 20 },
        ]),
        core(
          "MKT_PURCHASE_BASE_PRICE",
          "采购基础价",
          "DECIMAL",
          "PURCHASE_BASE_PRICE",
          false,
          [],
          "采购基础价未包含车板、包装和运费组成",
        ),
        core(
          "MKT_SALE_BASE_PRICE",
          "销售基础价",
          "DECIMAL",
          "SALE_BASE_PRICE",
          false,
          [],
          "销售基础价未包含车板、包装和运费组成",
        ),
        core(
          "MKT_CARRIAGE_BOARD_AMOUNT",
          "车板费用",
          "DECIMAL",
          "PRICE_COMPONENT",
          true,
        ),
        core("MKT_PACKAGING_FORM", "包装形式", "SELECT", "GENERIC", true, [
          { value: "BAGGED", label: "包粮", sortOrder: 10 },
          { value: "BULK", label: "散粮", sortOrder: 20 },
        ]),
        core("MKT_PACKAGING_AMOUNT", "包装费用", "DECIMAL", "PRICE_COMPONENT", true),
        core("MKT_FREIGHT_AMOUNT", "运费", "DECIMAL", "PRICE_COMPONENT", true),
        core("MKT_SOURCE_NOTE", "来源说明", "TEXT", "GENERIC", false),
        core(
          "MKT_ACTUAL_TRADE_PRICE",
          "实际成交价",
          "READONLY_DECIMAL",
          "ACTUAL_TRADE_PRICE",
          false,
          [],
          "实际成交价已包含车板、包装和运费组成",
        ),
      ],
      groups: [
        factGroup("QUALITY", "质量指标", 10, applicableFacts),
        factGroup("PURCHASE", "采购与成交", 20, applicableFacts),
        factGroup("SALES", "销售", 30, applicableFacts),
        factGroup("PROCESSING", "加工生产", 40, applicableFacts),
        factGroup("INVENTORY", "库存", 50, applicableFacts),
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
          ...record.coreValues,
          MKT_OBJECT_TYPE:
            objectContract(record.productCode, record.coreValues.MKT_OBJECT_TYPE ?? "")
              ?.label ?? null,
          MKT_REGION: "齐齐哈尔市",
          MKT_TRADE_DIRECTION:
            record.coreValues.MKT_TRADE_DIRECTION === "PURCHASE" ? "采购" : "销售",
          MKT_PACKAGING_FORM:
            record.coreValues.MKT_PACKAGING_FORM === "BULK" ? "散粮" : "包粮",
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

function validDraft(value: unknown): FixtureDraft | undefined {
  if (!plainObject(value) || !exactKeys(value, draftKeys)) return undefined;
  const productCode = productOrUndefined(stringValue(value.productCode));
  if (!productCode || !plainObject(value.coreValues) || !plainObject(value.facts)) {
    return undefined;
  }
  const coreValues = value.coreValues;
  if (!Object.keys(coreValues).every((code) => editableCoreCodes.has(code))) {
    return undefined;
  }
  const objectType = stringValue(coreValues.MKT_OBJECT_TYPE);
  const object = objectType ? objectContract(productCode, objectType) : undefined;
  const direction = coreValues.MKT_TRADE_DIRECTION;
  const purchase = nullableDecimal(coreValues.MKT_PURCHASE_BASE_PRICE);
  const sale = nullableDecimal(coreValues.MKT_SALE_BASE_PRICE);
  if (
    !object ||
    coreValues.MKT_REGION !== "230200" ||
    typeof coreValues.MKT_TRADE_DATE !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(coreValues.MKT_TRADE_DATE) ||
    (direction !== "PURCHASE" && direction !== "SALE") ||
    purchase === undefined ||
    sale === undefined ||
    (direction === "PURCHASE" && purchase === null) ||
    (direction === "SALE" && sale === null) ||
    amountCodes.some((code) => decimal(coreValues[code]) === undefined) ||
    (coreValues.MKT_PACKAGING_FORM !== "BAGGED" &&
      coreValues.MKT_PACKAGING_FORM !== "BULK") ||
    (coreValues.MKT_SOURCE_NOTE !== undefined &&
      (typeof coreValues.MKT_SOURCE_NOTE !== "string" ||
        coreValues.MKT_SOURCE_NOTE.trim() === "")) ||
    !validFacts(value.facts, object.facts)
  ) {
    return undefined;
  }
  return {
    productCode,
    coreValues: Object.fromEntries(
      Object.entries(coreValues).map(([code, entry]) => [
        code,
        entry === undefined ? null : (entry as string | null),
      ]),
    ),
    facts: value.facts as Record<string, string>,
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

function serverDraft(draft: FixtureDraft, reportedAt: string): FixtureDraft {
  const coreValues = { ...draft.coreValues };
  for (const code of [
    "MKT_PURCHASE_BASE_PRICE",
    "MKT_SALE_BASE_PRICE",
    ...amountCodes,
  ]) {
    const value = coreValues[code];
    if (value) coreValues[code] = formatUnits(decimalUnits(value)!);
  }
  coreValues.MKT_REPORTED_AT = reportedAt;
  coreValues.MKT_ACTUAL_TRADE_PRICE = actualPrice(draft);
  return {
    productCode: draft.productCode,
    coreValues,
    facts: Object.fromEntries(
      Object.entries(draft.facts).map(([code, value]) => [
        code,
        formatUnits(decimalUnits(value)!),
      ]),
    ),
  };
}

function validFacts(
  value: Record<string, unknown>,
  applicable: readonly MarketFactCode[],
) {
  const allowed = new Set<string>(applicable);
  return Object.entries(value).every(
    ([code, factValue]) => allowed.has(code) && decimal(factValue) !== undefined,
  );
}

function actualPrice(draft: FixtureDraft) {
  const direction = draft.coreValues.MKT_TRADE_DIRECTION;
  const base =
    direction === "PURCHASE"
      ? draft.coreValues.MKT_PURCHASE_BASE_PRICE
      : draft.coreValues.MKT_SALE_BASE_PRICE;
  const values = [base, ...amountCodes.map((code) => draft.coreValues[code])];
  let total = 0n;
  for (const value of values) total += decimalUnits(value)!;
  return formatUnits(total);
}

function decimalUnits(value: unknown) {
  if (typeof value !== "string" || !/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(value)) {
    return undefined;
  }
  const [whole = "0", fraction = ""] = value.split(".");
  const padded = fraction.padEnd(5, "0");
  let units = BigInt(whole || "0") * 10_000n + BigInt(padded.slice(0, 4));
  if (padded.charAt(4) >= "5") units += 1n;
  return units <= 999_999_999_999_999_999n ? units : undefined;
}

function formatUnits(units: bigint) {
  return `${units / 10_000n}.${String(units % 10_000n).padStart(4, "0")}`;
}

function nullableDecimal(value: unknown): string | null | undefined {
  if (value === null || value === undefined) return null;
  return decimal(value);
}

function decimal(value: unknown): string | undefined {
  return decimalUnits(value) === undefined ? undefined : (value as string);
}

function factGroup(
  category: "QUALITY" | "PURCHASE" | "SALES" | "PROCESSING" | "INVENTORY",
  label: string,
  sortOrder: number,
  applicable: readonly MarketFactCode[],
) {
  return {
    category,
    label,
    sortOrder,
    fields: applicable
      .filter((code) => marketFactDefinitions[code].category === category)
      .map((code) => factField(code, marketFactDefinitions[code])),
  };
}

function factField(
  code: MarketFactCode,
  definition: (typeof marketFactDefinitions)[MarketFactCode],
) {
  return {
    code,
    label: definition.label,
    valueType: "DECIMAL",
    unit: definition.unit,
    description: null,
    precision: 18,
    scale: definition.category === "QUALITY" ? 1 : 4,
    sortOrder: definition.sortOrder,
  };
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
  capability: string,
  required: boolean,
  options: { value: string; label: string; sortOrder: number }[] = [],
  description: string | null = null,
) {
  return {
    code,
    label,
    controlType,
    capability,
    required,
    unit: controlType.includes("DECIMAL") ? "元/吨" : null,
    description,
    precision: controlType.includes("DECIMAL") ? 18 : null,
    scale: controlType.includes("DECIMAL") ? 4 : null,
    sortOrder: 10,
    options,
  };
}

function objectEntries(productCode: MarketProductCode) {
  return Object.entries(marketProducts[productCode].objects) as [
    string,
    { label: string; facts: readonly MarketFactCode[] },
  ][];
}

function objectContract(productCode: MarketProductCode, objectTypeCode: string) {
  return Object.fromEntries(objectEntries(productCode))[objectTypeCode];
}

function allowedActions(status: MarketRecordStatus) {
  if (status === "DRAFT" || status === "RETURNED") return ["VIEW", "SAVE", "SUBMIT"];
  if (status === "PENDING_REVIEW") return ["VIEW", "APPROVE", "RETURN"];
  return ["VIEW"];
}

function statusLabel(status: MarketRecordStatus) {
  if (status === "DRAFT") return "草稿";
  if (status === "PENDING_REVIEW") return "待审核";
  if (status === "RETURNED") return "已退回";
  return "已审核";
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
