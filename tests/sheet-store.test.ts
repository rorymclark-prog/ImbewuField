import test from 'node:test';
import assert from 'node:assert/strict';

import {
  clearSheets,
  dataUrlBytes,
  deleteSheet,
  loadSheets,
  loadSheetImage,
  loadSheetMetas,
  patchSheetThumb,
  saveSheet,
  type StoredSheet,
} from '../lib/sheet-store.ts';
import { PLAN_VERSION } from '../lib/plan-version.ts';
import { SHEET_RENDER_RECIPE, savedSheetFreshness } from '../lib/sheet-render-recipe.ts';

type Request<T> = {
  result: T;
  onsuccess: null | (() => void);
  onerror: null | (() => void);
  onblocked?: null | (() => void);
  onupgradeneeded?: null | (() => void);
};

function request<T>(result: T): Request<T> {
  return { result, onsuccess: null, onerror: null };
}

class FakeIndexedDb {
  rows = new Map<string, unknown>();
  getAllCalls = 0;
  cursorCalls = 0;
  blocked = false;
  failOpen = false;
  failWrites = false;

  open() {
    if (this.failOpen) throw new Error('disabled');
    const req = request<FakeDb>(undefined as unknown as FakeDb);
    const db = new FakeDb(this);
    req.result = db;
    setTimeout(() => {
      if (this.blocked) req.onblocked?.();
      else req.onsuccess?.();
    }, 0);
    return req;
  }
}

class FakeDb {
  objectStoreNames = { contains: () => true };
  private factory: FakeIndexedDb;
  constructor(factory: FakeIndexedDb) {
    this.factory = factory;
  }
  close() {}
  transaction() {
    return new FakeTransaction(this.factory);
  }
  createObjectStore() {
    return new FakeStore(this.factory, new FakeTransaction(this.factory));
  }
}

class FakeTransaction {
  oncomplete: null | (() => void) = null;
  onabort: null | (() => void) = null;
  onerror: null | (() => void) = null;
  pending = 0;
  started = false;

  private factory: FakeIndexedDb;
  constructor(factory: FakeIndexedDb) {
    this.factory = factory;
  }

  objectStore() {
    return new FakeStore(this.factory, this);
  }

  begin() {
    this.pending += 1;
    this.started = true;
  }

  end(ok: boolean) {
    this.pending -= 1;
    if (!ok) {
      this.onerror?.();
      this.onabort?.();
      return;
    }
    if (this.started && this.pending === 0) this.oncomplete?.();
  }
}

class FakeStore {
  private factory: FakeIndexedDb;
  private transaction: FakeTransaction;
  constructor(factory: FakeIndexedDb, transaction: FakeTransaction) {
    this.factory = factory;
    this.transaction = transaction;
  }

  createIndex() {}

  put(sheet: StoredSheet) {
    const req = request(undefined);
    this.transaction.begin();
    setTimeout(() => {
      if (this.factory.failWrites) {
        req.onerror?.();
        this.transaction.end(false);
      } else {
        this.factory.rows.set(sheet.id, structuredClone(sheet));
        req.onsuccess?.();
        this.transaction.end(true);
      }
    }, 5);
    return req;
  }

  get(id: IDBValidKey) {
    const req = request<unknown>(undefined);
    setTimeout(() => {
      const row = this.factory.rows.get(String(id));
      req.result = row === undefined ? undefined : structuredClone(row);
      req.onsuccess?.();
    }, 0);
    return req;
  }

  delete(id: IDBValidKey) {
    const req = request(undefined);
    this.transaction.begin();
    setTimeout(() => {
      if (this.factory.failWrites) {
        req.onerror?.();
        this.transaction.end(false);
      } else {
        this.factory.rows.delete(String(id));
        req.onsuccess?.();
        this.transaction.end(true);
      }
    }, 10);
    return req;
  }

  index() {
    return {
      getAll: (siteId: string) => {
        this.factory.getAllCalls += 1;
        const req = request<unknown[]>([]);
        setTimeout(() => {
          req.result = [...this.factory.rows.values()]
            .filter((row): row is Record<'siteId', unknown> => (
              typeof row === 'object'
              && row !== null
              && 'siteId' in row
              && row.siteId === siteId
            ))
            .map((row) => structuredClone(row));
          req.onsuccess?.();
        }, 0);
        return req;
      },
      openCursor: (siteId: string) => {
        this.factory.cursorCalls += 1;
        const req = request<IDBCursorWithValue | null>(null);
        const matches = [...this.factory.rows.values()].filter((row): row is Record<'siteId', unknown> => (
          typeof row === 'object'
          && row !== null
          && 'siteId' in row
          && row.siteId === siteId
        ));
        let index = 0;
        const advance = () => {
          setTimeout(() => {
            if (index >= matches.length) {
              req.result = null;
              req.onsuccess?.();
              return;
            }
            const value = structuredClone(matches[index]);
            index += 1;
            req.result = {
              value,
              continue: advance,
            } as unknown as IDBCursorWithValue;
            req.onsuccess?.();
          }, 0);
        };
        advance();
        return req;
      },
      getAllKeys: (siteId: string) => {
        const req = request<IDBValidKey[]>([]);
        this.transaction.begin();
        setTimeout(() => {
          req.result = [...this.factory.rows.values()]
            .filter((row): row is Record<'id' | 'siteId', unknown> => (
              typeof row === 'object'
              && row !== null
              && 'siteId' in row
              && row.siteId === siteId
              && 'id' in row
            ))
            .map((row) => row.id as IDBValidKey);
          req.onsuccess?.();
          this.transaction.end(true);
        }, 0);
        return req;
      },
    };
  }
}

function install(factory?: FakeIndexedDb) {
  Object.defineProperty(globalThis, 'indexedDB', {
    configurable: true,
    value: factory,
  });
}

function sheet(
  id: string,
  siteId: string,
  at: string,
  overrides: Partial<StoredSheet> = {},
): StoredSheet {
  return {
    id,
    siteId,
    label: id,
    image: 'data:image/png;base64,AAAA',
    at,
    resultKind: 'exact',
    provider: 'exact',
    geometryLock: true,
    ...overrides,
  };
}

test('storage-disabled browsers degrade honestly without throwing', async () => {
  install(undefined);
  assert.deepEqual(await loadSheets('site-a'), []);
  assert.equal(await saveSheet(sheet('one', 'site-a', '2026-01-01')), false);
  assert.equal(await deleteSheet('one'), false);
  assert.equal(await clearSheets('site-a'), false);
});

test('saved sheets round-trip with provenance and load oldest first', async () => {
  const factory = new FakeIndexedDb();
  install(factory);
  const later = sheet('later', 'site-a', '2026-02-01', {
    resultKind: 'ai-polished',
    provider: 'openai',
    geometryLock: true,
    showcase: true,
  });
  const earlier = sheet('earlier', 'site-a', '2026-01-01');
  assert.equal(await saveSheet(later), true);
  assert.equal(await saveSheet(earlier), true);
  assert.deepEqual(await loadSheets('site-a'), [earlier, later]);
});

test('site reads and clear-all never cross into another farmer design', async () => {
  const factory = new FakeIndexedDb();
  install(factory);
  const a = sheet('a', 'site-a', '2026-01-01');
  const b = sheet('b', 'site-b', '2026-01-01');
  await saveSheet(a);
  await saveSheet(b);
  assert.deepEqual(await loadSheets('site-a'), [a]);
  assert.deepEqual(await loadSheets('site-b'), [b]);

  assert.equal(await clearSheets('site-a'), true);
  assert.deepEqual(await loadSheets('site-a'), []);
  assert.deepEqual(await loadSheets('site-b'), [b]);
});

test('the same site and sheet ids stay isolated between accounts on one device', async () => {
  const factory = new FakeIndexedDb();
  install(factory);
  const farmerA = sheet('same-sheet', 'same-site', '2026-01-01', {
    label: 'FARMER A ONLY',
  });
  const farmerB = sheet('same-sheet', 'same-site', '2026-02-01', {
    label: 'FARMER B ONLY',
  });

  assert.equal(await saveSheet(farmerA, 'farmer-a'), true);
  assert.equal(await saveSheet(farmerB, 'farmer-b'), true);
  assert.deepEqual(await loadSheets('same-site', 'farmer-a'), [farmerA]);
  assert.deepEqual(await loadSheets('same-site', 'farmer-b'), [farmerB]);
  assert.equal(await loadSheets('same-site', 'fresh-farmer').then((rows) => rows.length), 0);

  assert.equal(await deleteSheet('same-sheet', 'farmer-b'), true);
  assert.deepEqual(await loadSheets('same-site', 'farmer-b'), []);
  assert.deepEqual(await loadSheets('same-site', 'farmer-a'), [farmerA]);

  assert.equal(await saveSheet(farmerB, 'farmer-b'), true);
  assert.equal(await clearSheets('same-site', 'farmer-b'), true);
  assert.deepEqual(await loadSheets('same-site', 'farmer-b'), []);
  assert.deepEqual(await loadSheets('same-site', 'farmer-a'), [farmerA]);
});

test('sample mode cannot read, overwrite or clear real bare IndexedDB sheets', async () => {
  const factory = new FakeIndexedDb();
  install(factory);
  const real = sheet('same-sheet', 'same-site', '2026-01-01', {
    label: 'REAL LEGACY FARMER SHEET',
  });
  const sample = sheet('same-sheet', 'same-site', '2026-02-01', {
    label: 'SAMPLE SHEET',
  });

  // Explicit null deliberately seeds the historical bare namespace.
  assert.equal(await saveSheet(real, null), true);

  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const sampleSession = {
    getItem: (key: string) => (key === 'imbewu_sample_mode' ? '1' : null),
  };
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { sessionStorage: sampleSession },
  });
  try {
    assert.deepEqual(await loadSheets('same-site'), []);
    assert.equal(await saveSheet(sample), true);
    assert.deepEqual(await loadSheets('same-site'), [sample]);
    assert.equal(await clearSheets('same-site'), true);
    assert.deepEqual(await loadSheets('same-site'), []);
    assert.deepEqual(
      await loadSheets('same-site', null),
      [real],
      'sample clear must leave the real bare row untouched',
    );
  } finally {
    if (originalWindow) {
      Object.defineProperty(globalThis, 'window', originalWindow);
    } else {
      Reflect.deleteProperty(globalThis, 'window');
    }
  }
});

test('awaiting delete means the durable row is actually gone', async () => {
  const factory = new FakeIndexedDb();
  install(factory);
  await saveSheet(sheet('one', 'site-a', '2026-01-01'));
  assert.equal(await deleteSheet('one'), true);
  assert.deepEqual(await loadSheets('site-a'), []);
});

test('a failed write is reported as session-only and preserves the prior row', async () => {
  const factory = new FakeIndexedDb();
  install(factory);
  const original = sheet('one', 'site-a', '2026-01-01');
  await saveSheet(original);
  factory.failWrites = true;
  assert.equal(await saveSheet(sheet('one', 'site-a', '2026-02-01')), false);
  assert.deepEqual(await loadSheets('site-a'), [original]);
  assert.equal(await deleteSheet('one'), false);
  assert.equal(await clearSheets('site-a'), false);
  assert.deepEqual(await loadSheets('site-a'), [original]);
});

test('invalid records are rejected on write before they can replace a durable sheet', async () => {
  const factory = new FakeIndexedDb();
  install(factory);
  const original = sheet('one', 'site-a', '2026-01-01');
  assert.equal(await saveSheet(original), true);

  const invalid: StoredSheet[] = [
    sheet('', 'site-a', '2026-02-01'),
    sheet('one', '', '2026-02-01'),
    sheet('one', 'site-a', 'not-a-date'),
    sheet('one', 'site-a', '2026-02-01', { image: 'not-an-image' }),
    sheet('one', 'site-a', '2026-02-01', { thumb: 'data:text/plain;base64,AAAA' }),
    sheet('one', 'site-a', '2026-02-01', { resultKind: 'invented' as StoredSheet['resultKind'] }),
    sheet('one', 'site-a', '2026-02-01', { provider: 'invented' as StoredSheet['provider'] }),
    sheet('one', 'site-a', '2026-02-01', { renderRecipe: '' }),
  ];
  for (const row of invalid) assert.equal(await saveSheet(row), false);
  assert.deepEqual(await loadSheets('site-a'), [original]);
});

test('loads quarantine malformed rows while preserving valid legacy rows', async () => {
  const factory = new FakeIndexedDb();
  install(factory);
  const legacy = sheet('legacy', 'site-a', '2026-01-02');
  delete legacy.resultKind;
  delete legacy.provider;
  delete legacy.geometryLock;
  factory.rows.set('legacy', legacy);
  factory.rows.set('bad-image', { ...sheet('bad-image', 'site-a', '2026-01-03'), image: 'broken' });
  factory.rows.set('bad-date', { ...sheet('bad-date', 'site-a', 'yesterday') });
  factory.rows.set('bad-provenance', { ...sheet('bad-provenance', 'site-a', '2026-01-04'), provider: 'vendor' });

  assert.deepEqual(await loadSheets('site-a'), [legacy]);
});

test('load order follows instants rather than timestamp spelling', async () => {
  const factory = new FakeIndexedDb();
  install(factory);
  const later = sheet('later', 'site-a', '2026-01-01T01:00:00+02:00');
  const earlier = sheet('earlier', 'site-a', '2025-12-31T22:30:00Z');
  factory.rows.set(later.id, later);
  factory.rows.set(earlier.id, earlier);

  assert.deepEqual(await loadSheets('site-a'), [earlier, later]);
});

test('open failures and blocked upgrades resolve instead of hanging', async () => {
  const throwing = new FakeIndexedDb();
  throwing.failOpen = true;
  install(throwing);
  assert.deepEqual(await loadSheets('site-a'), []);

  const blocked = new FakeIndexedDb();
  blocked.blocked = true;
  install(blocked);
  const result = await Promise.race([
    loadSheets('site-a'),
    new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), 100)),
  ]);
  assert.notEqual(result, 'timeout');
  assert.deepEqual(result, []);
});

test('base64 data URL size accounts for padding and rejects non-data text', () => {
  assert.equal(dataUrlBytes('data:image/png;base64,AAAA'), 3);
  assert.equal(dataUrlBytes('data:image/png;base64,TWE='), 2);
  assert.equal(dataUrlBytes('data:image/png;base64,TQ=='), 1);
  assert.equal(dataUrlBytes('data:text/plain;base64,AAAA'), 0);
  assert.equal(dataUrlBytes('hello,AAAA'), 0);
  assert.equal(dataUrlBytes('data:image/png;base64,%%%='), 0);
  assert.equal(dataUrlBytes('not-a-data-url'), 0);
  assert.equal(dataUrlBytes(''), 0);
});

// ─── The memory contract: metas carry no images; images load one at a time ──────────────────

test('loadSheetMetas returns every row WITHOUT its image payload', async () => {
  const db = new FakeIndexedDb();
  install(db);
  await saveSheet(sheet('m1', 'site-m', '2026-01-01'));
  await saveSheet(sheet('m2', 'site-m', '2026-01-02', { thumb: 'data:image/jpeg;base64,BBBB' }));
  const metas = await loadSheetMetas('site-m');
  assert.equal(metas.length, 2);
  for (const meta of metas) {
    // The whole point: opening the gallery must not pull print-resolution originals into the
    // heap. 30 sheets at 1-3 MB each is 60-90 MB of strings before a pixel draws — most of an
    // in-app iOS webview's budget, which is where the "still crashes" report came from.
    assert.ok(!('image' in meta), `${meta.id} still carries its image`);
  }
  assert.equal(metas[1].thumb, 'data:image/jpeg;base64,BBBB', 'thumbs DO ride along — the grid draws them');
  assert.equal(db.getAllCalls, 0, 'metadata loading must never clone the entire full-image gallery');
  assert.equal(db.cursorCalls, 1, 'metadata loading must stream durable rows one at a time');
});

test('loadSheetImage fetches exactly one row, and reports null for a missing one', async () => {
  const db = new FakeIndexedDb();
  install(db);
  await saveSheet(sheet('one', 'site-i', '2026-01-01', { image: 'data:image/png;base64,TWE=' }));
  assert.equal(await loadSheetImage('one'), 'data:image/png;base64,TWE=');
  assert.equal(await loadSheetImage('never-existed'), null);
});

test('patchSheetThumb adds the thumbnail WITHOUT touching the image', async () => {
  const db = new FakeIndexedDb();
  install(db);
  await saveSheet(sheet('p1', 'site-p', '2026-01-01', { image: 'data:image/png;base64,TQ==' }));
  assert.equal(await patchSheetThumb('p1', 'data:image/jpeg;base64,CCCC'), true);
  const rows = await loadSheets('site-p');
  assert.equal(rows[0].thumb, 'data:image/jpeg;base64,CCCC');
  assert.equal(rows[0].image, 'data:image/png;base64,TQ==', 'the image must survive the patch');
});

test('patchSheetThumb REFUSES to create a row and refuses one with no image', async () => {
  // The failure this API exists to make impossible: the old backfill did saveSheet({...row,
  // thumb}), which from a caller holding metas would write rows whose image field is GONE — a
  // thumbnail pass quietly destroying every sheet it touched.
  const db = new FakeIndexedDb();
  install(db);
  assert.equal(await patchSheetThumb('ghost', 'data:image/jpeg;base64,DDDD'), false);
  db.rows.set('corrupt', { id: 'corrupt', siteId: 'site-p', label: 'x', at: '2026-01-01' });
  assert.equal(await patchSheetThumb('corrupt', 'data:image/jpeg;base64,DDDD'), false);
});

test('a saved bitmap is current only when both its plan and drawing recipe are current', () => {
  assert.equal(savedSheetFreshness({
    planVersion: PLAN_VERSION,
    renderRecipe: SHEET_RENDER_RECIPE,
  }, PLAN_VERSION), 'current');

  assert.equal(savedSheetFreshness({
    planVersion: PLAN_VERSION,
    renderRecipe: 'r4',
  }, PLAN_VERSION), 'older-render');

  // Rows saved before recipe tracking are the exact case that exposed the old Ubhejane framing.
  assert.equal(savedSheetFreshness({ planVersion: PLAN_VERSION }, PLAN_VERSION), 'older-render');
  assert.equal(savedSheetFreshness({
    planVersion: 'v40',
    renderRecipe: SHEET_RENDER_RECIPE,
  }, PLAN_VERSION), 'older-plan');
});
