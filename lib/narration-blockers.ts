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

/** Explicit owner release exception; pending is not a translation sign-off. */
export const NARRATION_RELEASE_EXCEPTIONS: Readonly<Record<string, {
  reviewStatus: 'pending'; authorizedBy: string; authorizedOn: string; reviewRecord: string; scriptSha256: string;
}>> = {
  'plant-guilds.zu': {
    reviewStatus: 'pending', authorizedBy: 'Rory Clark', authorizedOn: '2026-09-09',
    reviewRecord: 'docs/narration-reviews/plant-guilds.zu.md',
    scriptSha256: '63224cd110b99ac475963e8e78d2b08e18f27f5825db6b1e5d2d476502854baa',
  },
  'market-community.zu': {
    reviewStatus: 'pending', authorizedBy: 'Rory Clark', authorizedOn: '2026-09-24',
    reviewRecord: 'docs/narration-reviews/MARKET-COMMUNITY-ZU-AUDIO-HOLD-2026-09-24.md',
    scriptSha256: '31c0990885544d52893fc113cff84f9a11c8d37d79153ab1b83b1e50a67c60ca',
  },
  'intro-permaculture.zu': {
    reviewStatus: 'pending', authorizedBy: 'Rory Clark', authorizedOn: '2026-09-24',
    reviewRecord: 'docs/narration-reviews/INTRO-PERMACULTURE-AUDIO-HOLD-2026-09-24.md',
    scriptSha256: 'faf469fe46668140369f1054f9ef52558b1af94e4d09d7f10641735948ed4667',
  },
  'reading-landscape.zu': {
    reviewStatus: 'pending', authorizedBy: 'Rory Clark', authorizedOn: '2026-09-24',
    reviewRecord: 'docs/narration-reviews/reading-landscape.zu-audio-2026-09-24.md',
    scriptSha256: 'a22e0b20fa037fe3ff7be065cc9423868fe1e74aca542fa4b881295bc6c8e26b',
  },
  'soil-health.zu': {
    reviewStatus: 'pending', authorizedBy: 'Rory Clark', authorizedOn: '2026-09-24',
    reviewRecord: 'docs/narration-reviews/soil-health.zu.review.md',
    scriptSha256: 'edcd21bc1b0cf8c043dbbfcaf76e0d3d4215272a09e45ee4009a542c2d9d6d51',
  },
  'food-forest.zu': {
    reviewStatus: 'pending', authorizedBy: 'Rory Clark', authorizedOn: '2026-09-24',
    reviewRecord: 'docs/narration-reviews/food-forest.zu-audio-2026-09-24.md',
    scriptSha256: '6390548164490a05f96553201ce048eddbb84fb349746371268bb36271ab697e',
  },
  'vegetables-staples.zu': {
    reviewStatus: 'pending', authorizedBy: 'Rory Clark', authorizedOn: '2026-09-24',
    reviewRecord: 'docs/narration-reviews/vegetables-staples.zu-audio-2026-09-24.md',
    scriptSha256: '9a617e6eb54544534c216268cd8db402cd311f12e8436f97a3d4a4ed5ad5566d',
  },
};

export function narrationReviewPending(moduleId: string, lang: string): boolean {
  return NARRATION_RELEASE_EXCEPTIONS[`${moduleId}.${lang}`]?.reviewStatus === 'pending';
}

/** True when the script says, in its own words, that it still needs a human. */
export function hasNarrationBlocker(text: string): boolean {
  return NARRATION_BLOCKER_MARKERS.some((re) => re.test(text));
}
