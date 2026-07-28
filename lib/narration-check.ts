// Does a recorded clip actually contain the words it claims to?
//
// WHY THIS EXISTS: 48 clips arrive from a text-to-speech run as opaque mp3s. Nothing in the
// filename proves clip 14 holds block 14's text — and the failure mode is not silence or a crash,
// it is a farmer hearing the tomato wet method while looking at a picture of dry seed cleaning.
// The isiZulu Seeds deck came back one slide short and shifted ELEVEN consecutive slides out of
// step with their narration, with nothing visibly broken to warn anyone.
//
// The check is arithmetic: a clip's duration divided by its script block's word count gives a
// speaking rate. A correct set has a TIGHT SPREAD of rates; a clip built from the wrong block, cut
// short, or silently empty falls off that spread. On Seeds this came out at 2.00 words/sec for
// English and 1.19 for isiZulu.
//
// THE RATE IS NOT A CONSTANT AND MUST NOT BE HARDCODED. isiZulu is agglutinative — more meaning
// per word — so its words/sec is legitimately far below English. An absolute threshold flags every
// isiZulu clip as broken, which is exactly the mistake made when this was done by hand the first
// time. Everything below compares each clip to the MEDIAN OF ITS OWN LANGUAGE, so the check adapts
// to the voice, the rate setting and the language without being told about any of them.
//
// WHAT IT CATCHES, measured against the real Seeds recordings:
//   - a clip missing, extra, empty or truncated
//   - a clip whose length belongs to a very different block
//   - AN OFF-BY-ONE SHIFT, which is the failure that actually happened: a deck one slide short put
//     eleven slides against the wrong narration. Simulated on the real files it flags 2 clips in
//     each language, and the block-count check fires as well, so it is covered twice.
//
// WHAT IT DOES NOT CATCH, stated plainly so nobody trusts it further than it goes: two blocks of
// SIMILAR word count swapped with each other. Real TTS pacing varies a lot per clip — the isiZulu
// Seeds set spans 1.07 to 1.75 words/sec around a 1.37 median — so the tolerance has to be wide
// enough to accept that, which leaves room for a subtle swap to hide. Tightening it would flag
// genuine clips instead, and a checker that cries wolf gets switched off. Listening remains the
// only defence against a subtle swap; this catches the gross ones nobody would otherwise notice.

export interface ScriptBlock {
  slide: number;
  words: number;
}

export interface ClipTiming {
  slide: number;
  seconds: number;
}

export interface PacingOutlier {
  slide: number;
  words: number;
  seconds: number;
  rate: number;
  /** How far off the language's own median this clip is, as a multiplier. */
  ratio: number;
  reason: 'too-fast' | 'too-slow' | 'empty' | 'no-script-block';
}

export interface PacingReport {
  median: number;
  count: number;
  outliers: PacingOutlier[];
}

/**
 * Slide blocks and their word counts, from a narration script.
 *
 * Handles `**Slide 7 — Title**` and the isiZulu `**Ikhasi 7 — Isihloko (Slide 7 — Title)**`.
 * Matching only `Slide` was a real bug: it reported every isiZulu script as having zero blocks,
 * and the conclusion drawn was that the CONTENT was broken rather than the checker.
 */
export function parseScriptBlocks(text: string): ScriptBlock[] {
  const HEADING = /^\*\*(?:Slide|Ikhasi)\s*(\d+)[^\n]*\*\*\s*$/gm;
  const marks: Array<{ slide: number; start: number; end: number }> = [];
  for (let m = HEADING.exec(text); m; m = HEADING.exec(text)) {
    marks.push({ slide: Number(m[1]), start: m.index + m[0].length, end: text.length });
  }
  for (let i = 0; i < marks.length - 1; i++) marks[i].end = marks[i + 1].start;

  return marks.map(({ slide, start, end }) => {
    let body = text.slice(start, end);
    // A narration block never contains a markdown heading, so the first one after a block marks
    // where the block stopped and something else began — in practice an appendix. Cutting only the
    // heading LINE and keeping its body was the first version of this, and it counted the 22-row
    // glossary at the end of vegetables-staples.zu.md as slide 18's script: 1052 words instead of
    // 81, which would make a nine-minute clip look perfectly paced.
    const appendix = body.search(/^#{1,6}\s/m);
    if (appendix !== -1) body = body.slice(0, appendix);
    body = body
      .replace(/\[pause\]/gi, ' ')  // a stage cue, not spoken
      .replace(/^---\s*$/gm, ' ');  // block separators
    return { slide, words: (body.match(/[\p{L}\p{M}][\p{L}\p{M}'’-]*/gu) ?? []).length };
  });
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/**
 * Compare each clip's speaking rate to the median for this language.
 *
 * `tolerance` is a multiplier, not a rate: 1.6 means "more than 1.6x the median rate, or less than
 * 1/1.6 of it". Wide enough that a genuinely short slide with a pause does not trip it, narrow
 * enough to catch a clip holding the wrong block's text.
 */
export function checkPacing(
  blocks: ScriptBlock[],
  clips: ClipTiming[],
  tolerance = 1.6,
): PacingReport {
  const wordsBySlide = new Map(blocks.map((b) => [b.slide, b.words]));
  const rates: Array<{ slide: number; words: number; seconds: number; rate: number }> = [];
  const outliers: PacingOutlier[] = [];

  for (const clip of clips) {
    const words = wordsBySlide.get(clip.slide);
    if (words === undefined) {
      outliers.push({ slide: clip.slide, words: 0, seconds: clip.seconds, rate: 0, ratio: 0, reason: 'no-script-block' });
      continue;
    }
    // A clip with no audible length, or a block with no words, cannot be scored — and both are
    // defects in their own right, so they are reported rather than skipped.
    if (clip.seconds <= 0.3 || words === 0) {
      outliers.push({ slide: clip.slide, words, seconds: clip.seconds, rate: 0, ratio: 0, reason: 'empty' });
      continue;
    }
    rates.push({ ...clip, words, rate: words / clip.seconds });
  }

  const med = median(rates.map((r) => r.rate));
  if (med > 0) {
    for (const r of rates) {
      const ratio = r.rate / med;
      if (ratio > tolerance) outliers.push({ ...r, ratio, reason: 'too-fast' });
      else if (ratio < 1 / tolerance) outliers.push({ ...r, ratio, reason: 'too-slow' });
    }
  }

  outliers.sort((a, b) => a.slide - b.slide);
  return { median: med, count: rates.length, outliers };
}

/**
 * Human-readable line for one outlier.
 *
 * Says what was expected and what arrived, because "slide 14 is an outlier" tells whoever reads it
 * nothing about whether to re-record, re-import, or fix the script.
 */
export function describeOutlier(o: PacingOutlier, med: number): string {
  const n = String(o.slide).padStart(2, '0');
  if (o.reason === 'no-script-block') return `slide-${n}: a clip exists but the script has no block ${o.slide}`;
  if (o.reason === 'empty') return `slide-${n}: ${o.seconds.toFixed(1)}s of audio for ${o.words} words — empty or truncated`;
  const expected = o.words / med;
  return `slide-${n}: ${o.words} words in ${o.seconds.toFixed(1)}s (${o.rate.toFixed(2)} w/s, ${o.ratio.toFixed(2)}x the ${med.toFixed(2)} median) — expected about ${expected.toFixed(1)}s`;
}
