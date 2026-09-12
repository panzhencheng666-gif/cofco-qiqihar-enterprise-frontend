import { expect, it, vi } from "vitest";
import { HttpOverviewSamplePointRepository } from "./HttpOverviewSamplePointRepository";
it("shares identical requests, reuses settled data, and invalidates on changes", async()=>{
 const get=vi.fn().mockResolvedValue({data:{items:[],pageNumber:0,pageSize:100,totalElements:0,totalPages:0}});
 const repository=new HttpOverviewSamplePointRepository({get});const query={page:0,pageSize:100,productCode:"CORN",regionCode:"230221100"};
 await Promise.all([repository.designPoints(query),repository.designPoints(query)]);await repository.designPoints(query);expect(get).toHaveBeenCalledTimes(1);
 repository.invalidateFormalCatalog();await repository.designPoints(query);expect(get).toHaveBeenCalledTimes(2);
});
