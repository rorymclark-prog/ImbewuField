import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { MAX_REPORT_PLATES, plateSheetKey, selectReportPlates } from '../lib/report-plates.ts';
import { PLAN_VERSION } from '../lib/plan-version.ts';
import { SHEET_RENDER_RECIPE } from '../lib/sheet-render-recipe.ts';

// A REPORT APPENDIX IS NOT A GALLERY.
//
// Rory: "does it pull the exact canvas maps or what?" — and the honest answer, for the first
// version, was: all of them. The gallery is a working record, every render ever made, exact and
// paid, across every revision of the plan rules. His holds over a hundred. As an appendix that is
// a hundred near-duplicate pages, most superseded, several from an older era and labelled so.

const V = PLAN_VERSION;

// The real label shapes, straight from pushGallery.
const exact = (sheet: string, at: string, planVersion = V) =>
  ({ id: `${sheet}-exact-${at}`, label: `${sheet} · Exact master`, at, planVersion });
const polished = (sheet: string, at: string, planVersion = V) =>
  ({ id: `${sheet}-ai-${at}`, label: `${sheet} · Reference Blueprint · AI Polished · geometry locked`, at, planVersion });

test('one plate per sheet — the latest, whichever finish made it', () => {
  const plates = selectReportPlates([
    exact('06 — Planting & Agroforestry', '2026-08-01T08:00:00Z'),
    polished('06 — Planting & Agroforestry', '2026-08-10T20:00:00Z'),
    exact('06 — Planting & Agroforestry', '2026-08-09T09:00:00Z'),
  ], V);
  assert.equal(plates.length, 1, 'the same sheet appeared more than once');
  assert.match(plates[0].label, /AI Polished/, 'the newest render did not win');
});

test('the appendix reads in sheet order, not the order they were made', () => {
  const plates = selectReportPlates([
    exact('09 — Phasing', '2026-08-02T10:00:00Z'),
    exact('01 — Site Survey', '2026-08-08T10:00:00Z'),
    exact('06 — Planting & Agroforestry', '2026-08-03T10:00:00Z'),
  ], V);
  assert.deepEqual(plates.map((p) => p.label.split(' ·')[0]),
    ['01 — Site Survey', '06 — Planting & Agroforestry', '09 — Phasing']);
});

test('sheets from an older plan generation are left out — unless they are all there is', () => {
  // An older sheet CONTAINS different things and the gallery labels it "· older version" for that
  // reason; printing one in a report presents it as current.
  const mixed = selectReportPlates([
    exact('06 — Planting & Agroforestry', '2026-08-10T10:00:00Z', 'v40'),
    exact('06 — Planting & Agroforestry', '2026-08-01T10:00:00Z', V),
  ], V);
  assert.equal(mixed.length, 1);
  assert.match(mixed[0].id, /2026-08-01/, 'a superseded-era sheet beat a current one');

  // But a farmer whose sheets are ALL old still gets their maps: a report with no maps is worse
  // than a report with the maps they actually have.
  const onlyOld = selectReportPlates([
    exact('06 — Planting & Agroforestry', '2026-08-10T10:00:00Z', 'v40'),
  ], V);
  assert.equal(onlyOld.length, 1, 'a farmer with only older sheets got an empty appendix');
});

test('a pre-fix bitmap cannot beat a current renderer result from the same plan generation', () => {
  const planting = '06 — Planting & Agroforestry';
  const plates = selectReportPlates([
    {
      ...polished(planting, '2026-08-16T12:00:00Z'),
      renderRecipe: 'r4',
    },
    {
      ...exact(planting, '2026-08-16T11:00:00Z'),
      renderRecipe: SHEET_RENDER_RECIPE,
    },
  ], V, SHEET_RENDER_RECIPE);

  assert.equal(plates.length, 1);
  assert.match(plates[0].id, /exact/, 'the newer but visibly obsolete bitmap entered the report');
});

test('a hundred-map gallery cannot produce a hundred-page appendix', () => {
  const gallery = [];
  for (let i = 0; i < 104; i++) {
    const sheet = `0${(i % 9) + 1} — Sheet ${(i % 9) + 1}`;
    gallery.push(exact(sheet, new Date(Date.UTC(2026, 7, 1, i)).toISOString()));
  }
  const plates = selectReportPlates(gallery, V);
  assert.equal(plates.length, 9, `104 saved maps produced ${plates.length} plates`);
  assert.ok(plates.length <= MAX_REPORT_PLATES);
  // Every id is distinct — no sheet is printed twice.
  assert.equal(new Set(plates.map((p) => p.id)).size, plates.length);
});

test('the sheet key collapses finish, style and era — and nothing else', () => {
  const planting = '06 — Planting & Agroforestry';
  assert.equal(plateSheetKey(`${planting} · Exact master`), plateSheetKey(`${planting} · Reference Blueprint · AI Polished · geometry locked`));
  assert.equal(plateSheetKey(`${planting} · older version`), plateSheetKey(`${planting} · Exact master`));
  // Two genuinely different sheets must NOT collapse together.
  assert.notEqual(plateSheetKey('06 — Planting · Exact master'), plateSheetKey('04 — Water · Exact master'));
});

test('junk rows are dropped rather than printed as blank pages', () => {
  const plates = selectReportPlates([
    { id: '', label: '06 — Planting · Exact master', at: '2026-08-10T10:00:00Z', planVersion: V },
    { id: 'x', label: '   ', at: '2026-08-10T10:00:00Z', planVersion: V },
    exact('06 — Planting', '2026-08-10T11:00:00Z'),
  ], V);
  assert.equal(plates.length, 1);
  assert.equal(plates[0].id, exact('06 — Planting', '2026-08-10T11:00:00Z').id);
  assert.deepEqual(selectReportPlates([], V), []);
});

test('the report export uses the selection, not the raw gallery', () => {
  const view = readFileSync(new URL('../components/ReportView.tsx', import.meta.url), 'utf8');
  assert.match(view, /selectReportPlates\(sheetMetas, PLAN_VERSION, SHEET_RENDER_RECIPE\)/,
    'the export is back to handing every saved sheet to the PDF');
  assert.match(view, /sheets: plates,/, 'the PDF is not being given the selected plates');
  assert.ok(!/sheets: sheetMetas\.map/.test(view), 'the raw gallery mapping is back');
});

test('the plan version has one home', () => {
  // Two copies of a version number drift on the next bump — the same defect in another shape.
  const glossy = readFileSync(new URL('../components/design/DesignGlossy.tsx', import.meta.url), 'utf8');
  assert.ok(!/const PLAN_VERSION = '/.test(glossy),
    'DesignGlossy declares its own PLAN_VERSION again — it will drift from the report appendix');
  assert.match(glossy, /import \{ PLAN_VERSION \} from '@\/lib\/plan-version'/);
});
