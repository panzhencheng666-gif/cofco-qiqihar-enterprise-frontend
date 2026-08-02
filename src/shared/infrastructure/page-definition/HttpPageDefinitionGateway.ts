import { z } from "zod";

import type { HttpClient } from "../../api/HttpClient";
import type {
  BusinessPageKey,
  ListPageDefinition,
  PageDefinitionGateway,
} from "../../application/page-definition";

const definitionSchema = z.object({
  data: z.object({
    domain: z.string(),
    pageKind: z.string(),
    productCode: z.string(),
    title: z.string(),
    breadcrumbs: z.array(z.object({ code: z.string(), label: z.string() })),
    filters: z.array(
      z.object({
        code: z.string(),
        label: z.string(),
        control: z.enum(["text", "date", "select", "region-hierarchy"]),
        placeholder: z.string(),
        options: z.array(z.object({ value: z.string(), label: z.string() })),
      }),
    ),
    defaultContext: z.record(z.string(), z.string()),
    columnGroups: z.array(
      z.object({
        code: z.string(),
        label: z.string(),
        fields: z.array(
          z.object({
            code: z.string(),
            label: z.string(),
            valueType: z.string(),
            unit: z.string().nullable(),
            description: z.string().nullable(),
          }),
        ),
      }),
    ),
    actions: z.array(
      z.object({
        code: z.string(),
        label: z.string(),
        scope: z.enum(["page", "row"]),
      }),
    ),
    pagination: z.object({
      defaultPageSize: z.number().int().positive(),
      pageSizeOptions: z.array(z.number().int().positive()),
    }),
  }),
});

export class HttpPageDefinitionGateway implements PageDefinitionGateway {
  constructor(private readonly http: HttpClient) {}

  async getDefinition(key: BusinessPageKey): Promise<ListPageDefinition> {
    const response = await this.http.get(
      `/api/v1/page-definitions/${encodeURIComponent(key.domain)}/${encodeURIComponent(key.pageKind)}?productCode=${encodeURIComponent(key.productCode)}`,
      definitionSchema,
    );
    const definition = response.data;

    return {
      key: {
        domain: definition.domain,
        pageKind: definition.pageKind,
        productCode: definition.productCode,
      },
      title: definition.title,
      breadcrumbs: definition.breadcrumbs.map((item) => ({
        id: item.code,
        label: item.label,
      })),
      filters: definition.filters.map((filter) => ({
        id: filter.code,
        label: filter.label,
        control: filter.control,
        placeholder: filter.placeholder,
        options: filter.options,
      })),
      defaultContext: definition.defaultContext,
      columnGroups: definition.columnGroups.map((group) => ({
        id: group.code,
        label: group.label,
        fields: group.fields.map((field) => ({
          id: field.code,
          label: field.label,
          valueType: field.valueType,
          ...(field.unit === null ? {} : { unit: field.unit }),
          ...(field.description === null ? {} : { description: field.description }),
        })),
      })),
      actions: definition.actions.map((action) => ({
        id: action.code,
        label: action.label,
        scope: action.scope,
      })),
      pagination: definition.pagination,
    };
  }
}
