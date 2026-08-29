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
import { SPECIES_PICKER_ART } from '../lib/species-art.ts';
import { CROPS } from '../lib/crop-catalog.ts';
import { CROP_ART } from '../lib/crop-art.ts';

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
  for (const file of SPECIES_PICKER_ART) used.add(file);
  const orphans = onDisk.filter((f) => !used.has(f));
  assert.deepEqual(orphans, [], `these files are in the bundle but no catalogue entry points at them: ${orphans.join(', ')}`);
});

test('every mapped species picker image exists in the shared picker library', () => {
  for (const file of SPECIES_PICKER_ART) {
    assert.doesNotThrow(() => statSync(join(ROOT, file)), `${file}: species picker art is mapped but not on disk`);
  }
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

test('tree picker silhouettes stay front elevations instead of becoming plan canopies', () => {
  // MAP art is top-down because its pixels occupy measured ground. PICKER art answers a different
  // question: "what is this thing?" The 2026-08-14 canopy redraw copied circular aerial crowns
  // into the picker and erased the trunk/silhouette cue Rory had explicitly approved. For a real
  // front elevation, the lower fifth is mostly trunk and is far narrower than the middle crown;
  // the mistaken top views measured 0.34-0.44 here, while these elevations measure 0.02-0.28.
  const clearTrunkTrees = [
    'tree_citrus', 'tree_mango', 'tree_avocado', 'tree_macadamia', 'tree_litchi',
    'tree_pawpaw', 'tree_moringa', 'tree_wild_plum', 'tree_waterberry', 'tree_marula',
    'tree_indigenous', 'tree_other', 'tree_apple', 'tree_pear', 'tree_plum', 'tree_peach',
    'tree_fig', 'tree_olive',
  ];

  for (const id of clearTrunkTrees) {
    const def = ELEMENT_CATALOG.find((candidate) => candidate.id === id)!;
    assert.ok(def.art, `${id}: missing picker art`);
    const image = PNG.sync.read(readFileSync(join(ROOT, def.art!.slice(PREFIX.length))));
    const paintedPerRow = Array.from({ length: image.height }, (_, y) => {
      let painted = 0;
      for (let x = 0; x < image.width; x += 1) {
        if (image.data[(y * image.width + x) * 4 + 3] > 8) painted += 1;
      }
      return painted;
    });
    const average = (from: number, to: number) => {
      const rows = paintedPerRow.slice(from, to);
      return rows.reduce((sum, n) => sum + n, 0) / rows.length;
    };
    const middle = average(Math.floor(image.height * 0.35), Math.floor(image.height * 0.65));
    const lower = average(Math.floor(image.height * 0.78), image.height);
    assert.ok(lower / middle < 0.31,
      `${id}: the lower silhouette is ${Math.round(100 * lower / middle)}% as wide as its crown — ` +
      'this reads as another top-down canopy instead of a front-elevation tree');
  }
});

test('Natal Plum reads as a low front-facing shrub, not a circular aerial crown', () => {
  // Natal Plum grows foliage to the ground, so the trunk-width check above is wrong for it. Its
  // front cue is the broad, low silhouette: the rejected aerial asset was nearly round, while the
  // corrected elevation is materially wider than it is tall.
  const def = ELEMENT_CATALOG.find((candidate) => candidate.id === 'tree_natal_plum')!;
  const image = PNG.sync.read(readFileSync(join(ROOT, def.art!.slice(PREFIX.length))));
  let left = image.width, right = -1, top = image.height, bottom = -1;
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      if (image.data[(y * image.width + x) * 4 + 3] <= 8) continue;
      left = Math.min(left, x); right = Math.max(right, x);
      top = Math.min(top, y); bottom = Math.max(bottom, y);
    }
  }
  assert.ok((right - left + 1) / (bottom - top + 1) > 1.15,
    'Natal Plum is round again — the picker lost its low shrub elevation');
});

test('the library stays small enough to ship over a rural connection', () => {
  // As delivered these were 1024x1024 at ~1.3 MB each — 78 MB for a set the app draws at 24-92px.
  // Downsized to 192px the whole library is under 4 MB. This budget is the guard: it is generous
  // enough that no reasonable asset trips it, and tight enough that a raw 1024px drop cannot land
  // again without someone deciding to raise the number on purpose.
  const sizes = onDisk.map((f) => ({ f, bytes: statSync(join(ROOT, f)).size }));
  const total = sizes.reduce((n, s) => n + s.bytes, 0);
  const worst = sizes.sort((a, b) => b.bytes - a.bytes)[0];
  assert.ok(worst.bytes < 250_000, `${worst.f} is ${(worst.bytes / 1024).toFixed(0)} KB — picker art is drawn at 24-92px and should not exceed 250 KB`);
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

// Crop pictures are another small-image picker library with the same failure modes: an unnamed
// file falls back to an emoji, an RGB export paints a square, and generation-sized PNGs make a
// farmer download tens of megabytes for pictures that are normally only 20-68px on screen.
const CROP_ROOT = join(process.cwd(), 'public', 'crop-art');
const CROP_PREFIX = '/crop-art/';
const cropFiles = readdirSync(CROP_ROOT).filter((file) => file.endsWith('.png')).sort();

test('every crop has one correctly named picture and no crop picture is orphaned', () => {
  const cropKeys = CROPS.map((crop) => crop.key).sort();
  assert.deepEqual(Object.keys(CROP_ART).sort(), cropKeys,
    'a crop without art silently falls back to an emoji, while an extra mapping cannot belong to a crop');

  const mappedFiles = cropKeys.map((key) => {
    assert.equal(CROP_ART[key], `${CROP_PREFIX}${key}.png`, `${key}: picture path must follow its stable crop key`);
    return `${key}.png`;
  }).sort();
  assert.deepEqual(cropFiles, mappedFiles, 'crop-art on disk and crop-art shown in the app must be the same set');
});

test('crop pictures are real transparent cut-outs at their deployed resolution', () => {
  for (const file of cropFiles) {
    const image = PNG.sync.read(readFileSync(join(CROP_ROOT, file)));
    assert.deepEqual([image.width, image.height], [256, 256],
      `${file}: shipping a raw generation-sized image wastes mobile data`);

    const alphaAt = (x: number, y: number) => image.data[(y * image.width + x) * 4 + 3];
    for (const [x, y] of [[0, 0], [image.width - 1, 0], [0, image.height - 1], [image.width - 1, image.height - 1]]) {
      assert.equal(alphaAt(x, y), 0,
        `${file}: corner (${x},${y}) is not transparent — a baked background would paint a square on every card`);
    }

    let transparent = 0;
    for (let i = 3; i < image.data.length; i += 4) if (image.data[i] === 0) transparent += 1;
    const fraction = transparent / (image.width * image.height);
    assert.ok(fraction > 0.10 && fraction < 0.85,
      `${file}: ${(fraction * 100).toFixed(1)}% transparent — likely flattened or too small to read as an icon`);
  }
});

test('the complete crop-picture library stays practical on a rural connection', () => {
  const sizes = cropFiles.map((file) => ({ file, bytes: statSync(join(CROP_ROOT, file)).size }));
  const total = sizes.reduce((sum, item) => sum + item.bytes, 0);
  const worst = sizes.sort((a, b) => b.bytes - a.bytes)[0];

  assert.ok(worst.bytes < 180_000,
    `${worst.file} is ${(worst.bytes / 1024).toFixed(0)} KB — one phone-sized crop picture should stay below 180 KB`);
  assert.ok(total < 4_000_000,
    `crop-art totals ${(total / 1_000_000).toFixed(1)} MB — over the 4 MB budget for the complete library`);
});
