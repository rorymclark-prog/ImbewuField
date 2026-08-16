import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// THE QUALITY SETTING AND ITS COST BOUNDARY.
//
// Rory: "Can up the quality — imagine when this is printed on even A3." SCALE became a setting
// (lib/sheet-scale.ts). The rule that makes it safe: nothing the AI receives may grow with it.
// A display preference that silently multiplied the payload of every paid render would be a
// billing change wearing a quality-slider costume. The boundary is capForAiInput in
// DesignGlossy, applied at every upload site — and these tests keep it applied, because the
// failure mode is a future call site that forgets, which no runtime test can see without
// mocking the entire render stack.

class MemoryStorage {
  private map = new Map<string, string>();
  getItem(k: string) { return this.map.has(k) ? this.map.get(k)! : null; }
  setItem(k: string, v: string) { this.map.set(k, v); }
  removeItem(k: string) { this.map.delete(k); }
  raw() { return this.map; }
}
const storage = new MemoryStorage();
(globalThis as { window?: unknown }).window = { localStorage: storage };

const { SCALE, setSheetScale, AI_INPUT_WIDTH, SHEET_SCALE_KEY } = await import('../lib/sheet-scale.ts');

test('with no stored choice and no desktop viewport, the scale is 2 — the phone-safe floor', () => {
  // The test window has no matchMedia, which is exactly the conservative branch: unknown
  // devices render at the historical size. See readStoredScale for why phones stay at 2
  // (a High masterplan is a ~50MB bitmap during compose — the OOM budget #84/#90 fought for).
  assert.equal(SCALE, 2);
});

test('a desktop-class viewport defaults to High without being asked', async () => {
  // Rory, pinch-zoomed into a Standard sheet: "quality still the same, very bad and blurry" —
  // sharpness a farmer has to find a toggle for is not sharpness. Fresh module instance with a
  // desktop matchMedia and NO stored key must come up at 3; a stored '2' must still win, because
  // an explicit choice outranks any default.
  (globalThis as { window?: unknown }).window = {
    localStorage: storage,
    matchMedia: (q: string) => ({ matches: q.includes('min-width: 1024px') }),
  };
  storage.raw().clear();
  const fresh = await import(`../lib/sheet-scale.ts?desktop=${Date.now()}`);
  assert.equal(fresh.SCALE, 3, 'desktop with no stored choice must start at High');
  storage.setItem(SHEET_SCALE_KEY, '2');
  const pinned = await import(`../lib/sheet-scale.ts?pinned=${Date.now()}`);
  assert.equal(pinned.SCALE, 2, 'an explicit Standard choice outranks the desktop default');
  (globalThis as { window?: unknown }).window = { localStorage: storage };
});

test('a stored High preference cannot strand a phone in the exact-lock stage', async () => {
  (globalThis as { window?: unknown }).window = {
    localStorage: storage,
    matchMedia: (q: string) => ({ matches: q === '(pointer: coarse)' }),
    screen: { width: 390, height: 844 },
  };
  storage.setItem(SHEET_SCALE_KEY, '3');
  const phone = await import(`../lib/sheet-scale.ts?phone=${Date.now()}`);
  assert.equal(phone.SCALE, 2, 'the stored 2880px print master escaped onto phone-grade hardware');
  assert.equal(phone.deviceSheetScale(3), 2, 'the High button must obey the same cap after mount');
  assert.equal(phone.setSheetScale(3), false, 'a phone must not switch the live renderer back to High');
  (globalThis as { window?: unknown }).window = { localStorage: storage };
  storage.raw().clear();
});

test('AI_INPUT_WIDTH pins the historical master width', () => {
  // 1920 = frame.imgW (960) x the historical SCALE (2). If this constant moves, every AI render
  // input changes size — and cost — for every farmer at once. Moving it must be a deliberate,
  // reviewed decision, which is what failing this test forces.
  assert.equal(AI_INPUT_WIDTH, 1920);
});

test('setSheetScale persists, reports change honestly, and round-trips', () => {
  assert.equal(setSheetScale(2), false, 'setting the current value is not a change');
  assert.equal(setSheetScale(3), true);
  assert.equal(storage.getItem(SHEET_SCALE_KEY), '3');
  assert.equal(setSheetScale(2), true);
  assert.equal(storage.getItem(SHEET_SCALE_KEY), '2');
});

// ─── The boundary, enforced at source level ─────────────────────────────────────────────────

const GLOSSY = readFileSync(join(process.cwd(), 'components', 'design', 'DesignGlossy.tsx'), 'utf8');

test('every queue upload goes through the capped wrapper', () => {
  // NO awaited raw enqueueRenderJob may exist — the wrapper's own call is a tail `return`,
  // so any `await enqueueRenderJob(` is a call site that skipped the cap and ships SCALE-sized
  // composites to the queue.
  assert.equal((GLOSSY.match(/await enqueueRenderJob\(/g) ?? []).length, 0, 'an uncapped queue call came back');
  assert.ok(GLOSSY.includes('async function enqueueRenderJobCapped('), 'the wrapper itself is gone');
  // ...and the wrapper is actually used: the definition plus at least four call sites.
  assert.ok((GLOSSY.match(/enqueueRenderJobCapped\(/g) ?? []).length >= 5, 'call sites stopped using the wrapper');
});

test('every direct render upload caps its bitmaps', () => {
  // Both requestRender sites must wrap composite/mask/satellite in capForAiInput. Counting the
  // uncapped shape catches a regression at either site.
  assert.equal((GLOSSY.match(/requestRender\(\{/g) ?? []).length, 2, 'requestRender call sites moved — re-check the cap');
  assert.equal((GLOSSY.match(/stripDataUrl\(await capForAiInput\(/g) ?? []).length >= 4, true,
    'a requestRender bitmap lost its cap');
  assert.ok(!/imageBase64: stripDataUrl\(composite\)/.test(GLOSSY), 'an uncapped composite upload came back');
});

test('the producer boundary caps inside the function, where no call site can forget it', () => {
  const body = GLOSSY.slice(GLOSSY.indexOf('async function requestProducer('));
  assert.ok(
    body.slice(0, 1500).includes('capForAiInput'),
    'requestProducer no longer caps at entry',
  );
});

test('the cache key diverges at High and is untouched at Standard', () => {
  // ':s3' must appear in the underlaySuffix construction, guarded to non-default scales — so
  // every existing scale-2 cache key stays byte-identical and no farmer loses a cached sheet
  // to the setting merely existing.
  assert.ok(GLOSSY.includes("SCALE !== 2 ? `:s${SCALE}` : ''"), 'the scale cache suffix is gone or unguarded');
});
