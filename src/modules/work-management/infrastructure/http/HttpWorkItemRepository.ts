import { z } from "zod";

import type { HttpClient } from "../../../../shared/api/HttpClient";
import { queryString } from "../../../../shared/api/HttpClient";
import type { WorkItemRepository } from "../../application/ports/WorkItemRepository";

const responseSchema = z.object({
  data: z.object({
    items: z.array(
      z.object({
        id: z.string(),
        task: z.string(),
        domain: z.string(),
        region: z.string(),
        product: z.string().nullable(),
        businessPeriod: z.string(),
        dueAt: z.string(),
        workflowNode: z.string(),
        status: z.string().nullable(),
        responsibleParty: z.string(),
      }),
    ),
    pageNumber: z.number().int().nonnegative(),
    pageSize: z.number().int().positive(),
    totalElements: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
  }),
});

export class HttpWorkItemRepository implements WorkItemRepository {
  constructor(private readonly http: HttpClient) {}

  async search(criteria: Parameters<WorkItemRepository["search"]>[0]) {
    const response = await this.http.get(
      `/api/v1/work-items${queryString({
        scope: criteria.scope,
        status: criteria.status,
        domain: criteria.domain,
        regionId: criteria.regionId,
        productCode: criteria.productCode,
        page: criteria.pageNumber,
        pageSize: criteria.pageSize,
      })}`,
      responseSchema,
    );
    return {
      ...response.data,
      items: response.data.items.map((item) => ({
        id: item.id,
        values: {
          WORK_TASK_NAME: item.task,
          WORK_BUSINESS_DOMAIN: item.domain,
          WORK_REGION_NAME: item.region,
          WORK_PRODUCT_NAME: item.product,
          WORK_BUSINESS_PERIOD: item.businessPeriod,
          WORK_DUE_AT: item.dueAt,
          WORKFLOW_NODE_LABEL: item.workflowNode,
          WORK_STATUS_LABEL: item.status,
          WORK_RESPONSIBLE_PARTY: item.responsibleParty,
        },
      })),
    };
  }
}
