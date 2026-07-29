import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

class MemoryStorage {
  readonly rows = new Map<string, string>();
  refuseWrites = false;
  throwOnWrite = false;

  get length(): number { return this.rows.size; }
  key(index: number): string | null { return [...this.rows.keys()][index] ?? null; }
  getItem(key: string): string | null { return this.rows.get(String(key)) ?? null; }
  setItem(key: string, value: string): void {
    if (this.throwOnWrite) throw new Error('storage unavailable');
    if (!this.refuseWrites) this.rows.set(String(key), String(value));
  }
  removeItem(key: string): void { this.rows.delete(String(key)); }
  clear(): void { this.rows.clear(); }
}

Object.defineProperty(globalThis, 'Storage', {
  configurable: true,
  value: MemoryStorage,
});

const realLocal = new MemoryStorage();
const session = new MemoryStorage();
const browser = new EventTarget() as EventTarget & {
  localStorage: MemoryStorage;
  sessionStorage: MemoryStorage;
};
browser.localStorage = realLocal;
browser.sessionStorage = session;
Object.defineProperty(globalThis, 'window', { configurable: true, value: browser });
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: realLocal });
Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: session });

const sample = await import('../lib/sample-mode.ts');
const { buildDemoStorageSeeds } = await import('../lib/demo-farm.ts');

function reset(): void {
  session.refuseWrites = false;
  session.throwOnWrite = false;
  sample.exitSampleMode();
  realLocal.rows.clear();
  session.rows.clear();
}

test('sample localStorage reads and writes are isolated from a real farmer', () => {
  reset();
  realLocal.setItem('real-only', 'farmer');
  realLocal.setItem('shared-key', 'real value');

  assert.equal(sample.enterSampleMode(), true);
  assert.equal(sample.isSampleMode(), true);
  assert.equal(realLocal.getItem('real-only'), null);
  assert.equal(realLocal.getItem('shared-key'), null);

  realLocal.setItem('shared-key', 'demo value');
  realLocal.setItem('demo-only', 'sandbox');
  assert.equal(realLocal.getItem('shared-key'), 'demo value');
  assert.equal(realLocal.getItem('demo-only'), 'sandbox');

  realLocal.clear();
  assert.equal(realLocal.getItem('demo-only'), null);
  assert.deepEqual(
    Object.fromEntries(realLocal.rows),
    { 'real-only': 'farmer', 'shared-key': 'real value' },
    'sample clear() must not touch the backing store',
  );

  sample.exitSampleMode();
  assert.equal(sample.isSampleMode(), false);
  assert.equal(realLocal.getItem('real-only'), 'farmer');
  assert.equal(realLocal.getItem('shared-key'), 'real value');
  assert.equal(realLocal.getItem('demo-only'), null);
});

test('the session flag is never swallowed by the localStorage shim', () => {
  reset();
  assert.equal(sample.enterSampleMode(), true);
  assert.equal(session.getItem('imbewu_sample_mode'), '1');

  realLocal.clear();
  assert.equal(session.getItem('imbewu_sample_mode'), '1');

  sample.exitSampleMode();
  assert.equal(session.getItem('imbewu_sample_mode'), null);
});

test('entering again starts from clean seeded storage and clean typed data', () => {
  reset();
  const seeds = buildDemoStorageSeeds();
  assert.equal(sample.enterSampleMode(), true);
  assert.equal(realLocal.getItem('imbewu_farm_shapes'), seeds.imbewu_farm_shapes);

  realLocal.setItem('demo-edit', 'changed');
  const originalSales = sample.getSandboxSales().length;
  sample.addSandboxSale({ crop: 'temporary sample edit' });
  assert.equal(sample.getSandboxSales().length, originalSales + 1);

  sample.exitSampleMode();
  assert.equal(sample.enterSampleMode(), true);
  assert.equal(realLocal.getItem('demo-edit'), null);
  assert.equal(realLocal.getItem('imbewu_farm_shapes'), buildDemoStorageSeeds().imbewu_farm_shapes);
  assert.equal(sample.getSandboxSales().length, originalSales);
});

test('sample-mode entry fails closed when sessionStorage throws or silently refuses the flag', () => {
  reset();
  realLocal.setItem('real-only', 'farmer');

  session.throwOnWrite = true;
  assert.equal(sample.enterSampleMode(), false);
  assert.equal(sample.isSampleMode(), false);
  assert.equal(realLocal.getItem('real-only'), 'farmer');

  session.throwOnWrite = false;
  session.refuseWrites = true;
  assert.equal(sample.enterSampleMode(), false);
  assert.equal(sample.isSampleMode(), false);
  assert.equal(realLocal.getItem('real-only'), 'farmer');
});

test('entry dispatches one change event only after isolation is active', () => {
  reset();
  let changes = 0;
  const onChange = () => {
    changes += 1;
    assert.equal(sample.isSampleMode(), true);
  };
  browser.addEventListener(sample.SAMPLE_MODE_EVENT, onChange);

  assert.equal(sample.enterSampleMode(), true);
  assert.equal(changes, 1);

  browser.removeEventListener(sample.SAMPLE_MODE_EVENT, onChange);
  sample.exitSampleMode();
});

test('the home entry point only navigates when sample isolation succeeds', () => {
  const source = readFileSync(new URL('../app/home/page.tsx', import.meta.url), 'utf8');
  assert.match(source, /if\s*\(\s*enterSampleMode\(\)\s*\)\s*router\.push\(/);
  assert.doesNotMatch(source, /enterSampleMode\(\)\s*;\s*router\.push\(/);
});
