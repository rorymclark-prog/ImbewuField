import assert from 'node:assert/strict';
import test from 'node:test';

class MemoryStorage {
  private rows = new Map<string, string>();

  getItem(key: string): string | null {
    return this.rows.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.rows.set(key, value);
  }

  removeItem(key: string): void {
    this.rows.delete(key);
  }
}

const local = new MemoryStorage();
const session = new MemoryStorage();
const browser = new EventTarget() as EventTarget & {
  localStorage: MemoryStorage;
  sessionStorage: MemoryStorage;
};
browser.localStorage = local;
browser.sessionStorage = session;

Object.defineProperty(globalThis, 'window', { configurable: true, value: browser });

const store = await import('../lib/crop-plan-v2-store.ts');
const { CROP_PLAN_V2_VERSION } = await import('../lib/crop-plan-v2.ts');
const { buildBedSections } = await import('../lib/crop-bed-sections.ts');

function plan(siteKey: string, id = `plan-${siteKey}`) {
  const sections = buildBedSections({ bedId: 'bed-1', layoutRevision: 'layout-1', division: 1 })!;
  return {
    version: CROP_PLAN_V2_VERSION,
    id,
    siteKey,
    timezone: 'Africa/Johannesburg',
    anchorDate: { year: 2026, month: 8, day: 1 },
    horizonWeeks: 52,
    layoutFingerprint: 'layout-1',
    rainPattern: 'mild-frost' as const,
    status: 'draft' as const,
    sections,
    cohorts: [{
      id: 'cohort-1',
      cropKey: 'cabbage',
      location: { bedId: 'bed-1', sectionIds: [sections[0].id], layoutRevision: 'layout-1' },
      sowing: {
        method: 'nursery-transplant' as const,
        startsOn: { year: 2026, month: 8, day: 1 },
        transplantOn: { year: 2026, month: 9, day: 1 },
        precision: 'month-derived' as const,
      },
      state: 'proposed' as const,
    }],
    generation: {
      engine: 'v2' as const,
      version: 'foundation',
      generatedAt: 1,
      objective: {
        hardViolations: 0,
        selectedCropPlacements: 1,
        longestFreshFoodGapWeeks: 4,
        idleSectionWeeks: 0,
        cropDiversity: 1,
        operationalTransitions: 1,
        deterministicTieBreak: 'cohort-1',
      },
    },
    createdAt: 1,
    updatedAt: 1,
  };
}

test('a V2 plan is isolated by site and never writes the V1 crop-plan key', () => {
  const first = plan('site-a');
  const second = plan('site-b');

  assert.equal(store.saveCropPlanV2(first), true);
  assert.equal(store.saveCropPlanV2(second), true);
  assert.equal(store.loadCropPlanV2('site-a')?.id, first.id);
  assert.equal(store.loadCropPlanV2('site-b')?.id, second.id);
  assert.equal(local.getItem('imbewu_crop_plan_v1'), null, 'V2 must not overwrite a farmer’s live V1 plan');
  assert.equal(store.loadCropPlanV2(''), null);
});

test('a V2 save event fires only after the same site plan is readable', () => {
  const expected = plan('site-event');
  let valueDuringEvent: string | undefined;
  const listener = () => {
    valueDuringEvent = store.loadCropPlanV2('site-event')?.id;
  };
  browser.addEventListener(store.CROP_PLAN_V2_CHANGED_EVENT, listener);

  assert.equal(store.saveCropPlanV2(expected), true);
  browser.removeEventListener(store.CROP_PLAN_V2_CHANGED_EVENT, listener);
  assert.equal(valueDuringEvent, expected.id);
});

test('a corrupt or wrong-site row is rejected instead of crossing farm boundaries', () => {
  const key = store.cropPlanV2StorageKey('site-safe');
  assert.ok(key);
  local.setItem(key, JSON.stringify(plan('site-other')));
  assert.equal(store.loadCropPlanV2('site-safe'), null);

  local.setItem(key, '{not json');
  assert.equal(store.loadCropPlanV2('site-safe'), null);
});

test('the V2 store refuses a transplant plan whose field date precedes its nursery date', () => {
  const impossible = plan('site-chronology');
  impossible.cohorts[0].sowing.transplantOn = { year: 2026, month: 7, day: 31 };

  assert.equal(store.saveCropPlanV2(impossible), false);
  assert.equal(store.loadCropPlanV2('site-chronology'), null);
});

test('V2 has no production localStorage fallback while sample mode lacks its sandbox', () => {
  session.setItem('imbewu_sample_mode', '1');
  assert.equal(store.saveCropPlanV2(plan('site-sample')), false);
  assert.equal(store.loadCropPlanV2('site-sample'), null);
  session.removeItem('imbewu_sample_mode');
});
