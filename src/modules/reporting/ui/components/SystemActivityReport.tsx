import type { ActivityReport } from "../../domain/activityReport";

export function SystemActivityReport({
  busy,
  onExport,
  report,
}: {
  busy: boolean;
  onExport: () => void;
  report: ActivityReport;
}) {
  return (
    <section className="system-activity-report" aria-label="全系统周期总结">
      <header>
        <div>
          <span>全系统 · 最近 {report.periodDays} 天</span>
          <h2>有效用户使用总结</h2>
          <p>{report.scopeNotice}</p>
        </div>
        <button type="button" disabled={busy} onClick={onExport}>
          生成并下载 DOCX
        </button>
      </header>
      <div className="system-activity-report__hero">
        <article>
          <span>有效用户</span>
          <b>{report.effectiveUserCount}</b>
          <small>人</small>
        </article>
        <article>
          <span>操作留痕</span>
          <b>{report.totalEvents}</b>
          <small>条</small>
        </article>
        <article>
          <span>新增样本点</span>
          <b>{report.samplePointsCreated}</b>
          <small>个</small>
        </article>
        <article>
          <span>删除或退出使用</span>
          <b>{report.samplePointsDeleted}</b>
          <small>个</small>
        </article>
      </div>
      <div className="system-activity-report__grids">
        <CountSection title="操作类型" values={report.actions} showZero />
        <CountSection title="业务领域" values={report.domains} />
        <CountSection title="维护单位" values={report.workUnits} />
      </div>
      <footer>
        事件截点：
        {new Date(report.eventCutoff).toLocaleString("zh-CN", { hour12: false })}
      </footer>
    </section>
  );
}

function CountSection({
  showZero = false,
  title,
  values,
}: {
  showZero?: boolean;
  title: string;
  values: ActivityReport["actions"];
}) {
  const visible = showZero ? values : values.filter((value) => value.count > 0);
  return (
    <section>
      <h3>{title}</h3>
      <ol>
        {visible.length ? (
          visible.map((value) => (
            <li key={value.code}>
              <span>{value.label}</span>
              <b>{value.count.toLocaleString("zh-CN")}</b>
            </li>
          ))
        ) : (
          <li>
            <span>本周期无记录</span>
            <b>0</b>
          </li>
        )}
      </ol>
    </section>
  );
}
