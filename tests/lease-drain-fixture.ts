import type { CropPlanStorageLocks } from '../lib/crop-plan-storage.ts';

export function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}

export class LeaseDrainStorage {
  rows = new Map<string, string>();
  writes: string[] = [];
  getItem(key: string): string | null { return this.rows.get(key) ?? null; }
  setItem(key: string, raw: string): void { this.rows.set(key, String(raw)); this.writes.push(key); }
  removeItem(key: string): void { this.rows.delete(key); this.writes.push(key); }
}

/** A callback can finish before its manager has relinquished the lock. Keeping
 * these separate catches first-login races hidden by immediately deleting held. */
export class LeaseDrainLocks implements CropPlanStorageLocks {
  held = new Set<string>();
  requests: string[] = [];
  pauseFirstGrant = false;
  holdManagerRelease = true;
  readonly grant = deferred();
  readonly releaseEntered = deferred();
  readonly managerReleased = deferred();
  async request<T>(name: string, _options: { mode: 'exclusive'; ifAvailable: true }, run: (lock: unknown | null) => T | PromiseLike<T>): Promise<T> {
    const first = this.requests.length === 0;
    this.requests.push(name);
    if (first && this.pauseFirstGrant) await this.grant.promise;
    if (this.held.has(name)) return run(null);
    this.held.add(name);
    try { return await run({ name }); }
    finally {
      if (this.holdManagerRelease) {
        this.releaseEntered.resolve();
        await this.managerReleased.promise;
      }
      this.held.delete(name);
    }
  }
  open(): void {
    this.holdManagerRelease = false;
    this.grant.resolve(); this.managerReleased.resolve();
  }
}
