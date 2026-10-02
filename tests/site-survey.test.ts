import test from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import { fieldDeviceStore, type DeviceStore } from '../lib/field-device-store';
import { bindMountedAccountLocalStorageUid, activeAccountLocalStorageKey } from '../lib/account-local-storage';

import {
  canonicalSurveySiteId,
  loadSurvey,
  reportedFoodGroups,
  toggleSurveyChoice,
  productionNeedsReview,
  saveSurvey,
  surveyToPrompt,
  createSurveyDraftStore,
  surveySavedRevision,
  type SiteSurveyDraftInput,
  type SiteSurvey,
} from '../lib/site-survey.ts';

class MemoryStorage {
  rows = new Map<string, string>();
  failKey: string | null = null;
  getItem(key: string) { return this.rows.get(key) ?? null; }
  setItem(key: string, value: string) {
    if (key === this.failKey) throw new Error('storage unavailable');
    this.rows.set(String(key), String(value));
  }
  removeItem(key: string) { this.rows.delete(key); }
}

function installBrowser() {
  const local = new MemoryStorage();
  const session = new MemoryStorage();
  const target = new EventTarget() as EventTarget & {
    localStorage: MemoryStorage;
    sessionStorage: MemoryStorage;
  };
  target.localStorage = local;
  target.sessionStorage = session;
  Object.defineProperty(globalThis, 'window', { configurable: true, value: target });
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: local });
  return { local, target };
}

function survey(overrides: Partial<SiteSurvey> = {}): SiteSurvey {
  return {
    siteId: 'site:-29.00000,31.00000',
    placeId: 'farm',
    savedAt: '2026-01-01T00:00:00.000Z',
    siteType: 'homestead',
    adults: '2-5',
    goals: ['food'],
    waterSource: ['rainwater'],
    waterDelivery: ['drip'],
    waterStorage: ['jojo'],
    roofMainM2: 100,
    roofSecondaryM2: null,
    hasGutters: true,
    landPrepMethod: 'hand',
    soilCondition: 'healthy',
    soilAmendments: ['compost'],
    hasFencing: 'full',
    existingCrops: ['vegetables'],
    existingGrowingAreaM2: 50,
    livestock: ['chickens'],
    otherInfra: ['compost-bay'],
    farmingPractice: 'organic',
    challenges: ['water'],
    isCommercial: false,
    notes: 'Farmer observation',
    ...overrides,
  };
}

test('a complete survey produces finite, specific report context', () => {
  const prompt = surveyToPrompt(survey(), 800);
  assert.match(prompt, /Household homestead/);
  assert.match(prompt, /Total harvestable roof area: 100 m²/);
  assert.match(prompt, /Estimated annual roof harvest/);
  assert.match(prompt, /Farmer observation/);
  assert.doesNotMatch(prompt, /NaN|Infinity|undefined|\[object Object\]/);
});

test('roof harvest never exceeds rain on roof and does not invent missing rainfall', () => {
  const areaM2 = 100;
  const rainMm = 800;
  const prompt = surveyToPrompt(survey({ roofMainM2: areaM2 }), rainMm);
  const match = /Estimated annual roof harvest at .*: ~(\d+) kL/.exec(prompt);
  assert.ok(match);
  const harvestKL = Number(match[1]);
  assert.ok(harvestKL >= 0);
  assert.ok(harvestKL <= areaM2 * rainMm / 1000);

  for (const bad of [Number.NaN, Infinity, -1]) {
    const unavailable = surveyToPrompt(survey(), bad);
    assert.match(unavailable, /unavailable until annual rainfall is known/);
    assert.doesNotMatch(unavailable, /NaN|Infinity/);
  }
});

test('negative and non-finite areas are treated as unmeasured, never printed', () => {
  for (const bad of [Number.NaN, Infinity, -1]) {
    const prompt = surveyToPrompt(survey({
      roofMainM2: bad,
      roofSecondaryM2: bad,
      existingGrowingAreaM2: bad,
    }), 800);
    assert.match(prompt, /Roof area: not measured/);
    assert.doesNotMatch(prompt, /NaN|Infinity|-1 m²/);
  }
});

test('older malformed array fields cannot crash report generation', () => {
  const malformed = survey({
    goals: 'food' as unknown as string[],
    waterSource: null as unknown as string[],
    waterDelivery: { drip: true } as unknown as string[],
    waterStorage: undefined as unknown as string[],
    soilAmendments: [null, 'compost'] as unknown as string[],
    existingCrops: 42 as unknown as string[],
    livestock: 'none' as unknown as string[],
    otherInfra: {} as unknown as string[],
    challenges: undefined as unknown as string[],
  });
  const prompt = surveyToPrompt(malformed, 800);
  assert.match(prompt, /Goals: not specified/);
  assert.doesNotMatch(prompt, /NaN|Infinity|undefined|\[object Object\]/);

  const missing = surveyToPrompt(null as unknown as SiteSurvey, 800);
  assert.match(missing, /not specified/);
  assert.doesNotMatch(missing, /NaN|Infinity|undefined|\[object Object\]/);
});

test('production remains farmer-reported: old surveys stay blank and bad figures never become zero', () => {
  const { local } = installBrowser();
  const siteId = 'site:-29.00000,31.00000';
  local.setItem(`imbewu_site_survey_${siteId}`, JSON.stringify({
    ...survey(),
    reportedProduction: [
      { category: 'eggs', quantityPerYear: 120, unit: ' eggs ', usedByHousehold: 100, sold: 20, incomeZar: 400, harvestMonths: [12, 1, 12, 13] },
      { category: 'eggs', quantityPerYear: 999, unit: 'eggs', usedByHousehold: 0, sold: 0, incomeZar: 0 },
      { category: 'poultry', quantityPerYear: Infinity, unit: 'birds', usedByHousehold: -1, sold: Number.NaN, incomeZar: -2 },
      { category: 'other', name: ' ', quantityPerYear: 3, unit: 'kg' },
    ],
  }));
  const loaded = loadSurvey(siteId);
  assert.ok(loaded);
  assert.deepEqual(loaded.reportedProduction, [{
    category: 'eggs', quantityPerYear: 120, unit: 'eggs', usedByHousehold: 100, sold: 20, incomeZar: 400, harvestMonths: [1, 12],
  }, {
    category: 'poultry', quantityPerYear: null, unit: 'birds', usedByHousehold: null, sold: null, incomeZar: null,
  }]);
  assert.deepEqual(reportedFoodGroups(loaded.reportedProduction ?? []), ['eggs']);
});

test('food-group count never guesses from a blank quantity, blank unit, or ambiguous category', () => {
  const groups = reportedFoodGroups([
    { category: 'fruit', quantityPerYear: 10, unit: '', usedByHousehold: null, sold: null, incomeZar: null },
    { category: 'nuts_berries', quantityPerYear: 10, unit: 'kg', usedByHousehold: null, sold: null, incomeZar: null },
    { category: 'staple_crops', quantityPerYear: 10, unit: 'kg', usedByHousehold: null, sold: null, incomeZar: null },
    { category: 'other', name: 'Beans', quantityPerYear: 10, unit: 'kg', usedByHousehold: null, sold: null, incomeZar: null, foodGroup: 'pulses_nuts_seeds' },
  ]);
  assert.deepEqual(groups, ['pulses_nuts_seeds']);
});

test('direct loads repair types and bind the record to the requested site', () => {
  const { local } = installBrowser();
  const requested = 'site:-29.00000,31.00000';
  local.setItem(`imbewu_site_survey_${requested}`, JSON.stringify({
    ...survey(),
    siteId: 'site:another-farm',
    goals: ['food', 'food', null],
    roofMainM2: '100',
    existingGrowingAreaM2: Infinity,
    hasGutters: 'yes',
  }));
  const loaded = loadSurvey(requested);
  assert.ok(loaded);
  assert.equal(loaded.siteId, requested);
  assert.deepEqual(loaded.goals, ['food']);
  assert.equal(loaded.roofMainM2, null);
  assert.equal(loaded.existingGrowingAreaM2, null);
  assert.equal(loaded.hasGutters, false);
});

test('saving stamps, normalises and notifies after the new survey is readable', () => {
  const { target } = installBrowser();
  let observed: SiteSurvey | null = null;
  target.addEventListener('imbewu-surveys-changed', () => {
    observed = loadSurvey('site:-29.00000,31.00000');
  });
  const result = saveSurvey(survey({ goals: [' food ', 'food'] }));
  assert.ok(result);
  assert.ok(observed);
  const saved = observed as SiteSurvey;
  assert.deepEqual(saved.goals, ['food']);
  assert.ok(Number.isFinite(saved.updatedAt));
});

test('invalid site ids do not create orphan survey keys or events', () => {
  const { local, target } = installBrowser();
  let changes = 0;
  target.addEventListener('imbewu-surveys-changed', () => { changes += 1; });
  const invalidIds = [
    '',
    'site:bad',
    'site:-29,31',
    'site:-29.0000,31.00000',
    'site:91.00000,31.00000',
    'site:-29.00000,181.00000',
    'site:-29.00000,31.00000:other',
  ];
  for (const siteId of invalidIds) {
    assert.equal(canonicalSurveySiteId(siteId), null);
    assert.equal(saveSurvey(survey({ siteId })), null);
    assert.equal(loadSurvey(siteId), null);
  }
  assert.equal(changes, 0);
  assert.equal(local.rows.size, 0);
});

test('a failed storage write is not announced or returned as a saved survey', () => {
  const { local, target } = installBrowser();
  let changes = 0;
  target.addEventListener('imbewu-surveys-changed', () => { changes += 1; });
  const input = survey();
  local.failKey = `imbewu_site_survey_${input.siteId}`;

  assert.equal(saveSurvey(input), null);
  assert.equal(loadSurvey(input.siteId), null);
  assert.equal(changes, 0);
});

test('array-shaped storage cannot masquerade as a survey record', () => {
  const { local } = installBrowser();
  const siteId = 'site:-29.00000,31.00000';
  local.setItem(`imbewu_site_survey_${siteId}`, JSON.stringify([survey()]));
  assert.equal(loadSurvey(siteId), null);
});

test('a legacy place-id survey migrates once to its coordinate site key', () => {
  const { local } = installBrowser();
  const siteId = 'site:-29.00000,31.00000';
  local.setItem('permamap_saved_places', JSON.stringify([{
    id: 'farm',
    name: 'Farm',
    lat: -29,
    lon: 31,
    biome: '',
    rainfall: 0,
    elevation: 0,
    savedAt: '2026-01-01T00:00:00.000Z',
  }]));
  local.setItem('imbewu_site_survey_farm', JSON.stringify(survey({ siteId: 'legacy' })));
  const migrated = loadSurvey(siteId);
  assert.ok(migrated);
  assert.equal(migrated.siteId, siteId);
  assert.ok(local.getItem(`imbewu_site_survey_${siteId}`));
});

test('SSR and broken JSON degrade to no survey', () => {
  const { local } = installBrowser();
  local.setItem('imbewu_site_survey_site:bad', '{broken');
  assert.equal(loadSurvey('site:bad'), null);
  Object.defineProperty(globalThis, 'window', { configurable: true, value: undefined });
  assert.equal(loadSurvey('site:any'), null);
  assert.doesNotThrow(() => saveSurvey(survey()));
});


test('a farmer cannot report no water or no crops alongside a selected resource', () => {
  assert.deepEqual(toggleSurveyChoice(['municipal'], 'none'), ['none']);
  assert.deepEqual(toggleSurveyChoice(['none'], 'rainwater'), ['rainwater']);
  assert.deepEqual(toggleSurveyChoice(['municipal'], 'rainwater'), ['municipal', 'rainwater']);
  assert.deepEqual(toggleSurveyChoice(['vegetables'], 'nothing', 'nothing'), ['nothing']);
  assert.deepEqual(toggleSurveyChoice(['nothing'], 'vegetables', 'nothing'), ['vegetables']);
  assert.deepEqual(toggleSurveyChoice(['rainwater'], 'rainwater'), []);
});

test('production review catches missing units and over-allocation without rejecting decimal rounding', () => {
  const row = { category: 'eggs' as const, quantityPerYear: 100, unit: 'eggs', usedByHousehold: 60, sold: 40, incomeZar: null };
  assert.equal(productionNeedsReview(row), false);
  assert.equal(productionNeedsReview({ ...row, sold: 41 }), true);
  assert.equal(productionNeedsReview({ ...row, unit: '' }), true);
  assert.equal(productionNeedsReview({ ...row, incomeZar: -1 }), true);
  assert.equal(productionNeedsReview({ ...row, category: 'other' }), true);
  assert.equal(productionNeedsReview({ ...row, quantityPerYear: .3, usedByHousehold: .1, sold: .2 }), false);
  assert.equal(productionNeedsReview({ ...row, quantityPerYear: null, usedByHousehold: null, sold: null, unit: '', harvestMonths: [1] }), false);
});

test('the site report receives the production the farmer entered, with units and missing figures intact', () => {
  const input = survey({ reportedProduction: [{ category: 'eggs', quantityPerYear: 120, unit: 'eggs', usedByHousehold: 80, sold: 40, incomeZar: null, harvestMonths: [1, 12] }] });
  const prompt = surveyToPrompt(input, 800);
  assert.match(prompt, /eggs — source: reported by the farmer/);
  assert.match(prompt, /Quantity per year: 120 eggs; used by household: 80 eggs; sold: 40 eggs/);
  assert.match(prompt, /income \(not profit\): not recorded/);
  assert.match(prompt, /Harvest months .*: 1, 12/);
  assert.match(prompt, /Unreported months are unknown, not food gaps/);
  assert.match(prompt, /not a dietary intake survey or a nutrition score/);
});

test('an unreported resource remains unknown in the report instead of becoming confirmed absence', () => {
  const prompt = surveyToPrompt(survey({ existingCrops: [], livestock: [], soilAmendments: [], waterStorage: [] }), 800);
  assert.match(prompt, /Crops growing now: not recorded/);
  assert.match(prompt, /Livestock: not recorded/);
  assert.match(prompt, /On-site water storage: not recorded/);
  assert.match(prompt, /Soil amendments applied: not recorded/);
  const explicitNone = surveyToPrompt(survey({ existingCrops: ['nothing'], livestock: ['none'] }), 800);
  assert.match(explicitNone, /Crops growing now: nothing yet/);
  assert.match(explicitNone, /Livestock: none reported/);
});


test('translated adult-count ranges keep the same household key used by water estimates', () => {
  installBrowser();
  const saved = saveSurvey(survey({ adults: '2–5' }));
  assert.equal(saved?.adults, '2-5');
  assert.equal(loadSurvey(saved!.siteId)?.adults, '2-5');
});

function draftInput(overrides: Partial<SiteSurveyDraftInput> = {}): SiteSurveyDraftInput {
  return {
    baseRevision: surveySavedRevision(null), answers: survey({ savedAt: '' }),
    numberInputs: { roofMain: '', roofSecondary: '', existingGrowingArea: '', layingHens: '', productionYear: '' },
    mode: 'full', step: 2, started: true, openProduction: 'other', ...overrides,
  };
}

test('a restarted survey keeps unfinished figures and free rows without publishing report facts', async () => {
  const { target } = installBrowser();
  bindMountedAccountLocalStorageUid('draft-unfinished');
  let published = 0;
  target.addEventListener('imbewu-surveys-changed', () => published++);
  const original = saveSurvey(survey({ notes: 'Last reviewed observation' }));
  assert.ok(original);
  published = 0;
  const input = draftInput({
    baseRevision: surveySavedRevision(original),
    answers: survey({ notes: '  Still writing  ', goals: [], reportedProduction: [{
      category: 'other', name: '', unit: ' ', quantityPerYear: -2,
      usedByHousehold: null, sold: null, incomeZar: null,
    }] }),
    numberInputs: { roofMain: '-3', roofSecondary: '', existingGrowingArea: '1e', layingHens: '', productionYear: '' },
  });
  const first = createSurveyDraftStore(input.answers.siteId)!;
  const written = await first.write(input, null);
  assert.equal(written.status, 'saved');
  const recovered = await createSurveyDraftStore(input.answers.siteId)!.read();
  assert.equal(recovered.unavailable, false);
  assert.deepEqual(recovered.draft?.numberInputs, input.numberInputs);
  assert.equal(recovered.draft?.answers.notes, '  Still writing  ');
  assert.deepEqual(recovered.draft?.answers.goals, []);
  assert.equal(recovered.draft?.answers.reportedProduction?.[0].quantityPerYear, -2);
  assert.equal(recovered.draft?.answers.reportedProduction?.[0].unit, ' ');
  assert.equal(recovered.draft?.answers.reportedProduction?.[0].category, 'other');
  assert.equal(recovered.draft?.mode, 'full');
  assert.equal(recovered.draft?.step, 2);
  assert.equal(recovered.draft?.openProduction, 'other');
  assert.deepEqual(loadSurvey(input.answers.siteId), original);
  assert.equal(published, 0, 'keeping unfinished answers must not announce a report update');
  bindMountedAccountLocalStorageUid(null);
});

test('unfinished answers belong only to their site and mounted account, including delayed old-account writes', async () => {
  installBrowser();
  bindMountedAccountLocalStorageUid('draft-owner-A');
  const input = draftInput();
  const a = createSurveyDraftStore(input.answers.siteId)!;
  assert.equal((await a.write(input, null)).status, 'saved');
  assert.equal((await createSurveyDraftStore('site:-28.00000,31.00000')!.read()).draft, null);
  bindMountedAccountLocalStorageUid('draft-owner-B');
  const b = createSurveyDraftStore(input.answers.siteId)!;
  assert.equal((await b.read()).draft, null);
  assert.equal((await a.write(draftInput({ answers: survey({ notes: 'Late A timer' }) }), null)).status, 'changed');
  assert.equal((await b.write(draftInput({ answers: survey({ notes: 'B observation' }) }), null)).status, 'saved');
  assert.equal((await b.read()).draft?.answers.notes, 'B observation');
  bindMountedAccountLocalStorageUid('draft-owner-A');
  assert.equal((await createSurveyDraftStore(input.answers.siteId)!.read()).draft?.answers.notes, 'Farmer observation');
  bindMountedAccountLocalStorageUid(null);
});

test('competing survey tabs cannot overwrite or discard the draft the other tab just kept', async () => {
  installBrowser(); bindMountedAccountLocalStorageUid('draft-tabs');
  const input = draftInput(), a = createSurveyDraftStore(input.answers.siteId)!, b = createSurveyDraftStore(input.answers.siteId)!;
  const results = await Promise.all([a.write(input, null), b.write(draftInput({ answers: survey({ notes: 'Newer tab' }) }), null)]);
  assert.equal(results.filter(result => result.status === 'saved').length, 1);
  assert.equal(results.filter(result => result.status === 'changed').length, 1);
  const baseline = await a.read();
  assert.ok(baseline.token);
  const newer = await b.write(draftInput({ answers: survey({ notes: 'Newest observation' }) }), baseline.token);
  assert.equal(newer.status, 'saved');
  assert.equal((await a.clear(baseline.token)).status, 'changed');
  assert.equal((await a.write(input, baseline.token)).status, 'changed');
  assert.equal((await b.read()).draft?.answers.notes, 'Newest observation');
  bindMountedAccountLocalStorageUid(null);
});

test('a failed device transaction reports failure and leaves the previous unfinished answers recoverable', async () => {
  installBrowser(); bindMountedAccountLocalStorageUid('draft-storage-failure');
  const input = draftInput(), normal = createSurveyDraftStore(input.answers.siteId)!;
  await normal.write(input, null);
  const previous = await normal.read();
  const aborting: DeviceStore = { ...fieldDeviceStore, change: (key, update) => fieldDeviceStore.change(key, row => {
    update(row); throw Error('Device transaction aborted');
  }) };
  const broken = createSurveyDraftStore(input.answers.siteId, aborting)!;
  assert.equal((await broken.write(draftInput({ answers: survey({ notes: 'Uncommitted' }) }), previous.token)).status, 'unavailable');
  assert.equal((await broken.clear(previous.token)).status, 'unavailable');
  assert.deepEqual(await normal.read(), previous);
  bindMountedAccountLocalStorageUid(null);
});

test('only an explicit successful final save followed by matching cleanup clears this draft', async () => {
  const { local } = installBrowser(); bindMountedAccountLocalStorageUid('draft-final-save');
  const input = draftInput(), client = createSurveyDraftStore(input.answers.siteId)!;
  await client.write(input, null);
  const previous = await client.read();
  local.failKey = activeAccountLocalStorageKey(`imbewu_site_survey_${input.answers.siteId}`);
  assert.equal(saveSurvey(input.answers), null);
  assert.deepEqual(await client.read(), previous);
  local.failKey = null;
  assert.ok(saveSurvey(input.answers));
  assert.equal((await client.clear(previous.token)).status, 'cleared');
  assert.equal((await client.read()).draft, null);
  assert.ok(loadSurvey(input.answers.siteId));
  bindMountedAccountLocalStorageUid(null);
});

test('unreadable future drafts require deliberate discard rather than being silently overwritten', async () => {
  installBrowser(); bindMountedAccountLocalStorageUid('draft-future-version');
  const input = draftInput(), scope = activeAccountLocalStorageKey('imbewu_site_survey_drafts');
  const key = `${scope}|draft|${input.answers.siteId}`;
  const future = { version: 99, answers: { notes: 'Keep future answers' } };
  await fieldDeviceStore.change(key, () => ({ key, scope, kind: 'draft', value: future }));
  const client = createSurveyDraftStore(input.answers.siteId)!;
  const recovered = await client.read();
  assert.equal(recovered.draft, null); assert.ok(recovered.token); assert.equal(recovered.unavailable, false);
  assert.equal((await client.write(input, null)).status, 'changed');
  assert.deepEqual((await fieldDeviceStore.get(key))?.value, future);
  assert.equal((await client.clear(recovered.token)).status, 'cleared');
  bindMountedAccountLocalStorageUid(null);
});

test('sample answers never enter persistent drafts, even when sample mode starts during a pending write', async () => {
  installBrowser(); bindMountedAccountLocalStorageUid(null);
  const input = draftInput(), client = createSurveyDraftStore(input.answers.siteId)!;
  window.sessionStorage.setItem('imbewu_sample_mode', '1');
  assert.equal(createSurveyDraftStore(input.answers.siteId), null);
  assert.equal((await client.write(input, null)).status, 'changed');
  window.sessionStorage.removeItem('imbewu_sample_mode');
  assert.equal((await client.read()).draft, null);
  assert.equal(createSurveyDraftStore('invalid-site'), null);
  Object.defineProperty(globalThis, 'window', { configurable: true, value: undefined });
  assert.equal(createSurveyDraftStore(input.answers.siteId), null);
});

test('reopening unfinished crop and poultry observations retains invalid inputs for review without publishing them', async () => {
  installBrowser(); bindMountedAccountLocalStorageUid('draft-production-observations');
  const input = draftInput({
    answers: survey({
      productionYear: 1899,
      productionConditions: { frost: 'yes', frostMonths: [6, 8], drySeasonWater: 'limited', drainage: 'stays-wet', sunlight: 'part-shade' },
      poultryManagement: { purpose: 'both', recordedBreed: '  Supplier record name  ', layingHens: -2.5, drinkingWater: 'sometimes', feeding: 'mixed-feed', nightProtection: 'partial' },
    }),
    numberInputs: { roofMain: '', roofSecondary: '', existingGrowingArea: '', layingHens: '-2.5', productionYear: '1899' },
  });
  const client = createSurveyDraftStore(input.answers.siteId)!;
  assert.equal((await client.write(input, null)).status, 'saved');
  const resumed = (await createSurveyDraftStore(input.answers.siteId)!.read()).draft;
  assert.ok(resumed);
  assert.deepEqual(resumed.answers.productionConditions, input.answers.productionConditions);
  assert.deepEqual(resumed.numberInputs, input.numberInputs);
  assert.equal(resumed.answers.poultryManagement?.recordedBreed, '  Supplier record name  ');
  assert.equal(resumed.answers.poultryManagement?.purpose, 'both');
  assert.equal(resumed.answers.poultryManagement?.drinkingWater, 'sometimes');
  assert.equal(resumed.answers.poultryManagement?.feeding, 'mixed-feed');
  assert.equal(resumed.answers.poultryManagement?.nightProtection, 'partial');
  assert.equal(loadSurvey(input.answers.siteId), null);
  const reportBoundary = surveyToPrompt(resumed.answers, 800);
  assert.match(reportBoundary, /Hens laying now: not recorded/);
  assert.match(reportBoundary, /Reporting year for these annual production figures: not recorded/);
  bindMountedAccountLocalStorageUid(null);
});

test('an older unfinished survey migrates without inventing new answers or losing its stale-tab protection', async () => {
  installBrowser(); bindMountedAccountLocalStorageUid('draft-schema-migration');
  const input = draftInput();
  const { layingHens: _hens, productionYear: _year, ...olderNumbers } = input.numberInputs;
  const legacy = { ...input, numberInputs: olderNumbers, version: 1, revision: 'older-device-draft', updatedAt: 1 };
  const scope = activeAccountLocalStorageKey('imbewu_site_survey_drafts');
  const key = `${scope}|draft|${input.answers.siteId}`;
  await fieldDeviceStore.change(key, () => ({ key, scope, kind: 'draft', value: legacy }));
  const client = createSurveyDraftStore(input.answers.siteId)!;
  const resumed = await client.read();
  assert.ok(resumed.draft);
  assert.equal(resumed.token, JSON.stringify(legacy));
  assert.deepEqual((await fieldDeviceStore.get(key))?.value, legacy, 'reading cannot rewrite the farmer’s unfinished draft');
  assert.equal(resumed.draft.numberInputs.layingHens, '');
  assert.equal(resumed.draft.numberInputs.productionYear, '');
  assert.equal(resumed.draft.answers.productionConditions, undefined);
  assert.equal(resumed.draft.answers.poultryManagement, undefined);
  assert.equal(resumed.draft.answers.productionYear, undefined);
  const written = await client.write({ ...resumed.draft, answers: { ...resumed.draft.answers, productionConditions: { frost: 'unknown' } } }, resumed.token);
  assert.equal(written.status, 'saved');
  const current = (await fieldDeviceStore.get(key))?.value as { version: number };
  assert.equal(current.version, 2);
  assert.equal((await client.write(input, resumed.token)).status, 'changed');
  assert.equal((await client.clear(resumed.token)).status, 'changed');
  assert.equal((await client.read()).draft?.answers.productionConditions?.frost, 'unknown');
  bindMountedAccountLocalStorageUid(null);
});

test('old surveys do not acquire frost, dependable irrigation, hens or a production year from their save date', () => {
  installBrowser();
  const saved = saveSurvey(survey({ savedAt: `${new Date().getFullYear()}-01-01T00:00:00.000Z` }));
  assert.ok(saved);
  const loaded = loadSurvey(saved.siteId);
  assert.ok(loaded);
  assert.equal(loaded.productionConditions, undefined);
  assert.equal(loaded.poultryManagement, undefined);
  assert.equal(loaded.productionYear, undefined);
  const prompt = surveyToPrompt(loaded, 800);
  assert.match(prompt, /Local frost: not recorded/);
  assert.match(prompt, /Dry-season growing water: not recorded/);
  assert.match(prompt, /Hens laying now: not recorded/);
  assert.match(prompt, /Reporting year for these annual production figures: not recorded/);
  assert.doesNotMatch(prompt, /Hens laying now: 0|Local frost: not observed/);
});

test('saved site observations keep actual frost months and current birds without converting them into forecasts', () => {
  installBrowser();
  const saved = saveSurvey(survey({
    productionYear: new Date().getFullYear() - 1,
    productionConditions: {
      frost: 'yes', frostMonths: [8, 6, 6, 0, 13, 7.5],
      drySeasonWater: 'limited', drainage: 'stays-wet', sunlight: 'part-shade',
    },
    poultryManagement: {
      purpose: 'both', recordedBreed: '  Supplier record name  ', layingHens: 7,
      drinkingWater: 'sometimes', feeding: 'mostly-scavenging', nightProtection: 'partial',
    },
    reportedProduction: [{ category: 'eggs', quantityPerYear: 120, unit: 'eggs', usedByHousehold: 120, sold: 0, incomeZar: null, harvestMonths: [1, 12] }],
  }));
  assert.ok(saved);
  const loaded = loadSurvey(saved.siteId);
  assert.ok(loaded);
  assert.deepEqual(loaded.productionConditions, { frost: 'yes', frostMonths: [6, 8], drySeasonWater: 'limited', drainage: 'stays-wet', sunlight: 'part-shade' });
  assert.deepEqual(loaded.poultryManagement, { purpose: 'both', recordedBreed: 'Supplier record name', layingHens: 7, drinkingWater: 'sometimes', feeding: 'mostly-scavenging', nightProtection: 'partial' });
  assert.equal(loaded.productionYear, new Date().getFullYear() - 1);
  assert.deepEqual(saveSurvey(loaded)?.productionConditions, loaded.productionConditions);
  const prompt = surveyToPrompt(loaded, 800);
  assert.match(prompt, /Months when frost was observed .*: 6, 8/);
  assert.match(prompt, /available, but not enough or not dependable/);
  assert.match(prompt, /Breed or strain recorded by the farmer: Supplier record name/);
  assert.match(prompt, /Hens laying now: 7/);
  assert.match(prompt, /not a promised egg yield/);
  assert.match(prompt, /reported annual eggs remain separate from plan forecasts/);
  assert.match(prompt, /Quantity per year: 120 eggs/);
  assert.deepEqual(loaded.reportedProduction?.[0].harvestMonths, [1, 12]);
  assert.doesNotMatch(prompt, /NaN|Infinity|undefined|\[object Object\]/);
});

test('an explicit zero laying-hen count stays zero, while an unknown count stays unrecorded', () => {
  installBrowser();
  const zero = saveSurvey(survey({ poultryManagement: { layingHens: 0 } }));
  assert.ok(zero);
  assert.equal(loadSurvey(zero.siteId)?.poultryManagement?.layingHens, 0);
  assert.match(surveyToPrompt(zero, 800), /Hens laying now: 0/);
  const blank = saveSurvey(survey({ poultryManagement: { layingHens: null, purpose: 'unknown' } }));
  assert.ok(blank);
  assert.equal(loadSurvey(blank.siteId)?.poultryManagement?.layingHens, undefined);
  assert.match(surveyToPrompt(blank, 800), /Hens laying now: not recorded/);
});

test('malformed production observations cannot claim frost absence, safe water or fractional laying hens', () => {
  installBrowser();
  const malformed = survey({
    productionConditions: { frost: 'false', frostMonths: [6], drySeasonWater: true, drainage: 0, sunlight: 'Sunny' } as unknown as SiteSurvey['productionConditions'],
    poultryManagement: { purpose: 'layer', recordedBreed: {}, layingHens: '7', drinkingWater: true, feeding: ['balanced-feed'], nightProtection: 'safe' } as unknown as SiteSurvey['poultryManagement'],
  });
  const saved = saveSurvey(malformed);
  assert.ok(saved);
  assert.equal(saved.productionConditions, undefined);
  assert.equal(saved.poultryManagement, undefined);
  for (const value of [-1, 1.5, Number.NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    const badCount = saveSurvey(survey({ poultryManagement: { layingHens: value } }));
    assert.ok(badCount);
    assert.equal(badCount.poultryManagement, undefined);
    assert.match(surveyToPrompt(survey({ poultryManagement: { layingHens: value } }), 800), /Hens laying now: not recorded/);
  }
  for (const value of [null, [], 'yes']) {
    const badShape = saveSurvey(survey({ productionConditions: value as SiteSurvey['productionConditions'], poultryManagement: value as SiteSurvey['poultryManagement'] }));
    assert.ok(badShape);
    assert.equal(badShape.productionConditions, undefined);
    assert.equal(badShape.poultryManagement, undefined);
  }
});

test('frost months require observed frost and never turn not-observed into a frost-free promise', () => {
  installBrowser();
  for (const frost of ['no', 'unknown'] as const) {
    const saved = saveSurvey(survey({ productionConditions: { frost, frostMonths: [6, 7] } }));
    assert.ok(saved);
    assert.deepEqual(saved.productionConditions, { frost });
    assert.equal(loadSurvey(saved.siteId)?.productionConditions?.frostMonths, undefined);
    assert.match(surveyToPrompt(saved, 800), /Months when frost was observed .*: not recorded/);
    assert.doesNotMatch(surveyToPrompt(saved, 800), /frost-free|safe to plant/);
  }
});

test('reporting years round-trip independently of survey dates and future or invalid years stay unknown', () => {
  installBrowser();
  const currentYear = new Date().getFullYear();
  for (const year of [1900, currentYear - 1, currentYear]) {
    const saved = saveSurvey(survey({ productionYear: year, savedAt: '2020-01-01T00:00:00.000Z' }));
    assert.ok(saved);
    assert.equal(loadSurvey(saved.siteId)?.productionYear, year);
    assert.match(surveyToPrompt(saved, 800), new RegExp(`Reporting year for these annual production figures: ${year}`));
  }
  for (const year of [1899, currentYear + 1, currentYear + .5, Number.NaN, Infinity, '2020', null]) {
    const saved = saveSurvey(survey({ productionYear: year as number, savedAt: `${currentYear}-01-01T00:00:00.000Z` }));
    assert.ok(saved);
    assert.equal(saved.productionYear, undefined);
    assert.equal(loadSurvey(saved.siteId)?.productionYear, undefined);
    assert.match(surveyToPrompt(saved, 800), /Reporting year for these annual production figures: not recorded/);
  }
});
