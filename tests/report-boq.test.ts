import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildBillOfQuantities, billOfQuantitiesMarkdown } from '../lib/report-boq';
import { buildRiskRegister } from '../lib/report-risk';
import { buildMonitoringPlan } from '../lib/report-monitoring';
import { documentReference } from '../lib/report-cover';
import type { ReportSiteFacts } from '../lib/report-site-facts';

const FACTS: ReportSiteFacts = {
  farmName: 'Ubhejane Creche',
  design: {
    beds: [{ label: 'Bed 1', areaM2: 10, kind: 'bed' }],
    bedCount: 1,
    bedAreaM2: 10,
    plotCount: 0,
    plotAreaM2: 0,
    growingAreaM2: 10,
    elements: [
      { name: 'Lemon tree', category: 'growing', count: 3, status: 'proposed', defId: 'tree_citrus' },
      { name: 'Greenhouse', category: 'structure', count: 1, status: 'proposed', defId: 'greenhouse_tunnel' },
      { name: 'Playground', category: 'structure', count: 1, status: 'proposed', defId: 'playground' },
      { name: 'Old coop', category: 'animal', count: 2, status: 'existing', defId: 'chicken_coop' },
    ],
    routes: [
      { label: 'Fence', count: 1, totalLengthM: 40, kind: 'fence' },
      { label: 'Bed path', count: 1, totalLengthM: 12, kind: 'bedpath' },
    ],
    zones: [],
  },
  water: {
    tanks: [
      { name: 'JoJo 5000', count: 1, statedLitres: 5000, status: 'proposed' },
      { name: 'Rain barrel', count: 1, statedLitres: 1000, status: 'proposed' },
    ],
    statedStorageLitres: 6000,
    tanksOfUnknownCapacity: 0,
    mapPoints: [],
    bodies: [],
  },
};

test('every priced line is a measured quantity times a price-book rate', () => {
  const boq = buildBillOfQuantities(FACTS);
  const fence = boq.lines.find((l) => l.description === 'Fence');
  assert.ok(fence);
  assert.equal(fence.quantity, '40 m');
  assert.equal(fence.zar, 40 * 250); // fence_per_m
  const trees = boq.lines.find((l) => l.description === 'Lemon tree');
  assert.equal(trees?.zar, 3 * 300); // citrus_tree x3
  const beds = boq.lines.find((l) => /Vegetable beds/.test(l.description));
  assert.equal(beds?.zar, 10 * 120); // veg_bed_per_m2
});

test('a tank below the price book\'s smallest size is unpriced, NOT rounded up', () => {
  const boq = buildBillOfQuantities(FACTS);
  const barrel = boq.lines.find((l) => /Rain barrel/.test(l.description));
  assert.ok(barrel);
  assert.equal(barrel.zar, null, 'a 1 000 L barrel must never be priced at the 2 500 L rate');
  assert.equal(barrel.unpriced, 'out-of-range');
  // It still appears, carrying its measured quantity.
  assert.equal(barrel.quantity, '1 no.');
});

test('an area-rated item with no traced footprint is unpriced, and says why', () => {
  const boq = buildBillOfQuantities(FACTS);
  const greenhouse = boq.lines.find((l) => l.description === 'Greenhouse');
  assert.equal(greenhouse?.zar, null);
  assert.equal(greenhouse?.unpriced, 'no-area');
});

test('an item with no researched rate is listed, never dropped and never zero', () => {
  const boq = buildBillOfQuantities(FACTS);
  const playground = boq.lines.find((l) => l.description === 'Playground');
  assert.ok(playground, 'an unpriceable item must still appear with its quantity');
  assert.equal(playground.zar, null);
  assert.equal(playground.unpriced, 'no-rate');
});

test('existing items are excluded from the bill and counted separately', () => {
  const boq = buildBillOfQuantities(FACTS);
  assert.equal(boq.lines.some((l) => l.description === 'Old coop'), false);
  assert.equal(boq.existingCount, 2);
});

test('the subtotal sums only the priced lines', () => {
  const boq = buildBillOfQuantities(FACTS);
  const manual = boq.lines.reduce((sum, l) => sum + (l.zar ?? 0), 0);
  assert.equal(boq.subtotalZar, manual);
  assert.ok(boq.unpricedCount >= 3);
});

test('the markdown states the subtotal is a floor when lines are unpriced', () => {
  const md = billOfQuantitiesMarkdown(buildBillOfQuantities(FACTS));
  assert.match(md, /## Cost & Bill of Quantities/);
  assert.match(md, /NOT the cost of the build/);
  assert.match(md, /planning estimates/i);
});

test('a farm with nothing drawn gets an honest empty bill, not a zero total', () => {
  const md = billOfQuantitiesMarkdown(buildBillOfQuantities(null));
  assert.match(md, /nothing has been drawn on the plan to measure/);
  assert.doesNotMatch(md, /Subtotal/);
});

test('facts collected before defId shipped produce unpriced lines, not guesses', () => {
  const legacy: ReportSiteFacts = {
    design: {
      beds: [], bedCount: 0, bedAreaM2: 0, plotCount: 0, plotAreaM2: 0, growingAreaM2: 0,
      elements: [{ name: 'Lemon tree', category: 'growing', count: 3, status: 'proposed' }],
      routes: [{ label: 'Fence', count: 1, totalLengthM: 40 }],
      zones: [],
    },
  };
  const boq = buildBillOfQuantities(legacy);
  assert.equal(boq.subtotalZar, 0);
  assert.equal(boq.unpricedCount, 2);
});

test('a bed is billed once — from its area, never also as a counted item', () => {
  // The shape the demo-farm probe produced before the guard existed: the caller handed the BOQ
  // an element list that still contained the beds, and every bed was billed twice.
  const withBedsInElements: ReportSiteFacts = {
    design: {
      beds: [{ label: 'Bed 1', areaM2: 10, kind: 'bed' }],
      bedCount: 1, bedAreaM2: 10, plotCount: 0, plotAreaM2: 0, growingAreaM2: 10,
      elements: [
        { name: 'Bed 1', category: 'growing', count: 1, status: 'proposed', defId: 'veg_bed' },
        { name: 'Herb spiral', category: 'growing', count: 1, status: 'proposed', defId: 'herb_spiral' },
      ],
      routes: [],
      zones: [],
    },
  };
  const boq = buildBillOfQuantities(withBedsInElements);
  assert.equal(boq.lines.filter((l) => /^Bed 1$/.test(l.description)).length, 0);
  assert.equal(boq.lines.some((l) => l.description === 'Herb spiral'), false);
  assert.equal(boq.lines.filter((l) => /Vegetable beds/.test(l.description)).length, 1);
  assert.equal(boq.subtotalZar, 10 * 120);
});

test('monitoring counts trees, not beds, as perennials to check for survival', () => {
  const withBeds: ReportSiteFacts = {
    design: {
      beds: [], bedCount: 0, bedAreaM2: 0, plotCount: 0, plotAreaM2: 0, growingAreaM2: 0,
      elements: [
        { name: 'Bed 1', category: 'growing', count: 1, status: 'proposed', defId: 'veg_bed' },
        { name: 'Mango Tree', category: 'growing', count: 2, status: 'proposed', defId: 'tree_mango' },
      ],
      routes: [], zones: [],
    },
  };
  const baseline = buildMonitoringPlan(withBeds).find((r) => /survival/.test(r.indicator))!.baseline;
  assert.match(baseline, /^2 placed/);
  assert.doesNotMatch(baseline, /Bed 1/);
});

test('risk register only raises what this site\'s data triggers', () => {
  const dry = buildRiskRegister({
    facts: FACTS, rainfallMm: 420, slopeDeg: 12, minTempC: 2,
    soilSource: 'estimate', unpricedBoqLines: 3,
  });
  assert.ok(dry.some((r) => /Dry-season/.test(r.risk)));
  assert.ok(dry.some((r) => /Soil loss/.test(r.risk)));
  // Each rating prints the threshold that produced it.
  assert.match(dry.find((r) => /Dry-season/.test(r.risk))!.trigger, /500 mm/);

  const wet = buildRiskRegister({
    facts: FACTS, rainfallMm: 900, slopeDeg: 1, minTempC: 14,
    soilSource: 'lab', unpricedBoqLines: 0,
  });
  assert.equal(wet.some((r) => /Dry-season/.test(r.risk)), false);
  assert.equal(wet.some((r) => /Soil loss/.test(r.risk)), false);
  // ids stay sequential whichever rules fired
  assert.deepEqual(wet.map((r) => r.id), wet.map((_, i) => `R${i + 1}`));
});

test('monitoring baselines are only printed where the plan knows them', () => {
  const known = buildMonitoringPlan(FACTS);
  assert.match(known.find((r) => /Stored water/.test(r.indicator))!.baseline, /6 000 L/);
  const unknown = buildMonitoringPlan(null);
  assert.match(unknown.find((r) => /Stored water/.test(r.indicator))!.baseline, /No tank capacity/);
});

test('document reference is stable and derived from the site name and date', () => {
  assert.equal(
    documentReference({ farmName: 'Ubhejane Creche', isoDate: '2026-08-05T10:00:00Z' }),
    'IF-SR-20260805-UC',
  );
  assert.equal(documentReference({ farmName: null, isoDate: '2026-08-05' }), 'IF-SR-20260805-SITE');
});
