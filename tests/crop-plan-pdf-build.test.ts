// Builds a REAL crop-plan PDF end to end, with jsPDF actually running — the wave-2 review found
// that nothing in the repo executed buildCropPlanPdf, so a crash anywhere on that path (including
// the new plan-notes panel and its page-break arithmetic) would only ever be found by a farmer's
// export button. Kept apart from tests/crop-plan-storage-and-notes.test.ts for the same reason
// tests/credit-pack-pdf-build.test.ts is its own file: that suite fakes `window` inside its
// tests, and jsPDF's Node build inspects `window` at load time — with no window mock at all in
// this process, jsPDF loads its plain Node build cleanly.

import assert from 'node:assert/strict';
import test from 'node:test';

import { PNG } from 'pngjs';
import { PERENNIAL_HARVEST, placedTreeGroups } from '@/lib/perennial-harvest';
import { buildProductionProjection } from '@/lib/production-projection';
import { cropByKey } from '@/lib/crop-catalog';
import { STAPLE_CROP_KEYS } from '@/lib/staple-crops';

import {
  availabilityIconKeys, buildCropPlanPdf, cropPlanPdfFilename, drawCropPlanPages, FARMER_SECTIONS, resolveAvailability, type CropPlanPdfInput,
} from '@/lib/crop-export-pdf';
import { buildPlanYieldBenchmark, buildYearReport, tasksForPlan, type FoodAvailabilityItem, type PlanBed, type Planting } from '@/lib/crop-plan';
import type { PlanNote } from '@/lib/crop-autosuggest';

const BEDS: PlanBed[] = [{ id: 'b1', label: 'Bed 1', areaM2: 10, kind: 'bed' }];
const PLANTINGS: Planting[] = [
  { id: 'p1', bedId: 'b1', cropKey: 'cabbage', sowMonth: 8 },
  { id: 'p2', bedId: 'b1', cropKey: 'butternut', sowMonth: 10, areaFraction: 0.5 },
];

const NOTES: PlanNote[] = [
  { kind: 'warning', text: 'Cabbage seedlings need water through the dry start of spring.' },
  { kind: 'choice', text: 'Butternut got half the bed so the cabbage rows keep their spacing.', bedIds: ['b1'] },
  { kind: 'gap', text: 'Nothing new goes in during winter — the bed is carrying the cabbage.' },
  { kind: 'basis', text: 'Sowing windows come from the provincial planting guides named in the sources panel.' },
];

function input(extra: Partial<CropPlanPdfInput> = {}): CropPlanPdfInput {
  return {
    plantings: PLANTINGS,
    beds: BEDS,
    tasks: tasksForPlan(PLANTINGS, BEDS),
    meta: {
      planTitle: 'Test plan',
      siteLine: 'KZN Midlands · Summer rainfall',
      locationLine: 'KZN Midlands',
      climateLine: 'Summer rainfall',
      bedsSummary: '1 bed · 10.0 m² of growing space',
      dateLabel: '20 August 2026',
      estimatedKgPerYear: null,
      lossPercent: 25,
    },
    now: new Date('2026-08-20T06:00:00.000Z'),
    ...extra,
  };
}

test('a real crop-plan export builds an actual, non-empty PDF', async () => {
  const blob = await buildCropPlanPdf(input());
  assert.ok(blob instanceof Blob);
  assert.equal(blob.type, 'application/pdf');
  // Cover, dashboard, calendar, plan, buying schedule and field sheets — a
  // suspiciously small file means a section silently failed to draw.
  assert.ok(blob.size > 20_000, `PDF looked too small to hold the real document (${blob.size} bytes)`);
});

test('supplying plan notes actually draws the notes panel', async () => {
  const without = await buildCropPlanPdf(input());
  const withNotes = await buildCropPlanPdf(input({ planNotes: NOTES, planNotesAt: Date.UTC(2026, 7, 20) }));
  // The panel must be genuinely drawn, not merely accepted and dropped.
  assert.ok(withNotes.size > without.size,
    `notes added nothing to the PDF (${without.size} → ${withNotes.size} bytes)`);
});

test('a wall of fat notes still builds — the page-break path executes', async () => {
  const fat: PlanNote[] = Array.from({ length: 60 }, (_, i) => ({
    kind: (['warning', 'choice', 'gap', 'basis'] as const)[i % 4],
    text: `Note ${i + 1}: a deliberately long sentence that wraps across several lines so the `
      + 'panel-height arithmetic and the page-break guard are both forced to run rather than '
      + 'everything fitting comfortably on the first page of the panel.',
  }));
  const blob = await buildCropPlanPdf(input({ planNotes: fat, planNotesAt: Date.UTC(2026, 7, 20) }));
  assert.ok(blob.size > 30_000, `the fat-notes document looked truncated (${blob.size} bytes)`);
});

test('notes with no usable date still build, with the undated intro', async () => {
  // loadCropPlan never produces this pair (notes travel with their date), but
  // the PDF input is a public surface and drawPlanNotes has an explicit
  // undated fallback sentence — so it must execute, not just exist in source.
  const blob = await buildCropPlanPdf(input({ planNotes: NOTES }));
  assert.ok(blob instanceof Blob);
  assert.ok(blob.size > 20_000);
});

test('cropPlanPdfFilename with a kind never collides with the full-document filename for the same plan and day', () => {
  const date = new Date('2026-08-22T06:00:00.000Z');
  const full = cropPlanPdfFilename('Ubhejane Crèche', date);
  const quickA4 = cropPlanPdfFilename('Ubhejane Crèche', date, 'quick-print-a4');
  const quickA3 = cropPlanPdfFilename('Ubhejane Crèche', date, 'quick-print-a3');
  assert.notEqual(quickA4, full);
  assert.notEqual(quickA4, quickA3);
  assert.equal(full, 'ImbewuField-Crop-Plan-Ubhejane-Creche-2026-08-22.pdf');
  assert.equal(quickA4, 'ImbewuField-Crop-Plan-Ubhejane-Creche-quick-print-a4-2026-08-22.pdf');
});

test('the quick-print export (calendar + taskSummary only) builds a short, real PDF', async () => {
  const blob = await buildCropPlanPdf(input({ sections: ['calendar', 'taskSummary'] }));
  assert.ok(blob instanceof Blob);
  assert.equal(blob.type, 'application/pdf');
  // Two pages only — no dashboard, plan, buying schedule or field sheets — so
  // this must land well short of the full document's size, not just "not empty".
  const full = await buildCropPlanPdf(input());
  assert.ok(blob.size < full.size, `quick print (${blob.size}) was not smaller than the full document (${full.size})`);
  assert.ok(blob.size > 5_000, `quick print looked too small to hold two real pages (${blob.size} bytes)`);
});

test('quick print builds at every paper size the picker offers', async () => {
  for (const pageFormat of ['a4', 'a3', 'a2'] as const) {
    const blob = await buildCropPlanPdf(input({ sections: ['calendar', 'taskSummary'], pageFormat }));
    assert.ok(blob instanceof Blob, `pageFormat ${pageFormat} did not produce a Blob`);
    assert.ok(blob.size > 5_000, `pageFormat ${pageFormat} looked too small (${blob.size} bytes)`);
  }
});

test('a busy plan with long custom bed/plot names does not overflow the task summary onto extra pages, and truncates labels instead of overlapping the area figure', async () => {
  // Real farmer-authored names, not the "Bed N" fallback — the exact shape
  // that made drawCalendar's label column overlap its own area text.
  const beds = [
    { id: 'b1', label: 'Bed 1 - Nursery corner, by the gate', areaM2: 8, kind: 'bed' as const },
    { id: 'pA', label: 'Plot A - Maize block, north side', areaM2: 60, kind: 'plot' as const },
  ];
  const plantings = [
    { id: 'q1', bedId: 'b1', cropKey: 'cabbage', sowMonth: 8 },
    { id: 'q2', bedId: 'pA', cropKey: 'butternut', sowMonth: 10 },
  ];
  const blob = await buildCropPlanPdf(input({
    beds, plantings, tasks: tasksForPlan(plantings, beds), sections: ['calendar', 'taskSummary'],
  }));
  assert.ok(blob instanceof Blob);
  assert.ok(blob.size > 5_000);
});

// ── The printed food-availability page ─────────────────────────────────────
// Rory, 2026-09-29: "i want in the crop plan printed a version of the calendar we have in the app
// with the veg and other icons that show availability during the month".

function tinyPng(): string {
  const png = new PNG({ width: 4, height: 4 });
  for (let i = 0; i < png.data.length; i += 4) png.data.set([46, 107, 58, 255], i);
  return `data:image/png;base64,${PNG.sync.write(png).toString('base64')}`;
}

const pdfText = async (blob: Blob) => Buffer.from(await blob.arrayBuffer()).toString('latin1');
// Compare the visible sentence across PDF line wrapping, not a single drawing run.
const visibleText = (raw: string) => [...raw.matchAll(/\(((?:\\.|[^\\)])*)\)\s*Tj/g)]
  .map(match => match[1].replace(/\\([\\()])/g, '$1')).join(' ');

test('the detailed benchmark-only summary cannot contradict the dated picking calendar', async () => {
  const beds: PlanBed[] = [
    { id: 'existing-bed', label: 'Already growing', areaM2: 10, kind: 'bed' },
    { id: 'new-bed', label: 'New crop', areaM2: 10, kind: 'bed' },
  ];
  const plantings: Planting[] = [
    { id: 'existing', bedId: 'existing-bed', cropKey: 'swiss-chard', sowMonth: 8, existing: true },
    { id: 'planned', bedId: 'new-bed', cropKey: 'carrots', sowMonth: 3 },
  ];
  const yearReport = buildYearReport(plantings, beds, { includeCalendarNarrative: false });
  assert.ok(yearReport.some(paragraph => paragraph.startsWith('For crops with a verified kg/m² benchmark')),
    'the fixture must retain a real planned-crop comparison, not pass by drawing an empty report');
  const raw = await pdfText(await buildCropPlanPdf(input({
    plantings, beds, tasks: [], yearReport, sections: ['dashboard'], now: new Date('2026-10-02T08:00:00Z'),
  })));
  const text = visibleText(raw);
  // The dashboard includes the active existing chard cycle, while the new-crop
  // comparison covers the planned carrots. Dropping the latter as a duplicate
  // used to hide its different denominator and the crop the farmer is choosing.
  const allCycles = buildPlanYieldBenchmark(plantings, beds, 10).knownKg;
  const newCycles = buildPlanYieldBenchmark(plantings.filter(planting => !planting.existing), beds).knownKg;
  assert.ok(allCycles !== null && newCycles !== null && allCycles > newCycles,
    'the fixture must distinguish the dashboard and proposed-crop benchmark scopes');
  assert.ok(text.includes(`${allCycles.toFixed(1)} kg`), 'the dashboard must retain its existing-plus-planned crop comparison');
  assert.ok(text.includes(`total about ${newCycles.toFixed(0)}kg`), 'the separate planned-new-crop figure must not be dropped as a duplicate');
  assert.ok(text.includes('Carrots is the biggest crop-cycle total'), 'the new-crop leader must not be replaced by the dashboard leader');
  assert.ok(raw.includes('(Planned crop comparison) Tj'), 'the actual PDF lost the comparison scope heading');
  assert.ok(text.includes('planned new bed-crop cycles'), 'the summary must identify which rows its benchmark covers');
  assert.ok(text.includes('whole-farm production forecast'), 'the comparison must not pose as all site production');
  assert.ok(text.includes('monthly growing and food calendars'), 'timing must point to the shared dated calendars');
  assert.ok(!text.includes('Year ahead'), 'a new-bed benchmark must not be labelled as the whole year ahead');
  assert.ok(!text.includes('Nothing is due for picking') && !text.includes('No verified fresh-picking window'),
    'a proposed-crop benchmark must not announce a gap that ignores already growing crops');
  assert.ok(!text.includes('can be kept after harvest'), 'recurring storage prose must not replace the dated availability chart');
});

// Picking icons alone do not answer Rory's request to see the growing bars from the app.
// Inspect the real PDF text so a section switch that silently drops those bars can fail.
test('the farmer production copy contains the growing timeline as well as the food pictures', async () => {
  const raw = await pdfText(await buildCropPlanPdf(input({ sections: FARMER_SECTIONS })));
  assert.ok(raw.includes('Growing plan:'), 'the field copy lost its bed-by-bed growing calendar');
  assert.ok(raw.includes('Bed reserved / growing'), 'the bars lost the distinction between field reservation and actual picking');
  assert.ok(raw.includes('Fresh veg'), 'growing bars must not replace the food-availability pictures');
  assert.ok(raw.indexOf('Growing plan:') < raw.indexOf('Fresh veg'), 'the growing timeline should be encountered before picking availability');
});

test('two sowings of the same crop keep separate dated lanes in the actual printed timeline', async () => {
  const plantings: Planting[] = [
    { id: 'march', bedId: 'b1', cropKey: 'carrots', sowMonth: 3, areaFraction: 1 / 3 },
    { id: 'april', bedId: 'b1', cropKey: 'carrots', sowMonth: 4, areaFraction: 1 / 3 },
  ];
  const raw = await pdfText(await buildCropPlanPdf(input({ plantings, tasks: [], sections: ['calendar'], now: new Date('2026-10-02T08:00:00Z') })));
  assert.equal(raw.match(/\(Carrots\)\s*Tj/g)?.length, 2, 'same-crop cohorts were merged into a single undated lane');
  assert.ok(raw.includes('sow Mar 2027') && raw.includes('sow Apr 2027'), 'the farmer must be able to tell which sowing each bar describes');
});

test('an impossible bed share prints the actual invalid percentage and a space warning', async () => {
  const plantings: Planting[] = [{ id: 'invalid', bedId: 'b1', cropKey: 'carrots', sowMonth: 10, areaFraction: 2 }];
  const raw = await pdfText(await buildCropPlanPdf(input({ plantings, tasks: [], sections: ['calendar'], now: new Date('2026-10-02T08:00:00Z') })));
  assert.ok(raw.includes('CHECK SPACE'), 'an impossible area must not look like a workable bed calendar');
  assert.ok(raw.includes('200% area'), 'a double-sized allocation must not silently become Whole area');
});

test('the printed winter cover ends as field work rather than being labelled food to pick', async () => {
  // March's source duration puts termination inside this October-to-September copy.
  const plantings: Planting[] = [{ id: 'cover', bedId: 'b1', cropKey: 'oats', sowMonth: 3 }];
  const raw = await pdfText(await buildCropPlanPdf(input({ plantings, tasks: [], sections: ['calendar'], now: new Date('2026-10-02T08:00:00Z') })));
  assert.ok(raw.includes('(Finish) Tj'), 'the oats termination window disappeared');
  assert.ok(!raw.includes('(Pick) Tj'), 'a cover-crop termination must not become a food-harvest instruction');
});

test('pending and finished starters cannot acquire lanes on the printed growing calendar', async () => {
  const plantings: Planting[] = [
    { id: 'pending', bedId: 'b1', cropKey: 'green-beans', sowMonth: 9, once: '2026-09', awaitingSowingConfirmation: true },
    { id: 'finished', bedId: 'b1', cropKey: 'carrots', sowMonth: 9, existing: true, confirmedOnceSowing: '2025-09', finishedOnceSowing: true },
  ];
  const raw = await pdfText(await buildCropPlanPdf(input({ plantings, tasks: [], sections: ['calendar'], now: new Date('2026-10-02T08:00:00Z') })));
  assert.ok(raw.includes('No dated crop reserved here'));
  assert.ok(!raw.includes('(Green beans) Tj') && !raw.includes('(Carrots) Tj'), 'unconfirmed or retired observations must not become growing bars');
});

const FOREST_AND_HENS = {
  forest: Array.from({ length: 12 }, (_, i) => i < 4 ? [{ iconKey: 'tree:mangifera-indica', label: 'Mango' }] : []),
  animals: Array.from({ length: 12 }, () => [{ iconKey: 'animal:chicken-layer', label: 'Laying hens - eggs' }]),
};

test('the full export carries the availability page, and it can be printed on its own', async () => {
  const alone = await buildCropPlanPdf(input({ sections: ['availability'] }));
  assert.equal(alone.type, 'application/pdf');
  assert.ok(alone.size > 5_000, `the availability page looked empty (${alone.size} bytes)`);
  const full = await buildCropPlanPdf(input());
  const withoutIt = await buildCropPlanPdf(input({ sections: ['dashboard', 'numbers', 'calendar', 'plan', 'buying', 'fieldsheets', 'record'] }));
  assert.ok(full.size > withoutIt.size, 'the default export did not add the availability page');
});

test('without chart data, a dated print cannot borrow harvests from an earlier annual cycle', () => {
  const resolved = resolveAvailability(input(), 8);
  assert.equal(resolved.yearMode, 'fromToday');
  assert.equal(resolved.utilization.length, 12);
  // Section omission hid whole enterprises from the farmer. Keep headings without borrowing
  // any product or date from a missing canvas; that is separate from the dated-sowing rule.
  for (const key of ['forest', 'animals']) {
    const band = resolved.bands.find((b) => b.key === key);
    assert.ok(band, `${key} section disappeared from a production plan`);
    assert.equal(band.cells.flat().length, 0, `${key} acquired an invented production month`);
  }
  const fresh = resolved.bands.find((b) => b.key === 'fresh');
  assert.ok(fresh && fresh.cells.length === 12);
  assert.equal(fresh.cells[0].length, 0, 'a new August sowing cannot already be a fresh August harvest');
  assert.ok(fresh.cells.flat().some((c) => c.iconKey === 'crop:cabbage'), 'the plan\'s cabbage never shows as fresh veg');
  for (const cell of fresh.cells.flat()) assert.ok(cell.code.length > 0, `${cell.label} has no fallback code`);
});

test('fresh and stored staples stay separate from vegetables without losing or duplicating a supplied crop', () => {
  // These supplied adapter slots test status/category routing, not shelf-life claims.
  // A grain wrongly shown in Fresh veg and Staple crops looks like two harvests on paper.
  const crops = [
    { cropKey: 'maize', name: 'Maize', icon: '🌽' },
    { cropKey: 'groundnuts', name: 'Groundnuts', icon: '🥜' },
    { cropKey: 'carrots', name: 'Carrots', icon: '🥕' },
    { cropKey: 'green-beans', name: 'Green beans', icon: '🫛' },
  ];
  const veg: FoodAvailabilityItem[][] = Array.from({ length: 12 }, (_, month) => month < 2
    ? crops.map(crop => ({ ...crop, status: month === 0 ? 'fresh' : 'stored' })) : []);
  const cropBandKeys = ['fresh', 'stored', 'staples', 'staples-stored'];
  for (const includeTrees of [true, false]) for (const includeAnimals of [true, false]) {
    const data = input({ plantings: [], beds: [], tasks: [], availability: {
      veg, utilization: Array(12).fill(0), ...FOREST_AND_HENS, includeTrees, includeAnimals,
      undated: [{ iconKey: 'housing:chicken', label: 'Unassigned coop', detail: 'No production dates assumed.' }],
    } });
    const resolved = resolveAvailability(data, 8);
    const rows = new Map(resolved.bands.map(band => [band.key, band]));
    const keys = (band: typeof resolved.bands[number]['key'], slot: number) => rows.get(band)?.cells[slot].map(entry => entry.iconKey).sort();
    assert.deepEqual(keys('fresh', 0), ['crop:carrots', 'crop:green-beans']);
    assert.deepEqual(keys('staples', 0), ['crop:groundnuts', 'crop:maize']);
    assert.deepEqual(keys('stored', 1), ['crop:carrots', 'crop:green-beans']);
    assert.deepEqual(keys('staples-stored', 1), ['crop:groundnuts', 'crop:maize']);
    for (let slot = 0; slot < 12; slot++) {
      const printed = resolved.bands.filter(band => cropBandKeys.includes(band.key)).flatMap(band => band.cells[slot]);
      assert.deepEqual(printed.map(entry => entry.iconKey).sort(), veg[slot].map(crop => `crop:${crop.cropKey}`).sort(),
        `slot ${slot}: each crop must occur exactly once with tree=${includeTrees}, animals=${includeAnimals}`);
      assert.equal(new Set(printed.map(entry => entry.iconKey)).size, printed.length, `slot ${slot}: a crop counted twice`);
    }
    assert.equal(rows.get('forest')?.cells.flat().length, includeTrees ? 4 : 0);
    assert.equal(rows.get('animals')?.cells.flat().length, includeAnimals ? 12 : 0);
    assert.equal(rows.get('animals')?.undated?.length, includeAnimals ? 1 : 0, 'animal switch must hide unassigned housing too');
    const iconKeys = availabilityIconKeys(data);
    assert.equal(iconKeys.includes('housing:chicken'), includeAnimals);
    assert.equal(iconKeys.includes('animal:chicken-layer'), includeAnimals);
    assert.equal(iconKeys.includes('tree:mangifera-indica'), includeTrees);
    for (const crop of crops) assert.ok(iconKeys.includes(`crop:${crop.cropKey}`), `${crop.name}: category split lost its picture`);
  }
});

test('fresh staples retain their named section while empty stored sections do not suggest stored food', async () => {
  const data = input({ plantings: [], beds: [], tasks: [], sections: ['availability'], availability: {
    veg: [[{ cropKey: 'maize', name: 'Maize', icon: '🌽', status: 'fresh' }]], utilization: [],
  } });
  const resolved = resolveAvailability(data, 8);
  assert.ok(resolved.bands.some(band => band.key === 'staples' && band.cells[0][0].iconKey === 'crop:maize'));
  assert.ok(!resolved.bands.some(band => band.key === 'stored' || band.key === 'staples-stored'), 'an empty store must not show stored food');
  const raw = await pdfText(await buildCropPlanPdf(data));
  assert.ok(raw.includes('Staple crops'), 'the real PDF lost the crop category after adapter routing');
  assert.ok(!raw.includes('Stored staples') && !raw.includes('Stored veg'), 'the print invented stored-food sections');
});

test('food forest and animal trays appear when the chart hands them in, and their icons are asked for', () => {
  const withRows = input({ availability: FOREST_AND_HENS });
  const keys = resolveAvailability(withRows, 8).bands.map((b) => b.key);
  assert.ok(keys.includes('forest') && keys.includes('animals'), `bands were ${keys.join(', ')}`);
  const icons = availabilityIconKeys(withRows);
  assert.ok(icons.includes('tree:mangifera-indica'));
  assert.ok(icons.includes('animal:chicken-layer'));
  assert.ok(icons.includes('crop:cabbage'));
  assert.equal(new Set(icons).size, icons.length, 'an icon key was asked for twice');
});

test('unknown banana, hive and coop months keep their own named rows on the picture calendar without inventing production', async () => {
  const undated = [
    { iconKey: 'tree:musa-acuminata-aaa-group', label: 'Banana', detail: 'Local picking months need confirming.' },
    { iconKey: 'housing:bee', label: 'Hives', detail: 'Local honey flow needs confirming.' },
    { iconKey: 'housing:chicken', label: 'Coops / chicken tractors', detail: 'Actual birds and products need confirming.' },
  ];
  const data = input({ sections: ['availability'], availability: { undated } });
  const bands = resolveAvailability(data, 8).bands;
  for (const key of ['forest', 'animals']) {
    const band = bands.find((b) => b.key === key);
    assert.ok(band, `${key} was dropped because its dates were unknown`);
    assert.equal(band.cells.flat().length, 0, `${key} acquired a made-up product month`);
  }
  const raw = await pdfText(await buildCropPlanPdf(data));
  // A narrow crop column legitimately wraps the coop label; inspect every visible text run
  // instead of treating PDF line breaks as evidence that part of the source name was lost.
  const calendarRaw = raw.slice(0, raw.indexOf('(Food sources to check)'));
  const calendar = [...calendarRaw.matchAll(/\(((?:\\.|[^\\)])*)\)\s*Tj/g)]
    .map((match) => match[1].replace(/\\([\\()])/g, '$1')).join(' ');
  for (const phrase of ['Food forest - fruit, nuts & berries', 'Animal products', 'Banana', 'Hives', 'Coops / chicken tractors', 'Months to confirm']) {
    assert.ok(calendar.includes(phrase), `${phrase} was left only in the later inventory instead of the picture calendar`);
  }
});

test('switching out fruit or animal products explains the hidden section without leaking dated or undated sources', async () => {
  const data = input({ sections: ['availability'], availability: {
    ...FOREST_AND_HENS, includeTrees: false, includeAnimals: false,
    undated: [{ iconKey: 'housing:bee', label: 'Hives', detail: 'Not confirmed.' }],
  } });
  for (const key of ['forest', 'animals']) {
    const band = resolveAvailability(data, 8).bands.find((b) => b.key === key);
    assert.ok(band);
    assert.equal(band.cells.flat().length, 0);
    assert.equal(band.undated?.length, 0);
    assert.match(band.emptyNote ?? '', /Hidden for this print/);
  }
  const raw = await pdfText(await buildCropPlanPdf(data));
  assert.ok(raw.includes('Food forest - fruit, nuts & berries') && raw.includes('Animal products'));
  assert.ok(raw.includes('Hidden for this print.'));
  for (const source of ['Mango', 'Laying hens', 'Hives']) assert.ok(!raw.includes(source), `${source} leaked despite the explicit switch-off`);
});

test('each picture is embedded once however many months it appears in, and a missing one prints its code', async () => {
  const icon = tinyPng();
  const withIcons = await buildCropPlanPdf(input({
    sections: ['availability'],
    availability: FOREST_AND_HENS,
    // Laying hens appear in all twelve months; cabbage and mango get no picture at all.
    icons: { 'animal:chicken-layer': icon },
  }));
  const raw = await pdfText(withIcons);
  const images = raw.match(/\/Subtype \/Image/g)?.length ?? 0;
  assert.ok(images >= 1 && images <= 2, `expected one image (plus at most its mask), found ${images}`);

  const noIcons = await buildCropPlanPdf(input({ sections: ['availability'], availability: FOREST_AND_HENS }));
  assert.equal((await pdfText(noIcons)).match(/\/Subtype \/Image/g)?.length ?? 0, 0);
});

test('a picture jsPDF cannot read falls back to the code instead of breaking the export', async () => {
  const blob = await buildCropPlanPdf(input({
    sections: ['availability'],
    availability: FOREST_AND_HENS,
    icons: { 'animal:chicken-layer': 'data:image/png;base64,bm90IGEgcG5n' },
  }));
  assert.equal(blob.type, 'application/pdf');
  assert.ok(blob.size > 5_000);
});

// ── Food-forest picking in the task summary ────────────────────────────────
// Rory, 2026-09-29: "maybe have it even show in the monthly crop plan? harvest period etc etc".

test('picking jobs use confirmed local months, never the union of national source seasons', async () => {
  const blueberry = PERENNIAL_HARVEST['vaccinium-corymbosum'];
  assert.ok(blueberry, 'blueberry dossier missing');
  const standing = [{ harvest: blueberry, existing: 3, proposed: 0 }];
  const unconfirmed = await pdfText(await buildCropPlanPdf(input({ sections: ['taskSummary'], treeGroups: standing })));
  assert.ok(!unconfirmed.includes('Pick Blueberry'), 'a planted tree is not evidence of local picking months');
  const treeSeasons = { [blueberry.speciesId]: { months: [11, 12], bearing: true } };
  const withTrees = await pdfText(await buildCropPlanPdf(input({ sections: ['taskSummary'], treeGroups: standing, treeSeasons })));
  assert.equal(withTrees.match(/\(Pick Blueberry \\+\(3\\+\)/g)?.length ?? 0, 2);
  const without = await pdfText(await buildCropPlanPdf(input({ sections: ['taskSummary'] })));
  assert.ok(!without.includes('Pick Blueberry'));
  // Proposed bushes are years from a crop: nothing to pick from today.
  const young = await pdfText(await buildCropPlanPdf(input({ sections: ['taskSummary'], treeGroups: [{ harvest: blueberry, existing: 0, proposed: 3 }], treeSeasons })));
  assert.ok(!young.includes('Pick Blueberry'));
});

test('the field copy prints undated banana and housing with their pictures and reasons', async () => {
  const undated = [
    { iconKey: 'tree:musa-acuminata-aaa-group', label: 'Banana', detail: 'Existing plant; local picking months not confirmed.' },
    { iconKey: 'housing:bee', label: 'Hives', detail: 'Existing housing; honey flow months not confirmed.' },
    { iconKey: 'housing:chicken', label: 'Coops / chicken tractors', detail: 'Existing housing; choose what the chickens are kept for.' },
  ];
  const fields = input({ sections: FARMER_SECTIONS, availability: { undated } });
  const keys = availabilityIconKeys(fields);
  for (const entry of undated) assert.ok(keys.includes(entry.iconKey), `${entry.label} picture was omitted`);
  const raw = await pdfText(await buildCropPlanPdf(fields));
  for (const entry of undated) {
    assert.ok(raw.includes(entry.label), `${entry.label} disappeared from the printed inventory`);
    assert.ok(raw.includes(entry.detail), `${entry.label} lost its timing explanation`);
  }
  assert.ok(!raw.includes('Largest crops by known benchmark volume'), 'the field copy must open with useful pictures and jobs');
  assert.ok(raw.includes('Food sources to check'));
  assert.ok(raw.includes('Monthly harvest and field record'));
  assert.ok(raw.includes('Fruit, eggs, honey and other production'), 'the farmer record must include food outside the vegetable beds');
  assert.ok(raw.includes('Use the unit you actually measured') && raw.includes('(Unit)'), 'counted production needs its own explicit unit instead of a kg heading');
  assert.ok(raw.includes('Record jar size'), 'a jar count needs the actual jar size recorded, not an assumed weight');
});

test('a field copy carries the storage conditions behind its stored-food pictures', async () => {
  const plants: Planting[] = [{ id: 'grain', bedId: 'b1', cropKey: 'maize', sowMonth: 8 }];
  const raw = await pdfText(await buildCropPlanPdf(input({
    plantings: plants, tasks: tasksForPlan(plants, BEDS), sections: FARMER_SECTIONS,
  })));
  assert.ok(raw.includes('Before using stored food'));
  assert.ok(raw.includes('sourced storage window'), 'shelf life must remain tied to the source conditions');
  assert.ok(raw.includes('Source guide'));
  assert.ok(raw.includes('Picked kg') && raw.includes('Stored kg'), 'actual harvest records need explicit units');
  assert.ok(!raw.includes('Benchmark kg'), 'a blank monthly record must not ask for a crop-cycle benchmark as though it is this month\'s harvest');
});


// A non-empty PDF used to pass while sixty valid age groups printed through the footer.
// Trace real jsPDF text placement so the test can fail on lost printable content.
async function drawnText(data: CropPlanPdfInput) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: data.pageFormat ?? 'a4' });
  const placements: { text: string; page: number; left: number; right: number; baseline: number; width: number; height: number }[] = [];
  const original = doc.text.bind(doc);
  doc.text = ((text: string | string[], x: number, y: number, opts: { align?: 'left' | 'center' | 'right' | 'justify'; lineHeightFactor?: number } = {}) => {
    for (const [index, line] of (Array.isArray(text) ? text : [text]).entries()) {
      const width = doc.getTextWidth(line);
      const left = opts.align === 'center' ? x - width / 2 : opts.align === 'right' ? x - width : x;
      placements.push({ text: line, page: doc.getNumberOfPages(), left, right: left + width, baseline: y + index * doc.getFontSize() * (opts.lineHeightFactor ?? doc.getLineHeightFactor()), width: doc.internal.pageSize.getWidth(), height: doc.internal.pageSize.getHeight() });
    }
    return original(text, x, y, opts);
  }) as typeof doc.text;
  drawCropPlanPages(doc, data);
  return placements;
}

function agePrintInput(): CropPlanPdfInput {
  const now = new Date(2026, 9, 10);
  const treeGroups = placedTreeGroups(Array.from({ length: 60 }, () => ({ defId: 'tree_avocado', status: 'existing' })));
  // Synthetic farm entries exercise many cohorts; these are not agricultural defaults.
  const treeSeasons = { 'persea-americana': { bearing: true, months: [6, 7], production: Array.from({ length: 60 }, (_, i) => ({ status: 'existing' as const, plants: 1, planted: `${1966 + i}-10`, yields: [{ age: 0, kg: 0.4 }] })) } };
  return input({ now, plantings: [], beds: [], tasks: [], sections: ['projection'], treeGroups, treeSeasons, productionProjection: buildProductionProjection({ plantings: [], beds: [], trees: treeGroups, choices: treeSeasons, now }) });
}

test('many plant ages keep each group’s production and long farm names inside A4 and wall-size print pages', async () => {
  for (const pageFormat of ['a4', 'a3', 'a2'] as const) {
    const data = agePrintInput();
    const placements = await drawnText({ ...data, pageFormat, meta: { ...data.meta, planTitle: 'Ubhejane garden by the school for family production and learning '.repeat(6) } });
    for (const p of placements) assert.ok(p.left >= -0.1 && p.right <= p.width + 0.1 && p.baseline >= 0 && p.baseline < p.height - 15, `${pageFormat} put '${p.text}' outside the printable page (${p.left}, ${p.right}, ${p.baseline})`);
    assert.ok(placements.some(p => p.text.includes('group 60')), 'the last age group was dropped to fit the page');
    assert.ok(placements.some(p => p.text.includes('Species total')), 'the farmer cannot distinguish the full species total from a cohort');
    assert.ok(placements.some(p => p.text.includes('Group rows give kg for that age group')), 'the kg denominator is no longer stated');
  }
});

test('a long entered age-yield schedule retains its final checkpoint and source on headed pages', async () => {
  const data = agePrintInput();
  data.treeGroups![0].existing = 1;
  data.treeSeasons!['persea-americana']!.production = [{ status: 'existing', plants: 1, planted: '2000-10', yields: Array.from({ length: 300 }, (_, i) => ({ age: i / 2, kg: 0.4 })) }];
  data.productionProjection = buildProductionProjection({ plantings: [], beds: [], trees: data.treeGroups!, choices: data.treeSeasons!, now: data.now! });
  const placements = await drawnText(data);
  assert.ok(placements.some(p => p.text.includes('age 149.5:')), 'the last user checkpoint disappeared');
  assert.ok(placements.some(p => p.text === 'First-crop source'), 'the first-crop source disappeared');
  for (const p of placements) assert.ok(p.left >= -0.1 && p.right <= p.width + 0.1 && p.baseline >= 0 && p.baseline < p.height - 15, `age schedule printed '${p.text}' outside a page`);
});

test('calendar and jobs stay concise while a separately selected future PDF keeps ages and sources', async () => {
  const data = agePrintInput();
  const availability = { yearMode: 'fromToday' as const, veg: [], forest: [], animals: [], undated: [{ iconKey: 'tree:persea-americana', label: 'Avocado', detail: 'Confirm plant ages and local picking months.' }] };
  const quickRaw = await pdfText(await buildCropPlanPdf({ ...data, sections: ['availability', 'calendar', 'taskSummary'], availabilityDetails: false, availability }));
  const quick = visibleText(quickRaw);
  for (const kept of ['CROP / FOOD SOURCE', 'Avocado', 'Months to confirm', 'Tasks by month']) assert.ok(quick.includes(kept), kept);
  for (const omitted of ['As your plants grow', 'Why these months are marked', 'Plant ages: assumptions and sources']) assert.ok(!quick.includes(omitted), `${omitted} crowded the wall calendar`);
  // The legend still directs the farmer to this app section; only its printed appendix is omitted.
  assert.ok(!quickRaw.includes('(Food sources to check) Tj'), 'the inventory appendix crowded the wall calendar');
  const future = visibleText(await pdfText(await buildCropPlanPdf({ ...data, sections: ['projection'] })));
  for (const kept of ['As your plants grow', 'Fruit, nuts and berries by age', 'Plant ages: assumptions and sources', 'group 60']) assert.ok(future.includes(kept), `the separately selected future plan lost ${kept}`);
});


test('a changing age checkpoint draws a bounded striped end while the printed kg range stays explicit', async () => {
  const data = agePrintInput();
  data.treeGroups![0].existing = 1;
  data.treeSeasons!['persea-americana']!.production = [{ status: 'existing', plants: 1, planted: '2026-01', yields: [{ age: 0, kg: 0.4 }, { age: 1, kg: 2 }] }];
  data.productionProjection = buildProductionProjection({ plantings: [], beds: [], trees: data.treeGroups!, choices: data.treeSeasons!, now: data.now! });
  assert.deepEqual(data.productionProjection.years[0].treeKg, [0.4, 2], 'the fixture must actually change inside the twelve-month period');
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const original = doc.line.bind(doc);
  const stripes: number[][] = [];
  doc.line = ((x1: number, y1: number, x2: number, y2: number) => {
    // The meaning is a diagonal stripe, independent of the palette's RGB rounding.
    if (x1 !== x2 && y1 !== y2) stripes.push([x1, y1, x2, y2]);
    return original(x1, y1, x2, y2);
  }) as typeof doc.line;
  drawCropPlanPages(doc, data);
  assert.ok(stripes.length > 0, 'the variable harvest still looks identical to a fixed schedule');
  for (const [x1, y1, x2, y2] of stripes) assert.ok(x1 >= 40 && x2 <= 595.28 - 40 + 0.1 && y1 >= 40 && y2 >= 40 && Math.abs(y2 - y1) <= 9.1, 'a stripe escaped the nine-point forecast bar');
  const text = visibleText(await pdfText(await buildCropPlanPdf(data)));
  assert.ok(text.includes('0.4-2 kg'), 'the visual range lost its printed values');
  assert.ok(text.includes('Striped ends show harvest that changes as plants age during the year'), 'stripes need a plain explanation of their meaning');
});

test('a complete animal-food section stays together when it fits a fresh calendar page, while oversized sections continue with headings', async () => {
  // The all-produce visual fixture left one fish row on its own page after five animal rows.
  // These explicit invented months exercise layout, not recommended agricultural seasons.
  const crops = [...STAPLE_CROP_KEYS, 'tomatoes', 'carrots'].map(key => cropByKey(key)!);
  const animalRows = [
    {iconKey:'animal:goat-dairy',label:'Dairy goat - milk'},
    {iconKey:'animal:bees',label:'Honeybee - honey'},
    {iconKey:'animal:chicken-layer',label:'Laying hens - eggs'},
    {iconKey:'animal:pig-pork',label:'Pig - meat'},
    {iconKey:'animal:fish-tilapia',label:'Tilapia - fish'},
  ];
  const data = input({
    now:new Date(2026,9,10),plantings:[],beds:[],tasks:[],sections:['availability'],availabilityDetails:false,
    meta:{...input().meta,planTitle:'All produce - synthetic demonstration',locationLine:'',siteLine:'Invented months for picture testing only; not a saved farm or a planting recommendation',climateLine:'Artificial illustration: vegetables, eight field staples, fruit, nuts and five animal foods'},
    availability:{yearMode:'fromToday',veg:Array.from({length:12},(_,month)=>crops.flatMap((crop,i)=>{
      const at=(i*2)%12;
      const status = [at,(at+1)%12].includes(month) ? 'fresh' as const : crop.storageMonths && crop.storageConditions && month === (at+2)%12 ? 'stored' as const : undefined;
      return status ? [{cropKey:crop.key,name:crop.name,icon:crop.icon,status}] : [];
    })),forest:Array.from({length:12},()=>['Banana','Blueberry','Macadamia','Mango','Pecan'].map(label=>({iconKey:`tree:fixture-${label}`,label}))),animals:Array.from({length:12},()=>animalRows),undated:[{iconKey:'housing:rabbit',label:'Hutches',detail:'Choose animals and confirm local dates.'}]},
  });
  const placements = await drawnText(data);
  const labels=[...animalRows.map(row=>row.label),'Hutches'];
  const drawn=placements.filter(p=>labels.includes(p.text));
  assert.equal(drawn.length,labels.length,'an animal row was lost to make the section fit');
  assert.equal(new Set(drawn.map(p=>p.page)).size,1,'a fitting animal section left a product alone on the next page');

  const oversized=await drawnText({...data,availability:{yearMode:'fromToday',veg:[],forest:[],animals:[],undated:Array.from({length:40},(_,i)=>({iconKey:`animal:layout-fixture-${i}`,label:`Layout source ${String(i+1).padStart(2,'0')}`,detail:'Layout-only fixture; no production dates or quantities.'}))}});
  const sources=oversized.filter(p=>/^Layout source \d{2}$/.test(p.text));
  assert.equal(sources.length,40,'an oversized band lost its final source');
  assert.ok(new Set(sources.map(p=>p.page)).size>1,'this fixture no longer tests continuation');
  assert.ok(oversized.some(p=>p.text==='Animal products (continued)'), 'continued animal rows lost their section heading');
  for(const p of oversized) assert.ok(p.left>=-0.1&&p.right<=p.width+0.1&&p.baseline>=0&&p.baseline<p.height-15,`continued section put '${p.text}' outside its page`);
});
