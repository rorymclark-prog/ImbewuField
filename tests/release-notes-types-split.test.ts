import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { MAX_TOUR_STOPS as typesMax, type UpdateTourStop } from '../lib/release-notes-types.ts';
import { MAX_TOUR_STOPS as notesMax } from '../lib/release-notes.ts';

// perf-02: lib/update-tour.ts statically imported MAX_TOUR_STOPS from lib/release-notes.ts as a
// runtime value, which pulls the ~300 KB RELEASE_NOTES catalogue into every page's bundle through
// PWAUpdateNotifier/UpdateGuide on app/layout.tsx. MAX_TOUR_STOPS and UpdateTourStop now live in
// the tiny lib/release-notes-types.ts, and lib/release-notes.ts only re-exports them.

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8');
const UPDATE_TOUR = read('../lib/update-tour.ts');
const RELEASE_NOTES = read('../lib/release-notes.ts');

test('update-tour.ts imports MAX_TOUR_STOPS from the tiny types module, not release-notes.ts', () => {
  assert.match(UPDATE_TOUR, /from '\.\/release-notes-types';/);
  assert.doesNotMatch(UPDATE_TOUR, /MAX_TOUR_STOPS[^\n]*from '\.\/release-notes';/);
});

test('release-notes.ts re-exports MAX_TOUR_STOPS and UpdateTourStop rather than defining them', () => {
  assert.match(RELEASE_NOTES, /export \{ MAX_TOUR_STOPS \} from '\.\/release-notes-types';/);
  assert.match(RELEASE_NOTES, /export type \{ UpdateTourStop \} from '\.\/release-notes-types';/);
  assert.doesNotMatch(RELEASE_NOTES, /^export const MAX_TOUR_STOPS = 5;/m);
});

test('the re-exported value is the same value the tiny module defines', () => {
  assert.equal(notesMax, typesMax);
  assert.equal(typesMax, 5);
  const stop: UpdateTourStop = { title: 'a', where: 'b', detail: 'c', href: '/d' };
  assert.equal(stop.href, '/d');
});
