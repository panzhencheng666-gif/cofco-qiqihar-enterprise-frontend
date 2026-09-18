import type { OperationalFacilityCatalogue } from "../../domain/operationalFacilities";
import type { OperationalSituationCatalogue } from "../../domain/operationalSituation";
import "./operational-situation.css";

export function OperationalSituationPanel({
  facilities,
  situation,
}: {
  facilities: OperationalFacilityCatalogue;
  situation: OperationalSituationCatalogue;
}) {
  return (
    <div className="operational-situation-panel">
      <header>
        <div>
          <span>PUBLIC OPERATIONAL PICTURE</span>
          <h2>公开运营态势</h2>
          <p>公开风险、区域天气和运营节点在同一张地图中分层展示。</p>
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
      <section className="situation-weather-list">
        <h3>区域天气观测</h3>
        {situation.weather.length ? (
          situation.weather.map((weather) => (
            <article key={weather.rootRegionCode}>
              <div>
                <b>{weather.regionName}</b>
                <span>{weather.risk}</span>
              </div>
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
              <p>{weather.assessment}</p>
              <small>
                观测时间 {formatTime(weather.observedAt)} · {weather.sourceName}
              </small>
            </article>
          ))
        ) : (
          <p>尚无成功保存的公开天气快照。</p>
        )}
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

function number(value: number | null, unit: string) {
  return value === null ? "尚无数据" : `${value.toLocaleString("zh-CN")} ${unit}`;
}

function formatTime(value: string) {
  return new Date(value).toLocaleString("zh-CN", { hour12: false });
}
