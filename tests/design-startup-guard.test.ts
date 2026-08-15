import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// UBHEJANE. One farm — years of saved plan sheets, a custom drone-photo base — that crashed
// /design on open while every other farm on the same phone opened fine, even with `?safe=1`.
// The startup-data audit (15 August) found two allocations that only that farm's shape triggers:
//
//  1. Its stored base photo predates today's phone caps, so bakeBaseAlignment decoded it (and
//     the satellite underlay) at native resolution — a 2880×1920 photo alone is a ~21 MB bitmap —
//     regardless of how small the OUTPUT canvas was capped to. Safe mode skipped this path, but
//     the very FIRST load, before any crash streak exists, never gets safe mode at all.
//  2. A heavily-used farm rests on the glossy (sheets) step between visits. That step is
//     restored from localStorage, not tapped, so DesignGlossy remounted unconditionally on open
//     — reading every cached render and backfilling a thumbnail for every legacy sheet — and
//     safe mode never gated it. This is why `&safe=1` still died.
//
// This file pins both fixes so neither silently regresses.

const source = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8');

test('the base photo and satellite underlay decode into a bounded size, never the source file\'s own resolution', () => {
  const canvas = source('../lib/design-canvas.ts');
  assert.match(canvas, /typeof createImageBitmap === 'function'/,
    'bakeBaseAlignment lost its capped-decode path — a stale/uncapped photo goes back to a full-native-resolution decode');
  assert.match(canvas, /resizeWidth: w, resizeHeight: h, resizeQuality: 'high'/,
    'the createImageBitmap call no longer bounds the decode to what this bake actually draws');
  assert.doesNotMatch(canvas, /naturalWidth/,
    'supersample sizing went back to reading the DECODED image\'s native resolution — the exact ' +
    'chicken-and-egg that forces a full-size decode before the cap can even be computed');
});

test('a decoded source image is always released after its one drawImage call', () => {
  const canvas = source('../lib/design-canvas.ts');
  assert.match(canvas, /release: \(\) => bitmap\.close\(\)/,
    'an ImageBitmap decode path must close() its bitmap — otherwise iOS holds the pixel buffer until GC');
  assert.match(canvas, /release: \(\) => releaseImageSource\(image\)/,
    'the <img> fallback decode path must release its source too');
  assert.match(canvas, /source\.release\(\);/, 'the baked photo\'s decoded source is never released after use');
});

test('the glossy step never auto-mounts DesignGlossy while safe mode is protecting this load', () => {
  const page = source('../app/design/page.tsx');
  assert.match(page, /const \[glossyAutoBlocked, setGlossyAutoBlocked\] = useState\(\(\) => safeMode\.active\)/,
    'the glossy auto-restore hold must start true exactly when safe mode is already active at open');
  // The hold clears the instant the farmer navigates on purpose — an explicit tap into Sheets
  // must never be blocked, only the automatic restore this load didn't ask for.
  assert.match(page, /setGlossyAutoBlocked\(false\)/,
    'setStep must clear the hold on deliberate navigation, or a farmer can never reach Sheets again this load');
  // Real DesignGlossy only ever mounts when NOT held and the heavy base pipeline has settled —
  // two separate conditions the fix must not collapse into one.
  assert.match(page, /canvasState\.step === 'glossy' && glossyAutoBlocked \? \(/,
    'the recovery panel must render on its own condition, ahead of the real DesignGlossy branch');
  assert.match(page, /canvasState\.step === 'glossy' && baseHeavyDone \? \(/,
    'DesignGlossyLazy lost its baseHeavyDone gate — it can mount again while the photo bake is still in flight');
});
