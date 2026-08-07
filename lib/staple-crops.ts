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
// This is an operational field-layout list, not a claim about what a particular
// household eats or stores. It prevents small-bed crops from being selected for
// a farmer-mapped field plot and prevents a field crop from being fragmented
// across that plot. The farmer's exact crop choices remain the authority; this
// module is only the physical eligibility boundary after that choice.

import type { CropDef } from './crop-catalog';
import { hasVerifiedFieldPlan } from './crop-catalog';

/**
 * The four courses of a staple rotation. Deliberately NOT the same axis as
 * FoodGroup: this is about the ROLE a crop plays in a field rotation
 * (cereal / dry pulse / underground crop / sprawling squash). The labels help
 * distribute unlike field crops across four mapped plots; they do not prove a
 * universal rotation sequence, nutrient transfer or multi-year outcome.
 */
export type StapleCourse = 'grain' | 'pulse' | 'tuber' | 'cucurbit';

export const STAPLE_COURSE_META: Record<StapleCourse, { label: string; why: string }> = {
  grain: {
    label: 'Grain',
    why: 'A field-scale cereal course; confirm fertility and the prior crop from field records.',
  },
  pulse: {
    label: 'Beans & groundnuts',
    why: 'A field-scale dry-pulse or groundnut course; nitrogen benefit depends on crop, nodulation and residue management.',
  },
  tuber: {
    label: 'Roots & tubers',
    why: 'A field-scale underground-food course; rotation benefit depends on the actual crop and recorded history.',
  },
  cucurbit: {
    label: 'Pumpkins & squash',
    why: 'A field-scale sprawling squash course; mapped area does not prove weed control or a companion layout.',
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
  // Green beans are deliberately absent: they are managed as a fresh-picked
  // vegetable in this catalog rather than as a dry field pulse.
  pulse: ['dry-beans', 'groundnuts'],
  // Order is a deterministic tie-break only, never an inference that a
  // household wants amadumbe or any other crop.
  tuber: ['amadumbe', 'sweet-potato', 'potato'],
  // Watermelon is deliberately absent because this catalog treats it as a
  // fresh fruiting crop, while this course is the field-scale pumpkin/squash
  // layout class. This is not a judgement about household preference.
  cucurbit: ['pumpkin', 'butternut'],
};

const COURSE_BY_KEY: Record<string, StapleCourse> = Object.entries(STAPLE_CROPS_BY_COURSE)
  .reduce((acc, [course, keys]) => {
    for (const key of keys) acc[key] = course as StapleCourse;
    return acc;
  }, {} as Record<string, StapleCourse>);

export const STAPLE_CROP_KEYS: string[] = Object.keys(COURSE_BY_KEY);

/** Deterministic order used to diversify unlike courses across plots in one
 * proposal. It is not a prescribed next-season sequence. */
export const STAPLE_COURSE_SEQUENCE: StapleCourse[] = ['pulse', 'grain', 'tuber', 'cucurbit'];

export function isStapleCrop(crop: CropDef): boolean {
  return COURSE_BY_KEY[crop.key] !== undefined;
}

export function stapleCourseOf(crop: CropDef): StapleCourse | undefined {
  return COURSE_BY_KEY[crop.key];
}

/** Legacy helper retained for callers that need the deterministic display
 * cycle. It must not be presented as an agronomic next-season prescription. */
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
 * gap in the plan. So the winter answer for a field plot must never be an
 * unrelated small-bed crop selected merely to fill the chart. It may be an
 * honestly displayed rest period or a verified in-window field crop.
 *
 * Broad beans are the catalog's verified overwintering field pulse, so they
 * are the only automatic winter candidate here. They are scheduled as a food
 * crop, not credited with a quantified soil benefit.
 *
 * A prior fallback used oats to avoid leaving a post-legume plot bare. The
 * 2026-08-06 source audit could verify oats as a cover-crop species, but could
 * not verify the exact 6cm / 100-day smallholder schedule the app generated.
 * Filling that gap with invented precision is worse than showing an honest
 * rest period. Oats therefore stays in the catalog for legacy records but is
 * excluded here until a relevant primary authority supplies the schedule.
 */
export const PLOT_WINTER_COVER_KEYS: string[] = ['broad-beans'];

export function isPlotWinterCover(crop: CropDef): boolean {
  return PLOT_WINTER_COVER_KEYS.includes(crop.key);
}

/**
 * The declared, source-backed covers in preference order. A future cover must
 * have verified field establishment and duration before it is added here.
 */
export function plotWinterCovers(crops: readonly CropDef[]): CropDef[] {
  return PLOT_WINTER_COVER_KEYS
    .map((k) => crops.find((c) => c.key === k))
    .filter((c): c is CropDef => c !== undefined && hasVerifiedFieldPlan(c));
}

/**
 * Everything a plot may ever be planted with, by ANY pass of the engine.
 * The single choke point: passes that fill gaps, bridge winter or chase
 * sowing cadence all route their candidate pool through here, so no future
 * pass can quietly put a lettuce on a staple plot again.
 */
export function plotPool(crops: readonly CropDef[]): CropDef[] {
  return crops.filter((c) => hasVerifiedFieldPlan(c)
    && (isStapleCrop(c) || isPlotWinterCover(c)));
}
