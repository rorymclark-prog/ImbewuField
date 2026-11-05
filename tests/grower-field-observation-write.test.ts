import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import test, { after, beforeEach } from 'node:test';
import ts from 'typescript';
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { JournalEntry } from '../lib/field-journal.ts';
import type { JournalStorageLocks } from '../lib/journal-storage.ts';

// Only external Firebase auth/transport and Web Locks are controlled. The
// actual source projection, canonical journal, link resolver and writers run.
const authErrors = new Set<() => void>();
Object.assign(globalThis, { __observationWriterAuthErrors: authErrors });
const authHook = registerHooks({ resolve(specifier, context, next) {
  if (context.parentURL?.endsWith('/lib/length-unit-preference.ts') && specifier === 'firebase/auth') return {
    shortCircuit: true, url: 'data:text/javascript,' + encodeURIComponent(`
      export function onAuthStateChanged(_auth,next,error){
        const p=globalThis.__growerOperationsFixture, errors=globalThis.__observationWriterAuthErrors;
        p.auth.add(next);errors.add(error);return()=>{p.auth.delete(next);errors.delete(error);};
      }`),
  };
  return next(specifier, context);
} });
const fixture = await import('./international-grower-operations-fixture.ts');
const { local, session, probe, account, samples, core, store, studio, studioKey, ownRow, cloud, reset, cleanup, pauseHashes } = fixture;
const journal = await import('../lib/field-journal.ts');
const storage = await import('../lib/journal-storage.ts');
const { recordGrowerFieldObservation } = await import('../lib/grower-field-observation.ts');
const { buildGrowerBoardTasks } = await import('../lib/task-board.ts');
const { resolveGrowerJournalLink } = await import('../lib/task-record-link.ts');
const navigatorBefore = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
class Locks implements JournalStorageLocks {
  held = new Set<string>();
  async request<T>(name: string, _options: { mode: 'exclusive'; ifAvailable: true }, run: (lock: unknown | null) => T | PromiseLike<T>): Promise<T> {
    await Promise.resolve();
    if (this.held.has(name)) return await run(null);
    this.held.add(name); try { return await run({ name }); } finally { this.held.delete(name); }
  }
}
const loaded = new Set<JournalEntry[]>();
const load = () => { const entries = journal.loadJournal(); loaded.add(entries); return entries; };
const key = () => account.activeAccountLocalStorageKey(storage.JOURNAL_STORAGE_KEY);
const legacyKey = () => account.activeAccountLocalStorageKey(storage.JOURNAL_LEGACY_KEY);
const rawJournal = () => JSON.parse(local.rows.get(key())!).journalRaw as string;
const rows = () => JSON.parse(rawJournal()) as Record<string, unknown>[];
const input = { observedDate: '2028-12-14', note: 'I checked the ground and wrote down my own observation.', confirmed: true as const };
function oldEntry(id = 'old-note') {
  return { ...journal.createJournalEntry({ date: '2028-12-02', title: 'Existing observation', notes: 'Keep this earlier note.', category: 'other' }, 100), id };
}
function seedLegacy(value: unknown) { local.rows.set(legacyKey(), JSON.stringify(value)); }
function replaceCanonical(raw: string) {
  const envelope = JSON.parse(local.rows.get(key())!);
  local.rows.set(key(), JSON.stringify({ ...envelope, journalRaw: raw }));
}
async function journalReady(value: unknown[] = []) {
  seedLegacy(value);
  const result = await storage.initialiseJournalStorage();
  assert.equal(result.writable, true, `real journal lease required: ${result.reason}`);
}
async function source(ownedCloud = false) {
  if (ownedCloud) {
    const snapshot = cloud(true), { row } = await ownRow(snapshot, 'facilitator-cloud', snapshot.id);
    store([row]); probe.cloud = async () => [snapshot];
  } else {
    const { row } = await ownRow(); local.rows.set(studioKey(), JSON.stringify(studio())); store([row]);
  }
  const current = await core.loadGrowerOperationsSources(); assert.equal(current.status, 'ready');
  if (current.status !== 'ready') throw Error('Synthetic source unavailable');
  const task = buildGrowerBoardTasks(current.book.plantings, current.contexts, new Date(), new Set()).tasks
    .find(task => task.growerEventKind === 'field-entry');
  assert.ok(task?.growerJournalLink); return { current, task };
}
function actor(uid: string) {
  probe.actor = uid; account.bindMountedAccountLocalStorageUid(uid);
  for (const notify of probe.auth) notify({ uid });
}
beforeEach(async () => {
  for (const entries of loaded) journal.releaseJournalRead(entries); loaded.clear();
  storage.releaseAllDocumentJournalLeases(); await Promise.resolve();
  await reset();
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { locks: new Locks() } });
});
after(() => {
  for (const entries of loaded) journal.releaseJournalRead(entries);
  storage.releaseAllDocumentJournalLeases(); cleanup(); authHook.deregister();
  if (navigatorBefore) Object.defineProperty(globalThis, 'navigator', navigatorBefore); else Reflect.deleteProperty(globalThis, 'navigator');
  Reflect.deleteProperty(globalThis, '__observationWriterAuthErrors');
});

test('a confirmed observed date survives the actual canonical load pipeline without changing the plan, checklist or stock books', async () => {
  const { current, task } = await source(); await journalReady();
  assert.notEqual(input.observedDate, task.dueDate);
  const before = new Map(local.rows), writes = local.writes;
  const result = await recordGrowerFieldObservation(current, task, input, { isCurrent: () => true });
  assert.equal(result.status, 'saved'); assert.ok(result.journalEntryId);
  const entries = load(); assert.equal(entries.length, 1); assert.equal(entries[0].id, result.journalEntryId);
  assert.equal(entries[0].date, input.observedDate); assert.equal(entries[0].notes, input.note);
  const marker = journal.inspectJournalGrowerLink(entries[0]); assert.equal(marker.status, 'linked');
  if (marker.status !== 'linked') throw Error('Saved observation lost its canonical link');
  assert.equal(marker.link.plannedDate, task.dueDate);
  assert.equal(resolveGrowerJournalLink(current.book.plantings, current.contexts, entries[0].growerCycleLink).status, 'ready');
  assert.equal(local.writes - writes, 1, 'one confirmed canonical append, not a second journal or task write');
  for (const [name, bytes] of before) if (name !== key()) assert.equal(local.rows.get(name), bytes, name);
  assert.equal(local.rows.get(legacyKey()), '[]', 'the retired v1 source remains unchanged');
  assert.equal(storage.readJournalStorage().writable, true);
});

test('raw unknown metadata survives both the linked append and an ordinary linked-note edit', async () => {
  const { current, task } = await source();
  const prior = { ...oldEntry(), futureEvidence: { ownerDefined: ['retain', 0] } }; await journalReady([prior]);
  const result = await recordGrowerFieldObservation(current, task, input, { isCurrent: () => true }); assert.equal(result.status, 'saved');
  assert.deepEqual(rows().find(row => row.id === prior.id), prior);
  const entries = load(), linked = entries.find(row => row.id === result.journalEntryId)!;
  const edited = journal.editJournalEntry(linked, { date: '2028-12-15', title: linked.title, notes: 'An explicit corrected observation.', category: 'other' }, 300);
  assert.deepEqual(edited.growerCycleLink, linked.growerCycleLink);
  const saved = journal.saveJournal(journal.upsertJournalEntry(entries, edited), entries);
  loaded.add(saved.entries); assert.equal(saved.ok, true);
  const reloaded = load().find(row => row.id === linked.id)!;
  assert.equal(reloaded.date, '2028-12-15'); assert.deepEqual(reloaded.growerCycleLink, linked.growerCycleLink);
  assert.deepEqual(rows().find(row => row.id === prior.id)?.futureEvidence, prior.futureEvidence);
});

for (const transition of ['source', 'frame', 'book', 'actor-ABA', 'sample-ABA', 'form'] as const) {
  test(`${transition} during the real source-check await cannot append a journal observation`, async () => {
    const { current, task } = await source(); await journalReady();
    const before = rawJournal(), writes = local.writes;
    const pause = pauseHashes(); let formCurrent = true;
    const pending = recordGrowerFieldObservation(current, task, input, { isCurrent: () => formCurrent });
    await pause.started;
    if (transition === 'source' || transition === 'frame') {
      const changed = studio(); if (transition === 'source') changed.items[0].x = .6; else changed.frame.mPerPx = 2;
      local.rows.set(studioKey(), JSON.stringify(changed));
    }
    if (transition === 'book') store([...current.book.plantings, current.book.plantings[0]]);
    if (transition === 'actor-ABA') { actor('owner-b'); actor('owner-a'); }
    if (transition === 'sample-ABA') { samples.enterSampleMode(); samples.exitSampleMode(); }
    if (transition === 'form') formCurrent = false;
    const changedWrites = local.writes;
    pause.resume(); const result = await pending;
    assert.equal(result.status, 'held'); assert.equal(rawJournal(), before);
    assert.equal(local.writes, changedWrites, 'no journal or other delayed write after withdrawal');
    if (transition !== 'book') assert.ok(local.writes >= writes);
  });
}

test('an actual late owned-cloud read cannot borrow a replacement account or silently adopt changed remote geometry', async () => {
  for (const transition of ['owner', 'geometry'] as const) {
    if (transition === 'geometry') { storage.releaseAllDocumentJournalLeases(); await reset(); }
    const { current, task } = await source(true); await journalReady();
    const response = fixture.deferred<unknown[]>(), started = fixture.deferred<void>();
    probe.cloud = () => { started.resolve(); return response.promise; };
    const before = rawJournal(), pending = recordGrowerFieldObservation(current, task, input, { isCurrent: () => true });
    await started.promise;
    if (transition === 'owner') actor('owner-b');
    const remote = cloud(true); if (transition === 'geometry') remote.data.items[0].xM = 2;
    response.resolve([remote]); assert.equal((await pending).status, 'held');
    // Read the original namespace explicitly after an account transition.
    const originalKey = account.accountLocalStorageKey(storage.JOURNAL_STORAGE_KEY, 'owner-a');
    assert.equal(JSON.parse(local.rows.get(originalKey)!).journalRaw, before);
  }
});

test('malformed, duplicate or invalid linked raw rows remain intact instead of being normalized into an empty overwrite', async () => {
  const { current, task } = await source(); await journalReady();
  const prior = oldEntry();
  for (const raw of ['{broken', 'null', JSON.stringify([null, prior]), JSON.stringify([prior, prior]),
    JSON.stringify([{ ...prior, growerCycleLink: null }]), JSON.stringify([{ ...prior, growerCycleLink: { ...task.growerJournalLink, plantingId: '' } }])]) {
    replaceCanonical(raw); const before = local.rows.get(key()), writes = local.writes;
    const display = load(); const ordinary = journal.saveJournal([], display);
    assert.equal(ordinary.ok, false);
    assert.equal((await recordGrowerFieldObservation(current, task, input, { isCurrent: () => true })).status, 'held');
    assert.equal(local.rows.get(key()), before); assert.equal(local.writes, writes);
  }
});

test('an old loaded editor and a later retired-v1 writer cannot overwrite a canonical linked observation', async () => {
  const { current, task } = await source(); await journalReady([oldEntry()]);
  const stale = load(); assert.equal((await recordGrowerFieldObservation(current, task, input, { isCurrent: () => true })).status, 'saved');
  const actual = local.rows.get(key()), writes = local.writes;
  const candidate = journal.upsertJournalEntry(stale, journal.createJournalEntry({ date: input.observedDate, title: 'Old editor', notes: 'Do not overwrite current notes.', category: 'other' }));
  assert.equal(journal.saveJournal(candidate, stale).ok, false); assert.equal(local.rows.get(key()), actual); assert.equal(local.writes, writes);
  local.rows.set(legacyKey(), JSON.stringify([oldEntry('old-client')]));
  assert.equal(storage.readJournalStorage().reason, 'legacy-diverged');
  const heldDisplay = load(); assert.equal(journal.saveJournal(heldDisplay, heldDisplay).ok, false);
  assert.equal((await recordGrowerFieldObservation(current, task, input, { isCurrent: () => true })).status, 'held');
  assert.equal(local.rows.get(key()), actual); assert.equal(local.writes, writes);
});

test('invalid input, copied source receipts or altered task links cannot acquire canonical observation authority', async () => {
  const { current, task } = await source(); await journalReady(); const before = rawJournal(), writes = local.writes;
  for (const value of [{ ...input, observedDate: '' }, { ...input, observedDate: '2028-02-31' }, { ...input, note: ' ' }, { ...input, confirmed: false }]) {
    assert.equal((await recordGrowerFieldObservation(current, task, value as typeof input, { isCurrent: () => true })).status, 'held');
  }
  assert.equal((await recordGrowerFieldObservation(structuredClone(current), task, input, { isCurrent: () => true })).status, 'held');
  assert.equal((await recordGrowerFieldObservation(current, { ...task, growerJournalLink: { ...task.growerJournalLink!, plannedDate: '2028-12-31' } }, input, { isCurrent: () => true })).status, 'held');
  assert.equal(rawJournal(), before); assert.equal(local.writes, writes);
});

for (const failure of ['quota', 'readback'] as const) {
  test(`${failure} cannot be reported as a confirmed observation save`, async () => {
    const { current, task } = await source(); await journalReady(); const before = rawJournal();
    const original = local.setItem;
    try {
      local.setItem = function(name, value) {
        if (name === key() && failure === 'quota') throw Error('Quota exceeded');
        original.call(this, name, value);
        if (name === key() && failure === 'readback') this.onRead = readKey => { if (readKey === name) throw Error('Readback unavailable'); };
      };
      const result = await recordGrowerFieldObservation(current, task, input, { isCurrent: () => true });
      assert.equal(result.status, failure === 'quota' ? 'held' : 'unconfirmed');
      local.onRead = null;
      if (failure === 'quota') assert.equal(rawJournal(), before);
      else { assert.equal(rows().length, 1, 'the attempted note can exist despite an unconfirmed receipt'); assert.equal(storage.readJournalStorage().reason, 'write-unconfirmed'); }
    } finally {
      local.setItem = original; local.onRead = null;
      if (failure === 'readback') {
        // A fresh test must not bypass this real uncertainty hold by clearing
        // memory. Recover the exact completed bytes through the public protocol.
        await Promise.resolve();
        const context = storage.makeBrowserJournalStorageContext(); assert.ok(context);
        await storage.recoverJournalStorage(context);
        assert.equal((await storage.initialiseJournalStorage()).writable, true);
      }
    }
  });
}

const fieldJournalAst = ts.createSourceFile('FieldJournal.tsx', readFileSync(new URL('../components/journal/FieldJournal.tsx', import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let refreshSource = '', persistSource = '';
function findEditor(node: ts.Node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(fieldJournalAst) === 'refresh' && node.initializer && ts.isCallExpression(node.initializer))
    refreshSource = node.initializer.arguments[0]?.getText(fieldJournalAst) ?? '';
  if (ts.isFunctionDeclaration(node) && node.name?.text === 'persist') persistSource = node.getText(fieldJournalAst);
  ts.forEachChild(node, findEditor);
}
findEditor(fieldJournalAst); assert.ok(refreshSource && persistSource, 'exercise actual mounted journal handlers');
function executable(source: string, environment: Record<string, unknown>) {
  const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
  return new Function(...Object.keys(environment), code)(...Object.values(environment));
}
function editorHandlers() {
  let entries = load(), sheetError: string | null = null;
  const loadedEntries = { current: entries }, writeInProgress = { current: false }, unconfirmedWrite = { current: false };
  const environment = { loadJournal: load, releaseJournalRead: journal.releaseJournalRead, loadedEntries, writeInProgress, unconfirmedWrite,
    owner: 'owner-a', setReadOwner() {}, setEntries(next: JournalEntry[]) { loaded.add(next); entries = next; },
    saveJournal: journal.saveJournal, setSheetError(value: string | null) { sheetError = value; }, setNotice() {}, ui: (english: string) => english };
  const refresh = executable(`return (${refreshSource});`, environment) as () => void;
  const persist = executable(`${persistSource}; return persist;`, { ...environment, entries }) as (entries: JournalEntry[]) => boolean;
  let seen = 0;
  const changed = () => { seen++; refresh(); };
  fixture.events.addEventListener(storage.JOURNAL_STORAGE_EVENT, changed);
  fixture.events.addEventListener(journal.JOURNAL_CHANGED_EVENT, changed);
  return { persist, entries: () => entries, error: () => sheetError, unconfirmedWrite, seen: () => seen,
    cleanup() { fixture.events.removeEventListener(storage.JOURNAL_STORAGE_EVENT, changed); fixture.events.removeEventListener(journal.JOURNAL_CHANGED_EVENT, changed);
      journal.releaseJournalRead(loadedEntries.current); } };
}

test('the actual journal refresh handler can observe a controller append without revoking its independent final write proof', async () => {
  const { current, task } = await source(); await journalReady(); const editor = editorHandlers();
  try {
    const result = await recordGrowerFieldObservation(current, task, input, { isCurrent: () => true });
    assert.equal(result.status, 'saved'); assert.ok(editor.seen() > 0, 'the real canonical writer emitted its storage event');
    assert.equal(editor.entries().find(entry => entry.id === result.journalEntryId)?.notes, input.note);
    assert.equal(storage.readJournalStorage().writable, true);
  } finally { editor.cleanup(); }
});

test('the actual editor persist and refresh handlers keep their own storage and journal events from invalidating a successful linked edit', async () => {
  const { current, task } = await source(); await journalReady();
  assert.equal((await recordGrowerFieldObservation(current, task, input, { isCurrent: () => true })).status, 'saved');
  const editor = editorHandlers();
  try {
    const original = editor.entries()[0];
    const changed = journal.editJournalEntry(original, { date: '2028-12-15', title: original.title, notes: 'Corrected through the real journal editor.', category: 'other' });
    assert.equal(editor.persist(journal.upsertJournalEntry(editor.entries(), changed)), true);
    assert.ok(editor.seen() >= 2, 'actual storage and journal notifications both reached the mounted-handler harness');
    assert.equal(editor.error(), null); assert.equal(editor.unconfirmedWrite.current, false);
    const saved = load().find(entry => entry.id === original.id)!;
    assert.equal(saved.notes, changed.notes); assert.deepEqual(saved.growerCycleLink, original.growerCycleLink);
  } finally { editor.cleanup(); }
});

test('original raw numeric precision, overflow, underflow and decoded duplicate members cannot be silently erased by either journal writer', async () => {
  const { current, task } = await source(); await journalReady();
  const base = JSON.stringify(oldEntry());
  const cases = [
    ['known-overflow', base.replace('"createdAt":100', '"createdAt":1e400')],
    ['known-precision', base.replace('"createdAt":100', '"createdAt":100.00000000000000001')],
    ...['1e400', '1e-400', '1.0000000000000001', '9007199254740993'].map(literal => [literal, `${base.slice(0, -1)},"futureEvidence":{"amount":${literal}}}`]),
    ['duplicate-known-member', String.raw`${base.slice(0, -1)},"\u006eotes":"A different later note"}`],
    ['duplicate-unknown-member', String.raw`${base.slice(0, -1)},"futureEvidence":{"amount":1,"\u0061mount":2}}`],
  ];
  for (const [label, object] of cases) {
    const raw = `[${object}]`;
    assert.doesNotThrow(() => JSON.parse(raw), `${label}: valid JSON, not a syntax-error control`);
    assert.notEqual(JSON.stringify(JSON.parse(raw)), raw, `${label}: ordinary parsing and serialization really loses original evidence`);
    replaceCanonical(raw);
    const before = local.rows.get(key()), writes = local.writes;
    assert.equal(journal.inspectJournalRowsForWrite(raw), null, label);
    const display = load();
    assert.equal(journal.saveJournal(display, display).ok, false, label);
    assert.equal((await recordGrowerFieldObservation(current, task, input, { isCurrent: () => true })).status, 'held', label);
    assert.equal(local.rows.get(key()), before, label); assert.equal(local.writes, writes, label);
  }
});

test('retagging a linked observation to another bed is held before any write and keeps the user draft', async () => {
  const { current, task } = await source(); await journalReady();
  assert.equal((await recordGrowerFieldObservation(current, task, input, { isCurrent: () => true })).status, 'saved');
  const entries = load(), linked = entries[0], original = local.rows.get(key()), writes = local.writes;
  const draft = journal.editJournalEntry(linked, { date: linked.date, title: linked.title, notes: 'User draft still present.',
    category: linked.category, bedId: 'another-bed', bedLabel: 'Another bed' });
  assert.deepEqual(draft.growerCycleLink, linked.growerCycleLink);
  const result = journal.saveJournal(journal.upsertJournalEntry(entries, draft), entries);
  assert.equal(result.ok, false); assert.equal(result.held, true); assert.notEqual(result.unconfirmed, true);
  assert.equal(draft.notes, 'User draft still present.'); assert.equal(draft.bedId, 'another-bed');
  assert.equal(local.rows.get(key()), original); assert.equal(local.writes, writes);
});

test('ordinary save inspects loaded and candidate descriptors without executing getters or toJSON', async () => {
  const { current, task } = await source(); await journalReady();
  assert.equal((await recordGrowerFieldObservation(current, task, input, { isCurrent: () => true })).status, 'saved');
  for (const target of ['loaded-notes', 'candidate-notes', 'candidate-unknown', 'candidate-toJSON'] as const) {
    const entries = load(), candidate = entries.map(entry => ({ ...entry, notes: 'An ordinary safe draft.' }));
    let calls = 0;
    if (target === 'loaded-notes') Object.defineProperty(entries[0], 'notes', { enumerable: true, get() { calls++; return input.note; } });
    else Object.defineProperty(candidate[0], target === 'candidate-notes' ? 'notes' : target === 'candidate-unknown' ? 'futureEvidence' : 'toJSON', {
      enumerable: true, get() { calls++; return target === 'candidate-toJSON' ? () => ({}) : 'Unsafe getter value'; },
    });
    const before = local.rows.get(key()), writes = local.writes;
    const result = journal.saveJournal(candidate, entries);
    assert.equal(result.ok, false, target); assert.equal(result.held, true, target); assert.equal(calls, 0, target);
    assert.equal(local.rows.get(key()), before, target); assert.equal(local.writes, writes, target);
  }
});

for (const event of [storage.JOURNAL_STORAGE_EVENT, journal.JOURNAL_CHANGED_EVENT]) {
  test(`a reentrant replacement during ${event} cannot borrow the ordinary save's success receipt`, async () => {
    const { current, task } = await source(); await journalReady();
    assert.equal((await recordGrowerFieldObservation(current, task, input, { isCurrent: () => true })).status, 'saved');
    const entries = load(), original = entries[0];
    const replacement = { ...original, notes: 'A later writer replaced the note.' };
    let replaced = false;
    const replace = () => { if (replaced) return; replaced = true; replaceCanonical(JSON.stringify([replacement])); };
    fixture.events.addEventListener(event, replace);
    try {
      const candidate = journal.editJournalEntry(original, { date: original.date, title: original.title,
        notes: 'This writer must not claim the later replacement.', category: original.category });
      const result = journal.saveJournal(journal.upsertJournalEntry(entries, candidate), entries);
      loaded.add(result.entries);
      assert.equal(replaced, true, 'the actual writer emitted the targeted event');
      assert.equal(result.ok, false); assert.equal(result.unconfirmed, true);
      assert.equal(rows()[0].notes, replacement.notes, 'no rollback overwrites the later writer');
    } finally { fixture.events.removeEventListener(event, replace); }
  });
}

test('a retained actual operations-hook callback cannot adopt a newer ready source after refresh', async () => {
  await source(); await journalReady();
  let view!: ReturnType<typeof fixture.useGrowerOperations>;
  function Harness() { view = fixture.useGrowerOperations(); return React.createElement('div'); }
  let renderer!: ReactTestRenderer;
  try {
    await act(async () => { renderer = create(React.createElement(Harness)); });
    for (let i = 0; i < 20 && view.status === 'loading'; i++) await act(async () => { await new Promise<void>(done => setImmediate(done)); });
    const first = view; assert.equal(first.status, 'ready'); if (first.status !== 'ready') throw Error('Actual hook did not finish source check');
    const task = buildGrowerBoardTasks(first.book.plantings, first.contexts, new Date(), new Set()).tasks[0]; assert.ok(task?.growerJournalLink);
    const retained = first.onRecordObservation;
    await act(async () => { await view.refresh(); });
    assert.equal(view.status, 'ready'); assert.notEqual(view, first);
    const before = rawJournal(), writes = local.writes;
    assert.equal((await retained(task, input, () => true)).status, 'held');
    assert.equal(rawJournal(), before); assert.equal(local.writes, writes);
    let result!: Awaited<ReturnType<typeof retained>>;
    await act(async () => { result = await view.onRecordObservation(task, input, () => true); });
    assert.equal(result.status, 'saved', 'the replacement render has its own valid callback rather than blocking all observations');
  } finally { if (renderer) act(() => renderer.unmount()); }
});

test('a real sample source saves a DEMO linked note only through the sample v1 shim and preserves every personal storage byte', async () => {
  await journalReady([oldEntry()]); const personal = new Map(local.rows);
  assert.equal(samples.enterSampleMode(), true);
  try {
    const { row } = await ownRow();
    samples.setSandboxCropPlan({ version: 1, plantings: [row], updatedAt: 1 });
    local.setItem(studioKey(), JSON.stringify(studio()));
    local.setItem(storage.JOURNAL_LEGACY_KEY, '[]');
    const current = await core.loadGrowerOperationsSources(); assert.equal(current.status, 'ready');
    if (current.status !== 'ready') throw Error('Synthetic sample source held');
    const task = buildGrowerBoardTasks(current.book.plantings, current.contexts, new Date(), new Set()).tasks[0]; assert.ok(task?.growerJournalLink);
    const result = await recordGrowerFieldObservation(current, task, input, { isCurrent: () => true });
    assert.equal(result.status, 'saved'); assert.match(result.message, /DEMO/);
    const entries = load(); assert.equal(entries.length, 1); assert.equal(entries[0].date, input.observedDate);
    assert.equal(journal.inspectJournalGrowerLink(entries[0]).status, 'linked');
    assert.equal(storage.readJournalStorage().status, 'sample');
    assert.deepEqual(local.rows, personal, 'sample writes never create or alter real v1/v2/account keys');
  } finally { samples.exitSampleMode(); }
  assert.deepEqual(local.rows, personal);
});
