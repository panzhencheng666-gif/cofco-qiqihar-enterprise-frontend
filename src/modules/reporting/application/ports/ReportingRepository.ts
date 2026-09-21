import type {
  ReportExport,
  ReportExportFile,
  ReportParameterOptions,
  ReportPreview,
  ReportPreviewCommand,
  ReportPublication,
} from "../../domain/reporting";
import type { ActivityReport, ActivityReportExport } from "../../domain/activityReport";
export interface ReportingRepository {
  options(): Promise<ReportParameterOptions>;
  preview(command: ReportPreviewCommand): Promise<ReportPreview>;
  export(previewId: string, formatCode: string): Promise<ReportExport>;
  download(exportTaskId: string): Promise<ReportExportFile>;
  publish(
    previewId: string,
    exportTaskId: string,
    expectedVersion: number,
  ): Promise<ReportPublication>;
  personalActivity?(days: 7 | 30, signal?: AbortSignal): Promise<ActivityReport>;
  systemActivity?(days: 7 | 30, signal?: AbortSignal): Promise<ActivityReport>;
  exportSystemActivity?(days: 7 | 30): Promise<ActivityReportExport>;
  downloadSystemActivity?(exportId: string): Promise<ReportExportFile>;
}
