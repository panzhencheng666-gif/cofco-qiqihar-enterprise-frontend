import { useEffect, useState } from "react";

import { EnterpriseShell } from "./shell/EnterpriseShell";
import type { MarketCollectionRepository } from "../modules/market-monitoring/application/ports/MarketCollectionRepository";
import { HttpMarketCollectionRepository } from "../modules/market-monitoring/infrastructure/http/HttpMarketCollectionRepository";
import type { MasterDataRepository } from "../modules/master-data/application/ports/MasterDataRepository";
import { HttpMasterDataRepository } from "../modules/master-data/infrastructure/http/HttpMasterDataRepository";
import { MarketCollectionPage } from "../modules/market-monitoring/ui/pages/MarketCollectionPage";
import type { ProductionRecordRepository } from "../modules/production-monitoring/application/ports/ProductionRecordRepository";
import { HttpProductionRecordRepository } from "../modules/production-monitoring/infrastructure/http/HttpProductionRecordRepository";
import { ProductionMonitoringPage } from "../modules/production-monitoring/ui/pages/ProductionMonitoringPage";
import type { WorkItemRepository } from "../modules/work-management/application/ports/WorkItemRepository";
import { HttpWorkItemRepository } from "../modules/work-management/infrastructure/http/HttpWorkItemRepository";
import { WorkItemsPage } from "../modules/work-management/ui/pages/WorkItemsPage";
import type { WorkItemScope } from "../modules/work-management/domain/workItem";
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
const productionRecordRepository = new HttpProductionRecordRepository(httpClient);
const workItemRepository = new HttpWorkItemRepository(httpClient);

export interface AppDependencies {
  masterDataRepository: MasterDataRepository;
  pageDefinitionGateway: PageDefinitionGateway;
  marketCollectionRepository: MarketCollectionRepository;
  productionRecordRepository?: ProductionRecordRepository;
  workItemRepository: WorkItemRepository;
}

const productionDependencies: AppDependencies = {
  masterDataRepository,
  pageDefinitionGateway,
  marketCollectionRepository,
  productionRecordRepository,
  workItemRepository,
};

interface AppLocation {
  key: BusinessPageKey & { productCode: string };
  query: { pageNumber?: number; pageSize?: number; values: Record<string, string> };
}

interface WorkLocation {
  scope: WorkItemScope;
  query: { pageNumber?: number; pageSize?: number; values: Record<string, string> };
}

interface HashState {
  location?: AppLocation;
  workLocation?: WorkLocation;
  invalid: boolean;
}

const defaultPageKey = { domain: "MARKET", pageKind: "QUALITY" } as const;

function isProductionPage(key?: BusinessPageKey) {
  return key?.domain === "PRODUCTION" && key.pageKind === "MONITORING";
}

function supportedPageContext(key?: BusinessPageKey) {
  return isProductionPage(key)
    ? { domain: "PRODUCTION", pageKind: "MONITORING" }
    : defaultPageKey;
}

function locationFromHash(): HashState {
  const workMatch = /^#\/work\/(pending|completed)(?:\?(.*))?$/.exec(
    window.location.hash,
  );
  if (workMatch) {
    try {
      decodeURIComponent(workMatch[2] ?? "");
      const parameters = new URLSearchParams(workMatch[2] ?? "");
      const values: Record<string, string> = {};
      for (const name of ["status", "domain", "regionId", "productCode"]) {
        const value = parameters.get(name);
        if (value) values[name] = value;
      }
      const pageValue = parameters.get("page");
      const pageSizeValue = parameters.get("pageSize");
      const pageNumber = Number(pageValue);
      const pageSize = Number(pageSizeValue);
      return {
        invalid: false,
        workLocation: {
          scope: workMatch[1] === "pending" ? "PENDING" : "COMPLETED",
          query: {
            values,
            ...(pageValue !== null && Number.isInteger(pageNumber) && pageNumber >= 0
              ? { pageNumber }
              : {}),
            ...(pageSizeValue !== null && Number.isInteger(pageSize) && pageSize > 0
              ? { pageSize }
              : {}),
          },
        },
      };
    } catch {
      return { invalid: true };
    }
  }
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
    const key = {
      domain: decodeURIComponent(match[1]!),
      pageKind: decodeURIComponent(match[2]!),
      productCode: decodeURIComponent(match[3]!),
    };
    if (key.domain === "PRODUCTION" && !isProductionPage(key)) {
      return { invalid: true };
    }
    return {
      invalid: false,
      location: {
        key,
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

function workHash(scope: WorkItemScope, query?: ListQueryState) {
  const parameters = new URLSearchParams();
  if (query) {
    parameters.set("page", String(query.pageNumber));
    parameters.set("pageSize", String(query.pageSize));
    for (const [name, value] of Object.entries(query.values)) {
      if (value) parameters.set(name, value);
    }
  }
  const suffix = parameters.size ? `?${parameters.toString()}` : "";
  return `#/work/${scope === "PENDING" ? "pending" : "completed"}${suffix}`;
}

function hashFor(
  key: BusinessPageKey & { productCode: string },
  query?: ListQueryState,
) {
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
  const { domain: navigationDomain, pageKind: navigationPageKind } =
    supportedPageContext(hashState.location?.key);

  useEffect(() => {
    if (hashState.workLocation) {
      return;
    }
    let active = true;
    void dependencies.masterDataRepository
      .getProducts(navigationDomain, navigationPageKind)
      .then((loadedProducts) => {
        if (!active) return;
        setProducts(loadedProducts);
        setNavigationError(false);
        setHashState((current) => {
          if (current.invalid) return current;
          if (
            current.location &&
            current.location.key.domain === navigationDomain &&
            current.location.key.pageKind === navigationPageKind &&
            loadedProducts.some(
              (product) => product.id === current.location?.key.productCode,
            )
          ) {
            return current;
          }
          const first = loadedProducts[0];
          if (!first) return { invalid: false };
          const next = {
            key: {
              domain: navigationDomain,
              pageKind: navigationPageKind,
              productCode: first.id,
            },
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
  }, [
    dependencies.masterDataRepository,
    navigationDomain,
    navigationPageKind,
    hashState.workLocation,
    navigationAttempt,
  ]);

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
  const workLocation = hashState.workLocation;
  const pageKey = location?.key;

  function selectProduct(productCode: string) {
    const context = supportedPageContext(pageKey);
    const next = { key: { ...context, productCode }, query: { values: {} } };
    window.history.pushState(null, "", hashFor(next.key));
    setHashState({ invalid: false, location: next });
  }

  function commitQuery(query: ListQueryState) {
    if (!pageKey) return;
    window.history.pushState(null, "", hashFor(pageKey, query));
    setHashState({ invalid: false, location: { key: pageKey, query } });
  }

  function normalizeQuery(query: ListQueryState) {
    if (!pageKey) return;
    window.history.replaceState(null, "", hashFor(pageKey, query));
    setHashState({ invalid: false, location: { key: pageKey, query } });
  }

  function commitWorkQuery(query: ListQueryState) {
    if (!workLocation) return;
    window.history.pushState(null, "", workHash(workLocation.scope, query));
    setHashState({
      invalid: false,
      workLocation: { scope: workLocation.scope, query },
    });
  }

  function normalizeWorkQuery(query: ListQueryState) {
    if (!workLocation) return;
    window.history.replaceState(null, "", workHash(workLocation.scope, query));
    setHashState({
      invalid: false,
      workLocation: { scope: workLocation.scope, query },
    });
  }

  return (
    <EnterpriseShell
      onProductSelect={selectProduct}
      products={workLocation ? [] : products}
      productItemSuffix={pageKey?.domain === "PRODUCTION" ? "产情监测" : "质量指标"}
      productNavigationTitle={
        pageKey?.domain === "PRODUCTION" ? "产情产品" : "质量指标"
      }
      {...(pageKey ? { activeProductId: pageKey.productCode } : {})}
    >
      {workLocation ? (
        <WorkItemsPage
          key={workLocation.scope}
          loadRegionChildren={(parentId) =>
            dependencies.masterDataRepository.getRegionChildren(parentId)
          }
          loadRegionPath={(regionId) =>
            dependencies.masterDataRepository.getRegionPath(regionId)
          }
          loadProducts={() =>
            dependencies.masterDataRepository
              .getProducts()
              .then((items) =>
                items.map((item) => ({ value: item.id, label: item.name })),
              )
          }
          onQueryCommitted={commitWorkQuery}
          onQueryNormalized={normalizeWorkQuery}
          pageDefinitionGateway={dependencies.pageDefinitionGateway}
          repository={dependencies.workItemRepository}
          routeQuery={workLocation.query}
          scope={workLocation.scope}
        />
      ) : navigationError ? (
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
      ) : isProductionPage(pageKey) ? (
        <ProductionMonitoringPage
          loadCultivars={(productCode) =>
            dependencies.masterDataRepository
              .getCultivars(productCode)
              .then((items) =>
                items.map((item) => ({ value: item.id, label: item.name })),
              )
          }
          loadRegionChildren={(parentId) =>
            dependencies.masterDataRepository.getRegionChildren(parentId)
          }
          loadRegionPath={(regionId) =>
            dependencies.masterDataRepository.getRegionPath(regionId)
          }
          onQueryCommitted={commitQuery}
          onQueryNormalized={normalizeQuery}
          pageDefinitionGateway={dependencies.pageDefinitionGateway}
          pageKey={pageKey}
          repository={
            dependencies.productionRecordRepository ?? productionRecordRepository
          }
          {...(location ? { routeQuery: location.query } : {})}
        />
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
