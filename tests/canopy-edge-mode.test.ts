import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PNG } from 'pngjs';

// THE COUPLING GUARD between DesignGlossy's CANOPY_EDGE_MODE and the canopy artwork itself.
//
// Rory: "the canopy must not be a circle edge but a jagged leaf canopy." That needs two halves,
// and each half makes the sheet WORSE without the other:
//
//   new art under 'footprint'  -> the crown is clipped back to a perfect disc (the 1.14 bleed
//                                 pushes the notches outside the footprint clip and crops them)
//   old art under 'artwork'    -> the casing ring and soil fill that currently HIDE the painted
//                                 mulch band are gone, so the brown band is what a farmer sees
//
// So this file does not test the renderer, which needs a canvas. It tests the thing that can
// actually be checked from disk: that the switch and the pixels agree. Flip CANOPY_EDGE_MODE to
// 'artwork' before the crowns are redrawn and these assertions fail with the measurement.

const GLOSSY = join(process.cwd(), 'components', 'design', 'DesignGlossy.tsx');
const ART_DIR = join(process.cwd(), 'public', 'render-assets', 'reference-blueprint');

// Every file drawn as a mature canopy, from lib/reference-feature-art.ts. Kept as a literal list
// rather than imported so that a canopy quietly dropping out of that module cannot also quietly
// drop out of this guard.
const CANOPIES = [
  'orchard-canopy-v1.png', 'banana-clump-v2.png', 'pawpaw-tree-v2.png', 'moringa-tree-v1.png',
  'avocado-tree-v2.png', 'mango-tree-v2.png', 'litchi-tree-v2.png', 'macadamia-tree-v2.png',
  'citrus-tree-v3.png', 'apple-tree-v1.png', 'pear-tree-v1.png', 'plum-tree-v1.png',
  'peach-tree-v1.png', 'fig-tree-v1.png', 'pomegranate-tree-v1.png',
  'marula-tree-v2.png', 'kei-apple-tree-v2.png',
  // The crowns that broke the generic canopy apart — named fruit keeps its own identity at scale.
  'indigenous-shade-v1.png', 'wild-plum-v2.png', 'guava-v2.png', 'olive-v2.png',
  'waterberry-v2.png', 'natal-plum-v2.png',
];

function readMode(): 'footprint' | 'artwork' {
  const src = readFileSync(GLOSSY, 'utf8');
  const m = src.match(/const CANOPY_EDGE_MODE: 'footprint' \| 'artwork' = '(footprint|artwork)'/);
  assert.ok(m, 'CANOPY_EDGE_MODE is not declared in DesignGlossy.tsx in the expected form');
  return m![1] as 'footprint' | 'artwork';
}

/** Mean alpha per 5% radius band, and the brown fraction of the outer band. A circular crown is
 *  opaque right out to the frame; a jagged one falls away as the notches open up. */
function profile(file: string) {
  const png = PNG.sync.read(readFileSync(join(ART_DIR, file)));
  const { width: w, height: h, data } = png;
  const cx = w / 2, cy = h / 2, R = Math.min(w, h) / 2;
  const bands = new Map<number, { sum: number; n: number }>();
  let outer = 0, brown = 0;
  const brownBySector = Array.from({ length: 36 }, () => ({ brown: 0, opaque: 0 }));
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const r = Math.hypot(x - cx, y - cy) / R;
      if (r > 1) continue;
      const band = Math.floor(r * 20) * 5;
      if (band >= 70) {
        const b = bands.get(band) ?? { sum: 0, n: 0 };
        b.sum += data[i + 3] / 255; b.n += 1; bands.set(band, b);
      }
      if (r >= 0.75 && data[i + 3] > 128) {
        outer += 1;
        const angle = Math.atan2(y - cy, x - cx);
        const sector = Math.min(35, Math.floor(((angle + Math.PI) / (2 * Math.PI)) * 36));
        brownBySector[sector].opaque += 1;
        const [red, g, bl] = [data[i], data[i + 1], data[i + 2]];
        // Brown/soil: red leads green leads blue, and it is not a green pixel.
        if (red > g && g > bl && !(g > red && g > bl)) {
          brown += 1;
          brownBySector[sector].brown += 1;
        }
      }
    }
  }
  const mean = (band: number) => {
    const b = bands.get(band);
    return b && b.n ? b.sum / b.n : 0;
  };
  const brownRingContinuity = brownBySector.filter((sector) =>
    sector.opaque > 0 && sector.brown / sector.opaque > 0.3).length / brownBySector.length;
  return { mean, brownFraction: outer ? brown / outer : 0, brownRingContinuity };
}

test('CANOPY_EDGE_MODE is one of the two declared values', () => {
  assert.ok(['footprint', 'artwork'].includes(readMode()));
});

test("'artwork' mode is only legal once the crowns are actually jagged and basin-free", () => {
  if (readMode() !== 'artwork') return; // nothing to prove while the old art is still in place

  const failures: string[] = [];
  for (const file of CANOPIES) {
    const { mean, brownFraction, brownRingContinuity } = profile(file);
    // A jagged crown's outermost band is mostly notch. A disc's is solid.
    if (mean(95) > 0.45) {
      failures.push(`${file}: 95-100% band is ${(mean(95) * 100).toFixed(0)}% opaque — still a disc`);
    }
    // ...and the falloff has to be gradual, not a cliff at the frame.
    if (mean(80) - mean(95) < 0.2) {
      failures.push(`${file}: alpha barely falls from 80% to 100% radius — edge is not lobed`);
    }
    // A basin is a CONTINUOUS annulus. A raw brown-pixel count also catches macadamia shells,
    // pomegranate skin, marula shading and real branches — exactly the identity cues this guard
    // must allow. Require both a large brown fraction and brown dominance around most angles, so
    // a painted soil ring fails while isolated fruit and branch colour does not.
    if (brownFraction > 0.12 && brownRingContinuity > 0.5) {
      failures.push(`${file}: brown covers ${(brownRingContinuity * 100).toFixed(0)}% of outer sectors — basin still painted in`);
    }
  }
  assert.deepEqual(failures, [], `\n${failures.join('\n')}\n`);
});
