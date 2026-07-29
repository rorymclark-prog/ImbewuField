import test from 'node:test';
import assert from 'node:assert/strict';

import {
  loadSurvey,
  saveSurvey,
  surveyToPrompt,
  type SiteSurvey,
} from '../lib/site-survey.ts';

class MemoryStorage {
  rows = new Map<string, string>();
  getItem(key: string) { return this.rows.get(key) ?? null; }
  setItem(key: string, value: string) { this.rows.set(String(key), String(value)); }
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
  saveSurvey(survey({ goals: [' food ', 'food'] }));
  assert.ok(observed);
  const saved = observed as SiteSurvey;
  assert.deepEqual(saved.goals, ['food']);
  assert.ok(Number.isFinite(saved.updatedAt));
});

test('invalid site ids do not create orphan survey keys or events', () => {
  const { local, target } = installBrowser();
  let changes = 0;
  target.addEventListener('imbewu-surveys-changed', () => { changes += 1; });
  saveSurvey(survey({ siteId: '' }));
  assert.equal(changes, 0);
  assert.equal(local.rows.size, 0);
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
