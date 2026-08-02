import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrictMode } from "react";
import { vi } from "vitest";

import type {
  ListPageDefinition,
  ListQueryState,
} from "../../../../shared/application/page-definition";
import { MarketCollectionPage } from "./MarketCollectionPage";

describe("MarketCollectionPage", () => {
  it("loads its initial context and fields from the requested page definition", async () => {
    const definition: ListPageDefinition = {
      key: { domain: "MARKET", pageKind: "COLLECTION", productCode: "FIXTURE" },
      title: "测试产品采集表",
      breadcrumbs: [{ id: "market", label: "市场监测" }],
      filters: [
        {
          id: "businessDate",
          label: "采集日期",
          control: "date",
          placeholder: "选择日期",
          options: [],
        },
      ],
      defaultContext: { businessDate: "2032-04-05" },
      columnGroups: [
        {
          id: "fixture-group",
          label: "测试字段组",
          fields: [{ id: "fixture-field", label: "测试业务字段", valueType: "TEXT" }],
        },
      ],
      actions: [],
      pagination: { defaultPageSize: 20, pageSizeOptions: [20] },
    };

    render(
      <MarketCollectionPage
        loadRegionChildren={() => Promise.resolve([])}
        pageDefinitionGateway={{ getDefinition: () => Promise.resolve(definition) }}
        pageKey={definition.key}
        search={() =>
          Promise.resolve({
            items: [],
            pageNumber: 0,
            pageSize: 20,
            totalElements: 0,
            totalPages: 0,
          })
        }
      />,
    );

    const table = await screen.findByRole("table", { name: "测试产品采集表" });
    expect(screen.getByLabelText("采集日期")).toHaveValue("2032-04-05");
    expect(
      within(table).getByRole("columnheader", { name: "测试业务字段" }),
    ).toBeVisible();
  });

  it("runs a paging command once under StrictMode", async () => {
    const user = userEvent.setup();
    const pageDefinition = definition();
    const search = vi.fn((query: ListQueryState) =>
      Promise.resolve({
        items: [],
        pageNumber: query.pageNumber,
        pageSize: query.pageSize,
        totalElements: 21,
        totalPages: 2,
      }),
    );
    const committed = vi.fn();
    render(
      <StrictMode>
        <MarketCollectionPage
          loadRegionChildren={() => Promise.resolve([])}
          onQueryCommitted={committed}
          pageDefinitionGateway={{
            getDefinition: () => Promise.resolve(pageDefinition),
          }}
          pageKey={pageDefinition.key}
          search={search}
        />
      </StrictMode>,
    );

    await waitFor(() => expect(search).toHaveBeenCalledTimes(1));
    await user.click(screen.getByRole("button", { name: "下一页" }));
    await waitFor(() => expect(search).toHaveBeenCalledTimes(2));
    expect(committed).toHaveBeenCalledTimes(1);
  });
});

function definition(): ListPageDefinition {
  return {
    key: { domain: "MARKET", pageKind: "COLLECTION", productCode: "FIXTURE" },
    title: "测试产品采集表",
    breadcrumbs: [],
    filters: [],
    defaultContext: {},
    columnGroups: [],
    actions: [],
    pagination: { defaultPageSize: 20, pageSizeOptions: [20] },
  };
}
