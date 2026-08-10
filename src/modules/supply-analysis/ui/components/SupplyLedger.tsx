import type {
  LoadRegionChildren,
  LoadRegionPath,
} from "../../../../shared/application/page-definition";
import { ListWorkbench } from "../../../../shared/ui/list-workbench";
import type { useSupplyAccount } from "../hooks/useSupplyAccount";

export function SupplyLedger({
  loadRegionChildren,
  loadRegionPath,
  state,
}: {
  loadRegionChildren: LoadRegionChildren;
  loadRegionPath?: LoadRegionPath;
  state: ReturnType<typeof useSupplyAccount>;
}) {
  const { controller } = state;
  return (
    <ListWorkbench
      actionsDisabled={state.busy}
      definition={controller.definition!}
      errorMessage={controller.listError}
      loadRegionChildren={loadRegionChildren}
      {...(loadRegionPath ? { loadRegionPath } : {})}
      loading={controller.loading}
      onAction={(action, rowId) => {
        if (action === "RUN") state.openRunner();
        if (action === "ADJUST") state.openInputManager();
        if (action === "VIEW_SOURCE" && rowId) state.viewSource(rowId);
      }}
      onQueryChange={(query) =>
        controller.changeQuery(
          query.values.periodCode !== controller.query?.values.periodCode
            ? { ...query, values: { ...query.values, version: "" } }
            : query,
        )
      }
      onRetry={() => void controller.executeSearch(controller.query!)}
      onSearch={controller.submitSearch}
      query={controller.query!}
      result={controller.result!}
    />
  );
}
