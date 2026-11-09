import assert from 'node:assert/strict';
import test from 'node:test';
import * as crop from '../lib/crop-plan-storage.ts';
import * as journal from '../lib/journal-storage.ts';
import * as invoice from '../lib/invoice-storage.ts';
import type { CropPlanStorageContext } from '../lib/crop-plan-storage.ts';
import { LeaseDrainStorage, LeaseDrainLocks } from './lease-drain-fixture.ts';

type Context = CropPlanStorageContext;
const context = (storage: LeaseDrainStorage, owner: string, isCurrent = () => true): Context =>
  ({ storage, legacyKey: `legacy:${owner}`, canonicalKey: `canonical:${owner}`, receiptKey: `receipt:${owner}`, isCurrent });
const cropEmpty = (raw: string | null) => raw === null || JSON.parse(raw).plantings.length === 0;
const adapters = [
  { name: 'crop', init: crop.initialiseCropPlanStorage, release: crop.releaseAllDocumentCropPlanLeases,
    proof: crop.captureCropPlanStorageLease, matches: crop.cropPlanStorageLeaseMatches, hold: crop.readCropPlanStorageTransferHold,
    transfer: (s: Context, t: Context, locks: LeaseDrainLocks | null) => crop.transferCropPlanStoragePair(s, t,
      { locks, sourceLegacyIsEmpty: cropEmpty, targetLegacyIsEmpty: cropEmpty }),
    async other() {
      const other: typeof crop = await import(new URL('../lib/crop-plan-storage.ts?lease-drain-other-document', import.meta.url).href);
      return { init: other.initialiseCropPlanStorage, release: other.releaseAllDocumentCropPlanLeases,
        proof: other.captureCropPlanStorageLease, matches: other.cropPlanStorageLeaseMatches };
    } },
  { name: 'journal', init: journal.initialiseJournalStorage, release: journal.releaseAllDocumentJournalLeases,
    proof: journal.captureJournalStorageLease, matches: journal.journalStorageLeaseMatches, hold: journal.readJournalStorageTransferHold,
    transfer: (s: Context, t: Context, locks: LeaseDrainLocks | null) => journal.transferJournalStoragePair(s, t, { locks }),
    async other() {
      const other: typeof journal = await import(new URL('../lib/journal-storage.ts?lease-drain-other-document', import.meta.url).href);
      return { init: other.initialiseJournalStorage, release: other.releaseAllDocumentJournalLeases,
        proof: other.captureJournalStorageLease, matches: other.journalStorageLeaseMatches };
    } },
];

for (const a of adapters) {
  test(`${a.name}: first transfer waits for its own revoked manager request without manual retry`, async () => {
    const local = new LeaseDrainStorage(), source = context(local, 'guest'), target = context(local, 'account'), locks = new LeaseDrainLocks();
    try {
      assert.equal((await a.init(source, locks)).writable, true);
      const proof = a.proof(source); assert.ok(proof);
      const draining = a.release();
      assert.equal(a.matches(proof, source), false, 'Old write authority must disappear before any await');
      const transfer = Promise.resolve(draining).then(() => a.transfer(source, target, locks));
      await locks.releaseEntered.promise; await Promise.resolve();
      assert.equal(local.getItem(target.canonicalKey), null);
      const before = new Map(local.rows); locks.open();
      const result = await transfer;
      assert.equal(result.status, 'transferred'); assert.equal(a.hold(target), null);
      assert.equal(local.getItem(source.canonicalKey), null); assert.ok(local.getItem(target.canonicalKey));
      assert.notDeepEqual(local.rows, before);
    } finally { locks.open(); await a.release(); }
  });

  test(`${a.name}: revoked pending grant drains but can never install a pair`, async () => {
    const local = new LeaseDrainStorage(), source = context(local, 'guest'), locks = new LeaseDrainLocks();
    locks.pauseFirstGrant = true;
    try {
      const init = a.init(source, locks); let settled = false;
      const draining = Promise.resolve(a.release()).then(() => { settled = true; });
      await Promise.resolve(); assert.equal(settled, false);
      locks.grant.resolve(); await locks.releaseEntered.promise;
      assert.deepEqual(local.writes, []); locks.open(); await draining;
      assert.equal((await init).reason, 'context-changed'); assert.deepEqual(local.writes, []);
    } finally { locks.open(); await a.release(); }
  });

  test(`${a.name}: a real second module keeps its lock and proof while this document drains and stays held`, async () => {
    const other = await a.other(), local = new LeaseDrainStorage(), source = context(local, 'guest'), target = context(local, 'account');
    const locks = new LeaseDrainLocks(); locks.open();
    try {
      await a.release(); await other.release();
      assert.equal((await other.init(source, locks)).writable, true);
      const proof = other.proof(source); assert.ok(proof); const before = new Map(local.rows), writes = [...local.writes];
      // This await must finish while the other module still owns its unresolved
      // callback. Draining another document would never reach the assertion.
      await a.release();
      assert.equal(other.matches(proof, source), true); assert.equal(a.matches(proof, source), false);
      const result = await a.transfer(source, target, locks);
      assert.equal(result.status, 'held'); assert.equal(result.reason, 'another-writer');
      assert.equal(other.matches(proof, source), true); assert.deepEqual(local.rows, before); assert.deepEqual(local.writes, writes);
      assert.equal(local.getItem(target.canonicalKey), null);
    } finally { locks.open(); await other.release(); await a.release(); }
  });

  test(`${a.name}: a canceled account cannot transfer while its document drain waits`, async () => {
    const local = new LeaseDrainStorage(), source = context(local, 'guest'), locks = new LeaseDrainLocks(); let current = true;
    const target = context(local, 'account-A', () => current);
    try {
      await a.init(source, locks); const before = new Map(local.rows);
      const pipeline = Promise.resolve(a.release()).then(() => current ? a.transfer(source, target, locks) : { status: 'canceled' });
      await locks.releaseEntered.promise; current = false; locks.open();
      assert.equal((await pipeline).status, 'canceled'); assert.deepEqual(local.rows, before);
      assert.equal(local.getItem(target.canonicalKey), null); assert.equal(local.getItem(context(local, 'account-B').canonicalKey), null);
    } finally { locks.open(); await a.release(); }
  });

  test(`${a.name}: truly absent guest preserves the zero-write no-work path`, async () => {
    const local = new LeaseDrainStorage(), source = context(local, 'guest'), target = context(local, 'account');
    const result = await a.transfer(source, target, null);
    assert.equal(result.status, 'preserved'); assert.equal(result.reason, 'no-guest-work');
    assert.deepEqual(local.writes, []); assert.equal(a.hold(target), null);
  });

  test(`${a.name}: corrupt guest evidence remains held and byte-preserved after draining`, async () => {
    const local = new LeaseDrainStorage(), source = context(local, 'guest'), target = context(local, 'account'), locks = new LeaseDrainLocks(); locks.open();
    local.rows.set(source.canonicalKey, '{"broken":true}'); local.rows.set(source.receiptKey, '{"receiptVersion":1}');
    const before = new Map(local.rows);
    try {
      await a.release(); assert.equal((await a.transfer(source, target, locks)).status, 'held');
      assert.deepEqual(local.rows, before); assert.deepEqual(local.writes, []); assert.equal(local.getItem(target.canonicalKey), null);
    } finally { await a.release(); }
  });

  test(`${a.name}: completed draining cannot bypass divergent legacy evidence`, async () => {
    const local = new LeaseDrainStorage(), source = context(local, 'guest'), target = context(local, 'account'), locks = new LeaseDrainLocks(); locks.open();
    try {
      await a.init(source, locks); await a.release();
      local.rows.set(source.legacyKey, a.name === 'crop' ? '{"version":1,"plantings":[],"updatedAt":2}' : '[{"note":"authored guest observation"}]');
      const before = new Map(local.rows), writes = [...local.writes], result = await a.transfer(source, target, locks);
      assert.equal(result.status, 'held'); assert.equal(result.reason, 'legacy-diverged');
      assert.deepEqual(local.rows, before); assert.deepEqual(local.writes, writes); assert.equal(local.getItem(target.canonicalKey), null);
    } finally { await a.release(); }
  });

  test(`${a.name}: existing empty account pairs remain authoritative over guest work`, async () => {
    const local = new LeaseDrainStorage(), source = context(local, 'guest'), target = context(local, 'account'), locks = new LeaseDrainLocks(); locks.open();
    try {
      await a.init(target, locks); await a.release();
      local.rows.set(source.legacyKey, a.name === 'crop' ? '{"version":1,"plantings":[null],"updatedAt":1}' : '[{"note":"authored guest observation"}]');
      const before = new Map(local.rows), writes = [...local.writes], result = await a.transfer(source, target, locks);
      assert.equal(result.status, 'preserved'); assert.equal(result.reason, 'destination-present');
      assert.deepEqual(local.rows, before); assert.deepEqual(local.writes, writes);
    } finally { await a.release(); }
  });
}

function invoiceContext(local: LeaseDrainStorage): invoice.InvoiceStorageContext {
  return { ...context(local, 'invoice-owner'), legacyKeys: ['legacy:invoice-owner', 'pending:invoice-owner', 'sequence:invoice-owner'] };
}

test('actual invoice factory revokes immediately while its own manager drain is still pending', async () => {
  const local = new LeaseDrainStorage(), c = invoiceContext(local), locks = new LeaseDrainLocks();
  try {
    assert.equal((await invoice.initialiseInvoiceStorage(c, locks)).writable, true);
    const proof = invoice.captureInvoiceStorageLease(c); assert.ok(proof);
    const before = new Map(local.rows), writes = [...local.writes]; let drained = false;
    const draining = Promise.resolve(invoice.releaseAllDocumentInvoiceLeases()).then(() => { drained = true; });
    assert.equal(invoice.invoiceStorageLeaseMatches(proof, c), false);
    await locks.releaseEntered.promise; await Promise.resolve(); assert.equal(drained, false);
    locks.open(); await draining; assert.equal(drained, true); assert.equal(locks.held.size, 0);
    assert.deepEqual(local.rows, before); assert.deepEqual(local.writes, writes);
  } finally { locks.open(); await invoice.releaseAllDocumentInvoiceLeases(); }
});

test('actual second invoice adapter owns a separate factory and is never drained by this one', async () => {
  const other: typeof invoice = await import(new URL('../lib/invoice-storage.ts?lease-drain-other-document', import.meta.url).href);
  const local = new LeaseDrainStorage(), c = invoiceContext(local), locks = new LeaseDrainLocks(); locks.open();
  try {
    await invoice.releaseAllDocumentInvoiceLeases(); await other.releaseAllDocumentInvoiceLeases();
    assert.equal((await other.initialiseInvoiceStorage(c, locks)).writable, true);
    const proof = other.captureInvoiceStorageLease(c); assert.ok(proof);
    const before = new Map(local.rows), writes = [...local.writes];
    await invoice.releaseAllDocumentInvoiceLeases();
    assert.equal(other.invoiceStorageLeaseMatches(proof, c), true);
    assert.equal((await invoice.initialiseInvoiceStorage(c, locks)).reason, 'another-writer');
    assert.equal(other.invoiceStorageLeaseMatches(proof, c), true);
    assert.deepEqual(local.rows, before); assert.deepEqual(local.writes, writes);
  } finally { locks.open(); await other.releaseAllDocumentInvoiceLeases(); await invoice.releaseAllDocumentInvoiceLeases(); }
});
