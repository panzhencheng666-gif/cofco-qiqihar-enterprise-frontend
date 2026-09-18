import { useState } from "react";

import type { OverviewRegion } from "../../domain/overview";
import type { OperationalFacilityCatalogue } from "../../domain/operationalFacilities";
import type {
  OperationalSituationCatalogue,
  WeatherObservation,
} from "../../domain/operationalSituation";
import "./operational-situation.css";
import { RailwayFacilityCard, StorageFacilityCard } from "./OperationalFacilityPanel";

export function OperationalSituationPanel({
  facilities,
  onFacilitySelect,
  selectedFacilityId,
  selectedRegion,
  situation,
}: {
  facilities: OperationalFacilityCatalogue;
  onFacilitySelect?: (id: string) => void;
  selectedFacilityId?: string;
  selectedRegion?: OverviewRegion;
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
        {detailMode === "WEATHER" && activeWeather && (
          <WeatherDetail
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

function WeatherDetail({
  weather,
  selectedRegion,
}: {
  weather: WeatherObservation;
  selectedRegion?: OverviewRegion;
}) {
  const areaName = selectedRegion?.name ?? weather.regionName;
  const inherited = selectedRegion && selectedRegion.code !== weather.rootRegionCode;
  return (
    <article className="situation-weather-detail" aria-label={`${areaName}天气详情`}>
      <header>
        <div>
          <h3>{areaName}天气与风险</h3>
          <p>
            {inherited
              ? `所属${weather.regionName}代表性公开观测，不等同于${areaName}本地站点实测。`
              : "公开多模型区域代表观测，不等同于业务站点实测。"}
          </p>
        </div>
        <strong>{weather.risk}</strong>
      </header>
      <dl>
        <div>
          <dt>气温</dt>
          <dd>{number(weather.meanTemperatureC, "℃")}</dd>
        </div>
        <div>
          <dt>降水</dt>
          <dd>{number(weather.precipitationMm, "毫米")}</dd>
        </div>
        <div>
          <dt>土壤含水率</dt>
          <dd>{number(weather.soilMoisturePercent, "%")}</dd>
        </div>
      </dl>
      <section>
        <h4>事件说明</h4>
        <p>{weather.assessment}</p>
      </section>
      <footer>
        <span>观测时间 {formatTime(weather.observedAt)}</span>
        <a href={weather.sourceUrl} target="_blank" rel="noreferrer">
          {weather.sourceName} 原始来源
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
