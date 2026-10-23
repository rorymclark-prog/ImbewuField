import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildProductionAvailabilityGraphs, buildProductionKgGraphs,
  isVisibleProductionFoodSource,
  type PreservedFoodRecord, type PrintFoodEntry,
} from '../lib/crop-export-availability.ts';
import type { ResolvedAvailability } from '../lib/crop-export-pdf.ts';
import { buildFieldUtilizationByMonth, totalGrowingAreaM2, estimatedYieldKgAdjusted, planningMaturityMonths, TRANSPLANT_ENTRY_PLANNED_MONTHS, type Planting, type PlanBed } from '../lib/crop-plan.ts';

import { cropByKey } from '../lib/crop-catalog.ts';
import { PERENNIAL_HARVEST } from '../lib/perennial-harvest.ts';
import { sanitiseProductionRecords, sanitisePreservedFoodRecords, type DatedProductionRecord } from '../lib/production-records.ts';

type Band = ResolvedAvailability['bands'][number];
const entry = (iconKey: string, label = iconKey): PrintFoodEntry => ({ iconKey, label });
const date = { year: 2027, month: 1 };
const band = (key: Band['key'], cells: PrintFoodEntry[][], extras: Partial<Band> = {}): Band => ({
  key, title: key, sub: '', rgb: [0, 0, 0], cells: cells.map(row => row.map(e => ({ ...e, code: 'Fo' }))), ...extras,
});
const availability = (bands: Band[], utilization = [0]): ResolvedAvailability => ({ yearMode: 'fromToday', bands, utilization });
const record = (sourceIconKey: string, method: PreservedFoodRecord['method'] = 'frozen', dates = [date]): PreservedFoodRecord => ({
  id: `${sourceIconKey}-${method}`, label: `Example ${method} food`, sourceIconKey, method, dates,
  provenance: 'fictional-example', note: 'Invented stock months, not a safe shelf life or a quantity.',
});

test('fresh food counts dated crop and product kinds while references, housing and undated inventory stay separate', () => {
  const reference = { ...entry('tree:persea-americana'), planning: { label: 'Regional reference', months: [1], basis: 'source reference' }, code: 'Av' };
  const graph = buildProductionAvailabilityGraphs({
    availability: availability([
      band('fresh', [[entry('crop:tomatoes'), entry('crop:tomatoes')]]),
      band('staples', [[entry('crop:maize')]]),
      band('forest', [[entry('tree:musa-acuminata-aaa-group'), reference]], {
        planningCells: [[reference, reference]],
        undated: [{ ...entry('tree:mangifera-indica'), code: 'Ma' }],
      }),
      band('animals', [[entry('animal:chicken-layer'), entry('housing:chicken'), entry('animal:sheep-wool')]]),
    ]), dates: [date], growingAreaM2: 0,
  });
  assert.equal(graph.months[0].freshCount, 4, 'two beds of the same crop are one food kind');
  assert.equal(graph.months[0].referenceCount, 1, 'a reference-only avocado is visible but not food counted as ready');
  assert.equal(graph.months[0].totalCount, 4);
  assert.deepEqual(graph.months[0].fresh.map(e => e.iconKey), [
    'crop:tomatoes', 'crop:maize', 'tree:musa-acuminata-aaa-group', 'animal:chicken-layer',
  ]);
});

test('fresh, pantry-stored and differently preserved forms never multiply the same harvest into extra food kinds', () => {
  const graph = buildProductionAvailabilityGraphs({
    availability: availability([
      band('fresh', [[entry('crop:tomatoes')]]),
      band('stored', [[entry('crop:tomatoes'), entry('crop:onions')]]),
      band('staples-stored', [[entry('crop:maize'), entry('crop:maize')]]),
    ]), dates: [date], growingAreaM2: 0,
    preservedProducts: [record('crop:tomatoes'), record('crop:maize', 'dried'),
      record('crop:cabbage', 'fermented'), record('crop:cabbage', 'frozen'), record('housing:chicken')],
  });
  const m = graph.months[0];
  assert.deepEqual(m.stored.map(e => e.iconKey), ['crop:onions', 'crop:maize']);
  assert.deepEqual(m.preserved.map(e => e.sourceIconKey), ['crop:cabbage']);
  assert.deepEqual([m.freshCount, m.storedCount, m.preservedCount, m.keptCount, m.totalCount], [1, 2, 1, 3, 4]);
  assert.deepEqual(m.preservedCounts, { frozen: 0, dried: 0, fermented: 1, processed: 0, stored: 0 });
});

test('a preservation record applies only to its exact recorded year and months across the December boundary', () => {
  const dates = [{ year: 2026, month: 12 }, { year: 2027, month: 1 }, { year: 2027, month: 2 }, { year: 2028, month: 1 }];
  const graph = buildProductionAvailabilityGraphs({
    availability: availability([]), dates, growingAreaM2: 0,
    preservedProducts: [record('crop:green-beans', 'frozen', dates.slice(0, 2))],
  });
  assert.deepEqual(graph.months.map(m => m.preservedCount), [1, 1, 0, 0],
    'a frozen example must not acquire a shelf life, extend into February, or recur next January');
  assert.deepEqual(graph.months.map(m => ({ year: m.year, month: m.month })), dates);
});

test('missing preservation records remain unknown rather than creating frozen, dried or fermented food automatically', () => {
  const input = { availability: availability([band('forest', [[entry('tree:carica-papaya')]])]), dates: [date], growingAreaM2: 0 };
  const missing = buildProductionAvailabilityGraphs(input);
  const explicitEmpty = buildProductionAvailabilityGraphs({ ...input, preservedProducts: [] });
  assert.equal(missing.preservationRecordsProvided, false);
  assert.equal(explicitEmpty.preservationRecordsProvided, true);
  assert.deepEqual(missing.months[0].preserved, []);
  assert.equal(missing.months[0].keptCount, 0);
  assert.equal(missing.months[0].totalCount, 1, 'fruit suitability for processing cannot supply stock or future food');
});

test('method counts describe the same deduplicated preserved options and retain each record provenance', () => {
  const records = [record('crop:green-beans'), record('tree:musa-acuminata-aaa-group', 'dried'),
    record('crop:cabbage', 'fermented'), { ...record('crop:tomatoes', 'processed'), provenance: 'farm-record' as const }];
  const graph = buildProductionAvailabilityGraphs({ availability: availability([]), dates: [date], growingAreaM2: 0, preservedProducts: records });
  assert.deepEqual(graph.months[0].preservedCounts, { frozen: 1, dried: 1, fermented: 1, processed: 1, stored: 0 });
  assert.equal(graph.months[0].keptCount, 4);
  assert.deepEqual(graph.months[0].preserved.map(r => r.provenance), records.map(r => r.provenance));
  assert.ok(graph.months[0].preserved.every(r => r.note === records.find(original => original.id === r.id)!.note));
});

test('used and free square metres come from the existing bed utilization and never include pantry storage space', () => {
  const beds: PlanBed[] = [{ id: 'a', label: 'Example bed', kind: 'bed', areaM2: 20 },
    { id: 'b', label: 'Example plot', kind: 'plot', areaM2: 80 }];
  const plantings = [{ id: 'sowing', bedId: 'b', cropKey: 'maize', sowMonth: 11 }];
  const dates = Array.from({ length: 12 }, (_, i) => ({ year: 2026 + Math.floor((10 + i) / 12), month: (10 + i) % 12 + 1 }));
  const utilization = buildFieldUtilizationByMonth(plantings, beds, 11, 12);
  const graph = buildProductionAvailabilityGraphs({ availability: availability([], utilization), dates, growingAreaM2: totalGrowingAreaM2(beds) });
  assert.equal(graph.growingAreaM2, 100);
  graph.months.forEach((month, i) => {
    assert.equal(month.utilization, utilization[i]);
    assert.equal(month.growingUsedM2, utilization[i] * 100);
    assert.equal(month.growingUsedM2 + month.growingFreeM2, 100);
  });
  assert.ok(graph.months.some(m => m.growingUsedM2 === 0), 'an off-field storage tail must not keep a maize plot occupied');
});

test('a physical-space graph caps overbooked input at its growing-area denominator and cannot print nonfinite space', () => {
  const dates = [date, { year: 2027, month: 2 }, { year: 2027, month: 3 }];
  const graph = buildProductionAvailabilityGraphs({ availability: availability([], [0.25, 1.5, -0.1]), dates, growingAreaM2: 80 });
  assert.deepEqual(graph.months.map(m => [m.utilization, m.growingUsedM2, m.growingFreeM2]), [[0.25, 20, 60], [1, 80, 0], [0, 0, 80]]);
  assert.throws(() => buildProductionAvailabilityGraphs({ availability: availability([], [Number.NaN]), dates: [date], growingAreaM2: 80 }), /utilization must be finite/);
  assert.throws(() => buildProductionAvailabilityGraphs({ availability: availability([]), dates: [date], growingAreaM2: Number.POSITIVE_INFINITY }), /Growing area must be/);
});

test('graph construction preserves the existing availability and explicit preservation records', () => {
  const input = { availability: availability([band('fresh', [[entry('crop:tomatoes')]])], [0.5]), dates: [date], growingAreaM2: 20,
    preservedProducts: [record('crop:cabbage', 'fermented')] };
  const before = structuredClone(input);
  const graph = buildProductionAvailabilityGraphs(input);
  assert.deepEqual(input, before);
  graph.months[0].fresh[0].label = 'Changed output only';
  graph.months[0].preserved[0].dates[0].month = 2;
  assert.deepEqual(input, before, 'a chart must not rewrite a farmer record or the source calendar');
});

// Quantities in these fixtures are explicit synthetic farm records, never farm recommendations.
const now = new Date(2026, 10, 1);
const graphDates = (start: Date, months: number) => Array.from({ length: months }, (_, i) => ({
  year: start.getFullYear() + Math.floor((start.getMonth() + i) / 12), month: (start.getMonth() + i) % 12 + 1,
}));
const production = (sourceIconKey: string, quantity: number, unit: DatedProductionRecord['unit'] = 'kg', status: DatedProductionRecord['status'] = 'actual', stamp = date): DatedProductionRecord => ({
  id: `${sourceIconKey}:${stamp.year}-${stamp.month}:${status}`, sourceIconKey, label: sourceIconKey,
  date: stamp, quantity, unit, status, provenance: 'farm-record',
});
const kgInput = (dates = [date]) => ({ availability: availability([]), dates, growingAreaM2: 0, now, plantings: [] as Planting[], beds: [] as PlanBed[] });

test('saving a monthly production correction replaces its prior source/date/status without doubling it and preserves explicit zero prices', () => {
  const initial = { ...production('crop:tomatoes', 8, 'kg', 'expected'), pricePerUnit: 0 };
  const correction = { ...initial, id: 'corrected', quantity: 0, label: '  Tomatoes  ', note: 'n'.repeat(2500) };
  const actual = production('crop:tomatoes', 0.4);
  const invalid = [
    { ...actual, date: { year: 2027, month: 13 } }, { ...actual, quantity: -1 },
    { ...actual, quantity: NaN }, { ...actual, unit: 'tonnes' }, { ...actual, pricePerUnit: Infinity },
    { ...actual, pricePerUnit: -1 }, { ...actual, provenance: 'guess' }, { ...actual, sourceIconKey: 'housing:chicken' },
  ];
  const rows = sanitiseProductionRecords([initial, correction, actual, ...invalid]);
  assert.equal(rows.length, 2, 'a single corrected expected total and a distinct actual observation survive');
  assert.deepEqual(rows.map(r => [r.status, r.quantity]), [['expected', 0], ['actual', 0.4]]);
  assert.equal(rows[0].pricePerUnit, 0);
  assert.equal(rows[0].label, 'Tomatoes');
  assert.equal(rows[0].note!.length, 2000);
  rows[0].date.month = 2;
  assert.equal(initial.date.month, 1, 'saving or graphing a record must not rewrite the farmer input');
  assert.deepEqual(sanitiseProductionRecords({}), []);
});

test('stock validation keeps nuts stored with exact-date kg, discards invalid amounts and never carries a quantity to another month', () => {
  const nuts = { ...record('tree:macadamia-integrifolia', 'stored', [date, { year: 2027, month: 2 }]),
    quantities: [{ ...date, kg: 2 }, { ...date, kg: 0 }, { year: 2027, month: 2, kg: -1 },
      { year: 2028, month: 1, kg: 9 }, { year: 2027, month: 13, kg: 5 }] };
  const result = sanitisePreservedFoodRecords([nuts, { ...nuts, id: 'bad', method: 'canned-with-guessed-life' }]);
  assert.equal(result.length, 1);
  assert.equal(result[0].method, 'stored');
  assert.deepEqual(result[0].quantities, [{ ...date, kg: 0 }], 'the corrected zero is exact January stock, with February still unquantified');
  assert.equal(result[0].provenance, 'fictional-example');
  assert.equal(result[0].note, nuts.note);
  assert.deepEqual(sanitisePreservedFoodRecords(null), []);
});

test('monthly production uses exact farm dates, actual replaces expected, and eggs or litres cannot become kilograms', () => {
  const dates = [date, { year: 2027, month: 2 }, { year: 2028, month: 1 }];
  const records = [production('crop:tomatoes', 10, 'kg', 'expected'), production('crop:tomatoes', 0.4),
    production('animal:chicken-layer', 12, 'eggs'), production('animal:goat-dairy', 3, 'litres'),
    production('tree:carica-papaya', 2, 'items'), production('crop:green-beans', 2, 'kg', 'expected')];
  const graph = buildProductionKgGraphs({ ...kgInput(dates),
    availability: availability([band('fresh', [[entry('crop:tomatoes'), entry('crop:green-beans')], [], []]),
      band('animals', [[entry('animal:chicken-layer'), entry('animal:goat-dairy')], [], []]),
      band('forest', [[entry('tree:carica-papaya')], [], []])]), productionRecords: records,
  });
  assert.equal(graph.months[0].recordedKg, 2.4);
  assert.equal(graph.months[0].actualKg, 0.4);
  assert.equal(graph.months[0].expectedKg, 2);
  assert.deepEqual(graph.months[0].nativeUnits, { kg: 2.4, litres: 3, eggs: 12, items: 2 });
  assert.equal(graph.months[0].records.length, 5, 'the expected tomatoes do not get added to the observed tomatoes');
  assert.deepEqual(graph.months[0].recordedKgMissingSources, [], 'quantified native units need an explanation, not a false missing-kg warning');
  assert.deepEqual(graph.months.slice(1).map(m => m.recordedKg), [null, null], 'records do not extend or recur next January');
  assert.deepEqual(graph.months[0].nativeUnitSources.map(r => r.unit), ['eggs', 'litres', 'items']);
});

test('an explicit zero kg month differs from absent data and regional references do not fill either amount', () => {
  const reference = { ...entry('tree:persea-americana'), planning: { label: 'Reference', months: [1], basis: 'source reference' }, code: 'Av' };
  const input = { ...kgInput(), availability: availability([band('forest', [[reference]], { planningCells: [[reference]] }),
    band('animals', [[entry('animal:chicken-layer'), entry('animal:goat-dairy')]])]) };
  const missing = buildProductionKgGraphs(input);
  assert.equal(missing.months[0].recordedKg, null);
  assert.equal(missing.productionRecordsProvided, false);
  assert.deepEqual(missing.months[0].recordedKgMissingSources.map(r => r.iconKey), ['tree:persea-americana']);
  assert.equal(missing.months[0].unrecordedSources.length, 3, 'unknown egg/litre production still requires its native quantity');
  assert.equal(missing.months[0].planningReferenceSources.length, 1);
  const observedZero = buildProductionKgGraphs({ ...input, productionRecords: [production('tree:persea-americana', 0)] });
  assert.equal(observedZero.months[0].recordedKg, 0);
  assert.equal(observedZero.months[0].actualKg, 0);
  assert.equal(observedZero.productionRecordsProvided, true);
});

test('corrupt crop/tree keys, housing, covers and wool cannot add food or recorded kg to graphs', () => {
  const keys = ['crop:made-up-yield', 'tree:not-a-species', 'housing:chicken', 'animal:sheep-wool', 'crop:sunn-hemp'];
  const a = availability([band('fresh', [keys.map(key => entry(key))])]);
  const counts = buildProductionAvailabilityGraphs({ availability: a, dates: [date], growingAreaM2: 0 });
  assert.equal(counts.months[0].totalCount, 0);
  const kilos = buildProductionKgGraphs({ ...kgInput(), availability: a, productionRecords: keys.map(key => production(key, 100)) });
  assert.equal(kilos.months[0].recordedKg, null);
  assert.equal(kilos.months[0].records.length, 0);
  assert.equal(kilos.recordIssues.length, 1);
  const apple = buildProductionAvailabilityGraphs({ availability: availability([band('forest', [[entry('tree:malus-domestica')]])]), dates: [date], growingAreaM2: 0 });
  assert.equal(apple.months[0].freshCount, 1, 'an identified food species need not have a harvest dossier to retain an explicit farm observation');
});

test('a sourced food-use hold excludes real mapped plants and historical records from every food and kg channel without deleting those records', () => {
  const ids = ['lycium-ferocissimum', 'ficus-cordata', 'barringtonia-racemosa', 'momordica-balsamina', 'citrullus-lanatus-landrace-var-citroides'];
  const keys = ids.map(id => `tree:${id}`);
  for (const id of ids) {
    assert.equal(PERENNIAL_HARVEST[id]?.householdFoodStatus, 'specialist-review', `${id}: the real sourced dossier must reach the runtime gate`);
    assert.equal(isVisibleProductionFoodSource(`tree:${id}`, {}), false, `${id}: new food-record choices must share the graph gate`);
  }
  const historicalProduction = keys.map(key => production(key, 100));
  const historicalStock = keys.map(key => ({ ...record(key, 'stored'), quantities: [{ ...date, kg: 100 }] }));
  const before = JSON.stringify({ historicalProduction, historicalStock });
  const reference = { label: 'Source reference', months: [date.month], basis: 'Synthetic gate probe' };
  const a = availability([
    band('forest', [[...keys.map(key => entry(key)), entry('tree:malus-domestica')]], {
      planningCells: [keys.map(key => ({ ...entry(key), planning: reference, code: 'He' }))],
      undated: keys.map(key => ({ ...entry(key), code: 'He' })),
    }),
    band('stored', [keys.map(key => entry(key))]),
  ]);
  const input = { ...kgInput(), availability: a, productionRecords: historicalProduction, preservedProducts: historicalStock };
  const foods = buildProductionAvailabilityGraphs(input).months[0];
  assert.deepEqual(foods.fresh.map(item => item.iconKey), ['tree:malus-domestica']);
  assert.equal(foods.totalCount, 1);
  assert.equal(foods.referenceCount, 0);
  assert.deepEqual(foods.stored, []);
  assert.deepEqual(foods.preserved, []);
  const kg = buildProductionKgGraphs(input);
  assert.equal(kg.months[0].recordedKg, null);
  assert.equal(kg.months[0].stockKg, null);
  assert.deepEqual(kg.months[0].records, []);
  assert.deepEqual(kg.months[0].stockRecords, []);
  assert.deepEqual(kg.months[0].planningReferenceSources, []);
  assert.deepEqual(kg.undatedSources, []);
  assert.ok(kg.recordIssues.some(issue => /non-food production/.test(issue)));
  assert.ok(kg.recordIssues.some(issue => /non-food stock/.test(issue)));
  assert.equal(JSON.stringify({ historicalProduction, historicalStock }), before, 'source review must leave saved records available to inspect or remove');
});

test('a whole sourced vegetable cycle belongs to first-pick grouping and is never split across the picking window or into actual monthly kg', () => {
  const beds: PlanBed[] = [{ id: 'bed', label: 'Tomato bed', areaM2: 20 }];
  const plantings: Planting[] = [{ id: 'tomatoes-once', bedId: 'bed', cropKey: 'tomatoes', sowMonth: 11, once: '2026-11' }];
  const dates = graphDates(now, 24);
  const crop = cropByKey('tomatoes')!;
  const offset = planningMaturityMonths(crop.daysToHarvest) + TRANSPLANT_ENTRY_PLANNED_MONTHS;
  assert.ok((crop.harvestWindowMonths ?? 0) > 0, 'this regression needs a genuine multi-month picking window');
  const graph = buildProductionKgGraphs({ ...kgInput(dates), plantings, beds, growingAreaM2: 20 });
  const expected = estimatedYieldKgAdjusted(plantings[0], 20, plantings);
  assert.equal(graph.months[offset].cropCycleKgStartingHarvest, expected);
  assert.equal(graph.months[offset].cropCycles[0].kg, expected);
  assert.deepEqual(graph.months[offset].cropCycles[0].firstPick, dates[offset]);
  assert.deepEqual(graph.months[offset].cropCycles[0].lastPick, dates[offset + crop.harvestWindowMonths!]);
  assert.equal(graph.months.filter(m => m.cropCycleKgStartingHarvest !== null).length, 1, 'the dated one-off neither spreads nor repeats');
  assert.ok(graph.months.every(m => m.recordedKg === null), 'a source benchmark supplies no actual or expected monthly farm record');
});

test('future one-off cycles keep their saved year and recurring cycles alone repeat at the same dated first pick', () => {
  const beds: PlanBed[] = [{ id: 'once', label: 'Once', areaM2: 20 }, { id: 'repeat', label: 'Repeat', areaM2: 20 }];
  const plantings: Planting[] = [{ id: 'future', bedId: 'once', cropKey: 'carrots', sowMonth: 12, once: '2028-12' },
    { id: 'annual', bedId: 'repeat', cropKey: 'carrots', sowMonth: 12 }];
  const dates = graphDates(now, 42);
  const graph = buildProductionKgGraphs({ ...kgInput(dates), plantings, beds, growingAreaM2: 40 });
  const future = graph.months.flatMap(m => m.cropCycles).filter(c => c.plantingId === 'future');
  assert.equal(future.length, 1);
  assert.equal(future[0].firstPick.year, 2029);
  assert.equal(graph.months.flatMap(m => m.cropCycles).filter(c => c.plantingId === 'annual').length, 4);
  const invalid = buildProductionKgGraphs({ ...kgInput(dates), beds, plantings: [{ ...plantings[0], once: '2028-13' }] });
  assert.ok(invalid.months.every(m => m.cropCycles.length === 0));
  assert.deepEqual(invalid.unquantifiedCropSources.map(r => r.iconKey), ['crop:carrots']);
});

test('a whole crop cycle is withheld when its ground overlaps across December, even if first picking falls later', () => {
  const beds: PlanBed[] = [{ id: 'bed', label: 'Crowded bed', areaM2: 20 }];
  const plantings: Planting[] = [{ id: 'maize', bedId: 'bed', cropKey: 'maize', sowMonth: 11, once: '2026-11' },
    { id: 'carrots', bedId: 'bed', cropKey: 'carrots', sowMonth: 12, once: '2026-12' }];
  const graph = buildProductionKgGraphs({ ...kgInput(graphDates(now, 18)), plantings, beds, growingAreaM2: 20 });
  const cycles = graph.months.flatMap(m => m.cropCycles);
  assert.equal(cycles.length, 2);
  assert.ok(cycles.every(c => c.kg === null && /Crowded bed/.test(c.missingReason!)));
  assert.ok(graph.months.every(m => m.cropCycleKgStartingHarvest === null));
  assert.equal(graph.unquantifiedCropSources.length, 2, 'a conflict is unresolved coverage, not 0 kg food');
});

test('unsourced crop yield and carry-in pickings remain unknown rather than gaining a zero or a second whole cycle', () => {
  const bed: PlanBed = { id: 'bed', label: 'Observed bed', areaM2: 20 };
  const unknown = buildProductionKgGraphs({ ...kgInput(graphDates(now, 24)), beds: [bed], plantings: [{ id: 'amadumbe', bedId: 'bed', cropKey: 'amadumbe', sowMonth: 11, once: '2026-11' }] });
  const cycle = unknown.months.flatMap(m => m.cropCycles)[0];
  assert.equal(cycle.kg, null);
  assert.match(cycle.missingReason!, /No sourced/);
  assert.ok(unknown.months.some(m => m.cropCycleMissingSources.some(e => e.iconKey === 'crop:amadumbe')));
  const chard = cropByKey('swiss-chard')!;
  assert.ok(chard.harvestWindowMonths! > 0);
  const first = 2026 * 12 + planningMaturityMonths(chard.daysToHarvest);
  const carryNow = new Date(Math.floor((first + 1) / 12), (first + 1) % 12, 1);
  const carry = buildProductionKgGraphs({ ...kgInput(graphDates(carryNow, 12)), now: carryNow, beds: [bed],
    plantings: [{ id: 'chard', bedId: 'bed', cropKey: 'swiss-chard', sowMonth: 1, existing: true, confirmedOnceSowing: '2026-01' }] });
  assert.ok(carry.months.every(m => m.cropCycleKgStartingHarvest === null));
  assert.deepEqual(carry.unquantifiedCropSources.map(e => e.iconKey), ['crop:swiss-chard']);
});

test('annual age-based tree kg stays outside monthly bars and unknown later yield does not inherit a mature rate', () => {
  const group = { harvest: PERENNIAL_HARVEST['persea-americana'], existing: 1, proposed: 1 };
  const graph = buildProductionKgGraphs({ ...kgInput(graphDates(now, 36)), treeGroups: [group], treeSeasons: {
    'persea-americana': { months: [1], bearing: true, production: [
      { status: 'existing', plants: 1, planted: '2016-11', yields: [{ age: 10, kg: 0.4 }] },
      { status: 'proposed', plants: 1, planted: '2026-11', yields: [] },
    ] },
  } });
  assert.deepEqual(graph.annualTreeEstimates[0].knownKg, [0.4, 0.4]);
  assert.deepEqual(graph.annualTreeEstimates[2].knownKg, [0.4, 0.4], 'only the older entered rate is a known subtotal');
  assert.equal(graph.annualTreeEstimates[2].partial, true, 'young trees cannot gain kg just by reaching a research first-crop age');
  assert.ok(graph.months.every(m => m.recordedKg === null && m.cropCycleKgStartingHarvest === null));
});

test('measured stored batches add their kg while food kind counts deduplicate, and unknown batches keep the stock subtotal partial', () => {
  const fresh = availability([band('fresh', [[entry('tree:mangifera-indica')]])]);
  const stocks: PreservedFoodRecord[] = [
    { ...record('tree:mangifera-indica', 'dried'), id: 'mango-batch-a', quantities: [{ ...date, kg: 2 }] },
    { ...record('tree:mangifera-indica', 'frozen'), id: 'mango-batch-b', quantities: [{ ...date, kg: 3 }] },
    { ...record('tree:mangifera-indica', 'processed'), id: 'unknown-mango-batch' },
    { ...record('tree:macadamia-integrifolia', 'stored'), quantities: [{ ...date, kg: 0.4 }] },
  ];
  const input = { ...kgInput(), availability: fresh, preservedProducts: stocks };
  const graph = buildProductionKgGraphs(input);
  assert.equal(graph.months[0].stockKg, 5.4);
  assert.equal(graph.months[0].stockKgPartial, true);
  assert.deepEqual(graph.months[0].stockKgMissingSources.map(s => s.iconKey), ['tree:mangifera-indica']);
  assert.equal(graph.months[0].recordedKg, null, 'stored food is not another harvest');
  const counts = buildProductionAvailabilityGraphs(input);
  assert.equal(counts.months[0].totalCount, 2, 'fresh and three kept mango batches are still one mango food kind');
  const dried = buildProductionKgGraphs({ ...input, preservedMethods: ['dried'] });
  assert.equal(dried.months[0].stockKg, 2);
  assert.equal(dried.months[0].stockKgPartial, false);
  assert.equal(dried.months[0].stockRecords.length, 1);
});

test('Stored filter removes both catalogue pantry bands and stored-nut records without removing fresh food', () => {
  const input = { ...kgInput(), availability: availability([band('fresh', [[entry('crop:tomatoes')]]),
    band('stored', [[entry('crop:onions')]]), band('staples-stored', [[entry('crop:maize')]])]),
    preservedProducts: [{ ...record('tree:macadamia-integrifolia', 'stored'), quantities: [{ ...date, kg: 2 }] }, record('tree:mangifera-indica', 'dried')] };
  const all = buildProductionAvailabilityGraphs(input);
  assert.equal(all.months[0].storedCount, 2);
  assert.equal(all.months[0].preservedCounts.stored, 1);
  const filtered = buildProductionAvailabilityGraphs({ ...input, preservedMethods: ['dried'] });
  assert.deepEqual([filtered.months[0].freshCount, filtered.months[0].storedCount, filtered.months[0].preservedCount], [1, 0, 1]);
  const kilos = buildProductionKgGraphs({ ...input, preservedMethods: ['dried'] });
  assert.equal(kilos.months[0].stockKg, null);
  assert.deepEqual(kilos.months[0].stockKgMissingSources.map(e => e.iconKey), ['tree:mangifera-indica']);
  const none = buildProductionAvailabilityGraphs({ ...input, preservedMethods: [] });
  assert.equal(none.months[0].keptCount, 0);
  assert.equal(none.months[0].freshCount, 1);
});

test('stock kg is exact dated even when availability months continue, and graph outputs cannot mutate quantities on the saved input', () => {
  const dates = [date, { year: 2027, month: 2 }, { year: 2028, month: 1 }];
  const input = { ...kgInput(dates), productionRecords: [production('crop:tomatoes', 0)], preservedProducts: [
    { ...record('tree:macadamia-integrifolia', 'stored', dates.slice(0, 2)), quantities: [{ ...date, kg: 4 }] },
  ] };
  const before = structuredClone(input);
  const graph = buildProductionKgGraphs(input);
  assert.deepEqual(graph.months.map(m => m.stockKg), [4, null, null]);
  assert.deepEqual(graph.months.map(m => m.stockKgPartial), [false, true, false]);
  assert.deepEqual(graph.months.map(m => m.recordedKg), [0, null, null]);
  graph.months[0].records[0].date.month = 2;
  graph.months[0].stockRecords[0].quantities![0].kg = 100;
  assert.deepEqual(input, before, 'reading production must never update saved quantities or date windows');
});


test('a weighed frozen batch does not silently quantify a separate catalogue pantry window of the same crop', () => {
  const frozen = { ...record('crop:maize', 'frozen'), id: 'frozen-maize', quantities: [{ ...date, kg: 3 }] };
  const pantry = availability([band('staples-stored', [[entry('crop:maize')]])]);
  const partial = buildProductionKgGraphs({ ...kgInput(), availability: pantry, preservedProducts: [frozen] });
  assert.equal(partial.months[0].stockKg, 3);
  assert.equal(partial.months[0].stockKgPartial, true);
  assert.deepEqual(partial.months[0].stockKgMissingSources.map(e => e.iconKey), ['crop:maize']);
  const stored = { ...record('crop:maize', 'stored'), id: 'pantry-maize', quantities: [{ ...date, kg: 4 }] };
  const measured = buildProductionKgGraphs({ ...kgInput(), availability: pantry, preservedProducts: [frozen, stored] });
  assert.equal(measured.months[0].stockKg, 7, 'these are two explicitly separate measured batches, not two copies of a harvest');
  assert.equal(measured.months[0].stockKgPartial, false);
  const frozenOnly = buildProductionKgGraphs({ ...kgInput(), availability: pantry, preservedProducts: [frozen, stored], preservedMethods: ['frozen'] });
  assert.equal(frozenOnly.months[0].stockKg, 3);
  assert.equal(frozenOnly.months[0].stockKgPartial, false, 'turning Stored off removes the pantry unknown too');
});


test('explicit zero stored stock supplies a known zero snapshot without claiming food present, while other batches or unknown months remain visible', () => {
  const dates = [date, { year: 2027, month: 2 }];
  const emptyBatch: PreservedFoodRecord = { ...record('tree:macadamia-integrifolia', 'stored', dates), id: 'empty-nuts', quantities: [{ ...date, kg: 0 }] };
  const input = { ...kgInput(dates), preservedProducts: [emptyBatch] };
  const counts = buildProductionAvailabilityGraphs(input);
  assert.deepEqual(counts.months.map(m => m.totalCount), [0, 1], 'January is explicitly empty; February has stock months but no amount');
  const kilos = buildProductionKgGraphs(input);
  assert.deepEqual(kilos.months.map(m => m.stockKg), [0, null]);
  assert.deepEqual(kilos.months.map(m => m.stockKgPartial), [false, true]);
  const positive = { ...emptyBatch, id: 'other-nuts', quantities: [{ ...date, kg: 2 }] };
  const another = buildProductionAvailabilityGraphs({ ...input, preservedProducts: [emptyBatch, positive] });
  assert.equal(another.months[0].totalCount, 1, 'the empty first batch must not hide another positive batch of the same food');
  const unknown = { ...emptyBatch, id: 'unknown-nuts', quantities: undefined };
  const unweighed = buildProductionAvailabilityGraphs({ ...input, preservedProducts: [emptyBatch, unknown] });
  assert.equal(unweighed.months[0].totalCount, 1, 'a dated stock record with unknown amount remains an option, not 0 kg');
});

test('a measured empty pantry overrides only its exact dated planned storage window while other batches and fresh food remain independent', () => {
  const dates = [date, { year: 2027, month: 2 }, { year: 2028, month: 1 }];
  const pantry = availability([band('staples-stored', dates.map(() => [entry('crop:maize')]))]);
  const empty: PreservedFoodRecord = { ...record('crop:maize', 'stored'), id: 'empty-maize', quantities: [{ ...date, kg: 0 }] };
  const input = { ...kgInput(dates), availability: pantry, preservedProducts: [empty] };
  const counts = buildProductionAvailabilityGraphs(input);
  assert.deepEqual(counts.months.map(month => month.totalCount), [0, 1, 1], 'a weighed January zero cannot erase a different month or become a recurring shortage');
  const kilos = buildProductionKgGraphs(input);
  assert.equal(kilos.months[0].stockKg, 0);
  assert.equal(kilos.months[0].stockKgPartial, false);
  for (const other of [{ ...empty, id: 'unweighed-maize', quantities: undefined },
    { ...empty, id: 'other-maize', quantities: [{ ...date, kg: 2 }] }]) {
    const food = buildProductionAvailabilityGraphs({ ...input, preservedProducts: [empty, other] });
    assert.equal(food.months[0].totalCount, 1, 'a distinct unknown or positive batch must not be hidden by the empty batch');
  }
  const frozen = buildProductionAvailabilityGraphs({ ...input, preservedProducts: [{ ...empty, method: 'frozen' }] });
  assert.equal(frozen.months[0].totalCount, 1, 'empty frozen maize does not weigh or empty a separate pantry stock');
  const fresh = buildProductionAvailabilityGraphs({ ...input, availability: availability([
    band('fresh', [[entry('crop:maize')], [], []]), band('staples-stored', dates.map(() => [entry('crop:maize')])),
  ]) });
  assert.equal(fresh.months[0].freshCount, 1, 'an empty store cannot remove a separate planned fresh harvest');
  assert.equal(fresh.months[0].totalCount, 1);
});


test('switching forest and animals off hides their entered production and preserved stocks without deleting those records', () => {
  const input = { ...kgInput(), availability: availability([
    band('fresh', [[entry('crop:tomatoes')]]), band('forest', [[entry('tree:mangifera-indica')]]),
    band('animals', [[entry('animal:chicken-layer')]]),
  ]), productionRecords: [production('crop:tomatoes', 2), production('tree:mangifera-indica', 3),
    production('animal:chicken-layer', 12, 'eggs'), production('animal:bees', 4)],
  preservedProducts: [record('tree:macadamia-integrifolia', 'stored'), record('animal:bees', 'processed'), record('crop:green-beans', 'frozen')] };
  const before = structuredClone(input);
  const all = buildProductionKgGraphs(input);
  assert.equal(all.months[0].recordedKg, 9);
  assert.equal(all.months[0].nativeUnits.eggs, 12);
  const hiddenInput = { ...input, includeTrees: false, includeAnimals: false };
  const hidden = buildProductionKgGraphs(hiddenInput);
  assert.equal(hidden.months[0].recordedKg, 2);
  assert.equal(hidden.months[0].nativeUnits.eggs, null);
  assert.deepEqual(hidden.months[0].records.map(r => r.sourceIconKey), ['crop:tomatoes']);
  assert.deepEqual(hidden.months[0].stockRecords.map(r => r.sourceIconKey), ['crop:green-beans']);
  assert.deepEqual(hidden.recordIssues, [], 'hiding a valid record is not evidence that it is malformed');
  const counts = buildProductionAvailabilityGraphs(hiddenInput);
  assert.equal(counts.months[0].freshCount, 1);
  assert.deepEqual(counts.months[0].preserved.map(r => r.sourceIconKey), ['crop:green-beans']);
  assert.deepEqual(input, before, 'the switches affect graphs; they must not delete saved production or stock');
  assert.equal(buildProductionKgGraphs(input).months[0].recordedKg, 9, 'switching back on restores the same records');
});


test('finite record and batch quantities whose sums overflow stay unknown rather than creating Infinity or restarting at the next record', () => {
  const records = [production('crop:tomatoes', Number.MAX_VALUE), production('crop:green-beans', Number.MAX_VALUE), production('crop:carrots', 1)];
  const stocks = records.map(r => ({ ...record(r.sourceIconKey, 'stored'), id: r.id, quantities: [{ ...date, kg: r.quantity }] }));
  const graph = buildProductionKgGraphs({ ...kgInput(), productionRecords: records, preservedProducts: stocks });
  assert.equal(graph.months[0].recordedKg, null);
  assert.equal(graph.months[0].actualKg, null);
  assert.equal(graph.months[0].stockKg, null);
  assert.equal(graph.months[0].stockKgPartial, true);
  assert.equal(graph.months[0].recordedKgMissingSources.length, 3);
  assert.equal(graph.months[0].stockKgMissingSources.length, 3);
  assert.ok(graph.recordIssues.some(issue => /production total cannot be calculated/.test(issue)));
  assert.ok(graph.recordIssues.some(issue => /stock kg total cannot be calculated/.test(issue)));
  const native = buildProductionKgGraphs({ ...kgInput(), productionRecords: [production('animal:goat-dairy', Number.MAX_VALUE, 'litres'), production('animal:cattle-dairy', Number.MAX_VALUE, 'litres')] });
  assert.equal(native.months[0].nativeUnits.litres, null);
  assert.ok(native.recordIssues.some(issue => /litres/.test(issue)));
});

test('overflowing cycle and annual-tree sums remain unknown while preserving the individually entered finite quantities', () => {
  const maize = cropByKey('maize')!;
  const startIndex = 2026 * 12 + 10 + planningMaturityMonths(maize.daysToHarvest);
  const pick = { year: Math.floor(startIndex / 12), month: startIndex % 12 + 1 };
  const beds = Array.from({ length: 4 }, (_, i) => ({ id: `b${i}`, label: `Numeric input ${i}`, areaM2: Number.MAX_VALUE }));
  const plantings = beds.map(bed => ({ id: bed.id, bedId: bed.id, cropKey: 'maize', sowMonth: 11, once: '2026-11' }));
  const graph = buildProductionKgGraphs({ ...kgInput([pick]), beds, plantings, treeGroups: [
    { harvest: PERENNIAL_HARVEST['persea-americana'], existing: 1, proposed: 0 },
    { harvest: PERENNIAL_HARVEST['mangifera-indica'], existing: 1, proposed: 0 },
  ], treeSeasons: Object.fromEntries(['persea-americana', 'mangifera-indica'].map(id => [id, { months: [], bearing: true,
    production: [{ status: 'existing', plants: 1, planted: '2016-11', yields: [{ age: 10, kg: Number.MAX_VALUE }] }],
  }])) });
  assert.ok(graph.months[0].cropCycles.every(cycle => cycle.kg !== null && Number.isFinite(cycle.kg)));
  assert.equal(graph.months[0].cropCycleKgStartingHarvest, null);
  assert.equal(graph.months[0].cropCycleMissingSources.length, 1, 'four overflowing maize cycles are one unresolved crop source');
  assert.equal(graph.annualTreeEstimates[0].knownKg, null);
  assert.equal(graph.annualTreeEstimates[0].partial, true);
  assert.ok(graph.recordIssues.some(issue => /crop-cycle/.test(issue)));
  assert.ok(graph.recordIssues.some(issue => /annual tree/.test(issue)));
});

test('an overflowing own-price product does not discard the valid farm quantity or replace the entered price', () => {
  const input = { ...production('crop:tomatoes', 1e200), pricePerUnit: 1e200 };
  const rows = sanitiseProductionRecords([input]);
  assert.equal(rows.length, 1, 'the display must report an uncalculable Rand value while preserving the farm data');
  assert.equal(rows[0].pricePerUnit, 1e200);
  const graph = buildProductionKgGraphs({ ...kgInput(), productionRecords: rows });
  assert.equal(graph.months[0].recordedKg, 1e200, 'a failed price multiplication supplies no invented kg or Rand');
});

test('positive exact-date production records fill undated or reference food counts and zero observations override expected or planned fresh windows', () => {
  const dates = [date, { year: 2028, month: 1 }];
  const reference = { ...entry('tree:mangifera-indica'), planning: { label: 'Regional reference', months: [1], basis: 'source reference' }, code: 'Ma' };
  const a = availability([band('fresh', [[entry('crop:tomatoes'), entry('crop:green-beans')], []]),
    band('forest', [[reference], []], { planningCells: [[reference], []], undated: [{ ...entry('tree:cajanus-cajan'), code: 'Pi' }, { ...entry('tree:moringa-oleifera'), code: 'Mo' }] })]);
  const records = [production('tree:cajanus-cajan', 2), production('tree:moringa-oleifera', 0.4), production('tree:mangifera-indica', 1),
    production('animal:chicken-layer', 12, 'eggs'), production('crop:tomatoes', 0), production('crop:green-beans', 5, 'kg', 'expected'), production('crop:green-beans', 0)];
  const input = { ...kgInput(dates), availability: a, productionRecords: records, preservedProducts: [
    { ...record('crop:tomatoes', 'frozen'), quantities: [{ ...date, kg: 3 }] },
    { ...record('crop:green-beans', 'stored'), quantities: [{ ...date, kg: 0 }] },
  ] };
  const graph = buildProductionAvailabilityGraphs(input);
  assert.deepEqual(graph.months[0].fresh.map(r => r.iconKey), ['tree:cajanus-cajan', 'tree:moringa-oleifera', 'tree:mangifera-indica', 'animal:chicken-layer']);
  assert.equal(graph.months[0].freshCount, 4, 'known eggs count one food kind, never twelve crops');
  assert.equal(graph.months[0].referenceCount, 0, 'an evidenced positive mango is not counted again as a regional reference');
  assert.deepEqual(graph.months[0].preserved.map(r => r.sourceIconKey), ['crop:tomatoes'], 'no fresh tomatoes were produced, but a separately recorded frozen batch is still food');
  assert.equal(graph.months[0].totalCount, 5);
  assert.equal(graph.months[1].totalCount, 0, 'explicit records cannot become next year’s recurring calendar');
  const kg = buildProductionKgGraphs(input);
  assert.equal(kg.months[0].recordedKg, 3.4);
  assert.equal(kg.months[0].nativeUnits.eggs, 12);
  assert.deepEqual(kg.months[0].recordedKgMissingSources, []);
  assert.deepEqual(kg.months[0].planningReferenceSources, [], 'the quantified mango must not still be reported as reference-only food');
});

test('a single overflowing crop estimate or tree cohort reports unknown instead of a false zero annual subtotal', () => {
  const crop = cropByKey('tomatoes')!;
  const pickIndex = 2026 * 12 + 10 + planningMaturityMonths(crop.daysToHarvest) + TRANSPLANT_ENTRY_PLANNED_MONTHS;
  const pick = { year: Math.floor(pickIndex / 12), month: pickIndex % 12 + 1 };
  const graph = buildProductionKgGraphs({ ...kgInput([pick]),
    beds: [{ id: 'b', label: 'Numeric input', areaM2: Number.MAX_VALUE }],
    plantings: [{ id: 'p', bedId: 'b', cropKey: 'tomatoes', sowMonth: 11, once: '2026-11' }],
    treeGroups: [{ harvest: PERENNIAL_HARVEST['persea-americana'], existing: 2, proposed: 0 }],
    treeSeasons: { 'persea-americana': { months: [], bearing: true,
      production: [{ status: 'existing', plants: 2, planted: '2016-11', yields: [{ age: 10, kg: Number.MAX_VALUE }] }],
    } },
  });
  assert.equal(graph.months[0].cropCycles[0].kg, null);
  assert.equal(graph.months[0].cropCycleKgStartingHarvest, null);
  assert.match(graph.months[0].cropCycles[0].missingReason!, /quantity/);
  assert.equal(graph.annualTreeEstimates[0].trees[0].numericOverflow, true);
  assert.equal(graph.annualTreeEstimates[0].knownKg, null, 'the age authority’s safe zero placeholder must not be printed as known production');
  assert.equal(graph.annualTreeEstimates[0].partial, true);
  assert.ok(graph.recordIssues.some(issue => /Tomatoes crop-cycle/.test(issue)));
  assert.ok(graph.recordIssues.some(issue => /annual tree/.test(issue)));
});
