import { useEffect, useState } from "react";
import { z } from "zod";
import type { AnalysisTopic } from "./metricCatalog";
import { metricCatalog } from "./metricCatalog";
import { seriesCodes, snapshotSchema, type Snapshot } from "./WorldBankMonthlyPanel";

const format = new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 2 });

export function WorldBankMonthlyRail({
  onSelect,
  source = "world-bank",
}: {
  onSelect: (topic: AnalysisTopic) => void;
  source?: "world-bank" | "fao-food-price";
}) {
  const fao = source === "fao-food-price";
  const codes = fao
    ? ["food", "meat", "dairy", "cereals", "oils", "sugar"]
    : seriesCodes;
  const [rows, setRows] = useState<Snapshot[]>([]);
  const [error, setError] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    async function refresh() {
      try {
        const response = await fetch(`/api/v1/market-intelligence/${source}/overview`, {
          credentials: "same-origin",
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const body = z
          .object({ data: z.array(snapshotSchema) })
          .parse(await response.json());
        setRows(body.data);
        setError(false);
      } catch {
        if (!controller.signal.aborted) setError(true);
      }
    }
    void refresh();
    const timer = window.setInterval(() => void refresh(), 15 * 60 * 1000);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [source]);

  const topics = metricCatalog.filter((item) =>
    item.id.startsWith(fao ? "fao-food-price-" : "world-bank-monthly-"),
  );
  return (
    <section
      className="mi-wb-rail"
      aria-label={fao ? "FAO 食品价格月度指数" : "世界银行国际基准月度价格"}
    >
      <header>
        <strong>{fao ? "FAO 食品价格指数" : "国际基准月度价格"}</strong>
        <span>
          {error ? "接口暂不可用" : fao ? "联合国粮农组织 · 月度" : "世界银行 · 月度"}
        </span>
      </header>
      <div className="mi-wb-rail-labels">
        <span>序列</span>
        <span>最新</span>
        <span>环比</span>
      </div>
      {topics.map((topic, index) => {
        const row = rows.find((item) => item.series === codes[index]);
        return (
          <button type="button" key={topic.id} onClick={() => onSelect(topic)}>
            <span>{topic.title}</span>
            <b>
              {row?.latest === null || row?.latest === undefined
                ? "--"
                : format.format(row.latest)}
            </b>
            <em className={(row?.monthChangePct ?? 0) >= 0 ? "up" : "down"}>
              {row?.monthChangePct === null || row?.monthChangePct === undefined
                ? "--"
                : `${row.monthChangePct > 0 ? "+" : ""}${format.format(row.monthChangePct)}%`}
            </em>
          </button>
        );
      })}
      <footer>
        最新统计月 {rows[0]?.latestPeriod?.slice(0, 7) ?? "待接入"} ·
        点击进入独立分析界面
      </footer>
    </section>
  );
}
