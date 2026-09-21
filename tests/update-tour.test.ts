import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync } from 'node:fs';
import { visibleNotes, visibleUpdateTour, type ReleaseNote } from '../lib/release-notes.ts';
import { cleanUpdateTour, readUpdateGuide } from '../lib/update-tour.ts';

test('the update guide visits the pages described by the visible release notes', () => {
  const stops = visibleUpdateTour();
  assert.ok(stops.length >= 2, 'the guide must lead beyond the update list');
  for (const stop of stops) {
    assert.ok(existsSync(new URL(`../app${stop.href}/page.tsx`, import.meta.url)),
      `the update guide points at a missing page: ${stop.href}`);
  }
  const notes: ReleaseNote[] = [
    { when: 'today', changes: ['One', 'Two'], tour: [stops[0]] },
    { when: 'yesterday', changes: ['Three'], tour: [stops[1]] },
  ];
  assert.equal(visibleNotes(notes, 2).length, 2);
  assert.deepEqual(visibleUpdateTour(notes, 2), [stops[0]],
    'an older change outside the announced notes must not appear in the guide');
});

test('a refresh offers only internal app pages from the newly installed build', () => {
  const stops = visibleUpdateTour();
  assert.deepEqual(cleanUpdateTour([
    ...stops,
    { ...stops[0], href: 'https://other.example' },
    { ...stops[0], href: '//other.example' },
    { ...stops[0], href: '/updates/../account' },
  ]), stops);
  const saved = JSON.stringify({ sha: 'new1234', stops, phase: 'offer', index: 0 });
  assert.equal(readUpdateGuide(saved, 'old1234'), null,
    'a stale reload must not pretend the new build is installed');
  assert.deepEqual(readUpdateGuide(saved, 'new1234'), {
    sha: 'new1234', stops, phase: 'offer', index: 0,
  });
  assert.equal(readUpdateGuide('{broken', 'new1234'), null);
  assert.equal(readUpdateGuide(JSON.stringify({ sha: 'new1234', stops: [] }), 'new1234'), null);
});
