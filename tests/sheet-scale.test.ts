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

test('the default scale is 2 — exactly what every sheet has always rendered at', () => {
  assert.equal(SCALE, 2);
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
