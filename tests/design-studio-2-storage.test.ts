import test from 'node:test';
import assert from 'node:assert/strict';

// A minimal localStorage before the module under test reads `window` at import time.
class MemoryStorage {
  private map = new Map<string, string>();
  full = false;
  getItem(k: string) { return this.map.has(k) ? this.map.get(k)! : null; }
  setItem(k: string, v: string) {
    if (this.full) throw new DOMException('QuotaExceededError');
    this.map.set(k, v);
  }
  removeItem(k: string) { this.map.delete(k); }
  key(i: number) { return [...this.map.keys()][i] ?? null; }
  get length() { return this.map.size; }
  raw() { return this.map; }
}

const storage = new MemoryStorage();
(globalThis as { window?: unknown }).window = { localStorage: storage };
(globalThis as { localStorage?: unknown }).localStorage = storage;

const {
  loadStudio2Design, saveStudio2Design, clearStudio2Design, STUDIO2_STORAGE_BASE,
} = await import('../lib/design-studio-2-storage.ts');

const SITE = 'studio2';
const OWNER = 'uid-1';
const design = {
  items: [{ id: 'i1', defId: 'jojo_5000', xM: 4, yM: 7 }],
  lines: [{ id: 'l1', kind: 'pipe' as const, pointsM: [[0, 0], [3, 4]] as Array<[number, number]> }],
};

function storedKey() {
  return [...storage.raw().keys()].find((k) => k.startsWith(STUDIO2_STORAGE_BASE))!;
}

test('a saved design comes back exactly as it went in', () => {
  storage.raw().clear();
  saveStudio2Design(SITE, design, OWNER);
  assert.deepEqual(loadStudio2Design(SITE, OWNER), design);
});

test('IT DOES NOT WRITE TO THE REAL DESIGN STORE', () => {
  // The single most important assertion in this file. 2.0's coordinates are metres from a stage
  // origin; the farmer's real design is georeferenced and the CURRENT studio reads it. A key
  // collision here would overwrite a real plan with numbers that mean something else.
  storage.raw().clear();
  saveStudio2Design(SITE, design, OWNER);
  for (const k of storage.raw().keys()) {
    assert.ok(k.startsWith(STUDIO2_STORAGE_BASE), `wrote outside its own namespace: ${k}`);
    assert.ok(!k.includes('imbewu_design_canvas'), `collided with the real design store: ${k}`);
  }
});

test('one account cannot read another account\'s stage', () => {
  storage.raw().clear();
  saveStudio2Design(SITE, design, 'uid-a');
  assert.equal(loadStudio2Design(SITE, 'uid-b'), null);
  assert.deepEqual(loadStudio2Design(SITE, 'uid-a'), design);
});

test('corrupt entries are dropped, not rendered', () => {
  // localStorage is editable by anyone at the keyboard and outlives every refactor of this shape.
  // A NaN coordinate reaching the canvas takes the whole studio down.
  storage.raw().clear();
  saveStudio2Design(SITE, design, OWNER);
  const key = storedKey();
  const parsed = JSON.parse(storage.getItem(key)!);
  parsed.items.push({ id: 'bad', defId: 'x', xM: 'NOT A NUMBER', yM: 2 });
  parsed.items.push({ id: '', defId: 'y', xM: 1, yM: 2 });
  parsed.lines.push({ id: 'short', kind: 'pipe', pointsM: [[1, 1]] }); // one point is not a line
  storage.setItem(key, JSON.stringify(parsed));

  const out = loadStudio2Design(SITE, OWNER)!;
  assert.deepEqual(out.items, design.items);
  assert.deepEqual(out.lines, design.lines);
});

test('an unreadable or future record loads as nothing rather than throwing', () => {
  storage.raw().clear();
  saveStudio2Design(SITE, design, OWNER);
  const key = storedKey();

  storage.setItem(key, 'not json at all');
  assert.equal(loadStudio2Design(SITE, OWNER), null);

  storage.setItem(key, JSON.stringify({ v: 999, items: [], lines: [] }));
  assert.equal(loadStudio2Design(SITE, OWNER), null, 'a version it cannot read must not be guessed at');
});

test('a record whose every entry is corrupt reports NOTHING, not an empty design', () => {
  // The difference matters: the shell only skips its save when the design is empty AND nothing
  // was ever stored. Returning {items:[],lines:[]} here would look like a real empty design and
  // let the next save flatten a record that might still have been recoverable by hand.
  storage.raw().clear();
  saveStudio2Design(SITE, design, OWNER);
  storage.setItem(storedKey(), JSON.stringify({ v: 1, items: [{ nonsense: true }], lines: ['?'] }));
  assert.equal(loadStudio2Design(SITE, OWNER), null);
});

test('a failed write throws, so the caller can never report a save that did not happen', () => {
  storage.raw().clear();
  storage.full = true;
  assert.throws(() => saveStudio2Design(SITE, design, OWNER), /Quota|Could not save/);
  storage.full = false;
});

test('clearing removes the record', () => {
  storage.raw().clear();
  saveStudio2Design(SITE, design, OWNER);
  clearStudio2Design(SITE, OWNER);
  assert.equal(loadStudio2Design(SITE, OWNER), null);
});
