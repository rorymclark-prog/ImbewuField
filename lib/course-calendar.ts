// The course promises nine months. This file measures what the course actually holds against
// that promise, week by week.
//
// IT IS A MEASURING TOOL, NOT A CONTENT-AUTHORING ONE. It invents no lesson, no assignment and
// no agronomy. Everything below is derived from content already authored in
// lib/course-modules.ts and lib/course-assignment-content.ts — the latter of which says plainly
// that its figures are Rory's and must not be regenerated. Where this file needs to quote the
// course back to a reader, it READS the authored string at runtime rather than copying it, so a
// quote here can never drift out of step with the sentence a farmer is actually shown.
//
// WHY IT EXISTS: "nine months" appears in design/DESIGN.md, lib/db/types.ts and the demo task
// list ("Attend the 9-month permaculture training"), but nothing in the app has ever known what
// week a learner is in, or what month of the year it is when they get there. A course whose
// assignments wait on rain, on frost and on a harvest cannot be a bare ordered list.

import { MODULE_ASSIGNMENTS, CAPSTONE, type ModuleAssignment } from './course-assignment-content';
import { COURSE_MODULES } from './course-modules';

/**
 * The promised span in weeks. Nine months is the figure the app states in three places; 36 weeks
 * is the round working number for it. Kept as a named constant so the gap this file reports is
 * measured against ONE number rather than each caller's idea of nine months.
 */
export const COURSE_WEEKS = 36;

/** Days a learner is given to read and absorb one module before its field work starts. One week
 *  per module — the modules hold 20–35 minutes of reading each, so this is elapsed time for it to
 *  land, not time spent reading. */
export const READING_WEEKS_PER_MODULE = 1;

export type WeekState =
  /** The learner is reading a module for the first time. */
  | 'reading'
  /** The module is read; its field assignment is underway and the real world is doing its part. */
  | 'field-work'
  /** Nothing in the course is scheduled for this week at all. */
  | 'empty';

export interface CourseWeek {
  /** 1-based week of the course. */
  week: number;
  /** Module (or 'capstone') this week belongs to, or null when the week is empty. */
  moduleId: string | null;
  state: WeekState;
}

/** Whole weeks a day count occupies — 10 days of field work blocks out two weeks, not 1.43. */
function weeksFor(days: number): number {
  return Math.ceil(days / 7);
}

/** The capstone has no lessons of its own — it is completed in the Design Studio — so it gets no
 *  reading week, only its field weeks. */
function readingWeeksFor(a: ModuleAssignment): number {
  return a.moduleId === CAPSTONE.moduleId ? 0 : READING_WEEKS_PER_MODULE;
}

/**
 * Lay the authored course out across the promised span, at the fastest pace the course itself
 * declares: each module read, then its assignment's own minGateDays of real work, then the next.
 * Any week the course does not reach comes back as 'empty' — that is the number this exists for.
 */
export function layOutCourse(totalWeeks: number = COURSE_WEEKS): CourseWeek[] {
  const weeks: CourseWeek[] = [];
  const push = (moduleId: string, state: WeekState, count: number) => {
    for (let i = 0; i < count; i++) {
      if (weeks.length >= totalWeeks) return;
      weeks.push({ week: weeks.length + 1, moduleId, state });
    }
  };

  for (const a of [...MODULE_ASSIGNMENTS, CAPSTONE]) {
    push(a.moduleId, 'reading', readingWeeksFor(a));
    push(a.moduleId, 'field-work', weeksFor(a.minGateDays));
  }

  while (weeks.length < totalWeeks) {
    weeks.push({ week: weeks.length + 1, moduleId: null, state: 'empty' });
  }
  return weeks;
}

export interface CourseCoverage {
  totalWeeks: number;
  /** Weeks the authored course reaches. */
  scheduledWeeks: number;
  /** Weeks with nothing scheduled at all. */
  emptyWeeks: number;
  /** Minutes of lesson content in the whole course. */
  readingMinutes: number;
  /** The course's own fastest-pace figure, in days. */
  minimumDays: number;
  /** Modules that ran past the promised span and were never placed. */
  unplacedModules: string[];
}

export function courseCoverage(totalWeeks: number = COURSE_WEEKS): CourseCoverage {
  const weeks = layOutCourse(totalWeeks);
  const placed = new Set(weeks.map((w) => w.moduleId).filter((id): id is string => id !== null));
  const all = [...MODULE_ASSIGNMENTS, CAPSTONE].map((a) => a.moduleId);

  return {
    totalWeeks,
    scheduledWeeks: weeks.filter((w) => w.state !== 'empty').length,
    emptyWeeks: weeks.filter((w) => w.state === 'empty').length,
    readingMinutes: COURSE_MODULES.reduce((sum, m) => sum + m.durationMins, 0),
    minimumDays: [...MODULE_ASSIGNMENTS, CAPSTONE].reduce((s, a) => s + a.minGateDays, 0),
    unplacedModules: all.filter((id) => !placed.has(id)),
  };
}

// ─── What the course itself says it needs from the weather and the season ────────────────────
//
// Each entry POINTS AT an authored sentence rather than repeating it. `quote()` reads the live
// string, so if Rory rewrites a self-check item the condition either follows it or the test that
// guards this table fails — there is no third outcome where the two quietly disagree.

export type SeasonalNeed =
  /** Cannot be done until rain actually falls. */
  | 'rain'
  /** Needs a planting window — soil warm enough, season right for the crop. */
  | 'planting-window'
  /** Needs a crop already in the ground with a season ahead of it. Weaker than 'harvest': you can
   *  name the plant you will save seed from long before there is seed to save. */
  | 'growing-crop'
  /** Needs something already grown to be ready to pick. Nothing substitutes for this one — a
   *  farmer either has produce in their hands that week or they cannot do the assignment. */
  | 'harvest';

export interface SeasonalCondition {
  moduleId: string;
  needs: SeasonalNeed;
  /** Which authored field carries the requirement. */
  source: 'prompt' | 'selfCheck';
  /** Index into selfCheckItems; ignored when source is 'prompt'. */
  index?: number;
}

/**
 * Every place the authored assignments make the real world a precondition. This is not a
 * judgement about South African seasons — each row exists because the farmer-facing text on that
 * row says so in its own words.
 */
export const SEASONAL_CONDITIONS: SeasonalCondition[] = [
  // "I walked my land during or just after rain to see the water"
  { moduleId: 'reading-landscape', needs: 'rain', source: 'selfCheck', index: 3 },
  // "Prepare and plant one bed…"
  { moduleId: 'vegetables-staples', needs: 'planting-window', source: 'prompt' },
  // "…say which plant you will save seed from this season." A choice, not a picking — so this is
  // 'growing-crop', not 'harvest'. Calling it a harvest would make the ordering check fire on an
  // assignment a farmer can genuinely do the week after planting, and one loud false positive is
  // enough to make every true one look like noise.
  { moduleId: 'seeds-sovereignty', needs: 'growing-crop', source: 'prompt' },
  // "Write down what you harvested this week and where it went"
  { moduleId: 'market-community', needs: 'harvest', source: 'prompt' },
];

/** The authored sentence a condition rests on, read live from the assignment content. Returns
 *  null when the row no longer points at anything — which is a failure, not an empty state. */
export function conditionQuote(c: SeasonalCondition): string | null {
  const a = [...MODULE_ASSIGNMENTS, CAPSTONE].find((x) => x.moduleId === c.moduleId);
  if (!a) return null;
  if (c.source === 'prompt') return a.prompt;
  const item = a.selfCheckItems[c.index ?? -1];
  return item ?? null;
}

// ─── The ordering check ──────────────────────────────────────────────────────────────────────

export interface HarvestGap {
  /** Module whose assignment needs something picked. */
  moduleId: string;
  /** Module that instructs the only planting the course asks for. */
  plantingModuleId: string;
  /** Days between finishing the planting module and reaching this assignment, at the course's
   *  own fastest pace. */
  daysSincePlanting: number;
}

/** The module whose assignment is the course's one instruction to put seed in the ground. */
const PLANTING_MODULE = 'vegetables-staples';

/**
 * A module that asks for a harvest cannot come so soon after the module that asks for the
 * planting that nothing could be ready. Run at the pace the course states, this reports the real
 * interval, so the question "is that enough time?" is answered with a number rather than a
 * feeling.
 */
export function harvestGaps(): HarvestGap[] {
  const order = [...MODULE_ASSIGNMENTS, CAPSTONE];
  const plantingIdx = order.findIndex((a) => a.moduleId === PLANTING_MODULE);
  if (plantingIdx < 0) return [];

  const dayAfter = (idx: number) =>
    order.slice(0, idx + 1).reduce((s, a) => s + a.minGateDays, 0);
  const plantedOn = dayAfter(plantingIdx);

  const out: HarvestGap[] = [];
  for (const c of SEASONAL_CONDITIONS) {
    if (c.needs !== 'harvest') continue;
    const idx = order.findIndex((a) => a.moduleId === c.moduleId);
    if (idx <= plantingIdx) continue;
    out.push({
      moduleId: c.moduleId,
      plantingModuleId: PLANTING_MODULE,
      daysSincePlanting: dayAfter(idx) - plantedOn,
    });
  }
  return out;
}
