import type { FeatureCollection, Polygon } from 'geojson';
import type { CropPlanState, DatedKgHarvestTarget, DatedPackHarvestTarget } from './crop-plan';
import type { Profile, ProductionLog, SalesLog } from './db/types';
import { computeCanvasFrame, type DesignCanvasState } from './design-canvas';
import { designSiteIdFromLocation, type DesignLayer } from './design-studio';
import type { FacilitatorDesignState } from './facilitator-design';
import type { JournalEntry } from './field-journal';
import type { SellerLetterhead } from './invoice-seller';
import type { SavedPlace } from './saved-places';
import type { GrowerInput, GrowerPlanningProfile } from './international/grower-planning';
import type { GrowerWorkflowDraft } from './international/grower-workflow';

// The town point matches the fictional Green Horizon entry in /samples/gardens.
// The plot, beds, crop dates and records are an exercise with no surveyed site.
export const GREEN_HORIZON_SITE = Object.freeze({
  name: 'Green Horizon Market Garden', lat: -29.61, lon: 30.39,
});
const DATE = '2026-11-02';
const TIMESTAMP = DATE + 'T08:00:00.000Z';
const RECORD_TIME = Date.parse(TIMESTAMP);
const PROFILE_ID = 'green-horizon-demo-farmer';
const PLACE_ID = 'green-horizon-demo-place';
const BEDS = [
  { id: 'green-horizon-bed-a1', name: 'A1 · Salad greens', cropKey: 'lettuce', xM: 6 },
  { id: 'green-horizon-bed-a2', name: 'A2 · Roots', cropKey: 'carrots', xM: 10 },
  { id: 'green-horizon-bed-b1', name: 'B1 · Leafy greens', cropKey: 'swiss-chard', xM: 14 },
] as const;
const BED_LENGTH = 16;
const BED_WIDTH = 1.2;
const BED_TOP = 5;

const PRACTICE_BUYER = 'Weekly veg boxes (practice)';
const PRACTICE_PROFILE_ID = 'green-horizon-practice-lettuce-estimate';
const CHARD_PROFILE_ID = 'green-horizon-practice-chard-estimate';

export function buildGreenHorizonLettuceTarget(): DatedKgHarvestTarget {
  return {
    id: 'green-horizon-practice-lettuce-target',
    siteId: designSiteIdFromLocation(GREEN_HORIZON_SITE),
    cropKey: 'lettuce',
    outlet: PRACTICE_BUYER,
    weeklyKg: 8,
    marketablePercent: 80,
    timing: 'date-window',
    window: { start: DATE, endExclusive: '2026-11-09' },
  };
}

export function buildGreenHorizonChardTarget(): DatedPackHarvestTarget {
  return {
    id: 'green-horizon-practice-chard-target',
    siteId: designSiteIdFromLocation(GREEN_HORIZON_SITE),
    cropKey: 'swiss-chard',
    outlet: 'Market stall (practice)',
    weeklyQuantity: 12,
    unit: 'bunches',
    // Fictional pack weight keeps the whole-cycle capacity review saveable
    // while the separately entered weekly order still has a known gap.
    kgPerUnit: 0.25,
    marketablePercent: 80,
    timing: 'date-window',
    window: { start: '2026-11-09', endExclusive: '2026-11-30' },
    weeklyPlan: [
      { unit: 'bunches', start: '2026-11-09', endExclusive: '2026-11-16', quantity: 12 },
      { unit: 'bunches', start: '2026-11-16', endExclusive: '2026-11-23', quantity: 0 },
    ],
  };
}

/** These are fictional exercise inputs, with no authority for a real site. */
function buildGreenHorizonLettuceEstimate(siteId: string): GrowerPlanningProfile {
  const estimate = <T, U extends string>(value: T, unit: U): GrowerInput<T, U> => ({
    state: 'provided', value, unit, provenance: {
      kind: 'grower-estimate', recordedAt: TIMESTAMP, note: 'Fictional Green Horizon exercise input.',
    },
  });
  return {
    version: 1, profileId: PRACTICE_PROFILE_ID, cropKey: 'lettuce', scope: { kind: 'mapped-site', siteId },
    inputs: {
      plantsPerM2: estimate(10, 'plants/m2'), yieldKgPerM2: estimate(0.6, 'kg/m2/cycle'),
      establishment: estimate('direct', 'method'), nurseryDays: { state: 'missing', reason: 'not-applicable' },
      fieldEntryToFirstHarvestDays: estimate(32, 'days'), pickingDays: estimate(3, 'days'),
      fieldOccupancyDays: estimate(36, 'days'), turnaroundDays: estimate(4, 'days'),
      allowedEntryMonths: estimate([10], 'utc-months'),
    },
  };
}

export function buildGreenHorizonPlanningDraft(): GrowerWorkflowDraft {
  return {
    planningStart: '2026-10-01', planningEndExclusive: '2026-12-01', maxAssessments: '1000',
    targetProfiles: [{ targetId: buildGreenHorizonLettuceTarget().id, profileId: PRACTICE_PROFILE_ID }],
    available: [{ bedId: BEDS[0].id, start: '2026-10-01', endExclusive: '2026-11-10', confirmed: false }],
    assumptionsConfirmed: false,
  };
}

/** Alternate practice review. Existing lettuce-only instructions still use
 * their one-cycle draft; the weekly example also lets a grower try B1. */
export function buildGreenHorizonWeeklyPracticeDraft(): GrowerWorkflowDraft {
  const lettuce = buildGreenHorizonPlanningDraft();
  return {
    ...lettuce,
    targetProfiles: [...lettuce.targetProfiles, { targetId: buildGreenHorizonChardTarget().id, profileId: CHARD_PROFILE_ID }],
    available: [...lettuce.available, { bedId: BEDS[2].id, start: '2026-10-08', endExclusive: '2026-11-30', confirmed: false }],
  };
}

function samplePoint(xM: number, yM: number): [number, number] {
  const metresPerDegree = 111_320;
  return [
    GREEN_HORIZON_SITE.lon + (xM - 15) / (metresPerDegree * Math.cos(GREEN_HORIZON_SITE.lat * Math.PI / 180)),
    GREEN_HORIZON_SITE.lat - (yM - 15) / metresPerDegree,
  ];
}

export function buildGreenHorizonSavedPlace(): SavedPlace {
  return {
    ...GREEN_HORIZON_SITE, id: PLACE_ID, label: 'field',
    biome: 'Fictional plot', elevation: null, savedAt: TIMESTAMP,
    notes: 'Pietermaritzburg town marker. All field geometry and records are fictional.',
  };
}

export function buildGreenHorizonProfile(): Profile {
  return {
    id: PROFILE_ID, full_name: 'Green Horizon demo grower', role: 'farmer', org_id: null,
    language: 'en', id_number: null, phone: null, photo_url: null, created_at: TIMESTAMP,
    farm_name: GREEN_HORIZON_SITE.name, farm_logo: null, showOnMap: false,
    bio: 'Fictional market-garden example in Pietermaritzburg.',
  };
}

export function buildGreenHorizonLetterhead(): SellerLetterhead {
  return {
    address: 'Fictional example · Pietermaritzburg, KwaZulu-Natal',
    email: '', taxNumber: '', bankName: '', bankAccountName: '', bankAccountNumber: '',
    bankBranchCode: '', paymentTermsDays: null, notes: 'Practice document only. Do not pay.',
  };
}

export function buildGreenHorizonCropPlan(): CropPlanState {
  const target = buildGreenHorizonLettuceTarget();
  const chard = buildGreenHorizonChardTarget();
  const lettuceEstimate = buildGreenHorizonLettuceEstimate(target.siteId);
  // The chard profile starts with the same fictional practice estimates so
  // the example isolates staggered timing. They are not crop recommendations.
  const chardEstimate = { ...lettuceEstimate, profileId: CHARD_PROFILE_ID, cropKey: chard.cropKey };
  return {
    version: 1, updatedAt: RECORD_TIME,
    // Synthetic partial handover linked to the existing 4 kg practice sale.
    harvestTargets: [{ ...target, fulfilment: [{
      kind: 'delivery', sourceId: 'green-horizon-example-sale',
      sourceFingerprint: '013929bf6ff43d6e949a3b1605d7e20d8a6c13ea75d636b4b214eb6820bb420b',
      start: target.window.start, endExclusive: target.window.endExclusive, on: DATE, unit: 'kg', quantity: 3,
    }] }, chard],
    growerPlanningProfiles: [lettuceEstimate, chardEstimate],
    // A1 and B1 are available for practice review. Only A2 starts with a
    // saved month-only entry, so its picking and clearing dates stay unknown.
    plantings: [{ id: `${BEDS[1].id}-planting`, bedId: BEDS[1].id, cropKey: BEDS[1].cropKey, sowMonth: 10 }],
  };
}

export function buildGreenHorizonFacilitatorState(): FacilitatorDesignState {
  return {
    version: 1, geomVersion: 2, pxPerM: 5, activeLayer: 'planting', hiddenLayers: [],
    title: GREEN_HORIZON_SITE.name, bgSite: { ...GREEN_HORIZON_SITE }, savedAt: RECORD_TIME,
    items: BEDS.map(bed => ({
      id: bed.id, type: 'bed', label: bed.name, x: 0, y: 0,
      xM: bed.xM, yM: BED_TOP, wM: BED_WIDTH, hM: BED_LENGTH, rotation: 0, layer: 'planting',
    })),
    lines: [], sectors: [],
  };
}

export function buildGreenHorizonRecords(): { sales: SalesLog[]; production: ProductionLog[] } {
  return {
    production: [{
      id: 'green-horizon-example-harvest', profile_id: PROFILE_ID, garden_id: null,
      crop: 'Lettuce', kg: 6, photo_url: null, logged_at: TIMESTAMP, created_at: TIMESTAMP,
    }],
    sales: [{
      id: 'green-horizon-example-sale', profile_id: PROFILE_ID, garden_id: null,
      crop: 'Lettuce', kg: 4, amount: 100, buyer: PRACTICE_BUYER,
      sold_at: TIMESTAMP, created_at: TIMESTAMP,
    }],
  };
}

export function buildGreenHorizonStorageSeeds(): Record<string, string> {
  const siteId = designSiteIdFromLocation(GREEN_HORIZON_SITE);
  const geometry: Polygon = {
    type: 'Polygon',
    coordinates: [[samplePoint(0, 0), samplePoint(0, 30), samplePoint(30, 30), samplePoint(30, 0), samplePoint(0, 0)]],
  };
  const boundaryId = 'green-horizon-example-boundary';
  const boundaryName = 'Green Horizon example boundary';
  const shapes: FeatureCollection = {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature', id: boundaryId, geometry,
      properties: { featureType: 'site', siteId, name: boundaryName, hatchIdx: 0 },
    }],
  };
  const layer: DesignLayer = {
    id: boundaryId, featureId: boundaryId, siteId, name: boundaryName, layerType: 'property_boundary',
    featureType: 'site', geometryType: geometry.type, geometry, areaM2: 900, areaLabel: '900 m²',
    source: 'manual_map', confidenceScore: 0, approved: false, locked: false,
    color: '#54824e', updatedAt: TIMESTAMP,
  };
  const { frame, project } = computeCanvasFrame([layer], GREEN_HORIZON_SITE.lat, GREEN_HORIZON_SITE.lon);
  const canvas: DesignCanvasState = {
    siteId, frame, baseMode: 'blank', blankMPerPx: frame.mPerPx,
    items: BEDS.map(bed => {
      const [x, y] = project(samplePoint(bed.xM + BED_WIDTH / 2, BED_TOP + BED_LENGTH / 2));
      return {
        id: bed.id, defId: 'veg_bed', label: bed.name, x, y,
        wM: BED_WIDTH, hM: BED_LENGTH, rot: 0,
      };
    }),
    zones: [], lines: [], step: 'review', updatedAt: TIMESTAMP, rev: 1,
  };
  const journal: JournalEntry[] = [{
    id: 'green-horizon-example-journal', title: 'First lettuce pick', date: DATE,
    category: 'harvest', bedId: BEDS[0].id, bedLabel: BEDS[0].name, cropName: 'Lettuce',
    notes: 'Practice record: harvested 6 kg from A1 and set 4 kg aside for weekly veg boxes.',
    createdAt: RECORD_TIME, updatedAt: RECORD_TIME,
  }];
  return {
    imbewu_farm_shapes: JSON.stringify(shapes),
    permamap_saved_places: JSON.stringify([buildGreenHorizonSavedPlace()]),
    [`imbewu_design_canvas_${siteId}`]: JSON.stringify(canvas),
    imbewu_field_journal_v1: JSON.stringify(journal),
    imbewu_map_tips_seen: '1',
    permamap_onboarded: '1',
  };
}
