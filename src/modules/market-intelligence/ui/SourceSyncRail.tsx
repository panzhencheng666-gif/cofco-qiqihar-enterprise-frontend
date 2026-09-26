import { useEffect, useState } from "react";
import { z } from "zod";

const sourceSchema = z.object({
  code: z.string(),
  name: z.string(),
  cadence: z.string(),
  lastAttemptAt: z.string().nullable(),
  lastSuccessAt: z.string().nullable(),
  latestPublishedOn: z.string().nullable(),
  lastError: z.string().nullable(),
});

type SourceStatus = z.infer<typeof sourceSchema>;

export async function loadSourceStatus(signal?: AbortSignal): Promise<SourceStatus[]> {
  const response = await fetch("/api/v1/market-intelligence/sources/status", {
    credentials: "same-origin",
    cache: "no-store",
    signal: signal ?? null,
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return z.object({ data: z.array(sourceSchema) }).parse(await response.json()).data;
}

function sourceState(source: SourceStatus) {
  if (source.lastError) return { label: "最近采集失败", state: "error" };
  if (!source.lastSuccessAt) return { label: "等待首轮同步", state: "pending" };
  const elapsed = Date.now() - Date.parse(source.lastSuccessAt);
  const limit =
    source.code === "world-bank-pink-sheet"
      ? 48 * 60 * 60 * 1000
      : source.code === "fao-food-price-index"
        ? 24 * 60 * 60 * 1000
        : source.code === "moa-public-monitor"
          ? 12 * 60 * 60 * 1000
          : 30 * 60 * 1000;
  if (elapsed > limit) return { label: "采集延迟", state: "late" };
  return { label: "最近同步成功", state: "ok" };
}

export function SourceSyncRail() {
  const [sources, setSources] = useState<SourceStatus[]>([]);
  const [apiError, setApiError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    async function refresh() {
      if (document.hidden) return;
      try {
        setSources(await loadSourceStatus(controller.signal));
        setApiError(false);
      } catch {
        if (!controller.signal.aborted) setApiError(true);
      }
    }
    void refresh();
    const timer = window.setInterval(() => void refresh(), 30_000);
    const onVisible = () => {
      void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      controller.abort();
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return (
    <section className="mi-source-sync" aria-label="自动采集来源状态">
      <header>
        <strong>自动采集状态</strong>
        <span>
          {apiError
            ? "状态接口暂不可用"
            : `${sources.filter((item) => sourceState(item).state === "ok").length}/${sources.length || 5} 路近期成功`}
        </span>
      </header>
      <div className="mi-source-sync-scroll">
        {sources.map((source) => {
          const status = sourceState(source);
          return (
            <div key={source.code} className="mi-source-sync-row">
              <div>
                <strong>{source.name}</strong>
                <small>{source.cadence}</small>
              </div>
              <div className={`mi-source-sync-state ${status.state}`}>
                <b>{status.label}</b>
                <small>
                  {source.latestPublishedOn
                    ? `源发布日期 ${source.latestPublishedOn}`
                    : "源发布日期待接入"}
                </small>
              </div>
            </div>
          );
        })}
        {!sources.length && (
          <p className="mi-news-pending">
            {apiError ? "采集状态暂不可读取" : "正在读取服务端采集状态"}
          </p>
        )}
      </div>
      <footer>
        服务端定时采集 · 页面每 30 秒检查更新 · 来源发布频率不等于实时行情
      </footer>
    </section>
  );
}
