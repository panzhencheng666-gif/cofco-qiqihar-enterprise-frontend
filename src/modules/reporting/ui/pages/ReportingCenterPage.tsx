import { useEffect, useMemo, useState } from "react";
import type { ReportingRepository } from "../../application/ports/ReportingRepository";
import type { ReportParameterOptions, ReportPreview } from "../../domain/reporting";
import type { ActivityReport } from "../../domain/activityReport";
import { ActivityReportStory } from "../components/ActivityReportStory";
import { SystemActivityReport } from "../components/SystemActivityReport";

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
  const [view, setView] = useState<"BUSINESS" | "PERSONAL" | "SYSTEM">("BUSINESS");
  const [periodDays, setPeriodDays] = useState<7 | 30>(7);
  const [personalActivity, setPersonalActivity] = useState<ActivityReport>();
  const [systemActivity, setSystemActivity] = useState<ActivityReport>();
  const [activityIssue, setActivityIssue] = useState<string>();
  const [activityLoading, setActivityLoading] = useState(false);
  const [autoPlay, setAutoPlay] = useState(true);
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
  useEffect(() => {
    if (!repository.personalActivity) return;
    const controller = new AbortController();
    void Promise.resolve().then(() => {
      if (controller.signal.aborted) return;
      setActivityLoading(true);
      setActivityIssue(undefined);
      repository
        .personalActivity?.(periodDays, controller.signal)
        .then((report) => {
          if (!controller.signal.aborted) setPersonalActivity(report);
        })
        .catch(() => {
          if (!controller.signal.aborted)
            setActivityIssue("个人周期回顾加载失败，请稍后重试。");
        })
        .finally(() => {
          if (!controller.signal.aborted) setActivityLoading(false);
        });
      repository
        .systemActivity?.(periodDays, controller.signal)
        .then((report) => {
          if (!controller.signal.aborted) setSystemActivity(report);
        })
        .catch(() => {
          if (!controller.signal.aborted) {
            setSystemActivity(undefined);
            setView((current) => (current === "SYSTEM" ? "PERSONAL" : current));
          }
        });
    });
    return () => controller.abort();
  }, [periodDays, repository]);
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
  async function exportSystemReport() {
    if (!repository.exportSystemActivity || !repository.downloadSystemActivity) return;
    setBusy(true);
    try {
      const exported = await repository.exportSystemActivity(periodDays);
      saveFile(await repository.downloadSystemActivity(exported.id));
      setActivityIssue("全系统周期总结文档已生成并开始下载。");
    } catch {
      setActivityIssue("全系统周期总结生成失败，请稍后重试。");
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
      {personalActivity && (
        <nav className="reporting-view-tabs" aria-label="报表中心视图">
          <button
            type="button"
            aria-pressed={view === "BUSINESS"}
            onClick={() => setView("BUSINESS")}
          >
            业务报告
          </button>
          <button
            type="button"
            aria-pressed={view === "PERSONAL"}
            onClick={() => setView("PERSONAL")}
          >
            我的周期回顾
          </button>
          {systemActivity && (
            <button
              type="button"
              aria-pressed={view === "SYSTEM"}
              onClick={() => setView("SYSTEM")}
            >
              全系统周期总结
            </button>
          )}
        </nav>
      )}
      {view !== "BUSINESS" && personalActivity && (
        <label className="activity-report-period">
          <span>统计周期</span>
          <select
            aria-label="周期报告统计周期"
            value={periodDays}
            onChange={(event) => setPeriodDays(Number(event.target.value) as 7 | 30)}
          >
            <option value="7">最近 7 天</option>
            <option value="30">最近 30 天</option>
          </select>
        </label>
      )}
      {activityIssue && view !== "BUSINESS" && (
        <p className="page-alert" role="alert">
          {activityIssue}
        </p>
      )}
      {activityLoading && view !== "BUSINESS" && (
        <p className="page-alert" role="status">
          正在汇总周期内的实际使用痕迹
        </p>
      )}
      {view === "PERSONAL" && personalActivity && (
        <ActivityReportStory
          key={`${personalActivity.periodDays}-${personalActivity.periodStart}`}
          autoPlay={autoPlay}
          onAutoPlayChange={setAutoPlay}
          report={personalActivity}
        />
      )}
      {view === "SYSTEM" && systemActivity && (
        <SystemActivityReport
          busy={busy}
          onExport={() => void exportSystemReport()}
          report={systemActivity}
        />
      )}
      {view === "BUSINESS" && (
        <section className="ledger-panel reporting-parameters">
          <div className="reporting-parameter-grid">
            {select(
              "报告定义",
              "definitionCode",
              options.definitions.map((item) => ({
                code: item.code,
                label: item.name,
              })),
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
      )}
      {view === "BUSINESS" && issue && (
        <p className="page-alert" role="alert">
          {issue}
        </p>
      )}
      {view === "BUSINESS" && preview && (
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
