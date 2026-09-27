import { useEffect, useState } from "react";
import { z } from "zod";

const snapshotSchema = z.object({
  status: z.string(),
  sourceDate: z.string().nullable(),
  fetchedAt: z.string().nullable(),
  lastAttemptAt: z.string().nullable(),
  sourceName: z.string(),
  sourceUrl: z.string().url(),
  attribution: z.string(),
  market: z.string(),
  unit: z.string(),
  observations: z.array(
    z.object({
      crop: z.string(),
      name: z.string(),
      arsPerTonne: z.number(),
    }),
  ),
  lastError: z.string().nullable(),
});

type SpotSnapshot = z.infer<typeof snapshotSchema>;
const format = new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 2 });

export async function loadRosarioSpot(signal?: AbortSignal): Promise<SpotSnapshot> {
  const response = await fetch("/api/v1/market-intelligence/rosario-spot/overview", {
    credentials: "same-origin",
    cache: "no-store",
    signal: signal ?? null,
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return z.object({ data: snapshotSchema }).parse(await response.json()).data;
}

export function RosarioSpotRail() {
  const [snapshot, setSnapshot] = useState<SpotSnapshot | null>(null);
  const [requestFailed, setRequestFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    async function refresh() {
      if (document.hidden) return;
      try {
        setSnapshot(await loadRosarioSpot(controller.signal));
        setRequestFailed(false);
      } catch {
        if (!controller.signal.aborted) setRequestFailed(true);
      }
    }
    void refresh();
    const timer = window.setInterval(() => void refresh(), 60_000);
    const onVisible = () => void refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      controller.abort();
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const unavailable = requestFailed || snapshot?.status === "SOURCE_UNAVAILABLE";
  return (
    <section className="mi-rosario-rail" aria-label="罗萨里奥现货参考价">
      <header>
        <strong>罗萨里奥谷物现货参考价</strong>
        <span>{unavailable ? "来源暂不可用" : "按来源发布"}</span>
      </header>
      <div className="mi-rosario-labels">
        <span>品种</span>
        <span>ARS/吨</span>
      </div>
      {snapshot?.observations.map((item) => (
        <div className="mi-rosario-row" key={item.crop}>
          <span>{item.name}</span>
          <b>{format.format(item.arsPerTonne)}</b>
        </div>
      ))}
      {!snapshot?.observations.length && (
        <p className="mi-news-pending">
          {unavailable ? "现货数据暂不可读取" : "等待来源首次同步"}
        </p>
      )}
      <footer>
        来源日期 {snapshot?.sourceDate ?? "待确认"} ·{" "}
        {unavailable ? "所示为上次成功读取" : "现货参考价"}
        <br />
        非交易所实时期货行情 · 来源：
        <a href="https://granos.ar/" target="_blank" rel="noreferrer">
          granos.ar
        </a>
        /CAC-BCR
      </footer>
    </section>
  );
}
