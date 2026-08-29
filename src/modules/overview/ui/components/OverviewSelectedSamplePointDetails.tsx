import { useEffect, useMemo, useState } from "react";

import type { OverviewSamplePointRepository } from "../../application/ports/OverviewSamplePointRepository";
import type {
  OverviewSamplePointCategoryCode,
  OverviewSamplePointDetail,
  OverviewSamplePointIcon,
} from "../../domain/overviewSamplePoint";
import { publicAssetUrl } from "../../../../shared/assets/publicAssetUrl";

const roleAssetUrl = {
  PRODUCTION: publicAssetUrl("overview/sample-points/production-rice.svg"),
  MARKET: publicAssetUrl("overview/sample-points/market-bank.svg"),
  LOGISTICS: publicAssetUrl("overview/sample-points/logistics-car.svg"),
} as const;

export function OverviewSelectedSamplePointDetails({
  categoryCode,
  icon,
  productCode,
  refreshSequence = 0,
  regionCode,
  repository,
  year,
}: {
  categoryCode?: OverviewSamplePointCategoryCode;
  icon: OverviewSamplePointIcon;
  productCode: string;
  refreshSequence?: number;
  regionCode: string;
  repository: OverviewSamplePointRepository;
  year: number;
}) {
  const [detail, setDetail] = useState<OverviewSamplePointDetail>();
  const [issue, setIssue] = useState<string>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (!active) return;
      setDetail(undefined);
      setIssue(undefined);
      setLoading(true);
    });
    repository
      .detail({
        productCode,
        regionCode,
        samplePointId: icon.samplePointId,
        year,
        ...(categoryCode ? { categoryCode } : {}),
      })
      .then((next) => {
        if (!active) return;
        setDetail(next);
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setIssue("样本业务信息暂不可用，请稍后重试。");
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [
    categoryCode,
    icon.samplePointId,
    productCode,
    refreshSequence,
    regionCode,
    repository,
    year,
  ]);

  const latestPeriod = useMemo(
    () =>
      detail?.associations
        .map(({ occurrenceDate }) => occurrenceDate.slice(0, 7))
        .sort((left, right) => right.localeCompare(left))[0],
    [detail],
  );
  const associations =
    detail?.associations.filter(
      ({ occurrenceDate }) => occurrenceDate.slice(0, 7) === latestPeriod,
    ) ?? [];
  const roleName = (icon.roles ?? []).map(({ name }) => name).join(" / ") || "现有样本";
  const typeName = icon.types.map(({ name }) => name).join(" / ");

  return (
    <section
      aria-label="所选现有样本业务信息"
      className="overview-selected-sample-point-details"
    >
      <header>
        <span className="overview-selected-sample-point-role-icons" aria-hidden="true">
          {(icon.roles ?? detail?.roles ?? []).map((role) => (
            <img alt="" key={role.code} src={roleAssetUrl[role.code]} />
          ))}
        </span>
        <div>
          <h3>{detail?.name ?? icon.name}</h3>
          <p>
            {roleName}
            {typeName ? ` · ${typeName}` : ""}
            {detail?.regionName ? ` · ${detail.regionName}` : ""}
          </p>
        </div>
      </header>
      {icon.dataQualityReason ? (
        <p className="overview-selected-sample-point-quality">
          {qualityLabel(icon.dataQualityReason)}
        </p>
      ) : null}
      {loading ? <p>正在同步已核定业务信息。</p> : null}
      {issue ? <p role="alert">{issue}</p> : null}
      {latestPeriod ? <h4>{formatMonth(latestPeriod)}已核定业务</h4> : null}
      {associations.map((association, index) => (
        <article
          key={`${association.categoryCode}-${association.typeCode}-${association.occurrenceDate}-${index}`}
        >
          <h5>
            {association.categoryName} · {association.typeName} ·{" "}
            {association.productName}
          </h5>
          <p>
            审核来源历史：{sourceRoleLabel(association.sourceRole)} · 业务日期{" "}
            {formatChineseDate(association.occurrenceDate)} · 第
            {association.sourceVersion}版
          </p>
          <dl>
            {Object.entries(association.businessValues).map(([code, value]) => (
              <div key={code}>
                <dt>{value.label}</dt>
                <dd>
                  {value.value}
                  {value.unitCode ? ` ${value.unitCode}` : ""}
                </dd>
              </div>
            ))}
          </dl>
        </article>
      ))}
    </section>
  );
}

function formatMonth(value: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  return match ? `${match[1]}年${Number(match[2])}月` : value;
}

function formatChineseDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? `${match[1]}年${Number(match[2])}月${Number(match[3])}日` : value;
}

function sourceRoleLabel(sourceRole: string) {
  if (sourceRole === "ORIGIN") return "发运端核定记录";
  if (sourceRole === "DESTINATION") return "到达端核定记录";
  return "调研填报";
}

function qualityLabel(reason: string) {
  if (reason === "DUPLICATE_COORDINATE_UNVERIFIED") return "坐标重合待核验";
  if (reason === "MISSING_COORDINATE") return "坐标缺失，地图不显示虚构位置";
  if (reason === "INVALID_COORDINATE") return "坐标无效，地图不显示虚构位置";
  if (reason === "OUT_OF_REGION") return "坐标超出所属地区，地图暂不显示";
  return "样本位置待治理";
}
