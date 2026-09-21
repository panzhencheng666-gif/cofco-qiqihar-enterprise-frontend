import { useState } from "react";
import type { RegionalRailways } from "../../domain/overviewRegionalData";

const number = (value: number) =>
  value.toLocaleString("zh-CN", { maximumFractionDigits: 2 });
const usageLabel = (value: string) =>
  ({
    main: "干线",
    branch: "支线",
    industrial: "工业铁路",
    military: "专用铁路",
    tourism: "旅游铁路",
  })[value] ?? "资料未注明";

export function RegionalRailwayPanel({
  regionName,
  railway,
}: {
  regionName: string;
  railway?: RegionalRailways | null | undefined;
}) {
  const [scope, setScope] = useState<"WITHIN" | "NEARBY">("WITHIN");
  const [search, setSearch] = useState("");
  if (!railway)
    return <p role="status">铁路设施目录尚未同步，取得可核验资料后展示。</p>;
  if (!railway.boundaryAvailable)
    return (
      <p role="status">
        {regionName}缺少本级边界，尚不能确认设施归属。请查看上级地区的铁路资料。
      </p>
    );
  const local = railway.facilities.filter((item) => item.locationRelation === "WITHIN");
  const nearby = railway.facilities.filter(
    (item) => item.locationRelation === "NEARBY",
  );
  const facilities = (scope === "WITHIN" ? local : nearby).filter((item) =>
    `${item.name}${item.nearbyLines}`.includes(search.trim()),
  );
  return (
    <section aria-label={`${regionName}铁路交通`}>
      <h3>{regionName}铁路设施与线路</h3>
      <p>
        按系统已登记的所选地区边界查询；业务覆盖可能仅包含该地市部分区县。设施位置来自公开地图登记，客货运业务、开放情况与能力以铁路运营方公布为准。
      </p>
      <div className="regional-railway__filters">
        <button
          type="button"
          aria-pressed={scope === "WITHIN"}
          onClick={() => setScope("WITHIN")}
        >
          区内设施（{local.length}）
        </button>
        <button
          type="button"
          aria-pressed={scope === "NEARBY"}
          onClick={() => setScope("NEARBY")}
        >
          邻近设施（{nearby.length}）
        </button>
      </div>
      {scope === "NEARBY" && (
        <p>
          列出距本地区边界25公里内最近的5处地图设施，供了解周边交通；不计入本地区设施，也不代表已开通接驳或货运服务。
        </p>
      )}
      <label className="regional-estimates__search">
        查找站点或线路
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="站名、线路名称…"
        />
      </label>
      <div className="regional-railway__cards">
        {facilities.map((item) => (
          <article key={item.sourceId}>
            <h4>{item.name}</h4>
            <small>
              {{ station: "铁路车站", halt: "铁路乘降所", yard: "铁路编组场 / 场站" }[
                item.kind
              ] ?? "铁路设施"}{" "}
              · {item.status}
            </small>
            {item.locationRelation === "NEARBY" && (
              <p>距所选地区边界 {number(item.distanceKm)} 公里</p>
            )}
            <p>运营单位：{item.operator || "资料未注明"}</p>
            <p>业务范围：{item.service}</p>
            {item.reference && <p>站点编号：{item.reference}</p>}
            <p>邻近轨道：{item.nearbyLines || "暂无可匹配的具名轨道"}</p>
            <p>
              参考定位：{item.longitude.toFixed(5)}°E，{item.latitude.toFixed(5)}°N
            </p>
            <a
              href={item.sourceUrl}
              target="_blank"
              rel="noreferrer"
              aria-label={`查看${item.name}地图来源`}
            >
              查看地图与资料 ↗
            </a>
          </article>
        ))}
      </div>
      {!facilities.length && (
        <p role="status">
          尚未检索到匹配的设施记录。地图资料可能不完整，未登记不等于当地没有铁路设施。
        </p>
      )}
      <h3>境内线路（{railway.lines.length}）</h3>
      <p>
        长度为当前边界内已登记轨道几何长度，双线等平行轨道分别计入，不能当作营业里程。
      </p>
      <div className="regional-railway__cards">
        {railway.lines
          .filter((line) => line.name.includes(search.trim()))
          .map((line) => (
            <article key={line.name}>
              <h4>{line.name}</h4>
              <p>地图轨道长度：{number(line.mappedTrackKm)} 公里</p>
              <p>
                用途：{usageLabel(line.usage)} · 电气化：
                {line.electrification === "yes" ||
                line.electrification === "contact_line"
                  ? "地图标注电气化"
                  : line.electrification === "no"
                    ? "地图标注非电气化"
                    : "资料未注明 / 多种制式"}
              </p>
              {line.gauge && <p>轨距：{line.gauge} 毫米</p>}
              <p>运营单位：{line.operator || "资料未注明"}</p>
              <a href={line.sourceUrl} target="_blank" rel="noreferrer">
                查看线路地图来源 ↗
              </a>
            </article>
          ))}
      </div>
      <p className="regional-railway__source">
        目录快照：
        {railway.sourceAsOf
          ? new Date(railway.sourceAsOf).toLocaleString("zh-CN")
          : "未同步"}
        。年度筛选不代表当年的设施状态。邻近轨道按站点150米范围匹配，线路隶属仍需运营资料确认。
        <br />©{" "}
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noreferrer"
        >
          OpenStreetMap 贡献者 · ODbL
        </a>{" "}
        ·{" "}
        <a href="data/railways/osm-20260915.json" download>
          下载本次公开地图数据
        </a>
      </p>
    </section>
  );
}
