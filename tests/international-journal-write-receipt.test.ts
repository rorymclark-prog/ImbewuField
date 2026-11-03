import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test, { after, beforeEach } from 'node:test';

const state = { uid: 'account-a' as string | null, firebaseAvailable: true, sample: false, sampleThrows: false, storageThrows: false,
  reads: 0, writes: 0, events: 0, refuseWrite: false, afterRead: null as (() => void) | null, afterWrite: null as (() => void) | null };
const rows = new Map<string, string>();
const storage = {
  getItem(key: string) { state.reads++; const value = rows.get(key) ?? null; state.afterRead?.(); return value; },
  setItem(key: string, value: string) { state.writes++; if (!state.refuseWrite) rows.set(key, value); state.afterWrite?.(); },
};
const session = { getItem(key: string) { if (state.sampleThrows) throw Error('Sample flag unavailable'); return key === 'imbewu_sample_mode' && state.sample ? '1' : null; } };
let activeStorage = storage;
const browser = { get localStorage() { if (state.storageThrows) throw Error('Storage denied'); return activeStorage; },
  sessionStorage: session, dispatchEvent() { state.events++; return true; } };
const globals = { window: browser, __journalReceiptTest: state };
const prior = Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const);
for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, value });
const firebase = `data:text/javascript,${encodeURIComponent(`
const state = globalThis.__journalReceiptTest;
export const isBackendConfigured = () => true;
export const getFirebase = () => state.firebaseAvailable ? { auth: { currentUser: state.uid ? { uid: state.uid } : null } } : null;
`)}`;
const hooks = registerHooks({ resolve(specifier, context, next) {
  if (specifier === './firebase/init' && /\/lib\/(field-journal|account-local-storage)\.ts$/.test(context.parentURL ?? '')) {
    return { url: firebase, shortCircuit: true };
  }
  return next(specifier, context);
} });
const { accountLocalStorageKey, bindMountedAccountLocalStorageUid } = await import('../lib/account-local-storage.ts');
const { appendLinkedJournalNote, loadJournal, MAX_ENTRIES, readJournalLinkWriteReceipt, journalLinkWriteReceiptMatches } = await import('../lib/field-journal.ts');
hooks.deregister();
const key = accountLocalStorageKey('imbewu_field_journal_v1', 'account-a');
const entry = { id: 'test-note', date: '2026-11-03', title: 'Synthetic note', notes: 'Read-only fixture',
  category: 'other', createdAt: 1, updatedAt: 1 };

beforeEach(() => {
  rows.clear();
  activeStorage = storage;
  Object.assign(state, { uid: 'account-a', firebaseAvailable: true, sample: false, sampleThrows: false, storageThrows: false,
    reads: 0, writes: 0, events: 0, refuseWrite: false, afterRead: null, afterWrite: null });
  bindMountedAccountLocalStorageUid('account-a');
});
after(() => {
  for (const [key, descriptor] of prior) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else Reflect.deleteProperty(globalThis, key);
  }
});

test('an absent journal and a valid empty journal are distinct exact read receipts', () => {
  const absent = readJournalLinkWriteReceipt();
  assert.deepEqual(absent, { status: 'ready' });
  assert.equal(journalLinkWriteReceiptMatches(absent), true);
  rows.set(key, '[]');
  assert.equal(journalLinkWriteReceiptMatches(absent), false);
  const empty = readJournalLinkWriteReceipt();
  assert.deepEqual(empty, { status: 'ready' });
  assert.equal(journalLinkWriteReceiptMatches(empty), true);
  assert.equal(journalLinkWriteReceiptMatches({ status: 'ready' }), false);
  const forged = { get status(): 'ready' { throw Error('Unexpected receipt accessor'); } };
  assert.equal(journalLinkWriteReceiptMatches(forged), false);
  rows.set(key, '[ ]');
  assert.equal(journalLinkWriteReceiptMatches(empty), false, 'even different valid bytes require a fresh receipt');
  assert.equal(state.writes, 0);
  assert.equal(state.events, 0);
});

test('legacy optional omissions survive while corruption, duplicates and discarded fields hold', () => {
  rows.set(key, JSON.stringify([entry]));
  assert.deepEqual(readJournalLinkWriteReceipt(), { status: 'ready' });
  for (const bytes of ['null', '{}', '{bad', JSON.stringify([null, entry]), JSON.stringify([entry, entry]),
    JSON.stringify([{ ...entry, title: ' changed by normalization ' }]), JSON.stringify([{ ...entry, retainedEvidence: 'preserve this' }])]) {
    rows.set(key, bytes);
    assert.equal(readJournalLinkWriteReceipt().status, 'held');
    assert.equal(rows.get(key), bytes);
  }
  assert.equal(state.writes, 0);
  assert.equal(state.events, 0);
});

test('account transition, sample transition and unavailable credentials invalidate journal admission', () => {
  rows.set(key, '[]');
  const receipt = readJournalLinkWriteReceipt();
  assert.equal(journalLinkWriteReceiptMatches(receipt), true);
  state.uid = 'account-b';
  assert.equal(journalLinkWriteReceiptMatches(receipt), false);
  assert.equal(readJournalLinkWriteReceipt().status, 'held');
  state.uid = 'account-a';
  state.sample = true;
  assert.equal(journalLinkWriteReceiptMatches(receipt), false);
  state.sample = false;
  state.uid = null;
  bindMountedAccountLocalStorageUid(null);
  assert.equal(readJournalLinkWriteReceipt().status, 'ready', 'a confirmed signed-out actor can use its own guest journal');
  state.firebaseAvailable = false;
  assert.equal(readJournalLinkWriteReceipt().status, 'held');
});

test('an actor change during the storage read and a denied storage getter fail closed', () => {
  const receipt = readJournalLinkWriteReceipt();
  state.afterRead = () => { state.uid = 'account-b'; };
  assert.equal(journalLinkWriteReceiptMatches(receipt), false);
  state.uid = 'account-a';
  assert.equal(readJournalLinkWriteReceipt().status, 'held');
  state.uid = 'account-a';
  state.afterRead = null;
  state.storageThrows = true;
  assert.equal(readJournalLinkWriteReceipt().status, 'held');
  assert.equal(journalLinkWriteReceiptMatches(receipt), false);
  assert.equal(state.writes, 0);
});

test('admission checks the actor after the final raw read', () => {
  state.afterRead = () => { if (state.reads >= 2) state.uid = 'account-b'; };
  assert.equal(readJournalLinkWriteReceipt().status, 'held');
  assert.equal(state.writes, 0);
});


test('overflowed values, duplicate JSON members and incomplete old rows remain untouched', () => {
  const canonical = JSON.stringify([entry]);
  for (const bytes of [canonical.replace('"id":', '"bedId":1e999,"id":'),
    canonical.replace('"title":', '"title":"Earlier wording","title":'),
    JSON.stringify([{ ...entry, createdAt: undefined }])]) {
    rows.set(key, bytes);
    assert.equal(readJournalLinkWriteReceipt().status, 'held');
    assert.equal(rows.get(key), bytes);
  }
  rows.set(key, '[ ]');
  assert.equal(readJournalLinkWriteReceipt().status, 'ready');
  assert.equal(state.writes, 0);
});

test('unreadable sample state prevents journal reads, and replacing the backing store invalidates a receipt', () => {
  const receipt = readJournalLinkWriteReceipt();
  assert.equal(receipt.status, 'ready');
  activeStorage = { ...storage };
  assert.equal(journalLinkWriteReceiptMatches(receipt), false);
  activeStorage = storage;
  state.sampleThrows = true;
  state.reads = 0;
  assert.equal(readJournalLinkWriteReceipt().status, 'held');
  assert.equal(journalLinkWriteReceiptMatches(receipt), false);
  assert.equal(state.reads, 0);
});

const noteLink = { version: 1, plantingId: 'persisted-planting', cycleId: 'proposal-ordinal', bedId: 'bed-test',
  scope: { kind: 'mapped-site', siteId: 'site:0.00000,0.00000' } };
const noteInput = { date: '2026-11-02', title: 'Synthetic confirmed note', notes: 'Grower entered this date.',
  category: 'other' as const, bedId: 'bed-test' };

test('a linked append preserves existing fields, writes the explicit note date and uses a receipt once', () => {
  rows.set(key, JSON.stringify([entry]));
  const receipt = readJournalLinkWriteReceipt();
  const result = appendLinkedJournalNote(receipt, noteInput, noteLink, () => true);
  assert.equal(result.status, 'saved');
  const written = JSON.parse(rows.get(key)!);
  assert.equal(JSON.stringify(written[0]), JSON.stringify(entry));
  assert.equal(written[1].date, noteInput.date);
  assert.deepEqual(written[1].growerCycleLink, noteLink);
  assert.deepEqual(loadJournal().find(row => row.title === noteInput.title)?.growerCycleLink, noteLink);
  assert.equal(appendLinkedJournalNote(receipt, noteInput, noteLink, () => true).status, 'held');
  assert.equal(state.writes, 1);
  assert.equal(state.events, 1);
});

test('a linked append holds changed sources, stale journals, invalid dates and full journals without evicting notes', () => {
  const receipt = readJournalLinkWriteReceipt();
  assert.deepEqual(appendLinkedJournalNote(receipt, { ...noteInput, date: '2026-02-30' }, noteLink, () => true),
    { status: 'held', reason: 'invalid-note' });
  let checks = 0;
  assert.deepEqual(appendLinkedJournalNote(receipt, noteInput, noteLink, () => ++checks === 1),
    { status: 'held', reason: 'context-changed' });
  rows.set(key, '[]');
  assert.equal(appendLinkedJournalNote(receipt, noteInput, noteLink, () => true).status, 'held');
  const bytes = JSON.stringify(Array.from({ length: MAX_ENTRIES }, (_, index) => ({ ...entry, id: `note-${index}` })));
  rows.set(key, bytes);
  assert.deepEqual(appendLinkedJournalNote(readJournalLinkWriteReceipt(), noteInput, noteLink, () => true),
    { status: 'held', reason: 'journal-full' });
  assert.equal(rows.get(key), bytes);
  assert.equal(state.writes, 0);
});

test('a journal change during the final source check cannot be overwritten', () => {
  const receipt = readJournalLinkWriteReceipt();
  const competing = JSON.stringify([entry]);
  let checks = 0;
  const result = appendLinkedJournalNote(receipt, noteInput, noteLink, () => {
    if (++checks === 2) rows.set(key, competing);
    return true;
  });
  assert.deepEqual(result, { status: 'held', reason: 'context-changed' });
  assert.equal(rows.get(key), competing);
  assert.equal(state.writes, 0);
});

test('an uncertain linked write does not retry or announce success', () => {
  const receipt = readJournalLinkWriteReceipt();
  state.afterWrite = () => { throw Error('Write acknowledgement lost'); };
  assert.deepEqual(appendLinkedJournalNote(receipt, noteInput, noteLink, () => true), { status: 'unconfirmed' });
  assert.equal(appendLinkedJournalNote(receipt, noteInput, noteLink, () => true).status, 'held');
  assert.equal(state.writes, 1);
  assert.equal(state.events, 0);
});


test('an accessor cannot turn an explicitly dated note into today’s note', () => {
  let reads = 0;
  const input = Object.defineProperty({ ...noteInput }, 'date', { get: () => { reads++; return reads === 1 ? noteInput.date : ''; } });
  assert.deepEqual(appendLinkedJournalNote(readJournalLinkWriteReceipt(), input, noteLink, () => true),
    { status: 'held', reason: 'invalid-note' });
  assert.equal(reads, 0);
  assert.equal(state.writes, 0);
});

test('readback is required even when a storage write returns without throwing', () => {
  const raw = JSON.stringify([entry]);
  rows.set(key, raw);
  state.refuseWrite = true;
  const receipt = readJournalLinkWriteReceipt();
  assert.deepEqual(appendLinkedJournalNote(receipt, noteInput, noteLink, () => true), { status: 'unconfirmed' });
  assert.equal(rows.get(key), raw);
  assert.equal(state.writes, 1);
  assert.equal(state.events, 0);
  assert.equal(journalLinkWriteReceiptMatches(receipt), false);
});
