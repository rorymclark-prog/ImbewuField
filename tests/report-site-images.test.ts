import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  ANALYSIS_IMAGE_MAX_PX,
  MAX_ANALYSIS_IMAGES,
  base64Bytes,
  normaliseSiteAnalysisImages,
  prepareSiteAnalysisImages,
  selectAnalysisPlates,
  siteImagesPromptBlock,
} from '../lib/report-site-images.ts';
import type { ReportPlate } from '../lib/report-plates.ts';

// THE REPORT THAT NEVER LOOKED AT THE FARM.
//
// Rory, after generating one: "there is still no images … the audit said the report needs to also
// draw analyses from these images, not generic zone information". Two failures in one sentence.
// The design sheets reached the exported PDF only — the report on screen, which is the one a
// farmer actually reads, had no maps at all. And nothing the model wrote had ever SEEN the plan:
// the geometry crossed as numbers, so anything living in the arrangement rather than in the
// figures could only be answered out of a textbook.

const plate = (label: string, id = label): ReportPlate => ({ id, label });

const SHEETS = [
  plate('01 — Existing Site & Boundary · Exact master'),
  plate('02 — Sector Analysis · Exact master'),
  plate('03 — Permaculture Zones · AI Polished · geometry locked'),
  plate('04 — Water & Irrigation · Exact master'),
  plate('06 — Planting & Agroforestry · Exact master'),
  plate('08 — Final Integrated Masterplan · AI Polished · geometry locked'),
];

test('the masterplan is the first sheet the model is shown', () => {
  const chosen = selectAnalysisPlates(SHEETS);
  assert.equal(chosen.length, MAX_ANALYSIS_IMAGES);
  assert.match(chosen[0].label, /^08 /, 'the whole design on one sheet must lead');
  assert.match(chosen[1].label, /^01 /, 'the existing site is what every recommendation answers to');
  assert.match(chosen[2].label, /^04 /);
  // Sector analysis is last on purpose: sun and wind already cross as numbers in the site data, so
  // it is the sheet a vision model adds least to. Paying for it would displace a sheet that earns.
  assert.ok(!chosen.some((c) => /^02 /.test(c.label)), 'sector analysis displaced a design sheet');
});

test('a farmer with only a couple of sheets sends only those', () => {
  assert.deepEqual(
    selectAnalysisPlates([plate('06 — Planting'), plate('02 — Sector Analysis')]).map((p) => p.label),
    ['06 — Planting', '02 — Sector Analysis'],
  );
  assert.deepEqual(selectAnalysisPlates([]), []);
  // Junk rows are dropped rather than sent as empty images.
  assert.deepEqual(selectAnalysisPlates([{ id: '', label: '08 — Masterplan' }, { id: 'x', label: '  ' }]), []);
});

const jpeg = (payload: string) => `data:image/jpeg;base64,${payload}`;

test('sheets are loaded, shrunk and encoded ONE AT A TIME', async () => {
  // The memory contract, and the reason this is sequential rather than a Promise.all: a saved
  // sheet is a 1–3 MB data URL and this runs on the phone that has been dying of exactly that.
  const live: string[] = [];
  const peak: number[] = [];
  const images = await prepareSiteAnalysisImages(
    SHEETS,
    async (id) => {
      live.push(id);
      peak.push(live.length);
      return jpeg('AAAA');
    },
    async (dataUrl, maxPx, quality) => {
      live.pop();
      assert.equal(maxPx, ANALYSIS_IMAGE_MAX_PX);
      assert.ok(quality > 0 && quality < 1);
      assert.ok(dataUrl.startsWith('data:image/jpeg;base64,'));
      return { dataUrl: jpeg('BBBB') };
    },
  );
  assert.equal(Math.max(...peak), 1, 'more than one full-resolution sheet was held at once');
  assert.equal(images.length, MAX_ANALYSIS_IMAGES);
  // The wire format is the payload alone — a `data:` prefix inside an image block is not base64.
  assert.deepEqual(images.map((i) => i.data), ['BBBB', 'BBBB', 'BBBB']);
  assert.deepEqual(images.map((i) => i.mediaType), ['image/jpeg', 'image/jpeg', 'image/jpeg']);
  assert.match(images[0].label, /^08 /, 'the label the prompt names the figure by was lost');
});

test('an unreadable sheet costs its figure, never the report', async () => {
  const images = await prepareSiteAnalysisImages(
    SHEETS,
    async (id) => {
      if (id.startsWith('08')) throw new Error('IndexedDB row gone');
      if (id.startsWith('01')) return null;
      return jpeg('AAAA');
    },
    async () => ({ dataUrl: jpeg('CCCC') }),
  );
  assert.equal(images.length, 1, 'the surviving sheet should still be sent');
  assert.match(images[0].label, /^04 /);

  // A downscaler that throws, and one that returns nothing, are both survivable.
  assert.deepEqual(await prepareSiteAnalysisImages(SHEETS, async () => jpeg('AAAA'), async () => { throw new Error('no canvas'); }), []);
  assert.deepEqual(await prepareSiteAnalysisImages(SHEETS, async () => jpeg('AAAA'), async () => null), []);
});

test('the upload budget is enforced on a phone connection', async () => {
  const big = 'A'.repeat(4000); // 3 000 bytes decoded
  const images = await prepareSiteAnalysisImages(
    SHEETS,
    async () => jpeg('AAAA'),
    async () => ({ dataUrl: jpeg(big) }),
    5_000, // room for one, not two
  );
  assert.equal(images.length, 1, 'the request would have carried more than the budget allows');
  assert.equal(base64Bytes(big), 3000);
  assert.equal(base64Bytes('AAAA='.slice(0, 4)), 3);
});

test('what arrives at the API is checked, not trusted', () => {
  const ok = { label: 'Sheet 08', mediaType: 'image/jpeg', data: 'AAAA' };
  assert.deepEqual(normaliseSiteAnalysisImages([ok]), [
    { label: 'Sheet 08', mediaType: 'image/jpeg', data: 'AAAA' },
  ]);
  // Anything malformed is DROPPED, never repaired — these are forwarded into a paid upstream call.
  assert.deepEqual(normaliseSiteAnalysisImages(undefined), []);
  assert.deepEqual(normaliseSiteAnalysisImages('AAAA'), []);
  assert.deepEqual(normaliseSiteAnalysisImages([null, 7, 'x']), []);
  assert.deepEqual(normaliseSiteAnalysisImages([{ ...ok, mediaType: 'image/png' }]), []);
  assert.deepEqual(normaliseSiteAnalysisImages([{ ...ok, data: 'not base64!!' }]), []);
  assert.deepEqual(normaliseSiteAnalysisImages([{ ...ok, data: 'data:image/jpeg;base64,AAAA' }]), []);
  assert.deepEqual(normaliseSiteAnalysisImages([{ ...ok, data: 'AAA' }]), [], 'base64 arrives in quads');
  // Count is capped before size, so a crafted body cannot drive an unbounded upstream call.
  assert.equal(normaliseSiteAnalysisImages(new Array(40).fill(ok)).length, MAX_ANALYSIS_IMAGES);
  // A single oversized payload is refused rather than truncated into a broken image.
  assert.deepEqual(normaliseSiteAnalysisImages([{ ...ok, data: 'A'.repeat(4_000_000) }]), []);
  // Labels are presentation text from the client: normalised, capped, never empty.
  const [odd] = normaliseSiteAnalysisImages([{ ...ok, label: `  08  —\n Masterplan ${'x'.repeat(300)}` }]);
  assert.ok(odd.label.length <= 120);
  assert.ok(!/\n/.test(odd.label));
  assert.equal(normaliseSiteAnalysisImages([{ ...ok, label: 42 }])[0].label, 'Design sheet');
});

test('the prompt names each figure and forbids measuring off a picture', () => {
  const block = siteImagesPromptBlock([
    { label: '08 — Masterplan', mediaType: 'image/jpeg', data: 'AAAA' },
    { label: '04 — Water Plan', mediaType: 'image/jpeg', data: 'AAAA' },
  ]);
  assert.match(block, /Figure 1: 08 — Masterplan/);
  assert.match(block, /Figure 2: 04 — Water Plan/);
  // The point of the whole change: generic advice is a failure, not a fallback.
  assert.match(block, /Advice that would read the same for any farm/);
  // And the two limits that keep a picture from becoming a source of numbers or of inventions —
  // a model will happily estimate an area off a plan, and that estimate would sit on the page
  // beside the farmer's measured one with nothing to tell them apart.
  assert.match(block, /EVERY NUMBER comes from the measured site data/);
  assert.match(block, /Describe only what is actually drawn/);
  assert.equal(siteImagesPromptBlock([]), '', 'no images, no clause about images');
});

test('every batch is shown the sheets, images before text', () => {
  // Batches are independent Anthropic calls that cannot see each other — that is why the
  // anti-invention rule is a system prompt. A picture attached to the first batch only would
  // inform one or two sections and leave every other one writing blind.
  const route = readFileSync(new URL('../app/api/generate-report/route.ts', import.meta.url), 'utf8');
  assert.match(route, /const siteImages = normaliseSiteAnalysisImages\(body\.siteImages\)/,
    'the API takes the client\'s images without validating them');
  assert.match(route, /messages: \[\{ role: 'user', content: messageContent\(buildPrompt\(/,
    'the batch call no longer carries the sheets');
  const start = route.indexOf('const messageContent =');
  const body = route.slice(start, route.indexOf('const runBatch =', start));
  // Reading order matters to a vision model: name the figures, show them, then ask for the
  // sections. Probed through the attachment itself rather than through `type: 'image'`, which
  // moved into a shared `asImage` helper when ground photos joined the message and now appears
  // ABOVE the prompt block without anything having gone wrong.
  const promptAt = body.indexOf('siteImagesPromptBlock(siteImages)');
  const imageAt = body.indexOf('siteImages.map(asImage)');
  const textAt = body.lastIndexOf('text: promptText');
  assert.ok(promptAt > 0, 'the sheets are no longer named for the model');
  assert.ok(imageAt > promptAt, 'the sheets are shown before they are named');
  assert.ok(textAt > imageAt, 'the sections are asked for before the sheets are shown');
  // A site with NOTHING to look at still sends a plain string prompt. This used to read
  // `!siteImages.length` alone; ground photos (lib/report-ground-photos.ts) joined the message on
  // 13 August, so a site with no sheets but with photographs must now build the array too — the
  // shortcut is for a message with no pictures in it at all, not for a message with no sheets.
  assert.match(body, /if \(!siteImages\.length && !groundPhotos\.length\) return promptText/,
    'a site with nothing to look at must still send a plain string prompt');
});

test('the report screen shows the maps and sends them to be read', () => {
  const view = readFileSync(new URL('../components/ReportView.tsx', import.meta.url), 'utf8');
  // 1. The maps are IN the report on screen, not only in the exported PDF.
  assert.match(view, /Your design maps/, 'the report on screen has no figures again');
  assert.match(view, /plate\.thumb/, 'the strip is holding print-resolution masters in state');
  assert.match(view, /loadSheetImage\(plate\.id\)/, 'opening a sheet must fetch it on demand');
  // 2. And they are sent for analysis, prepared with the same downscaler the PDF plates use.
  assert.match(view, /prepareSiteAnalysisImages\(plates, loadSheetImage, sheetPlate\)/);
  assert.match(view, /siteImages: siteImages\.length \? siteImages : undefined/);
  // 3. A site with no saved sheets says so rather than quietly producing a mapless report.
  assert.match(view, /No design maps are saved for this site yet/);
});
