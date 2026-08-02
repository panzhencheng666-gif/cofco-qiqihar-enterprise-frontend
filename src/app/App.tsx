import { EnterpriseShell } from "./shell/EnterpriseShell";
import { HttpMasterDataRepository } from "../modules/master-data/infrastructure/http/HttpMasterDataRepository";
import { HttpMarketCollectionRepository } from "../modules/market-monitoring/infrastructure/http/HttpMarketCollectionRepository";
import { SoybeanMarketCollectionPage } from "../modules/market-monitoring/ui/pages/SoybeanMarketCollectionPage";
import { FetchHttpClient } from "../shared/api/HttpClient";

const httpClient = new FetchHttpClient();
const masterDataRepository = new HttpMasterDataRepository(httpClient);
const marketCollectionRepository = new HttpMarketCollectionRepository(httpClient);

export function App() {
  return (
    <EnterpriseShell>
      <SoybeanMarketCollectionPage
        masterDataRepository={masterDataRepository}
        marketCollectionRepository={marketCollectionRepository}
      />
    </EnterpriseShell>
  );
}
