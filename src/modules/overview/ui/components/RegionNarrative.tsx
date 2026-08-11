import type { OverviewIndicator } from "../../domain/overview";
import type { OverviewChapter } from "../presentation/overviewNarrative";
import {
  formatIndicatorValue,
  sourceDomainLabel,
} from "../presentation/overviewNarrative";
import { useOverviewNarration } from "../hooks/useOverviewNarration";

export function RegionNarrative({
  chapters,
  periodLabel,
  productLabel,
  regionName,
  transcript,
}: {
  chapters: readonly OverviewChapter[];
  periodLabel?: string;
  productLabel: string;
  regionName?: string;
  transcript: string;
}) {
  const narration = useOverviewNarration(transcript);
  const pauseLabel = narration.state === "paused" ? "继续讲解" : "暂停讲解";
  const canPause = narration.state === "speaking" || narration.state === "paused";
  const featuredIndicators = chapters.flatMap((chapter) =>
    chapter.indicators.slice(0, 2).map((indicator) => ({ chapter, indicator })),
  );
  const railItems = buildRailItems(chapters);

  return (
    <section className="overview-narrative" aria-label="地区粮情讲解">
      <aside className="overview-region-card">
        <header className="overview-narrative-heading">
          <span className="overview-crop-emblem" aria-hidden="true">
            穗
          </span>
          <div>
            <p>{regionName ? "SELECTED REGION" : "SPATIAL BRIEFING"}</p>
            <h2>{regionName ?? "请选择地图地区"}</h2>
            <span>
              {productLabel} · {periodLabel ?? "尚未选择正式业务期间"}
            </span>
          </div>
        </header>

        <div className="overview-card-rule" aria-hidden="true" />
        <div className="overview-featured-indicators">
          {featuredIndicators.length
            ? featuredIndicators.slice(0, 5).map(({ chapter, indicator }) => (
                <div key={`${chapter.code}-${indicator.code}`}>
                  <span
                    className={`is-${chapter.code.toLowerCase()}`}
                    aria-hidden="true"
                  />
                  <p>
                    {indicator.name}
                    <small>{sourceDomainLabel(indicator.sourceDomain)}</small>
                  </p>
                  <strong>
                    {formatIndicatorValue(indicator.value)}
                    <small>{indicator.unitCode}</small>
                  </strong>
                </div>
              ))
            : chapters.map((chapter) => (
                <div key={chapter.code}>
                  <span
                    className={`is-${chapter.code.toLowerCase()}`}
                    aria-hidden="true"
                  />
                  <p>
                    {chapter.label}
                    <small>平台审核数据</small>
                  </p>
                  <strong>
                    暂无<small>核定数据</small>
                  </strong>
                </div>
              ))}
        </div>

        <div className="overview-narration-controls" aria-label="语音讲解控制">
          <button
            aria-label="开始讲解"
            disabled={narration.availability === "unsupported"}
            onClick={narration.start}
            type="button"
          >
            ▶
          </button>
          <button
            aria-label={pauseLabel}
            disabled={!canPause}
            onClick={narration.pauseOrResume}
            type="button"
          >
            Ⅱ
          </button>
          <button
            aria-label="停止讲解"
            disabled={narration.state === "idle"}
            onClick={narration.stop}
            type="button"
          >
            ■
          </button>
          <span aria-live="polite">{narrationStatus(narration)}</span>
        </div>

        <details className="overview-transcript">
          <summary>同步讲解稿</summary>
          <p>{transcript}</p>
        </details>
        <div className="overview-card-relief" aria-hidden="true" />
      </aside>

      <div className="overview-chapter-rail">
        {railItems.map((item, index) => (
          <article data-chapter={item.code} key={item.code}>
            <span className="overview-chapter-icon" aria-hidden="true">
              {railItemIcon(item.code)}
            </span>
            <header>
              <p>{item.eyebrow}</p>
              <h3>{item.label}</h3>
            </header>
            {item.indicators.length ? (
              <ul>
                {item.indicators.slice(0, 1).map((indicator) => (
                  <li key={indicator.code}>
                    <span>{indicator.name}</span>
                    <strong>
                      {formatIndicatorValue(indicator.value)}
                      <small>{indicator.unitCode}</small>
                    </strong>
                    <em>
                      {sourceDomainLabel(indicator.sourceDomain)} ·{" "}
                      {indicator.sourceCount} 条核定来源
                    </em>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="overview-chapter-empty">{item.emptyLabel}</p>
            )}
            <svg
              className="overview-sparkline"
              aria-hidden="true"
              viewBox="0 0 180 24"
              preserveAspectRatio="none"
            >
              <path d={sparklinePath(item.code)} />
              <circle cx={38 + index * 21} cy="13" r="2" />
            </svg>
          </article>
        ))}
      </div>
    </section>
  );
}

type RailCode =
  "SPATIAL" | "PRODUCTION" | "MARKET" | "LOGISTICS" | "SUPPLY" | "GOVERNANCE";

interface RailItem {
  code: RailCode;
  eyebrow: string;
  emptyLabel: string;
  indicators: readonly OverviewIndicator[];
  label: string;
}

function buildRailItems(chapters: readonly OverviewChapter[]): readonly RailItem[] {
  const production =
    chapters.find((chapter) => chapter.code === "PRODUCTION")?.indicators ?? [];
  const market =
    chapters.find((chapter) => chapter.code === "MARKET")?.indicators ?? [];
  const combinedSupply =
    chapters.find((chapter) => chapter.code === "SUPPLY")?.indicators ?? [];
  return [
    {
      code: "SPATIAL",
      eyebrow: "REGION",
      emptyLabel: "真实行政边界",
      indicators: [],
      label: "区域态势",
    },
    {
      code: "PRODUCTION",
      eyebrow: "PRODUCTION",
      emptyLabel: "暂无核定数据",
      indicators: production,
      label: "产情监测",
    },
    {
      code: "MARKET",
      eyebrow: "MARKET",
      emptyLabel: "暂无核定数据",
      indicators: market,
      label: "市场监测",
    },
    {
      code: "LOGISTICS",
      eyebrow: "LOGISTICS",
      emptyLabel: "暂无核定数据",
      indicators: combinedSupply.filter((item) => item.sourceDomain === "LOGISTICS"),
      label: "物流流向",
    },
    {
      code: "SUPPLY",
      eyebrow: "SUPPLY",
      emptyLabel: "暂无核定数据",
      indicators: combinedSupply.filter((item) => item.sourceDomain === "SUPPLY"),
      label: "供需平衡",
    },
    {
      code: "GOVERNANCE",
      eyebrow: "GOVERNANCE",
      emptyLabel: "平台审核数据",
      indicators: [],
      label: "数据治理",
    },
  ];
}

function railItemIcon(code: RailCode) {
  return {
    SPATIAL: "◉",
    PRODUCTION: "⌁",
    MARKET: "⌂",
    LOGISTICS: "▥",
    SUPPLY: "▱",
    GOVERNANCE: "◇",
  }[code];
}

function sparklinePath(code: RailCode) {
  return {
    SPATIAL: "M0 14 C20 8 32 17 50 12 S79 9 96 16 S125 17 145 10 S165 8 180 13",
    PRODUCTION: "M0 17 C18 13 26 18 42 14 S69 7 86 13 S114 18 132 11 S158 8 180 14",
    MARKET: "M0 15 C20 19 30 8 48 12 S75 18 94 10 S122 9 140 15 S162 17 180 8",
    LOGISTICS: "M0 16 C18 11 31 15 49 10 S78 19 98 13 S126 6 144 12 S164 18 180 11",
    SUPPLY: "M0 14 C17 8 32 17 51 12 S78 9 96 16 S125 18 144 10 S164 9 180 13",
    GOVERNANCE: "M0 13 C21 16 34 7 54 12 S83 18 102 11 S128 8 147 14 S165 16 180 9",
  }[code];
}

function narrationStatus(narration: ReturnType<typeof useOverviewNarration>) {
  if (narration.availability === "unsupported") {
    return "当前浏览器不支持语音播放，可阅读同步讲解稿";
  }
  return {
    idle: "讲解已就绪",
    speaking: "正在讲解",
    paused: "讲解已暂停",
    ended: "讲解已结束",
    error: "语音播放失败，可阅读同步讲解稿",
  }[narration.state];
}
