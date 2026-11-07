import { withArchivedReleaseTour } from './update-ui-renderer.ts';
import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync } from 'node:fs';
import { visibleNotes, visibleUpdateTour, type ReleaseNote } from '../lib/release-notes.ts';
import { cleanUpdateTour, readUpdateGuide } from '../lib/update-tour.ts';

test('the update guide visits the pages described by the visible release notes', () => {
 // This positive guide case uses an explicit real archived announcement.
 return withArchivedReleaseTour(async()=>{
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
});

test('a refresh offers only internal app pages from the newly installed build', () => {
 // This positive guide case uses an explicit real archived announcement.
 return withArchivedReleaseTour(async()=>{
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
});

test('the guide retains its exact Ask and Sold panels without admitting arbitrary queries or redirect-shaped destinations', () => {
  const stop = { title: 'Ask scope', where: 'Ask Lima', detail: 'Review the question scope.', href: '/farmer?panel=Ask' };
  assert.deepEqual(cleanUpdateTour([stop]), [stop]);
  assert.deepEqual(readUpdateGuide(JSON.stringify({ sha: 'current', stops: [stop], phase: 'tour', index: 0 }), 'current'), {
    sha: 'current', stops: [stop], phase: 'tour', index: 0,
  });
  const sold = { ...stop, href: '/records?tab=sold' };
  assert.deepEqual(cleanUpdateTour([sold]), [sold]);
  assert.deepEqual(readUpdateGuide(JSON.stringify({ sha: 'current', stops: [sold], phase: 'tour', index: 0 }), 'current'), {
    sha: 'current', stops: [sold], phase: 'tour', index: 0,
  });
  for (const href of [
    '/farmer?panel=Ask&next=https://other.example', '/farmer?panel=Other',
    '/farmer?next=https://other.example', '//other.example', '/farmer/../account',
    '/farmer%3Fpanel=Ask', '/farmer?panel=Ask#other', '/farmer?panel=Ask\n',
    '/farmer\n', '/farmer#Ask\n', 'https://other.example/farmer?panel=Ask',
    '/records?tab=sold&next=//other.example', '/records?tab=other',
    '/records?tab=sold\n', '/records?tab=sold#other',
  ]) assert.deepEqual(cleanUpdateTour([{ ...stop, href }]), [], href);
});
