// Turning an isiZulu draft into something one person can actually review in one sitting.
//
// THE BLOCKER THIS EXISTS FOR. `npm run course:status` has said the same thing for weeks about
// eight of the ten modules: "isiZulu script is a DRAFT — needs a human isiZulu speaker before
// recording". That is not a task anyone can pick up in ten minutes. The reviewer would have to
// open two files side by side, scroll them in step, hold the English in their head while reading
// the isiZulu, and re-decide the same terminology question every time a word recurs. Nobody does
// that for 189 blocks across eight modules, so nothing gets reviewed and nothing gets recorded.
//
// WHAT A MACHINE MAY AND MAY NOT DECIDE HERE. It may not judge isiZulu. Fluency, register, whether
// a coined term is the word a farmer in KwaZulu-Natal would actually use — none of that is
// checkable, and pretending otherwise would produce a green tick over an unreviewed script, which
// is worse than the honest "DRAFT" the status board shows today.
//
// What a machine CAN do is the part a fluent reader is worst at: noticing an absence. A reviewer
// reading only the isiZulu cannot see the sentence that was never translated, and will read "13 cm"
// as comfortably as "30 cm". Those two failures survive any amount of fluency review, so they are
// what is checked mechanically — and the terminology decisions are collapsed to one ruling per
// term rather than one per occurrence, which is the difference between an afternoon and a week.

import { parseScriptBlocks, type ScriptBlock } from './narration-check';

/** A paragraph pair, in file order, for one slide. Either side may be missing. */
export interface BlockPair {
  slide: number;
  en: string[];
  zu: string[];
}

export type FindingKind = 'missing-slide' | 'paragraph-count' | 'number-drift';

export interface Finding {
  kind: FindingKind;
  slide: number;
  /** Written for the reviewer, not the developer: what to look at and why it matters. */
  detail: string;
}

/** An English-derived term in the isiZulu script, and how often the reviewer would meet it. */
export interface TermUse {
  term: string;
  count: number;
  slides: number[];
}

export interface ModuleReview {
  module: string;
  pairs: BlockPair[];
  findings: Finding[];
  /** Borrowings found in the narration that the translator's own table does NOT already cover. */
  terms: TermUse[];
  /**
   * The translator's own "TERMS NEEDING REVIEW" tail, verbatim, or '' if the module has none.
   *
   * Eight of the ten isiZulu drafts end with a hand-written table of every term the translator was
   * unsure of, WITH their reasoning ("Coined descriptive phrase; unclear if it reads naturally to a
   * farmer on first hearing"). That is worth more than anything derived by pattern-matching here,
   * and the first version of this packet threw it away — it cut the appendix off as non-narration,
   * which is right for word-counting and exactly wrong for a review document. A packet that
   * reported "no terminology questions" for a module whose own script lists twenty-two of them
   * would be the precise failure this file exists to prevent: an absence nobody can see.
   */
  appendix: string;
}

/**
 * Paragraphs as the reviewer sees them: blank-line separated, stage cues and rules dropped.
 *
 * A `---` inside a block body is the separator before the NEXT slide heading, so it never carries
 * narration; `[pause]` is a direction to the reader.
 */
export function splitParagraphs(text: string): string[] {
  return text
    .replace(/^---\s*$/gm, '')
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\[pause\]/gi, ' ').replace(/\s+/g, ' ').trim())
    .filter((p) => p.length > 0);
}

/**
 * Numbers as a farmer would hear them, with the unit that follows attached.
 *
 * Deliberately NOT every digit in the text: a bare ordinal inside a phrase is noise, but "30 cm",
 * "5 litres" and "2 weeks" are the agronomy, and those are what a mistyped translation corrupts
 * silently. Comparison is on the numeral itself — isiZulu spells small numbers out as often as not
 * ("ezintathu" for three), so requiring numerals to match one-for-one would flag a correct
 * translation on nearly every slide and the check would be switched off within a day.
 */
export function extractNumbers(text: string): string[] {
  const out: string[] = [];
  // No trailing \b. English narration writes "30cm" with the unit joined, and a digit followed by a
  // letter is not a word boundary — so a bounded pattern silently skipped every joined measurement
  // while catching the isiZulu spaced equivalent, and reported a drift on slides whose numbers
  // agreed perfectly. The first run of this check flagged "20 to 30cm of browns for every 5 to
  // 10cm of greens" as a mismatch against a correct translation of exactly that.
  const RE = /\d+(?:[.,]\d+)?/g;
  for (let m = RE.exec(text); m; m = RE.exec(text)) out.push(m[0].replace(',', '.'));
  return out.sort();
}

const WORD_VALUE: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
  seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50,
  sixty: 60, seventy: 70, eighty: 80, ninety: 90, hundred: 100, thousand: 1000,
};

/**
 * Numbers the English narration spells out. Used ONLY to cancel a finding, never to create one.
 *
 * The English scripts are written to be SPOKEN, so they say "one point two metres" where the
 * isiZulu draft writes "1.2", and the check reported a drift on three slides of vegetables-staples
 * whose measurements agreed perfectly.
 *
 * The obvious repair — fold these into the English number set — was tried and was much worse. In
 * ordinary prose "one" and "three" are not measurements ("one of the simplest", "in three ways"),
 * so every such word became a number the isiZulu was then accused of losing: seeds-sovereignty,
 * the one module a human has actually reviewed and signed off, went from zero findings to twenty.
 * That is the calibration line. A check that fires on the known-good module is measuring itself.
 *
 * So this reads in one direction only. It can explain away an isiZulu numeral whose English
 * counterpart is written in words; it can never assert that a number is missing. Deliberately
 * shallow — single cardinals and the "X point Y" decimal form, which is what these scripts contain.
 */
export function spelledNumbers(text: string): string[] {
  const out: string[] = [];
  const words = text.toLowerCase().match(/[a-z]+/g) ?? [];
  for (let i = 0; i < words.length; i++) {
    const whole = WORD_VALUE[words[i]];
    if (whole === undefined) continue;
    const frac = words[i + 1] === 'point' ? WORD_VALUE[words[i + 2]] : undefined;
    if (frac !== undefined && frac < 10) {
      out.push(`${whole}.${frac}`);
      i += 2;
    } else {
      out.push(String(whole));
    }
  }
  return out;
}

// Terms that are English on the page but are simply how the thing is said — flagging them would
// bury the real questions. Kept short and explicit on purpose: every addition is a decision that a
// reviewer no longer gets to make, so this list must stay small enough to read in one glance.
const ACCEPTED_BORROWINGS = new Set(['module', 'app', 'video', 'website', 'internet']);

/**
 * English-derived terms in the isiZulu script, counted, so each is ruled on ONCE.
 *
 * isiZulu takes loanwords with a noun-class prefix — i-compost, ama-cover crops, i-mulch — and the
 * draft is full of them. Every one is a real question ("is there a Zulu word, or is the borrowing
 * what people actually say?") but it is the SAME question each time it recurs, and answering it
 * twenty-two times is how a review stalls. Presented once with a count and the slides it appears
 * on, a reviewer can rule on the whole module's terminology in a few minutes and then read for
 * fluency with the vocabulary already settled.
 */
export function borrowedTerms(blocks: ScriptBlock[]): TermUse[] {
  const seen = new Map<string, { count: number; slides: Set<number> }>();
  // The prefix is the marker of a borrowing that has been ADOPTED into isiZulu grammar; the stem
  // after it is the English word the reviewer is being asked about.
  for (const b of blocks) {
    // Declared per block on purpose. A /g/ regex carries lastIndex between calls, so hoisting this
    // out of the loop makes it resume mid-way through the next block and silently miss terms — the
    // count then under-reports, which is the one number a reviewer uses to decide what to rule on.
    // Case-insensitive: a sentence starting "I-mulch ..." is the same borrowing as "i-mulch" mid
    // sentence, and isiZulu capitalises at sentence start like any other language. Matching only
    // lower case dropped every term that happened to open a sentence.
    const RE = /\b(?:i|ama|izi|isi|u|ubu|uku)-([A-Za-z][A-Za-z-]{2,})/gi;
    for (let m = RE.exec(b.text); m; m = RE.exec(b.text)) {
      const term = m[1].toLowerCase().replace(/-+$/, '');
      if (ACCEPTED_BORROWINGS.has(term)) continue;
      const e = seen.get(term) ?? { count: 0, slides: new Set<number>() };
      e.count += 1;
      e.slides.add(b.slide);
      seen.set(term, e);
    }
  }
  return [...seen.entries()]
    .map(([term, e]) => ({ term, count: e.count, slides: [...e.slides].sort((a, b) => a - b) }))
    .sort((a, b) => b.count - a.count || a.term.localeCompare(b.term));
}

/**
 * The translator's own notes, which live after the last slide.
 *
 * `parseScriptBlocks` deliberately cuts everything from the first markdown heading inside a block,
 * because for word-counting that tail is an appendix and not narration. Here we want precisely the
 * part it discards.
 */
export function extractReviewerAppendix(zuText: string): string {
  const lastSlide = zuText.search(/\*\*(?:Slide|Ikhasi)\s*\d+[^\n]*\*\*\s*$/m);
  if (lastSlide === -1) return '';
  const tail = zuText.slice(lastSlide);
  const heading = tail.search(/^#{1,6}\s/m);
  return heading === -1 ? '' : tail.slice(heading).trim();
}

/** Pair the two scripts slide by slide and report what a fluent reader would not see. */
export function reviewModule(module: string, enText: string, zuText: string): ModuleReview {
  const en = parseScriptBlocks(enText);
  const zu = parseScriptBlocks(zuText);
  const zuBySlide = new Map(zu.map((b) => [b.slide, b]));
  const findings: Finding[] = [];
  const pairs: BlockPair[] = [];

  for (const enBlock of en) {
    const zuBlock = zuBySlide.get(enBlock.slide);
    const enParas = splitParagraphs(enBlock.text);

    if (!zuBlock) {
      findings.push({
        kind: 'missing-slide',
        slide: enBlock.slide,
        detail: 'This slide has no isiZulu script at all. The recording would fall silent here, or '
          + 'every clip after it would sit against the wrong slide.',
      });
      pairs.push({ slide: enBlock.slide, en: enParas, zu: [] });
      continue;
    }

    const zuParas = splitParagraphs(zuBlock.text);
    pairs.push({ slide: enBlock.slide, en: enParas, zu: zuParas });

    if (enParas.length !== zuParas.length) {
      findings.push({
        kind: 'paragraph-count',
        slide: enBlock.slide,
        detail: `English has ${enParas.length} paragraph(s), isiZulu has ${zuParas.length}. `
          + (zuParas.length < enParas.length
            ? 'Something said in English is not being said in isiZulu — check which line is missing.'
            : 'The isiZulu says something the English does not. Confirm it is a split, not an addition.'),
      });
    }

    const enNums = extractNumbers(enBlock.text);
    const zuNums = extractNumbers(zuBlock.text);
    const enSpelled = spelledNumbers(enBlock.text);
    const missing = enNums.filter((n) => !zuNums.includes(n));
    const extra = zuNums.filter((n) => !enNums.includes(n) && !enSpelled.includes(n));
    if (missing.length || extra.length) {
      const parts: string[] = [];
      if (missing.length) parts.push(`in English but not isiZulu: ${missing.join(', ')}`);
      if (extra.length) parts.push(`in isiZulu but not English: ${extra.join(', ')}`);
      findings.push({
        kind: 'number-drift',
        slide: enBlock.slide,
        detail: `Numbers differ (${parts.join('; ')}). A wrong measurement reads perfectly fluently, `
          + 'so this is the one thing a review cannot catch by ear.',
      });
    }
  }

  for (const zuBlock of zu) {
    if (!en.some((b) => b.slide === zuBlock.slide)) {
      findings.push({
        kind: 'missing-slide',
        slide: zuBlock.slide,
        detail: 'There is isiZulu narration for a slide the English deck does not have.',
      });
    }
  }

  // Only surface a borrowing the translator has not ALREADY raised. Listing "i-compost" as an open
  // question next to a table where the translator has explained why they chose it wastes the one
  // resource this whole exercise is short of: the reviewer's attention.
  const appendix = extractReviewerAppendix(zuText);
  const appendixLower = appendix.toLowerCase();
  const terms = borrowedTerms(zu).filter((t) => !appendixLower.includes(t.term));

  return { module, pairs, findings, terms, appendix };
}

/** The document the reviewer actually opens. One module, one file, no scrolling two windows. */
export function renderReviewPacket(review: ModuleReview): string {
  const { module, pairs, findings, terms, appendix } = review;
  const out: string[] = [];

  out.push(`# isiZulu review — ${module}`);
  out.push('');
  out.push('This script was drafted by machine translation and **has not been reviewed by a first-language');
  out.push('isiZulu speaker**. Until it has, it cannot be recorded. You are that review.');
  out.push('');
  out.push('**What we are asking you to judge** — does each isiZulu block say what the English block says,');
  out.push('in language a smallholder farmer in KwaZulu-Natal would actually use? Register matters as much');
  out.push('as accuracy: this is spoken narration, heard once, by someone standing in a field.');
  out.push('');
  out.push('**What we have already checked by machine** — dropped paragraphs and mismatched numbers, listed');
  out.push('below. Everything else needs your ear. We cannot check fluency and have not tried to.');
  out.push('');
  out.push('**How to mark it up** — edit the isiZulu column directly, or write your correction underneath.');
  out.push('Anything you are unsure of, mark `?` and move on; a flagged doubt is more useful than a guess.');
  out.push('');

  out.push('## 1. Terminology — please rule on these first');
  out.push('');
  if (appendix) {
    out.push('The translator kept their own list of every term they were unsure of, with their reasoning.');
    out.push('It is reproduced below exactly as written. These are the highest-value questions in the');
    out.push('module: each one is a term a farmer will hear repeatedly, and settling it here settles every');
    out.push('slide it appears on.');
    out.push('');
    // Demote the appendix's own headings so they nest under this section instead of competing with
    // it — the notes were written as a top-level tail of the script, not as part of a packet.
    out.push(appendix.replace(/^(#{1,5})(\s)/gm, '#$1$2'));
    out.push('');
  } else {
    out.push('_The translator left no terminology notes for this module._');
    out.push('');
  }

  out.push('### Also carried over from English');
  out.push('');
  if (terms.length === 0) {
    out.push(appendix
      ? '_Nothing beyond the terms already listed above._'
      : '_No English-derived terms found in the narration._');
  } else {
    out.push('These English words appear in the narration with an isiZulu noun-class prefix and are **not**');
    out.push('covered by the list above. Same question for each: is there a word a farmer would use, or is');
    out.push('the borrowing what people actually say?');
    out.push('');
    out.push('| Term as drafted | Times used | Slides | Your ruling |');
    out.push('|---|---:|---|---|');
    for (const t of terms) {
      out.push(`| ${t.term} | ${t.count} | ${t.slides.join(', ')} |  |`);
    }
  }
  out.push('');

  out.push('## 2. Things the machine flagged');
  out.push('');
  if (findings.length === 0) {
    out.push('_Nothing flagged. Every slide has isiZulu narration, the paragraph counts match, and the');
    out.push('numbers agree. This says nothing about whether the isiZulu is any good._');
  } else {
    for (const f of findings) {
      out.push(`- **Slide ${f.slide}** — ${f.detail}`);
    }
  }
  out.push('');

  out.push('## 3. The scripts, side by side');
  out.push('');
  for (const p of pairs) {
    out.push(`### Slide ${p.slide}`);
    out.push('');

    if (p.en.length === p.zu.length) {
      for (let i = 0; i < p.en.length; i++) {
        out.push(`> **EN** ${p.en[i]}`);
        out.push('>');
        out.push(`> **ZU** ${p.zu[i]}`);
        out.push('');
      }
      continue;
    }

    // The counts differ, so line i on the left is NOT line i on the right — one side has dropped
    // or merged something and everything after it has shifted. Interleaving anyway looked precise
    // and pointed at the wrong sentence: on intro-permaculture slide 7 the missing line is the one
    // listing the alternatives, but an index pairing marked the line AFTER it as missing and
    // showed the correct translation as a mismatch. A reviewer trusting that would edit a sentence
    // that was never wrong. Below the counts differ, so the two versions are shown whole and the
    // alignment is left to the person who can actually read both.
    out.push(`_These do not line up: ${p.en.length} paragraph(s) in English, ${p.zu.length} in isiZulu._`);
    out.push('_Shown separately rather than side by side — pairing them here would point at the wrong line._');
    out.push('');
    out.push('**English**');
    out.push('');
    for (const line of p.en) out.push(`> ${line}`);
    out.push('');
    out.push('**isiZulu**');
    out.push('');
    if (p.zu.length === 0) out.push('> _(**nothing at all** — this slide has no isiZulu narration)_');
    for (const line of p.zu) out.push(`> ${line}`);
    out.push('');
  }

  return out.join('\n');
}
