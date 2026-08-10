import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { parseScriptBlocks } from '@/lib/narration-check';
import {
  reviewModule,
  renderReviewPacket,
  splitParagraphs,
  extractNumbers,
  spelledNumbers,
  extractReviewerAppendix,
} from '@/lib/narration-review';

// The review packet exists to get eight isiZulu drafts in front of a first-language speaker. It
// must never claim to have reviewed the language — it cannot — so what these tests guard is the
// narrow set of things it DOES assert: that a paragraph went missing, that a number moved, and
// that the translator's own notes reached the reviewer.
//
// The calibration line for all of it is seeds-sovereignty. It is the one module a human reviewed
// and signed off, and it is recorded in both languages. Anything this tool flags there is a false
// positive by definition.

const SCRIPT = (m: string, lang: string) =>
  readFileSync(join(process.cwd(), 'docs/narration', `${m}.${lang}.md`), 'utf8');

test('the module a human already reviewed comes back clean', () => {
  // THE calibration test. Two earlier versions of the number check failed exactly here: the first
  // required a word boundary after a digit and so never saw "30cm", and the second folded English
  // number WORDS into the comparison, which turned "one of the simplest" into a measurement and
  // took this module from zero findings to twenty. A checker that fires on known-good work is
  // measuring itself, and it gets switched off in a week.
  const review = reviewModule('seeds-sovereignty', SCRIPT('seeds-sovereignty', 'en'), SCRIPT('seeds-sovereignty', 'zu'));
  assert.equal(review.findings.length, 0, review.findings.map((f) => `slide ${f.slide}: ${f.detail}`).join('; '));
  assert.equal(review.pairs.length, 24);
});

test('a block no longer swallows the next slide heading', () => {
  // A real bug this work uncovered. Blocks ended where the next heading ENDED rather than where it
  // began, so every block but the last carried the following slide's title as spoken narration —
  // roughly five phantom words and one phantom paragraph apiece. The pacing check could not see it
  // because it derives clip lengths from these same counts, so the error cancelled itself out; it
  // surfaced only when two languages were compared paragraph by paragraph and EVERY slide was off
  // by exactly one.
  const blocks = parseScriptBlocks(SCRIPT('food-forest', 'en'));
  for (const b of blocks) {
    assert.ok(!/\*\*(?:Slide|Ikhasi)\s*\d+/.test(b.text), `slide ${b.slide} contains a slide heading`);
  }
  assert.equal(splitParagraphs(blocks[0].text).length, 4);
});

test('paragraphs are what the reviewer sees — cues and rules are not paragraphs', () => {
  const paras = splitParagraphs('First line.\n\n[pause]\n\nSecond line.\n\n---');
  assert.deepEqual(paras, ['First line.', 'Second line.']);
});

test('a number joined to its unit is still a number', () => {
  // "20 to 30cm of browns for every 5 to 10cm of greens" — a bounded pattern skips 30 and 10,
  // because a digit followed by a letter is not a word boundary. It then reported the correct
  // isiZulu translation of that exact sentence as a mismatch.
  assert.deepEqual(extractNumbers('Layer 20 to 30cm for every 5 to 10cm.'), ['10', '20', '30', '5']);
});

test('spelled-out English can cancel a finding but can never raise one', () => {
  // The asymmetry is the whole design. English narration is written to be spoken, so it says
  // "one point two metres" where the isiZulu writes 1.2 — that pairing must not be a drift. But
  // "one" and "three" in ordinary prose are not measurements, so they may never make the isiZulu
  // look like it lost a number.
  assert.ok(spelledNumbers('One metre to one point two metres wide.').includes('1.2'));
  assert.deepEqual(extractNumbers('One metre to one point two metres wide.'), [],
    'spelled numbers must not enter the comparison set');

  const en = '**Slide 1 — X**\n\nOne metre to one point two metres wide.\n';
  const zu = '**Ikhasi 1 — X**\n\nImitha eyi-1.2 ububanzi.\n';
  assert.equal(reviewModule('m', en, zu).findings.length, 0, '1.2 should be explained by "one point two"');
});

test('a dropped paragraph is caught, and named as a drop', () => {
  const en = '**Slide 1 — X**\n\nFirst thing.\n\nSecond thing.\n\nThird thing.\n';
  const zu = '**Ikhasi 1 — X**\n\nInto yokuqala.\n\nInto yesibili.\n';
  const [finding] = reviewModule('m', en, zu).findings;
  assert.equal(finding.kind, 'paragraph-count');
  assert.match(finding.detail, /not being said in isiZulu/);
});

test('a number that moved is caught', () => {
  const en = '**Slide 1 — X**\n\nDig the bed 30cm deep.\n';
  const zu = '**Ikhasi 1 — X**\n\nMba ibhedi ngamasentimitha angama-13.\n';
  const [finding] = reviewModule('m', en, zu).findings;
  assert.equal(finding.kind, 'number-drift');
  assert.match(finding.detail, /30/);
});

test('a slide with no isiZulu at all is caught', () => {
  const en = '**Slide 1 — X**\n\nA.\n\n---\n\n**Slide 2 — Y**\n\nB.\n';
  const zu = '**Ikhasi 1 — X**\n\nA.\n';
  const finding = reviewModule('m', en, zu).findings.find((f) => f.kind === 'missing-slide');
  assert.ok(finding && finding.slide === 2, 'a slide missing from the isiZulu deck must be reported');
});

test("the translator's own terminology notes reach the reviewer", () => {
  // Eight drafts end with a hand-written table of every term the translator was unsure of, WITH
  // their reasoning. The first version of this packet cut that off as non-narration and reported
  // "no terminology questions" for a module whose own script lists twenty-two of them — the exact
  // invisible-absence failure the packet is meant to prevent.
  const zu = SCRIPT('vegetables-staples', 'zu');
  const appendix = extractReviewerAppendix(zu);
  assert.match(appendix, /TERMS NEEDING REVIEW/);

  const review = reviewModule('vegetables-staples', SCRIPT('vegetables-staples', 'en'), zu);
  assert.ok(review.appendix.includes('TERMS NEEDING REVIEW'));
  const packet = renderReviewPacket(review);
  assert.ok(packet.includes('Succession planting'), "the translator's table is not in the packet");
});

test('a term the translator already explained is not asked again', () => {
  const en = '**Slide 1 — X**\n\nUse compost.\n';
  const zu = '**Ikhasi 1 — X**\n\nSebenzisa i-compost.\n\n---\n\n## TERMS NEEDING REVIEW\n\n'
    + '| English | Rendering | Why |\n|---|---|---|\n| Compost | i-compost | Loanword, unverified. |\n';
  const review = reviewModule('m', en, zu);
  assert.deepEqual(review.terms.map((t) => t.term), [],
    'compost is already in the translator\'s table — asking again wastes the reviewer');
});

test('a borrowing the translator did NOT flag is surfaced, with its count', () => {
  const en = '**Slide 1 — X**\n\nUse mulch.\n\n---\n\n**Slide 2 — Y**\n\nMore mulch.\n';
  const zu = '**Ikhasi 1 — X**\n\nSebenzisa i-mulch.\n\n---\n\n**Ikhasi 2 — Y**\n\nI-mulch eminingi.\n';
  const [term] = reviewModule('m', en, zu).terms;
  assert.equal(term.term, 'mulch');
  assert.equal(term.count, 2, 'the count is what lets a reviewer rule once instead of per slide');
  assert.deepEqual(term.slides, [1, 2]);
});

test('the packet never implies the isiZulu has been checked', () => {
  // The status board says these modules are DRAFTs awaiting a human. If the packet reads like a
  // clean bill of health, someone records from it and eight modules ship unreviewed.
  const packet = renderReviewPacket(
    reviewModule('seeds-sovereignty', SCRIPT('seeds-sovereignty', 'en'), SCRIPT('seeds-sovereignty', 'zu')),
  );
  assert.match(packet, /has not been reviewed by a first-language/);
  assert.match(packet, /We cannot check fluency and have not tried to/);
  assert.match(packet, /says nothing about whether the isiZulu is any good/,
    'a module with no mechanical findings must still say it is unreviewed');
});

test('mismatched slides are shown whole, never falsely paired line-to-line', () => {
  // On intro-permaculture slide 7 the isiZulu drops the line listing the alternatives. Pairing by
  // index then labelled the NEXT line as the missing one and displayed a correct translation as a
  // mismatch — precise-looking and wrong, which would send a reviewer to edit a good sentence.
  const en = '**Slide 1 — X**\n\nFirst thing.\n\nSecond thing.\n\nThird thing.\n';
  const zu = '**Ikhasi 1 — X**\n\nInto yokuqala.\n\nOkwesithathu.\n';
  const packet = renderReviewPacket(reviewModule('m', en, zu));
  assert.match(packet, /do not line up/);
  assert.ok(!packet.includes('**ZU** Okwesithathu.'),
    'the two languages were interleaved despite differing counts');
  assert.ok(packet.includes('Third thing.') && packet.includes('Okwesithathu.'),
    'both versions must still be shown in full');
});

test('a slide with no isiZulu says so in the body, not just the findings', () => {
  const en = '**Slide 1 — X**\n\nA.\n\n---\n\n**Slide 2 — Y**\n\nB.\n';
  const zu = '**Ikhasi 1 — X**\n\nA.\n';
  assert.match(renderReviewPacket(reviewModule('m', en, zu)), /nothing at all/);
});
