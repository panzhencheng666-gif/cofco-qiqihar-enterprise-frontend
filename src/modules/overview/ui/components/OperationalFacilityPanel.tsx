import type {
  OperationalFacilityCatalogue,
  RailwayFacility,
  StorageFacility,
} from "../../domain/operationalFacilities";

export function OperationalFacilityPanel({
  catalogue,
  mode,
  onSelect,
  selectedId,
}: {
  catalogue: OperationalFacilityCatalogue;
  mode: "STORAGE_FACILITIES" | "RAILWAY_FACILITIES";
  onSelect: (id: string) => void;
  selectedId?: string;
}) {
  if (mode === "STORAGE_FACILITIES") {
    const selected =
      catalogue.storageFacilities.find((facility) => facility.code === selectedId) ??
      catalogue.storageFacilities[0];
    return (
      <StoragePanel catalogue={catalogue} onSelect={onSelect} selected={selected} />
    );
  }
  const selected =
    catalogue.railwayFacilities.find((facility) => facility.sourceId === selectedId) ??
    catalogue.railwayFacilities[0];
  return <RailwayPanel catalogue={catalogue} onSelect={onSelect} selected={selected} />;
}

function StoragePanel({
  catalogue,
  onSelect,
  selected,
}: {
  catalogue: OperationalFacilityCatalogue;
  onSelect: (id: string) => void;
  selected: StorageFacility | undefined;
}) {
  const source = catalogue.sources.find((item) => item.code === "STORAGE");
  return (
    <div className="operational-facility-panel is-storage">
      <header>
        <div>
          <small>粮食收购与仓储网络</small>
          <h2>关联库点</h2>
        </div>
        <SourceBadge status={source?.status} />
      </header>
      <div className="operational-facility-panel__categories" aria-label="库点分类统计">
        {catalogue.storageCategories.map((category) => (
          <span key={category.code}>
            {category.label} <b>{category.count}</b>
          </span>
        ))}
      </div>
      <div className="operational-facility-panel__list" aria-label="关联库点列表">
        {catalogue.storageFacilities.map((facility) => (
          <button
            aria-pressed={facility.code === selected?.code}
            key={facility.code}
            type="button"
            onClick={() => onSelect(facility.code)}
          >
            <b>{facility.name}</b>
            <span>
              {facility.relationLabel} · {facility.regionName}
            </span>
          </button>
        ))}
      </div>
      {selected ? (
        <article
          className="storage-facility-card"
          aria-label={`${selected.name}库点详情`}
        >
          <div className="storage-facility-card__title">
            <div>
              <b>{selected.name}</b>
              <span>{selected.relationLabel}</span>
            </div>
            <small>{selected.coordinatePrecisionLabel}</small>
          </div>
          <dl>
            <div>
              <dt>所在地区</dt>
              <dd>{selected.regionName}</dd>
            </div>
            <div>
              <dt>公开地址</dt>
              <dd>{selected.address}</dd>
            </div>
            <div>
              <dt>仓容</dt>
              <dd>{capacityLabel(selected)}</dd>
            </div>
            <div>
              <dt>运营状态</dt>
              <dd>{selected.operationalStatus}</dd>
            </div>
          </dl>
          <section>
            <h3>公开收购价格</h3>
            {selected.prices.length ? (
              selected.prices.map((price) => (
                <div
                  className="storage-facility-card__price"
                  key={`${price.productCode}-${price.effectiveOn}-${price.qualityRequirement}`}
                >
                  <div>
                    <b>
                      {price.value.toLocaleString("zh-CN")} {price.unit}
                    </b>
                    <span className={price.current ? "is-current" : "is-history"}>
                      {price.current ? "公开有效价" : "历史公开价"}
                    </span>
                  </div>
                  <p>
                    {price.productName ?? price.productCode} ·{" "}
                    {price.qualityRequirement}
                  </p>
                  <small>
                    {price.effectiveOn} ·{" "}
                    <a href={price.sourceUrl} target="_blank" rel="noreferrer">
                      {price.sourceName}
                    </a>
                  </small>
                </div>
              ))
            ) : (
              <p>尚无保留来源的公开收购价格。</p>
            )}
          </section>
          <section>
            <h3>核验依据</h3>
            <ul>
              {selected.evidence.map((evidence) => (
                <li key={`${evidence.kind}-${evidence.sourceUrl}`}>
                  <a href={evidence.sourceUrl} target="_blank" rel="noreferrer">
                    {evidence.title}
                  </a>
                  <small>
                    {evidence.sourceAsOf ?? "日期未披露"} · {evidence.note}
                  </small>
                </li>
              ))}
            </ul>
          </section>
        </article>
      ) : (
        <p>当前范围没有已核验的关联库点。</p>
      )}
      {source && <p className="operational-facility-panel__notice">{source.notice}</p>}
    </div>
  );
}

function RailwayPanel({
  catalogue,
  onSelect,
  selected,
}: {
  catalogue: OperationalFacilityCatalogue;
  onSelect: (id: string) => void;
  selected: RailwayFacility | undefined;
}) {
  const source = catalogue.sources.find((item) => item.code === "RAILWAY");
  return (
    <div className="operational-facility-panel is-railway">
      <header>
        <div>
          <small>铁路地理参考与物流节点核验</small>
          <h2>铁路站点</h2>
        </div>
        <SourceBadge status={source?.status} />
      </header>
      <div className="railway-facility-route" aria-label="铁路线路概况">
        <span>
          已收录站点 <b>{catalogue.railwayFacilities.length}</b>
        </span>
        <span>
          关联线路 <b>{catalogue.railwayLines.length}</b>
        </span>
      </div>
      <div className="operational-facility-panel__list" aria-label="铁路站点列表">
        {catalogue.railwayFacilities.map((facility) => (
          <button
            aria-pressed={facility.sourceId === selected?.sourceId}
            key={facility.sourceId}
            type="button"
            onClick={() => onSelect(facility.sourceId)}
          >
            <b>{facility.name}</b>
            <span>
              {facility.locationRelation === "WITHIN"
                ? "范围内"
                : `边界外约 ${facility.distanceKm} 公里`}{" "}
              · {facility.kind}
            </span>
          </button>
        ))}
      </div>
      {selected ? (
        <article
          className="railway-facility-card"
          aria-label={`${selected.name}铁路站点详情`}
        >
          <div className="railway-facility-card__head">
            <span aria-hidden="true">铁路</span>
            <div>
              <b>{selected.name}</b>
              <small>{selected.nearbyLines || "线路名称尚未核定"}</small>
            </div>
          </div>
          <dl>
            <div>
              <dt>节点类型</dt>
              <dd>{selected.kind}</dd>
            </div>
            <div>
              <dt>边界关系</dt>
              <dd>
                {selected.locationRelation === "WITHIN"
                  ? "当前区域范围内"
                  : `区域边界外约 ${selected.distanceKm} 公里`}
              </dd>
            </div>
            <div>
              <dt>运营主体</dt>
              <dd>{selected.operator || "公开数据未标注"}</dd>
            </div>
            <div>
              <dt>线路编号</dt>
              <dd>{selected.reference || "公开数据未标注"}</dd>
            </div>
            <div>
              <dt>运行状态</dt>
              <dd>{selected.status || "需业务核验"}</dd>
            </div>
            <div>
              <dt>服务信息</dt>
              <dd>{selected.service || "需业务核验"}</dd>
            </div>
          </dl>
          <a
            className="railway-facility-card__source"
            href={selected.sourceUrl}
            target="_blank"
            rel="noreferrer"
          >
            查看 OpenStreetMap 地理要素
          </a>
          <section>
            <h3>附近铁路线路</h3>
            <ul>
              {catalogue.railwayLines.length ? (
                catalogue.railwayLines.map((line) => (
                  <li key={line.name}>
                    <b>{line.name}</b>
                    <span>
                      {line.mappedTrackKm.toFixed(1)} 公里 ·{" "}
                      {line.usage || "用途未标注"}
                    </span>
                    <a href={line.sourceUrl} target="_blank" rel="noreferrer">
                      地图来源
                    </a>
                  </li>
                ))
              ) : (
                <li>当前范围没有可关联的公开线路要素。</li>
              )}
            </ul>
          </section>
        </article>
      ) : (
        <p>当前范围没有可展示的铁路地理节点。</p>
      )}
      {source && <p className="operational-facility-panel__notice">{source.notice}</p>}
    </div>
  );
}

function SourceBadge({ status }: { status: string | undefined }) {
  const label =
    status === "READY" ? "来源可用" : status === "STALE" ? "来源待更新" : "来源不可用";
  return (
    <span
      className={`operational-source-badge is-${status?.toLowerCase() ?? "unavailable"}`}
    >
      {label}
    </span>
  );
}

function capacityLabel(facility: StorageFacility) {
  if (facility.capacityTonnes === null) return "尚未核定";
  return `${facility.capacityTonnes.toLocaleString("zh-CN")} 吨${facility.capacityAsOf ? `（截至 ${facility.capacityAsOf}）` : ""}`;
}
