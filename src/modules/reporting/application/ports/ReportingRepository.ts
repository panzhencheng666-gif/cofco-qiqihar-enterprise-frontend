import type {
  ReportExport,
  ReportExportFile,
  ReportParameterOptions,
  ReportPreview,
  ReportPreviewCommand,
  ReportPublication,
} from "../../domain/reporting";
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
}
