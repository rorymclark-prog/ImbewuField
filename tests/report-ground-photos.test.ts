import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  GROUND_PHOTO_BUDGET_BYTES,
  MAX_GROUND_PHOTOS,
  groundPhotoGallery,
  groundPhotosPromptBlock,
  normaliseGroundPhotos,
  prepareGroundPhotos,
  selectGroundPhotos,
} from '../lib/report-ground-photos.ts';
import { evidenceKeyLabel } from '../lib/evidence-catalogue.ts';
import type { EvidenceItem } from '../lib/site-evidence.ts';

// "THERE IS STILL NO IMAGES … the audit said the report needs to also draw analyses from these
// images, not generic zone information."
//
// lib/report-site-images.ts answered half of that with the farmer's PLAN SHEETS. Their actual
// PHOTOGRAPHS — 52 catalogue tiles' worth, already sitting in localStorage — were thrown away one
// line before the request left the phone, under a comment that said so out loud:
//
//     // Build evidence summary (strip base64 thumbnails — send counts + notes only)
//
// So the model was handed `soil_erosion: 2 items` and asked to write about the soil. That is
// not a model failing to be specific. That is a model being given a number and asked for a picture.

const source = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8');

const JPEG = (kb = 30) => `data:image/jpeg;base64,${'A'.repeat(Math.ceil((kb * 1024 * 4) / 3 / 4) * 4)}`;

let seq = 0;
function photo(over: Partial<EvidenceItem> = {}): EvidenceItem {
  seq += 1;
  return { id: `p${seq}`, type: 'photo', dataUrl: JPEG(), takenAt: 1_000 + seq, ...over };
}

test('the catalogue names a photo instead of handing over its storage key', () => {
  // `water_dam_pond` printed as "water dam pond" is a model being asked to guess, and guessing is
  // the one thing this report may not do.
  assert.deepEqual(evidenceKeyLabel('water_dam_pond'), { group: 'Water', item: 'Dam / pond / stream' });
  assert.deepEqual(evidenceKeyLabel('soil_site_photos'), { group: 'Soil & growing beds', item: 'General site photos' });
  // An unknown key returns null so a caller can drop it rather than print rubbish.
  assert.equal(evidenceKeyLabel('not_a_real_key'), null);
  assert.equal(evidenceKeyLabel('__proto__'), null);
});

test('one photo per group before any group gets a second', () => {
  // THE FAILURE THIS EXISTS TO PREVENT. A farmer who photographs their rain tanks from four angles
  // and their soil once must not send four tanks and no soil. "Newest four" and "best group first"
  // both collapse to a single subject the moment somebody is thorough about one tile — and the
  // whole point is that the model sees the holding, not one corner of it photographed well.
  const chosen = selectGroundPhotos({
    water_rain_tanks: [photo(), photo(), photo(), photo()],
    soil_erosion: [photo()],
    trees_windbreaks: [photo()],
  });
  const groups = chosen.map((c) => c.key.split('_')[0]);
  assert.equal(chosen.length, MAX_GROUND_PHOTOS);
  assert.deepEqual([...new Set(groups)].sort(), ['soil', 'trees', 'water'],
    'a thorough tile crowded the other groups out');
  assert.equal(groups.filter((g) => g === 'water').length, 2, 'water should take its second only after the others have one');
});

test('soil leads, because no other input in the report carries what a soil photo carries', () => {
  // Every figure about a bed is measured; nothing anywhere records whether the ground in it is
  // capped and bare or covered and worked. Water second, trees third — see GROUP_PRIORITY.
  const chosen = selectGroundPhotos({
    energy_solar: [photo()],
    water_gutters: [photo()],
    soil_erosion: [photo()],
    trees_fruit_canopy: [photo()],
  });
  assert.deepEqual(chosen.map((c) => c.key.split('_')[0]), ['soil', 'water', 'trees', 'energy']);
});

test('only photographs are sent, and only ones that exist', () => {
  const chosen = selectGroundPhotos({
    // Notes and PDFs are already covered by the counts-and-notes summary; they carry no pixels.
    soil_lab_result: [photo({ type: 'note', dataUrl: undefined }), photo({ type: 'pdf', dataUrl: undefined })],
    water_gutters: [photo({ dataUrl: undefined })],
    trees_fruit_canopy: [photo()],
  });
  assert.deepEqual(chosen.map((c) => c.key), ['trees_fruit_canopy']);
});

test('the newest photo of a thing is the one that describes it now', () => {
  const old = photo({ takenAt: 1 });
  const recent = photo({ takenAt: 9_999 });
  const chosen = selectGroundPhotos({ soil_erosion: [old, recent] }, 1);
  assert.equal(chosen[0].item.id, recent.id, 'an old photo was sent as the current state of the ground');
});

test('a photo carries its subject and the farmer\'s own words', () => {
  const [prepared] = prepareGroundPhotos({
    soil_erosion: [photo({ note: '  after the  October rain ' })],
  });
  assert.equal(prepared.label, 'Soil & growing beds · Erosion / bare patches');
  assert.equal(prepared.note, 'after the  October rain', 'the farmer\'s note should reach the model');
  assert.ok(!prepared.data.startsWith('data:'), 'the data: prefix is not the wire format for an image block');
  assert.equal(prepared.mediaType, 'image/jpeg');
});

test('a rural connection is not asked to upload more than it can', () => {
  // Photos are stored at =<400px/q0.72 precisely so they are small; the budget is the backstop for
  // a store that somehow holds larger ones.
  const many = Object.fromEntries(
    ['soil_erosion', 'water_gutters', 'trees_fruit_canopy', 'structures_sheds']
      .map((k) => [k, [photo({ dataUrl: JPEG(400) })]]),
  );
  const prepared = prepareGroundPhotos(many, 500_000);
  const total = prepared.reduce((n, p) => n + Math.floor((p.data.length * 3) / 4), 0);
  assert.ok(prepared.length > 0, 'the budget rejected everything');
  assert.ok(total <= 500_000, `sent ${total} bytes against a 500000 budget`);
  assert.ok(GROUND_PHOTO_BUDGET_BYTES < 1_500_000, 'the default budget is too big for a phone on a rural connection');
});

test('what arrives at the server is checked, never repaired', () => {
  // This crosses the wire from a client we do not control, straight into a paid upstream call.
  assert.deepEqual(normaliseGroundPhotos(null), []);
  assert.deepEqual(normaliseGroundPhotos('AAAA'), []);
  assert.deepEqual(normaliseGroundPhotos([{ mediaType: 'image/png', data: 'AAAA' }]), [], 'only JPEG');
  assert.deepEqual(normaliseGroundPhotos([{ mediaType: 'image/jpeg', data: 'AAA' }]), [], 'not base64-aligned');
  assert.deepEqual(normaliseGroundPhotos([{ mediaType: 'image/jpeg', data: 'AA=A' }]), [], 'not base64');
  assert.deepEqual(normaliseGroundPhotos([{ mediaType: 'image/jpeg', data: 'data:image/jpeg;base64,AAAA' }]), [],
    'a data: URL is not a payload');

  const ok = normaliseGroundPhotos([{ mediaType: 'image/jpeg', data: 'AAAA', label: '  Soil   ·  Beds ', note: 'x'.repeat(400) }]);
  assert.equal(ok.length, 1);
  assert.equal(ok[0].label, 'Soil · Beds', 'labels are collapsed, not trusted verbatim');
  assert.equal(ok[0].note!.length, 300, 'a long note is capped rather than rejected');

  // And the count cap holds even if the client ignores it.
  const flood = Array.from({ length: 40 }, () => ({ mediaType: 'image/jpeg' as const, data: 'AAAA' }));
  assert.equal(normaliseGroundPhotos(flood).length, MAX_GROUND_PHOTOS);
});

test('the model is told a photograph is evidence of condition, and of nothing else', () => {
  const block = groundPhotosPromptBlock([
    { label: 'Soil & growing beds · Erosion / bare patches', note: 'hard after rain', mediaType: 'image/jpeg', data: 'AAAA' },
  ]);
  assert.match(block, /Photo 1: Soil & growing beds · Erosion \/ bare patches/);
  assert.match(block, /the farmer's note: "hard after rain"/);

  // THE DISTINCTION THAT MAKES THIS A SEPARATE BLOCK from siteImagesPromptBlock. A plan is
  // evidence of ARRANGEMENT; a photograph is evidence of CONDITION. Told they are the same, a
  // model reads a photo for layout — the one thing a close-up of a gully cannot tell it.
  assert.match(block, /CONDITION/);
  assert.match(block, /These are not drawings/);

  // The numbers rule is repeated here verbatim rather than referenced, because a photograph is a
  // far stronger pull towards estimating than a scaled drawing is.
  assert.match(block, /Never estimate an area, a distance, a\n {2}slope, a depth, a count or a capacity off a photograph/);
  assert.match(block, /cannot tell from/, 'the model must be allowed to say it cannot tell');

  assert.equal(groundPhotosPromptBlock([]), '', 'no photos must add no prompt at all');
});

test('the photos are actually attached to the request, and to every batch', () => {
  const view = source('../components/ReportView.tsx');
  const route = source('../app/api/generate-report/route.ts');

  // The line that was throwing them away is gone, and the payload carries them.
  assert.doesNotMatch(view, /\/\/ Build evidence summary \(strip base64/,
    'the photos are being stripped again');
  assert.match(view, /const groundPhotos = prepareGroundPhotos\(rawEvidence\)/);
  assert.match(view, /groundPhotos: groundPhotos\.length \? groundPhotos : undefined/);
  // The counts-and-notes summary must SURVIVE alongside them: it covers all 52 tiles and every
  // note, which four photographs cannot.
  assert.match(view, /evidenceData: Object\.keys\(evidenceData\)\.length > 0/);

  assert.match(route, /const groundPhotos = normaliseGroundPhotos\(body\.groundPhotos\)/);
  // Sheets first, photos second: the plans say what is where, the photographs say what state it is
  // in. Reversed, the model meets a close-up with no idea which bed it belongs to.
  const content = route.slice(route.indexOf('const messageContent ='), route.indexOf('const runBatch ='));
  assert.ok(
    content.indexOf('siteImagesPromptBlock') < content.indexOf('groundPhotosPromptBlock'),
    'the plan sheets must be read before the photographs',
  );
  assert.ok(content.indexOf('groundPhotosPromptBlock') < content.lastIndexOf('promptText'),
    'the images must lead the message, not trail it');
  // messageContent is called per batch; batches cannot see each other, so a photo shown once would
  // inform one section and leave the rest writing blind.
  assert.match(route, /content: messageContent\(buildPrompt\(batchSections/);
});

test('a photo is filed and read back under the same site id', () => {
  // Written as `activePlaceId ?? 'default'` and read as `activePlaceId`, so a farmer who had not
  // tapped a saved place filed every photo under `default` and generated a report that read an
  // empty object — no error, no missing-photo notice, just generic advice. Same shape as the
  // biome cache bug: two keyspaces, one subject.
  const panel = source('../components/DataPanel.tsx');
  const view = source('../components/ReportView.tsx');
  for (const [name, s] of [['DataPanel', panel], ['ReportView', view]] as const) {
    assert.match(s, /evidenceSiteId\(activePlaceId\)/, `${name} resolves the evidence site id by hand again`);
  }
  assert.doesNotMatch(panel, /activePlaceId \?\? 'default'/, 'the fallback was retyped instead of imported');
  assert.doesNotMatch(view, /getSiteEvidence\(activePlaceId\)/, 'ReportView reads the unresolved id again');
});

// ── The other half of "there is still no images": being SHOWN them ────────────────────────────

test('the report shows exactly the photos it read, and says how many more there are', () => {
  const evidence = {
    water_rain_tanks: [photo(), photo(), photo(), photo()],
    soil_erosion: [photo({ note: 'gully after the storm' })],
    trees_windbreaks: [photo()],
    structures_sheds: [photo()],
  };
  const gallery = groundPhotoGallery(evidence);
  assert.equal(gallery.shown.length, MAX_GROUND_PHOTOS, 'the strip should show what the model read');
  assert.equal(gallery.total, 7, 'the count must be of every photo on file, not of the ones sent');

  // THE STRIP AND THE UPLOAD MUST BE THE SAME FOUR. Two selections that drift apart would put a
  // photo on the page that no advice was drawn from, or draw advice from one the farmer cannot
  // see — either way the strip stops being an account of what was read. Same evidence in, same
  // keys out, asserted against the selector itself rather than against a hand-copied list.
  assert.deepEqual(
    gallery.shown.map((p) => p.key),
    selectGroundPhotos(evidence).map((p) => p.key),
    'the strip and the upload are no longer the same selection',
  );

  // Unlike the wire format, the display keeps the data: URL — an <img> needs it.
  assert.ok(gallery.shown.every((p) => p.dataUrl.startsWith('data:image/jpeg;base64,')));
  assert.equal(gallery.shown.find((p) => p.key === 'soil_erosion')!.note, 'gully after the storm');
});

test('no photos means no strip at all, not an empty one', () => {
  const gallery = groundPhotoGallery({ soil_lab_result: [photo({ type: 'pdf', dataUrl: undefined })] });
  assert.deepEqual(gallery.shown, []);
  assert.equal(gallery.total, 0);
});

test('the strip and the PDF both carry the photographs', () => {
  const view = source('../components/ReportView.tsx');
  const pdf = source('../lib/report-pdf.ts');

  // On screen, below the plan sheets — the order the model reads them in and the order they make
  // sense in: the plans say what is where, the photographs say what state it is in.
  assert.match(view, /Your saved site photos/, 'the report on screen shows no photographs again');
  assert.ok(
    view.indexOf('Your saved design maps') < view.indexOf('Your saved site photos'),
    'the photographs must come after the plans',
  );
  // The new-site report flow must not borrow the old, unassigned "default" photo bucket.
  // Named sites still use the shared evidence key; an unnamed new site starts without photos.
  assert.match(view, /groundPhotoGallery\(activePlaceId\?getSiteEvidence\(evidenceSiteId\(activePlaceId\)\):\{\}\)/);
  // Tapping one opens it full size, the same as a design sheet.
  assert.match(view, /setOpenPlate\(\{ label: p\.label, image: p\.dataUrl \}\)/);

  // Rory requested a visual-first report on 6 September: colour starts with images,
  // while choosing the ink-saving edition explicitly clears them.
  assert.match(view, /\[includeImages, setIncludeImages\] = useState\(true\)/);
  assert.match(view, /setPresentation\('print'\); setIncludeImages\(false\)/);
  assert.match(view, /photos: includeImages \? photoGallery\.shown\.map/, 'the PDF export drops the photographs');
  assert.match(pdf, /photos\?: ReportPdfPhoto\[\]/);
  assert.match(pdf, /const photos = meta\.photos \?\? \[\]/);
  // Two to a page: a 400px phone snap printed a full page wide is a blurry phone snap.
  assert.match(pdf, /i \+= 2/, 'the photographs are printed one to a page again');
  // A photo that will not draw costs its slot, never the report — the same rule the sheets follow.
  // Bounded to the return at the end of the function, not the next footer() — the photos loop now
  // calls footer() itself before each new page (see report-pdf.test.ts's footer-on-every-page
  // case), so "the next footer()" no longer marks the end of the photos section.
  const block = pdf.slice(pdf.indexOf('const photos = meta.photos'), pdf.indexOf("return doc.output('blob')"));
  assert.match(block, /catch \{\s*\n\s*continue;/, 'an unreadable photo must not lose the report');
});
