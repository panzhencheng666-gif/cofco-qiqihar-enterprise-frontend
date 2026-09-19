import type {
  ExpressionSpecification,
  LayerSpecification,
  SourceSpecification,
  StyleSpecification,
} from "maplibre-gl";

import { REALISTIC_ROOT_BOUNDS } from "./realisticSituationModel";

export type TerrainSurfaceMode = "SANDBOX" | "FUSION" | "IMAGERY";

export const FOUR_REGION_BASE_STYLE: StyleSpecification = {
  version: 8,
  glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
  sources: {},
  layers: [
    {
      id: "atlas-empty-world",
      type: "background",
      paint: { "background-color": "#101714" },
    },
  ],
};

const ROOT_TILE_BOUNDS: [number, number, number, number] = [
  REALISTIC_ROOT_BOUNDS.minLongitude,
  REALISTIC_ROOT_BOUNDS.minLatitude,
  REALISTIC_ROOT_BOUNDS.maxLongitude,
  REALISTIC_ROOT_BOUNDS.maxLatitude,
];

export const FOUR_REGION_REMOTE_SOURCES: Record<string, SourceSpecification> = {
  satellite: {
    type: "raster",
    tiles: [
      "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    ],
    tileSize: 256,
    maxzoom: 18,
    bounds: ROOT_TILE_BOUNDS,
    attribution:
      '<a href="https://www.esri.com/en-us/legal/terms/full-master-agreement">Esri World Imagery</a>',
  },
  "terrain-dem": {
    type: "raster-dem",
    tiles: ["https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"],
    tileSize: 256,
    maxzoom: 15,
    bounds: ROOT_TILE_BOUNDS,
    encoding: "terrarium",
    attribution:
      '<a href="https://registry.opendata.aws/terrain-tiles/">Mapzen Terrain Tiles on AWS</a>',
  },
  openmaptiles: {
    type: "vector",
    url: "https://tiles.openfreemap.org/planet",
    bounds: ROOT_TILE_BOUNDS,
    attribution:
      '<a href="https://openfreemap.org/">OpenFreeMap</a> © OpenMapTiles · <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
  },
};

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
      "raster-opacity": 0.76,
      "raster-brightness-min": 0.06,
      "raster-brightness-max": 0.92,
      "raster-contrast": 0.12,
      "raster-saturation": -0.18,
      "raster-fade-duration": 120,
    },
  },
  {
    id: "atlas-terrain-light",
    type: "hillshade",
    source: "terrain-dem",
    paint: {
      "hillshade-accent-color": "#cdb478",
      "hillshade-exaggeration": 0.42,
      "hillshade-highlight-color": "#f4ead3",
      "hillshade-shadow-color": "#173126",
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
      "fill-opacity": ["interpolate", ["linear"], ["zoom"], 5, 0.08, 11, 0.24],
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
    id: "atlas-roads-casing",
    type: "line",
    source: "openmaptiles",
    "source-layer": "transportation",
    minzoom: 6,
    paint: {
      "line-color": "#493c2e",
      "line-opacity": 0.58,
      "line-width": ["interpolate", ["linear"], ["zoom"], 6, 1.1, 14, 7],
    },
  },
  {
    id: "atlas-roads",
    type: "line",
    source: "openmaptiles",
    "source-layer": "transportation",
    minzoom: 6,
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
    minzoom: 5,
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
    minzoom: 9,
    layout: {
      "symbol-placement": "line",
      "text-field": chineseName,
      "text-font": ["Noto Sans Regular"],
      "text-size": 11,
    },
    paint: {
      "text-color": "#fff8d8",
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
      satelliteOpacity: 0.38,
      satelliteSaturation: -0.48,
      satelliteContrast: 0.2,
      hillshadeOpacity: 0.82,
    };
  if (mode === "IMAGERY")
    return {
      satelliteOpacity: 0.96,
      satelliteSaturation: -0.04,
      satelliteContrast: 0.08,
      hillshadeOpacity: 0.32,
    };
  return {
    satelliteOpacity: 0.76,
    satelliteSaturation: -0.18,
    satelliteContrast: 0.12,
    hillshadeOpacity: 0.58,
  };
}
