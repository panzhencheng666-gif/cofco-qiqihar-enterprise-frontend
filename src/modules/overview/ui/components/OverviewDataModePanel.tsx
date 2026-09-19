import type {
  OverviewDataMode,
  RegionalAgricultureProfile,
  RegionalCropSummary,
  SupplyBalanceSummary,
} from "../../domain/overviewRegionalData";
import type { OverviewRegion } from "../../domain/overview";
import type {
  OperationalFacilityCatalogue,
  StorageFacility,
  StorageFacilityDraft,
} from "../../domain/operationalFacilities";
import type { OperationalSituationCatalogue } from "../../domain/operationalSituation";
import type { SituationTimelineItem } from "./operationalSituationTimeline";
import "./overview-data-mode.css";
import { OperationalSituationPanel } from "./OperationalSituationPanel";
import { RegionalAgricultureProfilePanel } from "./RegionalAgricultureProfilePanel";

function format(value: string | null | undefined, divisor = 1): string {
  if (value === null || value === undefined || value === "") return "—";
  const number = Number(value) / divisor;
  return Number.isFinite(number)
    ? number.toLocaleString("zh-CN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : "—";
}

const DATA_MODES = [
  "SAMPLE_POINTS",
  "PUBLIC_SITUATION",
  "REGIONAL_DATA",
  "SUPPLY_BALANCE",
] as const;
const CORE_BALANCE_CODES = [
  "OUTPUT",
  "TOTAL_SUPPLY",
  "TOTAL_DEMAND",
  "CLOSING_INVENTORY",
  "DEMAND_SUPPLY_RATIO",
] as const;

type SupplyBalanceRow = SupplyBalanceSummary["rows"][number];

function modeLabel(mode: OverviewDataMode): string {
  if (mode === "SAMPLE_POINTS") return "样本点";
  if (mode === "PUBLIC_SITUATION") return "公开态势";
  if (mode === "REGIONAL_DATA") return "地区数据";
  if (mode === "SUPPLY_BALANCE") return "供需平衡";
  return "地图标注";
}

function balanceValueLabel(row: SupplyBalanceRow): string {
  if (row.display !== null && row.display !== "") return row.display;
  if (row.kind === "MANUAL") return "待填报";
  if (row.kind === "RATIO") return "不可计算";
  return "计算条件未完整";
}

export function OverviewDataModeTabs({
  mode,
  onModeChange,
}: {
  mode: OverviewDataMode;
  onModeChange: (mode: OverviewDataMode) => void;
}) {
  return (
    <nav aria-label="总揽展示内容" className="overview-data-mode-tabs">
      {DATA_MODES.map((item) => (
        <button
          aria-pressed={mode === item}
          key={item}
          type="button"
          onClick={() => onModeChange(item)}
        >
          {modeLabel(item)}
        </button>
      ))}
    </nav>
  );
}

export function OverviewDataModePanel({
  issue,
  loading = false,
  mode,
  productLabel,
  agricultureProfile,
  regionalSummary,
  supplyBalance,
  operationalFacilities,
  operationalSituation,
  selectedOperationalFacilityId,
  selectedRegion,
  onOperationalFacilitySelect,
  selectedOperationalSituationItem,
  onOperationalSituationItemDismiss,
  onOperationalFacilitySave,
  onOperationalFacilityArchive,
}: {
  issue?: string;
  loading?: boolean;
  mode: OverviewDataMode;
  productLabel?: string;
  agricultureProfile?: RegionalAgricultureProfile;
  regionalSummary?: RegionalCropSummary;
  supplyBalance?: SupplyBalanceSummary;
  operationalFacilities?: OperationalFacilityCatalogue;
  operationalSituation?: OperationalSituationCatalogue;
  selectedOperationalFacilityId?: string;
  selectedRegion?: OverviewRegion;
  onOperationalFacilitySelect?: (id: string) => void;
  selectedOperationalSituationItem?: SituationTimelineItem;
  onOperationalSituationItemDismiss?: () => void;
  onOperationalFacilitySave?: (
    draft: StorageFacilityDraft,
    facilityCode?: string,
  ) => Promise<void>;
  onOperationalFacilityArchive?: (facility: StorageFacility) => Promise<void>;
}) {
  const publicSituationReady = Boolean(operationalFacilities || operationalSituation);
  const publicFacilities =
    operationalFacilities ??
    emptyOperationalFacilities(operationalSituation?.generatedAt);
  const publicSituation =
    operationalSituation ?? emptyOperationalSituation(operationalFacilities?.asOf);
  return (
    <section
      className={`overview-data-mode is-${mode.toLowerCase()}`}
      aria-label="总揽数据模式"
    >
      {mode !== "SAMPLE_POINTS" && loading && (
        <p role="status">
          {mode === "PUBLIC_SITUATION"
            ? "正在同步实时态势，地图可立即操作"
            : "正在同步地区正式数据"}
        </p>
      )}
      {mode !== "SAMPLE_POINTS" && issue && (
        <p className="overview-data-mode__issue" role="alert">
          {issue}
        </p>
      )}
      {mode === "REGIONAL_DATA" && agricultureProfile && (
        <RegionalAgricultureProfilePanel
          key={`${agricultureProfile.regionCode}-${agricultureProfile.year}`}
          profile={agricultureProfile}
        />
      )}
      {mode === "REGIONAL_DATA" && !agricultureProfile && regionalSummary && (
        <>
          <header>
            <strong>{regionalSummary.regionName}</strong>
            <span>
              {regionalSummary.year}年 · {productLabel ?? regionalSummary.productCode}
            </span>
          </header>
          <div className="overview-data-mode__metrics">
            <article>
              <span>播种面积</span>
              <strong>{format(regionalSummary.plantedAreaMu, 10_000)}</strong>
              <small>万亩</small>
            </article>
            <article>
              <span>单产</span>
              <strong>{format(regionalSummary.yieldPerMuKg)}</strong>
              <small>公斤/亩</small>
            </article>
            <article>
              <span>总产</span>
              <strong>{format(regionalSummary.totalOutputKg, 10_000_000)}</strong>
              <small>万吨</small>
            </article>
            <article>
              <span>结构调整增减</span>
              <strong>{format(regionalSummary.areaChangeWanMu)}</strong>
              <small>万亩</small>
            </article>
            <article>
              <span>增减比率</span>
              <strong>
                {regionalSummary.areaChangeRateAvailable
                  ? format(regionalSummary.areaChangeRatePercent)
                  : "—"}
              </strong>
              <small>%</small>
            </article>
          </div>
          <p className="overview-data-mode__message">
            {regionalSummary.comparisonMessage}
          </p>
        </>
      )}
      {mode === "REGIONAL_DATA" &&
        !loading &&
        !issue &&
        !regionalSummary &&
        !agricultureProfile && <p>请在地图上选择要查看的地区。</p>}
      {mode === "SUPPLY_BALANCE" && supplyBalance && (
        <div className="overview-data-mode__balance">
          <header>
            <strong>{supplyBalance.regionName}供需平衡</strong>
            <span>
              {supplyBalance.surveyYear}年 · {productLabel ?? supplyBalance.productCode}
            </span>
          </header>
          <ol
            aria-label="供需平衡核心指标"
            className="overview-data-mode__balance-metrics"
          >
            {CORE_BALANCE_CODES.map((code) =>
              supplyBalance.rows.find((row) => row.code === code),
            )
              .filter((row): row is SupplyBalanceRow => row !== undefined)
              .map((row) => (
                <li className={`is-${row.code.toLowerCase()}`} key={row.code}>
                  <span>{row.label}</span>
                  <div>
                    <strong>{balanceValueLabel(row)}</strong>
                    <small>{row.unit}</small>
                  </div>
                </li>
              ))}
          </ol>
          <div className="overview-data-mode__balance-table">
            <table aria-label="供需平衡完整明细">
              <colgroup>
                <col className="is-item" />
                <col className="is-value" />
                <col className="is-unit" />
              </colgroup>
              <thead>
                <tr>
                  <th>项目</th>
                  <th>数值</th>
                  <th>单位</th>
                </tr>
              </thead>
              <tbody>
                {supplyBalance.rows.map((row) => (
                  <tr key={row.code}>
                    <th scope="row">
                      <strong>{row.label}</strong> <small>{row.requirement}</small>
                    </th>
                    <td className={row.display === null ? "is-pending" : undefined}>
                      {balanceValueLabel(row)}
                    </td>
                    <td>{row.unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {mode === "SUPPLY_BALANCE" && !loading && !issue && !supplyBalance && (
        <p>请在地图上选择要查看的地区。</p>
      )}
      {mode === "PUBLIC_SITUATION" && publicSituationReady && (
        <OperationalSituationPanel
          facilities={publicFacilities}
          {...(productLabel ? { productLabel } : {})}
          {...(onOperationalFacilitySelect
            ? { onFacilitySelect: onOperationalFacilitySelect }
            : {})}
          {...(selectedOperationalFacilityId
            ? { selectedFacilityId: selectedOperationalFacilityId }
            : {})}
          {...(selectedRegion ? { selectedRegion } : {})}
          {...(selectedOperationalSituationItem
            ? { selectedTimelineItem: selectedOperationalSituationItem }
            : {})}
          {...(onOperationalSituationItemDismiss
            ? { onTimelineItemDismiss: onOperationalSituationItemDismiss }
            : {})}
          {...(onOperationalFacilitySave
            ? { onFacilitySave: onOperationalFacilitySave }
            : {})}
          {...(onOperationalFacilityArchive
            ? { onFacilityArchive: onOperationalFacilityArchive }
            : {})}
          situation={publicSituation}
        />
      )}
      {mode === "PUBLIC_SITUATION" && loading && !publicSituationReady && (
        <div className="operational-situation-panel is-syncing">
          <header className="situation-inspector-heading">
            <div>
              <span>实时区域档案</span>
              <h2>正在同步当前区域</h2>
              <p>三维地图已可操作，天气和业务节点完成后将在此处直接更新。</p>
            </div>
          </header>
        </div>
      )}
      {mode === "PUBLIC_SITUATION" && !loading && !issue && !publicSituationReady && (
        <p>当前没有可用的公开态势快照。</p>
      )}
    </section>
  );
}

function emptyOperationalFacilities(
  generatedAt: string | undefined,
): OperationalFacilityCatalogue {
  return {
    regionCode: null,
    productCode: null,
    asOf: generatedAt ?? "",
    storageCategories: [],
    storageFacilities: [],
    railwayFacilities: [],
    railwayLines: [],
    railwayRoutes: [],
    sources: [],
  };
}

function emptyOperationalSituation(
  asOf: string | undefined,
): OperationalSituationCatalogue {
  return {
    generatedAt: asOf ?? "",
    weather: [],
    publicEvents: [],
    policyEvents: [],
    logisticsFlows: [],
    inventories: [],
    sources: [],
  };
}
