import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import type { CropPlanStorageLocks } from '../lib/crop-plan-storage.ts';
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
const { accountLocalStorageKey, bindMountedAccountLocalStorageUid, guestAccountLocalStorageKey } = await import('../lib/account-local-storage.ts');
const { appendLinkedJournalNote, copyGuestJournalToAccount, exportJournalLegacyReview, initialiseJournalCutover, keepCurrentJournalAfterLegacyReview,
  loadJournal, MAX_ENTRIES, readCanonicalJournal, readJournalCutoverStatus, readJournalLegacyCandidates, readJournalLegacyReview, readJournalLinkWriteReceipt,
  journalLinkWriteReceiptMatches, recoverJournalLegacyNotes, saveJournal, writeCanonicalJournal } = await import('../lib/field-journal.ts');
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

const canonicalKey = accountLocalStorageKey('imbewu_field_journal_v2', 'account-a');
const exclusive: CropPlanStorageLocks = { async request(_name, _options, action) { return await action({}); } };

test('the journal cutover copies checked bytes once and preserves both books when an old tab writes', async () => {
  const original = JSON.stringify([entry]);
  rows.set(key, original);
  assert.deepEqual(await readJournalCutoverStatus(), { status: 'held', reason: 'upgrade-required' });
  assert.deepEqual(await initialiseJournalCutover(exclusive), { status: 'ready' });
  const copied = rows.get(canonicalKey)!;
  assert.deepEqual(JSON.parse(copied), { version: 2, legacyDigest: createHash('sha256').update(JSON.stringify(original)).digest('hex'), journalRaw: original });
  assert.equal(rows.get(key), original);
  assert.deepEqual(await initialiseJournalCutover(exclusive), { status: 'ready' });
  assert.equal(state.writes, 1, 'opening an existing canonical journal does not recopy');

  const ordinary = loadJournal()[0];
  assert.equal(saveJournal([{ ...ordinary, title: 'Older tab changed this note' }]).ok, true);
  assert.notEqual(rows.get(key), original);
  assert.deepEqual(await readJournalCutoverStatus(), { status: 'held', reason: 'legacy-diverged' });
  assert.deepEqual(await initialiseJournalCutover(exclusive), { status: 'held', reason: 'legacy-diverged' });
  assert.equal(rows.get(canonicalKey), copied);
  assert.equal(state.writes, 2);
});

test('cutover holds unavailable locks, malformed evidence and quota failure without deleting old data', async () => {
  rows.set(key, 'null');
  assert.deepEqual(await initialiseJournalCutover(null), { status: 'held', reason: 'lock-unavailable' });
  assert.deepEqual(await initialiseJournalCutover(exclusive), { status: 'held', reason: 'invalid-legacy' });
  assert.equal(rows.get(key), 'null');
  assert.equal(rows.has(canonicalKey), false);
  rows.set(key, JSON.stringify([entry]));
  state.refuseWrite = true;
  assert.deepEqual(await initialiseJournalCutover(exclusive), { status: 'held', reason: 'write-unconfirmed' });
  assert.equal(rows.get(key), JSON.stringify([entry]));
  assert.equal(rows.has(canonicalKey), false);
});

test('cutover rechecks the account when a queued lock is acquired and holds a legacy race after copy', async () => {
  const changed: CropPlanStorageLocks = { async request(_name, _options, action) {
    state.uid = 'account-b';
    return await action({});
  } };
  assert.deepEqual(await initialiseJournalCutover(changed), { status: 'held', reason: 'context-changed' });
  assert.equal(state.writes, 0);
  state.uid = 'account-a';
  const legacyBefore = JSON.stringify([entry]);
  const lateLegacy = JSON.stringify([{ ...entry, notes: 'Late change from old tab' }]);
  rows.set(key, legacyBefore);
  state.afterWrite = () => { rows.set(key, lateLegacy); };
  assert.deepEqual(await initialiseJournalCutover(exclusive), { status: 'held', reason: 'write-unconfirmed' });
  assert.equal(JSON.parse(rows.get(canonicalKey)!).journalRaw, legacyBefore);
  assert.equal(rows.get(key), lateLegacy);
  assert.deepEqual(await readJournalCutoverStatus(), { status: 'held', reason: 'legacy-diverged' });
});

test('a corrupt canonical journal and a guest namespace cannot be overwritten by cutover', async () => {
  rows.set(canonicalKey, '{bad');
  assert.deepEqual(await initialiseJournalCutover(exclusive), { status: 'held', reason: 'invalid-canonical' });
  assert.equal(rows.get(canonicalKey), '{bad');
  state.uid = null;
  bindMountedAccountLocalStorageUid(null);
  assert.deepEqual(await initialiseJournalCutover(exclusive), { status: 'held', reason: 'context-unavailable' });
  assert.equal(state.writes, 0);
});

test('concurrent cutovers for same account hold second call without write while first completes once', async () => {
  const original = JSON.stringify([entry]);
  rows.set(key, original);
  let releaseFirst!: () => void, enteredFirst!: () => void;
  const releaseGate = new Promise<void>(res => { releaseFirst = res; });
  const enteredGate = new Promise<void>(res => { enteredFirst = res; });
  let held = false;
  const recordedCalls: Array<{ name: string; options: unknown }> = [];
  const racingLocks: CropPlanStorageLocks = {
    async request(name, options, action) {
      recordedCalls.push({ name, options });
      if (!held) {
        held = true;
        enteredFirst();
        try {
          await releaseGate;
          return await action({});
        } finally {
          held = false;
        }
      }
      return await action(null);
    },
  };
  const firstPromise = initialiseJournalCutover(racingLocks);
  await enteredGate;
  assert.equal(state.writes, 0);
  assert.deepEqual(await initialiseJournalCutover(racingLocks), { status: 'held', reason: 'lock-unavailable' });
  assert.equal(state.writes, 0);
  releaseFirst();
  assert.deepEqual(await firstPromise, { status: 'ready' });
  assert.equal(state.writes, 1);
  assert.deepEqual(await initialiseJournalCutover(racingLocks), { status: 'ready' });
  assert.equal(state.writes, 1);
  assert.equal(rows.get(key), original);
  assert.equal(recordedCalls.length, 3);
  for (const call of recordedCalls) {
    assert.equal(call.name, `imbewu-journal:${canonicalKey}`);
    assert.deepEqual(call.options, { mode: 'exclusive', ifAvailable: true });
  }
});

test('a legacy write between snapshot and guarded cutover write holds on context-changed without writing', async () => {
  const original = JSON.stringify([entry]);
  const newer = JSON.stringify([{ ...entry, title: 'Updated legacy note' }]);
  rows.set(key, original);
  state.afterRead = () => {
    if (state.reads === 2) {
      rows.set(key, newer);
      state.afterRead = null;
    }
  };
  assert.deepEqual(await initialiseJournalCutover(exclusive), { status: 'held', reason: 'context-changed' });
  assert.equal(state.writes, 0);
  assert.equal(state.events, 0);
  assert.equal(rows.get(key), newer);
  assert.equal(rows.has(canonicalKey), false);
});

test('ordinary and linked actions share the canonical book without rewriting the old journal', async () => {
  const original = JSON.stringify([entry]);
  rows.set(key, original);
  assert.deepEqual(await initialiseJournalCutover(exclusive), { status: 'ready' });
  const first = await readCanonicalJournal();
  const add = { kind: 'add', input: { ...noteInput, title: 'Ordinary note' } } as const;
  assert.deepEqual(await writeCanonicalJournal({ ...first }, add, exclusive), { status: 'held', reason: 'context-changed' });
  const added = await writeCanonicalJournal(first, add, exclusive);
  assert.equal(added.status, 'saved');
  assert.deepEqual(await writeCanonicalJournal(first, add, exclusive), { status: 'held', reason: 'context-changed' });
  const beforeLinked = await readCanonicalJournal();
  const linked = await writeCanonicalJournal(beforeLinked, {
    kind: 'append-linked', input: noteInput, selection: noteLink, sourceIsCurrent: () => true,
  }, exclusive);
  assert.equal(linked.status, 'saved');
  if (added.status !== 'saved' || linked.status !== 'saved') return;
  const both = await readCanonicalJournal();
  assert.equal(both.status, 'ready');
  if (both.status !== 'ready') return;
  assert.deepEqual(both.entries.find(row => row.id === linked.noteId)?.growerCycleLink, noteLink);
  assert.deepEqual(await writeCanonicalJournal(both, {
    kind: 'edit', id: linked.noteId, input: { ...noteInput, bedId: 'another-bed' },
  }, exclusive), { status: 'held', reason: 'invalid-note' });
  assert.equal((await writeCanonicalJournal(both, {
    kind: 'edit', id: linked.noteId, input: { ...noteInput, title: 'Edited linked note' },
  }, exclusive)).status, 'saved');
  assert.deepEqual(await writeCanonicalJournal(both, { kind: 'delete', id: added.noteId }, exclusive),
    { status: 'held', reason: 'context-changed' });
  assert.equal((await writeCanonicalJournal(await readCanonicalJournal(), { kind: 'delete', id: added.noteId }, exclusive)).status, 'saved');
  const current = await readCanonicalJournal();
  assert.equal(current.status, 'ready');
  if (current.status !== 'ready') return;
  assert.equal(current.entries.length, 2);
  assert.deepEqual(current.entries.find(row => row.id === linked.noteId)?.growerCycleLink, noteLink);
  assert.equal(current.entries.find(row => row.id === linked.noteId)?.title, 'Edited linked note');
  assert.deepEqual(JSON.parse(JSON.parse(rows.get(canonicalKey)!).journalRaw)[0], entry);
  assert.equal(rows.get(key), original);
  assert.equal(state.events, 4);
});

test('canonical writes hold a stale source, legacy divergence, and a changed account', async () => {
  const original = JSON.stringify([entry]);
  rows.set(key, original);
  assert.equal((await initialiseJournalCutover(exclusive)).status, 'ready');
  const copied = rows.get(canonicalKey);
  const view = await readCanonicalJournal();
  let checks = 0;
  assert.deepEqual(await writeCanonicalJournal(view, {
    kind: 'append-linked', input: noteInput, selection: noteLink, sourceIsCurrent: () => ++checks === 1,
  }, exclusive), { status: 'held', reason: 'context-changed' });
  const switched: CropPlanStorageLocks = { async request(_name, _options, action) {
    state.uid = 'account-b';
    return await action({});
  } };
  const deletion = { kind: 'delete', id: entry.id } as const;
  assert.deepEqual(await writeCanonicalJournal(view, deletion, switched), { status: 'held', reason: 'context-changed' });
  state.uid = 'account-a';
  assert.deepEqual(await writeCanonicalJournal(view, deletion, null), { status: 'held', reason: 'lock-unavailable' });
  const newer = JSON.stringify([{ ...entry, title: 'Late old-tab change' }]);
  rows.set(key, newer);
  assert.deepEqual(await readCanonicalJournal(), { status: 'held', reason: 'legacy-diverged' });
  assert.deepEqual(await writeCanonicalJournal(view, deletion, exclusive), { status: 'held', reason: 'context-changed' });
  assert.equal(rows.get(key), newer);
  assert.equal(rows.get(canonicalKey), copied);
  assert.equal(state.writes, 1);
  assert.equal(state.events, 0);
});

test('an uncertain canonical write cannot be replayed or announce a save', async () => {
  assert.equal((await initialiseJournalCutover(exclusive)).status, 'ready');
  const view = await readCanonicalJournal();
  const copied = rows.get(canonicalKey);
  state.refuseWrite = true;
  const add = { kind: 'add', input: noteInput } as const;
  assert.deepEqual(await writeCanonicalJournal(view, add, exclusive), { status: 'unconfirmed' });
  assert.deepEqual(await writeCanonicalJournal(view, add, exclusive), { status: 'held', reason: 'context-changed' });
  assert.equal(rows.get(canonicalKey), copied);
  assert.equal(state.writes, 2);
  assert.equal(state.events, 0);
});

test('older-tab review preserves both copies, and a new older-tab edit requires another review', async () => {
  const original = JSON.stringify([entry]);
  rows.set(key, original);
  assert.equal((await initialiseJournalCutover(exclusive)).status, 'ready');
  assert.equal(await readJournalLegacyReview(), null);
  const before = await readCanonicalJournal();
  assert.equal((await writeCanonicalJournal(before, { kind: 'append-linked',
    input: noteInput, selection: noteLink, sourceIsCurrent: () => true }, exclusive)).status, 'saved');
  const currentRaw = JSON.parse(rows.get(canonicalKey)!).journalRaw;
  const older = JSON.stringify([{ ...entry, title: 'Written in an older tab' }]);
  rows.set(key, older);

  const review = await readJournalLegacyReview();
  assert.deepEqual(review, { currentCount: 2, olderCount: 1 });
  assert.ok(review);
  assert.equal(exportJournalLegacyReview({ ...review }), null);
  const backup = exportJournalLegacyReview(review);
  assert.equal(backup?.filename, 'journal-copies.json');
  assert.deepEqual(JSON.parse(backup!.json), { exportVersion: 1, currentJournalRaw: currentRaw, olderJournalRaw: older });

  assert.deepEqual(await keepCurrentJournalAfterLegacyReview(review, null), { status: 'held', reason: 'lock-unavailable' });
  assert.deepEqual(await keepCurrentJournalAfterLegacyReview(review, exclusive), { status: 'kept' });
  assert.equal(exportJournalLegacyReview(review), null);
  assert.equal(JSON.parse(rows.get(canonicalKey)!).journalRaw, currentRaw);
  assert.equal(rows.get(key), older);
  assert.deepEqual(await readJournalCutoverStatus(), { status: 'ready' });
  assert.equal(state.events, 2);

  rows.set(key, original);
  assert.deepEqual(await readJournalCutoverStatus(), { status: 'held', reason: 'legacy-diverged' });
  assert.deepEqual(await keepCurrentJournalAfterLegacyReview(review, exclusive), { status: 'held', reason: 'context-changed' });
  assert.equal(JSON.parse(rows.get(canonicalKey)!).journalRaw, currentRaw);
});

test('older-tab review is bound to the account and both exact copies, including unreadable evidence', async () => {
  assert.equal((await initialiseJournalCutover(exclusive)).status, 'ready');
  const canonical = rows.get(canonicalKey);
  rows.set(key, '{malformed');
  const review = await readJournalLegacyReview();
  assert.deepEqual(review, { currentCount: 0, olderCount: null });
  assert.ok(review);
  assert.equal(JSON.parse(exportJournalLegacyReview(review)!.json).olderJournalRaw, '{malformed');
  const switched: CropPlanStorageLocks = { async request(_name, _options, action) {
    state.uid = 'account-b';
    assert.equal(exportJournalLegacyReview(review), null);
    return await action({});
  } };
  assert.deepEqual(await keepCurrentJournalAfterLegacyReview(review, switched), { status: 'held', reason: 'context-changed' });
  state.uid = 'account-a';
  rows.set(key, '[]');
  assert.equal(exportJournalLegacyReview(review), null);
  assert.deepEqual(await keepCurrentJournalAfterLegacyReview(review, exclusive), { status: 'held', reason: 'context-changed' });
  assert.equal(rows.get(canonicalKey), canonical);
  assert.equal(state.writes, 1);
  assert.equal(state.events, 0);
});

test('older-tab acknowledgement with uncertain readback cannot be replayed', async () => {
  assert.equal((await initialiseJournalCutover(exclusive)).status, 'ready');
  rows.set(key, '[]');
  const review = await readJournalLegacyReview();
  assert.ok(review);
  state.afterWrite = () => { rows.set(key, '[ ]'); };
  assert.deepEqual(await keepCurrentJournalAfterLegacyReview(review, exclusive), { status: 'unconfirmed' });
  assert.deepEqual(await keepCurrentJournalAfterLegacyReview(review, exclusive), { status: 'held', reason: 'context-changed' });
  assert.deepEqual(await readJournalCutoverStatus(), { status: 'held', reason: 'legacy-diverged' });
  assert.equal(state.writes, 2);
  assert.equal(state.events, 0);
});

test('selected recovery restores only explicitly chosen older-only notes without replacing current edits', async () => {
  rows.set(key, JSON.stringify([entry]));
  assert.equal((await initialiseJournalCutover(exclusive)).status, 'ready');
  assert.equal((await writeCanonicalJournal(await readCanonicalJournal(), {
    kind: 'edit', id: entry.id, input: { ...noteInput, title: 'Current correction' },
  }, exclusive)).status, 'saved');

  const one = { ...entry, id: 'older-one', title: '', notes: 'Older notes-only entry' };
  const two = { ...entry, id: 'older-two' };
  const linked = { ...entry, id: 'older-linked', growerCycleLink: noteLink };
  const older = JSON.stringify([entry, one, two, linked]);
  rows.set(key, older);
  const review = await readJournalLegacyReview();
  assert.ok(review);
  const candidates = readJournalLegacyCandidates(review);
  assert.deepEqual(candidates, [one, two].map(({ id, date, title, notes }) => ({ id, date, title, notes })));
  assert.equal(readJournalLegacyCandidates({ ...review }), null);

  for (const ids of [[], [one.id, one.id], [one.id, entry.id], [one.id, linked.id], ['unknown']]) {
    assert.deepEqual(await recoverJournalLegacyNotes(review, ids, exclusive), { status: 'held', reason: 'invalid-selection' });
  }
  assert.equal(state.writes, 2);
  assert.deepEqual(await recoverJournalLegacyNotes(review, [one.id], exclusive), { status: 'recovered', count: 1 });
  assert.equal(readJournalLegacyCandidates(review), null);
  assert.deepEqual(await recoverJournalLegacyNotes(review, [two.id], exclusive), { status: 'held', reason: 'context-changed' });
  const view = await readCanonicalJournal();
  assert.ok(view.status === 'ready');
  assert.equal(view.entries.find(row => row.id === entry.id)?.title, 'Current correction');
  assert.deepEqual(JSON.parse(JSON.parse(rows.get(canonicalKey)!).journalRaw)[1], one);
  assert.equal(view.entries.length, 2);
  assert.equal(rows.get(key), older);
  assert.equal(state.events, 2);
});

test('selected recovery holds an overfull book and a changed older snapshot without partial writes', async () => {
  const current = JSON.stringify(Array.from({ length: MAX_ENTRIES }, (_, i) => ({ ...entry, id: `current-${i}` })));
  rows.set(key, current);
  assert.equal((await initialiseJournalCutover(exclusive)).status, 'ready');
  const canonical = rows.get(canonicalKey);
  rows.set(key, JSON.stringify([entry]));
  const review = await readJournalLegacyReview();
  assert.ok(review);
  assert.deepEqual(await recoverJournalLegacyNotes(review, [entry.id], exclusive), { status: 'held', reason: 'journal-full' });
  rows.set(key, '{damaged');
  assert.equal(readJournalLegacyCandidates(review), null);
  assert.deepEqual(await recoverJournalLegacyNotes(review, [entry.id], exclusive), { status: 'held', reason: 'context-changed' });
  const damaged = await readJournalLegacyReview();
  assert.ok(damaged);
  assert.deepEqual(readJournalLegacyCandidates(damaged), []);
  assert.deepEqual(await recoverJournalLegacyNotes(damaged, [entry.id], exclusive), { status: 'held', reason: 'invalid-selection' });
  assert.equal(rows.get(canonicalKey), canonical);
  assert.equal(rows.get(key), '{damaged');
  assert.equal(state.writes, 1);
  assert.equal(state.events, 0);
});

const guestJournalKey = guestAccountLocalStorageKey('imbewu_field_journal_v1');
const guestClaimKey = guestAccountLocalStorageKey('imbewu_field_journal_transfer_claim');

test('verified guest copy binds the exact source to one account and preserves later journal edits', async () => {
  const guest = JSON.stringify([entry]);
  rows.set(guestJournalKey, guest);
  rows.set(key, '[ ]');
  const names: string[] = [];
  const locks: CropPlanStorageLocks = { async request(name, options, action) {
    names.push(name);
    assert.deepEqual(options, { mode: 'exclusive', ifAvailable: true });
    return await action({});
  } };
  assert.deepEqual(await copyGuestJournalToAccount(locks), { status: 'copied', count: 1 });
  assert.deepEqual(names, [`imbewu-journal:${guestAccountLocalStorageKey('imbewu_field_journal_v2')}`, `imbewu-journal:${canonicalKey}`]);
  assert.equal(rows.get(guestJournalKey), guest);
  assert.equal(rows.get(key), '[ ]');
  assert.ok(rows.get(guestClaimKey));
  assert.deepEqual(JSON.parse(rows.get(canonicalKey)!), {
    version: 2, legacyDigest: createHash('sha256').update(JSON.stringify('[ ]')).digest('hex'),
    journalRaw: guest, guestImportDigest: createHash('sha256').update(JSON.stringify(guest)).digest('hex'),
  });
  const view = await readCanonicalJournal();
  assert.equal((await writeCanonicalJournal(view, { kind: 'delete', id: entry.id }, exclusive)).status, 'saved');
  assert.deepEqual(await copyGuestJournalToAccount(exclusive), { status: 'already-copied' });
  assert.equal(JSON.parse(rows.get(canonicalKey)!).journalRaw, '[]');
  state.uid = 'account-b';
  bindMountedAccountLocalStorageUid('account-b');
  assert.deepEqual(await copyGuestJournalToAccount(exclusive), { status: 'held', reason: 'guest-claimed' });
  assert.equal(rows.has(accountLocalStorageKey('imbewu_field_journal_v2', 'account-b')), false);
  assert.equal(state.writes, 3);
});

test('guest copy holds an existing or invalid destination, sample mode, and malformed or linked sources', async () => {
  const guest = JSON.stringify([entry]);
  rows.set(guestJournalKey, guest);
  rows.set(key, 'null');
  assert.deepEqual(await copyGuestJournalToAccount(exclusive), { status: 'held', reason: 'account-journal-exists' });
  rows.set(key, guest);
  assert.deepEqual(await copyGuestJournalToAccount(exclusive), { status: 'held', reason: 'account-journal-exists' });
  rows.delete(key);
  state.sample = true;
  assert.deepEqual(await copyGuestJournalToAccount(exclusive), { status: 'held', reason: 'context-changed' });
  state.sample = false;
  rows.set(guestJournalKey, JSON.stringify([{ ...entry, growerCycleLink: noteLink }]));
  assert.deepEqual(await copyGuestJournalToAccount(exclusive), { status: 'held', reason: 'invalid-guest' });
  rows.set(guestJournalKey, '{damaged');
  assert.deepEqual(await copyGuestJournalToAccount(exclusive), { status: 'held', reason: 'invalid-guest' });
  assert.equal(rows.get(guestJournalKey), '{damaged');
  assert.equal(rows.has(guestClaimKey), false);
  assert.equal(state.writes, 0);
});

test('guest copy retries a failed destination only for the claimed account and exact source', async () => {
  const guest = JSON.stringify([entry]);
  rows.set(guestJournalKey, guest);
  state.afterWrite = () => { state.refuseWrite = true; };
  assert.deepEqual(await copyGuestJournalToAccount(exclusive), { status: 'held', reason: 'write-unconfirmed' });
  assert.ok(rows.has(guestClaimKey));
  assert.equal(rows.has(canonicalKey), false);
  assert.equal(rows.get(guestJournalKey), guest);
  state.afterWrite = null;
  state.refuseWrite = false;
  assert.deepEqual(await copyGuestJournalToAccount(exclusive), { status: 'copied', count: 1 });
  assert.equal(state.writes, 3);
  rows.set(guestJournalKey, JSON.stringify([{ ...entry, title: 'Old tab wrote again' }]));
  assert.deepEqual(await copyGuestJournalToAccount(exclusive), { status: 'held', reason: 'guest-claimed' });
  assert.equal(JSON.parse(rows.get(canonicalKey)!).journalRaw, guest);
  assert.equal(state.writes, 3);
});

test('an account change or an older guest write during copy cannot confirm the handoff', async () => {
  const guest = JSON.stringify([entry]);
  rows.set(guestJournalKey, guest);
  const changed: CropPlanStorageLocks = { async request(name, _options, action) {
    if (name.endsWith(canonicalKey)) state.uid = 'account-b';
    return await action({});
  } };
  assert.deepEqual(await copyGuestJournalToAccount(changed), { status: 'held', reason: 'context-changed' });
  assert.equal(state.writes, 0);
  state.uid = 'account-a';
  const newer = JSON.stringify([{ ...entry, title: 'Changed during copy' }]);
  state.afterWrite = () => { if (rows.has(canonicalKey)) rows.set(guestJournalKey, newer); };
  assert.deepEqual(await copyGuestJournalToAccount(exclusive), { status: 'held', reason: 'write-unconfirmed' });
  assert.equal(rows.get(guestJournalKey), newer);
  assert.equal(JSON.parse(rows.get(canonicalKey)!).journalRaw, guest);
  assert.equal(state.events, 0);
});
