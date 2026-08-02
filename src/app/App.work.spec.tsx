import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { App, type AppDependencies } from "./App";
import type { ListPageDefinition } from "../shared/application/page-definition";
import type { WorkItemCriteria } from "../modules/work-management/domain/workItem";

describe("App work management composition", () => {
  beforeEach(() =>
    window.history.replaceState(
      null,
      "",
      "#/work/pending?page=0&pageSize=20&status=TO_REVIEW",
    ),
  );

  it("restores pending/completed deep links and executes server queries through history", async () => {
    const user = userEvent.setup();
    const searches: WorkItemCriteria[] = [];
    const dependencies = fixture((criteria) => {
      searches.push(criteria);
      return Promise.resolve({
        items: [],
        pageNumber: criteria.pageNumber,
        pageSize: criteria.pageSize,
        totalElements: 0,
        totalPages: 0,
      });
    });

    render(<App dependencies={dependencies} />);

    expect(await screen.findByRole("heading", { name: "任务列表" })).toBeVisible();
    await waitFor(() => expect(searches).toHaveLength(1));
    expect(searches[0]).toMatchObject({ scope: "PENDING", status: "TO_REVIEW" });

    await user.click(screen.getByRole("button", { name: "已办事项" }));
    await waitFor(() => expect(searches).toHaveLength(2));
    expect(searches[1]).toMatchObject({ scope: "COMPLETED" });
    expect(searches[1]).not.toHaveProperty("status");
    expect(window.location.hash).toMatch(/^#\/work\/completed/);
    expect(screen.queryByRole("button", { name: "待审核" })).not.toBeInTheDocument();

    act(() => {
      window.history.replaceState(
        null,
        "",
        "#/work/pending?page=0&pageSize=20&status=RETURNED",
      );
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    await waitFor(() =>
      expect(searches.at(-1)).toMatchObject({ scope: "PENDING", status: "RETURNED" }),
    );
  });

  it("replaces an out-of-range work deep link with the normalized server page", async () => {
    window.history.replaceState(null, "", "#/work/pending?page=1&pageSize=20");
    const pages: number[] = [];
    render(
      <App
        dependencies={fixture((criteria) => {
          pages.push(criteria.pageNumber);
          return Promise.resolve({
            items: [],
            pageNumber: criteria.pageNumber,
            pageSize: criteria.pageSize,
            totalElements: 0,
            totalPages: 0,
          });
        })}
      />,
    );

    await waitFor(() => expect(pages).toEqual([1, 0]));
    expect(window.location.hash).toBe("#/work/pending?page=0&pageSize=20");
  });
});

function fixture(
  search: AppDependencies["workItemRepository"]["search"],
): AppDependencies {
  return {
    masterDataRepository: {
      getProducts: () => Promise.resolve([]),
      getCultivars: () => Promise.resolve([]),
      getMarketObjectTypes: () => Promise.resolve([]),
      getMonitoringPeriods: () => Promise.resolve([]),
      getRegionRoots: () => Promise.resolve([]),
      getRegionChildren: () => Promise.resolve([]),
      getRegionPath: () => Promise.resolve([]),
    },
    pageDefinitionGateway: {
      getDefinition: () => Promise.resolve(definition()),
    },
    marketCollectionRepository: {
      search: () => Promise.reject(new Error("not called")),
    },
    workItemRepository: { search },
  };
}

function definition(): ListPageDefinition {
  return {
    key: { domain: "WORKFLOW", pageKind: "WORK_ITEMS" },
    title: "任务列表",
    breadcrumbs: [{ id: "work", label: "我的工作" }],
    filters: [
      {
        id: "status",
        label: "状态",
        control: "select",
        placeholder: "全部",
        options: [
          { value: "TO_FILL", label: "待填报" },
          { value: "TO_REVIEW", label: "待审核" },
          { value: "RETURNED", label: "退回补充" },
          { value: "EXCEPTION", label: "异常处理" },
        ],
      },
    ],
    defaultContext: {},
    columnGroups: [
      {
        id: "work",
        label: "任务信息",
        fields: [{ id: "WORK_TASK_NAME", label: "任务", valueType: "TEXT" }],
      },
    ],
    actions: [],
    pagination: { defaultPageSize: 20, pageSizeOptions: [20] },
  };
}
