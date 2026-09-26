import { useMemo, useState } from "react";
import { calculatorModels, calculateManual } from "./calculatorModels";
import { useWorkspaceTheme } from "./useWorkspaceTheme";

const format = new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 4 });

export function CalculatorWorkspace({ onClose }: { onClose: () => void }) {
  const [selected, setSelected] = useState(calculatorModels[0]!.id);
  const [values, setValues] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [query, setQuery] = useState("");
  const { theme, selectTheme } = useWorkspaceTheme();
  const model =
    calculatorModels.find((item) => item.id === selected) ?? calculatorModels[0]!;
  const result = useMemo(() => calculateManual(model, values), [model, values]);
  const groups = [...new Set(calculatorModels.map((item) => item.group))];

  return (
    <section
      className="mi-workspace mi-calculator-workspace"
      data-theme={theme}
      role="dialog"
      aria-modal="true"
      aria-labelledby="mi-calculator-title"
    >
      <header className="mi-workspace-header">
        <button type="button" className="mi-workspace-back" onClick={onClose}>
          ← 返回商情大屏
        </button>
        <div className="mi-workspace-heading">
          <small>商情工具栏 / 人工试算</small>
          <h1 id="mi-calculator-title">粮食产业计算工具</h1>
        </div>
        <span className="mi-workspace-feed">仅用人工输入数值 · 本机试算</span>
        <div className="mi-theme-switch" role="group" aria-label="分析界面外观">
          <button
            type="button"
            aria-pressed={theme === "light"}
            onClick={() => selectTheme("light")}
          >
            浅色
          </button>
          <button
            type="button"
            aria-pressed={theme === "dark"}
            onClick={() => selectTheme("dark")}
          >
            深色
          </button>
        </div>
      </header>
      <div className="mi-calculator-grid">
        <aside className="mi-calculator-directory" aria-label="计算工具目录">
          <div className="mi-workspace-panel-title">
            人工试算 <span>{calculatorModels.length} 项</span>
          </div>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索计算工具"
            aria-label="搜索计算工具"
          />
          <div className="mi-calculator-directory-scroll">
            {groups.map((group) => {
              const visible = calculatorModels.filter(
                (item) => item.group === group && item.title.includes(query.trim()),
              );
              return visible.length ? (
                <section key={group}>
                  <h2>{group}</h2>
                  {visible.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={item.id === model.id ? "active" : ""}
                      onClick={() => {
                        setSelected(item.id);
                        setValues({});
                        setSubmitted(false);
                      }}
                    >
                      {item.title}
                    </button>
                  ))}
                </section>
              ) : null;
            })}
          </div>
        </aside>
        <div className="mi-calculator-main">
          <div className="mi-workspace-section-head">
            <div>
              <small>MANUAL CALCULATION / USER INPUT</small>
              <h2>{model.title}</h2>
            </div>
            <span>试算口径 · 非自动行情值</span>
          </div>
          <form
            className="mi-calculator-form"
            onSubmit={(event) => {
              event.preventDefault();
              setSubmitted(true);
            }}
          >
            <div className="mi-calculator-input-grid">
              {model.fields.map((item) => (
                <label key={item.key}>
                  <span>
                    {item.label}
                    <small>{item.unit}</small>
                  </span>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="any"
                    value={values[item.key] ?? ""}
                    onChange={(event) => {
                      setValues((current) => ({
                        ...current,
                        [item.key]: event.target.value,
                      }));
                      setSubmitted(false);
                    }}
                    placeholder="请输入"
                  />
                </label>
              ))}
            </div>
            <div className="mi-calculator-actions">
              <button type="submit">计算结果</button>
              <button
                type="button"
                onClick={() => {
                  setValues({});
                  setSubmitted(false);
                }}
              >
                清空输入
              </button>
            </div>
          </form>
          <div className="mi-calculator-result" role="status" aria-live="polite">
            <span>试算结果</span>
            <strong>
              {submitted && result.value !== null ? format.format(result.value) : "—"}
              <small>{submitted && result.value !== null ? model.unit : ""}</small>
            </strong>
            {submitted && result.error && <em>{result.error}</em>}
          </div>
          {submitted && result.value !== null && (
            <div className="mi-calculator-expression">
              <small>本次计算公式</small>
              <strong>{model.expression}</strong>
              <small>代入数值</small>
              <div className="mi-calculator-substitution">
                {model.fields.map((field) => (
                  <span key={field.key}>
                    {field.label} = {values[field.key]} {field.unit}
                  </span>
                ))}
              </div>
            </div>
          )}
          <p className="mi-calculator-note">
            结果仅由当前输入计算。合同计价单位、得率、费率与税费口径须由使用者核对；输入不会写入行情指标或自动数据源。
          </p>
        </div>
      </div>
    </section>
  );
}
