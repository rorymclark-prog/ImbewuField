import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  ENGINES, FINISHES, QUALITIES, STYLES,
  exportSummary, formatBytes, formatSavedAt, savedMapBadge, sheetGallery, galleryProgress,
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

test('each saved map can be deleted without touching the design', () => {
  const page = source(PAGE);
  assert.match(page, /deleteSheet\(meta\.id\)/, 'the row does not delete its stored sheet');
  assert.match(page, /aria-label=\{`Delete saved map: \$\{m\.label\}`\}/,
    'the delete target is not attached to a specific saved map');
  assert.match(page, /window\.confirm\(`Delete this saved map\?[\s\S]*Your design will stay unchanged\.`\)/,
    'a destructive tap must confirm both what goes and what stays');
  assert.match(page, /setMetas\(\(rows\) => rows\.filter\(\(row\) => row\.id !== meta\.id\)\)/,
    'the deleted row would remain visible until a reload');
  assert.doesNotMatch(page, /clearSheets\(/,
    'a per-row delete must never clear every saved map for the site');
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

test('the page registers its own back control, so the floating one stands down', () => {
  // A REAL BUG, CAUGHT BY LOOKING AT IT. The first build rolled its own back link, which does not
  // register — so BackControlProvider's fixed fallback pill dropped itself on top of the page
  // title and "Preview & Export" rendered as "review & Export". That is a named, already-fixed
  // overlap class in this app (see IdentityBar's note about the pill landing on the map's left
  // tool panel), and rendering the shared BackButton is what avoids it.
  const page = shipped(PAGE);
  assert.match(page, /<BackButton fallback="\/design-studio-2" \/>/, 'the shared back control is gone again');
  assert.match(page, /import BackButton from '@\/components\/BackButton'/);
  // The shared one is the only one that calls useRegisterBackControl.
  const back = source('../components/BackButton.tsx');
  assert.match(back, /useRegisterBackControl\(\)/, 'BackButton stopped registering — the pill will return everywhere');
  // And no hand-rolled replacement crept back alongside it.
  assert.doesNotMatch(page, /aria-label="Back/, 'a second back control would put two on one screen');
});

// ── Every sheet at once ───────────────────────────────────────────────────────────────────────
//
// PREVIEW-EXPORT-V2.md §2.1 calls this "the headline of the ask and the biggest single change":
// the studio previews one sheet at a time, and what Rory wants is the whole plan set on screen.

const meta = (label: string, at: string, extra: Record<string, unknown> = {}) => ({
  id: `${label}-${at}`, siteId: 's', label, at, thumb: `thumb:${label}`, ...extra,
} as never);

test('the grid is always nine cells, rendered or not', () => {
  const cells = sheetGallery([meta('04 — Water & Irrigation · Exact master', '2026-08-10T09:00:00Z')]);
  assert.equal(cells.length, 9, 'the plan set is nine sheets whether or not they exist yet');
  assert.deepEqual(cells.map((c) => c.no), ['01', '02', '03', '04', '05', '06', '07', '08', '09']);
  // The empty slots are the point: "what is still missing" is the question only they can answer.
  assert.deepEqual(galleryProgress(cells), { done: 1, total: 9 });
  const water = cells.find((c) => c.no === '04')!;
  assert.equal(water.count, 1);
  assert.ok(water.savedId);
  const zones = cells.find((c) => c.no === '03')!;
  assert.equal(zones.savedId, null);
  assert.equal(zones.thumb, null);
  assert.equal(zones.badge, null);
  assert.equal(zones.savedAt, null);
});

test('a sheet with several saves shows its newest, and says how many there are', () => {
  const cells = sheetGallery([
    meta('06 — Planting · Exact master', '2026-08-09T08:00:00Z', { resultKind: 'exact' }),
    meta('06 — Planting · AI Polished', '2026-08-11T17:00:00Z', { resultKind: 'hybrid' }),
    meta('06 — Planting · older', '2026-08-01T08:00:00Z', { resultKind: 'exact' }),
  ]);
  const planting = cells.find((c) => c.no === '06')!;
  assert.equal(planting.count, 3, 'the grid must say there is more than one without holding them');
  assert.equal(planting.savedAt, '2026-08-11T17:00:00Z', 'the newest save should be the one shown');
  assert.equal(planting.badge?.label, 'AI Polished');
  assert.equal(galleryProgress(cells).done, 1, 'three saves of one sheet is still one sheet rendered');
});

test('a row that is not one of the canonical nine is counted nowhere', () => {
  // Forcing an old era's label or a hand-named export into a neighbouring sheet would put a
  // picture under a heading it does not belong to.
  const cells = sheetGallery([
    meta('Some hand-named export', '2026-08-10T09:00:00Z'),
    meta('12 — A sheet that does not exist', '2026-08-10T09:00:00Z'),
    meta('', '2026-08-10T09:00:00Z'),
  ]);
  assert.deepEqual(galleryProgress(cells), { done: 0, total: 9 });
  assert.ok(cells.every((c) => c.savedId === null));
  // And an empty store is nine empty cells, not a crash.
  assert.equal(sheetGallery([]).length, 9);
});

test('the grid renders thumbnails and never promotes a sheet to its full image', () => {
  // THE CRASH THIS VIEW IS CLOSEST TO. Nine sheets at 1–3 MB each is exactly what
  // PREVIEW-EXPORT-V2.md §3 warns a grid must never hold. A row saved before thumbnails existed
  // shows as un-previewed rather than falling back to `image` to fill the hole.
  const withoutThumb = sheetGallery([
    { id: 'x', siteId: 's', label: '01 — Existing Site', at: '2026-08-10T09:00:00Z', image: 'data:image/png;base64,AAAA' } as never,
  ]);
  const site = withoutThumb.find((c) => c.no === '01')!;
  assert.ok(site.savedId, 'the row still counts as rendered');
  assert.equal(site.thumb, null, 'a missing thumb must not fall back to the full image');

  const page = source(PAGE);
  const grid = page.slice(page.indexOf("{view === 'all' ?"), page.indexOf("</div>\n          ) : preview ?"));
  assert.match(grid, /src=\{cell\.thumb\}/);
  assert.doesNotMatch(grid, /loadSheetImage|preview\.image/, 'the grid is reaching for full images');
});

test('choosing a sheet from the grid opens exactly that sheet, one at a time', () => {
  const page = source(PAGE);
  const grid = page.slice(page.indexOf("{view === 'all' ?"), page.indexOf("</div>\n          ) : preview ?"));
  assert.match(grid, /setSheet\(cell\.id\)/, 'the settings rail must follow the card that was tapped');
  assert.match(grid, /setView\('single'\)/, 'tapping a card should show it at a readable size');
  assert.match(grid, /if \(cell\.savedId\) void openSheet\(cell\.savedId\)/,
    'an un-rendered sheet has nothing to open and must not request one');
});

test('the single-sheet chrome does not float over the grid', () => {
  // The sector chips, north point and zoom toolbar belong to ONE sheet on an easel. Left over the
  // nine-up they would sit on top of unrelated thumbnails and mean nothing.
  const page = source(PAGE);
  for (const marker of ['Sector chips', 'North arrow', 'Viewer toolbar']) {
    const at = page.indexOf(marker);
    assert.ok(at > 0, `${marker} block is gone`);
    const before = page.slice(Math.max(0, at - 400), at + 400);
    assert.match(before, /view === 'single'/, `${marker} is not gated to the single view`);
  }
});

test('nothing on this page is brown', () => {
  // Rory: "do you think we should have the brown background?" — and then, after my first answer:
  // "only the centre modal seems changed and it's browner."
  //
  // He was right and the first fix was wrong. It moved the page one step lighter and put the EASEL
  // on --bg, on the principle that a recessed well sits darker than its page. That principle holds
  // on a neutral palette; here every token is a beige, so "darker" only ever reads as "browner",
  // and a browner centre was the single visible result. --bg (#E4DCC6) is the brownest token in
  // the set, and this page paints nothing with it.
  const page = source(PAGE);
  const shell = page.slice(page.indexOf('flex min-h-dvh flex-col'), page.indexOf('Page header'));
  assert.match(shell, /background: 'var\(--surface-2\)'/, 'the page ground went dark again');

  const stage = page.slice(page.indexOf('relative flex min-h-'), page.indexOf('SINGLE / ALL SHEETS'));
  assert.match(stage, /background: 'var\(--surface\)'/,
    'the easel is a blank sheet of paper — defined by its border, not by a darker tone');

  assert.doesNotMatch(shipped(PAGE), /var\(--bg\)/, '--bg (#E4DCC6) is back on the page');
});
