// What actually belongs in a STAPLE PLOT — the field-scale rotation units a
// farmer traces on the design map (ZoneShape feature 'staple_garden' →
// PlanBed kind 'plot').
//
// Why this file exists (2026-08-04, owner report): the auto-suggest engine
// picked plot crops by FOOD GROUP, and a food group is not a staple test.
// 'root_tuber' holds sweet potato AND carrots; 'fruiting_veg' holds pumpkin
// AND watermelon; 'legume' holds dry beans AND lettuce-bed peas. So four
// plots reliably came out as carrots / chard / watermelon / cabbage — the
// owner's words: "the staple crop section allocated everything but staple
// crops". Group ranking can never fix that, because the distinction it needs
// to make is BELOW the group. It has to be named crop by crop, so it is.
//
// The line drawn here: a staple is what a household grows at field scale for
// bulk energy or protein and then STORES to eat through the year — not what
// it eats fresh from the veg beds. Every crop below is a recognised South
// African smallholder field crop and every one has real storage life in this
// catalog's own storageMonths data (maize 10, dry beans 12, groundnuts 6,
// pumpkin/butternut 4, sweet potato 3, potato 3, amadumbe 2). Salad and
// relish crops — carrots, cabbage, chard, onions, tomatoes, watermelon —
// stay in the veg beds where they belong, however well they happen to score.

import type { CropDef } from './crop-catalog';

/**
 * The four courses of a staple rotation. Deliberately NOT the same axis as
 * FoodGroup: this is about the ROLE a crop plays in a field rotation
 * (bulk energy / soil nitrogen / underground bulk / ground-covering vine),
 * which is what makes a four-plot rotation agronomically sound.
 */
export type StapleCourse = 'grain' | 'pulse' | 'tuber' | 'cucurbit';

export const STAPLE_COURSE_META: Record<StapleCourse, { label: string; why: string }> = {
  grain: {
    label: 'Grain',
    why: 'The bulk energy crop and the biggest eater in the rotation — best grown on ground a legume has just fed.',
  },
  pulse: {
    label: 'Beans & groundnuts',
    why: 'Pulls nitrogen out of the air into the soil, and dries down into the protein you store for the year.',
  },
  tuber: {
    label: 'Roots & tubers',
    why: 'Works the soil at a different depth and breaks the disease cycle of the crops above it.',
  },
  cucurbit: {
    label: 'Pumpkins & squash',
    why: 'Sprawls across the ground, smothering weeds and shading the soil — the traditional partner course to maize.',
  },
};

/**
 * Staple crops by catalog key, in course order. Keys must exist in
 * lib/crop-catalog.ts — guarded by tests/staple-crops.test.ts so a catalog
 * rename can never silently empty a course.
 */
export const STAPLE_CROPS_BY_COURSE: Record<StapleCourse, string[]> = {
  // Mielies — the staple this whole category is named after.
  grain: ['maize'],
  // Both dry down and store as the household's protein. Green beans are
  // deliberately absent: they're a fresh relish crop picked young, not a
  // stored pulse, and putting them here is exactly the confusion this fixes.
  pulse: ['dry-beans', 'groundnuts'],
  // Amadumbe first by intent, not by yield — it is the traditional KZN
  // staple and the crop most likely to already be growing on a farm here.
  tuber: ['amadumbe', 'sweet-potato', 'potato'],
  // The classic maize companion. Watermelon is NOT here: it stores barely a
  // month, is grown as a treat rather than a food store, and its habit of
  // scoring well on space-hungry-vine rules is precisely how it kept
  // claiming a whole staple plot.
  cucurbit: ['pumpkin', 'butternut'],
};

const COURSE_BY_KEY: Record<string, StapleCourse> = Object.entries(STAPLE_CROPS_BY_COURSE)
  .reduce((acc, [course, keys]) => {
    for (const key of keys) acc[key] = course as StapleCourse;
    return acc;
  }, {} as Record<string, StapleCourse>);

export const STAPLE_CROP_KEYS: string[] = Object.keys(COURSE_BY_KEY);

/** The rotation order a plot moves through across seasons. Grain follows the pulse that fed it; the vine course closes the cycle before the ground goes back to legumes. */
export const STAPLE_COURSE_SEQUENCE: StapleCourse[] = ['pulse', 'grain', 'tuber', 'cucurbit'];

export function isStapleCrop(crop: CropDef): boolean {
  return COURSE_BY_KEY[crop.key] !== undefined;
}

export function stapleCourseOf(crop: CropDef): StapleCourse | undefined {
  return COURSE_BY_KEY[crop.key];
}

/** The course a plot should move to next season, given what it grew last. */
export function nextStapleCourse(course: StapleCourse): StapleCourse {
  const idx = STAPLE_COURSE_SEQUENCE.indexOf(course);
  return STAPLE_COURSE_SEQUENCE[(idx + 1) % STAPLE_COURSE_SEQUENCE.length];
}

/**
 * Winter cover for a plot, and the honest answer to "why is my staple plot
 * empty from May to August?".
 *
 * Every staple in this catalog is a summer crop under a summer-rainfall
 * pattern — maize, beans, groundnuts, sweet potato, pumpkin and butternut
 * all sow Sep-Dec and come off between February and April. That is not a
 * gap in the plan, it IS how field cropping works here. So the winter answer
 * for a plot must never be "squeeze a cabbage in": it's either bare fallow
 * under the last crop's residue, or a legume cover crop that feeds the soil
 * before the grain course returns.
 *
 * Broad beans are the catalog's one genuine overwintering legume (its own
 * note: "sow in autumn, it stands through frost and pods in spring"), so
 * they're the cover crop offered — and unlike a true green manure they also
 * feed the household, which is the right trade-off for a smallholder who
 * cannot afford to grow something purely to dig it back in.
 */
export const PLOT_WINTER_COVER_KEYS: string[] = ['broad-beans'];

export function isPlotWinterCover(crop: CropDef): boolean {
  return PLOT_WINTER_COVER_KEYS.includes(crop.key);
}

/**
 * Everything a plot may ever be planted with, by ANY pass of the engine.
 * The single choke point: passes that fill gaps, bridge winter or chase
 * sowing cadence all route their candidate pool through here, so no future
 * pass can quietly put a lettuce on a staple plot again.
 */
export function plotPool(crops: readonly CropDef[]): CropDef[] {
  return crops.filter((c) => isStapleCrop(c) || isPlotWinterCover(c));
}
