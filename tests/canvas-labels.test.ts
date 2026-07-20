import test from 'node:test';
import assert from 'node:assert/strict';

import { layoutCanvasLabels, estimatePillWidth, type CanvasLabelInput } from '../lib/canvas-labels.ts';

type Box = { x0: number; x1: number; y0: number; y1: number };
const boxOf = (i: CanvasLabelInput, x: number, y: number): Box => ({
  x0: x - i.w / 2,
  x1: x + i.w / 2,
  y0: y - i.h / 2,
  y1: y + i.h / 2,
});
const overlap = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

/** The guild that exposed the bug: seven plants, canopies 2.5–10 m, at real spacing. Coordinates
 *  are the icon centres in viewBox units for a 960x640 frame. */
const GUILD: CanvasLabelInput[] = [
  { id: 'macadamia', cx: 451, cy: 291, gap: 25, w: 82, h: 16, iconR: 16 },
  { id: 'pawpaw', cx: 485, cy: 288, gap: 18, w: 70, h: 16, iconR: 9 },
  { id: 'moringa', cx: 514, cy: 296, gap: 20, w: 76, h: 16, iconR: 11 },
  { id: 'banana', cx: 468, cy: 315, gap: 19, w: 76, h: 16, iconR: 10 },
  { id: 'mango', cx: 530, cy: 318, gap: 26, w: 66, h: 16, iconR: 16 },
  { id: 'citrus', cx: 497, cy: 333, gap: 20, w: 70, h: 16, iconR: 11 },
  { id: 'avocado', cx: 451, cy: 341, gap: 24, w: 79, h: 16, iconR: 15 },
];

test('no two laid-out pills overlap, at the density that broke the old layout', () => {
  const out = layoutCanvasLabels(GUILD);
  for (let i = 0; i < out.length; i++) {
    for (let j = i + 1; j < out.length; j++) {
      const a = boxOf(GUILD[i], out[i].x, out[i].y);
      const b = boxOf(GUILD[j], out[j].x, out[j].y);
      assert.equal(overlap(a, b), false, `${out[i].id} overlaps ${out[j].id}`);
    }
  }
});

// THE property the farmer reads, stated exactly. Pure proximity is NOT achievable at this
// density and asserting it would be wishful: to clear an overlap a pill sometimes has to travel
// past the plant below it. What must hold is that the pill's owner is never AMBIGUOUS — either
// the nearest icon is its own, or it carries a leader line that says so outright.
test('every pill is unambiguous: nearest to its own icon, or carrying a leader to it', () => {
  const out = layoutCanvasLabels(GUILD);
  const dist = (x: number, y: number, i: CanvasLabelInput) => Math.hypot(x - i.cx, y - i.cy);
  for (const pos of out) {
    const nearest = [...GUILD].sort((a, b) => dist(pos.x, pos.y, a) - dist(pos.x, pos.y, b))[0];
    assert.ok(
      nearest.id === pos.id || pos.moved,
      `"${pos.id}" pill sits closest to "${nearest.id}" with no leader line to disambiguate it`,
    );
  }
});

// The failure the first version of this algorithm shipped with: pushing a pill down to clear one
// overlap parked it squarely on the icon of the plant below, hiding that plant behind a label
// belonging to something else. Strictly worse than the overlap it solved.
test('no pill covers another plant’s icon disc', () => {
  const out = layoutCanvasLabels(GUILD);
  for (const pos of out) {
    const pill = GUILD.find((g) => g.id === pos.id)!;
    for (const other of GUILD) {
      if (other.id === pos.id) continue;
      const disc = { x0: other.cx - other.iconR, x1: other.cx + other.iconR, y0: other.cy - other.iconR, y1: other.cy + other.iconR };
      assert.equal(
        overlap(boxOf(pill, pos.x, pos.y), disc),
        false,
        `"${pos.id}" pill covers "${other.id}"’s icon`,
      );
    }
  }
});

test('the naive fixed-offset layout FAILS both properties — i.e. these tests can fail', () => {
  // Reproduces the old behaviour: pill at a fixed gap below the icon, no de-collision.
  const naive = GUILD.map((g) => ({ id: g.id, x: g.cx, y: g.cy + g.gap }));
  const dist = (x: number, y: number, i: CanvasLabelInput) => Math.hypot(x - i.cx, y - i.cy);
  const misread = naive.filter((p) => {
    const nearest = [...GUILD].sort((a, b) => dist(p.x, p.y, a) - dist(p.x, p.y, b))[0];
    return nearest.id !== p.id;
  });
  let collisions = 0;
  for (let i = 0; i < naive.length; i++) {
    for (let j = i + 1; j < naive.length; j++) {
      if (overlap(boxOf(GUILD[i], naive[i].x, naive[i].y), boxOf(GUILD[j], naive[j].x, naive[j].y))) collisions++;
    }
  }
  assert.ok(misread.length > 0, 'guard: the fixture must actually reproduce the bug');
  assert.ok(collisions > 0, 'guard: the fixture must actually produce overlaps');
});

test('a pill only claims a leader line when de-collision really displaced it', () => {
  const lonely: CanvasLabelInput[] = [{ id: 'solo', cx: 100, cy: 100, gap: 20, w: 80, h: 16, iconR: 12 }];
  assert.equal(layoutCanvasLabels(lonely)[0].moved, false);
  const moved = layoutCanvasLabels(GUILD).filter((p) => p.moved);
  assert.ok(moved.length > 0, 'a dense guild must displace at least one pill');
});

test('layout is independent of the order the farmer placed things in', () => {
  const forward = layoutCanvasLabels(GUILD);
  const shuffled = layoutCanvasLabels([...GUILD].reverse());
  for (const a of forward) {
    const b = shuffled.find((s) => s.id === a.id)!;
    assert.equal(b.y.toFixed(4), a.y.toFixed(4), `${a.id} moved when input order changed`);
  }
});

test('results come back in the caller order, so React keys stay stable', () => {
  assert.deepEqual(
    layoutCanvasLabels(GUILD).map((p) => p.id),
    GUILD.map((g) => g.id),
  );
});

test('pill width estimate clears the WIDEST width actually measured in the browser', () => {
  // Under-estimating lets two pills that really touch be treated as clear — that is the whole
  // failure mode. These are real measurements taken from the rendered canvas at 9px; the estimate
  // must be >= each of them. (An earlier 0.55em factor failed "Banana Clump" and left an
  // overlapping pair on the guild fixture above.)
  const MEASURED: Array<[string, number]> = [
    ['Macadamia Tree', 78.9],
    ['Pawpaw Tree', 65.5],
    ['Moringa Tree', 65.3],
    ['Banana Clump', 70.7],
    ['Mango Tree', 59.5],
    ['Citrus Tree', 56.1],
    ['Avocado Tree', 66.5],
  ];
  for (const [text, actual] of MEASURED) {
    const est = estimatePillWidth(text, 9, 5, 400);
    assert.ok(est >= actual, `"${text}": estimate ${est.toFixed(1)} < measured ${actual}`);
  }
  assert.equal(estimatePillWidth('a'.repeat(400), 9, 5, 120), 120, 'clamped to max');
});

// ── Release notes shown under the Refresh button ──────────────────────────────
import { visibleNotes, RELEASE_NOTES, MAX_SHOWN } from '../lib/release-notes.ts';

test('the update banner can never become a wall of text over the map', () => {
  assert.ok(visibleNotes().length <= MAX_SHOWN);
  const many = [{ when: 'x', changes: Array.from({ length: 40 }, (_, i) => `change ${i}`) }];
  assert.equal(visibleNotes(many).length, MAX_SHOWN);
  assert.deepEqual(visibleNotes([]), []);
});

test('release notes are written for the farmer, not the repo', () => {
  for (const line of visibleNotes(RELEASE_NOTES, 100)) {
    assert.ok(line.length <= 90, `too long to scan on a phone: "${line}"`);
    assert.ok(!/[A-Za-z]+\.(ts|tsx)\b|\(\)|refLayers|buildBlueprint|drawMarks/.test(line),
      `leaks implementation detail: "${line}"`);
  }
});
