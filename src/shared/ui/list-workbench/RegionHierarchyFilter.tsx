import { useEffect, useRef, useState } from "react";

import type {
  LoadRegionChildren,
  LoadRegionPath,
  RegionNode,
} from "../../application/page-definition";

interface RegionLevel {
  options: readonly RegionNode[];
  selectedId: string;
}

export function RegionHierarchyFilter({
  label,
  loadChildren,
  loadPath,
  onChange,
  placeholder,
  value,
}: {
  label: string;
  loadChildren: LoadRegionChildren;
  loadPath: LoadRegionPath;
  onChange: (regionId: string) => void;
  placeholder: string;
  value: string;
}) {
  const [levels, setLevels] = useState<readonly RegionLevel[]>([]);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [retryVersion, setRetryVersion] = useState(0);
  const requestVersion = useRef(0);

  useEffect(() => {
    const version = ++requestVersion.current;
    void (async () => {
      await Promise.resolve();
      if (version !== requestVersion.current) return;
      setLoading(true);
      setError(false);
      try {
        const path = value ? await loadPath(value) : [];
        const rebuilt: RegionLevel[] = [];
        let parentId: string | undefined;
        for (const selected of path) {
          const options = await loadChildren(parentId);
          rebuilt.push({ options, selectedId: selected.id });
          parentId = selected.id;
        }
        if (path.length === 0) {
          rebuilt.push({ options: await loadChildren(), selectedId: "" });
        } else {
          const children = await loadChildren(parentId);
          if (children.length > 0) rebuilt.push({ options: children, selectedId: "" });
        }
        if (version === requestVersion.current) setLevels(rebuilt);
      } catch {
        if (version === requestVersion.current) setError(true);
      } finally {
        if (version === requestVersion.current) setLoading(false);
      }
    })();
  }, [loadChildren, loadPath, retryVersion, value]);

  async function select(levelIndex: number, selectedId: string) {
    const version = ++requestVersion.current;
    const retained = levels
      .slice(0, levelIndex + 1)
      .map((level, index) => (index === levelIndex ? { ...level, selectedId } : level));
    setLevels(retained);
    const ancestorId = retained[levelIndex - 1]?.selectedId ?? "";
    onChange(selectedId || ancestorId);
    if (!selectedId) return;

    setLoading(true);
    setError(false);
    try {
      const children = await loadChildren(selectedId);
      if (version === requestVersion.current && children.length > 0) {
        setLevels([...retained, { options: children, selectedId: "" }]);
      }
    } catch {
      if (version === requestVersion.current) setError(true);
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }

  return (
    <div className="region-hierarchy-filter">
      {loading && <span role="status">正在加载地区</span>}
      {error && (
        <span className="region-load-error" role="alert">
          地区加载失败，请重试。
          <button
            onClick={() => setRetryVersion((current) => current + 1)}
            type="button"
          >
            重试地区加载
          </button>
        </span>
      )}
      {levels.map((level, index) => (
        <select
          aria-label={`${label} 第${String(index + 1)}级`}
          key={index}
          onChange={(event) => void select(index, event.target.value)}
          value={level.selectedId}
        >
          <option value="">{placeholder}</option>
          {level.options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      ))}
    </div>
  );
}
