// Registration scorer — the acceptance gate for "get it accurate".
// Compares an AI render against the authoritative source it was given and answers, in numbers:
//   1. aspect drift        — did the frame stretch?
//   2. roof registration   — dark compact roofs are the most reliable landmarks in both the
//                            satellite input and any competent repaint; match cluster centroids
//                            and report the mean/max offset in px and % of frame diagonal.
//   3. edge preservation   — Sobel edge maps of source vs candidate, dilated-overlap hit rate.
//                            High = geometry kept (whatever the palette). Low = model redesigned.
//   4. repaint fraction    — mean per-pixel color distance from the source. High + high edge
//                            preservation = fully repainted AND faithful (the goal). Low = the
//                            "unchanged copy" failure. High + LOW edge preservation = beautiful
//                            fiction (the relocation failure).
//
// Calibration (30 Jul, Planting sheet, three artifacts with known ground truth):
//   first polish attempt (relocated everything):  repaint 43.9%  invented-edges 54.8%  -> FAIL
//   ground-only precision_atlas (faithful):       repaint 86.7%  invented-edges 32.4%  -> PASS
//   mockup AI-ground + app-drawn facts (exact):   repaint 85.4%  invented-edges 31.4%  -> PASS
// Draft acceptance gate for item 35: |aspect| < 1%  AND  repaint >= 70%  AND  invented-edges <= 40%.
// Roof 1:1 matching is directional only at this downscale (2-3/12 everywhere) — do not gate on it.
// Usage: node scripts/score-registration.mjs <source.png|jpg> <candidate.png> [label]
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { PNG } = require('pngjs');

const [srcPath, candPath, label = 'candidate'] = process.argv.slice(2);
if (!srcPath || !candPath) { console.error('usage: node score-registration.mjs <source> <candidate> [label]'); process.exit(2); }

const src = PNG.sync.read(readFileSync(srcPath));
const cand = PNG.sync.read(readFileSync(candPath));

// Work in a common downscaled space so metrics are resolution-independent and fast.
const W = 480;
const H = Math.round(W * (src.height / src.width));
function resample(img) {
  const out = { width: W, height: H, data: new Uint8ClampedArray(W * H * 4) };
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const sx = Math.min(img.width - 1, Math.round((x / W) * img.width));
      const sy = Math.min(img.height - 1, Math.round((y / H) * img.height));
      const s = (sy * img.width + sx) * 4, d = (y * W + x) * 4;
      out.data[d] = img.data[s]; out.data[d + 1] = img.data[s + 1];
      out.data[d + 2] = img.data[s + 2]; out.data[d + 3] = 255;
    }
  }
  return out;
}
const A = resample(src), B = resample(cand);

// ── 1. aspect drift ──────────────────────────────────────────────────────
const aspectSrc = src.width / src.height, aspectCand = cand.width / cand.height;
const aspectDriftPct = ((aspectCand - aspectSrc) / aspectSrc) * 100;

// ── helpers ──────────────────────────────────────────────────────────────
const lum = (img, i) => 0.299 * img.data[i] + 0.587 * img.data[i + 1] + 0.114 * img.data[i + 2];

// ── 2. roof registration: dark compact clusters ─────────────────────────
// "Roof-dark": low luminance, low saturation (excludes deep-green vegetation shadows poorly, so
// also require all three channels dark). Cluster by flood fill; keep compact blobs of sane size.
function darkMask(img) {
  const m = new Uint8Array(W * H);
  for (let p = 0; p < W * H; p++) {
    const i = p * 4;
    const r = img.data[i], g = img.data[i + 1], b = img.data[i + 2];
    const mx = Math.max(r, g, b);
    if (mx < 90 && Math.abs(r - g) < 40 && Math.abs(g - b) < 40) m[p] = 1;
  }
  return m;
}
function clusters(mask) {
  const seen = new Uint8Array(W * H), out = [];
  for (let p = 0; p < W * H; p++) {
    if (!mask[p] || seen[p]) continue;
    const q = [p]; seen[p] = 1;
    let n = 0, sx = 0, sy = 0, minx = W, maxx = 0, miny = H, maxy = 0;
    while (q.length) {
      const c = q.pop(); n++;
      const cx = c % W, cy = (c / W) | 0;
      sx += cx; sy += cy;
      if (cx < minx) minx = cx; if (cx > maxx) maxx = cx;
      if (cy < miny) miny = cy; if (cy > maxy) maxy = cy;
      for (const d of [-1, 1, -W, W]) {
        const nb = c + d;
        if (nb < 0 || nb >= W * H) continue;
        if (Math.abs((nb % W) - cx) > 1) continue;
        if (mask[nb] && !seen[nb]) { seen[nb] = 1; q.push(nb); }
      }
    }
    const bw = maxx - minx + 1, bh = maxy - miny + 1;
    const fill = n / (bw * bh);
    // sane roof: 40..4000 px at this scale, reasonably filled, not a long thin shadow line
    if (n >= 40 && n <= 4000 && fill > 0.45 && bw / bh < 5 && bh / bw < 5) {
      out.push({ x: sx / n, y: sy / n, n });
    }
  }
  return out.sort((a, b) => b.n - a.n).slice(0, 12);
}
const roofsA = clusters(darkMask(A));
const roofsB = clusters(darkMask(B));
let roofReport = 'no roof landmarks found in one of the images';
let roofMean = null;
if (roofsA.length && roofsB.length) {
  const diag = Math.hypot(W, H);
  // Greedy one-to-one matching, tight tolerance: a candidate roof can vouch for ONE source roof,
  // and only within 3.5% of the diagonal — beyond that it's a different building, not drift.
  const pairs = [];
  for (const ra of roofsA) for (const rb of roofsB) {
    pairs.push({ ra, rb, d: Math.hypot(ra.x - rb.x, ra.y - rb.y) });
  }
  pairs.sort((a, b) => a.d - b.d);
  const usedA = new Set(), usedB = new Set(), offsets = [];
  for (const p of pairs) {
    if (p.d > diag * 0.035) break;
    if (usedA.has(p.ra) || usedB.has(p.rb)) continue;
    usedA.add(p.ra); usedB.add(p.rb); offsets.push(p.d);
  }
  roofMean = offsets.length ? offsets.reduce((s, o) => s + o, 0) / offsets.length : null;
  roofReport = `${roofsA.length} src roofs, ${roofsB.length} cand roofs; 1:1 matched ${offsets.length}/${roofsA.length} within 3.5% diag`
    + (roofMean !== null ? `, mean offset ${roofMean.toFixed(1)}px (${((roofMean / diag) * 100).toFixed(2)}% of diagonal)` : ' — NONE within tolerance');
}

// ── 3. edge preservation ─────────────────────────────────────────────────
function edges(img) {
  const e = new Uint8Array(W * H);
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const i = (y * W + x) * 4;
      const gx = lum(img, i + 4) - lum(img, i - 4);
      const gy = lum(img, i + W * 4) - lum(img, i - W * 4);
      if (Math.hypot(gx, gy) > 42) e[y * W + x] = 1;
    }
  }
  return e;
}
function dilate(e, r) {
  const out = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!e[y * W + x]) continue;
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && nx < W && ny >= 0 && ny < H) out[ny * W + nx] = 1;
    }
  }
  return out;
}
const rawA = edges(A), rawB = edges(B);
const dB = dilate(rawB, 1), dA = dilate(rawA, 1);
let hit = 0, tot = 0, inv = 0, totB = 0;
for (let p = 0; p < W * H; p++) {
  if (rawA[p]) { tot++; if (dB[p]) hit++; }
  if (rawB[p]) { totB++; if (!dA[p]) inv++; }
}
const edgeKeep = tot ? (hit / tot) * 100 : 0;       // recall: source structure still present
const invented = totB ? (inv / totB) * 100 : 0;      // candidate edges with no source counterpart

// ── 4. repaint fraction ──────────────────────────────────────────────────
let distSum = 0, changed = 0;
for (let p = 0; p < W * H; p++) {
  const i = p * 4;
  const d = Math.hypot(A.data[i] - B.data[i], A.data[i + 1] - B.data[i + 1], A.data[i + 2] - B.data[i + 2]);
  distSum += d;
  if (d > 40) changed++;
}
const meanDist = distSum / (W * H);
const repaintPct = (changed / (W * H)) * 100;

console.log(`── ${label} ─────────────────────────────`);
console.log(`source ${src.width}x${src.height}  candidate ${cand.width}x${cand.height}`);
console.log(`1. aspect drift:      ${aspectDriftPct.toFixed(2)}%  ${Math.abs(aspectDriftPct) < 1 ? 'OK' : 'FAIL (>1%)'}`);
console.log(`2. roof registration: ${roofReport}`);
console.log(`3. edge preservation: ${edgeKeep.toFixed(1)}% of source edges kept (1px tol) · ${invented.toFixed(1)}% of candidate edges are new/moved`);
console.log(`4. repaint:           ${repaintPct.toFixed(1)}% of pixels visibly changed (mean color dist ${meanDist.toFixed(0)})`);
console.log(`verdict hints: repaint>60 & edges>55 = repainted AND faithful · repaint<25 = returned a copy · edges<35 = redesigned the site`);
