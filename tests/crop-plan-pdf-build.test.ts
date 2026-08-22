// Builds a REAL crop-plan PDF end to end, with jsPDF actually running — the wave-2 review found
// that nothing in the repo executed buildCropPlanPdf, so a crash anywhere on that path (including
// the new plan-notes panel and its page-break arithmetic) would only ever be found by a farmer's
// export button. Kept apart from tests/crop-plan-storage-and-notes.test.ts for the same reason
// tests/credit-pack-pdf-build.test.ts is its own file: that suite fakes `window` inside its
// tests, and jsPDF's Node build inspects `window` at load time — with no window mock at all in
// this process, jsPDF loads its plain Node build cleanly.

import assert from 'node:assert/strict';
import test from 'node:test';

import { buildCropPlanPdf, cropPlanPdfFilename, type CropPlanPdfInput } from '@/lib/crop-export-pdf';
import { tasksForPlan, type PlanBed, type Planting } from '@/lib/crop-plan';
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
