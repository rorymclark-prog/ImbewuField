import assert from 'node:assert/strict';
import test from 'node:test';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { COURSE_NARRATION } from '@/lib/course-audio';

// A NARRATION SCRIPT IS READ ALOUD TO A FARMER AS INSTRUCTION. Whatever is in the file is what
// they hear, so the file's contents are a safety surface, not just content.
//
// Two ways that has nearly gone wrong:
//
// 1. The Seeds scripts arrived written for a facilitator addressing a room — SHO / BUZA / YENZA /
//    HLOLA labels, "participants", "the group". 48 clips were nearly recorded telling a farmer
//    alone on a homestead to turn to the person next to them.
//
// 2. vegetables-staples.zu.md carries an appendix its own author wrote as a BLOCKER: a table of 22
//    agronomic terms marked "uncertain isiZulu terminology, coined or adapted for this draft",
//    with the note that it "needs a human reviewer ... before this script goes anywhere near a
//    learner". The module production pack meanwhile calls Vegetables "the fastest route to a
//    second complete module ... it needs only the deck and the recording". Following that would
//    have put 22 invented farming terms into a farmer's ears in the voice of an authority — and
//    the appendix sits after the last slide heading, so a parser that reads to end-of-file would
//    also have recorded the glossary itself as a nine-minute clip.
//
// These tests do not judge translation quality; no automated check can. They make it impossible to
// promote a script that has declared itself unfinished.

const DIR = join(process.cwd(), 'docs/narration');
const SCRIPTS = readdirSync(DIR).filter((f) => f.endsWith('.md'));

/** Phrases a script uses to say, in its own words, that it is not ready. */
const BLOCKER_MARKERS = [
  /TERMS NEEDING REVIEW/i,
  /draft translation only/i,
  /Notes for the Human Reviewer/i,
  /before this script goes anywhere near a learner/i,
];

interface Script { file: string; moduleId: string; lang: string; text: string; }

const PARSED: Script[] = SCRIPTS.map((file) => {
  const m = /^(.+)\.(\w{2})\.md$/.exec(file);
  assert.ok(m, `${file}: expected <module-id>.<lang>.md`);
  return { file, moduleId: m![1], lang: m![2], text: readFileSync(join(DIR, file), 'utf8') };
});

function hasBlocker(s: Script): boolean {
  return BLOCKER_MARKERS.some((re) => re.test(s.text));
}

test('a script that declares itself unreviewed is never wired up as available narration', () => {
  // The gate. COURSE_NARRATION.languages is what makes the app offer audio in a language and what
  // tells a recorder the script is releasable. A script carrying its own blocker must not appear
  // there — reviewing it is a human's job, and deleting the appendix is not the same as doing it.
  for (const s of PARSED) {
    if (!hasBlocker(s)) continue;
    const languages = COURSE_NARRATION[s.moduleId]?.languages ?? [];
    assert.ok(
      !languages.includes(s.lang),
      `${s.file} says it needs human review, but COURSE_NARRATION lists '${s.lang}' as available for ${s.moduleId}. Get the review done, then remove the appendix — do not remove the appendix to pass this test.`,
    );
  }
});

test('every script the app DOES offer contains nothing but slides', () => {
  // Anything outside a slide block is at risk of being read aloud: vegetables-staples.en.md opens
  // with seventeen lines of instructions to the operator, and the isiZulu file ends with a
  // glossary. Neither is narration. A released script must be slides and nothing else, so no
  // parser can pick up material that was never meant for a farmer's ears.
  for (const s of PARSED) {
    const languages = COURSE_NARRATION[s.moduleId]?.languages ?? [];
    if (!languages.includes(s.lang)) continue;

    const firstHeading = s.text.search(/^\*\*(?:Slide|Ikhasi)\s*\d+/m);
    assert.notEqual(firstHeading, -1, `${s.file}: no slide headings at all`);
    const preamble = s.text.slice(0, firstHeading).trim();
    assert.equal(preamble, '', `${s.file}: ${preamble.split('\n').length} lines before slide 1 would be read aloud`);

    for (const re of BLOCKER_MARKERS) {
      assert.doesNotMatch(s.text, re, `${s.file}: released script still carries a reviewer appendix`);
    }
  }
});

test('a released script never addresses a room', () => {
  // The Seeds near-miss. A learner is alone on a phone; there is no group, no participants and no
  // facilitator. Ordinary prose uses of "group" are fine ("beans and maize belong in that group"),
  // so this matches the words that only appear when someone is running a workshop.
  const ROOM = /\b(participants?|facilitators?|abahlanganyeli|umhlanganisi)\b/i;
  const STAGE_LABEL = /^\s*(SHO|BUZA|YENZA|HLOLA)\b\s*[:—-]/m;
  for (const s of PARSED) {
    const languages = COURSE_NARRATION[s.moduleId]?.languages ?? [];
    if (!languages.includes(s.lang)) continue;
    assert.doesNotMatch(s.text, ROOM, `${s.file}: written for a room, not a farmer alone`);
    assert.doesNotMatch(s.text, STAGE_LABEL, `${s.file}: carries trainer stage directions`);
  }
});

test('both languages of a released module have the same number of blocks', () => {
  // The isiZulu Seeds deck came back one slide short of the English one, which silently shifted
  // eleven slides out of step with their narration — a farmer would have heard the tomato wet
  // method while looking at dry seed cleaning, with nothing visibly broken to warn anyone.
  const byModule = new Map<string, Script[]>();
  for (const s of PARSED) byModule.set(s.moduleId, [...(byModule.get(s.moduleId) ?? []), s]);

  for (const [moduleId, scripts] of byModule) {
    const languages = COURSE_NARRATION[moduleId]?.languages ?? [];
    const released = scripts.filter((s) => languages.includes(s.lang));
    if (released.length < 2) continue;
    const counts = released.map((s) => ({
      lang: s.lang,
      n: (s.text.match(/^\*\*(?:Slide|Ikhasi)\s*\d+/gm) ?? []).length,
    }));
    const first = counts[0].n;
    for (const c of counts) {
      assert.equal(c.n, first, `${moduleId}: ${c.lang} has ${c.n} blocks, ${counts[0].lang} has ${first}`);
    }
    assert.equal(first, COURSE_NARRATION[moduleId].tracks.length, `${moduleId}: block count does not match the track manifest`);
  }
});

test('the vegetables isiZulu script is still recognised as blocked', () => {
  // Named explicitly, because this is the one that a plan document actively recommends recording.
  // If the appendix is ever removed, this fails and someone has to say out loud whether the
  // agronomist review actually happened.
  const zu = PARSED.find((s) => s.file === 'vegetables-staples.zu.md');
  assert.ok(zu, 'vegetables-staples.zu.md is missing — if it moved, update this test');
  assert.ok(
    hasBlocker(zu!),
    'vegetables-staples.zu.md no longer declares itself a draft. If an isiZulu-speaking agronomist has reviewed its 22 coined terms, say so in the commit and delete this test. If not, restore the appendix.',
  );
});
