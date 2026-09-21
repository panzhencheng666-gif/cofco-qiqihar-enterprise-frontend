import { useEffect, useMemo, useState } from "react";

import type { ActivityReport } from "../../domain/activityReport";
import "./activity-report.css";

interface StorySlide {
  eyebrow: string;
  title: string;
  value: string;
  description: string;
  accents: readonly { label: string; value: number }[];
}

export function ActivityReportStory({
  autoPlay,
  onAutoPlayChange,
  report,
}: {
  autoPlay: boolean;
  onAutoPlayChange: (value: boolean) => void;
  report: ActivityReport;
}) {
  const [index, setIndex] = useState(0);
  const [manualAnnouncement, setManualAnnouncement] = useState("");
  const reducedMotion = useReducedMotion();
  const slides = useMemo(() => storySlides(report), [report]);
  const active = slides[index] ?? slides[0]!;

  useEffect(() => {
    if (!autoPlay || reducedMotion) return;
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % slides.length);
    }, 6_000);
    return () => window.clearInterval(timer);
  }, [autoPlay, reducedMotion, slides.length]);

  function navigate(next: number) {
    const normalized = (next + slides.length) % slides.length;
    setIndex(normalized);
    setManualAnnouncement(
      `第 ${normalized + 1} 页：${slides[normalized]?.title ?? ""}`,
    );
  }

  return (
    <section className="activity-story" aria-label="个人周期动画回顾">
      <div className="activity-story__stage" data-slide={index + 1}>
        <div className="activity-story__ambient" aria-hidden="true" />
        <article>
          <span>{active.eyebrow}</span>
          <h2>{active.title}</h2>
          <strong>{active.value}</strong>
          <p>{active.description}</p>
          <div className="activity-story__accents">
            {active.accents.map((item) => (
              <div key={item.label}>
                <b>{item.value.toLocaleString("zh-CN")}</b>
                <small>{item.label}</small>
              </div>
            ))}
          </div>
        </article>
        <footer>
          <div className="activity-story__progress" aria-label="回顾进度">
            {slides.map((slide, slideIndex) => (
              <button
                aria-label={`查看第 ${slideIndex + 1} 页：${slide.title}`}
                aria-pressed={slideIndex === index}
                key={slide.title}
                type="button"
                onClick={() => navigate(slideIndex)}
              />
            ))}
          </div>
          <div className="activity-story__controls">
            <button type="button" onClick={() => navigate(index - 1)}>
              上一页
            </button>
            <button
              type="button"
              aria-pressed={autoPlay && !reducedMotion}
              onClick={() => onAutoPlayChange(!autoPlay)}
            >
              {autoPlay && !reducedMotion ? "暂停" : "播放"}
            </button>
            <button type="button" onClick={() => navigate(index + 1)}>
              下一页
            </button>
          </div>
        </footer>
      </div>
      {reducedMotion && (
        <p className="activity-story__motion-note">
          系统已按您的减少动态效果设置关闭自动播放。
        </p>
      )}
      <p className="activity-story__period">
        {formatTime(report.periodStart)} 至 {formatTime(report.periodEnd)} · 事件截点{" "}
        {formatTime(report.eventCutoff)}
      </p>
      <p className="overview-sr-only" aria-live="polite">
        {manualAnnouncement}
      </p>
    </section>
  );
}

function storySlides(report: ActivityReport): readonly StorySlide[] {
  const action = (code: string) =>
    report.actions.find((item) => item.code === code)?.count ?? 0;
  const topDomains = report.domains
    .slice(0, 3)
    .map((item) => ({ label: item.label, value: item.count }));
  return [
    {
      eyebrow: `${report.periodDays} 天工作回顾`,
      title: report.subject
        ? `${report.subject.displayName}，这是您的周期足迹`
        : "周期足迹",
      value: report.totalEvents.toLocaleString("zh-CN"),
      description: `${report.subject?.workUnitName ?? "当前单位"}在本周期内由不可变审计记录确认的操作留痕。`,
      accents: [{ label: "可追溯操作", value: report.totalEvents }],
    },
    {
      eyebrow: "业务贡献",
      title: "您的工作覆盖这些业务领域",
      value: report.domains.length.toLocaleString("zh-CN"),
      description: "领域数量和每项次数均来自周期内的实际审计事件。",
      accents: topDomains,
    },
    {
      eyebrow: "样本网络",
      title: "样本点变化清晰可查",
      value: (report.samplePointsCreated - report.samplePointsDeleted).toLocaleString(
        "zh-CN",
      ),
      description: "净变化仅用于回顾展示；新增与删除仍分别保留，不会互相抵消审计记录。",
      accents: [
        { label: "新增样本点", value: report.samplePointsCreated },
        { label: "删除或退出使用", value: report.samplePointsDeleted },
      ],
    },
    {
      eyebrow: "业务流程",
      title: "提交、退回与审核形成闭环",
      value: action("SUBMITTED").toLocaleString("zh-CN"),
      description: "这里呈现周期内真实发生的流程动作，没有发生的项目显示为零。",
      accents: [
        { label: "提交", value: action("SUBMITTED") },
        { label: "退回", value: action("RETURNED") },
        { label: "审核通过", value: action("APPROVED") },
      ],
    },
    {
      eyebrow: "数据质量",
      title: "每一次维护都留下依据",
      value: action("UPDATED").toLocaleString("zh-CN"),
      description: "修改、导入与删除分别统计，便于回看本周期的数据维护重点。",
      accents: [
        { label: "修改", value: action("UPDATED") },
        { label: "导入", value: action("IMPORTED") },
        { label: "删除", value: action("DELETED") },
      ],
    },
    {
      eyebrow: "可追溯性",
      title: "报告可回到同一个事件截点",
      value: formatTime(report.eventCutoff),
      description: report.scopeNotice,
      accents: [
        { label: "导出", value: action("EXPORTED") },
        { label: "地图标注", value: action("ANNOTATED") },
      ],
    },
  ];
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const query = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!query) return;
    const update = () => setReduced(query.matches);
    query.addEventListener?.("change", update);
    return () => query.removeEventListener?.("change", update);
  }, []);
  return reduced;
}

function formatTime(value: string) {
  return new Date(value).toLocaleString("zh-CN", { hour12: false });
}
