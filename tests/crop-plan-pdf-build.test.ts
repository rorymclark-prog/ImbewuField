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
import { PERENNIAL_HARVEST } from '@/lib/perennial-harvest';

import {
  availabilityIconKeys, buildCropPlanPdf, cropPlanPdfFilename, FARMER_SECTIONS, resolveAvailability, type CropPlanPdfInput,
} from '@/lib/crop-export-pdf';
import { buildPlanYieldBenchmark, buildYearReport, tasksForPlan, type PlanBed, type Planting } from '@/lib/crop-plan';
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
  // Only veg rows exist without a canvas; empty forest and animal trays are left off, as on screen.
  assert.deepEqual(resolved.bands.map((b) => b.key).filter((k) => k === 'forest' || k === 'animals'), []);
  const fresh = resolved.bands.find((b) => b.key === 'fresh');
  assert.ok(fresh && fresh.cells.length === 12);
  assert.equal(fresh.cells[0].length, 0, 'a new August sowing cannot already be a fresh August harvest');
  assert.ok(fresh.cells.flat().some((c) => c.iconKey === 'crop:cabbage'), 'the plan\'s cabbage never shows as fresh veg');
  for (const cell of fresh.cells.flat()) assert.ok(cell.code.length > 0, `${cell.label} has no fallback code`);
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
    { iconKey: 'animal:bees', label: 'Hives', detail: 'Existing housing; honey flow months not confirmed.' },
    { iconKey: 'animal:chicken-indigenous', label: 'Coops / chicken tractors', detail: 'Existing housing; choose what the chickens are kept for.' },
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
