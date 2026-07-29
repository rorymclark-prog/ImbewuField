import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CROP_PLAN_CHANGED_EVENT,
  loadCropPlan,
  saveCropPlan,
  type CropPlanState,
} from '../lib/crop-plan.ts';
import type { DesignCanvasState } from '../lib/design-canvas.ts';
import type { SiteSurvey } from '../lib/site-survey.ts';
import {
  GUIDED_CHANGED_EVENT,
  GUIDED_MODE_KEY,
  PROGRESS_EVENTS,
  STEP_COPY,
  SURVEY_TOTAL_FIELDS,
  boundaryNearCoords,
  boundaryPointCountNearCoords,
  cropPlanBelongsToCanvas,
  gatherSiteInputs,
  getGuidedState,
  getSiteProgress,
  recordCoachDismissal,
  savedPlaceAtCoords,
  setGuidedState,
  surveyFilledCount,
} from '../lib/site-progress.ts';

class MemoryStorage {
  private rows = new Map<string, string>();
  getItem(key: string) { return this.rows.get(key) ?? null; }
  setItem(key: string, value: string) { this.rows.set(String(key), String(value)); }
  removeItem(key: string) { this.rows.delete(key); }
  clear() { this.rows.clear(); }
  key(index: number) { return [...this.rows.keys()][index] ?? null; }
  get length() { return this.rows.size; }
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
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: session });
  return { target, local, session };
}

function survey(overrides: Partial<SiteSurvey> = {}): SiteSurvey {
  return {
    siteId: 'site:-29.00000,31.00000',
    placeId: 'farm',
    savedAt: '2026-01-01T00:00:00.000Z',
    siteType: 'homestead',
    adults: '2–5',
    goals: ['food'],
    waterSource: ['rainwater'],
    waterDelivery: ['drip'],
    waterStorage: ['none'],
    roofMainM2: 0,
    roofSecondaryM2: null,
    hasGutters: false,
    landPrepMethod: 'none',
    soilCondition: 'unknown',
    soilAmendments: ['none'],
    hasFencing: 'none',
    existingCrops: ['nothing'],
    existingGrowingAreaM2: null,
    livestock: ['none'],
    otherInfra: [],
    farmingPractice: 'experimenting',
    challenges: [],
    isCommercial: false,
    notes: '',
    ...overrides,
  };
}

function canvas(siteId = 'site:-29.00000,31.00000', bedId = 'bed-here'): DesignCanvasState {
  return {
    siteId,
    frame: {
      centerLng: 31,
      centerLat: -29,
      zoom: 18,
      imgW: 960,
      imgH: 640,
      mPerPx: 0.4,
    },
    items: [{ id: bedId, defId: 'veg_bed', x: 0.5, y: 0.5 }],
    zones: [{
      id: 'zone',
      zone: 1,
      points: [[0.1, 0.1], [0.9, 0.1], [0.9, 0.9]],
    }],
    lines: [],
    step: 'review',
    updatedAt: '2026-01-01T00:00:00.000Z',
    rev: 1,
  };
}

function plan(bedId: string): CropPlanState {
  return {
    version: 1,
    plantings: [{ id: 'planting', bedId, cropKey: 'spinach', sowMonth: 1 }],
    updatedAt: 1,
  };
}

test('every answered survey check contributes once, including explicit none/zero answers', () => {
  const complete = survey();
  assert.equal(surveyFilledCount(complete), SURVEY_TOTAL_FIELDS);

  const missing: Array<Partial<SiteSurvey>> = [
    { adults: '' },
    { goals: [] },
    { waterSource: [] },
    { waterStorage: [] },
    { roofMainM2: null },
    { landPrepMethod: '' },
    { soilCondition: '' },
    { hasFencing: '' },
    { existingCrops: [] },
    { farmingPractice: '' },
  ];
  for (const patch of missing) {
    assert.equal(surveyFilledCount(survey(patch)), SURVEY_TOTAL_FIELDS - 1);
  }
  assert.equal(surveyFilledCount(survey({ roofMainM2: Number.NaN })), SURVEY_TOTAL_FIELDS - 1);
  assert.equal(surveyFilledCount(survey({ roofMainM2: -1 })), SURVEY_TOTAL_FIELDS - 1);
});

test('a community survey counts the visible member answer, never the hidden adults answer', () => {
  const community = survey({
    siteType: 'community',
    adults: '',
    memberCount: '20–50',
  });
  assert.equal(surveyFilledCount(community), SURVEY_TOTAL_FIELDS);
  assert.equal(surveyFilledCount({ ...community, memberCount: '' }), SURVEY_TOTAL_FIELDS - 1);
});

test('crop-plan completion belongs only to a planting in this canvas bed', () => {
  const here = canvas();
  assert.equal(cropPlanBelongsToCanvas(here, plan('bed-here')), true);
  assert.equal(cropPlanBelongsToCanvas(here, plan('bed-on-another-farm')), false);
  assert.equal(cropPlanBelongsToCanvas(null, plan('bed-here')), false);
});

test('saving a crop plan emits the progress event after the new data is readable', () => {
  const { target } = installBrowser();
  let observed: CropPlanState | null = null;
  target.addEventListener(CROP_PLAN_CHANGED_EVENT, () => { observed = loadCropPlan(); });

  const saved = plan('bed-here');
  saveCropPlan(saved);

  assert.deepEqual(observed, saved);
  assert.ok(PROGRESS_EVENTS.includes(CROP_PLAN_CHANGED_EVENT));
});

test('boundary progress ignores water and degenerate rings, then reports real unique vertices', () => {
  const { local } = installBrowser();
  local.setItem('imbewu_farm_shapes', JSON.stringify({
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { featureType: 'water' },
        geometry: {
          type: 'Polygon',
          coordinates: [[[31, -29], [31.1, -29], [31, -29.1], [31, -29]]],
        },
      },
      {
        type: 'Feature',
        properties: { featureType: 'site' },
        geometry: {
          type: 'Polygon',
          coordinates: [[[31, -29], [31, -29], [31, -29]]],
        },
      },
      {
        type: 'Feature',
        properties: { featureType: 'site' },
        geometry: {
          type: 'Polygon',
          coordinates: [[[31, -29], [31.01, -29], [31.01, -29.01], [31, -29.01], [31, -29]]],
        },
      },
    ],
  }));

  assert.equal(boundaryPointCountNearCoords({ lat: -29, lon: 31 }), 4);
  assert.equal(boundaryNearCoords({ lat: -29, lon: 31 }), true);
  assert.equal(boundaryNearCoords({ lat: -20, lon: 20 }), false);
});

test('saved-place and boundary scoping reject invalid coordinates', () => {
  const { local } = installBrowser();
  local.setItem('permamap_saved_places', JSON.stringify([{
    id: 'farm',
    name: 'Farm',
    lat: -29,
    lon: 31,
    biome: '',
    rainfall: 0,
    elevation: 0,
    savedAt: '',
  }]));
  assert.equal(savedPlaceAtCoords({ lat: -29, lon: 31 }), true);
  for (const coords of [
    { lat: Number.NaN, lon: 31 },
    { lat: -29, lon: Number.POSITIVE_INFINITY },
    { lat: 91, lon: 31 },
    { lat: -29, lon: 181 },
  ]) {
    assert.equal(savedPlaceAtCoords(coords), false);
    assert.equal(boundaryNearCoords(coords), false);
    assert.deepEqual(gatherSiteInputs(coords), {
      hasSite: false,
      boundaryPointCount: 0,
      surveyFilledFields: 0,
      surveyTotalFields: SURVEY_TOTAL_FIELDS,
      zoneCount: 0,
      elementCount: 0,
      hasCropPlan: false,
    });
  }
});

test('end-to-end progress stays site-scoped and chooses the first genuinely missing step', () => {
  const { local } = installBrowser();
  const coords = { lat: -29, lon: 31 };
  const siteId = 'site:-29.00000,31.00000';
  local.setItem('permamap_saved_places', JSON.stringify([{
    id: 'farm', name: 'Farm', lat: -29, lon: 31, biome: '', rainfall: 0, elevation: 0, savedAt: '',
  }]));
  local.setItem(`imbewu_site_survey_${siteId}`, JSON.stringify(survey()));
  local.setItem(`imbewu_design_canvas_${siteId}`, JSON.stringify(canvas(siteId)));
  local.setItem('imbewu_crop_plan_v1', JSON.stringify(plan('bed-on-another-farm')));

  const beforeBoundary = getSiteProgress(coords);
  assert.equal(beforeBoundary.inputs.hasCropPlan, false);
  assert.equal(beforeBoundary.nextStep, 'boundary');

  local.setItem('imbewu_farm_shapes', JSON.stringify({
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      properties: { featureType: 'site' },
      geometry: { type: 'Polygon', coordinates: [[[31, -29], [31.01, -29], [31, -29.01], [31, -29]]] },
    }],
  }));
  local.setItem('imbewu_crop_plan_v1', JSON.stringify(plan('bed-here')));

  const complete = getSiteProgress(coords);
  assert.equal(complete.inputs.hasCropPlan, true);
  assert.equal(complete.nextStep, null);
  assert.equal(complete.stage, 'planned');
  assert.equal(complete.pct, 100);
  for (const step of complete.score.steps.filter((candidate) => candidate.key !== 'located')) {
    assert.ok(step.key in STEP_COPY);
  }
});

test('guided-state corruption is normalised and defaults are returned as fresh values', () => {
  const { local } = installBrowser();
  const first = getGuidedState();
  first.enabled = false;
  assert.equal(getGuidedState().enabled, true);

  for (const dismissals of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
    local.setItem(GUIDED_MODE_KEY, JSON.stringify({ enabled: true, dismissals, retired: false }));
    assert.equal(getGuidedState().dismissals, 0);
  }
  local.setItem(GUIDED_MODE_KEY, JSON.stringify({ enabled: true, dismissals: 2.9, retired: false }));
  assert.equal(getGuidedState().dismissals, 2);
});

test('guided changes are observable and repeated dismissals eventually retire the coach', () => {
  const { target } = installBrowser();
  let events = 0;
  target.addEventListener(GUIDED_CHANGED_EVENT, () => { events += 1; });

  let previous = 0;
  for (let attempt = 0; attempt < 20 && !getGuidedState().retired; attempt += 1) {
    recordCoachDismissal();
    const current = getGuidedState();
    assert.equal(current.dismissals, previous + 1);
    previous = current.dismissals;
  }
  assert.equal(getGuidedState().retired, true);
  assert.ok(events > 0);

  setGuidedState({ enabled: true, retired: false, dismissals: 0 });
  assert.deepEqual(getGuidedState(), { enabled: true, dismissals: 0, retired: false });
});
