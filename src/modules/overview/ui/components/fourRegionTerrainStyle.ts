import type {
  ExpressionSpecification,
  LayerSpecification,
  SourceSpecification,
  StyleSpecification,
} from "maplibre-gl";
import { satelliteTileUrl } from "./mapImageryMetadata";

export type TerrainSurfaceMode = "SANDBOX" | "FUSION" | "IMAGERY";

export function publicBoundaryHierarchy(drilled: boolean): {
  rootOpacity: number | ExpressionSpecification;
  activeOpacity: number | ExpressionSpecification;
  rootLabels: "none" | "visible";
} {
  return {
    rootOpacity: 0,
    activeOpacity: 0,
    rootLabels: drilled ? "none" : "visible",
  };
}

export const FACILITY_ICON_SIZE: ExpressionSpecification = [
  "interpolate",
  ["exponential", 1.45],
  ["zoom"],
  4,
  0.16,
  6,
  0.25,
  8,
  0.5,
  10,
  0.9,
  12,
  1.5,
  14,
  2.3,
  16,
  3.2,
  18,
  4.2,
  20,
  5.3,
  22,
  6.5,
];

export const OPERATIONAL_FACILITY_ICON_SIZE: ExpressionSpecification = [
  "interpolate",
  ["exponential", 1.45],
  ["zoom"],
  4,
  ["case", ["==", ["get", "kind"], "RAILWAY"], 0.24, 0.75],
  6,
  ["case", ["==", ["get", "kind"], "RAILWAY"], 0.375, 0.8],
  8,
  ["case", ["==", ["get", "kind"], "RAILWAY"], 0.75, 0.85],
  10,
  ["case", ["==", ["get", "kind"], "RAILWAY"], 1.35, 0.9],
  12,
  ["case", ["==", ["get", "kind"], "RAILWAY"], 2.25, 1.5],
  14,
  ["case", ["==", ["get", "kind"], "RAILWAY"], 3.45, 2.3],
  16,
  ["case", ["==", ["get", "kind"], "RAILWAY"], 4.8, 3.2],
  18,
  ["case", ["==", ["get", "kind"], "RAILWAY"], 6.3, 4.2],
  20,
  ["case", ["==", ["get", "kind"], "RAILWAY"], 7.95, 5.3],
  22,
  ["case", ["==", ["get", "kind"], "RAILWAY"], 9.75, 6.5],
];

const TERRAIN_TILES = ["cofco-terrain://{z}/{x}/{y}.png"];

export const FOUR_REGION_BASE_STYLE: StyleSpecification = {
  version: 8,
  glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
  sources: {},
  layers: [
    {
      id: "atlas-empty-world",
      type: "background",
      paint: { "background-color": "#223b38" },
    },
  ],
};

export function fourRegionRemoteSources(
  imageryVersion?: string,
): Record<string, SourceSpecification> {
  return {
    satellite: {
      type: "raster",
      tiles: [satelliteTileUrl(imageryVersion)],
      tileSize: 256,
      maxzoom: 18,
      attribution: "Copernicus Sentinel-2；不可用区域由企业影像网关提供历史底图",
    },
    "terrain-dem": {
      type: "raster-dem",
      tiles: TERRAIN_TILES,
      tileSize: 256,
      maxzoom: 15,
      encoding: "terrarium",
      attribution:
        '<a href="https://registry.opendata.aws/terrain-tiles/">Mapzen Terrain Tiles on AWS</a>',
    },
    "hillshade-dem": {
      type: "raster-dem",
      tiles: TERRAIN_TILES,
      tileSize: 256,
      maxzoom: 12,
      encoding: "terrarium",
    },
    openmaptiles: {
      type: "vector",
      url: "https://tiles.openfreemap.org/planet",
      attribution:
        '<a href="https://openfreemap.org/">OpenFreeMap</a> © OpenMapTiles · <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
    },
  };
}

export const FOUR_REGION_REMOTE_SOURCES = fourRegionRemoteSources();

const chineseName: ExpressionSpecification = [
  "coalesce",
  ["get", "name:zh-Hans"],
  ["get", "name:zh"],
  "",
];

export const FOUR_REGION_DETAIL_LAYERS: LayerSpecification[] = [
  {
    id: "atlas-satellite",
    type: "raster",
    source: "satellite",
    paint: {
      "raster-opacity": zoomOpacity(0.34, 0.54, 0.78, 0.92),
      "raster-brightness-min": 0.1,
      "raster-brightness-max": 0.9,
      "raster-contrast": 0.2,
      "raster-saturation": -0.32,
      "raster-fade-duration": 120,
    },
  },
  {
    id: "atlas-terrain-light",
    type: "hillshade",
    source: "hillshade-dem",
    paint: {
      "hillshade-accent-color": "#cdb478",
      "hillshade-exaggeration": 0.78,
      "hillshade-highlight-color": "#fff3d5",
      "hillshade-shadow-color": "#153229",
    },
  },
  {
    id: "atlas-landcover",
    type: "fill",
    source: "openmaptiles",
    "source-layer": "landcover",
    minzoom: 5,
    paint: {
      "fill-color": [
        "match",
        ["get", "class"],
        "wood",
        "#41624a",
        "grass",
        "#6f7950",
        "farmland",
        "#9a8454",
        "#6e7657",
      ],
      "fill-opacity": [
        "interpolate",
        ["linear"],
        ["zoom"],
        5,
        0.24,
        10,
        0.17,
        14,
        0.06,
      ],
    },
  },
  {
    id: "atlas-water",
    type: "fill",
    source: "openmaptiles",
    "source-layer": "water",
    minzoom: 4,
    paint: { "fill-color": "#5591a2", "fill-opacity": 0.72 },
  },
  {
    id: "atlas-waterways",
    type: "line",
    source: "openmaptiles",
    "source-layer": "waterway",
    minzoom: 7,
    paint: {
      "line-color": "#7eb7c5",
      "line-opacity": 0.82,
      "line-width": ["interpolate", ["linear"], ["zoom"], 7, 0.5, 14, 2.2],
    },
  },
  {
    id: "atlas-minor-roads",
    type: "line",
    source: "openmaptiles",
    "source-layer": "transportation",
    minzoom: 12,
    filter: [
      "in",
      ["get", "class"],
      ["literal", ["tertiary", "minor", "service", "track", "path"]],
    ],
    paint: {
      "line-color": "#9daea9",
      "line-opacity": 0.8,
      "line-width": ["interpolate", ["linear"], ["zoom"], 12, 0.35, 17, 1.1],
    },
  },
  {
    id: "atlas-roads",
    type: "line",
    source: "openmaptiles",
    "source-layer": "transportation",
    minzoom: 6,
    filter: [
      "in",
      ["get", "class"],
      ["literal", ["motorway", "trunk", "primary", "secondary"]],
    ],
    paint: {
      "line-color": [
        "match",
        ["get", "class"],
        "motorway",
        "#f3c45f",
        "trunk",
        "#e3b866",
        "primary",
        "#ead994",
        "secondary",
        "#d9ddbd",
        "#b6c6b7",
      ],
      "line-opacity": 0.9,
      "line-width": ["interpolate", ["linear"], ["zoom"], 6, 0.45, 14, 4.5],
    },
  },
  {
    id: "atlas-base-railways",
    type: "line",
    source: "openmaptiles",
    "source-layer": "transportation",
    minzoom: 6,
    filter: ["in", ["get", "class"], ["literal", ["rail", "transit"]]],
    paint: {
      "line-color": "#d5ded8",
      "line-width": 1.2,
      "line-dasharray": [3, 2],
      "line-opacity": 0.75,
    },
  },
  {
    id: "atlas-buildings",
    type: "fill-extrusion",
    source: "openmaptiles",
    "source-layer": "building",
    minzoom: 12,
    paint: {
      "fill-extrusion-color": "#d8d0bc",
      "fill-extrusion-height": ["coalesce", ["to-number", ["get", "render_height"]], 5],
      "fill-extrusion-base": [
        "coalesce",
        ["to-number", ["get", "render_min_height"]],
        0,
      ],
      "fill-extrusion-opacity": 0.58,
    },
  },
  {
    id: "atlas-place-labels",
    type: "symbol",
    source: "openmaptiles",
    "source-layer": "place",
    minzoom: 7,
    filter: [
      "in",
      ["get", "class"],
      [
        "literal",
        ["city", "town", "village", "hamlet", "isolated_dwelling", "neighbourhood"],
      ],
    ],
    layout: {
      "text-field": chineseName,
      "text-font": ["Noto Sans Regular"],
      "text-size": ["interpolate", ["linear"], ["zoom"], 5, 11, 12, 15],
      "text-allow-overlap": false,
    },
    paint: {
      "text-color": "#fffdf2",
      "text-halo-color": "#26332d",
      "text-halo-width": 1.5,
    },
  },
  {
    id: "atlas-road-labels",
    type: "symbol",
    source: "openmaptiles",
    "source-layer": "transportation_name",
    minzoom: 13,
    layout: {
      "symbol-placement": "line",
      "text-field": chineseName,
      "text-font": ["Noto Sans Regular"],
      "text-size": 11,
    },
    paint: {
      "text-color": "#aebdb7",
      "text-halo-color": "#3e443b",
      "text-halo-width": 1.2,
    },
  },
  {
    id: "atlas-poi-labels",
    type: "symbol",
    source: "openmaptiles",
    "source-layer": "poi",
    minzoom: 13,
    layout: {
      "text-field": chineseName,
      "text-font": ["Noto Sans Regular"],
      "text-size": 10,
      "text-max-width": 8,
    },
    paint: {
      "text-color": "#f6f1df",
      "text-halo-color": "#38423b",
      "text-halo-width": 1,
    },
  },
];

export function surfaceModePaint(mode: TerrainSurfaceMode) {
  if (mode === "SANDBOX")
    return {
      satelliteOpacity: zoomOpacity(0.2, 0.34, 0.62, 0.8),
      satelliteSaturation: -0.48,
      satelliteContrast: 0.26,
      hillshadeOpacity: 0.9,
      landcoverOpacity: 0.31,
      terrainExaggeration: 2.6,
    };
  if (mode === "IMAGERY")
    return {
      satelliteOpacity: zoomOpacity(0.78, 0.88, 0.96, 0.98),
      satelliteSaturation: -0.04,
      satelliteContrast: 0.08,
      hillshadeOpacity: 0.38,
      landcoverOpacity: 0.04,
      terrainExaggeration: 1.55,
    };
  return {
    satelliteOpacity: zoomOpacity(0.34, 0.54, 0.78, 0.92),
    satelliteSaturation: -0.32,
    satelliteContrast: 0.2,
    hillshadeOpacity: 0.78,
    landcoverOpacity: 0.2,
    terrainExaggeration: 2.25,
  };
}

function zoomOpacity(
  prefecture: number,
  county: number,
  township: number,
  village: number,
): ExpressionSpecification {
  return [
    "interpolate",
    ["linear"],
    ["zoom"],
    4,
    prefecture,
    8,
    county,
    12,
    township,
    16,
    village,
  ];
}
