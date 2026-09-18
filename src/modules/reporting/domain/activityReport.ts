export interface ActivityReport {
  kind: "PERSONAL" | "SYSTEM";
  periodDays: 7 | 30;
  periodStart: string;
  periodEnd: string;
  eventCutoff: string;
  subject: {
    subjectId: string;
    displayName: string;
    workUnitName: string;
  } | null;
  effectiveUserCount: number;
  totalEvents: number;
  samplePointsCreated: number;
  samplePointsDeleted: number;
  actions: readonly ActivityCount[];
  domains: readonly ActivityCount[];
  workUnits: readonly ActivityCount[];
  scopeNotice: string;
}

export interface ActivityCount {
  code: string;
  label: string;
  count: number;
}

export interface ActivityReportExport {
  id: string;
  filename: string;
  contentType: string;
  sha256: string;
  generatedAt: string;
}
