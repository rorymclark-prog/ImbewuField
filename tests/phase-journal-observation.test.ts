import assert from 'node:assert/strict';
import test, { after, beforeEach } from 'node:test';
import { act } from 'react-test-renderer';
import type { JournalEntry, JournalEntryInput } from '../lib/field-journal.ts';
import type { JournalStorageLocks } from '../lib/journal-storage.ts';
import type { PhaseJournalDraft, PhaseJournalSource } from '../lib/phase-journal-source.ts';

const fixture = await import('./international-grower-operations-fixture.ts');
const { account, local, probe, samples, session, studio, studioKey, siteId, stamp } = fixture;
const source = await import('../lib/phase-journal-source.ts');
const journal = await import('../lib/field-journal.ts');
const storage = await import('../lib/journal-storage.ts');
const navigatorBefore = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
const placesKey = () => account.activeAccountLocalStorageKey('permamap_saved_places');
const currentJournalKey = () => account.activeAccountLocalStorageKey(storage.JOURNAL_STORAGE_KEY);
const legacyJournalKey = () => account.activeAccountLocalStorageKey(storage.JOURNAL_LEGACY_KEY);
const sampleKey = 'imbewu_sample_mode';
const place = { id: 'own-place', name: 'Home farm', lat: 0, lon: 0, biome: '', elevation: 0, savedAt: stamp };
const observed: JournalEntryInput = { date: '2026-11-19', notes: 'I checked the emitter at the end of the line.', title: '', category: 'other' };
const old = { ...journal.createJournalEntry({ ...observed, date: '2026-11-04' }, 101), id: 'old', extra: { keep: true } };
const reads = new Set<JournalEntry[]>(), sources = new Set<PhaseJournalSource>(), drafts = new Set<PhaseJournalDraft>();

class Locks implements JournalStorageLocks {
  private readonly held = new Set<string>();

  async request<T>(name: string, _options: { mode: 'exclusive'; ifAvailable: true }, run: (lock: unknown | null) => T | PromiseLike<T>): Promise<T> {
    await Promise.resolve();
    if (this.held.has(name)) return await run(null);
    this.held.add(name);
    try { return await run({ name }); } finally { this.held.delete(name); }
  }
}

function cleanupReceipts() {
  reads.forEach(journal.releaseJournalRead);
  sources.forEach(source.releasePhaseJournalSource);
  drafts.forEach(source.releasePhaseJournalDraft);
  reads.clear(); sources.clear(); drafts.clear();
  storage.releaseAllDocumentJournalLeases();
}

const readJournal = () => {
  const current = journal.loadJournal();
  reads.add(current);
  return current;
};

function design() {
  return { ...studio(), lines: [{ id: 'drip-line', kind: 'drip', name: 'West bed irrigation', points: [[0.1, 0.2], [0.7, 0.2]] }] };
}

function review() {
  const current = source.reviewPhaseJournalSource(place.id);
  assert.ok(current);
  sources.add(current);
  return current;
}

function confirm(feature = 'drip-line') {
  const draft = source.confirmPhaseJournalFeature(review(), 'beds', feature);
  assert.ok(draft);
  drafts.add(draft);
  return draft;
}

function actor(uid: string) {
  probe.actor = uid;
  account.bindMountedAccountLocalStorageUid(uid);
  for (const notify of probe.auth) notify({ uid });
}

function canonicalRows(): Record<string, unknown>[] {
  return JSON.parse(JSON.parse(local.rows.get(currentJournalKey())!).journalRaw);
}

beforeEach(async () => {
  cleanupReceipts();
  await fixture.reset();
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { locks: new Locks() } });
  local.rows.set(placesKey(), JSON.stringify([place]));
  local.rows.set(studioKey(), JSON.stringify(design()));
  local.rows.set(legacyJournalKey(), JSON.stringify([old]));
  assert.equal((await storage.initialiseJournalStorage()).writable, true);
});

after(() => {
  cleanupReceipts();
  fixture.cleanup();
  if (navigatorBefore) Object.defineProperty(globalThis, 'navigator', navigatorBefore);
  else Reflect.deleteProperty(globalThis, 'navigator');
});

test('a named mapped line can be logged against the plan with its own observed date', () => {
  const draft = confirm(), current = readJournal(), before = new Map(local.rows);
  const result = journal.savePhaseJournalObservation(observed, draft, current);
  assert.equal(result.ok, true);
  reads.add(result.entries);
  const entry = readJournal().find(row => row.id !== old.id)!;
  assert.equal(entry.date, observed.date);
  assert.equal(entry.notes, observed.notes);
  const linked = journal.inspectJournalPhaseLink(entry);
  assert.equal(linked.status, 'recorded');
  if (linked.status !== 'recorded') throw Error('The readback lost the recorded design reference');
  assert.equal(linked.link.featureKind, 'line');
  assert.equal(linked.link.featureLabel, 'West bed irrigation');
  assert.equal(linked.link.phaseKey, 'beds');
  assert.equal(linked.link.siteId, siteId);
  assert.deepEqual(canonicalRows().find(row => row.id === old.id), old);
  for (const [key, content] of before) if (key !== currentJournalKey()) assert.equal(local.rows.get(key), content, key);
  assert.equal(source.currentPhaseJournalLink(draft), null, 'a confirmed write consumes its draft');
  assert.equal(journal.savePhaseJournalObservation(observed, draft, readJournal()).ok, false, 'retries do not duplicate observations');
});

test('an item uses its phase key even when adding an earlier phase moves the display number', () => {
  const current = review();
  assert.equal(source.confirmPhaseJournalFeature(current, 'setout', 'bed-a'), null);
  assert.equal(source.confirmPhaseJournalFeature(current, 'access_water', 'bed-a'), null);
  const next = design();
  next.lines.push({ id: 'path', kind: 'path', name: 'West entry', points: [[0.3, 0.1], [0.3, 0.6]] });
  local.rows.set(studioKey(), JSON.stringify(next));
  assert.equal(source.confirmPhaseJournalFeature(current, 'beds', 'bed-a'), null);
  const draft = confirm('bed-a');
  assert.equal(draft.link.phaseKey, 'beds');
  assert.equal(draft.link.featureKind, 'item');
});

for (const change of ['moving the feature', 'deleting the feature', 'removing the map', 'moving the saved site',
  'deleting the saved site', 'duplicating the saved place', 'duplicating the site coordinates', 'switching accounts',
  'switching away and back', 'entering and leaving sample mode'] as const) {
  test(`${change} holds a confirmed draft and preserves the whole journal`, () => {
    const current = readJournal(), draft = confirm();
    const originalKey = currentJournalKey(), saved = local.rows.get(originalKey), writes = local.writes;
    switch (change) {
      case 'moving the feature':
        local.rows.set(studioKey(), JSON.stringify({ ...design(), lines: [{ ...design().lines[0], points: [[0.2, 0.3], [0.6, 0.8]] }] }));
        break;
      case 'deleting the feature': local.rows.set(studioKey(), JSON.stringify({ ...design(), lines: [] })); break;
      case 'removing the map': local.rows.delete(studioKey()); break;
      case 'moving the saved site': local.rows.set(placesKey(), JSON.stringify([{ ...place, lat: 1 }])); break;
      case 'deleting the saved site':
        local.rows.set(account.activeAccountLocalStorageKey('permamap_saved_places_deleted'), JSON.stringify({ [place.id]: Date.now() }));
        break;
      case 'duplicating the saved place': local.rows.set(placesKey(), JSON.stringify([place, { ...place, lat: 1 }])); break;
      case 'duplicating the site coordinates': local.rows.set(placesKey(), JSON.stringify([place, { ...place, id: 'other' }])); break;
      case 'switching accounts': actor('owner-b'); break;
      case 'switching away and back': actor('owner-b'); actor('owner-a'); break;
      case 'entering and leaving sample mode':
        session.rows.set(sampleKey, '1');
        fixture.events.dispatchEvent(new Event(samples.SAMPLE_MODE_EVENT));
        session.rows.delete(sampleKey);
        fixture.events.dispatchEvent(new Event(samples.SAMPLE_MODE_EVENT));
        break;
    }
    assert.equal(journal.savePhaseJournalObservation(observed, draft, current).held, true);
    assert.equal(local.rows.get(originalKey), saved);
    assert.equal(local.writes, writes);
  });
}

test('foreign designs and duplicate identities across mapped item and line kinds are not selectable', () => {
  const foreign = account.accountLocalStorageKey(`imbewu_design_canvas_${siteId}`, 'owner-b');
  local.rows.delete(studioKey());
  local.rows.set(foreign, JSON.stringify(design()));
  assert.equal(source.reviewPhaseJournalSource(place.id), null);
  local.rows.set(studioKey(), JSON.stringify({ ...design(), lines: [{ ...design().lines[0], id: 'bed-a' }] }));
  assert.equal(source.reviewPhaseJournalSource(place.id), null);
  local.rows.set(studioKey(), JSON.stringify({ ...design(), items: [studio().items[0], { ...studio().items[0], id: 'bed-b' }] }));
  const current = review();
  assert.equal(current.hasAmbiguousNames, true);
  assert.equal(source.confirmPhaseJournalFeature(current, 'beds', 'bed-a'), null);
});

test('equal visible names at distinct saved sites are separated by their exact coordinates', () => {
  const name = 'N'.repeat(120);
  local.rows.set(placesKey(), JSON.stringify([
    { ...place, name: `${name} orchard` },
    { ...place, name: `${name} market garden`, id: 'other', lat: 1 },
  ]));
  const options = source.phaseJournalSites();
  assert.deepEqual(options.map(option => option.name), [`${name} · 0.00000, 0.00000`, `${name} · 1.00000, 0.00000`]);
  assert.equal(confirm().link.siteName, options[0].name);
  local.rows.set(placesKey(), JSON.stringify([
    place, { ...place, id: 'other', lat: 1 },
    { ...place, name: 'Home farm · 0.00000, 0.00000', id: 'third', lat: 2 },
  ]));
  const finalLabels = source.phaseJournalSites().map(option => option.name);
  assert.equal(new Set(finalLabels).size, 3, 'a literal name can overlap an automatically disambiguated label');
  assert.equal(confirm().link.siteName, finalLabels[0]);
});

test('duplicate JSON members cannot hide a different place or feature before identity review', () => {
  const originalCanvas = JSON.stringify(design());
  local.rows.set(studioKey(), originalCanvas.replace('"id":"bed-a"', '"id":"hidden-bed","id":"bed-a"'));
  assert.equal(source.reviewPhaseJournalSource(place.id), null);
  local.rows.set(studioKey(), originalCanvas);
  const originalPlaces = JSON.stringify([place]);
  local.rows.set(placesKey(), originalPlaces.replace('"id":"own-place"', '"id":"different-place","id":"own-place"'));
  assert.equal(source.reviewPhaseJournalSource(place.id), null);
  assert.deepEqual(source.phaseJournalSites(), []);
});

test('an ordinary journal save cannot create, replace or remove the reference on an existing note', () => {
  const draft = confirm(), initial = readJournal();
  const forged = { ...journal.createJournalEntry(observed), implementationPhase: draft.link };
  assert.equal(journal.saveJournal(journal.upsertJournalEntry(initial, forged), initial).held, true);
  assert.equal(journal.savePhaseJournalObservation({ ...observed, date: '' }, draft, initial).held, true);
  const valid = journal.savePhaseJournalObservation(observed, draft, initial);
  assert.equal(valid.ok, true);
  reads.add(valid.entries);
  const note = valid.entries.find(row => row.id !== old.id)!;
  local.rows.delete(studioKey());
  assert.equal(journal.editJournalEntry(note, { ...observed, date: '' }, Date.UTC(2026, 11, 24)).date, observed.date);
  const edited = journal.editJournalEntry(note, { ...observed, notes: 'Corrected what I saw.' });
  assert.deepEqual(edited.implementationPhase, note.implementationPhase);
  const { implementationPhase: _removed, ...without } = edited;
  assert.equal(journal.saveJournal(journal.upsertJournalEntry(valid.entries, without), valid.entries).held, true);
  const saved = journal.saveJournal(journal.upsertJournalEntry(valid.entries, edited), valid.entries);
  assert.equal(saved.ok, true);
  reads.add(saved.entries);
  const historical = saved.entries.find(row => row.id === note.id)!;
  assert.equal(journal.inspectJournalPhaseLink(historical).status, 'recorded');
  assert.equal(historical.notes, 'Corrected what I saw.');
});

test('an observation prepared in sample mode does not read or modify the real journal', () => {
  const real = new Map(local.rows);
  assert.equal(samples.enterSampleMode(), true);
  try {
    const sampleSites = source.phaseJournalSites();
    assert.equal(sampleSites.some(site => site.id === place.id), false);
    const demo = source.reviewPhaseJournalSource(sampleSites[0].id);
    assert.ok(demo);
    sources.add(demo);
    const phase = demo.phases.find(candidate => candidate.key === 'beds');
    assert.ok(phase?.features.length);
    const draft = source.confirmPhaseJournalFeature(demo, phase.key, phase.features[0].id);
    assert.ok(draft);
    drafts.add(draft);
    const result = journal.savePhaseJournalObservation(observed, draft, readJournal());
    assert.equal(result.ok, true);
    reads.add(result.entries);
    assert.ok(result.entries.some(entry => journal.inspectJournalPhaseLink(entry).status === 'recorded'));
    assert.equal(result.entries.some(entry => entry.id === old.id), false);
  } finally {
    samples.exitSampleMode();
  }
  assert.deepEqual(local.rows, real);
  assert.deepEqual(readJournal().map(entry => entry.id), [old.id]);
});

test('reopening a recorded design observation keeps the original date until the grower chooses a valid replacement', async () => {
  const written = journal.savePhaseJournalObservation(observed, confirm(), readJournal());
  assert.equal(written.ok, true);
  reads.add(written.entries);
  const recorded = written.entries.find(entry => entry.id !== old.id)!;
  const { mountJournal, renderedButton } = await import('./journal-workflow-renderer.ts');
  const app = await mountJournal({ simple: true, entries: [recorded] });
  try {
    await act(async () => app.renderer.root.findAllByType('button')
      .find(button => String(button.props['aria-label']).startsWith('Edit entry:'))!.props.onClick());
    const date = app.renderer.root.findByProps({ 'aria-label': 'Observed on' });
    assert.equal(date.props.value, observed.date);
    await act(async () => date.props.onChange({ target: { value: '' } }));
    assert.equal(renderedButton(app.renderer, 'Save changes').props.disabled, true);
    assert.equal(app.writes.length, 0);
  } finally {
    await app.close();
  }
});
