import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { buildBillOfQuantities, billOfQuantitiesMarkdown, pricedBoqSubtotal, unpricedRateGapCount } from '../lib/report-boq';
import { buildRiskRegister, riskRegisterMarkdown } from '../lib/report-risk';
import { buildMonitoringPlan } from '../lib/report-monitoring';
import { documentReference } from '../lib/report-cover';
import { groupDigits, type ReportSiteFacts } from '../lib/report-site-facts';
import { PRICE_BOOK } from '../lib/price-book';
import { reportSummaryPages } from '../lib/report-summary';
import { siteReportVisuals } from '../lib/report-visuals';
import { DEMO_LOCATION } from '../lib/demo-site';

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

test('a catalogue tank mirrored by the collector is excluded from new spend only once', () => {
  const facts: ReportSiteFacts = {
    water:{tanks:[{name:'Renamed tank',defId:'jojo_2500',count:3,statedLitres:2500,status:'existing'}],statedStorageLitres:7500,tanksOfUnknownCapacity:0,mapPoints:[],bodies:[]},
    design:{beds:[],bedCount:0,bedAreaM2:0,plotCount:0,plotAreaM2:0,growingAreaM2:0,routes:[],zones:[],elements:[
      {name:'Renamed tank',defId:'jojo_2500',category:'water',count:3,status:'existing'},
      {name:'Existing structure',defId:'chicken_coop',category:'structure',count:2,status:'existing'},
    ]},
  };
  const before=JSON.stringify(facts),boq=buildBillOfQuantities(facts);
  assert.equal(boq.existingCount,5,'the collector mirrors the three tanks; it does not record six physical tanks');
  assert.deepEqual(boq.lines,[]);
  assert.equal(JSON.stringify(facts),before);
  const designOnly=structuredClone(facts);delete designOnly.water;
  assert.equal(buildBillOfQuantities(designOnly).existingCount,5,'a missing water record must not erase known design-only inventory');
  const legacy=structuredClone(facts);delete legacy.water!.tanks[0].defId;delete legacy.design!.elements[0].defId;
  assert.equal(buildBillOfQuantities(legacy).existingCount,8,'same display name alone cannot establish a legacy duplicate');
  const disagreement=structuredClone(facts);disagreement.water!.tanks[0].count=1;
  assert.equal(buildBillOfQuantities(disagreement).existingCount,6,'different recorded counts are not silently reconciled');
  const renamed=structuredClone(facts);renamed.design!.elements[0].name='Another tank';
  assert.equal(buildBillOfQuantities(renamed).existingCount,8,'different labelled groups are not merged by catalogue ID');
  const repeated=structuredClone(facts);repeated.design!.elements.push({...repeated.design!.elements[0]});
  assert.equal(buildBillOfQuantities(repeated).existingCount,8,'one canonical group cannot erase two design groups');
  const unknown=structuredClone(facts);unknown.water!.tanks[0].defId='jojo_unknown';unknown.design!.elements[0].defId='jojo_unknown';
  assert.equal(buildBillOfQuantities(unknown).existingCount,8,'a catalogue-like name does not establish a known producer group');
});

test('a legacy mixed tank retains its recorded count without inventing how many to purchase', () => {
  const facts: ReportSiteFacts = { water: { tanks: [
    {name:'Recorded tank',count:3,statedLitres:2500,status:'mixed'},
  ],statedStorageLitres:7500,tanksOfUnknownCapacity:0,mapPoints:[],bodies:[]} };
  const before=JSON.stringify(facts),boq=buildBillOfQuantities(facts);
  assert.equal(boq.lines.length,1);
  assert.equal(boq.lines[0].quantity,'3 no.','recorded group count remains visible, not a purchase quantity');
  assert.equal(boq.lines[0].unpriced,'mixed-status');
  assert.equal(boq.lines[0].zar,null);
  assert.equal(boq.lines[0].rate,null);
  assert.equal(boq.existingCount,0,'the installed share cannot be guessed');
  assert.equal(boq.unpricedCount,1);
  assert.equal(JSON.stringify(facts),before);
});

test('unknown mixed purchases do not inflate a separate proposed tank or erase existing inventory', () => {
  const facts: ReportSiteFacts = { water: { tanks: [
    {name:'Same tank',count:3,statedLitres:2500,status:'existing'},
    {name:'Same tank',count:2,statedLitres:2500,status:'proposed'},
    {name:'Same tank',count:4,statedLitres:2500,status:'mixed'},
  ],statedStorageLitres:22500,tanksOfUnknownCapacity:0,mapPoints:[],bodies:[]} };
  const before=JSON.stringify(facts),boq=buildBillOfQuantities(facts);
  assert.equal(boq.lines.length,2);
  assert.equal(boq.existingCount,3);
  assert.equal(boq.subtotalZar,2*PRICE_BOOK.tank_2500.zar);
  assert.equal(boq.lines.filter(line=>line.zar!==null).length,1);
  assert.equal(boq.lines.find(line=>line.unpriced==='mixed-status')?.quantity,'4 no.');
  assert.equal(JSON.stringify(facts),before);
});

test('mixed structures need a proposed share too, while duplicate tank and bed groups remain excluded', () => {
  const facts:ReportSiteFacts={design:{beds:[],bedCount:0,bedAreaM2:0,plotCount:0,plotAreaM2:0,growingAreaM2:0,routes:[],zones:[],elements:[
    {name:'Recorded coop',count:2,status:'mixed',category:'animal',defId:'chicken_coop'},
    {name:'Recorded tank',count:2,status:'mixed',category:'water',defId:'jojo_2500'},
    {name:'Recorded bed',count:2,status:'mixed',category:'growing',defId:'veg_bed'},
  ]}};
  const boq=buildBillOfQuantities(facts);
  assert.equal(boq.lines.length,1,'inventory duplicates cannot add unpriced purchase rows');
  assert.equal(boq.lines[0].description,'Recorded coop');
  assert.equal(boq.lines[0].unpriced,'mixed-status');
  assert.equal(boq.lines[0].zar,null);
});

test('withheld purchase quantities stay unknown in full and short reports rather than becoming a zero budget', () => {
  const facts:ReportSiteFacts={water:{tanks:[{name:'Recorded tank',count:1,statedLitres:null,status:'mixed'}],statedStorageLitres:0,tanksOfUnknownCapacity:1,mapPoints:[],bodies:[]}};
  const before=JSON.stringify(facts),boq=buildBillOfQuantities(facts);
  assert.equal(pricedBoqSubtotal(boq),null);
  assert.equal(unpricedRateGapCount(boq),0,'unknown purchase count must not trigger the existing rate-gap risk');
  for(const language of ['en','zu','st','ts','ve']) {
    const md=billOfQuantitiesMarkdown(buildBillOfQuantities(facts,language),language);
    assert.match(md,/No lines priced; build cost not established/);
    assert.match(md,/purchase quantity not established/);
    assert.match(md,/recorded inventory counts, not quantities to buy/);
    assert.doesNotMatch(md,/real figure is higher|R0|R 0/);
    if(language!=='en')assert.match(md,/English; translation pending: purchase quantity/);
    for(const pageCount of [1,5] as const) {
      const pages=reportSummaryPages(facts,DEMO_LOCATION,pageCount,language),text=pages.flatMap(page=>page.lines).join('\n');
      assert.match(text,/recorded inventory counts, not quantities to buy/);
      assert.doesNotMatch(text,/R 0(?:\D|$)/);
    }
    assert.ok(!siteReportVisuals(facts,DEMO_LOCATION,language).charts.some(chart=>chart.id==='cost'),'no empty zero-cost chart');
  }
  assert.equal(JSON.stringify(facts),before);
});

test('mixed holds preserve known priced partials, stated zero and listed-plant safety', () => {
  const facts:ReportSiteFacts={water:{tanks:[
    {name:'Proposed tank',count:1,statedLitres:2500,status:'proposed'},
    {name:'Mixed tank',count:4,statedLitres:2500,status:'mixed'},
  ],statedStorageLitres:12500,tanksOfUnknownCapacity:0,mapPoints:[],bodies:[]}};
  const boq=buildBillOfQuantities(facts),md=billOfQuantitiesMarkdown(boq);
  assert.equal(pricedBoqSubtotal(boq),PRICE_BOOK.tank_2500.zar);
  assert.equal(unpricedRateGapCount(boq),0);
  assert.match(md,/priced subtotal is incomplete/);
  assert.doesNotMatch(md,/real figure is higher/);
  const cost=siteReportVisuals(facts,DEMO_LOCATION).charts.find(chart=>chart.id==='cost')!;
  assert.equal(cost.rows.reduce((sum,row)=>sum+row.value,0),PRICE_BOOK.tank_2500.zar);
  assert.match(cost.note,/not quantities to buy/);
  const zero={...boq,lines:[{...boq.lines[0],zar:0,rate:'R0'}],subtotalZar:0};
  assert.equal(pricedBoqSubtotal(zero),0,'a stated zero differs from no priced lines');
  const listed=structuredClone(FACTS);
  listed.design!.elements=[{name:'Renamed regulated plant',defId:'tree_guava',count:2,status:'mixed',category:'growing'}];
  const line=buildBillOfQuantities(listed).lines.find(row=>row.unpriced==='listed-plant');
  assert.ok(line,'the safety hold is not replaced by a request to quote a mixed group');
  assert.match(billOfQuantitiesMarkdown(buildBillOfQuantities(listed)),/do not buy or propagate/);
});

test('a saved listed plant is counted without becoming a purchase in the site report', () => {
  const facts: ReportSiteFacts = {
    ...FACTS,
    design: {
      ...FACTS.design!,
      elements: [
        { name: 'Renamed orchard tree', category: 'growing', count: 2, status: 'proposed', defId: 'tree_guava' },
        { name: 'Purple granadilla', category: 'growing', count: 1, status: 'proposed', defId: 'tree_other' },
      ],
    },
  };
  const boq = buildBillOfQuantities(facts);
  assert.equal(boq.lines.filter((line) => line.unpriced === 'listed-plant').length, 2);
  assert.equal(boq.lines.filter((line) => line.unpriced === 'listed-plant').reduce((sum, line) => sum + Number.parseInt(line.quantity, 10), 0), 3);
  assert.equal(boq.lines.filter((line) => line.unpriced === 'listed-plant').every((line) => line.zar === null), true);
  const markdown = billOfQuantitiesMarkdown(boq);
  assert.doesNotMatch(markdown, /guava|granadilla/i);
  assert.match(markdown, /do not buy or propagate/i);
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

test('an entirely unpriced bill explains its gaps without referring to a nonexistent subtotal', () => {
  const examples: ReportSiteFacts[] = [
    { water: { tanks: [{ name: 'Unmeasured tank', count: 1, statedLitres: null, status: 'proposed' }],
      statedStorageLitres: 0, tanksOfUnknownCapacity: 1, mapPoints: [], bodies: [] } },
    { water: { tanks: [{ name: 'Small tank', count: 1, statedLitres: 1000, status: 'proposed' }],
      statedStorageLitres: 1000, tanksOfUnknownCapacity: 0, mapPoints: [], bodies: [] } },
    { water: { tanks: [{ name: 'Mixed tank', count: 2, statedLitres: 2500, status: 'mixed' }],
      statedStorageLitres: 5000, tanksOfUnknownCapacity: 0, mapPoints: [], bodies: [] } },
    { design: { beds: [], bedCount: 0, bedAreaM2: 0, plotCount: 0, plotAreaM2: 0,
      growingAreaM2: 0, routes: [], zones: [], elements: [
        { name: 'Greenhouse without a footprint', category: 'structure', count: 1,
          status: 'proposed', defId: 'greenhouse_tunnel' },
      ] } },
  ];
  assert.deepEqual(examples.map(facts => buildBillOfQuantities(facts).lines[0].unpriced),
    ['no-rate', 'out-of-range', 'mixed-status', 'no-area']);
  for (const facts of examples) {
    const before = JSON.stringify(facts);
    for (const language of ['en', 'zu']) {
      const boq = buildBillOfQuantities(facts, language);
      assert.equal(pricedBoqSubtotal(boq), null);
      const md = billOfQuantitiesMarkdown(boq, language);
      assert.match(md, /No lines priced; build cost not established/);
      assert.doesNotMatch(md, /This subtotal|The priced subtotal|Subtotal of the priced lines/);
      assert.doesNotMatch(md, /a measured quantity but no rate|real figure is higher/);
      assert.match(md, /Confirm the missing purchase quantities, measurements or rates shown above/);
      if (language === 'zu') assert.match(md, /English; translation pending: Build cost is unknown/);
    }
    assert.equal(JSON.stringify(facts), before);
  }
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
  // Annual totals do not establish crop-failure likelihood (CSR-15A-F01).
  assert.equal(dry.some((r) => /Dry-season/.test(r.risk)), false);
  // REPORT-SLOPE-EVIDENCE-01: keep the recorded slope, not the retired
  // unsupported High/High soil-loss rating or an instruction to dig earthworks.
  assert.equal(dry.some((r) => /Soil loss|Runoff carries/.test(r.risk)), false);
  const evidence = riskRegisterMarkdown(dry, 'en', 420, 12);
  assert.match(evidence, /Recorded slope estimate: 12°/);
  assert.match(evidence, /Runoff risk has not been assessed/);
  assert.match(evidence, /Erosion risk has not been assessed/);
  assert.ok(dry.some((r) => /bill of quantities/.test(r.risk)), 'unpriced-work row remains');

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

test('a staple plot is measured, never priced at the intensive vegetable-bed rate', () => {
  // Staple plots are field-scale (design-canvas.ts: "a quarter-hectare of mielies"), and
  // veg_bed_per_m2 prices an intensive hand-tended bed. Silently reusing it for a field plot
  // used to turn a 2 500 m² maize/beans/pumpkin field into a R300 000 line — an invented number
  // wearing the costume of a measurement. There is no researched field-crop rate, so it must
  // print unpriced, exactly like any other item the price book has no rate for.
  const withPlot: ReportSiteFacts = {
    design: {
      beds: [], bedCount: 0, bedAreaM2: 0,
      plotCount: 1, plotAreaM2: 2500, growingAreaM2: 2500,
      elements: [], routes: [], zones: [],
    },
  };
  const boq = buildBillOfQuantities(withPlot);
  const plots = boq.lines.find((l) => /Staple plots established/.test(l.description));
  assert.ok(plots);
  assert.equal(plots.zar, null, 'a staple plot must never be priced at the veg-bed rate');
  assert.equal(plots.unpriced, 'no-rate');
  assert.equal(plots.quantity, '2 500 m²');
  assert.equal(boq.subtotalZar, 0);
});

test('growing-area-in-use names only the beds and plots the farm actually has', () => {
  // This baseline used to apply one shared count to the word "bed" alone while "plot" rode along
  // unnumbered: a farm with one staple plot and no beds printed "1 bed and plot" (there is no
  // bed), and a farm with beds and no plots printed "beds and plots" (there are no plots).
  const plotOnly: ReportSiteFacts = {
    design: {
      beds: [], bedCount: 0, bedAreaM2: 0,
      plotCount: 1, plotAreaM2: 40, growingAreaM2: 40,
      elements: [], routes: [], zones: [],
    },
  };
  const plotBaseline = buildMonitoringPlan(plotOnly).find((r) => r.indicator === 'Growing area in use')!.baseline;
  assert.match(plotBaseline, /^40 m² drawn across 1 plot$/);
  assert.doesNotMatch(plotBaseline, /bed/i, 'a farm with no beds must not be told it has one');

  const bedsOnly: ReportSiteFacts = {
    design: {
      beds: [{ label: 'Bed 1', areaM2: 10, kind: 'bed' }, { label: 'Bed 2', areaM2: 10, kind: 'bed' }],
      bedCount: 2, bedAreaM2: 20,
      plotCount: 0, plotAreaM2: 0, growingAreaM2: 20,
      elements: [], routes: [], zones: [],
    },
  };
  const bedsBaseline = buildMonitoringPlan(bedsOnly).find((r) => r.indicator === 'Growing area in use')!.baseline;
  assert.match(bedsBaseline, /^20 m² drawn across 2 beds$/);
  assert.doesNotMatch(bedsBaseline, /plot/i, 'a farm with no plots must not be told it has one');
});

test('a roof with an unrecorded-size tank is not told it has nothing to store water in', () => {
  // storage === 0 used to be read as "no tank", but statedStorageLitres sums only KNOWN
  // capacities — a tank of unrecorded size also sums to 0. That fired "nothing to store it in"
  // in the same register as "tank sizes are not recorded", two rows disagreeing about whether a
  // tank exists.
  const unknownTank: ReportSiteFacts = {
    water: {
      tanks: [{ name: 'Tank', count: 1, statedLitres: null, status: 'existing' }],
      statedStorageLitres: 0,
      tanksOfUnknownCapacity: 1,
      mapPoints: [], bodies: [],
    },
    roof: { areaM2: 80, source: 'Traced by the farmer on the map' },
  };
  const risks = buildRiskRegister({ facts: unknownTank, rainfallMm: 700, slopeDeg: 2, unpricedBoqLines: 0 });
  assert.equal(risks.some((r) => /nothing to store it in/.test(r.risk)), false);
  assert.ok(risks.some((r) => /tank sizes are not recorded/.test(r.risk)));

  // Missing tank records do not prove physical absence or lost runoff; no cost
  // evidence supports the former cheapest-water row (soil/earthworks correction).
  const noTank: ReportSiteFacts = { roof: { areaM2: 80, source: 'Traced by the farmer on the map' } };
  const risks2 = buildRiskRegister({ facts: noTank, rainfallMm: 700, slopeDeg: 2, unpricedBoqLines: 0 });
  assert.equal(risks2.some((r) => /nothing to store it in/.test(r.risk)), false);
  assert.match(riskRegisterMarkdown(risks2, 'en', 700, 2), /Missing map entries do not prove physical absence/);
});

test('the BOQ and Site at a Glance group thousands the same way', () => {
  // Codex's report-document audit, finding 4. One document printed "1,037 m²" in Site at a Glance
  // and "1 037 m²" in the BOQ, from two implementations of the same rule — and the BOQ's copy
  // carried a comment asserting that report-site-facts "carries the same rule and the same
  // reason", which it did not. The remedy is one function, so the assertion here is not on a
  // separator character but on the fact that there is only one place left to change.
  const boqSrc = readFileSync(new URL('../lib/report-boq.ts', import.meta.url), 'utf8');
  assert.ok(
    !/function groupDigits/.test(boqSrc),
    'report-boq defines its own digit grouping again — import it instead',
  );
  assert.ok(/groupDigits/.test(boqSrc) && /from '@\/lib\/report-site-facts'/.test(boqSrc));

  // And the shared one never emits a comma or a no-break space: commas were the other convention,
  // and U+00A0 is dropped by jsPDF's WinAnsi font so "6 000 L" would print as "6000 L".
  const grouped = groupDigits(1234567);
  assert.equal(grouped, '1 234 567');
  assert.ok(!grouped.includes(','), 'comma grouping is back');
  assert.ok(!/ /.test(grouped), 'a no-break space would be dropped by the PDF font');
});
