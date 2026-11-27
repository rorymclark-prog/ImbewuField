import type { FeatureCollection, Polygon } from 'geojson';
import type { CropPlanState } from './crop-plan';
import type { Profile, ProductionLog, SalesLog } from './db/types';
import { computeCanvasFrame, type DesignCanvasState } from './design-canvas';
import { designSiteIdFromLocation, type DesignLayer } from './design-studio';
import type { FacilitatorDesignState } from './facilitator-design';
import type { JournalEntry } from './field-journal';
import type { SellerLetterhead } from './invoice-seller';
import type { SavedPlace } from './saved-places';

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
  return {
    version: 1, updatedAt: RECORD_TIME,
    plantings: BEDS.map(bed => ({
      id: `${bed.id}-planting`, bedId: bed.id, cropKey: bed.cropKey, sowMonth: 10,
    })),
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
      crop: 'Lettuce', kg: 4, amount: 100, buyer: 'Weekly veg boxes (practice)',
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
