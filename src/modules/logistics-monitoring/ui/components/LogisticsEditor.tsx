import type { LogisticsDefinition, LogisticsDraft } from "../../domain/logisticsRecord";

export function LogisticsEditor({
  busy,
  definition,
  draft,
  onCancel,
  onChange,
  onSave,
}: {
  busy: boolean;
  definition: LogisticsDefinition;
  draft: LogisticsDraft;
  onCancel: () => void;
  onChange: (draft: LogisticsDraft) => void;
  onSave: () => void;
}) {
  const unsupported = definition.fields.some(
    (field) =>
      ![
        "SELECT",
        "DATE",
        "DECIMAL",
        "TEXT",
        "READONLY_DATETIME",
        "READONLY_STATUS",
      ].includes(field.controlType),
  );
  const incomplete = definition.fields.some(
    (field) => field.required && !field.readOnly && !draft.values[field.code]?.trim(),
  );
  const change = (code: string, value: string) =>
    onChange({ ...draft, values: { ...draft.values, [code]: value } });

  return (
    <div
      aria-labelledby="logistics-editor-title"
      className="production-dialog logistics-editor"
      role="dialog"
    >
      <h2 id="logistics-editor-title">物流事件填报</h2>
      {unsupported && <div role="alert">字段定义不可执行，请联系管理员。</div>}
      <div className="logistics-editor-grid">
        {definition.fields.map((field) => {
          const value = draft.values[field.code] ?? "";
          if (field.readOnly)
            return (
              <label key={field.code}>
                {field.label}
                <input aria-label={field.label} disabled value={value} />
              </label>
            );
          if (field.controlType === "SELECT")
            return (
              <label key={field.code}>
                {field.label}
                <select
                  aria-label={field.label}
                  required={field.required}
                  value={value}
                  onChange={(event) => change(field.code, event.target.value)}
                >
                  <option value="">请选择</option>
                  {field.options.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            );
          return (
            <label key={field.code}>
              {field.label}
              {field.unit && <small>{field.unit}</small>}
              <input
                aria-label={field.label}
                min={field.controlType === "DECIMAL" ? "0" : undefined}
                required={field.required}
                step={
                  field.controlType === "DECIMAL" && field.scale !== null
                    ? `0.${"0".repeat(Math.max(0, field.scale - 1))}1`
                    : undefined
                }
                type={
                  field.controlType === "DECIMAL"
                    ? "number"
                    : field.controlType === "DATE"
                      ? "date"
                      : "text"
                }
                value={value}
                onChange={(event) => change(field.code, event.target.value)}
              />
            </label>
          );
        })}
      </div>
      <button disabled={busy || unsupported || incomplete} onClick={onSave}>
        保存草稿
      </button>
      <button onClick={onCancel}>取消</button>
    </div>
  );
}
