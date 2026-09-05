import assert from 'node:assert/strict';
import test from 'node:test';

import { compareRenders, differenceMessage, paidRenderDecision, retainedRenderHasVisibleChange } from '@/lib/render-difference';

// Rory paid for Full Treatment repeatedly and got back the picture he already had. Six commits
// across two days were reported as fixing it, every one with a green suite behind it, because
// nothing in the render path had ever looked at the output image. These tests are built from
// constructed images rather than fixtures so each failure mode is unambiguous.

const W = 40;
const H = 40;
const PIXELS = W * H;

function solid(r: number, g: number, b: number): Uint8ClampedArray {
  const buf = new Uint8ClampedArray(PIXELS * 4);
  for (let i = 0; i < buf.length; i += 4) {
    buf[i] = r; buf[i + 1] = g; buf[i + 2] = b; buf[i + 3] = 255;
  }
  return buf;
}

/** Shift every channel by `d` — what a warmth/grain/vignette pass looks like. */
function shifted(src: Uint8ClampedArray, d: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(src);
  for (let i = 0; i < out.length; i += 4) {
    out[i] += d; out[i + 1] += d; out[i + 2] += d;
  }
  return out;
}

/** Repaint the first `fraction` of pixels to a genuinely different colour. */
function repainted(src: Uint8ClampedArray, fraction: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(src);
  const upTo = Math.floor(PIXELS * fraction) * 4;
  for (let i = 0; i < upTo; i += 4) {
    out[i] = 200; out[i + 1] = 40; out[i + 2] = 90;
  }
  return out;
}

/** Reproduce the failed Whole-design shape: most photograph pixels disappear into white paper. */
function erasedToPaper(src: Uint8ClampedArray, fraction: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(src);
  const upTo = Math.floor(PIXELS * fraction) * 4;
  for (let i = 0; i < upTo; i += 4) {
    out[i] = 255; out[i + 1] = 255; out[i + 2] = 255;
  }
  return out;
}

test('a verbatim copy is called out as unchanged — the exact bug Rory paid for', () => {
  const hybrid = solid(120, 130, 110);
  const r = compareRenders(hybrid, new Uint8ClampedArray(hybrid));

  assert.equal(r.verdict, 'unchanged');
  assert.equal(r.touchedFraction, 0);
  assert.equal(r.redrawnFraction, 0);
  assert.match(differenceMessage(r) ?? '', /returned the same map/);
});

test('encoder noise still counts as unchanged — a re-save is not a render', () => {
  // A model that decodes and re-encodes its input shifts pixels by a point or two. That is not a
  // second pass, and charging for it would be the same fraud by a different route.
  const hybrid = solid(120, 130, 110);
  const r = compareRenders(hybrid, shifted(hybrid, 2));

  assert.equal(r.verdict, 'unchanged');
  assert.equal(r.redrawnFraction, 0);
});

test('a global filter is named as a filter, not passed off as a redraw', () => {
  // Every pixel moves, none of it is new artwork. The old prompt explicitly warned against "the
  // exact sheet with a light texture filter" and nothing ever checked whether that is what came
  // back, so the two failure modes need different words.
  const hybrid = solid(120, 130, 110);
  const r = compareRenders(hybrid, shifted(hybrid, 12));

  assert.equal(r.verdict, 'filtered-only');
  assert.ok(r.touchedFraction > 0.9, 'a filter moves nearly every pixel');
  assert.ok(r.redrawnFraction < 0.1, 'but redraws none of them');
  assert.match(differenceMessage(r) ?? '', /only tinted the map/);
});

test('a genuine second pass passes, and says nothing to the farmer', () => {
  const hybrid = solid(120, 130, 110);
  const r = compareRenders(hybrid, repainted(hybrid, 0.55));

  assert.equal(r.verdict, 'redrawn');
  assert.ok(r.redrawnFraction > 0.5);
  assert.equal(differenceMessage(r), null, 'a good result is not worth interrupting anyone about');
});

test('a photograph erased into blank paper is rejected even though almost every erased pixel changed', () => {
  // The reported Whole-design result was 69% blank while its exact satellite map was effectively
  // 0% blank. The former difference-only gate celebrated that deletion as a strong redraw because
  // turning textured land white moves RGB by far more than 32 points.
  const satellite = solid(80, 105, 65);
  const r = compareRenders(satellite, erasedToPaper(satellite, 0.69));

  assert.ok(r.redrawnFraction > 0.65, 'the old gate would have accepted this as a large redraw');
  assert.ok(r.blankedFraction > 0.65, 'the new score records the missing source content directly');
  assert.equal(r.verdict, 'content-erased');
  assert.equal(paidRenderDecision(r, 'hybrid').keep, false);
  assert.match(differenceMessage(r, 'hybrid') ?? '', /erased a large part of the map into blank paper/);
  assert.match(differenceMessage(r, 'hybrid') ?? '', /exact map is unchanged/);
});

test('plain-paper source is not mistaken for erased photo content', () => {
  // A farmer may deliberately choose the paper underlay. White that was already present is not
  // missing content; the pass is judged by whether it illustrated the marked features.
  const paper = solid(255, 255, 255);
  const illustrated = repainted(paper, 0.55);
  const r = compareRenders(paper, illustrated);

  assert.equal(r.blankedFraction, 0);
  assert.equal(r.verdict, 'redrawn');
});

test('erasing sparse marks from a paper plan is content loss, not a successful redraw', () => {
  const paperPlan = solid(255, 255, 255);
  // Twenty per cent of the sheet contains the farmer's actual plan; the rest is intentional paper.
  for (let i = 0; i < PIXELS * 0.2 * 4; i += 4) {
    paperPlan[i] = 70; paperPlan[i + 1] = 110; paperPlan[i + 2] = 55;
  }
  const erased = solid(255, 255, 255);
  const r = compareRenders(paperPlan, erased);

  assert.equal(r.blankedFraction, 1, 'all source content was erased even though most pixels began white');
  assert.equal(r.verdict, 'content-erased');
});

test('the threshold sits between a token change and a real one', () => {
  const hybrid = solid(120, 130, 110);
  assert.equal(compareRenders(hybrid, repainted(hybrid, 0.05)).verdict, 'unchanged');
  assert.equal(compareRenders(hybrid, repainted(hybrid, 0.30)).verdict, 'redrawn');
});

test('protected pixels are excluded, so a good pass is not punished for the app restoring them', () => {
  // fullTreatmentProtectPolicy restores the boundary, driveway, house halo and everything outside
  // the plot byte-for-byte after the model returns — on a cropped frame that is roughly a third of
  // the sheet. Counting those guaranteed-identical pixels would drag every honest render toward
  // "unchanged" and would have made this gate useless exactly where it matters most.
  const hybrid = solid(120, 130, 110);

  // The model redrew the whole half it was allowed to touch; the other half is restored.
  const after = new Uint8ClampedArray(hybrid);
  for (let i = 0; i < (PIXELS / 2) * 4; i += 4) {
    after[i] = 200; after[i + 1] = 40; after[i + 2] = 90;
  }
  const mask = new Uint8ClampedArray(PIXELS * 4);
  for (let i = (PIXELS / 2) * 4; i < mask.length; i += 4) mask[i + 3] = 255; // second half protected

  const masked = compareRenders(hybrid, after, { protectMask: mask });
  assert.equal(masked.verdict, 'redrawn');
  assert.equal(masked.comparedPixels, PIXELS / 2);
  assert.ok(masked.redrawnFraction > 0.99, 'every comparable pixel was redrawn');

  // Without the mask the same render scores half as well — this is the trap being avoided.
  const unmasked = compareRenders(hybrid, after);
  assert.ok(unmasked.redrawnFraction < 0.55);
});

test('a Gemini result differing inside the protected region is caught as a drift mismatch', () => {
  const hybrid = solid(120, 130, 110);
  const after = new Uint8ClampedArray(hybrid);
  const mask = new Uint8ClampedArray(PIXELS * 4);
  
  // Protect the first half
  for (let i = 0; i < (PIXELS / 2) * 4; i += 4) {
    mask[i + 3] = 255;
  }
  
  // Change a protected pixel
  after[0] = 200; after[1] = 40; after[2] = 90;
  
  const r = compareRenders(hybrid, after, { protectMask: mask });
  assert.equal(r.protectedMismatches, 1);
});

test('partially protected pixels are scored exactly as their visible blended result', () => {
  const before = solid(120, 130, 110);
  const after = repainted(before, 0.55);
  const mask = new Uint8ClampedArray(before.length);
  const alphas = [1, 64, 128, 192];
  const visiblyRestored = new Uint8ClampedArray(after);

  for (let i = 0; i < mask.length; i += 4) {
    const alphaByte = alphas[(i / 4) % alphas.length];
    const protection = alphaByte / 255;
    mask[i + 3] = alphaByte;
    for (let channel = 0; channel < 4; channel += 1) {
      visiblyRestored[i + channel] = Math.round(
        before[i + channel] * protection + after[i + channel] * (1 - protection),
      );
    }
  }

  assert.deepEqual(
    compareRenders(before, after, { protectMask: mask }),
    compareRenders(before, visiblyRestored),
    'the gate must score the same pixels the compositor will show',
  );
});

test('a fully protected sheet reports honestly instead of blaming the model', () => {
  // If the mask covers everything, the model had no canvas. Calling that "unchanged" would send
  // someone off to re-prompt a model that was never allowed to draw.
  const hybrid = solid(120, 130, 110);
  const mask = new Uint8ClampedArray(PIXELS * 4);
  for (let i = 0; i < mask.length; i += 4) mask[i + 3] = 255;

  const r = compareRenders(hybrid, solid(10, 20, 30), { protectMask: mask });
  assert.equal(r.comparedPixels, 0);
  assert.match(differenceMessage(r) ?? '', /nothing it was allowed to change/);
});

test('mismatched sizes throw rather than silently scoring nonsense', () => {
  assert.throws(() => compareRenders(solid(1, 1, 1), new Uint8ClampedArray(8)), /size mismatch/);
  assert.throws(
    () => compareRenders(solid(1, 1, 1), solid(2, 2, 2), { protectMask: new Uint8ClampedArray(8) }),
    /mask size mismatch/,
  );
  assert.throws(
    () => compareRenders(new Uint8ClampedArray(5), new Uint8ClampedArray(5)),
    /whole pixels/,
  );
});

test('the paid Hybrid gate rejects a known copy and keeps a known redraw', () => {
  const input = solid(120, 130, 110);
  const unchanged = paidRenderDecision(
    compareRenders(input, new Uint8ClampedArray(input)),
    'hybrid',
  );
  const redrawn = paidRenderDecision(
    compareRenders(input, repainted(input, 0.55)),
    'hybrid',
  );

  assert.equal(unchanged.keep, false);
  assert.match(unchanged.message ?? '', /AI pass returned the same map/);
  assert.match(unchanged.message ?? '', /exact map is unchanged/);
  assert.deepEqual(redrawn, { keep: true, message: null });
});


test('a small visible edit can survive composition without repainting ten percent of the page', () => {
  const before = new Uint8ClampedArray(100 * 100 * 4).fill(160);
  const after = before.slice();
  // A 4x4 mark is 0.16% of the page; untouched legends and ground must not hide its existence.
  for (let y = 20; y < 24; y++) for (let x = 20; x < 24; x++) {
    const offset = (y * 100 + x) * 4;
    after[offset] = 40; after[offset + 1] = 75; after[offset + 2] = 25;
  }
  const report = compareRenders(before, after);
  assert.equal(paidRenderDecision(report, 'hybrid').keep, false);
  assert.equal(retainedRenderHasVisibleChange(report), true);
  assert.equal(retainedRenderHasVisibleChange(compareRenders(before, before)), false);
});

test('one stray changed pixel does not pass the retained-artwork visibility check', () => {
  const before = new Uint8ClampedArray(100 * 100 * 4).fill(160);
  const after = before.slice();
  after[0] = 0; after[1] = 0; after[2] = 0;
  assert.equal(retainedRenderHasVisibleChange(compareRenders(before, after)), false);
});
