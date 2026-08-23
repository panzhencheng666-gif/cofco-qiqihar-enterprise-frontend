import type { SampleNetworkLayerMode } from "../../domain/overviewSamplePoint";
import type { OverviewSampleNetworkLayerModel } from "../hooks/useOverviewSampleNetworkLayers";

export function OverviewSampleNetworkToolbar({
  model,
}: {
  model: OverviewSampleNetworkLayerModel;
}) {
  const approvedDesignCoordinateCount =
    model.comparison?.designPoints.filter(
      ({ coordinateReviewStatus }) => coordinateReviewStatus === "AUTHORITY_APPROVED",
    ).length ?? 0;
  const controls = [
    ["comparison", "对照显示"],
    ["actual", "现有样本"],
    ["design", "设计样本"],
  ] as const satisfies readonly (readonly [SampleNetworkLayerMode, string])[];
  const mapLevelGuidance = !model.applicable
    ? "现有样本网络自2026年启用，当前年度仅展示历史业务记录。"
    : model.region?.level === "PREFECTURE"
      ? "市级显示区县汇总"
      : model.region?.level === "COUNTY"
        ? "区县级显示乡镇汇总"
        : model.region?.level === "TOWNSHIP" || model.region?.level === "VILLAGE"
          ? model.state === "ready" && model.comparison
            ? `${model.comparison.designPointCount} 个行政村设计覆盖 · ${model.comparison.activeSamplePointCount} 个年度现有样本`
            : model.state === "unavailable"
              ? "样本网络暂不可用"
              : "正在同步样本网络"
          : "进入区县或乡镇查看样本网络";

  return (
    <section className="overview-sample-network-toolbar" aria-label="样本网络图层">
      <div role="group" aria-label="样本网络图层">
        {controls.map(([mode, label]) => (
          <button
            aria-pressed={model.mode === mode}
            disabled={!model.applicable}
            key={mode}
            onClick={() => model.setMode(mode)}
            type="button"
          >
            {label}
          </button>
        ))}
      </div>
      <span aria-live="polite">{mapLevelGuidance}</span>
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
