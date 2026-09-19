import { useState } from "react";

import type { OverviewRegion } from "../../domain/overview";
import type { OperationalFacilityCatalogue } from "../../domain/operationalFacilities";
import type {
  OperationalSituationCatalogue,
  WeatherObservation,
} from "../../domain/operationalSituation";
import "./operational-situation.css";
import { RailwayFacilityCard, StorageFacilityCard } from "./OperationalFacilityPanel";
import type { SituationTimelineItem } from "./operationalSituationTimeline";
import { LiveWeatherVisual } from "./LiveWeatherVisual";
import {
  liveWeatherEvidence,
  liveWeatherHeadline,
  liveWeatherKind,
} from "./liveWeatherPresentation";

export function OperationalSituationPanel({
  facilities,
  onFacilitySelect,
  selectedFacilityId,
  selectedRegion,
  selectedTimelineItem,
  onTimelineItemDismiss,
  productLabel,
  situation,
}: {
  facilities: OperationalFacilityCatalogue;
  onFacilitySelect?: (id: string) => void;
  selectedFacilityId?: string;
  selectedRegion?: OverviewRegion;
  selectedTimelineItem?: SituationTimelineItem;
  onTimelineItemDismiss?: () => void;
  productLabel?: string;
  situation: OperationalSituationCatalogue;
}) {
  const selectedStorage = facilities.storageFacilities.find(
    (facility) => facility.code === selectedFacilityId,
  );
  const selectedRailway = facilities.railwayFacilities.find(
    (facility) => facility.sourceId === selectedFacilityId,
  );
  const fallbackStorage = facilities.storageFacilities[0];
  const fallbackRailway = facilities.railwayFacilities[0];
  const [requestedDetailMode, setRequestedDetailMode] = useState<
    "WEATHER" | "STORAGE" | "RAILWAY"
  >(situation.weather.length ? "WEATHER" : fallbackStorage ? "STORAGE" : "RAILWAY");
  const detailMode = selectedStorage
    ? "STORAGE"
    : selectedRailway
      ? "RAILWAY"
      : requestedDetailMode;
  const activeStorage =
    detailMode === "STORAGE" ? (selectedStorage ?? fallbackStorage) : undefined;
  const activeRailway =
    detailMode === "RAILWAY" ? (selectedRailway ?? fallbackRailway) : undefined;
  const activeWeather = weatherForRegion(situation.weather, selectedRegion);
  return (
    <div className="operational-situation-panel">
      <header>
        <div>
          <span>PUBLIC OPERATIONAL PICTURE</span>
          <h2>公开运营态势</h2>
          <p>行政区风险详情、运营节点和真实铁路路径在同一张地图中联动。</p>
        </div>
        <time dateTime={situation.generatedAt}>
          汇总于 {formatTime(situation.generatedAt)}
        </time>
      </header>
      <div className="operational-situation-kpis">
        <article>
          <b>{facilities.storageFacilities.length}</b>
          <span>关联库点</span>
        </article>
        <article>
          <b>{facilities.railwayFacilities.length}</b>
          <span>铁路节点</span>
        </article>
        <article>
          <b>{situation.weather.length}</b>
          <span>区域天气</span>
        </article>
        <article>
          <b>{situation.publicEvents.length}</b>
          <span>全球开放事件</span>
        </article>
      </div>
      <section className="situation-node-details" aria-label="态势详情">
        <div className="situation-node-details__heading">
          <div>
            <h3>态势详情</h3>
            <p>天气随行政区层级联动；地图节点分别打开库点或铁路详情。</p>
          </div>
          <div className="situation-node-details__quick-picks">
            {activeWeather && (
              <button
                aria-pressed={detailMode === "WEATHER"}
                type="button"
                onClick={() => {
                  setRequestedDetailMode("WEATHER");
                  onFacilitySelect?.("");
                }}
              >
                天气
              </button>
            )}
            {fallbackStorage && (
              <button
                aria-pressed={detailMode === "STORAGE"}
                type="button"
                onClick={() => {
                  setRequestedDetailMode("STORAGE");
                  onFacilitySelect?.(fallbackStorage.code);
                }}
              >
                库点
              </button>
            )}
            {fallbackRailway && (
              <button
                aria-pressed={detailMode === "RAILWAY"}
                type="button"
                onClick={() => {
                  setRequestedDetailMode("RAILWAY");
                  onFacilitySelect?.(fallbackRailway.sourceId);
                }}
              >
                铁路
              </button>
            )}
          </div>
        </div>
        {selectedTimelineItem && (
          <SituationEvidenceCard
            item={selectedTimelineItem}
            {...(onTimelineItemDismiss ? { onDismiss: onTimelineItemDismiss } : {})}
            {...(onFacilitySelect ? { onFacilitySelect } : {})}
          />
        )}
        {detailMode === "WEATHER" && activeWeather && (
          <WeatherDetail
            generatedAt={situation.generatedAt}
            {...(productLabel ? { productLabel } : {})}
            weather={activeWeather}
            {...(selectedRegion ? { selectedRegion } : {})}
          />
        )}
        {activeStorage && <StorageFacilityCard facility={activeStorage} />}
        {activeRailway && (
          <RailwayFacilityCard catalogue={facilities} facility={activeRailway} />
        )}
        {detailMode !== "WEATHER" && !activeStorage && !activeRailway && (
          <p>当前范围没有可展示的运营节点。</p>
        )}
      </section>
      <details className="situation-source-catalogue">
        <summary>来源目录（{situation.sources.length}）</summary>
        <section className="situation-source-grid" aria-label="公开态势来源状态">
          {situation.sources.map((source) => (
            <article key={source.code}>
              <div>
                <b>{source.label}</b>
                <span
                  className={`situation-source-status is-${source.status.toLowerCase()}`}
                >
                  {source.status === "READY"
                    ? "来源可用"
                    : source.status === "STALE"
                      ? "使用保留快照"
                      : "来源不可用"}
                </span>
              </div>
              <p>{source.notice}</p>
              <a href={source.sourceUrl} target="_blank" rel="noreferrer">
                查看来源
              </a>
            </article>
          ))}
        </section>
      </details>
      <section className="situation-event-list">
        <h3>NASA EONET 开放事件</h3>
        <p>
          地图仅标出当前行政范围内的事件；列表保留最新全球开放事件作为外部风险参照。
        </p>
        {situation.publicEvents.length ? (
          <ol>
            {situation.publicEvents.slice(0, 8).map((event) => (
              <li key={event.eventId}>
                <span>{event.categoryLabel}</span>
                <b>{event.title}</b>
                <small>
                  {formatTime(event.observedAt)}
                  {event.magnitudeValue === null
                    ? ""
                    : ` · ${event.magnitudeValue.toLocaleString("zh-CN")} ${event.magnitudeUnit ?? ""}`}
                </small>
                <a href={event.eventUrl} target="_blank" rel="noreferrer">
                  事件详情
                </a>
              </li>
            ))}
          </ol>
        ) : (
          <p>最近 30 天没有成功保存的开放事件；系统不会补造事件。</p>
        )}
      </section>
    </div>
  );
}

function SituationEvidenceCard({
  item,
  onDismiss,
  onFacilitySelect,
}: {
  item: SituationTimelineItem;
  onDismiss?: () => void;
  onFacilitySelect?: (id: string) => void;
}) {
  return (
    <article className="situation-evidence-card" aria-label="选中态势事件详情">
      <header>
        <div>
          <span>{timelineCategoryLabel(item.category)}</span>
          <h3>{item.title}</h3>
        </div>
        {onDismiss && (
          <button type="button" aria-label="关闭态势事件详情" onClick={onDismiss}>
            ×
          </button>
        )}
      </header>
      <dl>
        <div>
          <dt>发生时间</dt>
          <dd>{formatTime(item.occurredAt)}</dd>
        </div>
        <div>
          <dt>来源类型</dt>
          <dd>{item.sourceName}</dd>
        </div>
      </dl>
      <section>
        <h4>事件与证据说明</h4>
        <p>{item.description}</p>
      </section>
      <footer>
        <a href={item.sourceUrl} target="_blank" rel="noreferrer">
          查看原始来源
        </a>
        {item.facilityId && onFacilitySelect && (
          <button type="button" onClick={() => onFacilitySelect(item.facilityId!)}>
            进入业务明细
          </button>
        )}
      </footer>
    </article>
  );
}

function timelineCategoryLabel(category: SituationTimelineItem["category"]) {
  if (category === "WEATHER") return "实时天气";
  if (category === "LOGISTICS") return "物流态势";
  if (category === "MARKET") return "市场信号";
  if (category === "POLICY") return "政策事件";
  return "公开事件";
}

function WeatherDetail({
  generatedAt,
  productLabel,
  weather,
  selectedRegion,
}: {
  generatedAt: string;
  productLabel?: string;
  weather: WeatherObservation;
  selectedRegion?: OverviewRegion;
}) {
  const areaName = selectedRegion?.name ?? weather.regionName;
  const inherited = Boolean(
    selectedRegion &&
      (weather.observationPrecision === "INHERITED_TOWNSHIP" ||
        selectedRegion.code !== (weather.regionCode || weather.rootRegionCode)),
  );
  const kind = liveWeatherKind(weather).toLowerCase();
  return (
    <article
      className={`situation-weather-detail is-${kind}`}
      aria-label={`${areaName}天气详情`}
    >
      <header>
        <div>
          <span>实时天气</span>
          <h3>{liveWeatherHeadline(areaName, weather)}</h3>
        </div>
        <strong>{kind === "clear" ? "正常" : "需关注"}</strong>
      </header>
      <LiveWeatherVisual weather={weather} />
      <dl>
        <div>
          <dt>观测时间</dt>
          <dd>{formatTime(weather.observedAt)}</dd>
        </div>
        <div>
          <dt>影响品种</dt>
          <dd>{productLabel ?? "当前筛选品种"}</dd>
        </div>
        <div>
          <dt>证据链</dt>
          <dd>{liveWeatherEvidence(weather)}</dd>
        </div>
      </dl>
      <section className="situation-weather-detail__metrics" aria-label="实时气象指标">
        <span>气温 <b>{number(weather.meanTemperatureC, "℃")}</b></span>
        <span>降水 <b>{number(weather.precipitationMm, "毫米")}</b></span>
        <span>土壤墒情 <b>{number(weather.soilMoisturePercent, "%")}</b></span>
      </section>
      <section className="situation-weather-detail__description">
        <h4>事件描述</h4>
        <p><b>{weather.risk}</b></p>
        <p>{weather.assessment}</p>
        {inherited && (
          <small>
            当前沿用所属{weather.regionName}公开观测；系统取得乡镇观测后会自动替换。
          </small>
        )}
      </section>
      <footer>
        <span>最近同步 {formatTime(weather.fetchedAt)}（{freshness(weather.fetchedAt, generatedAt)}）</span>
        <a href={weather.sourceUrl} target="_blank" rel="noreferrer">
          来源：{weather.sourceName}
        </a>
      </footer>
    </article>
  );
}

function weatherForRegion(
  weather: readonly WeatherObservation[],
  region?: OverviewRegion,
) {
  if (!region) return weather[0];
  return (
    weather.find(({ regionCode }) => region.code === regionCode) ??
    weather.find(({ rootRegionCode }) => region.code === rootRegionCode) ??
    weather.find(({ rootRegionCode }) =>
      region.code.startsWith(rootRegionCode.slice(0, 4)),
    ) ??
    weather[0]
  );
}

function number(value: number | null, unit: string) {
  return value === null ? "尚无数据" : `${value.toLocaleString("zh-CN")} ${unit}`;
}

function formatTime(value: string) {
  return new Date(value).toLocaleString("zh-CN", { hour12: false });
}

function freshness(fetchedAt: string, generatedAt: string) {
  const elapsed = Math.max(0, Date.parse(generatedAt) - Date.parse(fetchedAt));
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 1) return "刚刚同步";
  if (minutes < 60) return `${minutes}分钟前`;
  return `${Math.floor(minutes / 60)}小时前`;
}
