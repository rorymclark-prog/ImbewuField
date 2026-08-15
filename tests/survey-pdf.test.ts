import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { buildSurveyPdf, surveyPdfFilename } from '../lib/survey-pdf.ts';

// ── The bug: window.print() is a silent no-op in an installed PWA ───────────
//
// app/survey/page.tsx's "Print" button used to call window.print() directly. In an installed
// (manifest display: "standalone") PWA — the state most of our farmers' phones are in — that
// resolves without throwing and without showing anything: the button looks dead, and nothing
// is catchable to tell the farmer it failed. lib/survey-pdf.ts exists so the button builds a
// real file instead. These tests guard the wiring, not just the builder.

test('surveyPdfFilename stamps the date, and falls back to "undated" on a bad Date', () => {
  assert.equal(surveyPdfFilename(new Date('2026-08-15T12:00:00Z')), 'ImbewuField-Garden-Survey-2026-08-15.pdf');
  assert.equal(surveyPdfFilename(new Date('not-a-date')), 'ImbewuField-Garden-Survey-undated.pdf');
});

test('buildSurveyPdf returns a real PDF blob for a small survey', async () => {
  const blob = await buildSurveyPdf({
    beds: [{ letter: 'A', crop: 'Tomatoes' }, { letter: 'B', crop: 'Beans' }],
    bedAreaM2: 9.6,
    ha: 0.42,
    sunLabel: 'full sun',
    tanksPhrase: '2 tanks',
    goalLabel: 'Feed my family',
    weeks: [{ wk: 1, title: 'Mark & clear', tasks: ['Peg out the beds', 'Clear weeds and old roots'] }],
  });
  assert.equal(blob.type, 'application/pdf');
  assert.ok(blob.size > 500, `expected a real PDF, got ${blob.size} bytes`);
});

test('buildSurveyPdf breaks onto further pages instead of running text off the bottom', async () => {
  // A big plot (many beds) and a long task list are the ordinary case for the "income" goal
  // survey, not an edge case — this exercises the same need()-before-draw check that report-pdf.ts
  // uses, on a dataset large enough that skipping it would run text past the bottom margin.
  const manyBeds = Array.from({ length: 30 }, (_, i) => ({ letter: String.fromCharCode(65 + (i % 26)), crop: `Crop ${i}` }));
  const manyWeeks = Array.from({ length: 12 }, (_, i) => ({
    wk: i + 1,
    title: `Week ${i + 1} tasks`,
    tasks: Array.from({ length: 5 }, (_, j) => `Task ${i}-${j}: a task description long enough to wrap onto more than one line on the page`),
  }));
  const blob = await buildSurveyPdf({
    beds: manyBeds, bedAreaM2: 9.6, ha: 3.6, sunLabel: 'full sun', tanksPhrase: '2 tanks',
    goalLabel: 'Earn an income', weeks: manyWeeks,
  });
  const bytes = Buffer.from(await blob.arrayBuffer()).toString('latin1');
  const pageObjects = bytes.match(/\/Type\s*\/Page[^s]/g) ?? [];
  assert.ok(pageObjects.length > 1, `a 30-bed, 12-week survey must span more than one page, got ${pageObjects.length}`);
});

// ── The wiring: the button must go through the builder, not window.print() ──

const PAGE_SRC = readFileSync(new URL('../app/survey/page.tsx', import.meta.url), 'utf8');

test('the survey result screen never calls window.print() directly', () => {
  assert.doesNotMatch(
    PAGE_SRC,
    /onClick=\{\(\) => window\.print\(\)\}/,
    'the Print button must go through printPlan() — window.print() is a silent no-op in an installed PWA',
  );
});

test('printPlan builds the survey PDF and hands it to the device, and a failure is never silent', () => {
  const fn = PAGE_SRC.slice(PAGE_SRC.indexOf('async function printPlan()'), PAGE_SRC.indexOf('const TOTAL = 5;'));
  assert.match(fn, /buildSurveyPdf\(/, 'printPlan must build the PDF via lib/survey-pdf.ts');
  assert.match(fn, /deliverFile\(/, 'printPlan must hand the blob to the device via lib/file-delivery.ts');
  assert.match(fn, /catch\s*\{\s*setPdfFailed\(true\);/, 'a build/deliver failure must surface, not disappear — the exact bug this replaces');
});

test('the Print button is wired to printPlan and disables itself while building', () => {
  const headerButton = PAGE_SRC.slice(PAGE_SRC.indexOf("step === 5 && (\n          <button"), PAGE_SRC.indexOf('<Printer size={13} />'));
  assert.match(headerButton, /onClick=\{printPlan\}/);
  assert.match(headerButton, /disabled=\{pdfBusy\}/);
});
