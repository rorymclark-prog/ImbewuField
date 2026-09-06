import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// THE RULE THAT MAKES UI UPGRADES SAFE, enforced rather than remembered.
//
// Rory: "we must be able to upgrade UI in the future ... that it doesn't affect farmers."
// The mechanism is lib/ui-version.ts; the guarantee is a boundary: the flag may only ever be
// read by PRESENTATION. The moment a data path branches on it — a save shape, a cache key, a
// render prompt, a price — the two UIs stop being interchangeable and flipping the switch stops
// being safe. That failure would be invisible in a review and permanent in farmers' data, which
// is why it is a test and not a comment.

class MemoryStorage {
  private map = new Map<string, string>();
  getItem(k: string) { return this.map.has(k) ? this.map.get(k)! : null; }
  setItem(k: string, v: string) { this.map.set(k, v); }
  removeItem(k: string) { this.map.delete(k); }
  raw() { return this.map; }
}
const storage = new MemoryStorage();
const listeners = new Map<string, Set<() => void>>();
(globalThis as { window?: unknown }).window = {
  localStorage: storage,
  addEventListener: (t: string, f: () => void) => {
    if (!listeners.has(t)) listeners.set(t, new Set());
    listeners.get(t)!.add(f);
  },
  removeEventListener: (t: string, f: () => void) => listeners.get(t)?.delete(f),
  dispatchEvent: (e: { type: string }) => { listeners.get(e.type)?.forEach((f) => f()); return true; },
};
(globalThis as { Event?: unknown }).Event = class { type: string; constructor(t: string) { this.type = t; } };

const { uiVersion, setUiVersion, DEFAULT_UI_VERSION, UI_VERSION_KEY } = await import('../lib/ui-version.ts');

test('unset, unknown and corrupt stored values all resolve to the default', () => {
  storage.raw().clear();
  assert.equal(uiVersion(), DEFAULT_UI_VERSION);
  storage.setItem(UI_VERSION_KEY, 'a-ui-we-retired-years-ago');
  assert.equal(uiVersion(), DEFAULT_UI_VERSION, 'a retired version name must never crash or stick');
  storage.setItem(UI_VERSION_KEY, '');
  assert.equal(uiVersion(), DEFAULT_UI_VERSION);
});

// Rory retired the classic choice: old preferences must not retain the old UI.
test('legacy classic preferences resolve to the standard card view', () => {
  storage.raw().clear();
  setUiVersion('cards');
  assert.equal(uiVersion(), 'cards');
  setUiVersion('classic');
  assert.equal(uiVersion(), 'cards');
});

test('THE BOUNDARY: no data path reads the UI version', () => {
  // Sweep every module under lib/ except the flag's own module. lib/ is where saves, cache keys,
  // prompts, prices and sync live; a UI flag import appearing there is the exact defect this file
  // exists to catch. Components are allowed to read it — they ARE presentation. The one lib
  // exception would be another presentation-only module, which should then be named here with a
  // reason, the same way glossy-filters documents its own exceptions.
  const LIB = join(process.cwd(), 'lib');
  const offenders: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) { walk(p); continue; }
      if (!/\.(ts|tsx|mjs)$/.test(name)) continue;
      if (p.endsWith(`ui-version.ts`)) continue;
      const src = readFileSync(p, 'utf8');
      if (src.includes("from '@/lib/ui-version'") || src.includes('imbewu_ui_version')) {
        offenders.push(p.slice(process.cwd().length + 1));
      }
    }
  };
  walk(LIB);
  assert.deepEqual(offenders, [], `data-layer modules reading the UI version:\n${offenders.join('\n')}`);
});

test('the AI producer prompt and render jobs never mention the UI version', () => {
  // Belt and braces on the two most expensive paths specifically: the prompt builder (Codex's
  // file) and the queue. A UI flag reaching either would mean the same design renders differently
  // depending on which interface placed it — unexplainable to a farmer, unbillable to debug.
  for (const f of ['lib/producer-prompt.ts', 'lib/render-jobs.ts', 'lib/design-canvas.ts', 'lib/sheet-store.ts']) {
    const src = readFileSync(join(process.cwd(), f), 'utf8');
    assert.ok(!src.includes('ui-version') && !src.includes('imbewu_ui_version'), `${f} references the UI version`);
  }
});
