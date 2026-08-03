export interface ReportOption {
  code: string;
  label: string;
}
export interface ReportDefinition {
  code: string;
  name: string;
  businessDomain: string;
  businessSubtype: string;
  frequencyCode: string;
  version: number;
  sections: readonly { code: string; title: string; sortOrder: number }[];
}
export interface ReportParameterOptions {
  definitions: readonly ReportDefinition[];
  products: readonly ReportOption[];
  cultivars: readonly ReportOption[];
  regionLevels: readonly ReportOption[];
  regions: readonly ReportOption[];
  periods: readonly ReportOption[];
  formats: readonly ReportOption[];
}
export interface ReportPreviewCommand {
  definitionCode: string;
  productCode: string;
  cultivarCode?: string;
  regionLevel: string;
  regionCode: string;
  periodCode: string;
}
export interface ReportPreview {
  id: string;
  definitionCode: string;
  datasetId: string;
  title: string;
  dataCutoffLabel: string;
  lines: readonly { label: string; value: string; note: string }[];
  sections: readonly { code: string; title: string; body: string }[];
  expiresAt: string;
  version: number;
  legacyReadOnly: boolean;
}
export interface ReportExport {
  id: string;
  previewId: string;
  formatCode: string;
  filename: string;
  contentType: string;
  requestedAt: string;
}
export interface ReportExportFile {
  filename: string;
  contentType: string;
  content: Blob;
}
export interface ReportPublication {
  id: string;
  previewId: string;
  exportTaskId: string;
  publishedAt: string;
  version: number;
}
