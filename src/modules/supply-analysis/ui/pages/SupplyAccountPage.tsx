import { useMemo } from "react";

import type { MasterDataRepository } from "../../../master-data/application/ports/MasterDataRepository";
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
import { SupplyInputManager } from "../components/SupplyInputManager";
import { SupplyRunner } from "../components/SupplyRunner";
import { SupplySummary } from "../components/SupplySummary";
import { useSupplyAccount } from "../hooks/useSupplyAccount";

export function SupplyAccountPage(props: {
  loadRegionChildren: LoadRegionChildren;
  loadRegionPath?: LoadRegionPath;
  onQueryCommitted?: (query: ListQueryState) => void;
  onQueryNormalized?: (query: ListQueryState) => void;
  pageDefinitionGateway: PageDefinitionGateway;
  periodRepository: Pick<MasterDataRepository, "getSupplySurveyPeriods">;
  pageKey: BusinessPageKey;
  repository: SupplyAccountRepository;
  routeQuery?: RouteListQuery;
}) {
  const pageDefinitionGateway = useMemo<PageDefinitionGateway>(
    () => ({
      getDefinition: async (key) => {
        const [definition, periods] = await Promise.all([
          props.pageDefinitionGateway.getDefinition(key),
          props.periodRepository.getSupplySurveyPeriods(),
        ]);
        return {
          ...definition,
          filters: definition.filters.map((filter) =>
            filter.id === "periodCode"
              ? {
                  ...filter,
                  options: periods.map((period) => ({
                    value: period.id,
                    label: `${period.name}（${period.marketingYearName}）`,
                  })),
                }
              : filter,
          ),
        };
      },
    }),
    [props.pageDefinitionGateway, props.periodRepository],
  );
  const state = useSupplyAccount({ ...props, pageDefinitionGateway });
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
      {state.account && (
        <SupplySummary
          account={state.account}
          accounts={state.accounts}
          onVersionChange={state.selectVersion}
        />
      )}
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
      {state.manager && <SupplyInputManager state={state} />}
    </>
  );
}
