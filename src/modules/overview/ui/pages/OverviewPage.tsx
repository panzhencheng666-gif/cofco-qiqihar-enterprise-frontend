import { useEffect, useMemo, useState } from "react";

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
    if (!productCode || !periodCode) return;
    let live = true;
    repository
      .regions({ productCode, periodCode, ...(parentCode ? { parentCode } : {}) })
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

  function selectRegion(region: OverviewRegion) {
    setSelectedRegionCode(region.code);
    setIssue(undefined);
  }

  function drillDown(region: OverviewRegion) {
    if (region.level === "VILLAGE") return;
    setParentCode(region.code);
    setSelectedRegionCode("");
    setIssue(undefined);
  }

  function returnToParent() {
    if (!parentCode) return;
    const currentParent = regions.find(
      (region) => region.code === parentCode,
    )?.parentCode;
    setParentCode(currentParent);
    setSelectedRegionCode("");
  }

  if (!options)
    return (
      <main className="ledger-panel list-workbench-loading">正在加载总览监测</main>
    );

  return (
    <main className="overview-page">
      <header className="page-heading">
        <p>总览监测 / 核定事实聚合</p>
        <h1>粮食商情总览</h1>
        <span>
          指标只读聚合自已核定产情、市场、物流和正式供需计算，不维护第二套业务事实。
        </span>
      </header>
      <section className="ledger-panel overview-filter-bar" aria-label="总览筛选条件">
        <label>
          产品
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
          业务期间
          <select
            value={periodCode}
            onChange={(event) => setPeriodCode(event.target.value)}
          >
            {options.periods.map((item) => (
              <option key={item.code} value={item.code}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          市场年度
          <input
            value={marketingYear}
            onChange={(event) => setMarketingYear(event.target.value)}
            placeholder="未指定则不汇总供需"
          />
        </label>
        <span className="overview-period-note">
          {selectedPeriod
            ? `${selectedPeriod.startsOn} 至 ${selectedPeriod.endsOn}`
            : ""}
        </span>
      </section>
      {!options.periods.length && (
        <p className="page-alert" role="status">
          当前没有已配置的正式业务期间；请由主数据治理流程维护期间后再读取总览指标。
        </p>
      )}
      {issue && (
        <p className="page-alert" role="alert">
          {issue}
        </p>
      )}
      <section className="overview-workspace">
        <article className="ledger-panel overview-map-panel">
          <header>
            <div>
              <h2>行政区与核定记录覆盖</h2>
              <p>地图来自数据库中的版本化真实行政区边界。</p>
            </div>
            {parentCode && (
              <button type="button" onClick={returnToParent}>
                返回上级
              </button>
            )}
          </header>
          <BoundaryMap
            features={mapFeatures}
            selectedCode={selectedRegionCode}
            onSelect={selectRegion}
            onDrill={drillDown}
          />
          <div className="overview-region-list">
            {regions.map((region) => (
              <button
                aria-pressed={selectedRegionCode === region.code}
                key={region.code}
                onClick={() => selectRegion(region)}
                type="button"
              >
                <strong>{region.name}</strong>
                <span>已核定 {region.approvedRecordCount} 条</span>
              </button>
            ))}
          </div>
        </article>
        <article className="ledger-panel overview-indicator-panel">
          <header>
            <h2>{selectedRegion?.name ?? "请选择地区"}核定指标</h2>
            <p>
              {marketingYear
                ? `供需市场年度：${marketingYear}`
                : "未指定市场年度时，供需指标不参与汇总。"}
            </p>
          </header>
          <table>
            <thead>
              <tr>
                <th>指标</th>
                <th>数值</th>
                <th>来源</th>
                <th>核定记录</th>
              </tr>
            </thead>
            <tbody>
              {indicators.map((indicator) => (
                <tr key={indicator.code}>
                  <td>{indicator.name}</td>
                  <td>
                    <strong>{formatValue(indicator.value)}</strong> {indicator.unitCode}
                  </td>
                  <td>{domainLabel(indicator.sourceDomain)}</td>
                  <td>{indicator.sourceCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!indicators.length && (
            <p className="overview-empty">请选择已配置地区以读取核定指标。</p>
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
  const bounds = mapBounds(features);
  if (!features.length || !bounds)
    return <p className="overview-empty">当前范围尚未导入经核验的行政区边界。</p>;
  return (
    <svg
      aria-label="行政区边界地图"
      className="overview-boundary-map"
      role="img"
      viewBox="0 0 1000 640"
    >
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
function formatValue(value: string) {
  return new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 2 }).format(
    Number(value),
  );
}
