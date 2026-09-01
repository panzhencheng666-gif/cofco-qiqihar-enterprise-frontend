import { z } from "zod";

import type { OverviewSamplePointCategoryCode } from "../../domain/overviewSamplePoint";

const categoryCodeSchema = z.enum(["PRODUCTION", "MARKET", "LOGISTICS"]);
const uuidTextSchema = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
const formalCoordinateSchema = z
  .union([z.number(), z.string().regex(/^-?\d+(?:\.\d+)?$/u)])
  .nullable()
  .transform((value) => (value === null ? null : Number(value)));

const formalSamplePointSchema = z.object({
  id: uuidTextSchema,
  kindCode: z.string(),
  canonicalName: z.string().min(1),
  regionCode: z.string().min(1),
  objectTypeCode: z.string().min(1).nullable(),
  objectTypeName: z.string().min(1).nullable(),
  businessDomain: categoryCodeSchema.nullable(),
  address: z.string().min(1).nullable(),
  approvalState: z.string(),
  locationState: z.string(),
  longitude: formalCoordinateSchema,
  latitude: formalCoordinateSchema,
  effectiveFrom: z.string(),
  effectiveTo: z.string().nullable(),
  version: z.number().int().nonnegative(),
  annualObservationCount: z.number().int().nonnegative(),
  networkMembershipCount: z.number().int().nonnegative(),
});

export const formalSamplePointPageSchema = z.object({
  data: z.object({
    items: z.array(formalSamplePointSchema),
    pageNumber: z.number().int().nonnegative(),
    pageSize: z.number().int().positive().max(100),
    totalElements: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
  }),
});

export const formalSamplePointDetailSchema = z.object({
  data: formalSamplePointSchema,
});

export const formalObservationHistorySchema = z.object({
  data: z.object({
    items: z.array(
      z.object({
        observationId: uuidTextSchema.nullable(),
        observedAt: z.string().min(1),
        officialSavedAt: z.string().min(1),
        actorDisplayName: z.string(),
        projectionVersion: z.string().nullable(),
        synchronizedModules: z.array(z.string()),
        values: z.record(z.string(), z.unknown()),
        latest: z.boolean(),
      }),
    ),
    totalElements: z.number().int().nonnegative(),
    pageNumber: z.number().int().nonnegative(),
    pageSize: z.number().int().positive().max(100),
  }),
});

const definitionOptionSchema = z.object({
  value: z.string(),
  label: z.string(),
  sortOrder: z.number().int(),
});

export const marketObservationDefinitionSchema = z.object({
  data: z.object({
    coreFields: z.array(
      z.object({
        code: z.string(),
        label: z.string(),
        controlType: z.string(),
        unit: z.string().nullable(),
        sortOrder: z.number().int(),
        options: z.array(definitionOptionSchema),
      }),
    ),
    groups: z.array(
      z.object({
        sortOrder: z.number().int(),
        fields: z.array(
          z.object({
            code: z.string(),
            label: z.string(),
            unit: z.string().nullable(),
            sortOrder: z.number().int(),
          }),
        ),
      }),
    ),
  }),
});

export const productionObservationDefinitionSchema = z.object({
  data: z.object({
    fields: z.array(
      z.object({
        code: z.string(),
        label: z.string(),
        groupOrder: z.number().int(),
        unit: z.string().nullable(),
        sortOrder: z.number().int(),
        options: z.array(z.string()),
        readOnly: z.boolean(),
        calculated: z.boolean(),
        displayed: z.boolean(),
      }),
    ),
    groups: z.array(
      z.object({
        fields: z.array(
          z.object({
            code: z.string(),
            label: z.string(),
            unit: z.string().nullable(),
            sortOrder: z.number().int(),
          }),
        ),
      }),
    ),
  }),
});

export const logisticsObservationDefinitionSchema = z.object({
  data: z.object({
    fields: z.array(
      z.object({
        code: z.string(),
        label: z.string(),
        unit: z.string().nullable(),
        sortOrder: z.number().int(),
        options: z.array(definitionOptionSchema),
        readOnly: z.boolean(),
      }),
    ),
  }),
});

export type FormalSamplePoint = z.infer<typeof formalSamplePointSchema>;

export type CategorizedFormalSamplePoint = FormalSamplePoint & {
  objectTypeCode: string;
  objectTypeName: string;
  businessDomain: OverviewSamplePointCategoryCode;
};

export function isCategorizedFormalSamplePoint(
  point: FormalSamplePoint,
): point is CategorizedFormalSamplePoint {
  return (
    point.objectTypeCode !== null &&
    point.objectTypeName !== null &&
    point.businessDomain !== null
  );
}

export interface ObservationFieldDefinition {
  code: string;
  label: string;
  unit: string | null;
  sortOrder: number;
  sectionOrder: number;
  options: readonly { value: string; label: string }[];
}

const categoryPresentation = {
  PRODUCTION: { name: "产情类", iconKey: "production" },
  MARKET: { name: "市场类", iconKey: "market" },
  LOGISTICS: { name: "物流类", iconKey: "logistics" },
} as const;

export const lockedObservationCodes: Readonly<
  Record<OverviewSamplePointCategoryCode, ReadonlySet<string>>
> = {
  PRODUCTION: new Set([
    "objectTypeCode",
    "regionCode",
    "surveyYear",
    "surveyMonth",
    "surveyDate",
    "fillingDate",
    "PROD_OBJECT_TYPE",
    "PROD_REGION",
    "PROD_SURVEY_DATE",
    "PROD_FILLING_AT",
    "PROD_STATUS",
    "PROD_SAMPLE_NAME",
    "PROD_SAMPLE_CONTACT",
    "PROD_SAMPLE_LATITUDE",
    "PROD_SAMPLE_LONGITUDE",
    "PROD_REPORTER_NAME",
    "PROD_SURVEYOR_NAME",
    "PROD_SURVEYOR_PHONE",
  ]),
  MARKET: new Set([
    "MKT_OBJECT_TYPE",
    "MKT_REGION",
    "MKT_TRADE_DATE",
    "MKT_REPORTED_AT",
    "MKT_FILLING_AT",
    "MKT_STATUS",
    "MKT_SAMPLE_NAME",
    "MKT_SAMPLE_CONTACT",
    "MKT_SAMPLE_LATITUDE",
    "MKT_SAMPLE_LONGITUDE",
    "MKT_REPORTER_NAME",
    "MKT_SURVEYOR_NAME",
    "MKT_SURVEYOR_PHONE",
  ]),
  LOGISTICS: new Set([
    "surveyYear",
    "surveyMonth",
    "LOG_COLLECTION_DATE",
    "LOG_FILLING_AT",
    "LOG_STATUS",
    "LOG_SAMPLE_NAME",
    "LOG_REGION",
    "LOG_REPORTER",
    "LOG_SURVEYOR_NAME",
    "LOG_SURVEYOR_PHONE",
    "LOG_SAMPLE_CONTACT",
    "LOG_SAMPLE_LATITUDE",
    "LOG_SAMPLE_LONGITUDE",
    "LOG_INTERNAL_LOCATION_KEY",
  ]),
};

export function presentFormalSnapshot(
  points: readonly CategorizedFormalSamplePoint[],
  query: {
    regionCode: string;
    regionName: string;
    categoryCode?: OverviewSamplePointCategoryCode;
    typeCode?: string;
  },
) {
  const filtered = points.filter(
    (point) =>
      (!query.categoryCode || point.businessDomain === query.categoryCode) &&
      (!query.typeCode || point.objectTypeCode === query.typeCode),
  );
  const categories = (["PRODUCTION", "MARKET", "LOGISTICS"] as const).map((code) => {
    const matching = points.filter((point) => point.businessDomain === code);
    const types = new Map<
      string,
      { code: string; name: string; iconKey: string; count: number }
    >();
    matching.forEach((point) => {
      const current = types.get(point.objectTypeCode);
      types.set(point.objectTypeCode, {
        code: point.objectTypeCode,
        name: point.objectTypeName,
        iconKey: objectTypeIconKey(point.objectTypeCode),
        count: (current?.count ?? 0) + 1,
      });
    });
    return {
      code,
      name: categoryPresentation[code].name,
      count: matching.length,
      types: [...types.values()],
    };
  });
  const valid = filtered.filter((point) => formalLocationIssue(point) === null);
  const list = {
    regionCode: query.regionCode,
    totalCount: filtered.length,
    validCoordinateCount: valid.length,
    dataQualityIssueCount: filtered.length - valid.length,
    correctionSourceCount: 0,
    unresolvedSourceCount: filtered.length - valid.length,
    categories,
    items: filtered.map((point) => ({
      samplePointId: point.id,
      name: point.canonicalName,
      regionCode: point.regionCode,
      regionName: query.regionName,
      locationState: point.locationState,
      dataQualityReason: formalLocationIssue(point),
      categories: [
        {
          code: point.businessDomain,
          name: categoryPresentation[point.businessDomain].name,
        },
      ],
      types: [
        {
          code: point.objectTypeCode,
          name: point.objectTypeName,
          iconKey: objectTypeIconKey(point.objectTypeCode),
        },
      ],
      products: [],
      latestBusinessDate: null,
      summaryValues: {},
    })),
    correctionSources: [],
  };
  const icons = valid.map((point) => ({
    samplePointId: point.id,
    name: point.canonicalName,
    regionCode: point.regionCode,
    iconKey: objectTypeIconKey(point.objectTypeCode),
    roles: [formalRole(point.businessDomain)],
    types: [
      {
        code: point.objectTypeCode,
        name: point.objectTypeName,
        iconKey: objectTypeIconKey(point.objectTypeCode),
      },
    ],
    longitude: point.longitude,
    latitude: point.latitude,
    dataQualityReason: null,
  }));
  return { list, icons };
}

export function formalRole(code: OverviewSamplePointCategoryCode) {
  return { code, ...categoryPresentation[code] };
}

export function formalLocationIssue(point: FormalSamplePoint) {
  return point.locationState === "VALID" &&
    point.longitude !== null &&
    point.latitude !== null
    ? null
    : point.locationState;
}

function objectTypeIconKey(code: string) {
  return code.toLocaleLowerCase("en-US").replaceAll("_", "-");
}

export function presentObservationValues(
  values: Readonly<Record<string, unknown>>,
  fields: readonly ObservationFieldDefinition[],
) {
  return Object.fromEntries(
    [...fields]
      .sort(
        (left, right) =>
          left.sectionOrder - right.sectionOrder || left.sortOrder - right.sortOrder,
      )
      .filter(({ code }) => Object.hasOwn(values, code))
      .map((field) => {
        const raw = values[field.code];
        const text = presentRawValue(raw);
        const value = field.options.find(({ value }) => value === text)?.label ?? text;
        return [
          field.code,
          { label: field.label, value, unitCode: field.unit },
        ] as const;
      }),
  );
}

function presentRawValue(raw: unknown) {
  if (raw === null || raw === undefined || raw === "") return "—";
  if (
    typeof raw === "string" ||
    typeof raw === "number" ||
    typeof raw === "boolean" ||
    typeof raw === "bigint"
  ) {
    return String(raw);
  }
  return "—";
}

export function uniqueObservationFields(
  fields: readonly ObservationFieldDefinition[],
): readonly ObservationFieldDefinition[] {
  return [...new Map(fields.map((field) => [field.code, field] as const)).values()];
}

export function shanghaiDate(value: string) {
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return value.slice(0, 10);
  return new Date(parsed.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
