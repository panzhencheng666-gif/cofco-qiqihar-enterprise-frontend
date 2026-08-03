import type { SupplyAccountRepository } from "../../application/ports/SupplyAccountRepository";
import type {
  BusinessPageKey,
  ListQueryState,
  LoadRegionChildren,
  LoadRegionPath,
  PageDefinitionGateway,
  RouteListQuery,
} from "../../../../shared/application/page-definition";
import { SupplyLedger } from "../components/SupplyLedger";
import { SupplyRunner } from "../components/SupplyRunner";
import { SupplySummary } from "../components/SupplySummary";
import { useSupplyAccount } from "../hooks/useSupplyAccount";

export function SupplyAccountPage(props: {
  loadRegionChildren: LoadRegionChildren;
  loadRegionPath?: LoadRegionPath;
  onQueryCommitted?: (query: ListQueryState) => void;
  onQueryNormalized?: (query: ListQueryState) => void;
  pageDefinitionGateway: PageDefinitionGateway;
  pageKey: BusinessPageKey;
  repository: SupplyAccountRepository;
  routeQuery?: RouteListQuery;
}) {
  const state = useSupplyAccount(props);
  const { controller } = state;
  if (controller.definitionError)
    return (
      <div className="page-alert" role="alert">
        {controller.definitionError}
        <button onClick={controller.retryDefinition}>重试页面定义</button>
      </div>
    );
  if (!controller.definition || !controller.query || !controller.result)
    return <div className="ledger-panel list-workbench-loading">正在加载页面定义</div>;
  return (
    <>
      {state.issue && (
        <div className="page-alert" role="alert">
          {state.issue}
        </div>
      )}
      {state.account && <SupplySummary account={state.account} />}
      <SupplyLedger
        loadRegionChildren={props.loadRegionChildren}
        {...(props.loadRegionPath ? { loadRegionPath: props.loadRegionPath } : {})}
        state={state}
      />
      {state.runner && (
        <SupplyRunner
          busy={state.busy}
          command={state.runner}
          onCancel={state.closeRunner}
          onChange={state.setRunner}
          onRun={() => void state.run()}
        />
      )}
    </>
  );
}
