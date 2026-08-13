import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { PNG } from 'pngjs';

// Guards for the PICKER art library (public/element-art) — the illustrated cards a farmer taps
// to place something. Distinct from public/render-assets/reference-blueprint, which is the
// top-down artwork composited onto the plan and is guarded by reference-feature-art.test.ts.
//
// Both pickers — the current studio's chip strip (components/design/DesignPalette.tsx) and the
// 2.0 palette (via getElementArt in lib/design-studio-shell-icons.ts) — render `def.art` and
// nothing else, so every assertion here is about that one field.

import { ELEMENT_CATALOG } from '../lib/design-elements.ts';

const ROOT = join(process.cwd(), 'public', 'element-art');
const PREFIX = '/element-art/';

const declared = ELEMENT_CATALOG.filter((d) => d.art);
const onDisk = readdirSync(ROOT).filter((f) => f.endsWith('.png'));

test('every declared art path points at a file that exists', () => {
  for (const def of declared) {
    assert.ok(def.art!.startsWith(PREFIX), `${def.id}: art must live under ${PREFIX}, got ${def.art}`);
    const file = join(ROOT, def.art!.slice(PREFIX.length));
    assert.doesNotThrow(() => statSync(file), `${def.id}: ${def.art} is declared but not on disk`);
  }
});

test('art is named for the catalogue id it belongs to', () => {
  // The filename IS the wiring. A file called `jojo5000.png` on a def whose id is `jojo_5000`
  // works today and silently orphans the moment anyone regenerates the mapping from ids.
  // A `-vN` suffix is allowed when a generated replacement needs to coexist safely until the
  // catalogue points at it; its base name remains the catalogue id, not a free-form concept.
  for (const def of declared) {
    assert.match(
      def.art!,
      new RegExp(`^${PREFIX}${def.id}(?:-v\\d+)?\\.png$`),
      `${def.id}: art filename must match the id, with only an optional version suffix`,
    );
  }
});

test('no art ships unreferenced', () => {
  const used = new Set(declared.map((d) => d.art!.slice(PREFIX.length)));
  const orphans = onDisk.filter((f) => !used.has(f));
  assert.deepEqual(orphans, [], `these files are in the bundle but no catalogue entry points at them: ${orphans.join(', ')}`);
});

test('every asset is a real cut-out, not a flattened export', () => {
  // The bug class this exists for: a "transparent preview" exported with the grey-and-white
  // checkerboard baked into the pixels. It shipped once already (reference-blueprint avocado,
  // fixed in #70). The file declared an alpha channel and was simply filled 255 everywhere, so
  // a PNG HEADER check can never catch it — the pixels have to be decoded.
  for (const file of onDisk) {
    const { width, height, data } = PNG.sync.read(readFileSync(join(ROOT, file)));
    const alphaAt = (x: number, y: number) => data[(y * width + x) * 4 + 3];
    for (const [x, y] of [[0, 0], [width - 1, 0], [0, height - 1], [width - 1, height - 1]]) {
      assert.equal(alphaAt(x, y), 0, `${file}: opaque pixel at corner (${x},${y}) — it would paint a card-coloured square`);
    }
    let clear = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i] === 0) clear += 1;
    assert.ok(clear / (width * height) > 0.05, `${file}: only ${(100 * clear / (width * height)).toFixed(1)}% transparent — looks like a flattened background`);
  }
});

test('the library stays small enough to ship over a rural connection', () => {
  // As delivered these were 1024x1024 at ~1.3 MB each — 78 MB for a set the app draws at 24-56px.
  // Downsized to 192px the whole library is under 4 MB. This budget is the guard: it is generous
  // enough that no reasonable asset trips it, and tight enough that a raw 1024px drop cannot land
  // again without someone deciding to raise the number on purpose.
  const sizes = onDisk.map((f) => ({ f, bytes: statSync(join(ROOT, f)).size }));
  const total = sizes.reduce((n, s) => n + s.bytes, 0);
  const worst = sizes.sort((a, b) => b.bytes - a.bytes)[0];
  assert.ok(worst.bytes < 250_000, `${worst.f} is ${(worst.bytes / 1024).toFixed(0)} KB — picker art is drawn at 24-56px and should not exceed 250 KB`);
  assert.ok(total < 8_000_000, `element-art totals ${(total / 1e6).toFixed(1)} MB — over the 8 MB budget for the picker library`);
});

test('the JoJo tank family reads as four different SIZES, not four labels', () => {
  // The one differentiation the asset brief named explicitly, and the one the first delivery
  // missed: at 24px all four tanks were the same green cylinder, and the 2500 L was actually
  // drawn SLIMMER than the 1000 L. The art is now scaled so the painted subject occupies a
  // fraction of the frame proportional to the tank's real diameter, which is the only cue that
  // survives when the label is too small to read.
  const family = ['jojo_1000', 'jojo_2500', 'jojo_5000', 'jojo_10000'];
  const heights = family.map((id) => {
    const { width, height, data } = PNG.sync.read(readFileSync(join(ROOT, `${id}.png`)));
    let top = height;
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        if (data[(y * width + x) * 4 + 3] > 8) { top = Math.min(top, y); break; }
      }
      if (top < height) break;
    }
    const def = ELEMENT_CATALOG.find((d) => d.id === id)!;
    return { id, drawn: (height - top) / height, real: def.wM };
  });

  for (let i = 1; i < heights.length; i += 1) {
    assert.ok(
      heights[i].drawn > heights[i - 1].drawn,
      `${heights[i].id} (Ø${heights[i].real} m) is drawn no larger than ${heights[i - 1].id} (Ø${heights[i - 1].real} m) — ` +
      `${heights[i].drawn.toFixed(2)} vs ${heights[i - 1].drawn.toFixed(2)} of the frame`,
    );
  }

  // WIDTH TOO — the dimension the first version of this test did not guard, and where the bug
  // came straight back: the 2026-08 library drew the 2500 L at 79px wide against the 1000 L's
  // 88px, while every drawn HEIGHT stayed monotonic (112/115/152/183) and this test stayed green.
  // Width IS the diameter, and the diameter is the whole difference between these four products.
  // Tolerance ±12%: art is hand-drawn, but the drawn-width RATIO must track the real-diameter
  // ratio, not merely increase.
  const widths = family.map((id) => {
    const { width, height, data } = PNG.sync.read(readFileSync(join(ROOT, `${id}.png`)));
    let left = width, right = -1;
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        if (data[(y * width + x) * 4 + 3] > 8) { left = Math.min(left, x); right = Math.max(right, x); }
      }
    }
    const def = ELEMENT_CATALOG.find((d) => d.id === id)!;
    return { id, drawn: (right - left + 1) / width, real: def.wM };
  });
  for (let i = 1; i < widths.length; i += 1) {
    const drawnRatio = widths[i].drawn / widths[0].drawn;
    const realRatio = widths[i].real / widths[0].real;
    assert.ok(
      Math.abs(drawnRatio - realRatio) / realRatio <= 0.12,
      `${widths[i].id}: drawn width is ${drawnRatio.toFixed(2)}x the 1000 L's, real diameter is ${realRatio.toFixed(2)}x — ` +
      'the size on the card must track the size on the ground',
    );
  }
});
