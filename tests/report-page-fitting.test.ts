import test from 'node:test';
import assert from 'node:assert/strict';
import { CHAPTER_PICTURE_MIN_SCALE, LIST_TAIL_MAX, fitChapterPictures, shortListTail } from '../lib/report-pdf.ts';
import { packReportCards, type ReportCardBox } from '../lib/report-visual-pdf.ts';

// A page body in the exported report is 734 pt tall; a figure is at most 440 pt and a concept
// picture at most 345 pt, each with about 62 pt of title and caption around it.
const PAGE = 734;
const figure = { natural: 440, extra: 62 };
const art = { natural: 270, extra: 74 };

// ── chapter pictures ────────────────────────────────────────────────────────────────────────────
test('pictures that fit at full size are set at full size', () => {
  assert.deepEqual(fitChapterPictures([art, art], PAGE), { count: 2, scale: 1 });
});

test('a figure and the picture that explains it share a page by both shrinking a little, together', () => {
  const fit = fitChapterPictures([figure, art], PAGE);
  assert.equal(fit.count, 2);
  assert.ok(fit.scale < 1 && fit.scale >= CHAPTER_PICTURE_MIN_SCALE, `scale ${fit.scale}`);
  const used = figure.extra + art.extra + (figure.natural + art.natural) * fit.scale;
  assert.ok(Math.abs(used - PAGE) < 0.001, 'the pair fills the page exactly, no overflow');
});

test('a picture is never shrunk below four fifths to squeeze it in — it waits for the next page instead', () => {
  assert.equal(CHAPTER_PICTURE_MIN_SCALE, 0.8);
  const fit = fitChapterPictures([figure, figure], PAGE);
  assert.deepEqual(fit, { count: 1, scale: 1 });
  for (let room = 0; room <= 1600; room += 37) {
    const some = fitChapterPictures([figure, art, figure, art], room);
    if (some.count) assert.ok(some.scale >= CHAPTER_PICTURE_MIN_SCALE - 1e-9 && some.scale <= 1, `room ${room}: scale ${some.scale}`);
  }
});

test('pictures keep their order: a small later picture never jumps ahead of a large one that must wait', () => {
  const room = 400;
  assert.deepEqual(fitChapterPictures([figure, art], room), { count: 0, scale: 1 });
  assert.equal(fitChapterPictures([art, figure], room).count, 1);
});

test('whatever is placed fits the room it was given', () => {
  for (let room = 100; room <= PAGE; room += 53) {
    const list = [art, figure, art];
    const fit = fitChapterPictures(list, room);
    const used = list.slice(0, fit.count).reduce((sum, picture) => sum + picture.extra + picture.natural * fit.scale, 0);
    assert.ok(used <= room + 1e-6, `room ${room}: used ${used}`);
  }
});

test('at the head of an empty page one picture is always set, so an oversized picture cannot loop forever', () => {
  const huge = { natural: 900, extra: 62 };
  assert.deepEqual(fitChapterPictures([huge], PAGE), { count: 0, scale: 1 });
  const forced = fitChapterPictures([huge, art], PAGE, true);
  assert.equal(forced.count, 1);
  assert.ok(Math.abs(huge.extra + huge.natural * forced.scale - PAGE) < 0.001, 'fitted to the page');
  assert.deepEqual(fitChapterPictures([], PAGE, true), { count: 0, scale: 1 });
});

// ── a list must not be left with a stub under a picture ─────────────────────────────────────────
const kinds = (text: string) => text.split(' ').map(word => ({ b: 'bullet', n: 'numbered', p: 'paragraph', h: 'h2', s: 'h3' }[word]!));

test('when a page breaks near the end of a list the last few items are set before the waiting picture', () => {
  const list = kinds('h p b b b b b b h');
  assert.equal(LIST_TAIL_MAX, 3);
  assert.equal(shortListTail(list, 7), true, 'one item left');
  assert.equal(shortListTail(list, 5), true, 'three items left');
  assert.equal(shortListTail(list, 4), false, 'four items left: the picture opens the page as usual');
});

test('a list that starts on the new page is not a tail: the picture still opens the page', () => {
  const list = kinds('h p b b h');
  assert.equal(shortListTail(list, 2), false);
  assert.equal(shortListTail(list, 1), false, 'a paragraph');
  assert.equal(shortListTail(list, 0), false, 'a heading');
  assert.equal(shortListTail(list, 99), false, 'past the end of the report');
  assert.equal(shortListTail([], 0), false);
});

test('numbered steps are protected like bullets, and a mixed run counts as one list', () => {
  assert.equal(shortListTail(kinds('p n n n n n'), 4), true);
  assert.equal(shortListTail(kinds('p b b n n p'), 3), true);
  assert.equal(shortListTail(kinds('p b b b b b b b'), 2), false);
});

// ── the overview pages at the front of the PDF ──────────────────────────────────────────────────
const TOPS = { titled: 120, continued: 58 };
const LIMIT = 800;
const card = (id: string, natural: number, extra: Partial<ReportCardBox> = {}): ReportCardBox => ({ id, fixed: 60, natural, min: natural, ...extra });

test('overview cards fill a page from the top down and keep their order when everything fits', () => {
  const slots = packReportCards([card('a', 150), card('b', 150), card('c', 150)], { y: 200, fresh: false }, TOPS, LIMIT);
  assert.deepEqual(slots.map(slot => `${slot.id}:${slot.page}:${slot.y}`), ['a:same:200', 'b:same:430', 'c:continued:58']);
});

test('a card that cannot share the page lets a later, smaller card fill the gap instead of leaving it empty', () => {
  const slots = packReportCards([card('tall', 600), card('small', 100)], { y: 500, fresh: false }, TOPS, LIMIT);
  assert.deepEqual(slots.map(slot => `${slot.id}:${slot.page}`), ['small:same', 'tall:continued']);
});

test('a drawing may be set a little smaller to share a page, but never below its minimum', () => {
  const [slot] = packReportCards([card('plan', 500, { min: 400 })], { y: 300, fresh: false }, TOPS, LIMIT);
  assert.deepEqual(slot, { id: 'plan', page: 'same', y: 300, chartHeight: 440 });
  const [moved] = packReportCards([card('plan', 500, { min: 460 })], { y: 300, fresh: false }, TOPS, LIMIT);
  assert.equal(moved.page, 'continued');
  assert.equal(moved.chartHeight, 500);
});

test('a drawing taller than a whole page is fitted to one page rather than running off it', () => {
  const [slot] = packReportCards([card('huge', 2000)], { y: 700, fresh: false }, TOPS, LIMIT);
  assert.equal(slot.page, 'continued');
  assert.equal(slot.y + 60 + slot.chartHeight, LIMIT);
});

test('a fresh page opens under its heading, and a titled card brings its heading with it', () => {
  const fresh = packReportCards([card('a', 100)], { y: 0, fresh: true }, TOPS, LIMIT);
  assert.deepEqual(fresh.map(slot => `${slot.page}:${slot.y}`), ['titled:120']);
  const titled = packReportCards([card('a', 600), card('b', 600, { titled: true })], { y: 120, fresh: false }, TOPS, LIMIT);
  assert.deepEqual(titled.map(slot => `${slot.id}:${slot.page}:${slot.y}`), ['a:same:120', 'b:titled:120']);
});

test('every card is placed exactly once and none overlaps the one above it', () => {
  const cards = [card('a', 300), card('b', 520, { min: 400 }), card('c', 90), card('d', 700), card('e', 60), card('f', 240, { titled: true })];
  const slots = packReportCards(cards, { y: 310, fresh: false }, TOPS, LIMIT);
  assert.deepEqual(slots.map(slot => slot.id).sort(), ['a', 'b', 'c', 'd', 'e', 'f']);
  let bottom = 310;
  for (const slot of slots) {
    if (slot.page !== 'same') bottom = 0;
    assert.ok(slot.y >= bottom, `${slot.id} starts at ${slot.y}, below ${bottom}`);
    bottom = slot.y + 60 + slot.chartHeight;
    assert.ok(bottom <= LIMIT, `${slot.id} ends at ${bottom}`);
  }
});
