import type {
  ListPageDefinition,
  ListQueryState,
  ColumnGroupDefinition,
  FieldDefinition,
  LoadRegionChildren,
  LoadRegionPath,
  PagedResult,
} from "../../application/page-definition";
import { RegionHierarchyFilter } from "./RegionHierarchyFilter";

const emptyRegionPath: LoadRegionPath = () => Promise.resolve([]);

export function ListWorkbench({
  definition,
  loadRegionChildren,
  loadRegionPath,
  loading = false,
  errorMessage,
  onAction,
  onQueryChange,
  onRetry,
  onSearch,
  query,
  result,
}: {
  definition: ListPageDefinition;
  loadRegionChildren?: LoadRegionChildren;
  loadRegionPath?: LoadRegionPath;
  loading?: boolean;
  errorMessage?: string;
  onAction?: (actionId: string, rowId?: string) => void;
  onQueryChange: (query: ListQueryState) => void;
  onRetry?: () => void;
  onSearch: () => void;
  query: ListQueryState;
  result: PagedResult;
}) {
  const columns = definition.columnGroups.flatMap<{
    field: FieldDefinition | undefined;
    group: ColumnGroupDefinition;
  }>((group) =>
    group.fields.length > 0
      ? group.fields.map((field) => ({ field, group }))
      : [{ field: undefined, group }],
  );
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
        {definition.filters.map((filter) =>
          filter.control === "region-hierarchy" && loadRegionChildren ? (
            <fieldset className="query-field query-field-region" key={filter.id}>
              <legend>{filter.label}</legend>
              <RegionHierarchyFilter
                label={filter.label}
                loadChildren={loadRegionChildren}
                loadPath={loadRegionPath ?? emptyRegionPath}
                onChange={(value) => changeValue(filter.id, value)}
                placeholder={filter.placeholder}
                value={query.values[filter.id] ?? ""}
              />
            </fieldset>
          ) : (
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
            </label>
          ),
        )}
        <div className="query-actions">
          <button
            className="button-primary"
            disabled={loading}
            onClick={onSearch}
            type="button"
          >
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
        {errorMessage && (
          <div className="page-alert list-query-error" role="alert">
            <span>{errorMessage}</span>
            {onRetry && (
              <button onClick={onRetry} type="button">
                重试列表查询
              </button>
            )}
          </div>
        )}
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
                {rowActions.length > 0 && <th>操作</th>}
              </tr>
              <tr>
                {columns.map(({ field, group }) =>
                  field ? (
                    <th aria-label={field.label} key={`${group.id}:${field.id}`}>
                      {field.label}
                      {field.unit && <small>{field.unit}</small>}
                      {field.description && <small>{field.description}</small>}
                    </th>
                  ) : (
                    <th aria-label={`${group.label} 无字段`} key={`${group.id}:empty`}>
                      —
                    </th>
                  ),
                )}
                {rowActions.length > 0 && <th aria-label="可用操作">可用操作</th>}
              </tr>
            </thead>
            <tbody>
              {!loading &&
                result.items.map((row) => (
                  <tr key={row.id}>
                    {columns.map(({ field, group }) =>
                      field ? (
                        <td key={`${group.id}:${field.id}`}>
                          {row.values[field.id] ?? "—"}
                        </td>
                      ) : (
                        <td
                          aria-label={`${group.label} 无字段`}
                          key={`${group.id}:empty`}
                        >
                          —
                        </td>
                      ),
                    )}
                    {rowActions.length > 0 && (
                      <td className="row-actions">
                        {rowActions
                          .filter(
                            (action) =>
                              row.allowedActions === undefined ||
                              row.allowedActions.includes(action.id),
                          )
                          .map((action) => (
                            <button
                              className="link-button"
                              key={action.id}
                              onClick={() => onAction?.(action.id, row.id)}
                              type="button"
                            >
                              {action.label}
                            </button>
                          ))}
                      </td>
                    )}
                  </tr>
                ))}
              {loading && (
                <tr>
                  <td
                    className="empty-ledger"
                    colSpan={Math.max(
                      1,
                      columns.length + (rowActions.length > 0 ? 1 : 0),
                    )}
                  >
                    正在加载列表
                  </td>
                </tr>
              )}
              {!loading && result.items.length === 0 && (
                <tr>
                  <td
                    className="empty-ledger"
                    colSpan={Math.max(
                      1,
                      columns.length + (rowActions.length > 0 ? 1 : 0),
                    )}
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
              aria-label="上一页"
              disabled={result.pageNumber === 0}
              onClick={() => changePage(result.pageNumber - 1)}
              type="button"
            >
              ‹
            </button>
            <span aria-current="page" className="is-current">
              {result.pageNumber + 1}
            </span>
            <button
              aria-label="下一页"
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
