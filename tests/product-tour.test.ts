import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import {
  FARM_TOUR, PRODUCT_TOUR, cleanTourProgress, cleanProductTourProgress,
  nextProductTourStep, sampleChoicesForAccount,
} from '../lib/sample-tour';

test('the short product tour includes grower tools, support and both partner views', () => {
  assert.equal(PRODUCT_TOUR.reduce((minutes, step) => minutes + step.minutes, 0), 15);
  assert.equal(new Set(PRODUCT_TOUR.map(step => step.id)).size, PRODUCT_TOUR.length);
  assert.ok(PRODUCT_TOUR.every(step => Number.isInteger(step.minutes) && step.minutes > 0));
  const destinations = new Set(PRODUCT_TOUR.flatMap(step => [step.href, step.secondaryHref].filter(Boolean)));
  for (const required of ['/student', '/farmer?panel=Ask', '/invoice', '/mentor', '/ngo', '/funder', '/feedback']) {
    assert.ok(destinations.has(required), `The tour must demonstrate ${required}`);
  }
  assert.ok(destinations.has('/records?tab=charts'), 'The money step must open the figures it asks visitors to compare');
  assert.ok(destinations.has('/farmer?panel=Reports'), 'The site report must be reachable beyond the separate evidence pack');
  assert.equal(PRODUCT_TOUR.find(step => step.id === 'report')?.href, '/samples/farm#report',
    'The timed report stop needs the ready evidence export, not an empty saved-report library or a paid AI request');
});

test('every tour action leads to an existing app page without an external redirect', () => {
  for (const step of PRODUCT_TOUR) {
    assert.equal(!!step.secondaryHref, !!step.secondaryLabel, `${step.id} secondary action needs a destination and label`);
    for (const href of [step.href, step.secondaryHref].filter((value): value is string => !!value)) {
      assert.match(href, /^\/(?!\/)/);
      const url = new URL(href, 'https://imbewufield.vercel.app');
      assert.equal(url.origin, 'https://imbewufield.vercel.app');
      assert.ok(existsSync(new URL(`../app${url.pathname}/page.tsx`, import.meta.url)), `Missing page: ${href}`);
    }
  }
});

test('tour progress discards malformed and stale values without marking unseen stops complete', () => {
  for (const invalid of [undefined, null, '', 42, { garden: true }]) {
    assert.deepEqual(cleanProductTourProgress(invalid), []);
  }
  assert.deepEqual(cleanProductTourProgress(['garden', 'garden', 'planning', 'map', null, {}, 'missing']), ['garden', 'planning']);
  assert.equal(nextProductTourStep(undefined)?.id, 'garden');
  assert.equal(nextProductTourStep(['garden', 'planning', 'funder'])?.id, 'learning');
  assert.equal(nextProductTourStep(PRODUCT_TOUR.map(step => step.id)), undefined);
});

test('the broader tour preserves existing farm progress and account sample restrictions', () => {
  assert.equal(FARM_TOUR.reduce((minutes, step) => minutes + step.minutes, 0), 15);
  assert.deepEqual(cleanTourProgress(['map', 'map', 'design', 'organisation']), ['map', 'design']);
  for (const role of ['farmer', 'mentor', 'student', 'funder'] as const) {
    assert.deepEqual(sampleChoicesForAccount(role, true, true), [role]);
  }
  assert.deepEqual(sampleChoicesForAccount(null, true, true), []);
  assert.deepEqual(sampleChoicesForAccount('ngo', true, false), []);
  assert.ok(PRODUCT_TOUR.every(step => step.role !== 'admin'), 'No tour destination can grant administrator access');
});
