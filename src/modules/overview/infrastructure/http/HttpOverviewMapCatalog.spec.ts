import { describe, it, expect, vi } from "vitest";
import { HttpOverviewSamplePointRepository } from "./HttpOverviewSamplePointRepository";
import type { HttpClient } from "../../../../shared/api/HttpClient";
const row = { samplePointId: "94000000-0000-0000-0000-000000000001", name: "样本甲", regionCode: "230225", iconKey: "market", roles: [{ code: "MARKET", name: "市场类", iconKey: "market" }], types: [{code: "PROCESSOR",name: "加工企业",iconKey:"market"}],longitude:123.4,latitude:48.2,dataQualityReason:null };
describe("thin map catalogue", () => {
 it("coalesces a region load and filters the same response without fetching observations or full master pages", async () => {
  const get=vi.fn().mockResolvedValue({data:[row]});
  const r=new HttpOverviewSamplePointRepository({get} as unknown as HttpClient);
  const scope={regionCode:"230200",productCode:"CORN",year:2026};
  const [a,b]=await Promise.all([r.mapCatalog(scope),r.mapCatalog({...scope,categoryCode:"MARKET"})]);
  expect(get).toHaveBeenCalledTimes(1);expect(get.mock.calls[0]?.[0]).toContain("/overview/map-samples?");
  expect(a.list.totalCount).toBe(1);expect(a.icons.length).toBe(a.list.totalCount);expect(b.list.items).toHaveLength(1);
  expect((await r.mapCatalog({...scope,query:"不存在"})).icons).toHaveLength(0);expect(get).toHaveBeenCalledTimes(1);
  r.invalidateFormalCatalog();get.mockResolvedValue({data:[]});expect((await r.mapCatalog(scope)).list.totalCount).toBe(0);expect(get).toHaveBeenCalledTimes(2);
 });
 it("keeps products, years and regions out of each other's cache",async()=>{
  const get=vi.fn().mockResolvedValue({data:[row]});const r=new HttpOverviewSamplePointRepository({get} as unknown as HttpClient);
  for(const regionCode of ["230200","230225","230225201","230225201001"])await r.mapCatalog({regionCode,year:2026,productCode:"CORN"});
  await r.mapCatalog({regionCode:"230225",year:2025,productCode:"CORN"});expect(get).toHaveBeenCalledTimes(5);
 });
});
