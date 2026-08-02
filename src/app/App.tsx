import { EnterpriseShell } from "./shell/EnterpriseShell";
import { HttpMasterDataRepository } from "../modules/master-data/infrastructure/http/HttpMasterDataRepository";
import { MarketCollectionPage } from "../modules/market-monitoring/ui/pages/MarketCollectionPage";
import type { BusinessPageKey } from "../shared/application/page-definition";
import { FetchHttpClient } from "../shared/api/HttpClient";
import { HttpPageDefinitionGateway } from "../shared/infrastructure/page-definition/HttpPageDefinitionGateway";

const httpClient = new FetchHttpClient();
const masterDataRepository = new HttpMasterDataRepository(httpClient);
const pageDefinitionGateway = new HttpPageDefinitionGateway(httpClient);

function pageKeyFromLocation(): BusinessPageKey | undefined {
  const parameters = new URLSearchParams(window.location.search);
  const domain = parameters.get("domain");
  const pageKind = parameters.get("pageKind");
  const productCode = parameters.get("productCode");
  return domain && pageKind && productCode
    ? { domain, pageKind, productCode }
    : undefined;
}

export function App() {
  const pageKey = pageKeyFromLocation();
  return (
    <EnterpriseShell>
      {pageKey === undefined ? (
        <div className="page-alert">页面业务上下文缺失，请从业务导航进入。</div>
      ) : (
        <MarketCollectionPage
          loadRegionChildren={(parentId) =>
            masterDataRepository.getRegionChildren(parentId)
          }
          pageDefinitionGateway={pageDefinitionGateway}
          pageKey={pageKey}
        />
      )}
    </EnterpriseShell>
  );
}
