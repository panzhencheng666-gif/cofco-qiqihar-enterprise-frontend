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
        if (action === "RUN" || action === "ADJUST") state.openRunner();
        if (action === "VIEW_SOURCE" && rowId) state.viewSource(rowId);
      }}
      onQueryChange={controller.changeQuery}
      onRetry={() => void controller.executeSearch(controller.query!)}
      onSearch={controller.submitSearch}
      query={controller.query!}
      result={controller.result!}
    />
  );
}
