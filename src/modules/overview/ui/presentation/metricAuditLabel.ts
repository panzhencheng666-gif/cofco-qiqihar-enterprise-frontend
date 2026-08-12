import type { OverviewDashboardMetric } from "../../domain/overview";

type MetricAuditContract = Pick<
  OverviewDashboardMetric,
  | "sourceCount"
  | "dataCutoff"
  | "coverageScope"
  | "calculationVersion"
  | "formula"
  | "sourceRelation"
>;

export function formatMetricAuditLabel(metric: MetricAuditContract) {
  const parts = [`${metric.sourceCount} 条审核来源`];
  append(parts, "截止", formatChineseCutoff(metric.dataCutoff));
  append(parts, "覆盖", businessText(metric.coverageScope, isTechnicalScope));
  append(parts, "版本", businessText(metric.calculationVersion, isTechnicalVersion));
  append(parts, "公式", businessText(metric.formula, isTechnicalFormula));
  append(parts, "来源", businessText(metric.sourceRelation, isTechnicalRelation));
  return parts.join(" · ");
}

function append(parts: string[], label: string, value: string | null) {
  if (value) parts.push(`${label} ${value}`);
}

function businessText(
  value: string | null | undefined,
  rejects: (candidate: string) => boolean,
) {
  const candidate = value?.trim();
  return candidate && !rejects(candidate) ? candidate : null;
}

function formatChineseCutoff(value: string | null | undefined) {
  const candidate = value?.trim();
  if (!candidate) return null;
  if (/^\d{4}年\d{2}月\d{2}日(?: \d{2}:\d{2}:\d{2})?$/.test(candidate)) {
    return candidate;
  }
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(
      candidate,
    )
  ) {
    return null;
  }
  const instant = new Date(candidate);
  if (Number.isNaN(instant.valueOf())) return null;
  const values = Object.fromEntries(
    new Intl.DateTimeFormat("zh-CN", {
      day: "2-digit",
      hour: "2-digit",
      hour12: false,
      minute: "2-digit",
      month: "2-digit",
      second: "2-digit",
      timeZone: "Asia/Shanghai",
      year: "numeric",
    })
      .formatToParts(instant)
      .filter(({ type }) => type !== "literal")
      .map(({ type, value: part }) => [type, part]),
  );
  return `${values.year}年${values.month}月${values.day}日 ${values.hour}:${values.minute}:${values.second}`;
}

function isTechnicalScope(value: string) {
  return /(?:^|;)(?:region|product|year|descendants)=/i.test(value);
}

function isTechnicalVersion(value: string) {
  return /^[A-Z][A-Z0-9_:-]*$/.test(value);
}

function isTechnicalFormula(value: string) {
  return /\b(?:SUM|COUNT|AVG|MIN|MAX)\s*\(/i.test(value);
}

function isTechnicalRelation(value: string) {
  return /\b[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*\b/i.test(value);
}
