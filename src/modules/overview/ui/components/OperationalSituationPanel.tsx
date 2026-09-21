import { useState } from "react";

import type { OverviewRegion } from "../../domain/overview";
import type {
  OperationalFacilityCatalogue,
  StorageFacility,
  StorageFacilityDraft,
} from "../../domain/operationalFacilities";
import type {
  OperationalSituationCatalogue,
  WeatherObservation,
} from "../../domain/operationalSituation";
import "./operational-situation.css";
import { OperationalFacilityPanel } from "./OperationalFacilityPanel";
import type { SituationTimelineItem } from "./operationalSituationTimeline";
import { RealisticWeatherScene } from "./RealisticWeatherScene";
import { StorageFacilityEditor } from "./StorageFacilityEditor";
import {
  liveWeatherEvidence,
  liveWeatherHeadline,
  liveWeatherKind,
} from "./liveWeatherPresentation";

type DetailMode = "WEATHER" | "STORAGE" | "RAILWAY" | "LOGISTICS";

export function OperationalSituationPanel({
  facilities,
  onFacilitySelect,
  selectedFacilityId,
  selectedRegion,
  selectedTimelineItem,
  onTimelineItemDismiss,
  productLabel,
  situation,
  onFacilitySave,
  onFacilityArchive,
}: {
  facilities: OperationalFacilityCatalogue;
  onFacilitySelect?: (id: string) => void;
  selectedFacilityId?: string;
  selectedRegion?: OverviewRegion;
  selectedTimelineItem?: SituationTimelineItem;
  onTimelineItemDismiss?: () => void;
  productLabel?: string;
  situation: OperationalSituationCatalogue;
  onFacilitySave?: (
    draft: StorageFacilityDraft,
    facilityCode?: string,
  ) => Promise<void>;
  onFacilityArchive?: (facility: StorageFacility) => Promise<void>;
}) {
  const selectedStorage = facilities.storageFacilities.find(
    (facility) => facility.code === selectedFacilityId,
  );
  const selectedRailway = facilities.railwayFacilities.find(
    (facility) => facility.sourceId === selectedFacilityId,
  );
  const fallbackStorage = facilities.storageFacilities[0];
  const fallbackRailway = facilities.railwayFacilities[0];
  const activeWeather =
    selectedTimelineItem?.weatherObservation ??
    weatherForRegion(situation.weather, selectedRegion);
  const [requestedMode, setRequestedMode] = useState<DetailMode>(
    activeWeather ? "WEATHER" : fallbackStorage ? "STORAGE" : "RAILWAY",
  );
  const [facilityEditor, setFacilityEditor] = useState<"CREATE" | "EDIT">();
  const detailMode: DetailMode =
    selectedTimelineItem?.category === "WEATHER"
      ? "WEATHER"
      : selectedStorage
        ? "STORAGE"
        : selectedRailway
          ? "RAILWAY"
          : requestedMode;
  const activeStorage =
    detailMode === "STORAGE" ? (selectedStorage ?? fallbackStorage) : undefined;
  const railwayWithinCount = facilities.railwayFacilities.filter(
    (facility) => facility.locationRelation === "WITHIN",
  ).length;
  const areaName = selectedRegion?.name ?? activeWeather?.regionName ?? "四区域总览";

  function selectMode(mode: DetailMode) {
    setRequestedMode(mode);
    setFacilityEditor(undefined);
    if (mode === "STORAGE" && fallbackStorage) {
      onFacilitySelect?.(fallbackStorage.code);
      return;
    }
    if (mode === "RAILWAY" && fallbackRailway) {
      onFacilitySelect?.(fallbackRailway.sourceId);
      return;
    }
    onFacilitySelect?.("");
  }

  return (
    <aside className="operational-situation-panel" aria-label={`${areaName}态势详情`}>
      <header className="situation-inspector-heading">
        <div>
          <span>实时区域档案</span>
          <h2>{areaName}</h2>
          <p>
            {selectedRegion ? levelLabel(selectedRegion.level) : "四区域联合监测范围"}
            {productLabel ? ` · ${productLabel}` : ""}
          </p>
        </div>
        <div className="situation-inspector-heading__time">
          <i aria-hidden="true" />
          <time dateTime={situation.generatedAt}>
            {formatTime(situation.generatedAt)}
          </time>
        </div>
      </header>

      <nav className="situation-inspector-tabs" aria-label="态势详情分类">
        {(["WEATHER", "STORAGE", "RAILWAY", "LOGISTICS"] as const).map((mode) => (
          <button
            aria-pressed={detailMode === mode}
            key={mode}
            type="button"
            onClick={() => selectMode(mode)}
          >
            {mode === "WEATHER"
              ? "天气"
              : mode === "STORAGE"
                ? `库点 ${facilities.storageFacilities.length}`
                : mode === "RAILWAY"
                  ? `铁路 ${railwayWithinCount}`
                  : "物流"}
          </button>
        ))}
        {onFacilitySave && (
          <button
            className="is-primary-action"
            type="button"
            onClick={() => setFacilityEditor("CREATE")}
          >
            库点填报
          </button>
        )}
      </nav>

      {facilityEditor && onFacilitySave && (
        <StorageFacilityEditor
          key={facilityEditor === "EDIT" ? activeStorage?.code : "new-facility"}
          {...(facilityEditor === "EDIT" && activeStorage
            ? { facility: activeStorage }
            : {})}
          {...(selectedRegion ? { selectedRegion } : {})}
          onCancel={() => setFacilityEditor(undefined)}
          onSave={onFacilitySave}
          {...(onFacilityArchive ? { onArchive: onFacilityArchive } : {})}
        />
      )}

      {selectedTimelineItem && (
        <SituationEvidenceCard
          item={selectedTimelineItem}
          {...(onTimelineItemDismiss ? { onDismiss: onTimelineItemDismiss } : {})}
          {...(onFacilitySelect ? { onFacilitySelect } : {})}
        />
      )}

      {detailMode === "WEATHER" && activeWeather && (
        <WeatherDetail
          areaName={areaName}
          generatedAt={situation.generatedAt}
          {...(productLabel ? { productLabel } : {})}
          weather={activeWeather}
          {...(selectedRegion ? { selectedRegion } : {})}
        />
      )}
      {detailMode === "WEATHER" && !activeWeather && (
        <EmptyDetail title="暂无实时天气">
          当前范围尚未取得有效观测，系统将在下一次同步后自动更新。
        </EmptyDetail>
      )}

      {detailMode === "STORAGE" && (
        <section className="situation-inspector-section" aria-label="库点详情与清单">
          <OperationalFacilityPanel
            catalogue={facilities}
            mode="STORAGE_FACILITIES"
            onSelect={(id) => onFacilitySelect?.(id)}
            {...(selectedFacilityId ? { selectedId: selectedFacilityId } : {})}
          />
          {onFacilitySave && (
            <button
              className="storage-facility-edit-trigger"
              type="button"
              onClick={() => setFacilityEditor("EDIT")}
            >
              维护此库点
            </button>
          )}
        </section>
      )}

      {detailMode === "RAILWAY" && (
        <section className="situation-inspector-section" aria-label="铁路详情与清单">
          <OperationalFacilityPanel
            catalogue={facilities}
            mode="RAILWAY_FACILITIES"
            onSelect={(id) => onFacilitySelect?.(id)}
            {...(selectedFacilityId ? { selectedId: selectedFacilityId } : {})}
          />
        </section>
      )}

      {detailMode === "LOGISTICS" && <LogisticsDetail situation={situation} />}

      <details className="situation-source-catalogue">
        <summary>数据来源与同步状态</summary>
        <ul>
          {situation.sources.map((source) => (
            <li key={source.code}>
              <div>
                <span>
                  <i
                    className={`is-${source.status.toLowerCase()}`}
                    aria-hidden="true"
                  />
                  <strong>{source.label}</strong>
                </span>
                <small>
                  状态：{sourceStatusLabel(source.status)} · {sourceSyncLabel(source)}
                </small>
                <p>{source.notice}</p>
              </div>
              <a href={source.sourceUrl} target="_blank" rel="noreferrer">
                原始来源
              </a>
            </li>
          ))}
        </ul>
      </details>
    </aside>
  );
}

function WeatherDetail({
  areaName,
  generatedAt,
  productLabel,
  weather,
  selectedRegion,
}: {
  areaName: string;
  generatedAt: string;
  productLabel?: string;
  weather: WeatherObservation;
  selectedRegion?: OverviewRegion;
}) {
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
      <RealisticWeatherScene areaName={areaName} weather={weather} />
      <header>
        <div>
          <span>实时观测</span>
          <h3>{liveWeatherHeadline(areaName, weather)}</h3>
        </div>
        <strong>{kind === "clear" ? "天气平稳" : "需要关注"}</strong>
      </header>
      <dl className="situation-weather-detail__metrics" aria-label="实时气象指标">
        <div>
          <dt>气温</dt>
          <dd>{number(weather.meanTemperatureC, "℃")}</dd>
        </div>
        <div>
          <dt>降水</dt>
          <dd>{number(weather.precipitationMm, "毫米")}</dd>
        </div>
        <div>
          <dt>风速</dt>
          <dd>{number(weather.windSpeedKph ?? null, "公里/时")}</dd>
        </div>
        <div>
          <dt>土壤墒情</dt>
          <dd>{number(weather.soilMoisturePercent, "%")}</dd>
        </div>
      </dl>
      <section className="situation-weather-detail__assessment">
        <span>影响判断</span>
        <h4>{weather.risk}</h4>
        <p>{weather.assessment}</p>
        <small>
          {productLabel ?? "当前筛选品种"} · {liveWeatherEvidence(weather)}
        </small>
        {inherited && (
          <small>
            当前沿用所属{weather.regionName}观测；取得更细层级数据后自动替换。
          </small>
        )}
      </section>
      <footer>
        <span>
          观测 {formatTime(weather.observedAt)} · 更新于 {formatTime(weather.fetchedAt)}
          （{freshness(weather.fetchedAt, generatedAt)}）
        </span>
        <a href={weather.sourceUrl} target="_blank" rel="noreferrer">
          {weather.sourceName}
        </a>
      </footer>
    </article>
  );
}

function LogisticsDetail({ situation }: { situation: OperationalSituationCatalogue }) {
  const inventories = situation.inventories ?? [];
  const logisticsFlows = situation.logisticsFlows ?? [];
  return (
    <section className="situation-logistics-detail" aria-label="库存与物流">
      <header>
        <div>
          <span>正式业务数据</span>
          <h3>库存与物流流向</h3>
        </div>
        <time dateTime={situation.generatedAt}>
          {formatTime(situation.generatedAt)}
        </time>
      </header>
      <dl>
        <div>
          <dt>期末库存</dt>
          <dd>{totalInventory(situation).toLocaleString("zh-CN")}</dd>
          <small>吨 · {inventories.length} 个地区</small>
        </div>
        <div>
          <dt>跨区物流</dt>
          <dd>{logisticsFlows.length.toLocaleString("zh-CN")}</dd>
          <small>条审核通过记录</small>
        </div>
      </dl>
      {logisticsFlows.length ? (
        <ol>
          {logisticsFlows.slice(0, 8).map((flow) => (
            <li key={flow.eventId}>
              <div>
                <b>{flow.originRegionName}</b>
                <span aria-hidden="true">→</span>
                <b>{flow.destinationRegionName}</b>
              </div>
              <small>
                {flow.transportMode}
                {flow.volumeTonnes === null
                  ? ""
                  : ` · ${flow.volumeTonnes.toLocaleString("zh-CN")} 吨`}
                {` · ${formatTime(flow.occurredAt)}`}
              </small>
            </li>
          ))}
        </ol>
      ) : (
        <p>暂无审核通过的跨区物流记录</p>
      )}
    </section>
  );
}

function EmptyDetail({ children, title }: { children: string; title: string }) {
  return (
    <section className="situation-empty-detail">
      <h3>{title}</h3>
      <p>{children}</p>
    </section>
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
      <p>{conciseText(item.description, 160)}</p>
      <footer>
        <time dateTime={item.occurredAt}>{formatTime(item.occurredAt)}</time>
        <a href={item.sourceUrl} target="_blank" rel="noreferrer">
          {item.sourceName}
        </a>
        {item.facilityId && onFacilitySelect && (
          <button type="button" onClick={() => onFacilitySelect(item.facilityId!)}>
            查看节点
          </button>
        )}
      </footer>
    </article>
  );
}

function totalInventory(situation: OperationalSituationCatalogue) {
  return (situation.inventories ?? []).reduce(
    (total, item) => total + item.inventoryTonnes,
    0,
  );
}

function timelineCategoryLabel(category: SituationTimelineItem["category"]) {
  if (category === "WEATHER") return "实时天气";
  if (category === "LOGISTICS") return "物流态势";
  if (category === "MARKET") return "市场信号";
  if (category === "POLICY") return "政策事件";
  return "公开事件";
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

function levelLabel(level: OverviewRegion["level"]) {
  if (level === "PREFECTURE") return "地级区域";
  if (level === "COUNTY") return "县级区域";
  if (level === "TOWNSHIP") return "乡镇区域";
  return "行政村";
}

function number(value: number | null, unit: string) {
  return value === null ? "尚无数据" : `${value.toLocaleString("zh-CN")} ${unit}`;
}

function formatTime(value: string) {
  return new Date(value).toLocaleString("zh-CN", { hour12: false });
}

function sourceStatusLabel(status: "READY" | "STALE" | "UNAVAILABLE") {
  if (status === "READY") return "正常";
  if (status === "STALE") return "数据已过期";
  return "暂不可用";
}

function sourceSyncLabel({
  lastAttemptAt,
  lastSuccessAt,
}: {
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
}) {
  if (lastSuccessAt) return `最近成功 ${formatTime(lastSuccessAt)}`;
  if (lastAttemptAt) return `最近尝试 ${formatTime(lastAttemptAt)}`;
  return "尚无同步记录";
}

function freshness(fetchedAt: string, generatedAt: string) {
  const elapsed = Math.max(0, Date.parse(generatedAt) - Date.parse(fetchedAt));
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 1) return "刚刚同步";
  if (minutes < 60) return `${minutes}分钟前`;
  return `${Math.floor(minutes / 60)}小时前`;
}

function conciseText(value: string | null, maxLength: number) {
  if (!value) return "暂无补充说明。";
  return value.length > maxLength ? `${value.slice(0, maxLength)}…` : value;
}
