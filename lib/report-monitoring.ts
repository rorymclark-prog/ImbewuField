/**
 * report-monitoring.ts — the monitoring & evaluation plan.
 *
 * ── WHY EVERY INDICATOR HERE IS ONE THE APP ITSELF CAN CAPTURE ──────────────────────────────
 * The easiest M&E plan to write is a list of things that ought to be measured. It is also
 * useless, because nobody measures them. Every row below is tied to a screen that already
 * exists in this app, so the plan can actually be followed:
 *
 *   • harvest weight        → the harvest log (ProductionLog)
 *   • sales                 → the sales ledger (SalesLog)
 *   • tree survival         → a count against the trees placed on the plan
 *   • ground cover          → repeat photographs from a fixed point
 *   • stored water          → a tank level read on the same day each month
 *
 * A baseline is printed only where the plan already carries the number. Where it does not, the
 * row says "measure it once before you start" — which is a real instruction — rather than a
 * plausible starting figure, which would be a fiction the farmer is then measured against.
 */

import type { ReportSiteFacts } from '@/lib/report-site-facts';
import { BED_DEF_IDS } from '@/lib/design-beds-bridge';

const BED_DEF_ID_SET = new Set<string>(BED_DEF_IDS);

/**
 * Group digits with a PLAIN ASCII SPACE — never `toLocaleString`, whose en-ZA separator is
 * U+00A0 and does not survive the PDF exporter's default font. See lib/report-boq.ts.
 */
function groupDigits(n: number): string {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

export interface MonitoringRow {
  indicator: string;
  /** The question this indicator actually answers. */
  question: string;
  /** The starting figure, when the plan already knows it. */
  baseline: string;
  method: string;
  frequency: string;
  /** Which screen in this app records it. */
  recordedIn: string;
}

export function buildMonitoringPlan(facts: ReportSiteFacts | null | undefined): MonitoringRow[] {
  const rows: MonitoringRow[] = [];
  const design = facts?.design;

  rows.push({
    indicator: 'Harvest by crop',
    question: 'Is the land actually producing food, and which crops carry it?',
    baseline: 'Nothing logged yet — the first month you record becomes the baseline',
    method: 'Weigh each pick and log it against the crop',
    frequency: 'Every harvest',
    recordedIn: 'Harvest log',
  });

  rows.push({
    indicator: 'Sold vs kept',
    question: 'How much of the harvest was sold, and how much fed the household?',
    baseline: 'Set by the first full month of both logs',
    method: 'Log each sale (crop, kg, amount). What was harvested and not sold is what stayed home',
    frequency: 'Every sale',
    recordedIn: 'Sales ledger',
  });

  // Beds are 'growing' too, and a bed is not a tree — counting one as a perennial to be checked
  // for survival makes the baseline nonsense ("12 placed: Moringa x2, Bed 1 x1, Bed 2 x1 …").
  // The collector already strips them; this is the same defence-in-depth as lib/report-boq.ts.
  const trees = design?.elements.filter(
    (g) => g.category === 'growing' && !(g.defId && BED_DEF_ID_SET.has(g.defId)),
  ) ?? [];
  const treeTotal = trees.reduce((sum, g) => sum + g.count, 0);
  rows.push({
    indicator: 'Tree and perennial survival',
    question: 'Are the perennials that were planted still alive a year later?',
    baseline: treeTotal > 0
      ? `${treeTotal} placed on the plan${trees.length ? ` (${trees.map((g) => `${g.name} x${g.count}`).join(', ')})` : ''}`
      : 'No trees placed on the plan yet',
    method: 'Walk the plan and count living plants against the number placed. Record replacements separately from survivors',
    frequency: 'Every six months, and after any drought or fire',
    recordedIn: 'Field journal',
  });

  rows.push({
    indicator: 'Ground cover',
    question: 'Is bare soil shrinking or spreading?',
    baseline: 'Photograph the fixed points before any work starts',
    method: 'Photograph the same three marked spots, from the same standing position, facing the same way',
    frequency: 'Once a season, four times a year',
    recordedIn: 'Field journal photographs',
  });

  const storage = facts?.water?.statedStorageLitres ?? 0;
  rows.push({
    indicator: 'Stored water',
    question: 'Does the stored water last through the dry months?',
    baseline: storage > 0
      ? `${groupDigits(storage)} L of tank capacity on the plan`
      : 'No tank capacity stated on the plan yet',
    method: 'Read the tank level on the same day each month and write down the date and the level',
    frequency: 'Monthly',
    recordedIn: 'Field journal',
  });

  if (design && design.growingAreaM2 > 0) {
    rows.push({
      indicator: 'Growing area in use',
      question: 'How much of the drawn growing area is actually planted?',
      baseline: `${groupDigits(design.growingAreaM2)} m² drawn across ${design.bedCount + design.plotCount} bed${design.bedCount + design.plotCount === 1 ? '' : 's'} and plot${design.plotCount === 1 ? '' : 's'}`,
      method: 'Count the beds carrying a crop against the beds drawn',
      frequency: 'Monthly',
      recordedIn: 'Crop planner',
    });
  }

  return rows;
}

export function monitoringMarkdown(rows: MonitoringRow[]): string {
  const out: string[] = ['## Monitoring & Evaluation Plan', ''];
  out.push('Each indicator below is one this app can record, on a screen that already exists. An indicator nobody can capture is not a plan — it is a wish, and it is why most monitoring tables are empty a year later.');
  out.push('');
  out.push('| Indicator | What it answers | Baseline | How to measure | How often | Recorded in |');
  out.push('|-----------|-----------------|----------|----------------|-----------|-------------|');
  for (const r of rows) {
    out.push(`| ${r.indicator} | ${r.question} | ${r.baseline} | ${r.method} | ${r.frequency} | ${r.recordedIn} |`);
  }
  out.push('');
  out.push('Take the baseline readings BEFORE the first work starts. A baseline measured after the fact is not a baseline, and every claim of improvement made against it is unprovable.');
  out.push('');
  return out.join('\n');
}
