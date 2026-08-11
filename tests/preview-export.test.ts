import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  ENGINES, FINISHES, QUALITIES, STYLES,
  exportSummary, formatBytes, formatSavedAt, savedMapBadge,
} from '../lib/preview-export.ts';
import { RENDER_ENGINES } from '../lib/render-job-contract.ts';

// PREVIEW & EXPORT — Rory's tablet mockup, built.
//
// "this is not related but i want this page like this". It is Mockup B in
// design/PREVIEW-EXPORT-V2.md, and §3 of that file lists where the picture contradicts decisions
// he has already taken. These tests hold the page to the decisions, because a mockup is the
// easiest possible thing to trace back in by accident — the picture is right there, and it is
// prettier than the constraint.

const PAGE = '../components/design-studio-2/PreviewExport.tsx';
const source = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8');

/** Source with its comments stripped. The comments EXPLAIN the constraints — "Full Treatment is
 *  shelved", "no emoji as UI icons" — so a plain grep for a forbidden string finds the sentence
 *  forbidding it and fails. What matters is whether the string can reach a farmer's screen. */
const shipped = (rel: string) => source(rel)
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');

test('the picker offers two finishes, and the shelved paid pass is not one of them', () => {
  // THE ONE THAT COSTS MONEY. The mockup draws Exact Canvas / AI Hybrid / Full Treatment plus a
  // promo panel selling "2 paid renders". Full Treatment is shelved on Rory's own instruction —
  // "I just want an exact version for now and a ai render polished version also those 2" — and
  // tests/sheet-finishes.test.ts guards that in the studio. Drawing it back onto a nicer screen
  // would spend a farmer's render on a pass we withdrew because it was broken.
  assert.equal(FINISHES.length, 2);
  assert.deepEqual(FINISHES.map((f) => f.id), ['exact', 'ai-polished']);
  const text = JSON.stringify(FINISHES);
  assert.doesNotMatch(text, /Full Treatment/i, 'the shelved second paid pass is back on offer');
  // And the farmer-facing name is "AI Polished". `hybrid` stays internal — queue keys, resultKind.
  assert.doesNotMatch(text, /Hybrid/i, 'the internal stage name leaked into farmer-facing copy');
  assert.match(text, /AI Polished/);

  assert.doesNotMatch(shipped(PAGE), /Full Treatment/, 'the promo panel from the mockup was built anyway');
});

test('the engine picker can only offer engines the queue can actually run', () => {
  // A dropdown naming a model the worker cannot be dispatched to is a menu of failures. Deriving
  // from the contract means adding an engine there is the only way one appears here.
  assert.deepEqual(ENGINES.map((e) => e.id), [...RENDER_ENGINES]);
  for (const e of ENGINES) assert.ok(e.label.trim().length > 0, `${e.id} has no farmer-facing name`);
});

test('a quality tier and its DPI cannot drift apart', () => {
  // They are quoted in the same summary the farmer reads before paying for a print, so they are
  // defined in one place. High must actually be the highest.
  assert.deepEqual(QUALITIES.map((q) => q.id), ['high', 'medium', 'low']);
  const dpis = QUALITIES.map((q) => q.dpi);
  assert.deepEqual([...dpis].sort((a, b) => b - a), dpis, 'a lower tier claims a higher DPI');
  assert.equal(QUALITIES[0].dpi, 300);
});

test('a saved map is badged from its provenance, never from its label', () => {
  // lib/sheet-store.ts is explicit: "Labels are presentation copy and must never be used to infer
  // whether a paid model actually produced the saved pixels."
  assert.equal(savedMapBadge({ resultKind: 'exact' }).label, 'Exact');
  assert.equal(savedMapBadge({ resultKind: 'ai-polished' }).label, 'AI Polished');
  assert.equal(savedMapBadge({ resultKind: 'hybrid' }).label, 'AI Polished');
  assert.equal(savedMapBadge({ resultKind: 'ai-illustrated' }).label, 'Illustrated');
  // A row saved before provenance existed reads as legacy rather than being flattered into paid.
  assert.equal(savedMapBadge({ resultKind: 'legacy' }).label, 'Legacy');
  assert.equal(savedMapBadge({}).label, 'Legacy');
  assert.equal(savedMapBadge({ resultKind: undefined }).label, 'Legacy');
});

test('the export summary never invents a file size', () => {
  // THE POINT OF THIS TEST. The mockup states "~24.6 MB" for an export that has not run. Nothing
  // on the screen knows that — sheets are stored one by one and adding them up means loading
  // every one, which is the memory contract this page exists to respect. So with nothing
  // measured, the row is a dash and the note says why.
  const empty = exportSummary({ quality: 'high', style: 'blueprint', labels: 'codes', showCounts: true, bytes: null });
  const sizeRow = empty.rows.find((r) => r.k === 'This sheet');
  assert.equal(sizeRow?.v, '—', 'a size was produced for an export that has not run');
  assert.match(empty.note, /Open a saved sheet/);
  assert.doesNotMatch(JSON.stringify(empty), /~?\d+(\.\d+)?\s*MB/, 'a megabyte figure appeared from nowhere');

  // With a sheet on the easel it reports THAT sheet, and says so rather than implying a total.
  const measured = exportSummary({ quality: 'high', style: 'blueprint', labels: 'codes', showCounts: true, bytes: 2_600_000 });
  assert.equal(measured.rows.find((r) => r.k === 'This sheet')?.v, '2.5 MB');
  assert.match(measured.note, /Measured from the sheet on screen/);
  assert.match(measured.note, /nothing here estimates it for you/);
});

test('the summary describes the settings actually chosen', () => {
  const withCounts = exportSummary({ quality: 'medium', style: 'photo-plan', labels: 'codes', showCounts: true, bytes: null });
  assert.equal(withCounts.rows.find((r) => r.k === 'Resolution')?.v, '200 DPI');
  assert.equal(withCounts.rows.find((r) => r.k === 'Style')?.v, 'Photo Plan');
  assert.match(withCounts.rows.find((r) => r.k === 'Include')!.v, /Labels \+ counts/);

  const noLabels = exportSummary({ quality: 'low', style: 'blueprint', labels: 'none', showCounts: true, bytes: null });
  assert.equal(noLabels.rows.find((r) => r.k === 'Resolution')?.v, '150 DPI');
  // Labels off means labels are not listed as included, even with the counts switch left on.
  assert.doesNotMatch(noLabels.rows.find((r) => r.k === 'Include')!.v, /Label/);
  // The furniture the renderer always draws is still promised.
  assert.match(noLabels.rows.find((r) => r.k === 'Include')!.v, /Legend · Scale bar · North arrow/);
});

test('bytes and timestamps read like the mockup, and degrade instead of lying', () => {
  assert.equal(formatBytes(0), '—');
  assert.equal(formatBytes(-1), '—');
  assert.equal(formatBytes(Number.NaN), '—');
  assert.equal(formatBytes(900), '900 B');
  assert.equal(formatBytes(2048), '2 KB');
  assert.equal(formatBytes(1_572_864), '1.5 MB');

  const now = new Date('2026-08-11T18:00:00Z');
  assert.match(formatSavedAt('2026-08-11T12:32:00', now), /^Today · \d{2}:\d{2}$/);
  assert.match(formatSavedAt('2026-08-10T16:45:00', now), /^Yesterday · \d{2}:\d{2}$/);
  // Locale decides whether that reads "9 Aug" or "Aug 9"; both are fine, an ISO string is not.
  assert.match(formatSavedAt('2026-08-09T10:21:00', now), /Aug.*· \d{2}:\d{2}$/);
  // A corrupt row must not render "Invalid Date" into the gallery.
  assert.equal(formatSavedAt('not a date', now), '');
});

test('the saved-maps rail holds thumbnails, never a wall of full sheets', () => {
  // THE CRASH THIS PAGE COULD RE-CREATE. A saved sheet is a 1–3 MB data URL, and a grid holding
  // full images is what took the app down on 10 August (lib/sheet-store.ts's memory contract).
  // The mockup shows "Saved maps (132)".
  const page = source(PAGE);
  assert.match(page, /loadSheetMetas\(siteId\)/, 'the rail must read metas, not sheets');
  assert.doesNotMatch(page, /loadSheets\(/, 'loadSheets pulls every full image into memory at once');
  assert.match(page, /src=\{m\.thumb\}/, 'the list is rendering something other than the small thumb');
  // Exactly one full image at a time, and the previous one dropped before the next is requested.
  const open = page.slice(page.indexOf('const openSheet ='), page.indexOf('}, []);', page.indexOf('const openSheet =')));
  assert.ok(open.indexOf('setPreview(null)') < open.indexOf('loadSheetImage'),
    'the previous full sheet must be released before the next is fetched');
});

test('the page is phone-first, with the mockup\'s columns arriving at lg', () => {
  // DESIGN.md §0: never reuse phone px on desktop, or a desktop layout on a phone. The mockup is
  // a tablet three-column; a farmer opens this on a handset.
  const page = source(PAGE);
  const body = page.slice(page.indexOf('Body: one column'), page.indexOf('Settings rail'));
  assert.match(body, /lg:grid-cols-\[320px_minmax\(0,1fr\)_320px\]/, 'the three columns must be an lg: upgrade');
  // Any column track-list must carry a breakpoint prefix. An unprefixed one applies on a phone.
  assert.doesNotMatch(body, /(?<![a-z]:)grid-cols-/, 'the body columns must not apply below lg');
  // Lucide only, no emoji as UI icons (CLAUDE.md).
  assert.match(page, /from 'lucide-react'/);
  assert.doesNotMatch(shipped(PAGE), /[\u{1F300}-\u{1FAFF}]/u, 'emoji are not UI icons here');
  // Newsreader for headings and numbers, Public Sans for everything else — never JetBrains Mono.
  assert.doesNotMatch(page, /font-mono|JetBrains/, 'the mono face is not part of this UI');
  assert.match(page, /fontFamily: 'var\(--font-display\)'/, 'headings must use the display face');
});

test('the style cards do not pass a swatch off as a render', () => {
  // Putting the current sheet's thumbnail in all three cards would show one render under three
  // different style names — a preview of something the farmer has not paid for and cannot see.
  const page = source(PAGE);
  const block = page.slice(page.indexOf('{STYLES.map('), page.indexOf('</Step>', page.indexOf('{STYLES.map(')));
  assert.doesNotMatch(block, /thumb|loadSheetImage|preview\.image/, 'a style card is showing a real render');
  assert.match(block, /background: s\.swatch/);
  for (const s of STYLES) assert.ok(s.swatch.startsWith('linear-gradient('), `${s.id} has no swatch`);
});
