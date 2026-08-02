import { useEffect, useState } from "react";

import type { LoadRegionChildren, RegionNode } from "../../application/page-definition";

interface RegionLevel {
  options: readonly RegionNode[];
  selectedId: string;
}

export function RegionHierarchyFilter({
  label,
  loadChildren,
  onChange,
  placeholder,
}: {
  label: string;
  loadChildren: LoadRegionChildren;
  onChange: (regionId: string) => void;
  placeholder: string;
}) {
  const [levels, setLevels] = useState<readonly RegionLevel[]>([]);

  useEffect(() => {
    let active = true;
    void loadChildren().then((options) => {
      if (active) setLevels([{ options, selectedId: "" }]);
    });
    return () => {
      active = false;
    };
  }, [loadChildren]);

  async function select(levelIndex: number, selectedId: string) {
    const retained = levels
      .slice(0, levelIndex + 1)
      .map((level, index) => (index === levelIndex ? { ...level, selectedId } : level));
    setLevels(retained);
    onChange(selectedId);
    if (!selectedId) return;

    const children = await loadChildren(selectedId);
    if (children.length > 0) {
      setLevels([...retained, { options: children, selectedId: "" }]);
    }
  }

  return (
    <div className="region-hierarchy-filter">
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
