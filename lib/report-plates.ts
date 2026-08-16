// WHICH SAVED SHEETS BELONG IN THE REPORT.
//
// The first version of the report plates took every saved sheet for the site, oldest first. Rory
// asked the question that exposes it — "does it pull the exact canvas maps or what?" — and the
// honest answer was: all of them. His gallery holds over a hundred saved maps, because the gallery
// is a WORKING RECORD: every render he has ever made, exact and paid, across every revision of the
// plan rules. As an appendix to a report that is a hundred near-duplicate pages, most of them
// superseded, several of them from an older era of the render rules and labelled as such.
//
// A report appendix is not a gallery. It should carry ONE plate per sheet — the latest one the
// farmer made — in sheet order, from the current generation of the plan set.
//
// Pure and separate from the PDF builder so the choice can be tested against real label shapes
// without a canvas, a browser or jsPDF.

/** The fields of a saved sheet this selection needs. Structurally typed so lib/sheet-store's
 *  StoredSheetMeta satisfies it without this module importing IndexedDB code. */
export interface ReportPlateCandidate {
  id: string;
  label: string;
  /** ISO timestamp — newest wins within a sheet. */
  at: string;
  /** Which generation of the plan set produced it; absent on pre-versioning sheets. */
  planVersion?: string;
  /** Visual recipe that produced the pixels; absent rows predate recipe tracking. */
  renderRecipe?: string;
}

export interface ReportPlate {
  id: string;
  label: string;
}

/**
 * A backstop, not a policy. One plate per sheet over a nine-sheet set lands well under this; the
 * cap only bites if labels are shaped in a way this file did not anticipate, and it exists so an
 * odd gallery can never produce a hundred-page appendix again.
 */
export const MAX_REPORT_PLATES = 12;

/**
 * The sheet a saved render belongs to.
 *
 * Labels are built as "<sheet> · <style> · AI Polished · geometry locked" or "<sheet> · Exact
 * master" (see pushGallery). The leading segment is the sheet; everything after it says how that
 * sheet was made, which is exactly the axis we want to collapse — a farmer wants their Planting
 * sheet in the report, not the exact one AND the polished one AND three earlier attempts.
 */
export function plateSheetKey(label: string): string {
  const head = (label ?? '').split('·')[0]?.trim() ?? '';
  // "· older version" is appended to sheets from a previous plan generation; it is never the head,
  // but strip defensively so an old sheet groups with its current sibling rather than beside it.
  return head.replace(/\s+older version$/i, '').trim().toLowerCase();
}

/** Sheets are titled "06 — Planting & Agroforestry"; a report reads 01…09, not alphabetically. */
export function plateSheetOrdinal(label: string): number {
  const m = /^\s*(\d{1,2})\b/.exec(label ?? '');
  return m ? Number(m[1]) : Number.POSITIVE_INFINITY;
}

function newerThan(a: ReportPlateCandidate, b: ReportPlateCandidate): boolean {
  const ta = Date.parse(a.at);
  const tb = Date.parse(b.at);
  if (Number.isNaN(ta)) return false;
  if (Number.isNaN(tb)) return true;
  return ta > tb;
}

/**
 * Choose the plates for one report.
 *
 * @param candidates every saved sheet for the site, in any order
 * @param currentPlanVersion the generation of the plan set the app renders today
 */
export function selectReportPlates(
  candidates: readonly ReportPlateCandidate[],
  currentPlanVersion: string,
  currentRenderRecipe?: string,
  max: number = MAX_REPORT_PLATES,
): ReportPlate[] {
  const usable = (candidates ?? []).filter((c) => c && c.id && (c.label ?? '').trim());
  if (!usable.length) return [];

  // CURRENT GENERATION ONLY — but never at the cost of an empty appendix. A sheet from an older
  // era of the render rules contains different things and is labelled "· older version" in the
  // gallery for that reason; putting one in a report presents it as current. A farmer who has ONLY
  // old sheets still gets their maps, because a report with no maps is worse than a report with
  // the maps they actually have.
  const current = usable.filter((c) => (
    c.planVersion === currentPlanVersion
    && (currentRenderRecipe === undefined || c.renderRecipe === currentRenderRecipe)
  ));
  const pool = current.length ? current : usable;

  const newestPerSheet = new Map<string, ReportPlateCandidate>();
  for (const candidate of pool) {
    const key = plateSheetKey(candidate.label);
    const held = newestPerSheet.get(key);
    if (!held || newerThan(candidate, held)) newestPerSheet.set(key, candidate);
  }

  return [...newestPerSheet.values()]
    .sort((a, b) => {
      const oa = plateSheetOrdinal(a.label);
      const ob = plateSheetOrdinal(b.label);
      if (oa !== ob) return oa - ob;
      return a.label.localeCompare(b.label);
    })
    .slice(0, max)
    .map((c) => ({ id: c.id, label: c.label }));
}
