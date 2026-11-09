// REVIEW-017 additive repro (scratch only, not part of the frozen candidate).
// Executes the two real data sources the /cropplan page renders together
// (app/cropplan/page.tsx:307 withheld count from loadCropBoardYear, and
// GrowerOperationsPanel fed by loadGrowerOperationsSources/buildGrowerBoardTasks).
// Bounded: in-memory window/localStorage, fixture Firebase auth, crop-plan
// storage lease fixture. The page component itself is not mounted here.
import { replaceCanonicalCropPlanFixtureRaw } from './crop-plan-storage-fixture.ts';
import assert from 'node:assert/strict';
import test, { after, beforeEach } from 'node:test';
import { account, core, local, ownRow, reset, cleanup, siteId, studio, studioKey } from './international-grower-operations-fixture.ts';

const board = await import('../lib/task-board.ts');
beforeEach(reset); after(cleanup);

// Synthetic place with no confirmed country context (status 'unknown').
const place = { id: 'review-place', name: 'Synthetic place', lat: 0, lon: 0, biome: 'synthetic', rainfall: 0, elevation: 0, savedAt: '' };
function storeWorld(plantings: unknown[]) {
  local.setItem(account.activeAccountLocalStorageKey('permamap_saved_places'), JSON.stringify([place]));
  local.setItem(studioKey(), JSON.stringify(studio()));
  replaceCanonicalCropPlanFixtureRaw(JSON.stringify({ version: 1, updatedAt: 1, plantings }));
}
const legacy = { id: 'legacy-catalogue-row', bedId: 'bed-a', cropKey: 'spinach', sowMonth: 3 };

test('fixture integrity: the synthetic site resolves to no catalogue planning basis', async () => {
  storeWorld([legacy]);
  const year = board.loadCropBoardYear(new Set(), new Date(Date.UTC(2028, 11, 5)));
  assert.equal(year.hasPlanningBasis, false);
  assert.equal(year.withheldPlantings, 1, 'a legacy catalogue row is correctly withheld (negative control R-C-NC1)');
});

test('R-C1 an own dated grower cycle is not counted as a catalogue entry withheld for lack of a supported country', async () => {
  const own = await ownRow();
  storeWorld([own.row]);
  // The same row's own dated work is available to GrowerOperationsPanel on this unsupported site.
  const sources = await core.loadGrowerOperationsSources();
  assert.equal(sources.status, 'ready', JSON.stringify(sources));
  if (sources.status !== 'ready') return;
  const own_tasks = board.buildGrowerBoardTasks(sources.book.plantings, sources.contexts, new Date(Date.UTC(2028, 11, 5)), new Set()).tasks;
  assert.ok(own_tasks.length > 0, 'own cycle produces dated grower tasks without a country basis');
  const year = board.loadCropBoardYear(new Set(), new Date(Date.UTC(2028, 11, 5)));
  assert.equal(year.total, 0, 'no catalogue jobs (own rows never produce catalogue jobs)');
  assert.equal(year.withheldPlantings, 0,
    `page.tsx:378 would say "Catalogue-derived jobs are unavailable for ${year.withheldPlantings} saved sowing entry without a supported country" for a row whose own dated jobs are shown above it`);
});

test('R-C2 a mixed plan counts only the catalogue row (saved count unchanged)', async () => {
  const own = await ownRow();
  storeWorld([own.row, legacy]);
  const year = board.loadCropBoardYear(new Set(), new Date(Date.UTC(2028, 11, 5)));
  assert.equal(year.withheldPlantings, 1);
  assert.equal(year.savedPlantings, 2, 'saved count is unchanged; nothing is dropped');
});
