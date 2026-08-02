import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  createInitialListQuery,
  type ListPageDefinition,
  type ListQueryState,
  type PagedResult,
} from "../../application/page-definition";
import { ListWorkbench } from "./ListWorkbench";

const products = [
  { code: "CORN", name: "玉米", field: "玉米测试字段" },
  { code: "SOYBEAN", name: "大豆", field: "大豆测试字段" },
  { code: "RICE", name: "稻谷", field: "稻谷测试字段" },
] as const;

describe("ListWorkbench", () => {
  it.each(products)(
    "renders one product-independent workbench for $name definition",
    ({ code, name, field }) => {
      const definition = definitionFixture(code, name, field);

      render(
        <ListWorkbench
          definition={definition}
          onQueryChange={() => undefined}
          onSearch={() => undefined}
          query={createInitialListQuery(definition)}
          result={resultFixture(field)}
        />,
      );

      expect(screen.getByText("市场监测")).toBeVisible();
      expect(screen.getByRole("heading", { name: `${name}业务清单` })).toBeVisible();
      expect(
        screen.getByRole("search", { name: `${name}业务清单筛选条件` }),
      ).toBeVisible();
      const table = screen.getByRole("table", { name: `${name}业务清单` });
      expect(
        within(table).getByRole("columnheader", { name: "业务指标" }),
      ).toBeVisible();
      expect(within(table).getByRole("columnheader", { name: field })).toBeVisible();
      expect(within(table).getByText(`${field}值`)).toBeVisible();
      expect(
        screen.getByRole("navigation", { name: `${name}业务清单分页` }),
      ).toBeVisible();
    },
  );

  it("takes default dates, status options and business fields only from the definition", () => {
    const definition = definitionFixture("TEST_PRODUCT", "测试产品", "后端响应字段");
    const query = createInitialListQuery(definition);

    render(
      <ListWorkbench
        definition={definition}
        onQueryChange={() => undefined}
        onSearch={() => undefined}
        query={query}
        result={resultFixture("后端响应字段")}
      />,
    );

    expect(screen.getByLabelText("业务日期")).toHaveValue("2031-02-03");
    const status = screen.getByRole("combobox", { name: "业务状态" });
    expect(within(status).getByRole("option", { name: "等待业务确认" })).toBeVisible();
    expect(screen.getByRole("columnheader", { name: "后端响应字段" })).toBeVisible();
  });

  it("loads regions one parent at a time and never needs a flattened region list", async () => {
    const user = userEvent.setup();
    const requests: Array<string | undefined> = [];
    const loadRegionChildren = (parentId?: string) => {
      requests.push(parentId);
      if (parentId === undefined) {
        return Promise.resolve([{ id: "city", label: "测试市", level: "PREFECTURE" }]);
      }
      if (parentId === "city") {
        return Promise.resolve([{ id: "county", label: "测试县", level: "COUNTY" }]);
      }
      return Promise.resolve([]);
    };
    const definition = definitionFixture("TEST_PRODUCT", "测试产品", "测试字段");

    render(
      <ListWorkbench
        definition={definition}
        loadRegionChildren={loadRegionChildren}
        onQueryChange={() => undefined}
        onSearch={() => undefined}
        query={createInitialListQuery(definition)}
        result={resultFixture("测试字段")}
      />,
    );

    const root = await screen.findByRole("combobox", { name: "业务地区 第1级" });
    expect(requests).toEqual([undefined]);

    await user.selectOptions(root, "city");

    await waitFor(() => expect(requests).toEqual([undefined, "city"]));
    expect(
      await screen.findByRole("combobox", { name: "业务地区 第2级" }),
    ).toHaveTextContent("测试县");
  });

  it("uses the definition pagination options to change page size", async () => {
    const user = userEvent.setup();
    const changes: ListQueryState[] = [];
    const definition = definitionFixture("TEST_PRODUCT", "测试产品", "测试字段");

    render(
      <ListWorkbench
        definition={definition}
        onQueryChange={(query) => changes.push(query)}
        onSearch={() => undefined}
        query={{ ...createInitialListQuery(definition), pageNumber: 3 }}
        result={{ ...resultFixture("测试字段"), pageNumber: 3, totalPages: 5 }}
      />,
    );

    await user.selectOptions(screen.getByRole("combobox", { name: "每页条数" }), "50");

    expect(changes).toContainEqual({
      values: definition.defaultContext,
      pageNumber: 0,
      pageSize: 50,
    });
  });

  it("keeps empty groups aligned and exposes accessible pagination state", () => {
    const definition = definitionFixture("TEST_PRODUCT", "测试产品", "测试字段");
    const withEmptyGroup: ListPageDefinition = {
      ...definition,
      columnGroups: [
        ...definition.columnGroups,
        { id: "empty", label: "暂无适用字段", fields: [] },
      ],
    };

    render(
      <ListWorkbench
        definition={withEmptyGroup}
        onQueryChange={() => undefined}
        onSearch={() => undefined}
        query={createInitialListQuery(withEmptyGroup)}
        result={resultFixture("测试字段")}
      />,
    );

    expect(screen.getByRole("columnheader", { name: "暂无适用字段" })).toHaveAttribute(
      "colspan",
      "1",
    );
    expect(
      screen.getByRole("columnheader", { name: "暂无适用字段 无字段" }),
    ).toBeVisible();
    expect(screen.getByRole("cell", { name: "暂无适用字段 无字段" })).toBeVisible();
    expect(screen.getByText("1", { selector: "[aria-current='page']" })).toBeVisible();
    expect(screen.getByRole("button", { name: "上一页" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "下一页" })).toBeDisabled();
  });

  it("keeps the workbench mounted while a query fails and offers retry", async () => {
    const user = userEvent.setup();
    let retries = 0;
    const definition = definitionFixture("TEST_PRODUCT", "测试产品", "测试字段");

    render(
      <ListWorkbench
        definition={definition}
        errorMessage="列表查询失败，请稍后重试。"
        onQueryChange={() => undefined}
        onRetry={() => {
          retries += 1;
        }}
        onSearch={() => undefined}
        query={createInitialListQuery(definition)}
        result={resultFixture("测试字段")}
      />,
    );

    expect(screen.getByRole("table", { name: definition.title })).toBeVisible();
    expect(screen.getByRole("alert")).toHaveTextContent("列表查询失败，请稍后重试。");
    await user.click(screen.getByRole("button", { name: "重试列表查询" }));
    expect(retries).toBe(1);
  });
});

function definitionFixture(
  productCode: string,
  productName: string,
  fieldLabel: string,
): ListPageDefinition {
  return {
    key: { domain: "MARKET", pageKind: "COLLECTION", productCode },
    title: `${productName}业务清单`,
    breadcrumbs: [
      { id: "market", label: "市场监测" },
      { id: "collection", label: `${productName}业务清单` },
    ],
    filters: [
      {
        id: "businessDate",
        label: "业务日期",
        control: "date",
        placeholder: "选择日期",
        options: [],
      },
      {
        id: "status",
        label: "业务状态",
        control: "select",
        placeholder: "全部状态",
        options: [{ value: "WAITING", label: "等待业务确认" }],
      },
      {
        id: "regionId",
        label: "业务地区",
        control: "region-hierarchy",
        placeholder: "请选择地区",
        options: [],
      },
    ],
    defaultContext: { businessDate: "2031-02-03", status: "WAITING" },
    columnGroups: [
      {
        id: "business",
        label: "业务指标",
        fields: [
          {
            id: "dynamicField",
            label: fieldLabel,
            valueType: "TEXT",
          },
        ],
      },
    ],
    actions: [{ id: "view", label: "查看", scope: "row" }],
    pagination: { defaultPageSize: 20, pageSizeOptions: [20, 50] },
  };
}

function resultFixture(fieldLabel: string): PagedResult {
  return {
    items: [{ id: "record-1", values: { dynamicField: `${fieldLabel}值` } }],
    pageNumber: 0,
    pageSize: 20,
    totalElements: 1,
    totalPages: 1,
  };
}
