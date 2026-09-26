import { useEffect, useState } from "react";
import { loadSourceStatus } from "./SourceSyncRail";

type Source = Awaited<ReturnType<typeof loadSourceStatus>>[number];

export function AnalysisCollectorStrip({ sourceCode }: { sourceCode: string | null }) {
  const [sources, setSources] = useState<Source[]>([]);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    async function refresh() {
      if (document.hidden) return;
      try {
        setSources(await loadSourceStatus(controller.signal));
        setUnavailable(false);
      } catch {
        if (!controller.signal.aborted) setUnavailable(true);
      }
    }
    void refresh();
    const timer = window.setInterval(() => void refresh(), 30_000);
    const onVisible = () => void refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      controller.abort();
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return (
    <div className="mi-analysis-collector" aria-label="服务端采集通道状态">
      <div className="mi-analysis-collector-title">
        <strong>来源监视</strong>
        <span>
          {unavailable ? "状态接口不可用" : "服务端自动采集 · 页面 30 秒核对"}
        </span>
      </div>
      {sources.map((source) => (
        <div
          key={source.code}
          className={`mi-analysis-collector-source${source.code === sourceCode ? " selected" : ""}`}
        >
          <strong>{source.name}</strong>
          <span>
            {source.lastError
              ? "最近采集失败"
              : source.lastSuccessAt
                ? `源发布 ${source.latestPublishedOn ?? "日期未明"}`
                : "等待首轮同步"}
          </span>
        </div>
      ))}
      {!sources.length && !unavailable && (
        <span className="mi-analysis-collector-loading">读取采集状态…</span>
      )}
      {!sourceCode && (
        <span className="mi-analysis-collector-pending">当前指标来源待接入</span>
      )}
    </div>
  );
}
