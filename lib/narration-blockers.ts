/**
 * The one list of phrases that mean "a human has not signed this script off yet".
 *
 * WHY THIS IS ITS OWN FILE. There were two lists. tests/narration-scripts.test.ts held four
 * patterns and refused to let a script carrying any of them be wired into COURSE_NARRATION;
 * scripts/course-status.mjs held two DIFFERENT ones and decided what the production board printed.
 * They agreed on vegetables-staples.zu.md by coincidence — its appendix happens to match both —
 * and disagreed on everything else.
 *
 * The consequence was not cosmetic. Seven isiZulu drafts that no human had read were printed on
 * the board as "isiZulu script reviewed, not yet recorded", which is an instruction to go and
 * record them. The test was holding the gate shut while the board told you the gate was open. Two
 * places answering one question and drifting is this codebase's most repeated defect, and the
 * remedy is always the same: one source, imported by both.
 *
 * PURE MODULE — no fs, no react. Both a test and a plain node script import it.
 */

/**
 * Any of these appearing anywhere in a narration script means it is not releasable.
 *
 * Deliberately the UNION of what the two lists used to hold, so widening the check cannot
 * accidentally release something that used to be blocked. Add a phrase here when a new appendix
 * style appears; never add one to a caller.
 */
export const NARRATION_BLOCKER_MARKERS: readonly RegExp[] = [
  /TERMS NEEDING REVIEW/i,
  /draft translation only/i,
  /Notes for the Human Reviewer/i,
  /before this script goes anywhere near a learner/i,
  /DRAFT FOR HUMAN REVIEW/i,
  /NOT SHIPPABLE/i,
];

/** True when the script says, in its own words, that it still needs a human. */
export function hasNarrationBlocker(text: string): boolean {
  return NARRATION_BLOCKER_MARKERS.some((re) => re.test(text));
}
