import type { StorageFacilityRelation } from "../../domain/operationalFacilities";

export type RealisticSituationIconKind = StorageFacilityRelation | "RAILWAY";

export function loadSvgMarkerImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Unable to decode map marker SVG"));
    image.src = source;
  });
}

const DEPOT_COLORS: Readonly<Record<StorageFacilityRelation, string>> = {
  OWNED: "#198754",
  LEASED: "#d99a00",
  HISTORICAL_LEASED: "#747b83",
};

const DEPOT_LABELS: Readonly<Record<StorageFacilityRelation, string>> = {
  OWNED: "自有库",
  LEASED: "租赁库",
  HISTORICAL_LEASED: "历史租赁库",
};

export function realisticSituationIcon(kind: RealisticSituationIconKind) {
  if (kind === "RAILWAY") return svgDataUrl(dieselLocomotiveSvg());
  return svgDataUrl(grainDepotSvg(kind));
}

export function realisticWeatherIcon(weatherCode: number | null | undefined) {
  if (
    weatherCode !== null &&
    weatherCode !== undefined &&
    weatherCode >= 71 &&
    weatherCode <= 86
  )
    return svgDataUrl(weatherSvg("降雪", "snow"));
  if (
    weatherCode !== null &&
    weatherCode !== undefined &&
    weatherCode >= 51 &&
    weatherCode <= 67
  )
    return svgDataUrl(weatherSvg("降雨", "rain"));
  if (weatherCode !== null && weatherCode !== undefined && weatherCode >= 95)
    return svgDataUrl(weatherSvg("雷暴", "storm"));
  if (weatherCode !== null && weatherCode !== undefined && weatherCode >= 2)
    return svgDataUrl(weatherSvg("多云", "cloud"));
  return svgDataUrl(weatherSvg("晴间多云", "clear"));
}

function grainDepotSvg(kind: StorageFacilityRelation) {
  const color = DEPOT_COLORS[kind];
  const label = DEPOT_LABELS[kind];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" role="img" aria-label="${label}粮库">
  <title>${label}粮库</title>
  <circle cx="32" cy="32" r="27" fill="rgba(18,27,21,.82)" stroke="#ffffff" stroke-width="2"/>
  <path d="M14 29 32 17l18 12v21H14Z" fill="${color}" stroke="#ffffff" stroke-width="2" stroke-linejoin="round"/>
  <path d="M20 27v-7h7v2.5M37 50V34h8v16M20 36h11M20 42h11" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round"/>
  <path d="M18 29h28" stroke="#ffffff" stroke-width="2"/>
</svg>`;
}

function dieselLocomotiveSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="72" height="64" viewBox="0 0 72 64" role="img" aria-label="白色内燃机车">
  <title>白色内燃机车</title>
  <circle cx="36" cy="32" r="28" fill="rgba(19,27,30,.82)" stroke="#ffffff" stroke-width="2"/>
  <path d="M14 39h7l4-16h22l9 9v7h4v7H14Z" fill="#ffffff" stroke="#1f2c30" stroke-width="1.5" stroke-linejoin="round"/>
  <path d="M29 27h14l5 5H27Z" fill="#6d7c80"/>
  <path d="M18 36h35M20 42h34" stroke="#1f2c30" stroke-width="2"/>
  <circle cx="26" cy="47" r="5" fill="#1f2c30" stroke="#ffffff" stroke-width="2"/>
  <circle cx="49" cy="47" r="5" fill="#1f2c30" stroke="#ffffff" stroke-width="2"/>
</svg>`;
}

function weatherSvg(
  label: string,
  kind: "clear" | "cloud" | "rain" | "snow" | "storm",
) {
  const precipitation =
    kind === "rain" || kind === "storm"
      ? `<path d="M25 44l-4 9M37 44l-4 9M49 44l-4 9" stroke="#8bd4ee" stroke-width="3" stroke-linecap="round"/>`
      : kind === "snow"
        ? `<text x="19" y="55" fill="#ffffff" font-size="18">✣ ✣</text>`
        : "";
  const lightning =
    kind === "storm"
      ? `<path d="m38 40-6 10h6l-3 9 11-14h-7l4-5Z" fill="#f0c341"/>`
      : "";
  const sun =
    kind === "clear"
      ? `<circle cx="24" cy="24" r="10" fill="#f2c94c" stroke="#fff4c2" stroke-width="2"/>`
      : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="72" height="64" viewBox="0 0 72 64" role="img" aria-label="${label}">
  <title>${label}</title>${sun}
  <path d="M20 42c-7 0-11-4-11-10s5-11 12-11c3-7 9-11 17-11 11 0 20 8 20 19 4 1 7 5 7 9 0 6-4 10-11 10H20Z" fill="#f3f6f6" stroke="#5e6f73" stroke-width="2"/>
  ${precipitation}${lightning}
</svg>`;
}

function svgDataUrl(svg: string) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
