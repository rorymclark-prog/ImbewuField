import assert from 'node:assert/strict';
import type { CropPlanStorageContext, CropPlanStorageLocks } from '../lib/crop-plan-storage.ts';

let authority: typeof import('../lib/crop-plan-storage.ts') | undefined;

// These tests execute the production initializer and retained lease. A fake
// ready result would bypass precisely the account/storage guards being tested.
class FixtureLocks implements CropPlanStorageLocks {
  private held = new Set<string>();
  async request<T>(name: string, _options: { mode: 'exclusive'; ifAvailable: true }, run: (lock: unknown | null) => T | PromiseLike<T>): Promise<T> {
    // Browser lock requests are asynchronous; let an explicitly released prior
    // fixture's callback finish before evaluating ifAvailable for the next one.
    await Promise.resolve();
    if (this.held.has(name)) return await run(null);
    this.held.add(name);
    try { return await run({ name, mode: 'exclusive' }); }
    finally { this.held.delete(name); }
  }
}
const locks = new FixtureLocks();

export function cropPlanFixtureContext(): CropPlanStorageContext {
  assert.ok(authority, 'initialize the fixture after its auth module hooks have been installed');
  const context = authority.makeBrowserCropPlanStorageContext();
  assert.ok(context, 'the fixture must install its actual storage and account boundary first');
  return context;
}

export async function initialiseCropPlanFixture(): Promise<CropPlanStorageContext> {
  authority = await import('../lib/crop-plan-storage.ts');
  authority.releaseAllDocumentCropPlanLeases();
  await Promise.resolve();
  const context = cropPlanFixtureContext();
  const state = await authority.initialiseCropPlanStorage(context, locks);
  assert.equal(state.writable, true, `fixture initialization must acquire a real lease: ${state.reason}`);
  return context;
}

export function releaseCropPlanFixture(): void { authority?.releaseAllDocumentCropPlanLeases(); }
export function canonicalCropPlanFixtureKey(): string { return cropPlanFixtureContext().canonicalKey; }
export function legacyCropPlanFixtureKey(): string { return cropPlanFixtureContext().legacyKey; }

export function readCanonicalCropPlanFixtureRaw(): string {
  const context = cropPlanFixtureContext();
  const envelope = JSON.parse(context.storage.getItem(context.canonicalKey) ?? 'null');
  assert.equal(envelope?.storageVersion, 2, 'read the actual canonical envelope, not the retired old-client copy');
  assert.equal(typeof envelope.bookRaw, 'string');
  return envelope.bookRaw;
}

export function readCanonicalCropPlanFixture<T = Record<string, unknown>>(): T {
  return JSON.parse(readCanonicalCropPlanFixtureRaw()) as T;
}

/** Deliberate external/corrupt-current-book fixture, not a production writer.
 * Keep the real initialized envelope/receipt identity so the case exercises the
 * authored raw book under test rather than an unrelated malformed v2 wrapper. */
export function replaceCanonicalCropPlanFixtureRaw(bookRaw: string): void {
  const context = cropPlanFixtureContext();
  const envelope = JSON.parse(context.storage.getItem(context.canonicalKey) ?? 'null');
  assert.equal(envelope?.storageVersion, 2, 'initialize before replacing a current raw-book fixture');
  assert.equal(typeof envelope.cutoverId, 'string');
  context.storage.setItem(context.canonicalKey, JSON.stringify({ ...envelope, bookRaw }));
}
