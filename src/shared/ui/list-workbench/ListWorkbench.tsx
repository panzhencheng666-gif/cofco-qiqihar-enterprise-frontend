import type {
  ListPageDefinition,
  ListQueryState,
  LoadRegionChildren,
  PagedResult,
} from "../../application/page-definition";
import { RegionHierarchyFilter } from "./RegionHierarchyFilter";

export function ListWorkbench({
  definition,
  loadRegionChildren,
  onAction,
  onQueryChange,
  onSearch,
  query,
  result,
}: {
  definition: ListPageDefinition;
  loadRegionChildren?: LoadRegionChildren;
  onAction?: (actionId: string, rowId?: string) => void;
  onQueryChange: (query: ListQueryState) => void;
  onSearch: () => void;
  query: ListQueryState;
  result: PagedResult;
}) {
  const fields = definition.columnGroups.flatMap((group) => group.fields);
  const pageActions = definition.actions.filter((action) => action.scope === "page");
  const rowActions = definition.actions.filter((action) => action.scope === "row");

  function changeValue(filterId: string, value: string) {
    onQueryChange({
      ...query,
      pageNumber: 0,
      values: { ...query.values, [filterId]: value },
    });
  }

  function changePage(pageNumber: number) {
    if (pageNumber < 0 || pageNumber >= result.totalPages) return;
    onQueryChange({ ...query, pageNumber });
  }

  return (
    <div className="list-workbench">
      <nav aria-label="面包屑" className="page-breadcrumb">
        {definition.breadcrumbs.map((item, index) => (
          <span key={item.id}>
            {index > 0 ? " / " : ""}
            {item.label}
          </span>
        ))}
      </nav>

      <section
        aria-label={`${definition.title}筛选条件`}
        className="enterprise-query-bar"
        role="search"
      >
        {definition.filters.map((filter) => (
          <label className="query-field" key={filter.id}>
            <span>{filter.label}</span>
            {filter.control === "select" && (
              <select
                aria-label={filter.label}
                onChange={(event) => changeValue(filter.id, event.target.value)}
                value={query.values[filter.id] ?? ""}
              >
                <option value="">{filter.placeholder}</option>
                {filter.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            )}
            {(filter.control === "date" || filter.control === "text") && (
              <input
                aria-label={filter.label}
                onChange={(event) => changeValue(filter.id, event.target.value)}
                placeholder={filter.placeholder}
                type={filter.control}
                value={query.values[filter.id] ?? ""}
              />
            )}
            {filter.control === "region-hierarchy" && loadRegionChildren && (
              <RegionHierarchyFilter
                label={filter.label}
                loadChildren={loadRegionChildren}
                onChange={(value) => changeValue(filter.id, value)}
                placeholder={filter.placeholder}
              />
            )}
          </label>
        ))}
        <div className="query-actions">
          <button className="button-primary" onClick={onSearch} type="button">
            查询
          </button>
          {pageActions.map((action) => (
            <button key={action.id} onClick={() => onAction?.(action.id)} type="button">
              {action.label}
            </button>
          ))}
        </div>
      </section>

      <header className="ledger-title">
        <h1>{definition.title}</h1>
      </header>

      <section aria-label={`${definition.title}区域`} className="ledger-panel">
        <div className="ledger-toolbar">
          <strong>共 {result.totalElements} 条记录</strong>
        </div>
        <div className="ledger-scroll" tabIndex={0}>
          <table aria-label={definition.title}>
            <thead>
              <tr>
                {definition.columnGroups.map((group) => (
                  <th colSpan={Math.max(1, group.fields.length)} key={group.id}>
                    {group.label}
                  </th>
                ))}
                {rowActions.length > 0 && <th colSpan={rowActions.length}>操作</th>}
              </tr>
              <tr>
                {fields.map((field) => (
                  <th aria-label={field.label} key={field.id}>
                    {field.label}
                    {field.unit && <small>{field.unit}</small>}
                    {field.description && <small>{field.description}</small>}
                  </th>
                ))}
                {rowActions.map((action) => (
                  <th key={action.id}>{action.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.items.map((row) => (
                <tr key={row.id}>
                  {fields.map((field) => (
                    <td key={field.id}>{row.values[field.id] ?? "—"}</td>
                  ))}
                  {rowActions.map((action) => (
                    <td key={action.id}>
                      <button
                        className="link-button"
                        onClick={() => onAction?.(action.id, row.id)}
                        type="button"
                      >
                        {action.label}
                      </button>
                    </td>
                  ))}
                </tr>
              ))}
              {result.items.length === 0 && (
                <tr>
                  <td
                    className="empty-ledger"
                    colSpan={Math.max(1, fields.length + rowActions.length)}
                  >
                    暂无记录
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="ledger-footer">
          <div className="list-workbench-pagination-summary">
            <span>
              第 {result.pageNumber + 1} / {Math.max(1, result.totalPages)} 页
            </span>
            <label>
              每页
              <select
                aria-label="每页条数"
                onChange={(event) =>
                  onQueryChange({
                    ...query,
                    pageNumber: 0,
                    pageSize: Number(event.target.value),
                  })
                }
                value={query.pageSize}
              >
                {definition.pagination.pageSizeOptions.map((pageSize) => (
                  <option key={pageSize} value={pageSize}>
                    {pageSize}
                  </option>
                ))}
              </select>
              条
            </label>
          </div>
          <nav aria-label={`${definition.title}分页`}>
            <button
              disabled={result.pageNumber === 0}
              onClick={() => changePage(result.pageNumber - 1)}
              type="button"
            >
              ‹
            </button>
            <button className="is-current" type="button">
              {result.pageNumber + 1}
            </button>
            <button
              disabled={result.pageNumber + 1 >= result.totalPages}
              onClick={() => changePage(result.pageNumber + 1)}
              type="button"
            >
              ›
            </button>
          </nav>
        </div>
      </section>
    </div>
  );
}
