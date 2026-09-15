import { useState } from "react";
import type { RegionalAgricultureProfile } from "../../domain/overviewRegionalData";

function display(value: string | number, unit: string) {
  if (value === "" || !Number.isFinite(Number(value))) return "依据不足";
  return `${Number(value).toLocaleString("zh-CN", { maximumFractionDigits: 6 })} ${unit}`;
}

/** Only observations and calculations belonging to the selected region enter this table. */
export function RegionalLocalEstimateComparison({
  profile,
}: {
  profile: RegionalAgricultureProfile;
}) {
  const [query, setQuery] = useState("");
  const crops = profile.crops.map((crop) => ({
    label: `${crop.productName}产量`,
    value: Number(crop.totalOutputKg) / 10000000,
    unit: "万吨",
    year: profile.year,
    observed: crop.dataKind === "OBSERVED",
    method: crop.basis,
    sourceName: "",
    sourceUrl: "",
  }));
  const cropLabels = new Set(crops.map((crop) => crop.label));
  const rows = [
    ...crops,
    ...(profile.indicators ?? [])
      .filter(
        (indicator) =>
          (indicator.dataKind === "OBSERVED" || indicator.dataKind === "ESTIMATED") &&
          !indicator.label.startsWith("上级参考") &&
          !cropLabels.has(indicator.label),
      )
      .map((indicator) => ({
        ...indicator,
        year: indicator.dataYear,
        observed: indicator.dataKind === "OBSERVED",
      })),
  ].filter((row) => row.label.includes(query.trim()));
  return (
    <section className="regional-estimates" aria-label="本地区公开值与估算">
      <header>
        <h3>{profile.regionName} · 本地区指标对照</h3>
      </header>
      <p className="regional-estimates__table-note">
        仅展示{profile.regionName}
        的统计与计算结果。缺少同地区公开值时，不计算误差；上级资料可在农业指标中查看参考范围。
      </p>
      <label className="regional-estimates__search">
        查找本地区指标
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="稻谷、播种面积…"
        />
      </label>
      <div className="regional-estimates__table-wrap">
        <table className="regional-estimates__table" aria-label="本地区指标对照表">
          <thead>
            <tr>
              <th>指标 / 年度</th>
              <th>本地区公开值</th>
              <th>本地区估算</th>
              <th>依据</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.label}-${row.year}-${row.unit}`}>
                <th scope="row">
                  {row.label}
                  <small>
                    {row.year}年 · {row.unit}
                  </small>
                </th>
                <td>
                  {row.observed ? display(row.value, row.unit) : "未取得同地区公开值"}
                </td>
                <td>{row.observed ? "已有公开值" : display(row.value, row.unit)}</td>
                <td>
                  <details>
                    <summary>计算与来源</summary>
                    <p style={{ whiteSpace: "pre-line" }}>{row.method}</p>
                    {row.sourceUrl && (
                      <a href={row.sourceUrl} target="_blank" rel="noreferrer">
                        {row.sourceName || "查看来源"}
                      </a>
                    )}
                  </details>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!rows.length && <p role="status">暂无匹配的本地区统计或估算。</p>}
    </section>
  );
}
