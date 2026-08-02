import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { ListPageDefinition } from "../../../../shared/application/page-definition";
import { WorkItemsPage } from "./WorkItemsPage";
import type { WorkItemCriteria } from "../../domain/workItem";

describe("WorkItemsPage", () => {
  it("renders one backend-driven pending status select and queries its selected value", async () => {
    const user = userEvent.setup();
    const searches: WorkItemCriteria[] = [];
    render(
      <WorkItemsPage
        loadRegionChildren={() => Promise.resolve([])}
        loadProducts={() => Promise.resolve([{ value: "CORN", label: "玉米" }])}
        pageDefinitionGateway={{ getDefinition: () => Promise.resolve(definition()) }}
        repository={{
          search: (criteria) => {
            searches.push(criteria);
            return Promise.resolve(emptyPage(criteria.pageNumber, criteria.pageSize));
          },
        }}
        scope="PENDING"
      />,
    );

    const status = await screen.findByRole("combobox", { name: "状态" });
    expect(screen.getAllByRole("combobox", { name: "状态" })).toHaveLength(1);
    expect(within(status).getByRole("option", { name: "全部" })).toBeVisible();
    expect(within(status).getByRole("option", { name: "待填报" })).toBeVisible();
    expect(within(status).getByRole("option", { name: "待审核" })).toBeVisible();
    expect(within(status).getByRole("option", { name: "退回补充" })).toBeVisible();
    expect(within(status).getByRole("option", { name: "异常处理" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "待审核" })).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "产品" })).toHaveTextContent("玉米");
    await waitFor(() => expect(searches).toHaveLength(1));

    await user.selectOptions(status, "TO_REVIEW");
    expect(searches).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "查询" }));
    await waitFor(() => expect(searches).toHaveLength(2));
    expect(searches[1]).toMatchObject({ scope: "PENDING", status: "TO_REVIEW" });
  });

  it("does not expose pending statuses as completed navigation or filters", async () => {
    render(
      <WorkItemsPage
        loadRegionChildren={() => Promise.resolve([])}
        pageDefinitionGateway={{ getDefinition: () => Promise.resolve(definition()) }}
        repository={{
          search: (criteria) =>
            Promise.resolve(emptyPage(criteria.pageNumber, criteria.pageSize)),
        }}
        scope="COMPLETED"
      />,
    );

    expect(await screen.findByRole("heading", { name: "任务列表" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "待填报" })).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "状态" })).not.toBeInTheDocument();
  });

  it("keeps the shared workbench mounted across error retry and server paging", async () => {
    const user = userEvent.setup();
    let attempts = 0;
    render(
      <WorkItemsPage
        loadRegionChildren={() => Promise.resolve([])}
        pageDefinitionGateway={{ getDefinition: () => Promise.resolve(definition()) }}
        repository={{
          search: (criteria) => {
            attempts += 1;
            if (attempts === 1) return Promise.reject(new Error("offline"));
            return Promise.resolve({
              items: [],
              pageNumber: criteria.pageNumber,
              pageSize: criteria.pageSize,
              totalElements: 21,
              totalPages: 2,
            });
          },
        }}
        scope="PENDING"
      />,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent("任务列表查询失败");
    expect(screen.getByRole("table", { name: "任务列表" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "重试列表查询" }));
    await waitFor(() => expect(attempts).toBe(2));
    await user.click(screen.getByRole("button", { name: "下一页" }));
    await waitFor(() => expect(attempts).toBe(3));
  });

  it("normalizes an empty deep-linked page to zero and refetches once", async () => {
    const pages: number[] = [];
    const normalized: number[] = [];
    render(
      <WorkItemsPage
        loadRegionChildren={() => Promise.resolve([])}
        onQueryNormalized={(query) => normalized.push(query.pageNumber)}
        pageDefinitionGateway={{ getDefinition: () => Promise.resolve(definition()) }}
        repository={{
          search: (criteria) => {
            pages.push(criteria.pageNumber);
            return Promise.resolve(emptyPage(criteria.pageNumber, criteria.pageSize));
          },
        }}
        routeQuery={{ pageNumber: 1, pageSize: 20, values: {} }}
        scope="PENDING"
      />,
    );

    await waitFor(() => expect(pages).toEqual([1, 0]));
    expect(normalized.at(-1)).toBe(0);
  });

  it("clamps a page after the result set shrinks and refetches the last valid page", async () => {
    const pages: number[] = [];
    render(
      <WorkItemsPage
        loadRegionChildren={() => Promise.resolve([])}
        pageDefinitionGateway={{ getDefinition: () => Promise.resolve(definition()) }}
        repository={{
          search: (criteria) => {
            pages.push(criteria.pageNumber);
            return Promise.resolve({
              items: [],
              pageNumber: criteria.pageNumber,
              pageSize: criteria.pageSize,
              totalElements: 21,
              totalPages: 2,
            });
          },
        }}
        routeQuery={{ pageNumber: 2, pageSize: 20, values: {} }}
        scope="PENDING"
      />,
    );

    await waitFor(() => expect(pages).toEqual([2, 1]));
  });

  it("does not refetch a page that remains within the server range", async () => {
    const pages: number[] = [];
    render(
      <WorkItemsPage
        loadRegionChildren={() => Promise.resolve([])}
        pageDefinitionGateway={{ getDefinition: () => Promise.resolve(definition()) }}
        repository={{
          search: (criteria) => {
            pages.push(criteria.pageNumber);
            return Promise.resolve({
              items: [],
              pageNumber: criteria.pageNumber,
              pageSize: criteria.pageSize,
              totalElements: 41,
              totalPages: 3,
            });
          },
        }}
        routeQuery={{ pageNumber: 1, pageSize: 20, values: {} }}
        scope="PENDING"
      />,
    );

    await waitFor(() => expect(pages).toEqual([1]));
  });

  it("waits for query submission when a filter also resets an outlying page", async () => {
    const user = userEvent.setup();
    const searches: WorkItemCriteria[] = [];
    render(
      <WorkItemsPage
        loadRegionChildren={() => Promise.resolve([])}
        pageDefinitionGateway={{ getDefinition: () => Promise.resolve(definition()) }}
        repository={{
          search: (criteria) => {
            searches.push(criteria);
            return Promise.resolve({
              items: [],
              pageNumber: criteria.pageNumber,
              pageSize: criteria.pageSize,
              totalElements: 41,
              totalPages: 3,
            });
          },
        }}
        routeQuery={{ pageNumber: 2, pageSize: 20, values: {} }}
        scope="PENDING"
      />,
    );

    const status = await screen.findByRole("combobox", { name: "状态" });
    await waitFor(() => expect(searches).toHaveLength(1));
    await user.selectOptions(status, "TO_REVIEW");
    expect(searches).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "查询" }));
    await waitFor(() => expect(searches).toHaveLength(2));
    expect(searches[1]).toMatchObject({ pageNumber: 0, status: "TO_REVIEW" });
  });

  it("does not normalize or refetch from a stale out-of-range response", async () => {
    const pages: number[] = [];
    const normalized: number[] = [];
    let resolveFirst: ((result: ReturnType<typeof emptyPage>) => void) | undefined;
    const pageDefinitionGateway = {
      getDefinition: () => Promise.resolve(definition()),
    };
    const repository = {
      search: (criteria: WorkItemCriteria) => {
        pages.push(criteria.pageNumber);
        if (pages.length === 1) {
          return new Promise<ReturnType<typeof emptyPage>>((resolve) => {
            resolveFirst = resolve;
          });
        }
        return Promise.resolve({
          items: [],
          pageNumber: criteria.pageNumber,
          pageSize: criteria.pageSize,
          totalElements: 41,
          totalPages: 3,
        });
      },
    };
    const loadRegionChildren = () => Promise.resolve([]);
    const { rerender } = render(
      <WorkItemsPage
        loadRegionChildren={loadRegionChildren}
        onQueryNormalized={(query) => normalized.push(query.pageNumber)}
        pageDefinitionGateway={pageDefinitionGateway}
        repository={repository}
        routeQuery={{ pageNumber: 2, pageSize: 20, values: {} }}
        scope="PENDING"
      />,
    );

    await waitFor(() => expect(pages).toEqual([2]));
    rerender(
      <WorkItemsPage
        loadRegionChildren={loadRegionChildren}
        onQueryNormalized={(query) => normalized.push(query.pageNumber)}
        pageDefinitionGateway={pageDefinitionGateway}
        repository={repository}
        routeQuery={{ pageNumber: 1, pageSize: 20, values: {} }}
        scope="PENDING"
      />,
    );
    await waitFor(() => expect(pages).toEqual([2, 1]));
    resolveFirst?.(emptyPage(2, 20));
    await waitFor(() => expect(screen.getByText("第 2 / 3 页")).toBeVisible());
    expect(pages).toEqual([2, 1]);
    expect(normalized).toEqual([2, 1]);
  });
});

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
      {
        id: "productCode",
        label: "产品",
        control: "select",
        placeholder: "全部产品",
        options: [],
      },
    ],
    defaultContext: {},
    columnGroups: [
      {
        id: "task",
        label: "任务信息",
        fields: [{ id: "WORK_TASK_NAME", label: "任务", valueType: "TEXT" }],
      },
    ],
    actions: [],
    pagination: { defaultPageSize: 20, pageSizeOptions: [20, 50] },
  };
}

function emptyPage(pageNumber: number, pageSize: number) {
  return { items: [], pageNumber, pageSize, totalElements: 0, totalPages: 0 };
}
