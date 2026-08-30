import { z } from "zod";

import type { HttpClient } from "../../../../shared/api/HttpClient";
import type { DesignSampleFieldDefinitionRepository } from "../../application/ports/DesignSampleFieldDefinitionRepository";
import type {
  DesignSampleContext,
  DesignSampleFieldContract,
} from "../../domain/designSampleFieldContract";

const codeSchema = z.string().regex(/^[A-Z][A-Z0-9_]*$/u);
const catalogBaseSchema = z
  .object({
    code: codeSchema,
    label: z.string().min(1),
    aliases: z.array(z.string().min(1)),
    sortOrder: z.number().int().nonnegative(),
  })
  .strict();
const domainSchema = catalogBaseSchema
  .extend({
    description: z.string().min(1),
  })
  .strict();
const productSchema = catalogBaseSchema;
const objectTypeSchema = catalogBaseSchema
  .extend({
    domainCode: codeSchema,
  })
  .strict();
const contextSchema = z
  .object({
    domainCode: codeSchema,
    productCode: codeSchema,
    objectTypeCode: codeSchema,
  })
  .strict();
const supportedContextSchema = contextSchema
  .extend({
    sortOrder: z.number().int().nonnegative(),
  })
  .strict();
const fieldSchema = z
  .object({
    code: codeSchema,
    sectionCode: z.enum(["IDENTITY", "OBSERVATION"]),
    label: z.string().min(1),
    description: z.string().min(1),
    valueType: z.enum(["UUID", "STRING", "DATE", "DECIMAL", "ENUM"]),
    precision: z.number().int().positive().nullable(),
    scale: z.number().int().nonnegative().nullable(),
    maxLength: z.number().int().positive().nullable(),
    unit: z.string().min(1).nullable(),
    enumOptions: z.array(z.string().min(1)),
    required: z.boolean(),
    nullable: z.boolean(),
    defaultValue: z.unknown().nullable(),
    editable: z.boolean(),
    minimumValue: z.string().nullable(),
    maximumValue: z.string().nullable(),
    groupCode: codeSchema,
    sortOrder: z.number().int().nonnegative(),
    analysisRole: codeSchema,
  })
  .strict()
  .superRefine((field, issue) => {
    const decimalShape = field.precision !== null && field.scale !== null;
    if ((field.valueType === "DECIMAL") !== decimalShape) {
      issue.addIssue({
        code: "custom",
        message: "decimal precision/scale shape mismatch",
      });
    }
    if ((field.valueType === "ENUM") !== field.enumOptions.length > 0) {
      issue.addIssue({ code: "custom", message: "enum options shape mismatch" });
    }
    if (field.required && field.nullable) {
      issue.addIssue({ code: "custom", message: "required field cannot be nullable" });
    }
  });

export class HttpDesignSampleFieldDefinitionRepository implements DesignSampleFieldDefinitionRepository {
  constructor(private readonly http: HttpClient) {}

  async getDefinition(
    context: DesignSampleContext,
  ): Promise<DesignSampleFieldContract> {
    const schema = contractSchema(context).describe("design-sample-fields-v1");
    const query = new URLSearchParams({
      domainCode: context.domainCode,
      productCode: context.productCode,
      objectTypeCode: context.objectTypeCode,
    });
    return this.http.get(
      `/api/v1/design-sample-field-definitions?${query.toString()}`,
      schema,
    );
  }
}

export function parseDesignSampleFieldContract(
  payload: unknown,
  expectedContext: DesignSampleContext,
): DesignSampleFieldContract {
  return contractSchema(expectedContext).parse(payload);
}

function contractSchema(expectedContext: DesignSampleContext) {
  return z
    .object({
      contractVersion: z.literal("design-sample-fields-v1"),
      contractDigest: z.string().regex(/^sha256:[a-f0-9]{64}$/u),
      context: contextSchema,
      domains: z.array(domainSchema).length(2),
      products: z.array(productSchema).length(3),
      objectTypes: z.array(objectTypeSchema).length(11),
      supportedContexts: z.array(supportedContextSchema).length(27),
      identityFields: z.array(fieldSchema),
      observationFields: z.array(fieldSchema),
    })
    .strict()
    .superRefine((contract, issue) => {
      if (!sameContext(contract.context, expectedContext)) {
        issue.addIssue({
          code: "custom",
          path: ["context"],
          message: "context echo mismatch",
        });
      }
      uniqueCodes(contract.domains, "domains", issue);
      uniqueCodes(contract.products, "products", issue);
      uniqueCodes(contract.objectTypes, "objectTypes", issue);
      uniqueContextKeys(contract.supportedContexts, issue);
      uniqueCodes(
        [...contract.identityFields, ...contract.observationFields],
        "fields",
        issue,
      );
      const domainCodes = new Set(contract.domains.map(({ code }) => code));
      const productCodes = new Set(contract.products.map(({ code }) => code));
      const objects = new Map(
        contract.objectTypes.map((objectType) => [objectType.code, objectType]),
      );
      for (const supported of contract.supportedContexts) {
        const objectType = objects.get(supported.objectTypeCode);
        if (
          !domainCodes.has(supported.domainCode) ||
          !productCodes.has(supported.productCode) ||
          objectType?.domainCode !== supported.domainCode
        ) {
          issue.addIssue({
            code: "custom",
            path: ["supportedContexts"],
            message: "supported context references an unknown catalog entry",
          });
        }
      }
      if (
        !contract.supportedContexts.some((entry) => sameContext(entry, expectedContext))
      ) {
        issue.addIssue({
          code: "custom",
          path: ["supportedContexts"],
          message: "context is not supported",
        });
      }
      if (contract.identityFields.some((field) => field.sectionCode !== "IDENTITY")) {
        issue.addIssue({
          code: "custom",
          path: ["identityFields"],
          message: "identity section mismatch",
        });
      }
      if (
        contract.observationFields.some((field) => field.sectionCode !== "OBSERVATION")
      ) {
        issue.addIssue({
          code: "custom",
          path: ["observationFields"],
          message: "observation section mismatch",
        });
      }
    });
}

function sameContext(left: DesignSampleContext, right: DesignSampleContext) {
  return (
    left.domainCode === right.domainCode &&
    left.productCode === right.productCode &&
    left.objectTypeCode === right.objectTypeCode
  );
}

function uniqueCodes(
  values: readonly { readonly code: string }[],
  path: string,
  issue: z.RefinementCtx,
) {
  if (new Set(values.map(({ code }) => code)).size !== values.length) {
    issue.addIssue({ code: "custom", path: [path], message: "duplicate code" });
  }
}

function uniqueContextKeys(
  contexts: readonly DesignSampleContext[],
  issue: z.RefinementCtx,
) {
  const keys = contexts.map(
    ({ domainCode, productCode, objectTypeCode }) =>
      `${domainCode}:${productCode}:${objectTypeCode}`,
  );
  if (new Set(keys).size !== keys.length) {
    issue.addIssue({
      code: "custom",
      path: ["supportedContexts"],
      message: "duplicate context",
    });
  }
}
