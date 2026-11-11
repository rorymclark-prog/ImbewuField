import assert from 'node:assert/strict';
import test from 'node:test';
import { deliverFile } from '../lib/file-delivery.ts';

async function browser(run: (state: { shares: number; downloads: number; coarse: boolean; share: () => Promise<void> }) => Promise<void>) {
  const state = { shares: 0, downloads: 0, coarse: true, share: async () => {} };
  const saved = new Map<string, PropertyDescriptor | undefined>();
  for (const [key, value] of Object.entries({
    navigator: { canShare: () => true, share: () => { ++state.shares; return state.share(); } },
    window: { matchMedia: () => ({ matches: state.coarse }) },
    document: { body: { appendChild() {} }, createElement: () => ({ click() { ++state.downloads; }, remove() {} }) },
    setTimeout: () => 0,
  })) {
    saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, value });
  }
  const create = URL.createObjectURL, revoke = URL.revokeObjectURL;
  URL.createObjectURL = () => 'blob:private-fixture'; URL.revokeObjectURL = () => {};
  try { await run(state); } finally {
    URL.createObjectURL = create; URL.revokeObjectURL = revoke;
    for (const [key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key);
    }
  }
}
const blob = new Blob(['private nursery fixture'], { type: 'text/csv' });

test('withdrawn or unreadable original context cannot begin sharing or download a private export', async () => browser(async state => {
  for (const current of [() => false, () => { throw Error('Context unavailable'); }]) {
    assert.equal(await deliverFile(blob, 'nursery.csv', 'Nursery', current), 'cancelled');
    assert.equal(state.shares, 0); assert.equal(state.downloads, 0);
  }
}));

test('account withdrawal during native sharing cancels its later unavailable fallback without another delivery', async () => browser(async state => {
  let current = true, reject!: (error: Error) => void;
  state.share = () => new Promise<void>((_resolve, fail) => { reject = fail; });
  const delivery = deliverFile(blob, 'nursery.csv', 'Nursery', () => current);
  assert.equal(state.shares, 1); current = false;
  reject(new Error('Native share unavailable'));
  assert.equal(await delivery, 'cancelled'); assert.equal(state.downloads, 0);
}));

test('a still-current context retains the real fallback, and successful native share is never falsely labelled unsent', async () => browser(async state => {
  state.share = async () => { throw Error('Native unavailable'); };
  assert.equal(await deliverFile(blob, 'nursery.csv', 'Nursery', () => true), 'downloaded');
  assert.equal(state.downloads, 1);
  let current = true;
  state.share = async () => { current = false; };
  assert.equal(await deliverFile(blob, 'nursery.csv', 'Nursery', () => current), 'shared');
  assert.equal(state.downloads, 1);
}));

test('the existing three-argument delivery keeps fallback and user-cancellation behaviour', async () => browser(async state => {
  state.share = async () => { throw Error('Native unavailable'); };
  assert.equal(await deliverFile(blob, 'nursery.csv', 'Nursery'), 'downloaded');
  state.share = async () => { throw Object.assign(new Error('Declined'), { name: 'AbortError' }); };
  assert.equal(await deliverFile(blob, 'nursery.csv', 'Nursery'), 'cancelled');
  assert.equal(state.downloads, 1); assert.equal(state.shares, 2);
}));
