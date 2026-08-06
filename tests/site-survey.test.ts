import test from 'node:test';
import assert from 'node:assert/strict';

import {
  canonicalSurveySiteId,
  loadSurvey,
  reportedFoodGroups,
  saveSurvey,
  surveyToPrompt,
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
