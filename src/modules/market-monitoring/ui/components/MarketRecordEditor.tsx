import type { MarketEditorSession } from "../hooks/useMarketCommands";
import {
  calculateMarketActualPrice,
  type MarketCoreField,
  type MarketDraft,
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
  const change = (code: string, value: string | null) =>
    onChange({
      ...editor.draft,
      coreValues: { ...editor.draft.coreValues, [code]: value },
    });
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
            coreFields={editor.definition.coreFields}
            readonlyValues={editor.readonlyValues}
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
  coreFields,
  readonlyValues,
  definition,
  draft,
  loadRegionChildren,
  loadRegionPath,
  onChange,
  onObjectTypeChange,
}: {
  coreFields: MarketEditorSession["definition"]["coreFields"];
  readonlyValues: MarketEditorSession["readonlyValues"];
  definition: MarketCoreField;
  draft: MarketDraft;
  loadRegionChildren: LoadRegionChildren;
  loadRegionPath: LoadRegionPath;
  onChange: (code: string, value: string | null) => void;
  onObjectTypeChange: (value: string) => void;
}) {
  const value =
    (definition.controlType.startsWith("READONLY_")
      ? readonlyValues[definition.code]
      : draft.coreValues[definition.code]) ?? "";
  if (definition.capability === "ACTUAL_TRADE_PRICE") {
    return (
      <label>
        {fieldLabel(definition)}
        <input
          aria-label={definition.label}
          readOnly
          value={calculateMarketActualPrice(draft.coreValues, coreFields)}
        />
        {definition.description && <small>{definition.description}</small>}
      </label>
    );
  }
  if (definition.controlType === "READONLY_DATETIME") {
    return (
      <label>
        {fieldLabel(definition)}
        <input aria-label={definition.label} readOnly value={value} />
        {definition.description && <small>{definition.description}</small>}
      </label>
    );
  }
  if (definition.capability === "OBJECT_TYPE_CONTEXT") {
    return (
      <label>
        {fieldLabel(definition)}
        <select
          aria-label={definition.label}
          onChange={(event) => onObjectTypeChange(event.target.value)}
          required={definition.required}
          value={value}
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
  if (definition.controlType === "REGION_HIERARCHY") {
    return (
      <div>
        <RegionHierarchyFilter
          label={definition.label}
          loadChildren={loadRegionChildren}
          loadPath={loadRegionPath}
          onChange={(next) => onChange(definition.code, next)}
          placeholder={definition.label}
          value={value}
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
          onChange={(event) => onChange(definition.code, event.target.value || null)}
          required={definition.required}
          value={value}
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
        onChange={(event) => onChange(definition.code, event.target.value)}
        readOnly={definition.controlType === "READONLY_DECIMAL"}
        required={definition.required}
        type={definition.controlType === "DATE" ? "date" : "text"}
        value={value}
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
