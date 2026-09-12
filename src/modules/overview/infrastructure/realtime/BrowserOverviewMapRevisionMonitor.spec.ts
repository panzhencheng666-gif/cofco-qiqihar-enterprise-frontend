import { afterEach, expect, it, vi } from "vitest";
import { BrowserOverviewMapRevisionMonitor } from "./BrowserOverviewMapRevisionMonitor";
afterEach(() => vi.useRealTimers());
it("does not refetch the whole map for the initial baseline or poll every two seconds", async () => {
 vi.useFakeTimers(); const read=vi.fn().mockResolvedValue("a"); const changed=vi.fn();
 const stop=new BrowserOverviewMapRevisionMonitor(read).subscribe(changed);
 await vi.advanceTimersByTimeAsync(0); expect(read).toHaveBeenCalledTimes(1); expect(changed).not.toHaveBeenCalled();
 await vi.advanceTimersByTimeAsync(59000); expect(read).toHaveBeenCalledTimes(1);
 read.mockResolvedValue("b"); await vi.advanceTimersByTimeAsync(1000); expect(changed).toHaveBeenCalledTimes(1);
 stop(); await vi.advanceTimersByTimeAsync(60000); expect(read).toHaveBeenCalledTimes(2);
});
it("checks immediately when the network recovers and removes listeners on stop", async () => {
 vi.useFakeTimers(); const read=vi.fn().mockResolvedValueOnce("a").mockResolvedValue("b"); const changed=vi.fn();
 const stop=new BrowserOverviewMapRevisionMonitor(read).subscribe(changed); await vi.advanceTimersByTimeAsync(0);
 window.dispatchEvent(new Event("online")); await vi.advanceTimersByTimeAsync(0); expect(changed).toHaveBeenCalledTimes(1);
 stop();window.dispatchEvent(new Event("online"));await vi.advanceTimersByTimeAsync(60000);expect(read).toHaveBeenCalledTimes(2);
});
it("discards a late revision after unsubscribe", async()=>{let finish!:(s:string)=>void;const changed=vi.fn();const stop=new BrowserOverviewMapRevisionMonitor(()=>new Promise<string>(r=>{finish=r})).subscribe(changed);stop();finish("a");await Promise.resolve();expect(changed).not.toHaveBeenCalled();});
