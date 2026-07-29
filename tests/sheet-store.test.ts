import test from 'node:test';
import assert from 'node:assert/strict';

import {
  clearSheets,
  dataUrlBytes,
  deleteSheet,
  loadSheets,
  saveSheet,
  type StoredSheet,
} from '../lib/sheet-store.ts';

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
  rows = new Map<string, StoredSheet>();
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
        const req = request<StoredSheet[]>([]);
        setTimeout(() => {
          req.result = [...this.factory.rows.values()]
            .filter((row) => row.siteId === siteId)
            .map((row) => structuredClone(row));
          req.onsuccess?.();
        }, 0);
        return req;
      },
      getAllKeys: (siteId: string) => {
        const req = request<IDBValidKey[]>([]);
        this.transaction.begin();
        setTimeout(() => {
          req.result = [...this.factory.rows.values()]
            .filter((row) => row.siteId === siteId)
            .map((row) => row.id);
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
  await deleteSheet('one');
  await clearSheets('site-a');
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

  await clearSheets('site-a');
  assert.deepEqual(await loadSheets('site-a'), []);
  assert.deepEqual(await loadSheets('site-b'), [b]);
});

test('awaiting delete means the durable row is actually gone', async () => {
  const factory = new FakeIndexedDb();
  install(factory);
  await saveSheet(sheet('one', 'site-a', '2026-01-01'));
  await deleteSheet('one');
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
  await deleteSheet('one');
  assert.deepEqual(await loadSheets('site-a'), [original]);
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
  assert.equal(dataUrlBytes('not-a-data-url'), 0);
  assert.equal(dataUrlBytes(''), 0);
});
