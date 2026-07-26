// Course enrollment — who is actually ON the course, who put them there, and where they
// have got to. Deliberately separate from `course_progress`, which stays the single source
// of truth for "has this learner finished module X". Enrollment answers a different
// question: is this person a learner at all, under which mentor, in which cohort.
//
// Before this existed the mentor dashboard inferred a cohort from "anyone with a student or
// farmer role in my org", which is why the empty state read "Learners will appear here once
// they enrol" while nothing in the app could enrol anybody.
//
// EVERYTHING HERE IS PURE. No firebase import, no `window`, no clock reads except the `now`
// you pass in. Firestore reads/writes live in lib/db/queries.ts with every other collection,
// so the data-access layer stays in one place (see the header comment there).

import type { CourseProgress } from '@/lib/db/types';

/** The one curriculum shipped today (lib/course-modules.ts). Kept as a field so a second
 *  track — an AI-literacy track, say — is a data change, not a schema migration. */
export const DEFAULT_TRACK = 'permaculture-core';

export type EnrollmentStatus =
  | 'invited'   // mentor has enrolled them; learner has not opened a module yet
  | 'active'    // at least one module touched, course not finished
  | 'paused'    // temporarily off the course (illness, season, funding gap)
  | 'completed' // every module in the track signed off
  | 'withdrawn'; // left the programme

export interface CourseEnrollment {
  id: string;
  profile_id: string;
  track: string;
  /** Free-text cohort label, e.g. "Ubhejane 2026". Null = ungrouped. */
  cohort: string | null;
  status: EnrollmentStatus;
  /** uid of the mentor or staff member who enrolled them. */
  enrolled_by: string;
  org_id: string | null;
  /** ISO timestamp. */
  enrolled_at: string;
  updated_at?: unknown;
}

/** Deterministic doc id so enrolling twice is an upsert, not a duplicate row. */
export function enrollmentDocId(profileId: string, track: string = DEFAULT_TRACK): string {
  return `${profileId}_${track}`;
}

/** A learner counts as "on the course" for cohort stats when invited, active or completed.
 *  Paused and withdrawn learners are kept (their history matters) but excluded from
 *  "how is the cohort doing right now" arithmetic. */
export function isEnrolled(status: EnrollmentStatus): boolean {
  return status === 'invited' || status === 'active' || status === 'completed';
}

/** Statuses a mentor may set by hand. `invited`, `active` and `completed` are DERIVED from
 *  progress (see effectiveStatus) — offering them as buttons would let the stored value
 *  drift away from what the learner has actually done. */
export const MENTOR_SETTABLE_STATUSES: EnrollmentStatus[] = ['paused', 'withdrawn'];

export const STATUS_LABEL: Record<EnrollmentStatus, string> = {
  invited: 'Not started',
  active: 'In progress',
  paused: 'Paused',
  completed: 'Complete',
  withdrawn: 'Withdrawn',
};

/** Sort order for a mentor's list: the people who need attention first. */
export const STATUS_SORT: Record<EnrollmentStatus, number> = {
  active: 0,
  invited: 1,
  paused: 2,
  completed: 3,
  withdrawn: 4,
};

export function newEnrollment(input: {
  profile_id: string;
  enrolled_by: string;
  org_id?: string | null;
  cohort?: string | null;
  track?: string;
  enrolled_at: string;
}): CourseEnrollment {
  const track = input.track ?? DEFAULT_TRACK;
  return {
    id: enrollmentDocId(input.profile_id, track),
    profile_id: input.profile_id,
    track,
    cohort: input.cohort ?? null,
    status: 'invited',
    enrolled_by: input.enrolled_by,
    org_id: input.org_id ?? null,
    enrolled_at: input.enrolled_at,
  };
}

/** Module ids this learner has signed off. Rows with done:false are ignored — un-ticking a
 *  module must actually reduce the count, not leave a stale completion behind. */
export function completedModuleIds(progress: CourseProgress[]): Set<string> {
  return new Set(progress.filter((p) => p.done).map((p) => p.module));
}

export interface EnrollmentProgress {
  done: number;
  total: number;
  /** 0–100, rounded. 0 when the track has no modules (never divides by zero). */
  pct: number;
  complete: boolean;
  /** Curriculum-order id of the next unfinished module, or null when finished. */
  nextModuleId: string | null;
}

/** `moduleIds` must be in curriculum order — it decides what "next" means. */
export function enrollmentProgress(progress: CourseProgress[], moduleIds: string[]): EnrollmentProgress {
  const doneIds = completedModuleIds(progress);
  // Count against the curriculum, not against the rows: a stale course_progress row for a
  // module that has since been removed from the syllabus must not inflate the total.
  const done = moduleIds.filter((id) => doneIds.has(id)).length;
  const total = moduleIds.length;
  return {
    done,
    total,
    pct: total === 0 ? 0 : Math.round((done / total) * 100),
    complete: total > 0 && done === total,
    nextModuleId: moduleIds.find((id) => !doneIds.has(id)) ?? null,
  };
}

/**
 * What the UI should show, as opposed to what is stored.
 *
 * A mentor's manual `paused`/`withdrawn` always wins — those are human decisions and
 * progress must not silently overrule them. Otherwise the status follows the work:
 * everything done => completed, anything done => active, nothing done => invited.
 */
export function effectiveStatus(
  enrollment: Pick<CourseEnrollment, 'status'>,
  progress: CourseProgress[],
  moduleIds: string[],
): EnrollmentStatus {
  if (enrollment.status === 'paused' || enrollment.status === 'withdrawn') return enrollment.status;
  const { done, complete } = enrollmentProgress(progress, moduleIds);
  if (complete) return 'completed';
  return done > 0 ? 'active' : 'invited';
}

export interface CohortSummary {
  enrolled: number;
  notStarted: number;
  inProgress: number;
  completed: number;
  paused: number;
  withdrawn: number;
}

/** Roll-up for the mentor/NGO dashboards. `progressBy` is keyed by profile_id; a learner
 *  with no rows yet is simply "not started" rather than an error. */
export function summariseCohort(
  enrollments: CourseEnrollment[],
  progressBy: Record<string, CourseProgress[]>,
  moduleIds: string[],
): CohortSummary {
  const out: CohortSummary = {
    enrolled: 0, notStarted: 0, inProgress: 0, completed: 0, paused: 0, withdrawn: 0,
  };
  for (const e of enrollments) {
    const status = effectiveStatus(e, progressBy[e.profile_id] ?? [], moduleIds);
    if (isEnrolled(status)) out.enrolled += 1;
    if (status === 'invited') out.notStarted += 1;
    else if (status === 'active') out.inProgress += 1;
    else if (status === 'completed') out.completed += 1;
    else if (status === 'paused') out.paused += 1;
    else if (status === 'withdrawn') out.withdrawn += 1;
  }
  return out;
}
