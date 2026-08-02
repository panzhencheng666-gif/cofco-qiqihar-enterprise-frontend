import { useEffect, useState } from "react";

import { EnterpriseShell } from "./shell/EnterpriseShell";
import type { MarketCollectionRepository } from "../modules/market-monitoring/application/ports/MarketCollectionRepository";
import { HttpMarketCollectionRepository } from "../modules/market-monitoring/infrastructure/http/HttpMarketCollectionRepository";
import type { MasterDataRepository } from "../modules/master-data/application/ports/MasterDataRepository";
import { HttpMasterDataRepository } from "../modules/master-data/infrastructure/http/HttpMasterDataRepository";
import { MarketCollectionPage } from "../modules/market-monitoring/ui/pages/MarketCollectionPage";
import type {
  BusinessPageKey,
  ListQueryState,
  PageDefinitionGateway,
} from "../shared/application/page-definition";
import { FetchHttpClient } from "../shared/api/HttpClient";
import { HttpPageDefinitionGateway } from "../shared/infrastructure/page-definition/HttpPageDefinitionGateway";

const httpClient = new FetchHttpClient();
const masterDataRepository = new HttpMasterDataRepository(httpClient);
const pageDefinitionGateway = new HttpPageDefinitionGateway(httpClient);
const marketCollectionRepository = new HttpMarketCollectionRepository(httpClient);

export interface AppDependencies {
  masterDataRepository: MasterDataRepository;
  pageDefinitionGateway: PageDefinitionGateway;
  marketCollectionRepository: MarketCollectionRepository;
}

const productionDependencies: AppDependencies = {
  masterDataRepository,
  pageDefinitionGateway,
  marketCollectionRepository,
};

interface AppLocation {
  key: BusinessPageKey;
  query: { pageNumber?: number; pageSize?: number; values: Record<string, string> };
}

const domain = "MARKET";
const pageKind = "QUALITY";

function locationFromHash(): AppLocation | undefined {
  const match = /^#\/pages\/([^/]+)\/([^/]+)\/([^?]+)(?:\?(.*))?$/.exec(
    window.location.hash,
  );
  if (!match) return undefined;
  const parameters = new URLSearchParams(match[4] ?? "");
  const values: Record<string, string> = {};
  for (const [name, value] of parameters) {
    if (name.startsWith("filter.")) values[name.slice(7)] = value;
  }
  const parsedPageNumber = Number(parameters.get("pageNumber"));
  const parsedPageSize = Number(parameters.get("pageSize"));
  return {
    key: {
      domain: decodeURIComponent(match[1]!),
      pageKind: decodeURIComponent(match[2]!),
      productCode: decodeURIComponent(match[3]!),
    },
    query: {
      ...(Number.isInteger(parsedPageNumber) && parsedPageNumber >= 0
        ? { pageNumber: parsedPageNumber }
        : {}),
      ...(Number.isInteger(parsedPageSize) && parsedPageSize > 0
        ? { pageSize: parsedPageSize }
        : {}),
      values,
    },
  };
}

function hashFor(key: BusinessPageKey, query?: ListQueryState) {
  const parameters = new URLSearchParams();
  if (query) {
    parameters.set("pageNumber", String(query.pageNumber));
    parameters.set("pageSize", String(query.pageSize));
    for (const [id, value] of Object.entries(query.values)) {
      if (value) parameters.set(`filter.${id}`, value);
    }
  }
  const suffix = parameters.size > 0 ? `?${parameters.toString()}` : "";
  return `#/pages/${encodeURIComponent(key.domain)}/${encodeURIComponent(key.pageKind)}/${encodeURIComponent(key.productCode)}${suffix}`;
}

export function App({
  dependencies = productionDependencies,
}: {
  dependencies?: AppDependencies;
}) {
  const [products, setProducts] = useState<readonly { id: string; name: string }[]>([]);
  const [location, setLocation] = useState<AppLocation | undefined>(() =>
    locationFromHash(),
  );
  const [navigationError, setNavigationError] = useState(false);

  useEffect(() => {
    let active = true;
    void dependencies.masterDataRepository
      .getProducts(domain, pageKind)
      .then((loadedProducts) => {
        if (!active) return;
        setProducts(loadedProducts);
        setNavigationError(false);
        setLocation((current) => {
          if (
            current &&
            loadedProducts.some((product) => product.id === current.key.productCode)
          ) {
            return current;
          }
          const first = loadedProducts[0];
          if (!first) return undefined;
          const next = {
            key: { domain, pageKind, productCode: first.id },
            query: { values: {} },
          };
          window.history.replaceState(null, "", hashFor(next.key));
          return next;
        });
      })
      .catch(() => active && setNavigationError(true));
    return () => {
      active = false;
    };
  }, [dependencies.masterDataRepository]);

  useEffect(() => {
    const synchronize = () => setLocation(locationFromHash());
    window.addEventListener("popstate", synchronize);
    window.addEventListener("hashchange", synchronize);
    return () => {
      window.removeEventListener("popstate", synchronize);
      window.removeEventListener("hashchange", synchronize);
    };
  }, []);

  const pageKey = location?.key;

  function selectProduct(productCode: string) {
    const next = { key: { domain, pageKind, productCode }, query: { values: {} } };
    window.history.pushState(null, "", hashFor(next.key));
    setLocation(next);
  }

  function commitQuery(query: ListQueryState) {
    if (!pageKey) return;
    window.history.pushState(null, "", hashFor(pageKey, query));
  }

  return (
    <EnterpriseShell
      onProductSelect={selectProduct}
      products={products}
      {...(pageKey ? { activeProductId: pageKey.productCode } : {})}
    >
      {navigationError ? (
        <div className="page-alert" role="alert">
          产品导航加载失败，请稍后重试。
        </div>
      ) : pageKey === undefined ? (
        <div className="ledger-panel list-workbench-loading">正在加载业务导航</div>
      ) : (
        <MarketCollectionPage
          loadRegionChildren={(parentId) =>
            dependencies.masterDataRepository.getRegionChildren(parentId)
          }
          loadRegionPath={(regionId) =>
            dependencies.masterDataRepository.getRegionPath(regionId)
          }
          marketCollectionRepository={dependencies.marketCollectionRepository}
          onQueryCommitted={commitQuery}
          pageDefinitionGateway={dependencies.pageDefinitionGateway}
          pageKey={pageKey}
          {...(location ? { routeQuery: location.query } : {})}
        />
      )}
    </EnterpriseShell>
  );
}
