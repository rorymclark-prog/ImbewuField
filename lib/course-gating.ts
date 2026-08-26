// Sequential module gating for the Learning Portal — decides which modules a learner may open,
// which one is "current", when the capstone unlocks, and why a locked module is locked.
//
// PURE MODULE — no firebase, no `window`, no React. Everything gating needs is passed in via
// GatingContext, so this file is trivially unit-testable (tests/course-gating.test.ts) and has
// no side effects beyond reading the static curriculum it imports (also pure).
//
// RECONCILIATION NOTE (2026-07-27): an incoming brief asked for this logic to live inside
// lib/course-assignments.ts and lib/course-enrollment.ts. Those files already hold a shipped,
// tested design (mentor-set assignments with due dates; enrolment records) — this is a NEW file
// that IMPORTS from them rather than overwriting either. It also does NOT add a learner-writable
// enrolment doc: firestore.rules (~line 137, course_enrollments) deliberately makes enrolment
// MENTOR-OWNED — "learners cannot enrol themselves onto a programme, cannot set their own
// deadlines". Gating below computes purely from the learner-owned course_progress collection
// (the single authority for "is this module done" — see myCourseProgress/setCourseProgress in
// lib/db/queries.ts) plus the new course_submissions collection, whose shape and doc id this
// file owns, matching the CourseAssignment/CourseEnrollment convention exactly.

import { COURSE_MODULES } from './course-modules';
import type { CourseAssignment } from './course-assignments';

// ─── Submission evidence (photo + self-check, optionally a voice note) ───────────────────────
// Firestore/Storage access for this collection lives in lib/db/queries.ts, matching every other
// collection (see that file's header comment) — this module only owns the shape and the
// deterministic doc id, exactly like CourseAssignment/CourseEnrollment do for course_assignments
// and course_enrollments.

export interface CourseSubmission {
  id: string;
  profile_id: string;
  /** DENORMALISED for rule scoping — see the note on CourseProgress in lib/db/types.ts. */
  org_id: string | null;
  /** Module id from lib/course-modules.ts. */
  module: string;
  /** ISO timestamp of the submit action. */
  submitted_at: string;
  /** The ModuleAssignment.selfCheckItems strings the learner ticked (each item is its own id —
   *  there's no separate id field on a self-check item). */
  self_check: string[];
  /**
   * Storage PATH — e.g. "course_submissions/{uid}/{module}/photo.jpg" — deliberately NOT a
   * download URL. A Firebase Storage download URL embeds a token that bypasses security rules
   * for anyone holding it, which is wrong for evidence scoped to the learner + their mentor/
   * staff. Storing the path means every reader resolves it to a URL themselves (getDownloadURL),
   * which re-checks storage.rules at that moment instead of baking a standing bypass into a
   * Firestore field mentors/staff can already read.
   */
  photo_path: string | null;
  /** Same path convention as photo_path — "course_submissions/{uid}/{module}/voice.m4a". */
  voice_path: string | null;
  updated_at?: unknown;
}

/** One submission per learner per module — deterministic id makes resubmitting an update (new
 *  photo/self-check) rather than a second row the learner or mentor has to reconcile, same
 *  pattern as course_progress and course_assignments. */
export function courseSubmissionDocId(profileId: string, module: string): string {
  return `${profileId}_${module}`;
}

/** Module ids the learner has submitted evidence for. */
export function submittedModuleIds(submissions: CourseSubmission[]): Set<string> {
  return new Set(submissions.map((s) => s.module));
}

// ─── Assignment content (prompt + self-check items shown on the submission screen) ───────────
//
// LOUD COMMENT — DO NOT FILL THIS IN FROM A CODING SESSION: the prompts and self-check items
// are authored permaculture content, paced to real seasonal work in the field. Rory (the owner)
// is the only one positioned to write them — a farmer acts on this directly, so inventing
// wording here would put unverified agronomic instructions in front of real people. Populate
// MODULE_ASSIGNMENTS one module at a time as the owner supplies real copy.
//
// Every consumer of MODULE_ASSIGNMENTS / assignmentFor() below MUST degrade gracefully when a
// module has no entry — see the safety-valve comment on isModuleComplete: a farmer must never be
// permanently blocked by content that hasn't been authored yet.

// SUPPLIED 2026-07-27 — the table is no longer empty. The content lives in
// lib/course-assignment-content.ts: authored and paced by Rory (Imbewu Yoshintso NPC) against real
// South African conditions, with figures and timings that are his, not generated. Do NOT rewrite,
// regenerate or "tidy" it from a coding session. Re-exported here so every existing consumer of
// MODULE_ASSIGNMENTS/assignmentFor keeps its import path, and so the content sits in a file that
// contains ONLY content — no logic to accidentally review it against.
//
// The safety valve below still stands and still matters: it now covers the capstone (which has no
// MODULE_ASSIGNMENTS row) and any module whose content is ever revised out.
export type { ModuleAssignment } from './course-assignment-content';
export { MODULE_ASSIGNMENTS, CAPSTONE, minimumCourseDays } from './course-assignment-content';
import { MODULE_ASSIGNMENTS, type ModuleAssignment } from './course-assignment-content';

// A live lookup against the array itself, not a Map snapshotted at import time — the table is
// short (at most one entry per curriculum module) and this keeps "add an entry" a one-line edit
// with no second cache to remember to rebuild.
export function assignmentFor(moduleId: string): ModuleAssignment | undefined {
  return MODULE_ASSIGNMENTS.find((a) => a.moduleId === moduleId);
}

// ─── Gating ────────────────────────────────────────────────────────────────────────────────

export interface GatingContext {
  /** Full syllabus in CURRICULUM order — always COURSE_MODULES.map(m => m.id). Gating reasons
   *  about this fixed order, never the mentor-assignment-reordered display list the student page
   *  builds for the module LIST (orderModulesForLearner in lib/course-assignments.ts is
   *  display-only — passing its output here would silently change what "previous module"
   *  means). */
  moduleIds: string[];
  /** From course_progress via myCourseProgress() — completedModuleIds() in
   *  lib/course-enrollment.ts builds this same shape from the same rows. */
  doneIds: Set<string>;
  /** From course_submissions via myCourseSubmissions() — submittedModuleIds() above. */
  submittedIds: Set<string>;
  /** The learner's own mentor assignments (myAssignments()). Presence of ANY row for a module,
   *  regardless of due date or state, is what makes that module mentor-overridden. */
  assignments: CourseAssignment[];
}

const MODULE_TITLE = new Map(COURSE_MODULES.map((m) => [m.id, m.title] as const));

function mentorOverride(moduleId: string, ctx: GatingContext): boolean {
  return ctx.assignments.some((a) => a.module === moduleId);
}

/**
 * A module counts as complete for gating purposes once it's ticked in course_progress AND
 * (submitted OR has no authored assignment content yet).
 *
 * SAFETY VALVE: MODULE_ASSIGNMENTS ships empty (see above) and fills in one module at a time as
 * the owner authors real content. A module with no ModuleAssignment has no submission screen to
 * submit FROM — requiring a submission for it would permanently lock every module after it, for
 * every solo learner, with no way out until the owner writes copy. So for a module with no
 * content yet, the done-tick alone is enough. This is re-checked per module (not "once content
 * exists anywhere"), so modules light up their submission requirement independently as the owner
 * fills the table in.
 */
export function isModuleComplete(moduleId: string, ctx: GatingContext): boolean {
  if (!ctx.doneIds.has(moduleId)) return false;
  if (!assignmentFor(moduleId)) return true; // safety valve — see above
  return ctx.submittedIds.has(moduleId);
}

/**
 * Whether `moduleId` may be opened right now.
 *
 * - The first module in the curriculum is always unlocked.
 * - A module a mentor has explicitly assigned to this learner is always unlocked — RULED BY THE
 *   OWNER: a mentor who knows the farmer may open a module out of order. Solo learners (no
 *   assignments at all) get full sequential gating.
 * - Otherwise it unlocks once the PREVIOUS module is complete (see isModuleComplete's safety
 *   valve above, which is what lets a solo learner with no mentor still reach every module).
 *
 * An id that isn't in ctx.moduleIds — or is the first entry — is never gated: we don't block on
 * something we can't place in the curriculum.
 */
export function isModuleUnlocked(moduleId: string, ctx: GatingContext): boolean {
  const idx = ctx.moduleIds.indexOf(moduleId);
  if (idx <= 0) return true;
  if (mentorOverride(moduleId, ctx)) return true;
  const prevId = ctx.moduleIds[idx - 1];
  return isModuleComplete(prevId, ctx);
}

/** Curriculum-order id of the next module the learner should work on, or null once every module
 *  in `ctx.moduleIds` is complete — that's the capstone's cue, not a module id. */
export function currentModuleId(ctx: GatingContext): string | null {
  for (const id of ctx.moduleIds) {
    if (!isModuleComplete(id, ctx)) return id;
  }
  return null;
}

/** All modules in `ctx.moduleIds` done + submitted (or safety-valved) — the capstone links out
 *  to the existing Design Studio (/design); this function only decides whether that link is
 *  live, it isn't a new tool in itself. */
export function isCapstoneUnlocked(ctx: GatingContext): boolean {
  return ctx.moduleIds.length > 0 && ctx.moduleIds.every((id) => isModuleComplete(id, ctx));
}

/**
 * Plain-language reason for the UI to show under a locked module's lock icon — or, for a
 * mentor-opened module, why it's available out of order. Returns null when there's nothing worth
 * saying (module 1, an id outside the curriculum, or — defensively — a module that turns out to
 * already be unlocked).
 */
export function unlockReason(moduleId: string, ctx: GatingContext): string | null {
  const idx = ctx.moduleIds.indexOf(moduleId);
  if (mentorOverride(moduleId, ctx)) return 'Opened by your mentor';
  if (idx <= 0) return null;
  const prevId = ctx.moduleIds[idx - 1];
  const prevTitle = MODULE_TITLE.get(prevId) ?? 'the previous module';
  if (!ctx.doneIds.has(prevId)) return `Finish ${prevTitle} to open this`;
  if (assignmentFor(prevId) && !ctx.submittedIds.has(prevId)) {
    return `Submit the ${prevTitle} assignment to open this`;
  }
  return null; // previous module is complete — moduleId should already be unlocked
}
