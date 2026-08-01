import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  REPORT_SECTION_IDS,
  buildSkeletonReportDoc,
  type ReportDoc,
} from '../lib/report-doc.ts';
import type {
  DesignLayer,
  GeneratedDesignPlan,
} from '../lib/design-studio.ts';
import type { PhasePlan } from '../lib/phasing.ts';
import { BIOMES } from '../lib/biome.ts';
import type { LocationData } from '../lib/types.ts';
import {
  WATER_SHEET_ROOF_RUNOFF_COEFFICIENT,
  roofHarvestLitres,
} from '../lib/roof-runoff.ts';

const CREATED_AT = '2026-07-29T00:00:00.000Z';

function location(overrides: Partial<LocationData> = {}): LocationData {
  return {
    lat: -29,
    lon: 31,
    biome: BIOMES.GRASSLAND,
    rainfall: {
      monthly: Array(12).fill(50),
      annual: 600,
      pattern: 'summer',
      wetSeason: 'Oct–Mar',
      drySeason: 'May–Aug',
    },
    climate: {
      meanTemp: 18,
      maxTemp: 28,
      minTemp: 8,
      monthlyTemp: Array(12).fill(18),
      solarRadiation: 5,
      koppen: 'Cwb',
      koppenDesc: 'Subtropical highland',
      windSpeed: 3,
      windFromSummer: 'NE',
      windFromWinter: 'SW',
    },
    soil: {
      textureClass: 'Loam',
      ph: 6,
      organicCarbon: 2,
      clay: 30,
      sand: 40,
      silt: 30,
      bulkDensity: 1.2,
    },
    elevation: {
      elevation: 1_000,
      slopeDeg: 4,
      slopePct: 7,
      aspectDeg: 0,
      aspectLabel: 'N',
    },
    ...overrides,
  };
}

function layer(
  id: string,
  layerType: DesignLayer['layerType'],
  areaM2: number,
): DesignLayer {
  return {
    id,
    featureId: `feature-${id}`,
    siteId: 'site',
    name: id,
    layerType,
    featureType: 'site',
    geometryType: 'Polygon',
    geometry: {
      type: 'Polygon',
      coordinates: [[[30, -29], [30.01, -29], [30.01, -29.01], [30, -29]]],
    },
    areaM2,
    areaLabel: `${areaM2} m²`,
    source: 'manual_map',
    confidenceScore: 1,
    approved: true,
    locked: false,
    color: '#000000',
    updatedAt: CREATED_AT,
  };
}

function build(
  overrides: {
    location?: LocationData;
    layers?: DesignLayer[];
    plan?: GeneratedDesignPlan | null;
    phasePlan?: PhasePlan;
  } = {},
): ReportDoc {
  const layers = overrides.layers ?? [
    layer('boundary', 'property_boundary', 20_000),
    layer('roof', 'roof', 100),
    layer('garden', 'cultivation', 250),
  ];
  const roofIds = layers.filter((item) => item.approved && item.layerType === 'roof').map((item) => item.id);
  const gardenIds = layers.filter((item) => item.approved && item.layerType === 'cultivation').map((item) => item.id);
  return buildSkeletonReportDoc({
    id: 'report',
    siteId: 'site',
    location: overrides.location ?? location(),
    survey: null,
    layers,
    plan: overrides.plan ?? null,
    phasePlan: overrides.phasePlan ?? {
      phases: [
        {
          n: 1,
          key: 'access_water',
          title: 'Safe Access & Water Spine',
          colour: '#4EA6D8',
          weekRange: 'Weeks 1–2',
          weekStart: 0,
          weekEnd: 2,
          tasks: ['Connect roof gutters to a rainwater tank'],
          holdPoint: 'Hold Point A: water route checked',
          itemIds: roofIds,
        },
        {
          n: 2,
          key: 'beds',
          title: 'Beds, Drip & Working Infra',
          colour: '#7FD46B',
          weekRange: 'Weeks 3–6',
          weekStart: 3,
          weekEnd: 6,
          tasks: ['Expand kitchen-garden beds + drip irrigation'],
          holdPoint: 'Hold Point B: beds ready',
          itemIds: gardenIds,
        },
      ],
      criticalOrder: ['water', 'beds'],
      siteRules: [],
    },
    createdAt: CREATED_AT,
  });
}

function assertFiniteNumbers(value: unknown, path = 'report'): void {
  if (typeof value === 'number') {
    assert.ok(Number.isFinite(value), `${path} must be finite`);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertFiniteNumbers(entry, `${path}[${index}]`));
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, entry] of Object.entries(value)) {
      assertFiniteNumbers(entry, `${path}.${key}`);
    }
  }
}

function assertNoInvalidText(value: unknown, path = 'report'): void {
  if (typeof value === 'string') {
    assert.doesNotMatch(value, /NaN|Infinity/, `${path} must not expose invalid numbers`);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertNoInvalidText(entry, `${path}[${index}]`));
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, entry] of Object.entries(value)) {
      assertNoInvalidText(entry, `${path}.${key}`);
    }
  }
}

test('the local skeleton has one non-empty payload for every promised report section', () => {
  const doc = build();
  assert.equal(REPORT_SECTION_IDS.length, 11);
  assert.deepEqual(doc.sectionsMeta.map((meta) => meta.id), [...REPORT_SECTION_IDS]);
  assert.deepEqual(Object.keys(doc.sections).sort(), [...REPORT_SECTION_IDS].sort());

  for (const id of REPORT_SECTION_IDS) {
    const payload = doc.sections[id];
    assert.ok(payload, `${id} must have a skeleton payload`);
    if (Array.isArray(payload)) {
      assert.ok(payload.length > 0, `${id} must not be an invisible empty array`);
    }
  }
});

test('all eleven skeleton sections actually render, rather than only appearing in nav', () => {
  // Node's native type stripping deliberately does not transpile TSX, so this
  // wiring assertion reads the component source instead of changing the test
  // runner. Each promised section still needs an actual rendered anchor.
  const viewSource = readFileSync(new URL('../components/ReportDocView.tsx', import.meta.url), 'utf8');

  for (const id of REPORT_SECTION_IDS) {
    assert.match(viewSource, new RegExp(`id="sec-${id}"`), `${id} must render a section`);
  }
});

test('area and roof harvest obey their dimensional rules and shared coefficient authority', () => {
  const layers = [
    layer('boundary', 'property_boundary', 20_000),
    layer('roof', 'roof', 100),
  ];
  const doc = build({ layers });
  assert.equal(doc.sections['existing-site']?.sizeHa?.value, layers[0].areaM2 / 10_000);

  const harvest = roofHarvestLitres(
    layers[1].areaM2,
    doc.location.rainfall.annual,
    WATER_SHEET_ROOF_RUNOFF_COEFFICIENT,
  );
  assert.ok(doc.sections.water?.harvestingOpportunities.includes(
    `Roof catchment ~${Math.round(harvest / 1_000).toLocaleString()} kL/yr to tanks.`,
  ));

  const source = readFileSync(new URL('../lib/report-doc.ts', import.meta.url), 'utf8');
  assert.match(source, /from '@\/lib\/roof-runoff'/);
  assert.doesNotMatch(source, /roof\.areaM2\s*\*\s*rainMm\s*\*\s*0\.\d+/);
});

test('site size is claimed only from approved property boundaries', () => {
  const doc = build({
    layers: [
      layer('roof', 'roof', 100),
      layer('garden', 'cultivation', 250),
      layer('trees', 'tree_belt', 500),
    ],
  });

  assert.equal(doc.sections['existing-site']?.sizeHa, undefined);
  assert.doesNotMatch(doc.sections.executive?.farmOverview ?? '', /\bha site\b/);
  assert.ok(
    doc.layerSnapshot.some((snapshot) => snapshot.areaM2 > 0),
    'feature areas remain available without masquerading as farm area',
  );
});

test('all approved roofs and gardens contribute to their derived report facts', () => {
  const firstRoof = layer('roof-one', 'roof', 40);
  const secondRoof = layer('roof-two', 'roof', 60);
  const firstGarden = layer('garden-one', 'cultivation', 80);
  const secondGarden = layer('garden-two', 'cultivation', 120);
  const ignoredRoof = { ...layer('unapproved-roof', 'roof', 900), approved: false };
  const doc = build({
    layers: [
      layer('boundary', 'property_boundary', 10_000),
      firstRoof,
      secondRoof,
      firstGarden,
      secondGarden,
      ignoredRoof,
    ],
  });

  const harvest = roofHarvestLitres(
    firstRoof.areaM2 + secondRoof.areaM2,
    doc.location.rainfall.annual,
    WATER_SHEET_ROOF_RUNOFF_COEFFICIENT,
  );
  assert.ok(doc.sections.water?.harvestingOpportunities.includes(
    `Roof catchment ~${Math.round(harvest / 1_000).toLocaleString()} kL/yr to tanks.`,
  ));
  assert.ok(doc.sections.executive?.topOpportunities.some(
    (text) => text.includes(`${firstGarden.areaM2 + secondGarden.areaM2} m² vegetable garden`),
  ));

  const steps = doc.sections.implementation?.flatMap((phase) => phase.steps) ?? [];
  assert.deepEqual(
    steps.find((step) => step.task.includes('roof gutters'))?.layerIds,
    [firstRoof.id, secondRoof.id],
  );
  assert.deepEqual(
    steps.find((step) => step.task.includes('kitchen-garden beds'))?.layerIds,
    [firstGarden.id, secondGarden.id],
  );
});

test('invalid and impossible numeric inputs never leak NaN or Infinity into report output', () => {
  const invalidLocation = location({
    lat: Number.NaN,
    rainfall: {
      monthly: Array(12).fill(Number.NaN),
      annual: Number.NaN,
      pattern: 'summer',
      wetSeason: '',
      drySeason: '',
    },
    climate: {
      ...location().climate,
      minTemp: Number.NEGATIVE_INFINITY,
      maxTemp: Number.POSITIVE_INFINITY,
    },
    soil: {
      ...location().soil,
      ph: Number.NaN,
      organicCarbon: Number.POSITIVE_INFINITY,
    },
    elevation: {
      ...location().elevation,
      slopeDeg: Number.NaN,
    },
  });
  const doc = build({
    location: invalidLocation,
    layers: [
      layer('boundary', 'property_boundary', Number.POSITIVE_INFINITY),
      layer('roof', 'roof', Number.NaN),
      layer('garden', 'cultivation', Number.NEGATIVE_INFINITY),
    ],
  });

  // `location` remains the untouched source snapshot; farmer-facing derived
  // sections and layer summaries are the presentation copies that must be safe.
  assertFiniteNumbers(doc.sections);
  assertFiniteNumbers(doc.layerSnapshot);
  assertNoInvalidText({ name: doc.name, sections: doc.sections });
});

test('an impossible latitude never invents a hemisphere or sun-facing side', () => {
  for (const lat of [-91, 91, Number.NaN, Number.POSITIVE_INFINITY]) {
    const doc = build({ location: location({ lat }) });
    assert.match(doc.sections.sector?.sun ?? '', /Hemisphere unavailable/);
    assert.doesNotMatch(doc.sections.sector?.sun ?? '', /Northern|Southern/);
  }
});

test('building a report never mutates saved layer or location data', () => {
  const inputLocation = location();
  const layers = [layer('boundary', 'property_boundary', 10_000)];
  const locationBefore = structuredClone(inputLocation);
  const layersBefore = structuredClone(layers);

  build({ location: inputLocation, layers });

  assert.deepEqual(inputLocation, locationBefore);
  assert.deepEqual(layers, layersBefore);
});

test('section metadata is a complete one-to-one map with valid destinations', () => {
  const doc = build();
  const validMaps = new Set(['base', 'water', 'sector', 'zone', 'design', 'implementation']);
  assert.equal(new Set(doc.sectionsMeta.map((meta) => meta.id)).size, REPORT_SECTION_IDS.length);
  for (const meta of doc.sectionsMeta) {
    assert.ok(meta.title.trim());
    assert.ok(validMaps.has(meta.map));
    assert.equal(meta.status, 'skeleton');
  }
});
