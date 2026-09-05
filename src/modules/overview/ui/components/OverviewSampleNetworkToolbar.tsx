import { useEffect, useRef, useState } from "react";

import type { SampleNetworkLayerMode } from "../../domain/overviewSamplePoint";
import type { OverviewSampleNetworkLayerModel } from "../hooks/useOverviewSampleNetworkLayers";

export function OverviewSampleNetworkToolbar({
  model,
  onExport,
  exportPending = false,
}: {
  model: OverviewSampleNetworkLayerModel;
  onExport?: () => void;
  exportPending?: boolean;
}) {
  const [pendingSelection, setPendingSelection] = useState<{
    from: SampleNetworkLayerMode;
    to: SampleNetworkLayerMode;
  }>();
  const firstFrameRef = useRef<number | undefined>(undefined);
  const commitTimerRef = useRef<number | undefined>(undefined);
  const displayMode =
    pendingSelection?.from === model.mode ? pendingSelection.to : model.mode;
  useEffect(
    () => () => {
      if (firstFrameRef.current !== undefined) {
        window.cancelAnimationFrame(firstFrameRef.current);
      }
      if (commitTimerRef.current !== undefined) {
        window.clearTimeout(commitTimerRef.current);
      }
    },
    [],
  );
  const selectMode = (nextMode: SampleNetworkLayerMode) => {
    setPendingSelection({ from: model.mode, to: nextMode });
    if (firstFrameRef.current !== undefined) {
      window.cancelAnimationFrame(firstFrameRef.current);
    }
    if (commitTimerRef.current !== undefined) {
      window.clearTimeout(commitTimerRef.current);
    }
    firstFrameRef.current = window.requestAnimationFrame(() => {
      commitTimerRef.current = window.setTimeout(() => {
        model.setMode(nextMode);
      }, 0);
    });
  };
  const approvedDesignCoordinateCount =
    model.comparison?.designPoints.filter(
      ({ coordinateReviewStatus }) => coordinateReviewStatus === "AUTHORITY_APPROVED",
    ).length ?? 0;
  const controls = [
    ["comparison", "对照显示"],
    ["actual", "现有样本"],
    ["design", "设计样本"],
    ["historical", "历史样本点"],
  ] as const satisfies readonly (readonly [SampleNetworkLayerMode, string])[];
  const mapLevelGuidance = !model.applicable
    ? "请选择年度查看样本网络与已审核业务样本。"
    : model.mode === "historical"
      ? model.historicalState === "unavailable"
        ? "历史样本点暂不可用"
        : model.historicalState === "loading"
          ? "正在同步历史样本点"
          : undefined
      : model.state === "unavailable"
        ? "样本网络暂不可用"
        : model.state === "loading" || model.catalogState === "loading"
          ? "正在同步样本网络"
          : undefined;

  return (
    <section className="overview-sample-network-toolbar" aria-label="样本网络图层">
      <div role="group" aria-label="样本网络图层">
        {controls.map(([mode, label]) => (
          <button
            aria-pressed={displayMode === mode}
            disabled={!model.applicable}
            key={mode}
            onClick={() => selectMode(mode)}
            type="button"
          >
            {label}
          </button>
        ))}
      </div>
      {onExport && (
        <button
          aria-label="导出正式样本清单"
          disabled={exportPending || !model.applicable}
          onClick={onExport}
          type="button"
        >
          {exportPending ? "正在导出" : "导出正式样本"}
        </button>
      )}
      {mapLevelGuidance ? <span aria-live="polite">{mapLevelGuidance}</span> : null}
      {model.mode === "historical" && model.year !== undefined ? (
        <span>淘汰年份：{model.year}年</span>
      ) : null}
      {model.applicable &&
      model.mode !== "actual" &&
      approvedDesignCoordinateCount > 0 ? (
        <label>
          <input
            checked={model.showExactDesignLocations}
            onChange={(event) =>
              model.setShowExactDesignLocations(event.target.checked)
            }
            type="checkbox"
          />
          精确位置（{approvedDesignCoordinateCount}）
        </label>
      ) : null}
    </section>
  );
}
