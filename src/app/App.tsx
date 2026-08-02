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

interface HashState {
  location?: AppLocation;
  invalid: boolean;
}

const domain = "MARKET";
const pageKind = "QUALITY";

function locationFromHash(): HashState {
  const match = /^#\/pages\/([^/]+)\/([^/]+)\/([^?]+)(?:\?(.*))?$/.exec(
    window.location.hash,
  );
  if (!match) return { invalid: window.location.hash.length > 0 };
  try {
    decodeURIComponent(match[4] ?? "");
    const parameters = new URLSearchParams(match[4] ?? "");
    const values: Record<string, string> = {};
    for (const [name, value] of parameters) {
      if (name.startsWith("filter.")) values[name.slice(7)] = value;
    }
    const pageNumberValue = parameters.get("pageNumber");
    const pageSizeValue = parameters.get("pageSize");
    const parsedPageNumber = Number(pageNumberValue);
    const parsedPageSize = Number(pageSizeValue);
    return {
      invalid: false,
      location: {
        key: {
          domain: decodeURIComponent(match[1]!),
          pageKind: decodeURIComponent(match[2]!),
          productCode: decodeURIComponent(match[3]!),
        },
        query: {
          ...(pageNumberValue !== null &&
          Number.isInteger(parsedPageNumber) &&
          parsedPageNumber >= 0
            ? { pageNumber: parsedPageNumber }
            : {}),
          ...(pageSizeValue !== null &&
          Number.isInteger(parsedPageSize) &&
          parsedPageSize > 0
            ? { pageSize: parsedPageSize }
            : {}),
          values,
        },
      },
    };
  } catch {
    return { invalid: true };
  }
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
  const [hashState, setHashState] = useState<HashState>(() => locationFromHash());
  const [navigationError, setNavigationError] = useState(false);
  const [navigationAttempt, setNavigationAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    void dependencies.masterDataRepository
      .getProducts(domain, pageKind)
      .then((loadedProducts) => {
        if (!active) return;
        setProducts(loadedProducts);
        setNavigationError(false);
        setHashState((current) => {
          if (current.invalid) return current;
          if (
            current.location &&
            current.location.key.domain === domain &&
            current.location.key.pageKind === pageKind &&
            loadedProducts.some(
              (product) => product.id === current.location?.key.productCode,
            )
          ) {
            return current;
          }
          const first = loadedProducts[0];
          if (!first) return { invalid: false };
          const next = {
            key: { domain, pageKind, productCode: first.id },
            query: { values: {} },
          };
          window.history.replaceState(null, "", hashFor(next.key));
          return { invalid: false, location: next };
        });
      })
      .catch(() => active && setNavigationError(true));
    return () => {
      active = false;
    };
  }, [dependencies.masterDataRepository, navigationAttempt]);

  useEffect(() => {
    const synchronize = () => setHashState(locationFromHash());
    window.addEventListener("popstate", synchronize);
    window.addEventListener("hashchange", synchronize);
    return () => {
      window.removeEventListener("popstate", synchronize);
      window.removeEventListener("hashchange", synchronize);
    };
  }, []);

  const location = hashState.location;
  const pageKey = location?.key;

  function selectProduct(productCode: string) {
    const next = { key: { domain, pageKind, productCode }, query: { values: {} } };
    window.history.pushState(null, "", hashFor(next.key));
    setHashState({ invalid: false, location: next });
  }

  function commitQuery(query: ListQueryState) {
    if (!pageKey) return;
    window.history.pushState(null, "", hashFor(pageKey, query));
  }

  function normalizeQuery(query: ListQueryState) {
    if (!pageKey) return;
    window.history.replaceState(null, "", hashFor(pageKey, query));
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
          <button
            onClick={() => setNavigationAttempt((value) => value + 1)}
            type="button"
          >
            重试产品导航
          </button>
        </div>
      ) : hashState.invalid ? (
        <div className="page-alert" role="alert">
          页面地址无效，请从业务导航进入。
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
          onQueryNormalized={normalizeQuery}
          pageDefinitionGateway={dependencies.pageDefinitionGateway}
          pageKey={pageKey}
          {...(location ? { routeQuery: location.query } : {})}
        />
      )}
    </EnterpriseShell>
  );
}
