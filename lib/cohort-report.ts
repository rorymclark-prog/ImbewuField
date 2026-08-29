/*
 * WHAT A FUNDER TAKES AWAY FROM THE COHORT SCREEN — the training roll-up and the CSV.
 *
 * Both read `NetworkFarmerSummary[]` (lib/network.ts) and nothing else, so every figure here is
 * the SAME figure the portfolio map, the roster and the farmer panel already show. A dashboard
 * that computes its own version of a number it also displays elsewhere is how two screens end up
 * disagreeing in front of the person being asked for money.
 *
 * THE ONE RULE, IN BOTH DIRECTIONS: `null` means "this account may not read that", never zero.
 *   • In the training roll-up a farmer with a null `modulesDone` is counted in `total` and NOT in
 *     `reporting`, and never lands in a band. Putting them in band 0 would draw a bar labelled
 *     "no modules finished" out of people who simply did not agree to share their training record.
 *   • In the CSV a null is an EMPTY CELL. Writing 0 there would put a figure into a spreadsheet
 *     that gets filtered, summed and pasted into a report, with nothing left on screen to say it
 *     was never a measurement.
 */

import {
  attentionFlags,
  DEFAULT_COURSE_MODULE_COUNT,
  type NetworkFarmerSummary,
} from './network';

/* ────────────────────────────────────────────────────────────────────────────
 * Training across the cohort
 * ──────────────────────────────────────────────────────────────────────────*/

export interface TrainingBand {
  /** Modules finished — 0 … modulesTotal. */
  done: number;
  farmers: number;
}

export interface CohortTraining {
  /** Everyone in the cohort, readable or not. */
  total: number;
  /** Farmers whose training record this account may read. The denominator for every figure below. */
  reporting: number;
  /** Modules in the course. Read from the caller's COURSE_MODULES, never guessed. */
  modulesTotal: number;
  /** One entry per module count, 0 … modulesTotal, always the full length so the axis is stable. */
  bands: TrainingBand[];
  /** Mean share of the course finished, across reporting farmers only. Null when nobody reports. */
  averagePct: number | null;
  /** Reporting farmers who have finished every module. */
  finishedCourse: number;
  /** Reporting farmers with at least one module done. */
  started: number;
  /** Total module completions across the cohort — the programme's actual training output. */
  modulesCompleted: number;
}

/**
 * Bucket the cohort by how many course modules each farmer has finished.
 *
 * `modulesTotal` comes from the caller (`COURSE_MODULES.length`) rather than from a constant here,
 * because lib/network.ts already keeps {@link DEFAULT_COURSE_MODULE_COUNT} in step with that list
 * and a second copy of the same number is a second thing to get wrong. A farmer whose recorded
 * count somehow exceeds the course length is clamped into the top band rather than growing the
 * axis — an eleventh column on a ten-module course is a data bug, not a finding to draw.
 */
export function cohortTraining(
  rows: readonly NetworkFarmerSummary[],
  modulesTotalInput?: number,
): CohortTraining {
  const modulesTotal = Math.max(
    1,
    Math.trunc(
      Number.isFinite(modulesTotalInput as number) && (modulesTotalInput as number) > 0
        ? (modulesTotalInput as number)
        : (rows.find((r) => r.metrics.modulesTotal > 0)?.metrics.modulesTotal ?? DEFAULT_COURSE_MODULE_COUNT),
    ),
  );

  const bands: TrainingBand[] = Array.from({ length: modulesTotal + 1 }, (_, done) => ({ done, farmers: 0 }));

  let reporting = 0;
  let modulesCompleted = 0;
  let pctTotal = 0;
  let finishedCourse = 0;
  let started = 0;

  for (const row of rows) {
    const done = row.metrics.modulesDone;
    if (done === null) continue; // withheld or unreadable — counted in `total`, never in a band
    reporting += 1;
    const clamped = Math.max(0, Math.min(modulesTotal, Math.round(done)));
    bands[clamped].farmers += 1;
    modulesCompleted += clamped;
    pctTotal += (clamped / modulesTotal) * 100;
    if (clamped === modulesTotal) finishedCourse += 1;
    if (clamped > 0) started += 1;
  }

  return {
    total: rows.length,
    reporting,
    modulesTotal,
    bands,
    averagePct: reporting === 0 ? null : Math.round(pctTotal / reporting),
    finishedCourse,
    started,
    modulesCompleted,
  };
}

/* ────────────────────────────────────────────────────────────────────────────
 * CSV export
 * ──────────────────────────────────────────────────────────────────────────*/

export const COHORT_CSV_COLUMNS = [
  'Farmer',
  'Site',
  'District',
  'Municipality',
  'Cohort',
  'Status',
  'Joined',
  'Months active',
  'Plot m2',
  'Harvested kg',
  'Sold kg',
  'Kept kg',
  'Income R',
  'Expenses R',
  'Net R',
  'Modules done',
  'Modules total',
  'Training %',
  'Surveys answered',
  'Last activity',
  'Days since activity',
  'Needs attention',
  'Sample data',
] as const;

/**
 * RFC 4180 quoting, plus a spreadsheet-injection guard.
 *
 * Farmer and site names are user-entered text, and a cell that begins `=`, `+`, `-` or `@` is
 * executed as a formula the moment the file is opened in Excel, Numbers or Sheets. This export is
 * built to be opened in exactly those, by someone who did not write the name. A leading apostrophe
 * is the standard defusal and is invisible in the cell.
 */
function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return ''; // null is an empty cell, never a 0
  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** `2026-03-14`, or empty when the stored value is not a usable date. */
function csvDate(iso: string | null | undefined): string {
  if (typeof iso !== 'string') return '';
  const t = Date.parse(iso);
  return Number.isFinite(t) ? new Date(t).toISOString().slice(0, 10) : '';
}

/**
 * The cohort table, as a CSV a funder can open in a spreadsheet.
 *
 * Deliberately the SAME rows the screen is showing — pass the filtered, sorted list, not the whole
 * portfolio. An export that quietly widens the selection hands over records the person never saw
 * and did not ask for.
 *
 * No ID numbers and no coordinates: `NetworkFarmer` carries neither by design (see the contract in
 * lib/network.ts), and a spreadsheet leaving the building is the last place to start.
 */
export function cohortCsv(rows: readonly NetworkFarmerSummary[]): string {
  const lines: string[] = [COHORT_CSV_COLUMNS.join(',')];

  for (const row of rows) {
    const { farmer, metrics } = row;
    const flags = attentionFlags(row);
    lines.push([
      csvCell(farmer.name),
      csvCell(farmer.siteName),
      csvCell(farmer.district),
      csvCell(farmer.municipality),
      csvCell(farmer.cohortName),
      csvCell(farmer.status),
      csvCell(csvDate(farmer.joinedAt)),
      csvCell(metrics.monthsActive),
      csvCell(farmer.plotSizeM2),
      csvCell(metrics.producedKg),
      csvCell(metrics.soldKg),
      csvCell(metrics.keptKg),
      csvCell(metrics.incomeZar),
      csvCell(metrics.expensesZar),
      csvCell(metrics.netZar),
      csvCell(metrics.modulesDone),
      csvCell(metrics.modulesTotal),
      csvCell(metrics.trainingPct),
      csvCell(metrics.surveysAnswered),
      csvCell(csvDate(metrics.lastActivityAt)),
      csvCell(metrics.daysSinceActivity),
      csvCell(flags.map((f) => f.label).join('; ')),
      csvCell(farmer.isDemo ? 'yes' : 'no'),
    ].join(','));
  }

  // Trailing newline: a POSIX text file ends with one, and some importers drop the last row without.
  return `${lines.join('\n')}\n`;
}

/** `imbewufield-cohort-2026-08-29.csv` — dated, so two exports never overwrite each other. */
export function cohortCsvFilename(now: Date = new Date(), label?: string): string {
  const day = Number.isFinite(now.getTime()) ? now.toISOString().slice(0, 10) : 'undated';
  const slug = (label ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return slug ? `imbewufield-${slug}-${day}.csv` : `imbewufield-cohort-${day}.csv`;
}
