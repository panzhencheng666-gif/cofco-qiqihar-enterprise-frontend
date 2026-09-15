# Regional railway map extract

Source: © OpenStreetMap contributors, https://www.openstreetmap.org/copyright
License: Open Database License 1.0 (ODbL), https://opendatacommons.org/licenses/odbl/1-0/
Snapshots: 2026-09-15T05:06:23Z–2026-09-15T05:27:51Z (per-feature times retained). This independent public map extract is not formal business sample data.

One-off extraction endpoints: https://overpass-api.de/api/interpreter and the listed VK Maps public instance https://maps.mail.ru/osm/tools/overpass/api/interpreter. Exact partition queries, timestamps and SHA-256 hashes are embedded in extractionManifest.
Query:
```
[out:json][timeout:60];
(nwr["railway"~"^(station|halt|yard)$"](45.8,115.2,53.9,130.3);
way["railway"="rail"]["name"](45.8,115.2,53.9,130.3););
out geom;
```

The dataset preserves OSM node/way identifiers, all received tags and original coordinates. Ways are represented as GeoJSON LineStrings. Geographic filtering and track clipping happen against the selected administrative boundary in the backend. The extraction bounding box includes neighbouring territory; its total record count must not be presented as the facility count of the four supported prefectures. Absence of a feature is not evidence of absence. Snapshot year is separate from the selected agricultural statistics year.

Derived catalogue: 662 facilities (661 point nodes and one station polygon) and 5698 named track segments; downloadable as `osm-20260915.json`. Parallel tracks are individually represented and length must not be labelled railway operating mileage. Public map tags do not independently verify current passenger/freight availability or transport capacity.

To refresh, retrieve one new snapshot through a permitted OSM source, validate completeness (no Overpass `remark`/timeout), retain license metadata, and import through a reviewed migration. Do not issue browser-triggered uncached Overpass queries or overwrite a published Flyway migration. Existing local and production data remain readable if the upstream service is temporarily unavailable.

The query was partitioned into the original rectangle and four complementary rectangles covering the full target bounds. All responses completed without a remark. The station polygon is retained in the download; the database uses ST_PointOnSurface for its representative location. Unnamed facilities remain explicit unnamed entries, never discarded. Selected-region membership uses the registered business boundary, which can cover only part of a prefecture; it is not a claim of exhaustive municipal facility coverage.
