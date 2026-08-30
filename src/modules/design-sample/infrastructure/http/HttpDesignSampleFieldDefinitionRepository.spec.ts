import type { HttpClient } from "../../../../shared/api/HttpClient";
import { designSampleValueState } from "../../domain/designSampleFieldContract";
import { HttpDesignSampleFieldDefinitionRepository } from "./HttpDesignSampleFieldDefinitionRepository";

const context = {
  domainCode: "MARKET",
  productCode: "CORN",
  objectTypeCode: "TRADER",
} as const;

describe("HttpDesignSampleFieldDefinitionRepository", () => {
  it("loads and strictly parses the echoed backend context", async () => {
    const http: HttpClient = {
      get: (path, schema) => {
        expect(path).toBe(
          "/api/v1/design-sample-field-definitions?domainCode=MARKET&productCode=CORN&objectTypeCode=TRADER",
        );
        return Promise.resolve(schema.parse(validContract()));
      },
    };

    const result = await new HttpDesignSampleFieldDefinitionRepository(
      http,
    ).getDefinition(context);

    expect(result.contractVersion).toBe("design-sample-fields-v1");
    expect(result.domains).toHaveLength(2);
    expect(result.products).toHaveLength(3);
    expect(result.objectTypes).toHaveLength(11);
    expect(result.supportedContexts).toHaveLength(27);
  });

  it.each([
    ["missing digest", (value: Record<string, unknown>) => delete value.contractDigest],
    [
      "unknown value type",
      (value: Record<string, unknown>) => {
        const fields = value.observationFields as Array<Record<string, unknown>>;
        first(fields).valueType = "MONEY";
      },
    ],
    [
      "duplicate field code",
      (value: Record<string, unknown>) => {
        const identity = value.identityFields as Array<Record<string, unknown>>;
        const observation = value.observationFields as Array<Record<string, unknown>>;
        first(observation).code = first(identity).code;
      },
    ],
    [
      "invalid enum shape",
      (value: Record<string, unknown>) => {
        const fields = value.observationFields as Array<Record<string, unknown>>;
        first(fields).enumOptions = ["INVALID"];
      },
    ],
    [
      "context echo mismatch",
      (value: Record<string, unknown>) => {
        value.context = { ...context, productCode: "RICE" };
      },
    ],
    [
      "unknown top-level property",
      (value: Record<string, unknown>) => {
        value.localFieldMatrix = {};
      },
    ],
  ])("rejects %s", async (_label, mutate) => {
    const payload = validContract() as unknown as Record<string, unknown>;
    mutate(payload);
    const http: HttpClient = {
      get: (_path, schema) => Promise.resolve(schema.parse(payload)),
    };

    await expect(
      new HttpDesignSampleFieldDefinitionRepository(http).getDefinition(context),
    ).rejects.toThrow();
  });

  it("keeps not-applicable, unknown and real zero distinct", () => {
    const field = validContract().observationFields[0];

    expect(designSampleValueState(undefined, undefined)).toBe("NOT_APPLICABLE");
    expect(designSampleValueState(field, null)).toBe("UNKNOWN");
    expect(designSampleValueState(field, 0)).toBe("KNOWN");
  });
});

function validContract() {
  const domains = [
    {
      code: "PRODUCTION",
      label: "产情域",
      description: "产情",
      aliases: [],
      sortOrder: 10,
    },
    {
      code: "MARKET",
      label: "市场域",
      description: "市场",
      aliases: [],
      sortOrder: 20,
    },
  ];
  const products = [
    { code: "CORN", label: "玉米", aliases: [], sortOrder: 10 },
    { code: "SOYBEAN", label: "大豆", aliases: [], sortOrder: 20 },
    { code: "RICE", label: "水稻", aliases: ["稻谷"], sortOrder: 30 },
  ];
  const objectTypes = [
    objectType("PRODUCTION", "FARMER", 10),
    objectType("PRODUCTION", "VILLAGE_COMMITTEE", 20),
    objectType("PRODUCTION", "AGRICULTURAL_TECH_STATION", 30),
    objectType("MARKET", "TRADER", 110),
    objectType("MARKET", "DEEP_PROCESSOR", 120),
    objectType("MARKET", "WHOLESALE_MARKET", 130),
    objectType("MARKET", "RESERVE_ENTERPRISE", 140),
    objectType("MARKET", "RICE_MILL", 150),
    objectType("MARKET", "BREEDING_FACTORY", 160),
    objectType("MARKET", "FEED_MILL", 170),
    objectType("MARKET", "AGRICULTURAL_INPUT_STORE", 180),
  ];
  const supportedContexts = legalContexts().map((entry, index) => ({
    ...entry,
    sortOrder: (index + 1) * 10,
  }));
  return {
    contractVersion: "design-sample-fields-v1",
    contractDigest: `sha256:${"a".repeat(64)}`,
    context,
    domains,
    products,
    objectTypes,
    supportedContexts,
    identityFields: [field("DSP_NAME", "IDENTITY", "STRING", 10, { maxLength: 200 })],
    observationFields: [
      field("MKT_PURCHASE_BASE_PRICE", "OBSERVATION", "DECIMAL", 310, {
        precision: 18,
        scale: 4,
        unit: "元/吨",
        minimumValue: "0",
        nullable: true,
        required: false,
      }),
    ],
  };
}

function first<T>(values: T[]): T {
  const value = values[0];
  if (value === undefined) throw new Error("fixture must not be empty");
  return value;
}

function objectType(domainCode: string, code: string, sortOrder: number) {
  return { domainCode, code, label: code, aliases: [], sortOrder };
}

function field(
  code: string,
  sectionCode: "IDENTITY" | "OBSERVATION",
  valueType: "STRING" | "DECIMAL",
  sortOrder: number,
  overrides: Record<string, unknown> = {},
) {
  return {
    code,
    sectionCode,
    label: code,
    description: code,
    valueType,
    precision: null,
    scale: null,
    maxLength: null,
    unit: null,
    enumOptions: [],
    required: true,
    nullable: false,
    defaultValue: null,
    editable: true,
    minimumValue: null,
    maximumValue: null,
    groupCode: sectionCode,
    sortOrder,
    analysisRole: "NONE",
    ...overrides,
  };
}

function legalContexts() {
  const productionObjects = [
    "FARMER",
    "VILLAGE_COMMITTEE",
    "AGRICULTURAL_TECH_STATION",
  ];
  const grainMarketObjects = [
    "TRADER",
    "DEEP_PROCESSOR",
    "WHOLESALE_MARKET",
    "RESERVE_ENTERPRISE",
  ];
  const products = ["CORN", "SOYBEAN", "RICE"];
  return [
    ...productionObjects.flatMap((objectTypeCode) =>
      products.map((productCode) => ({
        domainCode: "PRODUCTION",
        productCode,
        objectTypeCode,
      })),
    ),
    ...grainMarketObjects.flatMap((objectTypeCode) =>
      products.map((productCode) => ({
        domainCode: "MARKET",
        productCode,
        objectTypeCode,
      })),
    ),
    { domainCode: "MARKET", productCode: "RICE", objectTypeCode: "RICE_MILL" },
    { domainCode: "MARKET", productCode: "CORN", objectTypeCode: "BREEDING_FACTORY" },
    { domainCode: "MARKET", productCode: "CORN", objectTypeCode: "FEED_MILL" },
    ...products.map((productCode) => ({
      domainCode: "MARKET",
      productCode,
      objectTypeCode: "AGRICULTURAL_INPUT_STORE",
    })),
  ];
}
