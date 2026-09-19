# Public Situation Realistic Geographic Digital Twin Design

**Status:** Approved direction. This design supersedes the visual direction in `2026-09-19-public-situation-globe.md` while preserving its data and hierarchy requirements.

## Outcome

Public Situation becomes a realistic three-dimensional geographic view of Qiqihar, Heihe, Hulunbuir, and Daxing'anling. The terrain and imagery are the main interface. Controls stay quiet and compact. The existing platform navigation, permissions, administrative hierarchy, region data, sample workflows, and submitted records remain unchanged.

## Visual language

- Use a full-bleed Cesium globe with real surface imagery, terrain relief when the provider is available, natural atmosphere, sunlight, and restrained administrative overlays.
- Do not use cockpit panels, neon borders, ornamental grids, large KPI walls, fake extrusions, or decorative gradients.
- Use small translucent white/charcoal control surfaces with 4 px corner radii and clear text. The map must remain visible beneath every control.
- Administrative boundaries are thin, geographically accurate lines. Selection uses a low-opacity natural amber fill and a brighter boundary, not a raised synthetic plate.
- First entry frames all four operating regions. Single click selects and opens detail; double click or explicit drill enters the next administrative level. Camera altitude determines which city, county, township, or village labels and features are visible.

## Map layers and interaction

One persistent Cesium Viewer owns the whole Public Situation session. Region changes update primitives and camera state without remounting the viewer.

Layer controls are explicit filters:

- Live weather: weather-dependent animated glyphs and a selected-region weather effect derived from the current observation.
- Owned depots: green grain warehouse glyph.
- Leased depots: yellow grain warehouse glyph.
- Historical leased depots: gray grain warehouse glyph.
- Railway stations: white diesel-locomotive glyph.
- Railway and logistics paths: geographically grounded lines with restrained directional movement; only persisted or sourced routes are shown.

Turning on one depot category shows only that category when the user uses the category focus action. General layer toggles may show multiple categories together. Markers and routes use Cesium collections/primitives rather than one DOM element per record.

The map is bounded by the four-region operating extent at root. Lower-level selection keeps the camera inside the selected administrative area. Zooming and drilling never removes the current boundary or reveals an empty canvas.

## Weather

Weather continues to be fetched by the backend cache and single-flight refresh path. The browser never fans out direct requests to public weather services.

The selected-region panel presents:

1. region and administrative level;
2. a large animated sky scene that reflects the current weather code, precipitation, cloud cover, wind, and time of day;
3. observation time, temperature, precipitation, wind, soil moisture where available, and data precision;
4. a short crop-risk statement based only on available observations;
5. one collapsed source row.

Prefecture, county, and township observations use governed representative coordinates. A village without a reliable observation inherits its township observation and is labelled as township-level coverage. No invented village weather is displayed.

## Right-side detail

The panel is a single focused inspector, not a dashboard. Its header shows the selected place or node. A small segmented switch selects Weather, Depots, Railway, or Logistics. Only the active detail is rendered.

- Weather uses the live visual described above.
- Depot detail shows relation type, capacity, address, status, price if a sourced value exists, and last update.
- Railway detail shows node type, lines, connected nodes, and recorded logistics movements.
- Logistics shows current inventory totals and recorded movements for the selected scope.

Long provenance lists, NASA article cards, and raw diagnostic text stay collapsed. Scrolling occurs inside the inspector and cannot move or cover the map controls.

## Facility submission and import

Owned and leased facilities are user-governed business records. They are never generated or inserted by AI.

The existing create/edit/archive form remains the single-record path. A new XLSX template and atomic import path supports bulk entry. The backend validates permission and every row before writing. If any row fails, no rows are saved. The response identifies the spreadsheet row number, field, and concrete reason.

## Performance and failure behavior

- Map shell and inspector appear within 1 second on a warm local load.
- A usable four-region globe appears within 2 seconds when local Cesium fallback imagery is available.
- Operational feeds load independently; a slow feed never replaces the map with a blank screen.
- No railway or depot record creates a DOM marker.
- The viewer survives filters, selections, background refreshes, and hierarchy changes.
- Online imagery and terrain are optional enhancements. Local Natural Earth imagery and an ellipsoid globe render immediately; provider failure leaves the map usable and visible.
- Cesium's request scheduler, browser cache, backend weather cache, and existing single-flight refresh prevent uncontrolled request bursts.

## Accessibility and truthfulness

Every icon has a text label in the legend and inspector. Color is not the only distinction: warehouse and locomotive silhouettes and category abbreviations remain distinct. Keyboard focus, Escape-to-close, and readable contrast are preserved.

The interface never presents an estimate as a measured value, never fabricates routes or facilities, and always exposes a concise source/precision label for public data.

## Acceptance

Local browser acceptance must prove:

- immediate four-region realistic 3D overview;
- city → county → township → village drill and reverse navigation;
- camera-constrained pan/zoom and boundary persistence;
- automatic label/layer detail by altitude;
- live weather visual and inherited-precision label;
- independent filters for all three depot categories and white diesel locomotive railway markers;
- selected-node route display;
- depot form persistence and XLSX import with atomic row errors;
- no blank map during refresh, no delayed DOM marker flood, and a fully scrollable inspector.

