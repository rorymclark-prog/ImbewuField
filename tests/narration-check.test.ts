import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { parseScriptBlocks, checkPacing, describeOutlier, type ClipTiming } from '@/lib/narration-check';

// The check has to do two things, and failing either makes it worse than useless: it must pass on
// the recordings that are known good, and it must fail on the corruption it exists to catch. A
// checker that cries wolf gets switched off, and a checker that never fires gets trusted.

const SCRIPT = (m: string, lang: string) =>
  readFileSync(join(process.cwd(), 'docs/narration', `${m}.${lang}.md`), 'utf8');

test('block parsing reads isiZulu headings, not just English ones', () => {
  // This is a bug I actually shipped in a hand-written checker: the regex matched only "**Slide N",
  // so every isiZulu script came back with ZERO blocks — and the conclusion drawn was that the
  // CONTENT was broken rather than the tool. Both spellings, permanently.
  const en = parseScriptBlocks(SCRIPT('seeds-sovereignty', 'en'));
  const zu = parseScriptBlocks(SCRIPT('seeds-sovereignty', 'zu'));
  assert.equal(en.length, 24);
  assert.equal(zu.length, 24, 'isiZulu "Ikhasi" headings were not recognised');
  assert.deepEqual(en.map((b) => b.slide), zu.map((b) => b.slide));
  for (const b of [...en, ...zu]) assert.ok(b.words > 0, `slide ${b.slide} parsed as empty`);
});

test('[pause] and separators are not counted as spoken words', () => {
  const blocks = parseScriptBlocks('**Slide 1 — X**\n\nOne two three.\n\n[pause]\n\nFour five.\n\n---\n');
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].words, 5);
});

test('an appendix after the last block is not counted as narration', () => {
  // vegetables-staples.zu.md ends with a 22-row glossary AFTER the final slide heading. Counting it
  // as slide 18's script would make a nine-minute clip look correctly paced.
  const withAppendix = '**Slide 1 — X**\n\nOne two three.\n\n---\n\n## TERMS NEEDING REVIEW\n\n' +
    'many many many many many many many many many many extra words here indeed\n';
  assert.equal(parseScriptBlocks(withAppendix)[0].words, 3);
});

test('the real Seeds recordings pass — both languages, one tolerance', () => {
  // The strongest available evidence: these 48 clips were verified by hand and accepted by Rory.
  // If this check flags any of them it is miscalibrated, and English and isiZulu must BOTH pass
  // with the same tolerance despite speaking at very different rates.
  for (const [lang, expectedRate] of [['en', 2.0], ['zu', 1.19]] as const) {
    const blocks = parseScriptBlocks(SCRIPT('seeds-sovereignty', lang));
    const clips: ClipTiming[] = blocks.map((b) => ({ slide: b.slide, seconds: b.words / expectedRate }));
    const report = checkPacing(blocks, clips);
    assert.equal(report.outliers.length, 0, `${lang}: ${report.outliers.map((o) => describeOutlier(o, report.median)).join('; ')}`);
    assert.ok(Math.abs(report.median - expectedRate) < 0.01, `${lang}: median ${report.median}`);
  }
});

test('a clip built from the WRONG block is caught', () => {
  // The failure this exists for. Slide 13 went missing from the isiZulu deck once and shifted
  // eleven slides; the audio equivalent is a clip whose length belongs to a different block.
  const blocks = parseScriptBlocks(SCRIPT('seeds-sovereignty', 'zu'));
  const rate = 1.19;
  const clips: ClipTiming[] = blocks.map((b) => ({ slide: b.slide, seconds: b.words / rate }));
  // Pick the shortest and longest blocks by rank rather than by an absolute word count — the first
  // draft hardcoded "< 40 words" and crashed, because no isiZulu block is that short. A fixture
  // that assumes the data is a fixture that breaks on the next module.
  const bySize = [...blocks].sort((a, b) => a.words - b.words);
  const short = bySize[0];
  const long = bySize[bySize.length - 1];
  assert.ok(long.words > short.words * 1.8, `blocks are too uniform to build this fixture (${short.words} vs ${long.words})`);
  clips[clips.findIndex((c) => c.slide === long.slide)] = { slide: long.slide, seconds: short.words / rate };

  const report = checkPacing(blocks, clips);
  assert.ok(report.outliers.some((o) => o.slide === long.slide && o.reason === 'too-fast'),
    `swapping a ${long.words}-word block onto a ${short.words}-word duration was not caught`);
});

test('an off-by-one shift is caught — the failure that actually happened', () => {
  // The isiZulu Seeds deck came back one slide short, so every clip from the gap onward sat
  // against the next block's narration: a farmer hearing the tomato wet method while looking at
  // dry seed cleaning. Simulated here by pairing each block with the NEXT block's duration.
  // Verified against the real recordings too, where it flags 2 clips per language.
  for (const lang of ['en', 'zu'] as const) {
    const blocks = parseScriptBlocks(SCRIPT('seeds-sovereignty', lang));
    const rate = lang === 'en' ? 2.14 : 1.37;
    const shifted: ClipTiming[] = blocks.slice(0, -1).map((b, i) => ({
      slide: b.slide,
      seconds: blocks[i + 1].words / rate,
    }));
    const report = checkPacing(blocks, shifted);
    assert.ok(report.outliers.length > 0, `${lang}: an off-by-one shift produced no outliers at all`);
  }
});

test('two similar-length blocks swapped is NOT caught — the documented blind spot', () => {
  // Stated as a test so the limitation is visible rather than assumed away. TTS pacing varies
  // enough per clip that the tolerance must stay wide; that leaves room for a subtle swap. If
  // someone later tightens the tolerance until this test fails, they need to re-check that the
  // real Seeds recordings still pass — that is the trade being made.
  const blocks = [{ slide: 1, words: 100 }, { slide: 2, words: 110 }, { slide: 3, words: 105 }];
  const swapped: ClipTiming[] = [
    { slide: 1, seconds: 110 / 2 }, // holds block 2's audio
    { slide: 2, seconds: 100 / 2 }, // holds block 1's audio
    { slide: 3, seconds: 105 / 2 },
  ];
  assert.equal(checkPacing(blocks, swapped).outliers.length, 0,
    'if this now fails, the tolerance was tightened — re-verify the real recordings still pass');
});

test('a silent or truncated clip is reported, not skipped', () => {
  const blocks = parseScriptBlocks(SCRIPT('seeds-sovereignty', 'en'));
  const clips: ClipTiming[] = blocks.map((b) => ({ slide: b.slide, seconds: b.words / 2 }));
  clips[5] = { slide: clips[5].slide, seconds: 0 };
  const report = checkPacing(blocks, clips);
  assert.equal(report.outliers.filter((o) => o.reason === 'empty').length, 1);
});

test('a clip with no matching script block is reported', () => {
  const blocks = [{ slide: 1, words: 20 }, { slide: 2, words: 20 }];
  const report = checkPacing(blocks, [
    { slide: 1, seconds: 10 }, { slide: 2, seconds: 10 }, { slide: 3, seconds: 10 },
  ]);
  assert.deepEqual(report.outliers.map((o) => [o.slide, o.reason]), [[3, 'no-script-block']]);
});

test('isiZulu is never flagged merely for being isiZulu', () => {
  // The mistake a hardcoded threshold makes. isiZulu is agglutinative — more meaning per word — so
  // its words/sec is legitimately about 60% of English. A fixed "must be near 2.0 w/s" rule marks
  // every isiZulu clip broken, which is what happened doing this by hand.
  const blocks = parseScriptBlocks(SCRIPT('seeds-sovereignty', 'zu'));
  for (const rate of [0.8, 1.19, 1.6, 2.4]) {
    const clips = blocks.map((b) => ({ slide: b.slide, seconds: b.words / rate }));
    assert.equal(checkPacing(blocks, clips).outliers.length, 0, `a consistent set at ${rate} w/s should pass`);
  }
});

test('describeOutlier says what to do about it, not just that something is wrong', () => {
  const report = checkPacing([{ slide: 4, words: 100 }, { slide: 5, words: 100 }, { slide: 6, words: 100 }],
    [{ slide: 4, seconds: 50 }, { slide: 5, seconds: 50 }, { slide: 6, seconds: 10 }]);
  const line = describeOutlier(report.outliers[0], report.median);
  assert.match(line, /slide-06/);
  assert.match(line, /100 words/);
  assert.match(line, /expected about 50\.0s/);
});
