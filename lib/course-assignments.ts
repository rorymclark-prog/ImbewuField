// Course assignments — a mentor pointing a specific learner at specific modules, with an
// optional due date and a note. This is the piece that turns the Learning Portal from a
// self-serve module list into something a mentor can actually run a cohort against.
//
// IMPORTANT: an assignment never records completion. Whether a module is finished is read
// from `course_progress` (the learner's own tick), exactly as before. Duplicating that here
// would give us two truths that drift apart the first time a learner un-ticks something.
// An assignment only says "you, this module, by this date".
//
// PURE MODULE — no firebase, no `window`, and no hidden clock: every date-aware function
// takes `today` as a 'YYYY-MM-DD' string. Firestore access lives in lib/db/queries.ts.

/** Days before the due date at which an open assignment starts reading as "due soon". */
export const DUE_SOON_DAYS = 7;

export interface CourseAssignment {
  id: string;
  profile_id: string;
  /** Module id from lib/course-modules.ts. */
  module: string;
  /** uid of the mentor or staff member who set it. */
  assigned_by: string;
  org_id: string | null;
  /** 'YYYY-MM-DD', or null for "no deadline, just do it". */
  due_at: string | null;
  note: string | null;
  /** ISO timestamp. */
  assigned_at: string;
  updated_at?: unknown;
}

/** One live assignment per learner per module — deterministic id makes re-assigning an
 *  update (new due date) rather than a second row the learner has to reconcile. */
export function assignmentDocId(profileId: string, module: string): string {
  return `${profileId}_${module}`;
}

export type AssignmentState = 'done' | 'overdue' | 'due-soon' | 'open';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Local-calendar 'YYYY-MM-DD' for a Date. Local, not UTC: a learner in SAST who opens the
 *  app at 01:00 must see today's date, not yesterday's. */
export function toDateKey(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Whole days from `from` to `to` (negative = `to` is in the past). Both 'YYYY-MM-DD'.
 *  Uses Date.UTC so DST transitions can never turn a day into 23 or 25 hours and round
 *  a deadline to the wrong side of zero. Returns null on a malformed date. */
export function daysBetween(from: string, to: string): number | null {
  if (!DATE_RE.test(from) || !DATE_RE.test(to)) return null;
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  const a = Date.UTC(fy, fm - 1, fd);
  const b = Date.UTC(ty, tm - 1, td);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((b - a) / 86_400_000);
}

/**
 * Where an assignment stands. `doneIds` is the set of module ids the learner has ticked
 * (from completedModuleIds in lib/course-enrollment.ts).
 *
 * Done wins over overdue: a module finished a week late is finished, and nagging about it
 * is how a learner stops trusting the list. An assignment with no due date is never overdue.
 */
export function assignmentState(
  assignment: Pick<CourseAssignment, 'module' | 'due_at'>,
  doneIds: Set<string>,
  today: string,
): AssignmentState {
  if (doneIds.has(assignment.module)) return 'done';
  if (!assignment.due_at) return 'open';
  const days = daysBetween(today, assignment.due_at);
  if (days === null) return 'open';
  if (days < 0) return 'overdue';
  if (days <= DUE_SOON_DAYS) return 'due-soon';
  return 'open';
}

/** Plain-language deadline for the learner. Null when there is no due date. */
export function formatDue(due_at: string | null, today: string): string | null {
  if (!due_at) return null;
  const days = daysBetween(today, due_at);
  if (days === null) return null;
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  if (days === -1) return '1 day overdue';
  if (days < 0) return `${Math.abs(days)} days overdue`;
  if (days <= DUE_SOON_DAYS) return `Due in ${days} days`;
  const [y, m, d] = due_at.split('-').map(Number);
  const month = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m - 1] ?? '';
  return `Due ${d} ${month}${y === new Date().getFullYear() ? '' : ` ${y}`}`;
}

const STATE_SORT: Record<AssignmentState, number> = {
  overdue: 0,
  'due-soon': 1,
  open: 2,
  done: 3,
};

/** Most urgent first; finished work sinks to the bottom. Ties break on due date (soonest
 *  first, undated last) and then module id so the order is stable across renders. */
export function sortAssignments(
  assignments: CourseAssignment[],
  doneIds: Set<string>,
  today: string,
): CourseAssignment[] {
  return [...assignments].sort((a, b) => {
    const sa = STATE_SORT[assignmentState(a, doneIds, today)];
    const sb = STATE_SORT[assignmentState(b, doneIds, today)];
    if (sa !== sb) return sa - sb;
    if (a.due_at !== b.due_at) {
      if (!a.due_at) return 1;
      if (!b.due_at) return -1;
      return a.due_at < b.due_at ? -1 : 1;
    }
    return a.module < b.module ? -1 : a.module > b.module ? 1 : 0;
  });
}

export interface AssignmentSummary {
  total: number;
  done: number;
  overdue: number;
  dueSoon: number;
  open: number;
}

export function summariseAssignments(
  assignments: CourseAssignment[],
  doneIds: Set<string>,
  today: string,
): AssignmentSummary {
  const out: AssignmentSummary = { total: assignments.length, done: 0, overdue: 0, dueSoon: 0, open: 0 };
  for (const a of assignments) {
    const state = assignmentState(a, doneIds, today);
    if (state === 'done') out.done += 1;
    else if (state === 'overdue') out.overdue += 1;
    else if (state === 'due-soon') out.dueSoon += 1;
    else out.open += 1;
  }
  return out;
}

/**
 * Curriculum order with the learner's outstanding assignments lifted to the top.
 *
 * `moduleIds` is the full syllabus in curriculum order and is returned in full — this
 * re-orders the list, it never filters it. A learner can always still reach any module;
 * assigned work simply gets there first. Assignments referring to a module that is no
 * longer in the syllabus are ignored rather than injected.
 */
export function orderModulesForLearner(
  moduleIds: string[],
  assignments: CourseAssignment[],
  doneIds: Set<string>,
  today: string,
): string[] {
  const inSyllabus = new Set(moduleIds);
  const live = sortAssignments(
    assignments.filter((a) => inSyllabus.has(a.module) && !doneIds.has(a.module)),
    doneIds,
    today,
  );
  const lifted: string[] = [];
  const seen = new Set<string>();
  for (const a of live) {
    if (seen.has(a.module)) continue; // defensive: duplicate rows from a legacy write
    seen.add(a.module);
    lifted.push(a.module);
  }
  return [...lifted, ...moduleIds.filter((id) => !seen.has(id))];
}
