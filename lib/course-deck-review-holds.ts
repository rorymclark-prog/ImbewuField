/**
 * IsiZulu deck rows with independently documented source-meaning risks.
 * These are playback/display holds, not verdicts about every unlisted sentence.
 * Reasons describe the specific source condition or distinction that needs review.
 */
const ISIZULU_DECK_REVIEW_HOLDS: Readonly<Record<string, Readonly<Record<number, string>>>> = Object.freeze({
  'intro-permaculture': Object.freeze({
    22: 'The narration omits the source superlative “worst” in “worst wind” and asks where an item can be placed instead of where it should move; retain both exact English clauses until checked equivalents preserve those meanings.',
  }),
  'reading-landscape': Object.freeze({
    5: 'The slide heading changes slower water flow into water decreasing; retain “slows” until the flow-speed comparison is preserved.',
    15: 'The narration says cool, damp weather may favour disease, but the ZU wording says it may allow disease to spread; retain the conditional favouring clause.',
    16: 'The target may narrow “your whole smallholding” to a piece or plot of land; retain “smallholding” until the property scope is clear.',
  }),
  'soil-health': Object.freeze({
    1: 'The source specifies making safe compost, while the target says only making compost; retain the safety qualifier so the overview does not imply every compost process is safe.',
    13: 'The source names wattle seed pods, while the target generalizes this to seed pods; retain the crop name until the scope matches.',
  }),
  'water-harvesting': Object.freeze({
    10: 'The source says changing a watercourse, while the target says river, which may exclude smaller streams or channels; retain “watercourse” and the authorization condition.',
  }),
  'vegetables-staples': Object.freeze({
    16: 'The source requires starting with the lightest intervention that works; the target preserves suitability but loses the least-intensive effective-action threshold.',
    18: 'The source asks for “Pest pressure”; the target says an increase in pests, adding a direction of change instead of recording pest pressure.',
  }),
  'market-community': Object.freeze({
    14: 'The narration omits the source condition that each household contributes what it can; keep the per-household capacity qualifier visible.',
  }),
  'plant-guilds': Object.freeze({
    22: 'The target leaves the area around the trunk unplanted but does not clearly preserve an open establishment basin as a water-management feature.',
    28: 'The closing prompt asks which plant needs a cut and how much; the target omits the amount or intensity decision.',
    40: 'The target may describe an ordinary mulch basin as a watering container; retain the basin term until the around-plant practice is clear.',
  }),
  'seeds-sovereignty': Object.freeze({
    6: 'The target uses a seed list where the source means the local seed collection or saved seed resource carried into the next season.',
    11: 'The target says boiling where the source says brief fermentation; this changes the seed-processing method.',
    12: 'The target renders green flexible plant material as green flesh; retain the comparison clause until the material is identified correctly.',
    14: 'The jar warning says boiling where the source says active fermentation; retain the exact warning and its open-cover, timing, rinse, and discard conditions.',
    15: 'The recap repeats the boiling-versus-brief-fermentation error; retain the fermentation step until checked wording preserves the process.',
    20: 'The source clauses “sow more heavily” and “day when you will count” have uncertain action and timing readings; retain these exact clauses with the 10-seed and percentage figures.',
    24: 'The target uses a seed list where the source means the seed collection or resource carried into the next season.',
  }),
  'small-livestock': Object.freeze({
    2: 'The target says ducks do not scratch like chickens rather than scratching less, losing the comparison; it also needs to retain that ducks can still damage plants.',
    3: 'The source describes how livestock move nutrients around a farm; the target replaces that concrete process with the broader idea of closing nutrient cycles.',
    8: 'The title omits rotation of the chicken tractor across the plot, which is the source practice rather than merely moving a coop to a place.',
    11: 'The target changes “not a guide for moving bees” into a statement about movement boundaries and adds local-beekeeper advice; retain the exact source warning and current-rules condition.',
  }),
});

/** Return the source-backed reason a ZU slide is withheld, or null when unflagged. */
export function isiZuluDeckReviewHold(moduleId: string, slide: number): string | null {
  return ISIZULU_DECK_REVIEW_HOLDS[moduleId]?.[slide] ?? null;
}

/** Read-only enumeration for regression checks and future review updates. */
export function isiZuluDeckReviewHoldEntries(): readonly {
  readonly moduleId: string;
  readonly slide: number;
  readonly reason: string;
}[] {
  return Object.freeze(Object.entries(ISIZULU_DECK_REVIEW_HOLDS).flatMap(([moduleId, slides]) =>
    Object.entries(slides).map(([slide, reason]) => Object.freeze({ moduleId, slide: Number(slide), reason })),
  ));
}
