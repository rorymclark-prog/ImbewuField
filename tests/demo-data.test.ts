import test from 'node:test';
import assert from 'node:assert/strict';

const PKEY = 'imbewu_demo_production';
const SKEY = 'imbewu_demo_sales';
const JKEY = 'imbewu_demo_project';

class MemoryStorage {
  readonly rows = new Map<string, string>();
  failSetKey: string | null = null;
  failRemoveKey: string | null = null;

  getItem(key: string): string | null { return this.rows.get(key) ?? null; }
  setItem(key: string, value: string): void {
    if (key === this.failSetKey) throw new Error('quota exceeded');
    this.rows.set(key, value);
  }
  removeItem(key: string): void {
    if (key === this.failRemoveKey) throw new Error('remove refused');
    this.rows.delete(key);
  }
}

const storage = new MemoryStorage();
const browser = new EventTarget() as EventTarget & { localStorage: MemoryStorage };
browser.localStorage = storage;
Object.defineProperty(globalThis, 'window', { configurable: true, value: browser });
const {
  clearSampleFarmData,
  getLocalProduction,
  getLocalProject,
  getLocalSales,
  hasSampleData,
  loadSampleFarmData,
} = await import('../lib/demo-data.ts');

function reset(): void {
  storage.rows.clear();
  storage.failSetKey = null;
  storage.failRemoveKey = null;
}

test('the built-in sample loads as one complete, finite farm record set', () => {
  reset();
  assert.equal(loadSampleFarmData(), true);
  const production = getLocalProduction();
  const sales = getLocalSales();
  const project = getLocalProject();

  assert.ok(production.length > 0);
  assert.ok(sales.length > 0);
  assert.ok(project);
  assert.ok(production.every((row) => row.kg >= 0 && Number.isFinite(row.kg)));
  assert.ok(sales.every((row) => row.kg >= 0 && row.amount >= 0
    && Number.isFinite(row.kg) && Number.isFinite(row.amount)));
  assert.ok(project.disbursed <= project.contractValue);
  assert.equal(hasSampleData(), true);
});

test('malformed production and sales rows are filtered before assistant arithmetic', () => {
  reset();
  storage.setItem(PKEY, JSON.stringify([
    { crop: 'Spinach', kg: 2, loggedAt: '2026-01-01' },
    { crop: 'String kg', kg: '20', loggedAt: '2026-01-01' },
    { crop: 'Negative', kg: -1, loggedAt: '2026-01-01' },
    { crop: '', kg: 3, loggedAt: '2026-01-01' },
    { crop: 'Bad date', kg: 3, loggedAt: 'not a date' },
  ]));
  storage.setItem(SKEY, JSON.stringify([
    { crop: 'Spinach', kg: 2, amount: 40, buyer: 'Market', soldAt: '2026-01-02' },
    { crop: 'Infinite', kg: 2, amount: null, buyer: 'Market', soldAt: '2026-01-02' },
    { crop: 'Negative', kg: 2, amount: -1, buyer: 'Market', soldAt: '2026-01-02' },
  ]));

  assert.deepEqual(getLocalProduction().map((row) => row.crop), ['Spinach']);
  assert.deepEqual(getLocalSales().map((row) => row.crop), ['Spinach']);
});

test('a malformed or financially impossible project is ignored', () => {
  reset();
  storage.setItem(JKEY, JSON.stringify({
    programme: 'Programme',
    funder: 'Funder',
    ngo: '',
    contractValue: 100,
    disbursed: 101,
    currency: 'R',
    garden: 'Garden',
    plotSizeM2: 10,
    supervisor: '',
    startDate: '2026-01-01',
    endDate: '2026-02-01',
    obligations: [],
    milestones: [],
  }));

  assert.equal(getLocalProject(), null);
  assert.equal(hasSampleData(), false);
});

test('sample loading rolls back every key when a later write fails', () => {
  reset();
  storage.setItem(PKEY, 'old-production');
  storage.setItem(SKEY, 'old-sales');
  storage.setItem(JKEY, 'old-project');
  const before = new Map(storage.rows);
  let changes = 0;
  const listener = () => { changes += 1; };
  browser.addEventListener('imbewu-farmdata-changed', listener);
  storage.failSetKey = JKEY;

  assert.equal(loadSampleFarmData(), false);
  assert.deepEqual(storage.rows, before);
  assert.equal(changes, 0);

  storage.failSetKey = null;
  browser.removeEventListener('imbewu-farmdata-changed', listener);
});

test('sample clearing rolls back every key when one removal fails', () => {
  reset();
  assert.equal(loadSampleFarmData(), true);
  const before = new Map(storage.rows);
  let changes = 0;
  const listener = () => { changes += 1; };
  browser.addEventListener('imbewu-farmdata-changed', listener);
  storage.failRemoveKey = SKEY;

  assert.equal(clearSampleFarmData(), false);
  assert.deepEqual(storage.rows, before);
  assert.equal(changes, 0);

  storage.failRemoveKey = null;
  browser.removeEventListener('imbewu-farmdata-changed', listener);
});

test('successful load and clear each announce exactly one real state change', () => {
  reset();
  let changes = 0;
  const listener = () => { changes += 1; };
  browser.addEventListener('imbewu-farmdata-changed', listener);

  assert.equal(loadSampleFarmData(), true);
  assert.equal(changes, 1);
  assert.equal(clearSampleFarmData(), true);
  assert.equal(changes, 2);
  assert.equal(hasSampleData(), false);

  browser.removeEventListener('imbewu-farmdata-changed', listener);
});
