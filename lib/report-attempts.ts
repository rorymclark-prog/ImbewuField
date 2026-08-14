// A REPORT THAT KEEPS KILLING THE PAGE MUST GENERATE LIGHTER, NOT THE SAME WAY.
//
// Rory, 14 August, after the crash-loop guards shipped: "Even if I try and generate a report it
// crashes." The page-level guards cannot see this. They count LOADS that die before settling —
// and a generate crash happens minutes after the page settled, so every one of them lands on a
// clean record: the page reloads, settles again, and offers the same generate button that will
// kill it the same way.
//
// What is heavy about generating: prepareSiteAnalysisImages loads up to three saved plan sheets
// and decodes each one to downscale it for the model. A sheet is a 1–3 MB JPEG, which is a
// ~50 MB bitmap the moment it is decoded. On a phone already at the memory ceiling, that spike
// is the kill. So the generate flow keeps its own small streak: an attempt is recorded before
// the heavy work, cleared on ANY outcome the page survives (success, an HTTP error, the farmer
// cancelling), and therefore only ever accumulates when the page died mid-generate. At the
// threshold, generation goes LIGHT: the plan-sheet images are skipped, the ground photos —
// 400px thumbnails, a hundredth the decoded size — still go, and the farmer gets their report.
//
// A light report beats no report. The sheets are still IN the report on screen and in the PDF
// (thumbnails and plates never went through this path); what is given up is the model READING
// them, and only on a phone that has already proven it cannot afford that.

import type { CrashLoopStore } from './crash-loop';

export const REPORT_ATTEMPT_KEY = 'imbewu_report_generate_streak';

/** Two dead attempts in a row is a pattern, not bad luck — the third goes light. A farmer has
 *  by then watched the app die twice over the same button. */
export const REPORT_ATTEMPT_THRESHOLD = 2;

/** Record that a generate STARTED. Call before the heavy work — after is too late for the
 *  attempt that dies. Returns how many attempts have started without one finishing. */
export function recordReportAttempt(store: CrashLoopStore): number {
  try {
    const parsed = Number(store.getItem(REPORT_ATTEMPT_KEY));
    const count = (Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0) + 1;
    store.setItem(REPORT_ATTEMPT_KEY, String(count));
    return count;
  } catch {
    return 1; // storage unavailable: behave like a first attempt, never like a streak
  }
}

/**
 * The page survived this attempt — on ANY outcome. Success clears it, but so do an HTTP error
 * and the farmer aborting: those are disappointments, not deaths, and escalating a network
 * error into "your phone cannot generate reports" would be its own bug. Only an attempt the
 * page did not live through leaves the count standing.
 */
export function reportAttemptSurvived(store: CrashLoopStore): void {
  try {
    store.removeItem(REPORT_ATTEMPT_KEY);
  } catch {
    /* ignore */
  }
}

/** Should THIS attempt skip the plan-sheet images? `count` is recordReportAttempt's return. */
export function reportShouldGoLight(count: number, threshold: number = REPORT_ATTEMPT_THRESHOLD): boolean {
  return count > threshold;
}
