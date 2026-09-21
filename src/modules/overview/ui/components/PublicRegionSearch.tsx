import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { OverviewRepository } from "../../application/ports/OverviewRepository";
import type { OverviewRegion } from "../../domain/overview";
import { searchPublicRegions, type PublicRegionLevel } from "./publicRegionSearchModel";
import "./public-region-search.css";
import { publicMapFocus } from "./publicMapFocus";

const LEVELS = {
  ALL: "全部层级",
  PREFECTURE: "市 / 地区",
  COUNTY: "县 / 区",
  TOWNSHIP: "乡 / 镇",
  VILLAGE: "村",
} as const;
export interface PublicRegionSearchProps {
  repository: OverviewRepository;
  roots: readonly OverviewRegion[];
  productCode: string;
  year: number;
  onSelect: (region: OverviewRegion) => void;
}

export function PublicRegionSearch(props: PublicRegionSearchProps) {
  const key = `${props.productCode}:${props.year}:${props.roots.map((root) => root.code).join(",")}`;
  return <SearchSession key={key} {...props} />;
}

function SearchSession({
  repository,
  roots,
  productCode,
  year,
  onSelect,
}: PublicRegionSearchProps) {
  const [rows, setRows] = useState<readonly OverviewRegion[]>(roots);
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState<PublicRegionLevel>("ALL");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [failures, setFailures] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  const [active, setActive] = useState(-1);
  const [selecting, setSelecting] = useState(false);
  const mounted = useRef(true);
  const running = useRef(false);
  const cache = useRef(new Map<string, readonly OverviewRegion[]>());
  const selection = useRef(0);
  const listId = useId();
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const { matches, total } = useMemo(
    () => searchPublicRegions(rows, roots, query, level),
    [rows, roots, query, level],
  );

  async function load() {
    if (running.current) return;
    running.current = true;
    setLoading(true);
    const errors: string[] = [];
    for (const root of roots) {
      if (!mounted.current) break;
      const parts = ["COUNTY", "TOWNSHIP", "VILLAGE"] as const;
      await Promise.all(
        parts.map(async (part) => {
          const key = `${root.code}:${part}`;
          if (cache.current.has(key)) return;
          try {
            const values =
              part === "COUNTY"
                ? await repository.regions({ parentCode: root.code, productCode, year })
                : await repository.locations({
                    ancestorCode: root.code,
                    level: part,
                    productCode,
                    year,
                  });
            cache.current.set(
              key,
              values.filter((row) => row.level === part),
            );
          } catch {
            errors.push(`${root.name}·${LEVELS[part]}`);
          }
        }),
      );
      if (mounted.current)
        setRows([...roots, ...Array.from(cache.current.values()).flat()]);
    }
    running.current = false;
    if (mounted.current) {
      setFailures(errors);
      setLoading(false);
    }
  }

  async function choose(region: OverviewRegion) {
    const request = ++selection.current;
    setSelecting(true);
    setNotice("");
    try {
      let resolved = region;
      if (region.level !== "VILLAGE" && !region.boundaryGeoJson) {
        const siblings = await repository.regions({
          ...(region.parentCode ? { parentCode: region.parentCode } : {}),
          productCode,
          year,
        });
        resolved = siblings.find((row) => row.code === region.code) ?? region;
      }
      if (!mounted.current || request !== selection.current) return;
      if (!publicMapFocus(resolved)) {
        setNotice("该地区暂无可定位的边界或点位，地图保持当前位置。");
        return;
      }
      if (resolved.level === "VILLAGE") {
        resolved = { ...resolved };
        delete resolved.boundaryGeoJson;
        setNotice("村级仅定位已有点位，位置待核验；不代表村界。");
      } else if (!resolved.boundaryGeoJson)
        setNotice("该地区暂无可用边界，仅定位已有位置。");
      onSelect(resolved);
      setOpen(false);
    } catch {
      if (mounted.current && request === selection.current)
        setNotice("地区边界加载失败，请重新选择重试。");
    } finally {
      if (mounted.current && request === selection.current) setSelecting(false);
    }
  }

  return (
    <div
      className="public-region-search"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <div className="public-region-search__controls">
        <input
          aria-label="搜索市县乡村"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={
            open && matches[active]
              ? `${listId}-${matches[active].region.code}`
              : undefined
          }
          placeholder="搜索市、县、乡镇、村名称"
          value={query}
          onFocus={() => {
            setOpen(true);
            void load();
          }}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(-1);
            setOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setOpen(false);
              return;
            }
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              setOpen(true);
              setActive((current) =>
                matches.length
                  ? (current + (event.key === "ArrowDown" ? 1 : -1) + matches.length) %
                    matches.length
                  : -1,
              );
            }
            if (
              event.key === "Enter" &&
              open &&
              matches[active < 0 ? 0 : active] &&
              !selecting
            ) {
              event.preventDefault();
              void choose(matches[active < 0 ? 0 : active]!.region);
            }
          }}
        />
        <select
          aria-label="搜索地区层级"
          value={level}
          onChange={(event) => {
            setLevel(event.target.value as PublicRegionLevel);
            setActive(-1);
            setOpen(true);
            void load();
          }}
        >
          {Object.entries(LEVELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      {open && (
        <div className="public-region-search__dropdown">
          {loading && <p role="status">正在加载地区目录，地图可继续使用…</p>}
          {!!failures.length && (
            <p role="status">
              部分目录加载失败：{failures.join("、")}。
              <button type="button" onClick={() => void load()} disabled={loading}>
                重试
              </button>
            </p>
          )}
          <div id={listId} role="listbox" aria-label="地区搜索结果" aria-busy={loading}>
            {matches.map(({ region, path }, index) => (
              <button
                type="button"
                role="option"
                id={`${listId}-${region.code}`}
                key={region.code}
                aria-selected={active === index}
                disabled={selecting}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => void choose(region)}
              >
                <span>
                  {region.name}
                  <small>{LEVELS[region.level]}</small>
                </span>
                <span>{path}</span>
              </button>
            ))}
          </div>
          {!matches.length && !loading && <p>未找到匹配地区</p>}
          {total > matches.length && (
            <p>
              共 {total} 个匹配，显示前 {matches.length}{" "}
              个；请输入更完整名称或筛选层级。
            </p>
          )}
          {selecting && <p role="status">正在定位地区…</p>}
        </div>
      )}
      {notice && (
        <p className="public-region-search__notice" role="status">
          {notice}
        </p>
      )}
    </div>
  );
}
