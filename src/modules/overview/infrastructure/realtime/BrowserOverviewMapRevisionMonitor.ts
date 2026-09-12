/** A payload-free revision also covers changes outside the user's write regions. */
export class BrowserOverviewMapRevisionMonitor {
  constructor(
    private readonly read: (signal: AbortSignal) => Promise<string> = readRevision,
  ) {}

  subscribe(changed: () => void) {
    let closed = false;
    let revision: string | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let active: AbortController | undefined;
    const poll = async () => {
      if (closed || active || document.visibilityState === "hidden" || !navigator.onLine) return;
      clearTimeout(timer);
      const controller = new AbortController();
      active = controller;
      const timeout = setTimeout(() => controller.abort(), 10_000);
      try {
        const next = await this.read(controller.signal);
        if (!closed && next !== revision) {
          const hadBaseline = revision !== undefined;
          revision = next;
          if (hadBaseline) changed();
        }
      } catch {
        // Business SSE remains primary; this is a low-frequency recovery check.
      } finally {
        clearTimeout(timeout);
        active = undefined;
        if (!closed) timer = setTimeout(() => void poll(), 60_000);
      }
    };
    const resume = () => { void poll(); };
    const visibility = () => {
      if (document.visibilityState === "hidden") clearTimeout(timer);
      else resume();
    };
    window.addEventListener("online", resume);
    document.addEventListener("visibilitychange", visibility);
    void poll();
    return () => {
      closed = true;
      clearTimeout(timer);
      active?.abort();
      window.removeEventListener("online", resume);
      document.removeEventListener("visibilitychange", visibility);
    };
  }
}

async function readRevision(signal: AbortSignal): Promise<string> {
  const response = await fetch("/api/v1/overview/map-revision", {
    credentials: "same-origin",
    cache: "no-store",
    signal,
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error("Map revision unavailable");
  const payload = (await response.json()) as { data?: unknown };
  if (typeof payload.data !== "string" || !/^[0-9a-f-]{36}$/i.test(payload.data)) {
    throw new Error("Invalid map revision");
  }
  return payload.data;
}
