import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// copy-16: components/ReportView.tsx's PDF-export error handler used to append the raw
// JavaScript error message ('Failed to fetch', 'NetworkError when attempting to fetch
// resource...') straight onto the farmer-facing sentence. copy-14: several date renders in
// app/mentor/page.tsx and components/report/SavedReportsList.tsx called toLocaleDateString()
// with no locale (or `undefined`), which reads the device's browser locale and prints the en-US
// '10/16/2026' on a phone set to that, instead of the en-ZA '2026/10/16' the rest of the app uses.

const reportView = () => readFileSync(new URL('../components/ReportView.tsx', import.meta.url), 'utf8');
const savedReportsList = () => readFileSync(new URL('../components/report/SavedReportsList.tsx', import.meta.url), 'utf8');
const mentorPage = () => readFileSync(new URL('../app/mentor/page.tsx', import.meta.url), 'utf8');

test('the PDF export error no longer appends the raw JS error message to the farmer-facing text', () => {
  const src = reportView();
  const catchBlock = src.slice(src.indexOf('const blob = await buildReportPdf'), src.indexOf('}, [report, d, reading'));
  assert.doesNotMatch(catchBlock, /err\.message\}`/, 'the raw error message is still interpolated into the user-facing string');
  assert.match(catchBlock, /console\.error\(.*err\.message\)/, 'the raw error message should still reach the console for debugging');
  assert.match(catchBlock, /Could not build the PDF\. Check your connection and try again\./, 'the translated fallback sentence is missing');
  assert.match(src, /'Could not build the PDF\. Check your connection and try again\.': '/, 'the isiZulu translation for the new sentence is missing from the known-strings map');
});

test('SavedReportsList dates follow en-ZA/zu-ZA, not the browser default locale', () => {
  const src = savedReportsList();
  assert.doesNotMatch(src, /toLocaleDateString\(\)/, 'a bare toLocaleDateString() call remains');
  assert.doesNotMatch(src, /toLocaleDateString\(undefined/, 'a toLocaleDateString(undefined, …) call remains');
  assert.doesNotMatch(src, /toLocaleTimeString\(\[\]/, 'a toLocaleTimeString([], …) call (browser-default locale) remains');
  assert.match(src, /const dateLocale = lang === 'zu' \? 'zu-ZA' : 'en-ZA'/, 'the shared dateLocale constant is gone');
});

test("mentor's enrolled-date line follows en-ZA/zu-ZA consistently", () => {
  const src = mentorPage();
  assert.doesNotMatch(src, /toLocaleDateString\(\)(?!,)/, 'a bare toLocaleDateString() call remains on the mentor page');
});
