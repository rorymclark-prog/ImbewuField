/**
 * lib/report-org-summary.ts — the NGO/funder aggregate impact report.
 *
 * Phase 4 of the NGO/funder dashboard build (see PROGRESS.md / plan). Pure aggregation only —
 * every number here is a sum or a count over rows the caller already fetched
 * (`lib/db/queries.ts`'s `buildOrgReportRows`), never inferred, same discipline as
 * `lib/report-boq.ts`. A farmer who hasn't opted in (`Profile.dataConsent`) is EXCLUDED from
 * every total below — never zero-filled, never silently dropped without being counted somewhere:
 * the summary always reports how many of the org's farmers are, and are not, represented in it.
 *
 * `buildOrgReportRows` cannot be a single org-wide Firestore query — a `list` query's security
 * rule must be provable from the query's own constraints, and `staffConsentedAccess()`'s
 * consent term depends on `profile_id`, a field the query doesn't filter on. So the row set is
 * assembled garden-by-garden, member-by-member (the same fan-out `NgoDashboard.tsx` already does
 * per gardener), and this module only ever sees the result of that fan-out.
 */

export interface OrgReportFarmerRow {
  profileId: string;
  name: string;
  gardenId: string;
  gardenName: string;
  consented: boolean;
  productionKg: number;
  salesKg: number;
  salesAmount: number;
  coursesDone: number;
  coursesTotal: number;
}

export interface OrgReportGardenInput { id: string; name: string; status: string }

export interface OrgReportSummary {
  gardens: number;
  gardenStatusCounts: Record<string, number>;
  totalFarmers: number;
  consentedFarmers: number;
  productionKg: number;
  salesKg: number;
  salesAmount: number;
  avgCoursesPct: number;
  farmers: OrgReportFarmerRow[];
}

export function summarizeOrgReport(
  gardens: OrgReportGardenInput[],
  rows: OrgReportFarmerRow[],
): OrgReportSummary {
  const consented = rows.filter((r) => r.consented);

  const gardenStatusCounts: Record<string, number> = {};
  for (const g of gardens) gardenStatusCounts[g.status] = (gardenStatusCounts[g.status] ?? 0) + 1;

  const productionKg = consented.reduce((s, r) => s + r.productionKg, 0);
  const salesKg = consented.reduce((s, r) => s + r.salesKg, 0);
  const salesAmount = consented.reduce((s, r) => s + r.salesAmount, 0);
  const coursesDone = consented.reduce((s, r) => s + r.coursesDone, 0);
  const coursesTotal = consented.reduce((s, r) => s + r.coursesTotal, 0);
  const avgCoursesPct = coursesTotal > 0 ? Math.round((coursesDone / coursesTotal) * 100) : 0;

  return {
    gardens: gardens.length,
    gardenStatusCounts,
    totalFarmers: rows.length,
    consentedFarmers: consented.length,
    productionKg,
    salesKg,
    salesAmount,
    avgCoursesPct,
    farmers: rows,
  };
}

/**
 * Plain CSV, one row per farmer — Excel/Sheets friendly. A farmer who hasn't opted in is a row
 * marked "Not yet" with blank figures, not an omitted row — a reader can see exactly how many
 * farmers are excluded from the totals above them, and why, rather than the sheet quietly
 * looking complete when it isn't.
 */
export function orgReportToCsv(summary: OrgReportSummary): string {
  const esc = (v: string | number): string => {
    const s = String(v);
    return /["\n,]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = [
    'Farmer', 'Garden', 'Data shared',
    'Production (kg)', 'Sales (kg)', 'Sales (R)', 'Training complete (%)',
  ];
  const lines = [header.map(esc).join(',')];
  for (const r of summary.farmers) {
    const pct = r.coursesTotal > 0 ? Math.round((r.coursesDone / r.coursesTotal) * 100) : 0;
    lines.push([
      r.name,
      r.gardenName,
      r.consented ? 'Yes' : 'Not yet',
      r.consented ? r.productionKg.toFixed(1) : '',
      r.consented ? r.salesKg.toFixed(1) : '',
      r.consented ? r.salesAmount.toFixed(2) : '',
      r.consented ? String(pct) : '',
    ].map(esc).join(','));
  }
  return lines.join('\n');
}

/** Filename for the CSV download — dated, so a second export the same day doesn't silently overwrite the first in a Downloads folder. */
export function orgReportCsvFilename(orgName: string, dateLabel: string): string {
  const safe = orgName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'organisation';
  return `imbewufield-${safe}-report-${dateLabel}.csv`;
}
