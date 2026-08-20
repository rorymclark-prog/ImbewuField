// Unit tests for app/cropplan/load-beds.ts — the fallback-vs-real decision behind the
// Task Planner (app/cropplan/page.tsx).
//
// WHY THIS TEST EXISTS: loadBeds() used to hand every new farmer a fictional four-bed
// schedule (Spinach/Tomatoes/Maize/Beans) with nothing marking it as an example — see
// the "Task Planner stops presenting invented crops as the farmer's own" fix. isDemo is
// the only signal the page has to tell a real saved plan from that invented one, so a
// silent regression here would put demo crops back in front of a farmer as their own.
//
// The page itself is .tsx and can't be imported by node's type-stripping (see
// tests/farmer-panel-format.test.ts for the same reasoning), hence the split module.
//
// Run with: node --import ./tests/register-alias.mjs --test tests/cropplan-beds.test.ts

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import test from 'node:test';

// account-local-storage.ts imports Firebase's ./firebase/init to resolve the active
// account uid. Stubbing it out (same technique as tests/account-local-storage.test.ts)
// keeps this test decoupled from a real Firebase config and lets us force the
// backend-unconfigured, signed-out case where account-local keys pass through bare —
// so the fixtures below can use the literal storage keys load-beds.ts reads from.
const fakeFirebaseInit = `data:text/javascript,${encodeURIComponent(`
export const getFirebase = () => ({ auth: { currentUser: null } });
export const isBackendConfigured = () => false;
`)}`;
const helperUrl = new URL('../lib/account-local-storage.ts', import.meta.url).href;
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (context.parentURL === helperUrl && specifier === './firebase/init') {
      return { url: fakeFirebaseInit, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});

class MemoryStorage {
  private rows = new Map<string, string>();
  getItem(key: string): string | null { return this.rows.get(key) ?? null; }
  setItem(key: string, value: string): void { this.rows.set(key, value); }
  removeItem(key: string): void { this.rows.delete(key); }
  clear(): void { this.rows.clear(); }
}

const localStorage = new MemoryStorage();
Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage } });
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: localStorage });

const { loadBeds, DEFAULT_BEDS } = await import('../app/cropplan/load-beds.ts');
hooks.deregister();

// Bare (backend-unconfigured, signed-out) storage keys — literal match of the private
// keys inside load-beds.ts. Kept duplicated here rather than exported, the same way
// tests/demo-data.test.ts hardcodes its own module's storage keys.
const LATEST_SURVEY_KEY = 'imbewu_garden_survey';
const DEFAULT_SURVEY_KEY = 'imbewu_garden_survey_default';
const PLANNER_CROPS_KEY = 'imbewu_planner_crops';

test.beforeEach(() => { localStorage.clear(); });

test('the demo four-bed example is exactly Spinach/Tomatoes/Maize/Beans, not real farm data', () => {
  assert.deepEqual(DEFAULT_BEDS.map((bed) => bed.crop), ['Spinach', 'Tomatoes', 'Maize', 'Beans']);
});

test('a farmer with nothing saved anywhere gets the demo beds, flagged as a demo', () => {
  const result = loadBeds();
  assert.equal(result.isDemo, true);
  assert.deepEqual(result.beds, DEFAULT_BEDS);
});

test('a saved garden survey is real, not a demo', () => {
  localStorage.setItem(LATEST_SURVEY_KEY, JSON.stringify({ bedCrops: ['Kale', 'Onions'] }));
  const result = loadBeds();
  assert.equal(result.isDemo, false);
  assert.deepEqual(result.beds, [
    { letter: 'A', crop: 'Kale' },
    { letter: 'B', crop: 'Onions' },
  ]);
});

test('the default-placeId survey is used, and is real, when the latest survey is missing', () => {
  localStorage.setItem(DEFAULT_SURVEY_KEY, JSON.stringify({ bedCrops: ['Carrots'] }));
  const result = loadBeds();
  assert.equal(result.isDemo, false);
  assert.deepEqual(result.beds, [{ letter: 'A', crop: 'Carrots' }]);
});

test('a standalone planner crop list is real, and is capped at six beds', () => {
  localStorage.setItem(PLANNER_CROPS_KEY, JSON.stringify(['A', 'B', 'C', 'D', 'E', 'F', 'G']));
  const result = loadBeds();
  assert.equal(result.isDemo, false);
  assert.equal(result.beds.length, 6);
  assert.equal(result.beds[5].crop, 'F');
});

test('an empty saved bedCrops list does not count as real data and still falls through to the demo', () => {
  localStorage.setItem(LATEST_SURVEY_KEY, JSON.stringify({ bedCrops: [] }));
  localStorage.setItem(DEFAULT_SURVEY_KEY, JSON.stringify({ bedCrops: [] }));
  const result = loadBeds();
  assert.equal(result.isDemo, true);
  assert.deepEqual(result.beds, DEFAULT_BEDS);
});

test('malformed JSON in the survey keys is skipped rather than crashing, and still falls through to the demo', () => {
  localStorage.setItem(LATEST_SURVEY_KEY, '{not json');
  localStorage.setItem(DEFAULT_SURVEY_KEY, '{also not json');
  localStorage.setItem(PLANNER_CROPS_KEY, 'null');
  const result = loadBeds();
  assert.equal(result.isDemo, true);
  assert.deepEqual(result.beds, DEFAULT_BEDS);
});

test('a non-array planner crop list is rejected and still falls through to the demo', () => {
  localStorage.setItem(PLANNER_CROPS_KEY, JSON.stringify({ not: 'an array' }));
  const result = loadBeds();
  assert.equal(result.isDemo, true);
  assert.deepEqual(result.beds, DEFAULT_BEDS);
});

test('a real garden survey wins over a standalone planner crop list', () => {
  localStorage.setItem(PLANNER_CROPS_KEY, JSON.stringify(['Ignored']));
  localStorage.setItem(LATEST_SURVEY_KEY, JSON.stringify({ bedCrops: ['Real crop'] }));
  const result = loadBeds();
  assert.equal(result.isDemo, false);
  assert.deepEqual(result.beds, [{ letter: 'A', crop: 'Real crop' }]);
});

test('the page renders an unmissable, pinned banner with an escape hatch whenever there is no real crop plan', () => {
  // The Task Planner (app/cropplan/page.tsx) no longer generates any jobs from this
  // module's beds at all — see tests/cropplan-task-source.test.ts. It sources jobs
  // exclusively from the real crop plan (lib/task-board.ts's loadCropBoardTasksForMonth)
  // and gates its notice on whether that real plan exists (`!hasPlan`), unconditionally —
  // fixing the older bug where a farmer with only a garden survey (isDemo === false here,
  // but still no real dated plan) got fabricated jobs with no warning at all.
  const pageSource = readFileSync(new URL('../app/cropplan/page.tsx', import.meta.url), 'utf8');
  // Pinned outside the `overflow-y-auto` scroll container, not inside it — scrolling the
  // job list must never be able to carry the notice off-screen.
  const scrollContainerIndex = pageSource.indexOf('overflow-y-auto');
  const bannerIndex = pageSource.indexOf('!hasPlan &&');
  assert.ok(bannerIndex > 0, 'page.tsx must gate its no-plan notice on `!hasPlan`, unconditionally');
  assert.ok(bannerIndex < scrollContainerIndex, 'the no-plan notice must sit outside the scrollable content, not inside it');
  assert.match(pageSource, /No crop plan yet/, 'the notice must say plainly that there is no real plan yet');
  assert.match(pageSource, /href="\/facilitator\/crops"/, 'the notice must offer a real way to set up the farmer\'s own crop plan');
});
