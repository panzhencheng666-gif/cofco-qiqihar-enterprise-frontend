import { useEffect, useState } from "react";
import { z } from "zod";
import { beijingCalendarDay, beijingInstantLabel } from "./newsTime";

const itemSchema = z
  .object({
    sourceHost: z.string().max(253),
    title: z.string().min(1).max(500),
    url: z.url().max(2048),
    publishedAt: z.iso.datetime().nullable(),
    publishedOn: z.iso.date(),
    publicationPrecision: z.enum(["DATE", "INSTANT"]),
    reviewedAt: z.iso.datetime(),
  })
  .refine((item) => {
    const url = new URL(item.url);
    return (
      url.protocol === "https:" &&
      url.hostname === item.sourceHost &&
      !url.username &&
      !url.password &&
      (!url.port || url.port === "443") &&
      (item.publicationPrecision === "DATE"
        ? item.publishedAt === null
        : item.publishedAt !== null &&
          item.publishedOn === beijingCalendarDay(new Date(item.publishedAt)))
    );
  });
const snapshotSchema = z.object({
  state: z.enum(["DISABLED", "CONFIGURED", "EXPIRED", "UNAVAILABLE"]),
  searchState: z.enum([
    "NOT_EVALUATED",
    "NOT_RUN",
    "RUNNING",
    "CANDIDATES",
    "EMPTY",
    "DEGRADED",
    "FAILED",
  ]),
  lastSearchCompletedAt: z.iso.datetime().nullable(),
  searchReason: z.string().max(80).nullable().optional(),
  nextSearchAt: z.iso.datetime().nullable().optional(),
  pendingReviewCount: z.number().int().nonnegative().optional(),
  awaitingSourceCount: z.number().int().nonnegative().optional(),
  observedAt: z.iso.datetime(),
  items: z.array(itemSchema).max(100),
});
type Snapshot = z.infer<typeof snapshotSchema>;
const searchLabels: Record<Snapshot["searchState"], string> = {
  NOT_EVALUATED: "搜索状态未评估",
  NOT_RUN: "尚无搜索执行记录",
  RUNNING: "最近搜索已启动，结果待回写",
  CANDIDATES: "找到候选，不代表全部通过审核",
  EMPTY: "最近搜索未返回候选",
  DEGRADED: "最近搜索部分失败",
  FAILED: "最近搜索失败",
};

export function NewsDiscoveryRail() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [generation, setGeneration] = useState(0);
  useEffect(() => {
    let disposed = false;
    let active: AbortController | null = null;
    let timeout: number | undefined;
    async function refresh() {
      if (document.hidden || active) return;
      const controller = new AbortController();
      active = controller;
      setLoading(true);
      timeout = window.setTimeout(() => controller.abort(), 12_000);
      try {
        const response = await fetch("/api/v1/market-intelligence/news/discovery", {
          credentials: "same-origin",
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Discovery unavailable");
        const data = z
          .object({ data: snapshotSchema })
          .parse(await response.json()).data;
        if (data.state === "UNAVAILABLE") throw new Error("Discovery unavailable");
        if (!disposed && !controller.signal.aborted) {
          setSnapshot(data);
          setError(false);
        }
      } catch {
        if (!disposed) {
          // Do not keep links whose current admission could not be revalidated.
          setSnapshot(null);
          setError(true);
        }
      } finally {
        window.clearTimeout(timeout);
        active = null;
        if (!disposed) setLoading(false);
      }
    }
    void refresh();
    const timer = window.setInterval(() => void refresh(), 30_000);
    const onVisible = () => void refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      disposed = true;
      active?.abort();
      window.clearTimeout(timeout);
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [generation]);
  const items = snapshot?.state === "DISABLED" ? [] : (snapshot?.items ?? []);
  const budgetClosed = snapshot?.searchReason === "BUDGET_CLOSED";
  const status = error
    ? "发现接口暂不可用"
    : !snapshot
      ? "正在读取发现状态"
      : snapshot.state === "DISABLED"
        ? "公开网络发现未启用"
        : snapshot.state === "EXPIRED"
          ? "搜索授权窗口已结束 · 以下仅为仍获准展示的核验记录"
          : "发现配置已启用 · 以执行记录为准";
  return (
    <section className="mi-news-card mi-unified-news" aria-label="公开网络发现">
      <header>
        <strong>公开网络发现</strong>
        <button
          type="button"
          disabled={loading}
          onClick={() => setGeneration((value) => value + 1)}
        >
          刷新发现结果
        </button>
      </header>
      <p role="status">{status}</p>
      {snapshot && snapshot.state !== "DISABLED" && (
        <p>
          {budgetClosed
            ? "搜索额度已用尽或授权已到期，自动搜索暂停"
            : searchLabels[snapshot.searchState]}
          {snapshot.lastSearchCompletedAt
            ? ` · 上次搜索结束 ${beijingInstantLabel(snapshot.lastSearchCompletedAt)}`
            : ""}
        </p>
      )}
      {snapshot?.state === "CONFIGURED" && !budgetClosed && snapshot.nextSearchAt && (
        <p>下次搜索 {beijingInstantLabel(snapshot.nextSearchAt)}</p>
      )}
      {snapshot &&
        snapshot.state !== "DISABLED" &&
        (snapshot.pendingReviewCount ?? 0) > 0 && (
          <p>
            {snapshot.pendingReviewCount} 条新闻等待核验，其中{" "}
            {snapshot.awaitingSourceCount ?? 0} 条等待来源准入
          </p>
        )}
      <div className="mi-news-card-scroll">
        {items.map((item) => (
          <a
            key={item.url}
            className="mi-news-headline"
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            <span className="mi-news-headline-source">
              {item.sourceHost} ·{" "}
              {item.publicationPrecision === "DATE"
                ? `${item.publishedOn} · 来源仅提供日期`
                : beijingInstantLabel(item.publishedAt!)}
            </span>
            <strong>{item.title}</strong>
            <small>阅读新闻原文 ↗</small>
          </a>
        ))}
        {snapshot && snapshot.state !== "DISABLED" && !items.length && (
          <p className="mi-news-pending">当前没有可展示的核验新闻</p>
        )}
      </div>
      <footer>
        页面每30秒读取服务端结果 · 最多100条 · 不代表全网覆盖或事实真伪认证
      </footer>
    </section>
  );
}
