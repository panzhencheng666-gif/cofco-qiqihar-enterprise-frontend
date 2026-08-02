import {
  ListPageContextError,
  normalizeListRouteQuery,
  validateListPageDefinitionContext,
  type BusinessPageKey,
  type ListPageDefinition,
} from ".";

describe("list page contract", () => {
  it.each([
    [
      { domain: "MARKET", pageKind: "QUALITY", productCode: "CORN" },
      { domain: "MARKET", pageKind: "QUALITY", productCode: "RICE" },
    ],
    [
      { domain: "PRODUCTION", pageKind: "MONITORING", productCode: "CORN" },
      { domain: "MARKET", pageKind: "MONITORING", productCode: "CORN" },
    ],
    [
      { domain: "WORKFLOW", pageKind: "WORK_ITEMS" },
      { domain: "WORKFLOW", pageKind: "WORK_ITEMS", productCode: "CORN" },
    ],
  ] as const)(
    "rejects a definition identity mismatch, including optional product identity",
    (requested, actual) => {
      expect(() =>
        validateListPageDefinitionContext(requested, definition(actual)),
      ).toThrow(new ListPageContextError("页面上下文与页面定义不一致。"));
    },
  );

  it("accepts an exact definition identity", () => {
    const key = { domain: "WORKFLOW", pageKind: "WORK_ITEMS" };

    expect(validateListPageDefinitionContext(key, definition(key))).toEqual(
      definition(key),
    );
  });

  it("normalizes filters and rejects non-finite, fractional, negative, and unsupported paging", () => {
    const loaded = definition({
      domain: "MARKET",
      pageKind: "QUALITY",
      productCode: "CORN",
    });

    expect(
      normalizeListRouteQuery(loaded, {
        values: { status: "OPEN", injected: "discard" },
        pageNumber: Number.POSITIVE_INFINITY,
        pageSize: 50.5,
      }),
    ).toEqual({ values: { status: "OPEN" }, pageNumber: 0, pageSize: 20 });
    expect(
      normalizeListRouteQuery(loaded, {
        values: {},
        pageNumber: 3,
        pageSize: 50,
      }),
    ).toEqual({ values: { status: "DEFAULT" }, pageNumber: 3, pageSize: 50 });
  });
});

function definition(key: BusinessPageKey): ListPageDefinition {
  return {
    key,
    title: "测试页面",
    breadcrumbs: [],
    filters: [
      {
        id: "status",
        label: "状态",
        control: "text",
        placeholder: "",
        options: [],
      },
    ],
    defaultContext: { status: "DEFAULT" },
    columnGroups: [],
    actions: [],
    pagination: { defaultPageSize: 20, pageSizeOptions: [20, 50] },
  };
}
