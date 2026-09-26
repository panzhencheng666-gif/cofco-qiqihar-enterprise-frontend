import { useEffect, useRef, useState, type ReactNode } from "react";
import { Map, setWorkerUrl, type StyleSpecification } from "maplibre-gl";
import mapWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import "maplibre-gl/dist/maplibre-gl.css";
import { AnalysisWindow } from "./AnalysisWindow";
import { CalculatorWorkspace } from "./CalculatorWorkspace";
import { LiveNewsPanel } from "./LiveNewsPanel";
import { MarketButtonGuide } from "./MarketButtonGuide";
import { groupTopic } from "./analysisProfile";
import {
  findMetric,
  metricCatalog,
  metricGroups,
  type AnalysisTopic,
} from "./metricCatalog";
import { WorldBankMonthlyRail } from "./WorldBankMonthlyRail";
import { MoaDomesticRail } from "./MoaDomesticRail";
import { SourceSyncRail } from "./SourceSyncRail";
import { UnifiedNewsRail } from "./UnifiedNewsRail";
import { MarketQuoteRail } from "./MarketQuoteRail";
import "./market-intelligence.css";
import "./market-ops-controls.css";

// The production bundle renames the MapLibre worker. Set its emitted URL so
// GeoJSON, vector borders and glyph layers render outside the Vite dev server.
setWorkerUrl(mapWorkerUrl);

const commodities = ["玉米", "小麦", "稻谷", "大豆", "油脂"] as const;
const periods = ["近24小时", "近7天", "近30天", "近90天"] as const;
const layers = [
  "底图",
  "产区",
  "港口",
  "陆运",
  "天气",
  "能源",
  "航运",
  "政策",
] as const;
const availableLayers = new Set<(typeof layers)[number]>(["底图", "陆运", "航运"]);
const layerHelp: Record<(typeof layers)[number], string> = {
  底图: "显示地形、海洋、国界和城市，航线以低强调显示。",
  产区: "产区边界和作物数据待接入。",
  港口: "港口位置与状态数据待接入。",
  陆运: "显示 OpenStreetMap 参考道路和铁路，非实时运力。",
  天气: "可核验的实时天气图层待接入。",
  能源: "地理化能源数据待接入。",
  航运: "强调 2012 年历史航线参考，非实时船舶轨迹。",
  政策: "带地理位置的政策事件源待接入。",
};
const sections = ["商情总览", "价格与成本", "风险观察", "指标库", "资料库"] as const;
const indicatorGroups = metricGroups.filter((group) => group.id !== "calculation");
const indicatorCatalog = metricCatalog.filter(
  (topic) => !topic.id.startsWith("calculation-"),
);
const global2DZoom = (width: number) =>
  Math.max(-1, Math.log2(Math.max(width, 320) / 512) - 0.08);
const global2DCenter: [number, number] = [0, 10];
const graticule = {
  type: "FeatureCollection" as const,
  features: [
    ...Array.from({ length: 11 }, (_, index) => ({
      type: "Feature" as const,
      properties: {},
      geometry: {
        type: "LineString" as const,
        coordinates: Array.from({ length: 73 }, (_, point) => [
          -180 + point * 5,
          -75 + index * 15,
        ]),
      },
    })),
    ...Array.from({ length: 13 }, (_, index) => ({
      type: "Feature" as const,
      properties: {},
      geometry: {
        type: "LineString" as const,
        coordinates: Array.from({ length: 31 }, (_, point) => [
          -180 + index * 30,
          -75 + point * 5,
        ]),
      },
    })),
  ],
};
const oceanNames = {
  type: "FeatureCollection" as const,
  features: [
    {
      type: "Feature" as const,
      properties: { name: "北冰洋" },
      geometry: { type: "Point" as const, coordinates: [5, 78] },
    },
    {
      type: "Feature" as const,
      properties: { name: "大西洋" },
      geometry: { type: "Point" as const, coordinates: [-35, 12] },
    },
    {
      type: "Feature" as const,
      properties: { name: "印度洋" },
      geometry: { type: "Point" as const, coordinates: [75, -27] },
    },
    {
      type: "Feature" as const,
      properties: { name: "太平洋" },
      geometry: { type: "Point" as const, coordinates: [-155, 8] },
    },
    {
      type: "Feature" as const,
      properties: { name: "太平洋" },
      geometry: { type: "Point" as const, coordinates: [165, 8] },
    },
  ],
};
const continentNames = {
  type: "FeatureCollection" as const,
  features: [
    {
      type: "Feature" as const,
      properties: { name: "北美洲" },
      geometry: { type: "Point" as const, coordinates: [-105, 41] },
    },
    {
      type: "Feature" as const,
      properties: { name: "南美洲" },
      geometry: { type: "Point" as const, coordinates: [-61, -19] },
    },
    {
      type: "Feature" as const,
      properties: { name: "欧洲" },
      geometry: { type: "Point" as const, coordinates: [18, 53] },
    },
    {
      type: "Feature" as const,
      properties: { name: "非洲" },
      geometry: { type: "Point" as const, coordinates: [20, 2] },
    },
    {
      type: "Feature" as const,
      properties: { name: "亚洲" },
      geometry: { type: "Point" as const, coordinates: [91, 48] },
    },
    {
      type: "Feature" as const,
      properties: { name: "澳大利亚" },
      geometry: { type: "Point" as const, coordinates: [135, -25] },
    },
  ],
};
const terrainStyle: StyleSpecification = {
  version: 8,
  sky: {
    "sky-color": "#071923",
    "horizon-color": "#173b4d",
    "fog-color": "#071923",
    "atmosphere-blend": 0.9,
  },
  glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
  sources: {
    terrain: {
      type: "raster",
      tiles: [
        `${import.meta.env.BASE_URL}market-intelligence/terrain/{z}/{x}/{y}.webp?v=5`,
      ],
      tileSize: 256,
      maxzoom: 4,
      attribution: "Natural Earth (public domain)",
    },
    "satellite-overview": {
      type: "raster",
      tiles: ["https://tiles.versatiles.org/tiles/satellite/{z}/{x}/{y}"],
      // 512px source tiles: draw them at 64px only on the world view so the
      // monitor requests detailed native imagery instead of stretching z2/z3.
      tileSize: 64,
      maxzoom: 12,
      attribution:
        "VersaTiles / Sentinel-2 Global Mosaic (CC BY 4.0) / NASA Blue Marble",
    },
    satellite: {
      type: "raster",
      tiles: ["https://tiles.versatiles.org/tiles/satellite/{z}/{x}/{y}"],
      tileSize: 256,
      maxzoom: 12,
      attribution:
        "VersaTiles / Sentinel-2 Global Mosaic (CC BY 4.0) / NASA Blue Marble",
    },
    boundaries: {
      type: "vector",
      url: "https://tiles.openfreemap.org/planet",
      attribution: "OpenFreeMap / OpenStreetMap contributors",
    },
    "ocean-mask": {
      type: "geojson",
      data: `${import.meta.env.BASE_URL}market-intelligence/natural-earth-ocean-50m.geojson`,
      attribution: "Natural Earth ocean polygons (public domain)",
    },
    graticule: { type: "geojson", data: graticule },
    places: {
      type: "geojson",
      data: `${import.meta.env.BASE_URL}market-intelligence/populated-places-10m.geojson`,
      attribution: "Natural Earth populated places (public domain)",
    },
    "shipping-lanes": {
      type: "geojson",
      data: `${import.meta.env.BASE_URL}market-intelligence/shipping-lanes-2012.geojson`,
      attribution:
        "P. Benden (2022), derived from CIA World Oceans map (2012), CC BY 4.0 with author exception",
    },
    "ocean-names": { type: "geojson", data: oceanNames },
    "continent-names": { type: "geojson", data: continentNames },
  },
  layers: [
    {
      id: "sea-background",
      type: "background",
      paint: { "background-color": "#061720" },
    },
    {
      id: "terrain",
      type: "raster",
      source: "terrain",
      paint: {
        "raster-opacity": 1,
        "raster-saturation": 0.08,
        "raster-contrast": 0.05,
      },
    },
    {
      id: "satellite-overview",
      type: "raster",
      source: "satellite-overview",
      maxzoom: 4,
      paint: {
        "raster-opacity": ["interpolate", ["linear"], ["zoom"], 3.25, 0.98, 4, 0],
        "raster-saturation": -0.1,
        "raster-brightness-max": 0.73,
        "raster-contrast": 0.12,
        "raster-fade-duration": 0,
      },
    },
    {
      id: "satellite",
      type: "raster",
      source: "satellite",
      minzoom: 3.25,
      paint: {
        "raster-opacity": 0.98,
        "raster-saturation": -0.1,
        "raster-brightness-max": [
          "interpolate",
          ["linear"],
          ["zoom"],
          1,
          0.68,
          6,
          0.77,
          10,
          0.84,
        ],
        "raster-contrast": 0.12,
        "raster-fade-duration": 0,
      },
    },
    {
      id: "deep-ocean",
      type: "fill",
      source: "ocean-mask",
      maxzoom: 4.5,
      paint: {
        "fill-color": "#00090e",
        "fill-opacity": ["interpolate", ["linear"], ["zoom"], 3, 0.85, 4.5, 0],
      },
    },
    {
      id: "graticule",
      type: "line",
      source: "graticule",
      paint: {
        "line-color": "#24536a",
        "line-opacity": 0.38,
        "line-width": 0.6,
        "line-dasharray": [2, 6],
      },
    },
    {
      id: "shipping-lanes-secondary",
      type: "line",
      source: "shipping-lanes",
      filter: ["in", ["get", "Type"], ["literal", ["Middle", "Minor"]]],
      paint: {
        "line-color": "#32758d",
        "line-opacity": 0.28,
        "line-width": 0.7,
        "line-dasharray": [2, 5],
      },
    },
    {
      id: "shipping-lanes-major",
      type: "line",
      source: "shipping-lanes",
      filter: ["==", ["get", "Type"], "Major"],
      paint: {
        "line-color": "#4789a0",
        "line-opacity": 0.46,
        "line-width": ["interpolate", ["linear"], ["zoom"], 1, 0.8, 5, 1.4],
        "line-dasharray": [2, 4],
      },
    },
    {
      id: "land-roads",
      type: "line",
      source: "boundaries",
      "source-layer": "transportation",
      minzoom: 4.5,
      filter: [
        "in",
        ["get", "class"],
        ["literal", ["motorway", "trunk", "primary", "secondary"]],
      ],
      paint: {
        "line-color": "#d2b78d",
        "line-opacity": 0,
        "line-width": ["interpolate", ["linear"], ["zoom"], 5, 0.75, 10, 2.2],
      },
    },
    {
      id: "land-rail",
      type: "line",
      source: "boundaries",
      "source-layer": "transportation",
      minzoom: 5,
      filter: ["==", ["get", "subclass"], "rail"],
      paint: {
        "line-color": "#e4ded1",
        "line-opacity": 0,
        "line-width": ["interpolate", ["linear"], ["zoom"], 5, 0.8, 10, 1.8],
        "line-dasharray": [2, 2],
      },
    },
    {
      id: "country-borders",
      type: "line",
      source: "boundaries",
      "source-layer": "boundary",
      filter: ["==", ["get", "admin_level"], 2],
      paint: { "line-color": "#bec9aa", "line-opacity": 0.58, "line-width": 0.6 },
    },
    {
      id: "city-points",
      type: "circle",
      source: "places",
      filter: ["<=", ["get", "rank"], 1],
      paint: {
        "circle-color": "#e7c68b",
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 1, 1.3, 6, 2.4],
        "circle-opacity": 0.8,
        "circle-stroke-color": "#09202a",
        "circle-stroke-width": 0.7,
      },
    },
    {
      id: "city-points-detailed",
      type: "circle",
      source: "places",
      minzoom: 2.4,
      filter: ["all", [">", ["get", "rank"], 1], ["<=", ["get", "rank"], 4]],
      paint: {
        "circle-color": "#e7c68b",
        "circle-radius": 1.5,
        "circle-opacity": 0.5,
      },
    },
    {
      id: "city-labels",
      type: "symbol",
      source: "places",
      filter: ["<=", ["get", "rank"], 1],
      layout: {
        "text-field": ["get", "name"],
        "text-font": ["Noto Sans Regular"],
        "text-size": ["interpolate", ["linear"], ["zoom"], 1, 10, 7, 12],
        "text-offset": [0.6, 0.1],
        "text-anchor": "left",
        "text-optional": true,
      },
      paint: {
        "text-color": "#e3e9df",
        "text-halo-color": "#09202a",
        "text-halo-width": 1.3,
      },
    },
    {
      id: "city-labels-regional",
      type: "symbol",
      source: "places",
      minzoom: 2.4,
      filter: ["==", ["get", "rank"], 2],
      layout: {
        "text-field": ["get", "name"],
        "text-font": ["Noto Sans Regular"],
        "text-size": 10,
        "text-offset": [0.6, 0],
        "text-anchor": "left",
        "text-optional": true,
      },
      paint: {
        "text-color": "#d2dfd6",
        "text-halo-color": "#09202a",
        "text-halo-width": 1.2,
      },
    },
    {
      id: "city-labels-near",
      type: "symbol",
      source: "places",
      minzoom: 4.5,
      filter: ["all", [">=", ["get", "rank"], 3], ["<=", ["get", "rank"], 4]],
      layout: {
        "text-field": ["get", "name"],
        "text-font": ["Noto Sans Regular"],
        "text-size": 11,
        "text-offset": [0.6, 0],
        "text-anchor": "left",
        "text-optional": true,
      },
      paint: {
        "text-color": "#d2dfd6",
        "text-halo-color": "#09202a",
        "text-halo-width": 1.2,
      },
    },
    {
      id: "city-labels-local",
      type: "symbol",
      source: "boundaries",
      "source-layer": "place",
      minzoom: 7,
      filter: ["in", ["get", "class"], ["literal", ["city", "town"]]],
      layout: {
        "text-field": ["coalesce", ["get", "name:zh"], ["get", "name"]],
        "text-font": ["Noto Sans Regular"],
        "text-size": ["interpolate", ["linear"], ["zoom"], 7, 10, 12, 13],
        "text-optional": true,
      },
      paint: {
        "text-color": "#e8e7dd",
        "text-halo-color": "#102027",
        "text-halo-width": 1.4,
      },
    },
    {
      id: "continent-labels",
      type: "symbol",
      source: "continent-names",
      layout: {
        "text-field": ["get", "name"],
        "text-font": ["Noto Sans Regular"],
        "text-size": 15,
        "text-letter-spacing": 0.18,
      },
      paint: {
        "text-color": "#edf3eb",
        "text-halo-color": "#15242a",
        "text-halo-width": 1.5,
      },
    },
    {
      id: "ocean-labels",
      type: "symbol",
      source: "ocean-names",
      layout: {
        "text-field": ["get", "name"],
        "text-font": ["Noto Sans Regular"],
        "text-size": 14,
        "text-letter-spacing": 0.3,
      },
      paint: {
        "text-color": "#9bb5c2",
        "text-opacity": 0.9,
        "text-halo-color": "#09202a",
        "text-halo-width": 1.5,
      },
    },
    {
      id: "country-labels",
      type: "symbol",
      source: "boundaries",
      "source-layer": "place",
      minzoom: 0,
      maxzoom: 6.5,
      filter: ["==", ["get", "class"], "country"],
      layout: {
        "text-field": [
          "coalesce",
          ["get", "name:zh-Hans"],
          ["get", "name:en"],
          ["get", "name"],
        ],
        "text-font": ["Noto Sans Regular"],
        "text-size": ["interpolate", ["linear"], ["zoom"], 0, 9, 5, 14],
        "text-allow-overlap": false,
        "text-padding": 3,
      },
      paint: {
        "text-color": "#e4e8db",
        "text-halo-color": "#172321",
        "text-halo-width": 1.4,
      },
    },
  ],
};
const priceTopics = indicatorCatalog.filter((topic) => topic.kind === "价格与成本");
const riskTopics = metricCatalog.filter((topic) => topic.kind === "风险观察");

type Section = (typeof sections)[number];

function analysisFromHash(): AnalysisTopic | null {
  const parts = window.location.hash.split("/");
  if (
    parts.length !== 5 ||
    parts[1] !== "market-intelligence" ||
    parts[2] !== "analysis" ||
    !parts[3] ||
    !parts[4]
  )
    return null;
  try {
    const kind = decodeURIComponent(parts[3]);
    const title = decodeURIComponent(parts[4]);
    if (kind === "news")
      return { id: `fao-news:${title}`, title, kind: "实时事件", group: "FAO 新闻" };
    if (kind === "china-news")
      return {
        id: `moa-news:${title}`,
        title,
        kind: "实时事件",
        group: "农业农村部监测",
      };
    if (kind !== "价格与成本" && kind !== "风险观察" && kind !== "实时事件")
      return null;
    return findMetric(title, kind);
  } catch {
    return null;
  }
}

type OverviewPanelProps = {
  title: string;
  subtitle: string;
  kind: AnalysisTopic["kind"];
  wide?: boolean;
  children: ReactNode;
  onSelect: (topic: AnalysisTopic) => void;
};

function OverviewPanel({
  title,
  subtitle,
  kind,
  wide = false,
  children,
  onSelect,
}: OverviewPanelProps) {
  return (
    <section className={`mi-overview-panel${wide ? " wide" : ""}`}>
      <header>
        <button
          type="button"
          onClick={() => onSelect(findMetric(title, kind))}
          aria-label={`进入${title}分析工作台`}
        >
          <span>{title}</span>
          <span aria-hidden="true">↗</span>
        </button>
        <small>{subtitle}</small>
      </header>
      <div className="mi-overview-body">{children}</div>
    </section>
  );
}

function PreviewRows({
  items,
  onSelect,
  kind,
}: {
  items: string[];
  onSelect: (topic: AnalysisTopic) => void;
  kind: AnalysisTopic["kind"];
}) {
  return (
    <div className="mi-preview-rows">
      {items.map((title) => (
        <button
          type="button"
          key={title}
          onClick={() => onSelect(findMetric(title, kind))}
        >
          <span>{title}</span>
          <span>--</span>
          <span>待接入</span>
        </button>
      ))}
    </div>
  );
}

function OverviewPanels({
  onSelect,
  onOpenCatalog,
  showQuotes,
}: {
  onSelect: (topic: AnalysisTopic) => void;
  onOpenCatalog: () => void;
  showQuotes: boolean;
}) {
  return (
    <div className="mi-overview-grid">
      <UnifiedNewsRail onSelect={onSelect} />
      <SourceSyncRail />
      <MoaDomesticRail onSelect={onSelect} />
      {showQuotes && <MarketQuoteRail onSelect={onSelect} />}
      <WorldBankMonthlyRail onSelect={onSelect} />
      <WorldBankMonthlyRail source="fao-food-price" onSelect={onSelect} />
      <section className="mi-overview-index" aria-label="完整指标分类">
        <header>
          <div>
            <strong>指标全景</strong>
            <span>
              {indicatorGroups.length} 类 · {indicatorCatalog.length} 项
            </span>
            <span className="mi-overview-index-hint">可滚动</span>
          </div>
          <button type="button" onClick={onOpenCatalog}>
            全部 ↗
          </button>
        </header>
        <div
          className="mi-overview-index-grid"
          tabIndex={0}
          role="region"
          aria-label="粮食产业指标分类，可滚动浏览"
        >
          {indicatorGroups.map((group) => (
            <button
              type="button"
              key={group.id}
              onClick={() => onSelect(groupTopic(group))}
            >
              <span>{group.title}</span>
              <small>{group.items.length} 项 ↗</small>
            </button>
          ))}
        </div>
      </section>
      <OverviewPanel
        title="期货持仓与资金"
        subtitle="交易所数据待接入"
        kind="价格与成本"
        onSelect={onSelect}
      >
        <PreviewRows
          items={["主力合约持仓", "成交量变化", "资金流向"]}
          kind="价格与成本"
          onSelect={onSelect}
        />
      </OverviewPanel>
      <OverviewPanel
        title="新闻与市场联动"
        subtitle="计算模型待接入"
        kind="风险观察"
        onSelect={onSelect}
      >
        <p>对照新闻热度与价格变化，展示观察窗口、样本量和相关区间。</p>
        <div className="mi-panel-meta">相关性不代表因果关系</div>
      </OverviewPanel>
      <OverviewPanel
        title="能源与运费"
        subtitle="报价源待接入"
        kind="价格与成本"
        onSelect={onSelect}
      >
        <PreviewRows
          items={["原油与柴油", "海运费", "铁路与公路"]}
          kind="价格与成本"
          onSelect={onSelect}
        />
      </OverviewPanel>
      <OverviewPanel
        title="陆运与中转"
        subtitle="运力与通行源待接入"
        kind="价格与成本"
        onSelect={onSelect}
      >
        <PreviewRows
          items={["铁路运力利用率", "公路拥堵与封闭", "港口集疏运量"]}
          kind="价格与成本"
          onSelect={onSelect}
        />
      </OverviewPanel>
      <OverviewPanel
        title="库存与供需"
        subtitle="统计源待接入"
        kind="价格与成本"
        onSelect={onSelect}
      >
        <PreviewRows
          items={["产区库存", "港口库存", "产量与消费"]}
          kind="价格与成本"
          onSelect={onSelect}
        />
      </OverviewPanel>
      <OverviewPanel
        title="航道与贸易政策"
        subtitle="事件源待接入"
        kind="风险观察"
        onSelect={onSelect}
      >
        <PreviewRows
          items={["关键航道", "进出口政策", "关税与制裁"]}
          kind="风险观察"
          onSelect={onSelect}
        />
      </OverviewPanel>
      <OverviewPanel
        title="种植与长势"
        subtitle="农业统计待接入"
        kind="风险观察"
        onSelect={onSelect}
      >
        <PreviewRows
          items={["播种进度", "作物长势等级", "收获进度"]}
          kind="风险观察"
          onSelect={onSelect}
        />
      </OverviewPanel>
      <OverviewPanel
        title="天气与水文"
        subtitle="气象水文待接入"
        kind="风险观察"
        onSelect={onSelect}
      >
        <PreviewRows
          items={["累计降水距平", "土壤墒情", "河道水位"]}
          kind="风险观察"
          onSelect={onSelect}
        />
      </OverviewPanel>
      <OverviewPanel
        title="加工与副产品"
        subtitle="企业报价待接入"
        kind="价格与成本"
        onSelect={onSelect}
      >
        <PreviewRows
          items={["大豆压榨利润", "玉米淀粉加工利润", "稻米加工利润"]}
          kind="价格与成本"
          onSelect={onSelect}
        />
      </OverviewPanel>
      <OverviewPanel
        title="农资与生产成本"
        subtitle="成本源待接入"
        kind="价格与成本"
        onSelect={onSelect}
      >
        <PreviewRows
          items={["化肥价格", "柴油价格", "单位种植成本"]}
          kind="价格与成本"
          onSelect={onSelect}
        />
      </OverviewPanel>
      <OverviewPanel
        title="粮食质量安全"
        subtitle="检验源待接入"
        kind="风险观察"
        onSelect={onSelect}
      >
        <PreviewRows
          items={["水分含量", "霉变与毒素检测", "质量合格率"]}
          kind="风险观察"
          onSelect={onSelect}
        />
      </OverviewPanel>
      <OverviewPanel
        title="金融与套保"
        subtitle="行情与资金待接入"
        kind="价格与成本"
        onSelect={onSelect}
      >
        <PreviewRows
          items={["美元兑人民币汇率", "融资利率", "套保覆盖率"]}
          kind="价格与成本"
          onSelect={onSelect}
        />
      </OverviewPanel>
      <OverviewPanel
        title="我的监控"
        subtitle="规则配置待接入"
        kind="风险观察"
        wide
        onSelect={onSelect}
      >
        <p>未来可按品种、地区、价格阈值、新闻主题和风险等级建立个人监控规则。</p>
        <div className="mi-panel-meta">规则、通知与审计记录待接入</div>
      </OverviewPanel>
    </div>
  );
}

function StatusDot() {
  return <span className="mi-dot" aria-hidden="true" />;
}

function AnalysisRows({
  onSelect,
  topics,
  grouped = true,
}: {
  onSelect: (topic: AnalysisTopic) => void;
  topics: AnalysisTopic[];
  grouped?: boolean;
}) {
  return (
    <div className="mi-analysis-rows">
      {topics.map((topic, index) => (
        <div key={topic.title}>
          {grouped && (index === 0 || topics[index - 1]?.group !== topic.group) && (
            <div className="mi-analysis-group">{topic.group}</div>
          )}
          <button
            type="button"
            onClick={() => onSelect(topic)}
            aria-label={`进入${topic.title}分析工作台`}
          >
            <span>{topic.title}</span>
            <span>--</span>
            <span>待接入</span>
            <span aria-hidden="true">↗</span>
          </button>
        </div>
      ))}
    </div>
  );
}

export function MarketIntelligencePage() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const [commodity, setCommodity] = useState<(typeof commodities)[number]>("玉米");
  const [scope, setScope] = useState<"全球" | "中国">("全球");
  const [mode, setMode] = useState<"2D" | "3D">("2D");
  const [period, setPeriod] = useState<(typeof periods)[number]>("近7天");
  const [layer, setLayer] = useState<(typeof layers)[number]>("底图");
  const [guideOpen, setGuideOpen] = useState(false);
  const [section, setSection] = useState<Section>("商情总览");
  const [indicatorSearch, setIndicatorSearch] = useState("");
  const [mapFailed, setMapFailed] = useState(false);
  const [analysisTopic, setAnalysisTopic] = useState<AnalysisTopic | null>(
    analysisFromHash,
  );
  const [toolOpen, setToolOpen] = useState(
    () => window.location.hash === "#/market-intelligence/tools",
  );

  useEffect(() => {
    const synchronize = () => {
      setAnalysisTopic(analysisFromHash());
      setToolOpen(window.location.hash === "#/market-intelligence/tools");
    };
    window.addEventListener("hashchange", synchronize);
    return () => window.removeEventListener("hashchange", synchronize);
  }, []);

  function openAnalysis(topic: AnalysisTopic) {
    setToolOpen(false);
    setAnalysisTopic(topic);
    window.location.hash = `#/market-intelligence/analysis/${encodeURIComponent(topic.id.startsWith("fao-news:") ? "news" : topic.id.startsWith("moa-news:") ? "china-news" : topic.kind)}/${encodeURIComponent(topic.title)}`;
  }

  function closeAnalysis() {
    setAnalysisTopic(null);
    window.location.hash = "#/market-intelligence";
  }

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;
    let map: Map;
    try {
      map = new Map({
        container: mapContainer.current,
        style: terrainStyle,
        center: global2DCenter,
        zoom: global2DZoom(mapContainer.current.clientWidth),
        minZoom: -1,
        maxZoom: 12,
        maxPitch: 55,
        dragRotate: false,
        renderWorldCopies: false,
        attributionControl: false,
      });
      mapRef.current = map;
    } catch {
      queueMicrotask(() => setMapFailed(true));
      return;
    }
    return () => {
      mapRef.current = null;
      map.remove();
    };
  }, []);

  useEffect(() => {
    const element = mapContainer.current;
    if (!element) return;
    const observer = new ResizeObserver(() => {
      const map = mapRef.current;
      if (!map) return;
      map.resize();
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const updateShipping = () => {
      if (!map.getLayer("shipping-lanes-major")) return;
      map.setPaintProperty(
        "shipping-lanes-major",
        "line-opacity",
        layer === "航运" ? 0.85 : 0.46,
      );
      map.setPaintProperty(
        "shipping-lanes-secondary",
        "line-opacity",
        layer === "航运" ? 0.52 : 0.28,
      );
      if (map.getLayer("land-roads")) {
        map.setPaintProperty("land-roads", "line-opacity", layer === "陆运" ? 0.8 : 0);
      }
      if (map.getLayer("land-rail")) {
        map.setPaintProperty("land-rail", "line-opacity", layer === "陆运" ? 0.9 : 0);
      }
    };
    map.on("load", updateShipping);
    updateShipping();
    return () => {
      map.off("load", updateShipping);
    };
  }, [layer]);

  function changeScope(next: "全球" | "中国") {
    setScope(next);
    mapRef.current?.flyTo({
      center: next === "全球" ? (mode === "3D" ? [15, 20] : global2DCenter) : [104, 35],
      zoom:
        next === "全球"
          ? mode === "3D"
            ? 2.15
            : global2DZoom(mapRef.current?.getContainer().clientWidth ?? 800)
          : mode === "3D"
            ? 1.7
            : 3.4,
      duration: 700,
    });
  }

  function selectLayer(next: (typeof layers)[number]) {
    if (!availableLayers.has(next)) return;
    setLayer(next);
    const map = mapRef.current;
    if (next === "陆运" && map && map.getZoom() < 5) {
      setScope("中国");
      map.flyTo({ center: [104, 35], zoom: 5.4, duration: 700 });
    }
  }

  function changeMode(next: "2D" | "3D") {
    setMode(next);
    const map = mapRef.current;
    if (!map) return;
    const projection = { type: next === "3D" ? "globe" : "mercator" } as const;
    map.setProjection(projection);
    map.easeTo({
      center: scope === "中国" ? [104, 35] : next === "3D" ? [15, 20] : global2DCenter,
      pitch: 0,
      zoom:
        scope === "中国"
          ? next === "3D"
            ? 1.7
            : 3.4
          : next === "3D"
            ? 2.15
            : global2DZoom(map.getContainer().clientWidth),
      duration: 700,
    });
  }

  return (
    <main className="market-screen" aria-label="全球粮食商情监测">
      <div className="mi-banner">
        <span>商情平台</span>
        <strong>粮食、能源、航运与金融成本同屏观察</strong>
        <span>地图资料与部分公开源已接入 · 其他指标待接入</span>
      </div>
      <header className="mi-topbar">
        <div className="mi-brand">
          <span className="mi-brand-rule" />
          全球粮食商情监测
        </div>
        <div className="mi-topline">关注全球粮食市场 · 服务稳健供应链</div>
        <nav className="mi-commodity" aria-label="品种筛选">
          {commodities.map((item) => (
            <button
              className={commodity === item ? "active" : ""}
              aria-pressed={commodity === item}
              key={item}
              onClick={() => setCommodity(item)}
              type="button"
            >
              {item}
            </button>
          ))}
        </nav>
        <nav className="mi-scope" aria-label="地图范围">
          {(["全球", "中国"] as const).map((item) => (
            <button
              className={scope === item ? "active" : ""}
              aria-pressed={scope === item}
              key={item}
              onClick={() => changeScope(item)}
              type="button"
            >
              {item}
            </button>
          ))}
        </nav>
        <div className="mi-update">
          <StatusDot />
          数据更新：<b>按来源发布同步</b>
        </div>
      </header>

      <div className="mi-subnav" aria-label="商情看板视图">
        <span className="active">主看板</span>
        <span>地理态势 · 指标监控 · 研判工作台</span>
        <nav className="mi-report-actions" aria-label="商情报表导出">
          <span>导出</span>
          {(
            [
              ["DAY", "日报"],
              ["WEEK", "周报"],
              ["MONTH", "月报"],
              ["QUARTER", "季报"],
              ["YEAR", "年报"],
            ] as const
          ).map(([period, label]) => (
            <a
              key={period}
              href={`/api/v1/market-intelligence/reports/docx?period=${period}`}
              download
            >
              {label}
            </a>
          ))}
        </nav>
        <button
          type="button"
          className="mi-tools-entry"
          onClick={() => {
            setAnalysisTopic(null);
            setToolOpen(true);
            window.location.hash = "#/market-intelligence/tools";
          }}
        >
          工具栏 · 人工试算 ↗
        </button>
        <button
          type="button"
          className="mi-tools-entry mi-guide-entry"
          onClick={() => setGuideOpen(true)}
          title="查看大屏各组按键的用途与数据状态"
        >
          按键说明 ?
        </button>
      </div>

      <div className="mi-content">
        <section className="mi-map-area" aria-label="交互式全球地图">
          <div ref={mapContainer} className="mi-map" />
          <div className="mi-map-header">
            <strong>全球粮食商情态势</strong>
            <span>地理底图与历史航线参考</span>
            <nav className="mi-mode" aria-label="地图视角">
              {(["2D", "3D"] as const).map((item) => (
                <button
                  className={mode === item ? "active" : ""}
                  aria-pressed={mode === item}
                  key={item}
                  onClick={() => changeMode(item)}
                  type="button"
                >
                  {item}
                </button>
              ))}
            </nav>
          </div>
          <div className="mi-time-filter">
            <span>时间范围</span>
            <nav className="mi-period" aria-label="时间范围">
              {periods.map((item) => (
                <button
                  className={period === item ? "active" : ""}
                  aria-pressed={period === item}
                  key={item}
                  onClick={() => setPeriod(item)}
                  type="button"
                >
                  {item}
                </button>
              ))}
            </nav>
          </div>
          {mapFailed && (
            <div className="mi-map-error" role="alert">
              地图初始化失败，请检查浏览器图形支持。
            </div>
          )}
          <div className="mi-compass" aria-hidden="true">
            <span>N</span>
            <strong>▲</strong>
          </div>
          <div className="mi-map-controls" aria-label="地图缩放">
            <button
              onClick={() => mapRef.current?.zoomIn()}
              type="button"
              aria-label="放大地图"
            >
              ＋
            </button>
            <button
              onClick={() => mapRef.current?.zoomOut()}
              type="button"
              aria-label="缩小地图"
            >
              －
            </button>
          </div>
          <div className="mi-map-source-note">
            {layer === "陆运"
              ? "放大到区域或城市查看 OSM 公路与铁路参考路网 · 非实时运力"
              : "航线为 2012 年历史参考 · 非实时轨迹"}
          </div>
          <div className="mi-map-bottom">
            <nav className="mi-layers" aria-label="地图图层">
              {layers.map((item) => (
                <button
                  aria-pressed={layer === item}
                  className={layer === item ? "active" : ""}
                  key={item}
                  onClick={() => selectLayer(item)}
                  type="button"
                  disabled={!availableLayers.has(item)}
                  title={layerHelp[item]}
                  aria-label={`${item}${availableLayers.has(item) ? "图层" : "图层待接入"}：${layerHelp[item]}`}
                >
                  <span aria-hidden="true">
                    {
                      (
                        {
                          产区: "♧",
                          底图: "◎",
                          港口: "⚓",
                          陆运: "▤",
                          天气: "☁",
                          能源: "▤",
                          航运: "▥",
                          政策: "▣",
                        } as Record<string, string>
                      )[item]
                    }
                  </span>
                  {item}
                  {!availableLayers.has(item) && <small>待接入</small>}
                </button>
              ))}
            </nav>
            <div className="mi-timeline">
              <span>时间轴待接入</span>
              <div className="mi-timeline-track" aria-hidden="true" />
              <span>--</span>
            </div>
          </div>
        </section>

        <aside className="mi-rail" aria-label="商情信息">
          <nav className="mi-tabs" aria-label="看板页面">
            {sections.map((item) => (
              <button
                aria-current={section === item ? "page" : undefined}
                key={item}
                onClick={() => setSection(item)}
                type="button"
              >
                {item}
              </button>
            ))}
          </nav>
          {section === "商情总览" && <LiveNewsPanel onSelect={openAnalysis} />}
          <div className="mi-rail-scroll">
            {section === "商情总览" && (
              <OverviewPanels
                showQuotes={analysisTopic === null && !toolOpen}
                onSelect={openAnalysis}
                onOpenCatalog={() => setSection("指标库")}
              />
            )}
            {section === "价格与成本" && (
              <section className="mi-rail-section">
                <div className="mi-rail-heading">
                  <h2>价格与成本 · {commodity}</h2>
                  <span>数据源：待接入</span>
                </div>
                <AnalysisRows topics={priceTopics} onSelect={openAnalysis} />
                <p className="mi-empty-note">
                  数据接入后显示价格、运费、能源与汇率的原始值和计算口径。
                </p>
              </section>
            )}
            {section === "风险观察" && (
              <section className="mi-rail-section">
                <div className="mi-rail-heading">
                  <h2>风险观察 · {commodity}</h2>
                  <span>数据源：待接入</span>
                </div>
                <AnalysisRows topics={riskTopics} onSelect={openAnalysis} />
                <p className="mi-empty-note">
                  真实事件接入后，按来源与更新时间呈现风险证据。
                </p>
              </section>
            )}
            {section === "指标库" && (
              <section className="mi-rail-section">
                <div className="mi-rail-heading">
                  <h2>粮食产业指标库</h2>
                  <span>
                    {indicatorCatalog.length} 项 · {indicatorGroups.length} 类
                  </span>
                </div>
                <input
                  className="mi-indicator-search"
                  type="search"
                  aria-label="搜索粮食产业指标"
                  placeholder="搜索价格、产量、天气、运费、成本等"
                  value={indicatorSearch}
                  onChange={(event) => setIndicatorSearch(event.target.value)}
                />
                {indicatorGroups.map((group) => {
                  const visible = indicatorCatalog.filter(
                    (topic) =>
                      topic.group === group.title &&
                      topic.title.includes(indicatorSearch.trim()),
                  );
                  if (visible.length === 0) return null;
                  return (
                    <div key={group.id} className="mi-indicator-group">
                      <h3>
                        {group.title}
                        <span>{visible.length}</span>
                      </h3>
                      <AnalysisRows
                        topics={visible}
                        grouped={false}
                        onSelect={openAnalysis}
                      />
                    </div>
                  );
                })}
                {indicatorCatalog.every(
                  (topic) => !topic.title.includes(indicatorSearch.trim()),
                ) && <p className="mi-empty-note">没有匹配的指标。</p>}
              </section>
            )}
            {section === "资料库" && (
              <section className="mi-rail-section">
                <div className="mi-rail-heading">
                  <h2>资料库</h2>
                  <span>数据源：待接入</span>
                </div>
                <p className="mi-empty-note">
                  公开数据源、新闻原文、授权状态和计算方法将在接入后提供检索。
                </p>
              </section>
            )}
          </div>
        </aside>
      </div>

      <footer className="mi-footer">
        <span className="mi-earth">◉ EARTH</span>
        <span>影像：VersaTiles · 备用底图：Natural Earth</span>
        <span>坐标系：WGS84</span>
        <span>本系统仅供信息参考，不构成任何投资建议</span>
        <span className="mi-footer-spacer" />
        <span className="mi-legend">
          ● 正常 <i>●</i> 关注 <em>●</em> 预警
        </span>
        <a href="https://openfreemap.org/" target="_blank" rel="noopener noreferrer">
          OpenFreeMap
        </a>
        <a href="https://openmaptiles.org/" target="_blank" rel="noopener noreferrer">
          © OpenMapTiles
        </a>
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noopener noreferrer"
        >
          © OpenStreetMap
        </a>
        <a
          href="https://www.naturalearthdata.com/about/terms-of-use/"
          target="_blank"
          rel="noopener noreferrer"
        >
          Natural Earth
        </a>
        <a
          href="https://versatiles.org/sources/"
          target="_blank"
          rel="noopener noreferrer"
        >
          卫星影像来源
        </a>
        <a
          href="https://doi.org/10.5281/zenodo.6361763"
          target="_blank"
          rel="noopener noreferrer"
        >
          历史航线来源
        </a>
        <strong>公开来源已接入 · 其他数据待接入</strong>
      </footer>
      {analysisTopic && (
        <AnalysisWindow
          commodity={commodity}
          period={period}
          topic={analysisTopic}
          onClose={closeAnalysis}
          onSelectTopic={openAnalysis}
        />
      )}
      {toolOpen && (
        <CalculatorWorkspace
          onClose={() => {
            setToolOpen(false);
            window.location.hash = "#/market-intelligence";
          }}
        />
      )}
      {guideOpen && <MarketButtonGuide onClose={() => setGuideOpen(false)} />}
    </main>
  );
}
