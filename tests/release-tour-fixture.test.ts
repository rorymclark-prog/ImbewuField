import test from 'node:test';
import assert from 'node:assert/strict';
import {
  RELEASE_NOTES, MAX_SHOWN, visibleNotes, visibleUpdateTour, type ReleaseNote,
} from '../lib/release-notes.ts';
import { withArchivedReleaseTour } from './update-ui-renderer.ts';

const ARCHIVE_SHA = 'a5300d2f7';
const ROUTINE_SHAS = ['f98125ce1', '6c7c33401', '2589a52bf'];

function snapshot() {
  return {
    identity: RELEASE_NOTES,
    entries: [...RELEASE_NOTES],
    bytes: JSON.stringify(RELEASE_NOTES),
    currentTour: structuredClone(visibleUpdateTour()),
    currentLines: visibleNotes(),
  };
}

function restored(before: ReturnType<typeof snapshot>): void {
  assert.equal(RELEASE_NOTES, before.identity, 'the exported current-release array keeps its identity');
  assert.equal(JSON.stringify(RELEASE_NOTES), before.bytes, 'every original nested field and its order is restored');
  assert.equal(RELEASE_NOTES.length, before.entries.length);
  assert.ok(RELEASE_NOTES.every((note, index) => note === before.entries[index]),
    'restoration returns the original note objects rather than reconstructed equivalents');
  assert.deepEqual(visibleUpdateTour(), before.currentTour, 'unscoped guide defaults return to the actual current releases');
  assert.deepEqual(visibleNotes(), before.currentLines, 'unscoped announcement lines return to current releases');
}

function source(sha: string): ReleaseNote {
  const note = RELEASE_NOTES.find(entry => entry.sha === sha);
  assert.ok(note, `the explicit archived source ${sha} must exist`);
  return note;
}

test('an explicit archived guide occupies the announced-change window using exact detached source notes', async () => {
  const before = snapshot();
  const archived = source(ARCHIVE_SHA);
  assert.ok(archived.tour?.length);
  const sources = [archived, ...ROUTINE_SHAS.map(source)];
  assert.ok(sources.slice(1).every(note => !note.tour?.length), 'the archived fillers are routine sources, not other guides');
  const expected = structuredClone(sources);
  assert.ok(expected.reduce((count, note) => count + note.changes.length, 0) >= MAX_SHOWN,
    'the declared source boundary must fill the same window the app announces');

  await withArchivedReleaseTour(async () => {
    const prefix = RELEASE_NOTES.slice(0, sources.length);
    assert.deepEqual(prefix, expected, 'fixture text, dates, destinations and source identities are exact archived data');
    for (let index = 0; index < sources.length; index++) {
      assert.notEqual(prefix[index], sources[index]);
      assert.notEqual(prefix[index].changes, sources[index].changes);
      if (sources[index].tour) {
        assert.notEqual(prefix[index].tour, sources[index].tour);
        assert.ok(prefix[index].tour!.every((stop, stopIndex) => stop !== sources[index].tour![stopIndex]));
      }
    }
    assert.deepEqual(visibleNotes(), expected.flatMap(note => note.changes).slice(0, MAX_SHOWN));
    assert.deepEqual(visibleUpdateTour(), archived.tour,
      'newer real release tours cannot leak into this explicitly archived positive fixture');
  });
  restored(before);
});

test('nested rejection and a throwing callback cannot leak active fixture mutations into real release history', async () => {
  const before = snapshot();
  const failure = Error('Deliberate archived-fixture callback failure');
  let nestedCallbackEntered = false;
  await assert.rejects(withArchivedReleaseTour(async () => {
    const outer = snapshot();
    await assert.rejects(withArchivedReleaseTour(async () => { nestedCallbackEntered = true; }));
    assert.equal(nestedCallbackEntered, false, 'a rejected nested scope cannot execute its callback');
    restored(outer);

    // These are detached active-fixture fields, not edits to the source history.
    RELEASE_NOTES[0].changes[0] += ' (local callback mutation)';
    assert.ok(RELEASE_NOTES[0].tour?.length);
    RELEASE_NOTES[0].tour[0].title += ' (local callback mutation)';
    RELEASE_NOTES[1].changes.push('Local callback-only mutation');
    assert.equal(JSON.stringify(before.entries), before.bytes, 'even a failing callback cannot mutate the archived source objects');
    throw failure;
  }), error => error === failure);
  restored(before);

  await withArchivedReleaseTour(async () => {
    assert.deepEqual(visibleUpdateTour(), source(ARCHIVE_SHA).tour);
  });
  restored(before);
});

test('missing or invalid routine sources reject before installation and cannot poison the next valid scope', async () => {
  const before = snapshot();
  const archived = source(ARCHIVE_SHA);
  assert.ok(archived.tour?.length);
  for (const sha of ROUTINE_SHAS) {
    const routine = before.entries.find(note => note.sha === sha);
    assert.ok(routine);
    const reduced = before.entries.filter(note => note.sha !== sha);
    assert.equal(reduced.length, before.entries.length - 1, 'the adverse fixture removes exactly its named real source');
    const emptyRoutine: ReleaseNote = { ...structuredClone(routine), changes: [] };
    const touredRoutine: ReleaseNote = { ...structuredClone(routine), tour: structuredClone(archived.tour) };
    const variants: readonly [string, ReleaseNote[]][] = [
      ['missing', reduced],
      ['empty changes', before.entries.map(note => note === routine ? emptyRoutine : note)],
      ['source-derived tour', before.entries.map(note => note === routine ? touredRoutine : note)],
    ];
    for (const [kind, entries] of variants) {
      RELEASE_NOTES.splice(0, RELEASE_NOTES.length, ...entries);
      const invalidSourceState = snapshot();
      let callbackEntered = false;
      try {
        await assert.rejects(withArchivedReleaseTour(async () => { callbackEntered = true; }));
        assert.equal(callbackEntered, false, `${kind} source must fail before the positive callback executes`);
        restored(invalidSourceState);
      } finally {
        RELEASE_NOTES.splice(0, RELEASE_NOTES.length, ...before.entries);
      }
      restored(before);
      await withArchivedReleaseTour(async () => {
        assert.deepEqual(visibleUpdateTour(), source(ARCHIVE_SHA).tour);
      });
      restored(before);
    }
  }
});
