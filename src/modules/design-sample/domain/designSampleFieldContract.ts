export interface DesignSampleContext {
  readonly domainCode: string;
  readonly productCode: string;
  readonly objectTypeCode: string;
}

export interface DesignSampleDomainDefinition {
  readonly code: string;
  readonly label: string;
  readonly description: string;
  readonly aliases: readonly string[];
  readonly sortOrder: number;
}

export interface DesignSampleProductDefinition {
  readonly code: string;
  readonly label: string;
  readonly aliases: readonly string[];
  readonly sortOrder: number;
}

export interface DesignSampleObjectTypeDefinition {
  readonly domainCode: string;
  readonly code: string;
  readonly label: string;
  readonly aliases: readonly string[];
  readonly sortOrder: number;
}

export interface DesignSampleSupportedContext extends DesignSampleContext {
  readonly sortOrder: number;
}

export type DesignSampleFieldValueType =
  "UUID" | "STRING" | "DATE" | "DECIMAL" | "ENUM";

export interface DesignSampleFieldDefinition {
  readonly code: string;
  readonly sectionCode: "IDENTITY" | "OBSERVATION";
  readonly label: string;
  readonly description: string;
  readonly valueType: DesignSampleFieldValueType;
  readonly precision: number | null;
  readonly scale: number | null;
  readonly maxLength: number | null;
  readonly unit: string | null;
  readonly enumOptions: readonly string[];
  readonly required: boolean;
  readonly nullable: boolean;
  readonly defaultValue: unknown;
  readonly editable: boolean;
  readonly minimumValue: string | null;
  readonly maximumValue: string | null;
  readonly groupCode: string;
  readonly sortOrder: number;
  readonly analysisRole: string;
}

export interface DesignSampleFieldContract {
  readonly contractVersion: "design-sample-fields-v1";
  readonly contractDigest: string;
  readonly context: DesignSampleContext;
  readonly domains: readonly DesignSampleDomainDefinition[];
  readonly products: readonly DesignSampleProductDefinition[];
  readonly objectTypes: readonly DesignSampleObjectTypeDefinition[];
  readonly supportedContexts: readonly DesignSampleSupportedContext[];
  readonly identityFields: readonly DesignSampleFieldDefinition[];
  readonly observationFields: readonly DesignSampleFieldDefinition[];
}

export type DesignSampleValueState = "NOT_APPLICABLE" | "UNKNOWN" | "KNOWN";

export function designSampleValueState(
  field: DesignSampleFieldDefinition | undefined,
  value: unknown,
): DesignSampleValueState {
  if (field === undefined) return "NOT_APPLICABLE";
  return value === null || value === undefined ? "UNKNOWN" : "KNOWN";
}
