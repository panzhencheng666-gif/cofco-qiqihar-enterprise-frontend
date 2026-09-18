interface CacheEntry {
  readonly expiresAt: number;
  readonly promise: Promise<unknown>;
}

export class ReadRequestCache {
  private readonly entries = new Map<string, CacheEntry>();

  constructor(
    private readonly ttlMs = 5 * 60_000,
    private readonly maximumEntries = 128,
  ) {}

  get<T>(key: string, load: () => Promise<T>): Promise<T> {
    const cached = this.entries.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.promise as Promise<T>;
    }
    if (cached) this.entries.delete(key);

    const promise = Promise.resolve()
      .then(load)
      .catch((failure: unknown) => {
        const current = this.entries.get(key);
        if (current?.promise === promise) this.entries.delete(key);
        throw failure;
      });
    if (this.entries.size >= this.maximumEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest !== undefined) this.entries.delete(oldest);
    }
    this.entries.set(key, { expiresAt: Date.now() + this.ttlMs, promise });
    return promise;
  }
}
