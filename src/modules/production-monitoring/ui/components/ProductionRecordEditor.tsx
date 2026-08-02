import type { ProductionEditorSession } from "../hooks/useProductionCommands";
import {
  productionDraftField,
  type ProductionDraft,
  type ProductionDraftCoreField,
} from "../../domain/productionRecord";
import type {
  FieldDefinition,
  LoadRegionChildren,
  LoadRegionPath,
} from "../../../../shared/application/page-definition";
import { RegionHierarchyFilter } from "../../../../shared/ui/list-workbench";

const emptyRegionPath: LoadRegionPath = () => Promise.resolve([]);

export function ProductionRecordEditor({
  coreFields,
  cultivars,
  definitionLoading,
  editor,
  loading,
  loadRegionChildren,
  loadRegionPath = emptyRegionPath,
  objectTypeOptions,
  onCancel,
  onChange,
  onObjectTypeChange,
  onSave,
}: {
  coreFields: readonly FieldDefinition[];
  cultivars: readonly { value: string; label: string }[];
  definitionLoading: boolean;
  editor: ProductionEditorSession;
  loading: boolean;
  loadRegionChildren: LoadRegionChildren;
  loadRegionPath?: LoadRegionPath;
  objectTypeOptions: readonly { value: string; label: string }[];
  onCancel: () => void;
  onChange: (draft: ProductionDraft) => void;
  onObjectTypeChange: (value: string) => void;
  onSave: () => void;
}) {
  const draft = editor.draft;
  const editable = editor.id === undefined || editor.allowedActions.includes("SAVE");
  const change = (key: ProductionDraftCoreField, value: string | null) =>
    onChange({ ...draft, [key]: value });
  return (
    <div
      aria-labelledby="production-editor-title"
      className="production-dialog"
      role="dialog"
    >
      <h2 id="production-editor-title">
        {editor.id === undefined ? "新建产情填报" : "产情记录详情"}
      </h2>
      <fieldset disabled={!editable || loading}>
        {coreFields.map((field) => {
          const commandField = productionDraftField(field.id);
          return commandField ? (
            <CoreField
              cultivars={cultivars}
              definition={field}
              draft={draft}
              key={field.id}
              loadRegionChildren={loadRegionChildren}
              loadRegionPath={loadRegionPath}
              objectTypeOptions={objectTypeOptions}
              onChange={change}
              onObjectTypeChange={onObjectTypeChange}
            />
          ) : null;
        })}
        {editor.definition.groups.map((group) => (
          <fieldset key={group.category}>
            <legend>{group.label}</legend>
            {categoryKey(group.category) ? (
              group.fields.map((field) => (
                <label key={field.code}>
                  {field.label}
                  {field.unit ? `（${field.unit}）` : ""}
                  <input
                    aria-label={field.label}
                    inputMode="decimal"
                    onChange={(event) =>
                      changeFact(
                        onChange,
                        draft,
                        group.category,
                        field.code,
                        event.target.value,
                      )
                    }
                    value={factValues(draft, group.category)[field.code] ?? ""}
                  />
                  {field.description && <small>{field.description}</small>}
                </label>
              ))
            ) : (
              <p role="note">该分组暂不支持填报。</p>
            )}
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
  cultivars,
  definition,
  draft,
  loadRegionChildren,
  loadRegionPath,
  objectTypeOptions,
  onChange,
  onObjectTypeChange,
}: {
  cultivars: readonly { value: string; label: string }[];
  definition: FieldDefinition;
  draft: ProductionDraft;
  loadRegionChildren: LoadRegionChildren;
  loadRegionPath: LoadRegionPath;
  objectTypeOptions: readonly { value: string; label: string }[];
  onChange: (key: ProductionDraftCoreField, value: string | null) => void;
  onObjectTypeChange: (value: string) => void;
}) {
  const commandField = productionDraftField(definition.id)!;
  if (commandField === "objectTypeCode") {
    return (
      <label>
        {fieldLabel(definition)}
        <select
          aria-label={definition.label}
          onChange={(event) => onObjectTypeChange(event.target.value)}
          value={draft.objectTypeCode}
        >
          <option value="">—</option>
          {objectTypeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    );
  }
  if (commandField === "regionCode") {
    return (
      <RegionHierarchyFilter
        label={definition.label}
        loadChildren={loadRegionChildren}
        loadPath={loadRegionPath}
        onChange={(value) => onChange(commandField, value)}
        placeholder={definition.label}
        value={draft.regionCode}
      />
    );
  }
  if (commandField === "cultivarCode") {
    return (
      <label>
        {fieldLabel(definition)}
        <select
          aria-label={definition.label}
          onChange={(event) => onChange(commandField, event.target.value || null)}
          value={draft.cultivarCode ?? ""}
        >
          <option value="">—</option>
          {cultivars.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    );
  }
  return (
    <label>
      {fieldLabel(definition)}
      <input
        aria-label={definition.label}
        inputMode={definition.valueType === "DECIMAL" ? "decimal" : undefined}
        onChange={(event) => onChange(commandField, event.target.value)}
        type={definition.valueType === "DATE" ? "date" : "text"}
        value={String(draft[commandField] ?? "")}
      />
    </label>
  );
}

function fieldLabel(definition: FieldDefinition) {
  return definition.unit
    ? `${definition.label}（${definition.unit}）`
    : definition.label;
}

function changeFact(
  onChange: (draft: ProductionDraft) => void,
  draft: ProductionDraft,
  category: string,
  code: string,
  value: string,
) {
  const key = categoryKey(category);
  if (!key) return;
  onChange({ ...draft, [key]: { ...draft[key], [code]: value } });
}

function categoryKey(
  category: string,
): "quality" | "costs" | "insurance" | "subsidies" | undefined {
  return category === "QUALITY"
    ? "quality"
    : category === "COST"
      ? "costs"
      : category === "INSURANCE"
        ? "insurance"
        : category === "SUBSIDY"
          ? "subsidies"
          : undefined;
}

function factValues(draft: ProductionDraft, category: string) {
  const key = categoryKey(category);
  return key ? draft[key] : {};
}
