import { z } from "zod";

import type { HttpClient } from "../../../../shared/api/HttpClient";
import { queryString } from "../../../../shared/api/HttpClient";
import type { MarketCollectionRepository } from "../../application/ports/MarketCollectionRepository";
import type {
  MarketCollectionCriteria,
  MarketCollectionDefinition,
  MarketFieldDefinition,
} from "../../domain/marketCollection";

const fieldSchema = z.object({
  id: z.string(),
  name: z.string(),
  unit: z.string().optional(),
  note: z.string().optional(),
});

const definitionResponseSchema = z.object({
  data: z.object({
    productCode: z.string(),
    productName: z.string(),
    fieldGroups: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        fields: z.array(fieldSchema),
      }),
    ),
  }),
});

const recordSchema = z.object({
  id: z.string(),
  collectionDate: z.string(),
  submittedAt: z.string(),
  subjectName: z.string(),
  objectTypeName: z.string(),
  regionName: z.string(),
  cultivarName: z.string(),
  status: z.enum(["填写中", "待审核", "已核定", "需补充"]),
  values: z.record(z.string(), z.string()),
});
const recordListResponseSchema = z.object({ data: z.array(recordSchema) });

function toFieldDefinition(field: z.infer<typeof fieldSchema>): MarketFieldDefinition {
  return {
    id: field.id,
    name: field.name,
    ...(field.unit === undefined ? {} : { unit: field.unit }),
    ...(field.note === undefined ? {} : { note: field.note }),
  };
}

export class HttpMarketCollectionRepository implements MarketCollectionRepository {
  constructor(private readonly http: HttpClient) {}

  async getDefinition(productCode: string): Promise<MarketCollectionDefinition> {
    const definition = (
      await this.http.get(
        `/api/v1/market-collections/definition?productCode=${productCode}`,
        definitionResponseSchema,
      )
    ).data;

    return {
      productCode: definition.productCode,
      productName: definition.productName,
      fieldGroups: definition.fieldGroups.map((group) => ({
        id: group.id,
        name: group.name,
        fields: group.fields.map(toFieldDefinition),
      })),
    };
  }

  async search(criteria: MarketCollectionCriteria) {
    const query = queryString({
      productCode: criteria.productCode,
      collectionDate: criteria.collectionDate,
      regionId: criteria.regionId,
      monitoringPeriodId: criteria.monitoringPeriodId,
      objectTypeId: criteria.objectTypeId,
      cultivarId: criteria.cultivarId,
      status: criteria.status,
    });
    return (
      await this.http.get(
        `/api/v1/market-collections${query}`,
        recordListResponseSchema,
      )
    ).data;
  }
}
