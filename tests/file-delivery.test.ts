import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { deliverFile, shareFile, openFileInTab } from '@/lib/file-delivery';

// Synthetic browser stubs test real outcomes, including the cancelled share
// and blocked popup that used to be reported as a successfully shared plan.
async function device(run: (state: { downloads: number; shares: number; coarse: boolean; blocked: boolean; result: string; opener: unknown; navigated: string }) => Promise<void>) {
  const state = { downloads: 0, shares: 0, coarse: false, blocked: false, result: 'shared', opener: {} as unknown, navigated: '' };
  const saved = new Map<string, PropertyDescriptor | undefined>();
  const replace = (key: string, value: unknown) => { saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key)); Object.defineProperty(globalThis, key, { configurable: true, writable: true, value }); };
  const oldCreate = URL.createObjectURL, oldRevoke = URL.revokeObjectURL;
  replace('setTimeout', () => 0);
  replace('navigator', { canShare: () => true, share: async () => {
    state.shares++;
    if (state.result !== 'shared') throw Object.assign(new Error(state.result), { name: state.result });
  } });
  replace('document', { body: { appendChild: () => {} }, createElement: () => ({ click: () => state.downloads++, remove: () => {} }) });
  replace('window', { matchMedia: () => ({ matches: state.coarse }), open: (url: string, target: string, features?: string) => {
    assert.equal(url, '', 'open a blank tab before detaching its opener');
    assert.equal(target, '_blank');
    assert.equal(features, undefined, 'noopener can return null even when a tab opened');
    if (state.blocked) return null;
    return { set opener(value: unknown) { state.opener = value; }, location: { replace: (next: string) => { assert.equal(state.opener, null); state.navigated = next; } }, close: () => {} };
  } });
  URL.createObjectURL = () => 'blob:fixture'; URL.revokeObjectURL = () => {};
  try { await run(state); } finally {
    URL.createObjectURL = oldCreate; URL.revokeObjectURL = oldRevoke;
    for (const [key, descriptor] of saved) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); }
  }
}
const blob = new Blob(['fixture'], { type: 'application/pdf' });

test('desktop defaults to download but explicitly choosing send opens its share sheet', async () => device(async state => {
  assert.equal(await deliverFile(blob, 'plan.pdf', 'Plan'), 'downloaded');
  assert.equal(state.downloads, 1); assert.equal(state.shares, 0);
  assert.equal(await shareFile(blob, 'plan.pdf', 'Plan'), 'shared');
  assert.equal(state.shares, 1); assert.equal(state.downloads, 1);
}));

test('cancelling a phone share neither claims it was sent nor downloads a declined file', async () => device(async state => {
  state.coarse = true; state.result = 'AbortError';
  assert.equal(await deliverFile(blob, 'plan.pdf', 'Plan'), 'cancelled');
  assert.equal(state.downloads, 0); assert.equal(state.shares, 1);
}));

test('a failed phone share reports the actual fallback download', async () => device(async state => {
  state.coarse = true; state.result = 'NotAllowedError';
  assert.equal(await deliverFile(blob, 'plan.pdf', 'Plan'), 'downloaded');
  assert.equal(state.downloads, 1);
}));

test('an opened print tab is detached before navigation and a blocked popup stays distinguishable', async () => device(async state => {
  assert.equal(openFileInTab(blob), true); assert.equal(state.navigated, 'blob:fixture');
  assert.equal(state.downloads, 0);
  state.blocked = true; state.navigated = '';
  assert.equal(openFileInTab(blob), false); assert.equal(state.navigated, '');
}));


test('the crop export primary button keeps readable light text in both dark themes', () => {
  const source = readFileSync(new URL('../components/crops/CropPlanExportCard.tsx', import.meta.url), 'utf8');
  assert.match(source, /background: primary \? 'var\(--color-forest\)'/);
  assert.match(source, /color: primary \? 'var\(--on-forest\)'/);
  const luminance = (hex: string) => {
    const c = hex.match(/../g)!.map(value => parseInt(value, 16) / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
    return c[0] * .2126 + c[1] * .7152 + c[2] * .0722;
  };
  const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
  const fills = [...css.matchAll(/--color-forest:\s*#([a-f0-9]{6})/gi)].map(match => match[1]);
  const ink = [...css.matchAll(/--on-forest:\s*#([a-f0-9]{6})/gi)].map(match => match[1]);
  assert.ok(fills.length && ink.length);
  for (const bg of fills) for (const fg of ink) {
    const l = [luminance(bg), luminance(fg)].sort((a, b) => a - b);
    assert.ok((l[1] + .05) / (l[0] + .05) >= 4.5, `export button lost readable contrast: ${bg}/${fg}`);
  }
});
