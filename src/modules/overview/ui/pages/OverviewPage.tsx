import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { OverviewRepository } from "../../application/ports/OverviewRepository";
import type {
  OverviewIndicator,
  OverviewOptions,
  OverviewRegion,
} from "../../domain/overview";

type Geometry = {
  type: "Polygon" | "MultiPolygon";
  coordinates: Position[][] | Position[][][];
};
type Position = readonly [number, number];

interface MapFeature {
  region: OverviewRegion;
  geometry: Geometry;
}

export function OverviewPage({ repository }: { repository: OverviewRepository }) {
  const [options, setOptions] = useState<OverviewOptions>();
  const [regions, setRegions] = useState<readonly OverviewRegion[]>([]);
  const [indicators, setIndicators] = useState<readonly OverviewIndicator[]>([]);
  const [productCode, setProductCode] = useState("");
  const [periodCode, setPeriodCode] = useState("");
  const [marketingYear, setMarketingYear] = useState("");
  const [selectedRegionCode, setSelectedRegionCode] = useState("");
  const [parentCode, setParentCode] = useState<string>();
  const [parentTrail, setParentTrail] = useState<readonly string[]>([]);
  const [issue, setIssue] = useState<string>();

  useEffect(() => {
    let live = true;
    repository
      .options()
      .then((next) => {
        if (!live) return;
        setOptions(next);
        setProductCode((current) => current || next.products[0]?.code || "");
        setPeriodCode((current) => current || next.periods[0]?.code || "");
      })
      .catch(() => live && setIssue("总览筛选条件加载失败，请稍后重试。"));
    return () => {
      live = false;
    };
  }, [repository]);

  useEffect(() => {
    if (!productCode) return;
    let live = true;
    repository
      .regions({
        productCode,
        ...(periodCode ? { periodCode } : {}),
        ...(parentCode ? { parentCode } : {}),
      })
      .then((next) => {
        if (!live) return;
        setRegions(next);
        setSelectedRegionCode((current) =>
          next.some((region) => region.code === current)
            ? current
            : next[0]?.code || "",
        );
      })
      .catch(() => live && setIssue("总览地区边界或统计范围加载失败，请重试。"));
    return () => {
      live = false;
    };
  }, [parentCode, periodCode, productCode, repository]);

  useEffect(() => {
    if (!productCode || !periodCode || !selectedRegionCode) return;
    let live = true;
    repository
      .indicators({
        productCode,
        periodCode,
        regionCode: selectedRegionCode,
        ...(marketingYear ? { marketingYear } : {}),
      })
      .then((next) => live && setIndicators(next))
      .catch(() => live && setIssue("核定指标加载失败，请检查筛选条件。"));
    return () => {
      live = false;
    };
  }, [marketingYear, periodCode, productCode, repository, selectedRegionCode]);

  const selectedRegion = regions.find((region) => region.code === selectedRegionCode);
  const mapFeatures = useMemo(() => regions.flatMap(toMapFeature), [regions]);
  const selectedPeriod = options?.periods.find((period) => period.code === periodCode);
  const approvedRecordCount = regions.reduce(
    (total, region) => total + region.approvedRecordCount,
    0,
  );
  const indicatorLanes = indicatorLaneSummary(indicators, Boolean(periodCode));

  function selectRegion(region: OverviewRegion) {
    setSelectedRegionCode(region.code);
    setIssue(undefined);
  }

  function drillDown(region: OverviewRegion) {
    if (region.level === "VILLAGE") return;
    setParentTrail((trail) => [...trail, parentCode ?? ""]);
    setParentCode(region.code);
    setSelectedRegionCode("");
    setIssue(undefined);
  }

  function returnToParent() {
    if (!parentCode) return;
    const priorParent = parentTrail[parentTrail.length - 1];
    setParentCode(priorParent || undefined);
    setParentTrail((trail) => trail.slice(0, -1));
    setSelectedRegionCode("");
  }

  if (!options)
    return (
      <main className="ledger-panel list-workbench-loading">正在加载总览监测</main>
    );

  return (
    <main className="overview-page overview-cockpit">
      <header className="overview-command-header">
        <div>
          <p>总览监测 · 真实行政区地图</p>
          <h1>粮食商情总览</h1>
          <span>以真实行政区边界定位区域，以核定业务事实支撑管理判断。</span>
        </div>
        <div className="overview-command-status" aria-label="当前数据口径">
          <span>当前口径</span>
          <strong>{selectedPeriod?.label ?? "等待业务期间"}</strong>
          <em>
            {selectedPeriod
              ? `${selectedPeriod.startsOn} 至 ${selectedPeriod.endsOn}`
              : "地图可用，指标等待配置"}
          </em>
        </div>
      </header>

      <section className="overview-control-deck" aria-label="总览筛选条件">
        <label>
          <span>监测产品</span>
          <select
            value={productCode}
            onChange={(event) => setProductCode(event.target.value)}
          >
            {options.products.map((item) => (
              <option key={item.code} value={item.code}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>业务期间</span>
          <select
            value={periodCode}
            onChange={(event) => setPeriodCode(event.target.value)}
          >
            <option value="">请选择正式业务期间</option>
            {options.periods.map((item) => (
              <option key={item.code} value={item.code}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>市场年度</span>
          <input
            value={marketingYear}
            onChange={(event) => setMarketingYear(event.target.value)}
            placeholder="供需汇总可选"
          />
        </label>
        <div className="overview-control-note">
          <strong>{mapFeatures.length}</strong>
          <span>已接入本层级边界</span>
        </div>
      </section>

      {!options.periods.length && (
        <p className="overview-guidance" role="status">
          尚未配置正式业务期间：行政区地图已可查看，核定指标会在主数据治理完成期间配置后自动接入。
        </p>
      )}
      {issue && (
        <p className="overview-guidance is-error" role="alert">
          {issue}
        </p>
      )}

      <section className="overview-cockpit-grid">
        <article className="overview-side-panel overview-coverage-panel">
          <header>
            <p>区域态势</p>
            <h2>行政区覆盖</h2>
          </header>
          <div className="overview-coverage-total">
            <strong>{approvedRecordCount}</strong>
            <span>本层级核定记录</span>
          </div>
          <div className="overview-region-list" aria-label="行政区列表">
            {regions.map((region) => (
              <button
                aria-pressed={selectedRegionCode === region.code}
                key={region.code}
                onClick={() => selectRegion(region)}
                type="button"
              >
                <strong>{region.name}</strong>
                <span>
                  {periodCode
                    ? `核定 ${region.approvedRecordCount} 条`
                    : "等待期间汇总"}
                </span>
              </button>
            ))}
          </div>
          {!regions.length && (
            <p className="overview-empty">当前层级没有可展示的行政区。</p>
          )}
        </article>

        <article className="overview-radar-panel">
          <header>
            <div>
              <p>地理研判</p>
              <h2>{parentCode ? "下钻区域" : "区域总览"}</h2>
            </div>
            {parentCode && (
              <button type="button" onClick={returnToParent}>
                返回上级
              </button>
            )}
          </header>
          <div className="overview-map-stage">
            <BoundaryMap
              features={mapFeatures}
              selectedCode={selectedRegionCode}
              onSelect={selectRegion}
              onDrill={drillDown}
            />
          </div>
          <footer>
            <span>单击选择地区</span>
            <span>双击下钻层级</span>
            <span>真实边界已版本化入库</span>
          </footer>
        </article>

        <article className="overview-side-panel overview-indicator-panel">
          <header>
            <p>核定指标</p>
            <h2>{selectedRegion?.name ?? "请选择地区"}</h2>
          </header>
          <div className="overview-selection-meta">
            <span>当前地区</span>
            <strong>{selectedRegion?.name ?? "请在地图或列表选择"}</strong>
            <em>
              {selectedRegion
                ? periodCode
                  ? `本地区已纳入 ${selectedRegion.approvedRecordCount} 条核定记录`
                  : "已定位真实行政区边界，等待业务期间"
                : "单击地图区域后，展示关联业务数据"}
            </em>
          </div>
          <div className="overview-domain-lanes" aria-label="业务域核定状态">
            {indicatorLanes.map((lane) => (
              <div key={lane.label}>
                <span>{lane.label}</span>
                <strong>{lane.text}</strong>
              </div>
            ))}
          </div>
          <table>
            <thead>
              <tr>
                <th>指标</th>
                <th>数值</th>
                <th>来源</th>
                <th>记录</th>
              </tr>
            </thead>
            <tbody>
              {indicators.map((indicator) => (
                <tr key={indicator.code}>
                  <td>{indicator.name}</td>
                  <td>
                    <strong>{formatValue(indicator.value)}</strong>
                    <small>{indicator.unitCode}</small>
                  </td>
                  <td>{domainLabel(indicator.sourceDomain)}</td>
                  <td>{indicator.sourceCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!indicators.length && (
            <p className="overview-empty">
              {periodCode
                ? "请选择地区后读取核定指标。"
                : "选择正式业务期间后读取核定指标。"}
            </p>
          )}
        </article>
      </section>
    </main>
  );
}

function toMapFeature(region: OverviewRegion): MapFeature[] {
  if (!region.boundaryGeoJson) return [];
  try {
    const geometry = JSON.parse(region.boundaryGeoJson) as Geometry;
    return ["Polygon", "MultiPolygon"].includes(geometry.type)
      ? [{ region, geometry }]
      : [];
  } catch {
    return [];
  }
}

function BoundaryMap({
  features,
  selectedCode,
  onSelect,
  onDrill,
}: {
  features: readonly MapFeature[];
  selectedCode: string;
  onSelect: (region: OverviewRegion) => void;
  onDrill: (region: OverviewRegion) => void;
}) {
  const [webGlEnabled, setWebGlEnabled] = useState(canRenderWebGlMap);
  const fallBackToStaticMap = useCallback(() => setWebGlEnabled(false), []);
  const bounds = mapBounds(features);
  if (!features.length || !bounds)
    return <p className="overview-empty">当前范围尚无可显示的经核验行政区边界。</p>;
  if (webGlEnabled) {
    return (
      <WebGlBoundaryMap
        features={features}
        selectedCode={selectedCode}
        onDrill={onDrill}
        onSelect={onSelect}
        onUnavailable={fallBackToStaticMap}
      />
    );
  }
  return (
    <StaticBoundaryMap
      bounds={bounds}
      features={features}
      selectedCode={selectedCode}
      onDrill={onDrill}
      onSelect={onSelect}
    />
  );
}

function canRenderWebGlMap() {
  if (
    typeof window === "undefined" ||
    typeof document === "undefined" ||
    typeof ResizeObserver === "undefined"
  ) {
    return false;
  }
  const canvas = document.createElement("canvas");
  return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
}

function WebGlBoundaryMap({
  features,
  selectedCode,
  onSelect,
  onDrill,
  onUnavailable,
}: {
  features: readonly MapFeature[];
  selectedCode: string;
  onSelect: (region: OverviewRegion) => void;
  onDrill: (region: OverviewRegion) => void;
  onUnavailable: () => void;
}) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | undefined>(undefined);
  const currentFeatures = useRef(features);
  const selectRegion = useRef(onSelect);
  const drillRegion = useRef(onDrill);
  const data = useMemo(() => toMapLibreFeatureCollection(features), [features]);

  useEffect(() => {
    currentFeatures.current = features;
    selectRegion.current = onSelect;
    drillRegion.current = onDrill;
  }, [features, onDrill, onSelect]);

  useEffect(() => {
    if (!mapContainer.current) return;
    const nextMap = new maplibregl.Map({
      attributionControl: false,
      bearing: -14,
      center: [126.2, 48.4],
      container: mapContainer.current,
      doubleClickZoom: false,
      maxPitch: 68,
      minZoom: 3,
      pitch: 52,
      renderWorldCopies: false,
      style: {
        version: 8,
        sources: {},
        layers: [
          {
            id: "cockpit-void",
            type: "background",
            paint: { "background-color": "rgba(0, 0, 0, 0)" },
          },
        ],
      },
      zoom: 4.6,
    });
    map.current = nextMap;
    if (
      !nextMap.getCanvas().getContext("webgl2") &&
      !nextMap.getCanvas().getContext("webgl")
    ) {
      nextMap.remove();
      onUnavailable();
      return;
    }
    const selectFeature = (event: maplibregl.MapLayerMouseEvent) => {
      const code = String(event.features?.[0]?.properties?.code ?? "");
      const feature = currentFeatures.current.find(
        (candidate) => candidate.region.code === code,
      );
      if (feature) selectRegion.current(feature.region);
    };
    const drillFeature = (event: maplibregl.MapLayerMouseEvent) => {
      event.preventDefault();
      const code = String(event.features?.[0]?.properties?.code ?? "");
      const feature = currentFeatures.current.find(
        (candidate) => candidate.region.code === code,
      );
      if (feature) drillRegion.current(feature.region);
    };
    const addRegionLayers = () => {
      nextMap.addSource("regions", {
        data: toMapLibreFeatureCollection(currentFeatures.current),
        type: "geojson",
      });
      nextMap.addLayer({
        id: "region-boundary-shadow",
        layout: {},
        paint: {
          "fill-extrusion-base": 0,
          "fill-extrusion-color": "#0b5574",
          "fill-extrusion-height": 13000,
          "fill-extrusion-opacity": 0.46,
          "fill-extrusion-vertical-gradient": true,
        },
        source: "regions",
        type: "fill-extrusion",
      });
      nextMap.addLayer({
        id: "region-boundary-top",
        paint: {
          "fill-color": "#107ca3",
          "fill-opacity": 0.48,
          "fill-outline-color": "#71e2ef",
        },
        source: "regions",
        type: "fill",
      });
      nextMap.addLayer({
        id: "region-boundary-line",
        paint: {
          "line-color": "#72edf7",
          "line-opacity": 0.86,
          "line-width": 1.65,
        },
        source: "regions",
        type: "line",
      });
      nextMap.on("click", "region-boundary-top", selectFeature);
      nextMap.on("dblclick", "region-boundary-top", drillFeature);
      nextMap.on("mouseenter", "region-boundary-top", () => {
        nextMap.getCanvas().style.cursor = "pointer";
      });
      nextMap.on("mouseleave", "region-boundary-top", () => {
        nextMap.getCanvas().style.cursor = "";
      });
      fitMapToFeatures(nextMap, currentFeatures.current);
    };
    if (nextMap.loaded()) addRegionLayers();
    else nextMap.once("load", addRegionLayers);
    const fallbackTimer = window.setTimeout(() => {
      if (!nextMap.getSource("regions")) onUnavailable();
    }, 900);
    return () => {
      window.clearTimeout(fallbackTimer);
      map.current = undefined;
      nextMap.remove();
    };
  }, [onUnavailable]);

  useEffect(() => {
    const activeMap = map.current;
    const source = activeMap?.getSource("regions");
    if (!activeMap || !source || source.type !== "geojson") return;
    void (source as maplibregl.GeoJSONSource).setData(data);
    fitMapToFeatures(activeMap, features);
  }, [data, features]);

  useEffect(() => {
    if (!map.current?.isStyleLoaded() || !map.current.getLayer("region-boundary-top"))
      return;
    const selected: maplibregl.ExpressionSpecification = [
      "==",
      ["get", "code"],
      selectedCode,
    ];
    map.current.setPaintProperty("region-boundary-top", "fill-color", [
      "case",
      selected,
      "#59e5bf",
      "#107ca3",
    ]);
    map.current.setPaintProperty("region-boundary-shadow", "fill-extrusion-color", [
      "case",
      selected,
      "#1aa87e",
      "#0b5574",
    ]);
    map.current.setPaintProperty("region-boundary-shadow", "fill-extrusion-height", [
      "case",
      selected,
      20500,
      13000,
    ]);
  }, [selectedCode]);

  const bounds = mapBounds(features);
  return (
    <div
      aria-label="行政区边界地图"
      className="overview-webgl-shell"
      role="application"
    >
      <div className="overview-webgl-map" ref={mapContainer} />
      {bounds && (
        <div className="overview-webgl-fallback">
          <StaticBoundaryMap
            bounds={bounds}
            features={features}
            onDrill={onDrill}
            onSelect={onSelect}
            selectedCode={selectedCode}
          />
        </div>
      )}
    </div>
  );
}

function toMapLibreFeatureCollection(features: readonly MapFeature[]) {
  return {
    features: features.map(({ region, geometry }) => ({
      geometry,
      properties: { code: region.code, name: region.name },
      type: "Feature" as const,
    })),
    type: "FeatureCollection" as const,
  };
}

function fitMapToFeatures(map: maplibregl.Map, features: readonly MapFeature[]) {
  const bounds = mapBounds(features);
  if (!bounds) return;
  map.fitBounds(
    [
      [bounds.minX, bounds.minY],
      [bounds.maxX, bounds.maxY],
    ],
    { duration: 0, maxZoom: 7.5, padding: 44 },
  );
}

function StaticBoundaryMap({
  bounds,
  features,
  selectedCode,
  onSelect,
  onDrill,
}: {
  bounds: NonNullable<ReturnType<typeof mapBounds>>;
  features: readonly MapFeature[];
  selectedCode: string;
  onSelect: (region: OverviewRegion) => void;
  onDrill: (region: OverviewRegion) => void;
}) {
  return (
    <svg
      aria-label="行政区边界地图"
      className="overview-boundary-map"
      role="img"
      viewBox="0 0 1000 640"
    >
      <defs>
        <radialGradient cx="50%" cy="48%" id="overview-radar-glow" r="56%">
          <stop offset="0%" stopColor="#d7f4ff" stopOpacity="0.94" />
          <stop offset="72%" stopColor="#c6e9ff" stopOpacity="0.42" />
          <stop offset="100%" stopColor="#f3fbff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect fill="url(#overview-radar-glow)" height="640" width="1000" />
      <g aria-hidden="true" className="overview-boundary-depth">
        {features.map(({ region, geometry }) => (
          <path
            d={toPath(geometry, bounds)}
            key={region.code}
            transform="translate(0 26)"
          />
        ))}
      </g>
      {features.map(({ region, geometry }) => (
        <path
          aria-label={`${region.name}，已核定 ${region.approvedRecordCount} 条`}
          className={region.code === selectedCode ? "is-selected" : ""}
          d={toPath(geometry, bounds)}
          key={region.code}
          onClick={() => onSelect(region)}
          onDoubleClick={() => onDrill(region)}
          role="button"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === "Enter") onSelect(region);
          }}
        >
          <title>{`${region.name}：双击下钻；已核定 ${region.approvedRecordCount} 条`}</title>
        </path>
      ))}
    </svg>
  );
}

function mapBounds(features: readonly MapFeature[]) {
  const points = features.flatMap(({ geometry }) => flattenCoordinates(geometry));
  if (!points.length) return undefined;
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}

function flattenCoordinates(geometry: Geometry): Position[] {
  const polygons =
    geometry.type === "Polygon"
      ? [geometry.coordinates as Position[][]]
      : (geometry.coordinates as Position[][][]);
  return polygons.flat(2);
}

function toPath(
  geometry: Geometry,
  bounds: { minX: number; maxX: number; minY: number; maxY: number },
) {
  const width = Math.max(bounds.maxX - bounds.minX, 0.00001);
  const height = Math.max(bounds.maxY - bounds.minY, 0.00001);
  const project = ([x, y]: Position) => [
    20 + ((x - bounds.minX) / width) * 960,
    20 + ((bounds.maxY - y) / height) * 600,
  ];
  const polygons =
    geometry.type === "Polygon"
      ? [geometry.coordinates as Position[][]]
      : (geometry.coordinates as Position[][][]);
  return polygons
    .flatMap((polygon) =>
      polygon.map(
        (ring) =>
          ring
            .map((point, index) => `${index ? "L" : "M"}${project(point).join(" ")}`)
            .join(" ") + " Z",
      ),
    )
    .join(" ");
}

function domainLabel(domain: OverviewIndicator["sourceDomain"]) {
  return {
    PRODUCTION: "产情监测",
    MARKET: "市场监测",
    LOGISTICS: "物流监测",
    SUPPLY: "供需分析",
  }[domain];
}

function indicatorLaneSummary(
  indicators: readonly OverviewIndicator[],
  hasPeriod: boolean,
) {
  const domains: readonly OverviewIndicator["sourceDomain"][] = [
    "PRODUCTION",
    "MARKET",
    "LOGISTICS",
    "SUPPLY",
  ];
  return domains.map((domain) => {
    const count = Math.max(
      0,
      ...indicators
        .filter((indicator) => indicator.sourceDomain === domain)
        .map((indicator) => indicator.sourceCount),
    );
    return {
      label: domainLabel(domain),
      text: hasPeriod ? `${count} 条核定来源` : "等待期间",
    };
  });
}

function formatValue(value: string) {
  return new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 2 }).format(
    Number(value),
  );
}
