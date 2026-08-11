import { useMemo, useState } from "react";

import type { OverviewRegion } from "../../domain/overview";

const MAX_VISIBLE_RESULTS = 80;

export function RegionDirectorySearch({
  label,
  regions,
}: {
  label: string;
  regions: readonly OverviewRegion[];
}) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLocaleLowerCase("zh-CN");
  const matches = useMemo(
    () =>
      normalizedQuery
        ? regions.filter((region) =>
            `${region.name} ${region.code}`
              .toLocaleLowerCase("zh-CN")
              .includes(normalizedQuery),
          )
        : regions,
    [normalizedQuery, regions],
  );
  const visibleMatches = matches.slice(0, MAX_VISIBLE_RESULTS);

  return (
    <div className="overview-region-directory-search">
      <label>
        <span>
          {label}
          <strong>{regions.length}</strong>
        </span>
        <input
          aria-label={`搜索${label}名称`}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={regions.length ? `输入${label}名称或代码` : "暂无地区"}
          type="search"
          value={query}
        />
      </label>
      <ul aria-label={`${label}名称列表`}>
        {visibleMatches.map((region) => (
          <li key={region.code}>
            <span>{region.name}</span>
            <small>{region.code}</small>
          </li>
        ))}
        {!visibleMatches.length && <li className="is-empty">暂无地区</li>}
      </ul>
      {matches.length > visibleMatches.length && (
        <small className="overview-region-directory-hint">
          继续输入名称可检索其余 {matches.length - visibleMatches.length} 个地区
        </small>
      )}
    </div>
  );
}
