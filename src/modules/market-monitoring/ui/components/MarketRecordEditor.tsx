import type { MarketEditorSession } from "../hooks/useMarketCommands";
import {
  calculateMarketActualPrice,
  marketDraftField,
  type MarketCoreField,
  type MarketDraft,
  type MarketDraftCoreField,
} from "../../domain/marketCollection";
import type {
  LoadRegionChildren,
  LoadRegionPath,
} from "../../../../shared/application/page-definition";
import { RegionHierarchyFilter } from "../../../../shared/ui/list-workbench";

const emptyRegionPath: LoadRegionPath = () => Promise.resolve([]);

export function MarketRecordEditor({
  definitionLoading,
  editor,
  loading,
  loadRegionChildren,
  loadRegionPath = emptyRegionPath,
  onCancel,
  onChange,
  onObjectTypeChange,
  onSave,
}: {
  definitionLoading: boolean;
  editor: MarketEditorSession;
  loading: boolean;
  loadRegionChildren: LoadRegionChildren;
  loadRegionPath?: LoadRegionPath;
  onCancel: () => void;
  onChange: (draft: MarketDraft) => void;
  onObjectTypeChange: (value: string) => void;
  onSave: () => void;
}) {
  const editable = editor.id === undefined || editor.allowedActions.includes("SAVE");
  const change = (key: MarketDraftCoreField, value: string | null) =>
    onChange({ ...editor.draft, [key]: value });
  return (
    <div
      aria-labelledby="market-editor-title"
      className="production-dialog"
      role="dialog"
    >
      <h2 id="market-editor-title">
        {editor.id === undefined ? "新建市场填报" : "市场记录详情"}
      </h2>
      <fieldset disabled={!editable || loading}>
        {editor.definition.coreFields.map((field) => (
          <CoreField
            definition={field}
            draft={editor.draft}
            actualTradePrice={editor.actualTradePrice}
            reportedAt={editor.reportedAt}
            key={field.code}
            loadRegionChildren={loadRegionChildren}
            loadRegionPath={loadRegionPath}
            onChange={change}
            onObjectTypeChange={onObjectTypeChange}
          />
        ))}
        {editor.definition.groups.map((group) => (
          <fieldset key={group.category}>
            <legend>{group.label}</legend>
            {group.fields.map((field) => (
              <label key={field.code}>
                {field.label}
                {field.unit ? `（${field.unit}）` : ""}
                <input
                  aria-label={field.label}
                  inputMode="decimal"
                  onChange={(event) =>
                    onChange({
                      ...editor.draft,
                      facts: {
                        ...editor.draft.facts,
                        [field.code]: event.target.value,
                      },
                    })
                  }
                  value={editor.draft.facts[field.code] ?? ""}
                />
                {field.description && <small>{field.description}</small>}
              </label>
            ))}
          </fieldset>
        ))}
      </fieldset>
      {definitionLoading && <p role="status">正在加载适用字段</p>}
      {editable && (
        <button disabled={loading || definitionLoading} onClick={onSave} type="button">
          保存草稿
        </button>
      )}
      <button onClick={onCancel} type="button">
        关闭
      </button>
    </div>
  );
}

function CoreField({
  actualTradePrice,
  reportedAt,
  definition,
  draft,
  loadRegionChildren,
  loadRegionPath,
  onChange,
  onObjectTypeChange,
}: {
  actualTradePrice: string;
  reportedAt: string;
  definition: MarketCoreField;
  draft: MarketDraft;
  loadRegionChildren: LoadRegionChildren;
  loadRegionPath: LoadRegionPath;
  onChange: (key: MarketDraftCoreField, value: string | null) => void;
  onObjectTypeChange: (value: string) => void;
}) {
  const field = marketDraftField(definition.code);
  if (field === "actualTradePrice") {
    return (
      <label>
        {fieldLabel(definition)}
        <input
          aria-label={definition.label}
          readOnly
          value={calculateMarketActualPrice(draft) || actualTradePrice}
        />
        {definition.description && <small>{definition.description}</small>}
      </label>
    );
  }
  if (field === "reportedAt") {
    return (
      <label>
        {fieldLabel(definition)}
        <input aria-label={definition.label} readOnly value={reportedAt} />
        {definition.description && <small>{definition.description}</small>}
      </label>
    );
  }
  if (field === "objectTypeCode") {
    return (
      <label>
        {fieldLabel(definition)}
        <select
          aria-label={definition.label}
          onChange={(event) => onObjectTypeChange(event.target.value)}
          value={draft.objectTypeCode}
        >
          <option value="">—</option>
          {definition.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {definition.description && <small>{definition.description}</small>}
      </label>
    );
  }
  if (field === "regionCode") {
    return (
      <div>
        <RegionHierarchyFilter
          label={definition.label}
          loadChildren={loadRegionChildren}
          loadPath={loadRegionPath}
          onChange={(value) => onChange(field, value)}
          placeholder={definition.label}
          value={draft.regionCode}
        />
        {definition.description && <small>{definition.description}</small>}
      </div>
    );
  }
  if (definition.controlType === "SELECT") {
    return (
      <label>
        {fieldLabel(definition)}
        <select
          aria-label={definition.label}
          onChange={(event) => onChange(field, event.target.value || null)}
          value={String(draft[field] ?? "")}
        >
          <option value="">—</option>
          {definition.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {definition.description && <small>{definition.description}</small>}
      </label>
    );
  }
  return (
    <label>
      {fieldLabel(definition)}
      <input
        aria-label={definition.label}
        inputMode={definition.controlType === "DECIMAL" ? "decimal" : undefined}
        onChange={(event) => onChange(field, event.target.value)}
        type={definition.controlType === "DATE" ? "date" : "text"}
        value={String(draft[field] ?? "")}
      />
      {definition.description && <small>{definition.description}</small>}
    </label>
  );
}

function fieldLabel(definition: MarketCoreField) {
  return definition.unit
    ? `${definition.label}（${definition.unit}）`
    : definition.label;
}
