import type { LogisticsRecordRepository } from "../../application/ports/LogisticsRecordRepository";
import type {
  BusinessPageKey,
  ListQueryState,
  LoadRegionChildren,
  LoadRegionPath,
  PageDefinitionGateway,
  RouteListQuery,
} from "../../../../shared/application/page-definition";
import { ListWorkbench } from "../../../../shared/ui/list-workbench";
import { LogisticsEditor } from "../components/LogisticsEditor";
import { LogisticsReturnDialog } from "../components/LogisticsReturnDialog";
import { useLogisticsMonitoring } from "../hooks/useLogisticsMonitoring";

export function LogisticsMonitoringPage(props: {
  loadRegionChildren: LoadRegionChildren;
  loadRegionPath?: LoadRegionPath;
  onQueryCommitted?: (query: ListQueryState) => void;
  onQueryNormalized?: (query: ListQueryState) => void;
  pageDefinitionGateway: PageDefinitionGateway;
  pageKey: BusinessPageKey;
  repository: LogisticsRecordRepository;
  routeQuery?: RouteListQuery;
}) {
  const state = useLogisticsMonitoring(props);
  const { controller } = state;
  if (controller.definitionError || state.definitionIssue)
    return (
      <div className="page-alert" role="alert">
        {controller.definitionError || state.definitionIssue}
        <button
          onClick={
            controller.definitionError
              ? controller.retryDefinition
              : state.retryDefinition
          }
        >
          重试页面定义
        </button>
      </div>
    );
  if (
    !controller.definition ||
    !controller.query ||
    !controller.result ||
    !state.definition
  )
    return <div className="ledger-panel list-workbench-loading">正在加载页面定义</div>;

  return (
    <>
      {state.issue && (
        <div className="page-alert" role="alert">
          {state.issue}
        </div>
      )}
      <ListWorkbench
        actionsDisabled={state.busy}
        definition={controller.definition}
        errorMessage={controller.listError}
        loadRegionChildren={props.loadRegionChildren}
        {...(props.loadRegionPath ? { loadRegionPath: props.loadRegionPath } : {})}
        loading={controller.loading}
        onAction={(action, id) => void state.act(action, id)}
        onQueryChange={controller.changeQuery}
        onRetry={() => void controller.executeSearch(controller.query!)}
        onSearch={controller.submitSearch}
        query={controller.query}
        result={controller.result}
      />
      {state.editor && (
        <LogisticsEditor
          busy={state.busy}
          definition={state.definition}
          draft={state.editor.draft}
          onCancel={state.closeEditor}
          onChange={state.changeDraft}
          onSave={() => void state.save()}
        />
      )}
      {state.returning && (
        <LogisticsReturnDialog
          busy={state.busy}
          reason={state.returnReason}
          onCancel={state.cancelReturn}
          onChange={state.setReturnReason}
          onConfirm={() => void state.confirmReturn()}
        />
      )}
    </>
  );
}
