import { useEffect, useMemo, useState } from "react";
import type { ReportingRepository } from "../../application/ports/ReportingRepository";
import type { ReportParameterOptions, ReportPreview } from "../../domain/reporting";

export function ReportingCenterPage({
  repository,
}: {
  repository: ReportingRepository;
}) {
  const [options, setOptions] = useState<ReportParameterOptions>();
  const [preview, setPreview] = useState<ReportPreview>();
  const [exportId, setExportId] = useState<string>();
  const [issue, setIssue] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  useEffect(() => {
    let live = true;
    repository
      .options()
      .then((next) => live && setOptions(next))
      .catch(() => live && setIssue("报表参数加载失败，请重试。"));
    return () => {
      live = false;
    };
  }, [repository]);
  const definition = useMemo(
    () => options?.definitions.find((item) => item.code === values.definitionCode),
    [options, values.definitionCode],
  );
  function update(name: string, value: string) {
    setValues((current) => ({ ...current, [name]: value }));
    setIssue(undefined);
  }
  async function createPreview() {
    if (
      !values.definitionCode ||
      !values.productCode ||
      !values.regionLevel ||
      !values.regionCode ||
      !values.periodCode
    ) {
      setIssue("请完整选择报告参数。");
      return;
    }
    setBusy(true);
    try {
      const created = await repository.preview({
        definitionCode: values.definitionCode,
        productCode: values.productCode,
        ...(values.cultivarCode ? { cultivarCode: values.cultivarCode } : {}),
        regionLevel: values.regionLevel,
        regionCode: values.regionCode,
        periodCode: values.periodCode,
      });
      setPreview(created);
      setExportId(undefined);
    } catch {
      setIssue("未找到可采用的核定数据，无法生成预览。");
    } finally {
      setBusy(false);
    }
  }
  async function exportCsv() {
    if (!preview || !values.formatCode) return;
    setBusy(true);
    try {
      setExportId((await repository.export(preview.id, values.formatCode)).id);
    } catch {
      setIssue("导出失败：请重新生成有效预览。");
    } finally {
      setBusy(false);
    }
  }
  async function downloadExport() {
    if (!exportId) return;
    setBusy(true);
    try {
      const file = await repository.download(exportId);
      saveFile(file);
      setIssue("已开始下载正式导出文件。");
    } catch {
      setIssue("下载失败：请重新生成导出文件。");
    } finally {
      setBusy(false);
    }
  }
  async function publish() {
    if (!preview || !exportId) return;
    setBusy(true);
    try {
      await repository.publish(preview.id, exportId, preview.version);
      setIssue("报告已发布并写入审计记录。");
    } catch {
      setIssue("发布失败：导出或预览版本已变化。");
    } finally {
      setBusy(false);
    }
  }
  if (!options)
    return (
      <main className="ledger-panel list-workbench-loading">正在加载报表中心参数</main>
    );
  const select = (
    label: string,
    key: string,
    items: readonly { code: string; label: string }[],
  ) => (
    <label>
      {label}
      <select value={values[key] ?? ""} onChange={(e) => update(key, e.target.value)}>
        <option value="">请选择</option>
        {items.map((item) => (
          <option key={item.code} value={item.code}>
            {item.label}
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <main className="list-workbench">
      <header className="page-heading">
        <p>报表中心 / 预览、导出与发布</p>
        <h1>业务报告</h1>
        <span>所有参数、核定数据与输出格式均由正式后端提供。</span>
      </header>
      <section className="ledger-panel reporting-parameters">
        <div className="reporting-parameter-grid">
          {select(
            "报告定义",
            "definitionCode",
            options.definitions.map((item) => ({ code: item.code, label: item.name })),
          )}
          {select("产品", "productCode", options.products)}
          {select("具体品种", "cultivarCode", options.cultivars)}
          {select("地区层级", "regionLevel", options.regionLevels)}
          {select("地区", "regionCode", options.regions)}
          {select("期间", "periodCode", options.periods)}
          {select("输出格式", "formatCode", options.formats)}
        </div>
        {definition && (
          <p className="reporting-definition-note">
            {definition.frequencyCode} / {definition.businessDomain} /{" "}
            {definition.businessSubtype}
          </p>
        )}
        <div className="reporting-actions">
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              void createPreview();
            }}
          >
            生成核定数据预览
          </button>
        </div>
      </section>
      {issue && (
        <p className="page-alert" role="alert">
          {issue}
        </p>
      )}
      {preview && (
        <section className="ledger-panel reporting-preview">
          <header>
            <h2>{preview.title}</h2>
            <p>
              数据截止：{preview.dataCutoffLabel}；预览有效至：
              {new Date(preview.expiresAt).toLocaleString("zh-CN")}
            </p>
          </header>
          <div className="ledger-scroll">
            <table>
              <thead>
                <tr>
                  <th>指标</th>
                  <th>数值</th>
                  <th>说明</th>
                </tr>
              </thead>
              <tbody>
                {preview.lines.map((line) => (
                  <tr key={line.label}>
                    <td>{line.label}</td>
                    <td>{line.value}</td>
                    <td>{line.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {preview.sections.map((section) => (
            <article key={section.code}>
              <h3>{section.title}</h3>
              <p>{section.body}</p>
            </article>
          ))}
          <div className="reporting-actions">
            <button
              type="button"
              disabled={busy || !values.formatCode}
              onClick={() => {
                void exportCsv();
              }}
            >
              导出预览
            </button>
            <button
              type="button"
              disabled={busy || !exportId}
              onClick={() => {
                void downloadExport();
              }}
            >
              下载已生成文件
            </button>
            <button
              type="button"
              disabled={busy || !exportId}
              onClick={() => {
                void publish();
              }}
            >
              发布报告
            </button>
          </div>
        </section>
      )}
    </main>
  );
}

function saveFile(file: { filename: string; content: Blob }) {
  if (typeof URL.createObjectURL !== "function") return;
  const href = URL.createObjectURL(file.content);
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = file.filename;
  anchor.style.display = "none";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(href);
}
