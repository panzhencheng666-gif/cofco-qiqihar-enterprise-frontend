import { useEffect, useState } from "react";

import type {
  BusinessPageKey,
  ListPageDefinition,
  ListQueryState,
  LoadRegionChildren,
  PagedResult,
  PageDefinitionGateway,
} from "../../../../shared/application/page-definition";
import { createInitialListQuery } from "../../../../shared/application/page-definition";
import { ListWorkbench } from "../../../../shared/ui/list-workbench";

type SearchList = (query: ListQueryState) => Promise<PagedResult>;

export function MarketCollectionPage({
  loadRegionChildren,
  pageDefinitionGateway,
  pageKey,
  search,
}: {
  loadRegionChildren: LoadRegionChildren;
  pageDefinitionGateway: PageDefinitionGateway;
  pageKey: BusinessPageKey;
  search?: SearchList;
}) {
  const [definition, setDefinition] = useState<ListPageDefinition>();
  const [query, setQuery] = useState<ListQueryState>();
  const [result, setResult] = useState<PagedResult>();
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let active = true;
    void pageDefinitionGateway
      .getDefinition(pageKey)
      .then((loadedDefinition) => {
        if (!active) return;
        const initialQuery = createInitialListQuery(loadedDefinition);
        setDefinition(loadedDefinition);
        setQuery(initialQuery);
        setResult({
          items: [],
          pageNumber: initialQuery.pageNumber,
          pageSize: initialQuery.pageSize,
          totalElements: 0,
          totalPages: 0,
        });
      })
      .catch(() => {
        if (active) setErrorMessage("页面定义加载失败，请稍后重试。");
      });
    return () => {
      active = false;
    };
  }, [pageDefinitionGateway, pageKey]);

  async function runSearch() {
    if (search === undefined || query === undefined) return;
    try {
      setResult(await search(query));
    } catch {
      setErrorMessage("查询失败，请稍后重试。");
    }
  }

  if (errorMessage) return <div className="page-alert">{errorMessage}</div>;
  if (definition === undefined || query === undefined || result === undefined) {
    return <div className="ledger-panel list-workbench-loading">正在加载页面定义</div>;
  }

  return (
    <ListWorkbench
      definition={definition}
      loadRegionChildren={loadRegionChildren}
      onQueryChange={setQuery}
      onSearch={() => void runSearch()}
      query={query}
      result={result}
    />
  );
}
