// The report used to be generic BY CONSTRUCTION: its "DESIGN AS DRAWN" gate keyed off an
// `approved` flag nothing in the app ever sets, so every report ever generated printed "no design
// exists" over a finished plan, and its roof calculation used a hardcoded 100 m² roof for every
// farm on Earth. These tests pin the replacement — and, more importantly, they pin ABSENCE:
// a farm with no roof, no tank and no dam must be told so in words, never handed a default.
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  absentWaterBodies,
  assuranceMarkdown,
  buildReportHeaderMarkdown,
  cropPlanPromptBlock,
  designPromptBlock,
  hasDrawnDesign,
  irrigationRowsBlock,
  normaliseReportSiteFacts,
  roofCalcLine,
  waterPromptBlock,
  zonePromptBlock,
  type ReportSiteFacts,
} from '../lib/report-site-facts.ts';
import { collectReportSiteFacts } from '../lib/report-site-facts-collect.ts';
import {
  buildDemoCropPlan,
  buildDemoDesignCanvasState,
  buildDemoSavedPlace,
  buildDemoStorageSeeds,
  buildDemoWaterPoints,
} from '../lib/demo-farm.ts';
import { ASSURANCE_PARAGRAPHS, ASSURANCE_TITLE } from '../lib/plan-assurance.ts';
import { reportPreparation } from '../lib/report-readiness';
import { reportTreeIllustrations, reportChapterGraphics } from '../lib/report-chapter-visuals';
import { siteReportVisuals } from '../lib/report-visuals';
import { DEMO_LOCATION } from '../lib/demo-site';

test('the report checklist does not mistake filenames, a started design or photos for verified tests',()=>{
  const inputs={hasSite:true,boundaryPointCount:3,surveyFilledFields:2,surveyTotalFields:10,zoneCount:1,elementCount:0,hasCropPlan:false};
  const items=reportPreparation(inputs,{
    soil_lab_result:[{id:'old',type:'pdf',name:'soil-results.pdf',takenAt:1}],
    water_lab_result:[{id:'new',type:'pdf',name:'water.pdf',documentId:'doc-1',takenAt:1}],
    site_photos_site_photos:[{id:'photo',type:'photo',dataUrl:'data:image/jpeg;base64,x',takenAt:1}],
  });
  assert.equal(items.find(i=>i.id==='soil')!.hasRecord,false);
  assert.match(items.find(i=>i.id==='water')!.status,/enter key results/);
  assert.match(items.find(i=>i.id==='design')!.status,/started/);
  assert.match(items.find(i=>i.id==='survey')!.status,/2 of 10/);
  assert.equal(items.find(i=>i.id==='crops')!.hasRecord,false);
});
test('chapter graphics use named catalogue trees and typed chart values, never invented results',()=>{
  const names=reportTreeIllustrations('Marula, avocado and wild plum. No other tree is specified.').map(t=>t.name);
  assert.ok(names.includes('Marula'));assert.ok(names.includes('Avocado Tree'));assert.ok(names.includes('Wild Plum'));
  assert.ok(!names.includes('Plum Tree'),'a named wild plum must not add a different plum');
  assert.equal(reportTreeIllustrations('Trees should be surveyed.').length,0);
  const visuals=siteReportVisuals(null,DEMO_LOCATION);
  const chapters=reportChapterGraphics('## Natural Vegetation & Biome\nMarula.\n## Water Harvesting\nAn unmeasured catchment.\n## Soil Strategy\nTest results unavailable.',visuals);
  assert.ok(chapters['Natural Vegetation & Biome'].some(g=>g.trees?.some(t=>t.name==='Marula')));
  assert.ok(chapters['Water Harvesting'].some(g=>g.chart?.id==='rainfall'));
  assert.ok(!chapters['Water Harvesting'].some(g=>g.chart?.id==='water'),'no tank capacity may be guessed from prose');
  assert.ok(chapters['Soil Strategy'].some(g=>g.svg&&g.note.includes('does not describe measured')));
});

// The traced roof and the traced property boundary live in the MAP's shape store, which the
// collector reads through the app's own accessors. Seed the demo's real storage so those two
// figures are exercised for what they are — measurements, not estimates. Module-level, so it is
// installed before any test runs; node:test gives each file its own process.
{
  const store = new Map<string, string>(Object.entries(buildDemoStorageSeeds()));
  (globalThis as unknown as { localStorage: unknown }).localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, String(value)); },
    removeItem: (key: string) => { store.delete(key); },
    clear: () => store.clear(),
    key: (index: number) => [...store.keys()][index] ?? null,
    get length() { return store.size; },
  };
  // The storage readers gate on `typeof window !== 'undefined'` before touching localStorage.
  (globalThis as unknown as { window: unknown }).window = globalThis;
  (globalThis as unknown as { sessionStorage: unknown }).sessionStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  };
}

// The demo farm is the funder-demo surface and the only fixture with a full authored design.
// Nothing here asserts an agronomic claim — every number is geometry the fixture already carries.
function demoFacts(): ReportSiteFacts {
  return collectReportSiteFacts({
    siteId: 'site:-27.72623,31.96304',
    lat: -27.726231,
    lon: 31.963044,
    canvas: buildDemoDesignCanvasState(),
    farmName: buildDemoSavedPlace().name,
    waterPoints: buildDemoWaterPoints(),
    cropPlan: buildDemoCropPlan(),
  });
}

const HEADER_BASE = {
  biomeName: 'Indian Ocean Coastal Belt',
  vegUnit: 'Zululand Lowveld',
  lat: -27.726231,
  lon: 31.963044,
  dateLabel: '05 August 2026',
  rainfallMm: 800,
  wetSeason: 'Oct-Mar',
  drySeason: 'May-Aug',
  soilPh: 6.2,
  soilOrganicCarbon: 1.1,
  soilTexture: 'Sandy clay loam',
  elevationM: 430,
  slopeDeg: 2.1,
  aspectLabel: 'NE',
  hasMapWaterPolygons: false,
} as const;

test('the demo farm collects the geometry it actually drew', () => {
  const facts = demoFacts();
  assert.equal(facts.farmName, 'Ubhejane Creche');
  assert.ok(facts.design);
  // 7 veg beds of 6,6,6,6,6,8,6 m² and 4 traced staple plots of 21 m².
  assert.equal(facts.design.bedCount, 7);
  assert.equal(facts.design.bedAreaM2, 44);
  assert.equal(facts.design.plotCount, 4);
  assert.equal(facts.design.plotAreaM2, 84);
  assert.equal(facts.design.growingAreaM2, 128);
  // Beds are NOT re-listed as generic elements — they have their own rotation-unit list.
  assert.ok(!facts.design.elements.some((group) => /^Bed \d/.test(group.name)));
  const swale = facts.design.routes.find((route) => /swale/i.test(route.label));
  assert.ok(swale);
  assert.equal(swale.totalLengthM, 34);
  assert.deepEqual(facts.design.zones.map((zone) => zone.zone), [1, 2, 3, 5]);
  assert.ok(facts.design.zones.every((zone) => zone.areaM2 > 0));
});

test('storage counts only capacities the catalog actually states', () => {
  const facts = demoFacts();
  assert.ok(facts.water);
  assert.equal(facts.water.statedStorageLitres, 2500);
  assert.equal(facts.water.tanksOfUnknownCapacity, 0);
  assert.equal(facts.water.bodies.length, 0, 'the demo has no dam, pond or borehole');
  assert.deepEqual(facts.water.mapPoints.map((point) => point.name), ['JoJo tank (2500 L)', 'Municipal tap']);
});

test('sowMonth is read one-based, the way every other reader in the codebase reads it', () => {
  // Planting.sowMonth is 1..12 (occupiedMonthsForPlanting rejects anything else, and
  // crop-plan/crop-autosuggest/crop-export-schedule all index MONTHS_SHORT[sowMonth - 1]).
  // Reading it zero-based shifts every date in a farmer-facing document by one month and
  // silently drops December.
  const facts = demoFacts();
  assert.ok(facts.crop);
  assert.equal(facts.crop.plantingCount, buildDemoCropPlan().plantings.length);
  const butternut = facts.crop.crops.find((crop) => /butternut/i.test(crop.name));
  assert.ok(butternut, 'the December sowing must not be dropped');
  assert.deepEqual(butternut.sowMonths, ['Dec']);
  const chard = facts.crop.crops.find((crop) => /chard/i.test(crop.name));
  assert.deepEqual(chard?.sowMonths, ['Apr']);
});

test('the design block states the drawn plan as fact, with its status', () => {
  const block = designPromptBlock(demoFacts());
  assert.match(block, /7 drawn, 44 m²/);
  assert.match(block, /TOTAL DRAWN GROWING AREA: 128 m²/);
  assert.match(block, /Moringa Tree x2/);
  assert.match(block, /Swale \(on-contour earthwork\) 34 m/);
  // The demo's elements carry no status, which means PROPOSED — the report must not present a
  // planned tank as a standing one.
  assert.match(block, /PROPOSED/);
});

test('a farm with no design is told so, not given someone else\'s', () => {
  const block = designPromptBlock({});
  assert.match(block, /No design has been drawn/);
  assert.doesNotMatch(block, /\d+ m²/);
  assert.equal(hasDrawnDesign({}), false);
  assert.equal(hasDrawnDesign(demoFacts()), true);
});

test('the roof calculation never substitutes a roof the farm does not have', () => {
  const withoutRoof = roofCalcLine({}, 800);
  assert.match(withoutRoof, /no roof has been traced or measured/i);
  assert.doesNotMatch(withoutRoof, /100m²|100 m²/, 'the hardcoded 100 m² roof must be gone');
  assert.doesNotMatch(withoutRoof, /L usable\/year/, 'no yield may be computed from a roof that is not there');

  const withRoof = roofCalcLine({ roof: { areaM2: 144, source: 'Traced on the map' } }, 800);
  // 144 m² × 800 mm × 0.8 = 92 160 L.
  assert.match(withRoof, /144 m²/);
  assert.match(withRoof, /92 160 L usable\/year/);
});

test('water absence is stated, and a recorded water body is never denied', () => {
  const denied = absentWaterBodies(demoFacts(), false);
  assert.deepEqual(denied, ['dam', 'pond', 'reservoir', 'borehole', 'well', 'spring', 'river']);

  const withDam: ReportSiteFacts = {
    water: {
      tanks: [],
      statedStorageLitres: 0,
      tanksOfUnknownCapacity: 0,
      mapPoints: [{ name: 'Top dam', category: 'Dam' }],
      bodies: [{ name: 'Top dam', category: 'Dam' }],
    },
  };
  assert.ok(!absentWaterBodies(withDam, false).includes('dam'), 'a mapped dam must not be denied');
  const block = waterPromptBlock(withDam, false);
  assert.match(block, /Top dam/);
  assert.doesNotMatch(block, /no dam/);
});

test('the water block reports the drawn tank the report used to deny', () => {
  const block = waterPromptBlock(demoFacts(), false);
  assert.match(block, /Rainwater tank \(2500 L\) x1/);
  assert.match(block, /2 500 L stated capacity/);
  assert.match(block, /Municipal tap/);
  // A tank on the plan and a tank on the map are very likely one tank, counted once.
  assert.match(block, /most likely the SAME tank\. Count the storage once/);
  assert.match(block, /no dam, no pond/);
});

test('the irrigation table carries the real bed sizes, and says so when there are none', () => {
  const filled = irrigationRowsBlock(demoFacts());
  assert.match(filled, /\| Bed 6 \| 8 m² \|/);
  assert.match(filled, /\| Staple plots \(4\) \| 84 m² \|/);
  assert.match(filled, /Total drawn growing area: 128 m²/);

  const empty = irrigationRowsBlock({});
  assert.match(empty, /no bed has been drawn/);
});

test('zone design describes the rings drawn, and names the ones that are not', () => {
  const block = zonePromptBlock(demoFacts());
  assert.match(block, /Zone 1 — .* \(DRAWN, \d+ m²\)/);
  assert.match(block, /Zone 2 — .*Bed 1/);
  assert.match(block, /Zones 0, 4 are NOT drawn/);

  const none = zonePromptBlock({});
  assert.match(none, /No permaculture zones have been drawn/);
  assert.doesNotMatch(none, /DRAWN/);
});

test('the crop-plan block names the farmer\'s crops and refuses to print a yield', () => {
  const block = cropPlanPromptBlock(demoFacts());
  assert.match(block, new RegExp(`${buildDemoCropPlan().plantings.length} plantings`));
  assert.match(block, /Butternut — sown Dec in Bed \d+/);
  assert.match(block, /Do NOT print a yield or an income figure/);
  assert.equal(cropPlanPromptBlock({}), '');
});

test('the Site at a Glance table names the farm and sources every figure', () => {
  const facts = demoFacts();
  const header = buildReportHeaderMarkdown({ ...HEADER_BASE, facts });
  assert.match(header, /^# Site Report — Ubhejane Creche/);
  assert.match(header, /\| Measure \| Value \| Where it comes from \|/);
  assert.match(header, /\| Growing area drawn \| 128 m² — 7 beds 44 m² \+ 4 staple plots 84 m² \|/);
  assert.match(header, /\| Property boundary \| 1 037 m²/);
  assert.match(header, /\| Roof catchment traced \| 144 m²/);
  assert.match(header, /\| Not on this site \| No dam, no pond/);
  // Every row must declare where it came from — the third column is never blank.
  for (const line of header.split('\n')) {
    if (!line.startsWith('|') || /^\|\s*-+/.test(line) || line.includes('| Measure |')) continue;
    const cells = line.split('|').slice(1, -1);
    assert.equal(cells.length, 3, `row has the wrong shape: ${line}`);
    assert.ok(cells[2].trim().length > 0, `row has no source: ${line}`);
  }
});

test('a bare site still gets a header, and it admits what is missing', () => {
  const header = buildReportHeaderMarkdown({ ...HEADER_BASE, facts: null });
  assert.match(header, /^# Permaculture Site Report/);
  assert.match(header, /\| Property boundary \| Not traced \|/);
  assert.match(header, /\| Roof catchment \| Not traced or measured \|/);
  assert.doesNotMatch(header, /Growing area drawn/);
});

test('untrusted facts are dropped rather than defaulted', () => {
  const dirty = normaliseReportSiteFacts({
    farmName: '   ',
    design: {
      beds: [
        { label: 'Good bed', areaM2: 6, kind: 'bed' },
        { label: 'NaN bed', areaM2: Number.NaN, kind: 'bed' },
        { label: 'Infinite plot', areaM2: Number.POSITIVE_INFINITY, kind: 'plot' },
        { areaM2: 4, kind: 'bed' },
      ],
      elements: [{ name: 'Tank', count: 'lots' }],
      routes: [{ label: 'Swale', count: 1, totalLengthM: 'long' }],
      zones: [{ zone: 9, areaM2: 10 }],
    },
    roof: { areaM2: 144 },
    water: { tanks: [{ name: 'Tank', count: 2, statedLitres: 2500 }] },
  });
  assert.ok(dirty);
  assert.equal(dirty.farmName, undefined, 'a blank name is no name');
  assert.deepEqual(dirty.design?.beds.map((bed) => bed.label), ['Good bed']);
  assert.equal(dirty.design?.bedAreaM2, 6);
  assert.equal(dirty.design?.elements.length, 0);
  assert.equal(dirty.design?.routes.length, 0);
  assert.equal(dirty.design?.zones.length, 0, 'zone 9 does not exist');
  assert.equal(dirty.roof, undefined, 'an area with no stated source is not a fact');
  assert.equal(dirty.water?.statedStorageLitres, 5000, '2 tanks x 2,500 L');
  assert.equal(normaliseReportSiteFacts(null), null);
  assert.equal(normaliseReportSiteFacts('facts'), null);
});

test('a round-trip through the wire preserves every figure', () => {
  const facts = demoFacts();
  const wire = normaliseReportSiteFacts(JSON.parse(JSON.stringify(facts)));
  assert.ok(wire);
  assert.equal(wire.design?.growingAreaM2, facts.design?.growingAreaM2);
  assert.equal(wire.water?.statedStorageLitres, facts.water?.statedStorageLitres);
  assert.equal(wire.boundary?.areaM2, facts.boundary?.areaM2);
  assert.equal(wire.roof?.areaM2, facts.roof?.areaM2);
  assert.equal(wire.crop?.plantingCount, facts.crop?.plantingCount);
});

test('the trust statement travels with the report, verbatim', () => {
  const markdown = assuranceMarkdown();
  assert.match(markdown, new RegExp(`^## ${ASSURANCE_TITLE}`));
  for (const paragraph of ASSURANCE_PARAGRAPHS) {
    assert.ok(markdown.includes(paragraph), 'a trust paragraph was reworded or dropped');
  }
});

test('a one-time starter reaches the report prompt as a one-time sowing, not a month the plan covers every year', () => {
  // The section prompts tell the model the farmer's plan "already covers"
  // these months and to mark them "(already planned)". Merged in unqualified,
  // a first-season bridge sowing reads as a standing annual commitment.
  const plan = buildDemoCropPlan();
  const [first] = plan.plantings;
  const facts = collectReportSiteFacts({
    siteId: 'site:-27.72623,31.96304',
    lat: -27.726231,
    lon: 31.963044,
    canvas: buildDemoDesignCanvasState(),
    farmName: buildDemoSavedPlace().name,
    waterPoints: buildDemoWaterPoints(),
    cropPlan: {
      ...plan,
      plantings: [
        ...plan.plantings,
        { id: 'starter', bedId: first.bedId, cropKey: 'kale', sowMonth: 9, once: '2026-09' },
      ],
    },
  });
  const kale = facts.crop?.crops.find((row) => row.name.toLowerCase().includes('kale'));
  assert.ok(kale, 'the starter crop reached the facts');
  assert.deepEqual(kale.firstSeasonOnlyMonths, ['Sep']);
  const block = cropPlanPromptBlock(facts);
  assert.match(block, /one-time first-season sowing/);
  assert.match(block, /not repeated in later years/);
});

test('a starter month the repeating plan also covers is not called first-season-only', () => {
  const plan = buildDemoCropPlan();
  const [first] = plan.plantings;
  const facts = collectReportSiteFacts({
    siteId: 'site:-27.72623,31.96304',
    lat: -27.726231,
    lon: 31.963044,
    canvas: buildDemoDesignCanvasState(),
    farmName: buildDemoSavedPlace().name,
    waterPoints: buildDemoWaterPoints(),
    cropPlan: {
      ...plan,
      plantings: [
        ...plan.plantings,
        { id: 'recurring-kale', bedId: first.bedId, cropKey: 'kale', sowMonth: 9 },
        { id: 'starter-kale', bedId: first.bedId, cropKey: 'kale', sowMonth: 9, once: '2026-09' },
      ],
    },
  });
  const kale = facts.crop?.crops.find((row) => row.name.toLowerCase().includes('kale'));
  assert.ok(kale);
  assert.deepEqual(kale.firstSeasonOnlyMonths, [], 'the annual plan genuinely covers September every year');
});

test('a site report excludes crop rows from another garden', () => {
  const cropPlan = buildDemoCropPlan();
  cropPlan.plantings.push({ ...cropPlan.plantings[0], id: 'unrelated-row', bedId: 'another-garden-bed', cropKey: 'not-a-site-crop' });
  const facts = collectReportSiteFacts({ siteId: 'site:-27.72623,31.96304', lat: -27.726231, lon: 31.963044, canvas: buildDemoDesignCanvasState(), cropPlan });
  assert.equal(facts.crop?.plantingCount, cropPlan.plantings.length - 1);
  assert.ok(!facts.crop?.crops.some(c => c.name === 'not-a-site-crop'));
});
