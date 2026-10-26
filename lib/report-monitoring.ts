import { reportDocumentText } from './report-localisation';
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

import { groupDigits, type ReportSiteFacts } from '@/lib/report-site-facts';
import { BED_DEF_IDS } from '@/lib/design-beds-bridge';

const BED_DEF_ID_SET = new Set<string>(BED_DEF_IDS);

// groupDigits is imported, not redefined — see report-site-facts.ts's own comment on why a
// second copy of this rule is this repo's most repeated defect. This file used to carry that
// second copy, in sync only by luck.

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

export function buildMonitoringPlan(facts: ReportSiteFacts | null | undefined, language = 'en'): MonitoringRow[] {
  const t=(source:string,values?:Record<string,string|number>)=>reportDocumentText(source,language,values);
  const rows: MonitoringRow[] = [];
  const design = facts?.design;

  rows.push({
    indicator: t('Harvest by crop'),
    question: t('Is the land actually producing food, and which crops carry it?'),
    baseline: t('The report does not read harvest logs; record the starting period before support, or label a later baseline as retrospective'),
    method: t('Weigh each pick and log it against the crop'),
    frequency: t('Every harvest'),
    recordedIn: t('Harvest log'),
  });

  rows.push({
    indicator: t('Sold vs kept'),
    question: t('How much of the harvest was sold, and how much fed the household?'),
    baseline: t('Set by the first full month of both logs'),
    method: t('Log sales, home use, donations, losses and stored stock separately. Harvest minus sales is not household consumption.'),
    frequency: t('Every sale'),
    recordedIn: t('Sales ledger'),
  });

  // Beds are 'growing' too, and a bed is not a tree — counting one as a perennial to be checked
  // for survival makes the baseline nonsense ("12 placed: Moringa x2, Bed 1 x1, Bed 2 x1 …").
  // The collector already strips them; this is the same defence-in-depth as lib/report-boq.ts.
  const trees = design?.elements.filter(
    (g) => g.category === 'growing' && !(g.defId && BED_DEF_ID_SET.has(g.defId)),
  ) ?? [];
  const treeTotal = trees.reduce((sum, g) => sum + g.count, 0);
  rows.push({
    indicator: t('Tree and perennial survival'),
    question: t('Are the perennials that were planted still alive a year later?'),
    baseline: treeTotal > 0
      ? t('{count} placed on the plan{names}',{count:treeTotal,names:trees.length ? ` (${trees.map((g) => `${g.name} x${g.count}`).join(', ')})` : ''})
      : t('No trees placed on the plan yet'),
    method: t('First verify how many were actually planted and when. Count living plants against that planting cohort, not proposed map items; record replacements separately.'),
    frequency: t('Every six months, and after any drought or fire'),
    recordedIn: t('Field journal'),
  });

  rows.push({
    indicator: t('Ground cover'),
    question: t('Is bare soil shrinking or spreading?'),
    baseline: t('Photograph the fixed points before any work starts'),
    method: t('Photograph the same three marked spots, from the same standing position, facing the same way'),
    frequency: t('Once a season, four times a year'),
    recordedIn: t('Field journal photographs'),
  });

  const storage = facts?.water?.statedStorageLitres ?? 0;
  rows.push({
    indicator: t('Stored water'),
    question: t('Does the stored water last through the dry months?'),
    baseline: storage > 0
      ? t('{litres} L of tank capacity on the plan',{litres:groupDigits(storage)})
      : t('No tank capacity stated on the plan yet'),
    method: t('Read the tank level on the same day each month and write down the date and the level'),
    frequency: t('Monthly'),
    recordedIn: t('Field journal'),
  });

  if (design && design.growingAreaM2 > 0) {
    // Beds and plots are counted SEPARATELY and only named when the farm actually has them —
    // matching the Site at a Glance table (report-site-facts.ts) and the bill of quantities
    // (report-boq.ts). This row used to apply one shared count to the word "bed" alone while
    // "plot" rode along with no number of its own: a farm with one staple plot and no beds
    // printed "1 bed and plot" (there is no bed), and a farm with beds and no plots printed
    // "beds and plots" (there are no plots). The other two places already got this right.
    const parts: string[] = [];
    if (design.bedCount > 0) parts.push(t(design.bedCount===1?'{count} bed':'{count} beds',{count:design.bedCount}));
    if (design.plotCount > 0) parts.push(t(design.plotCount===1?'{count} plot':'{count} plots',{count:design.plotCount}));
    rows.push({
      indicator: t('Growing area in use'),
      question: t('How much of the drawn growing area is actually planted?'),
      baseline: t('{area} m² drawn across {parts}',{area:groupDigits(design.growingAreaM2),parts:parts.join(t(' and '))}),
      method: t('Measure the physical beds carrying a crop, counting each once. A saved crop plan is planned use, not confirmation of actual planting.'),
      frequency: t('Monthly'),
      recordedIn: t('Crop planner'),
    });
  }

  return rows;
}

export function monitoringMarkdown(rows: MonitoringRow[], language = 'en'): string {
  const t=(source:string,values?:Record<string,string|number>)=>reportDocumentText(source,language,values);
  const out: string[] = [`## ${t('Monitoring & Evaluation Plan')}`, ''];
  out.push(t('Each indicator below is one this app can record, on a screen that already exists. An indicator nobody can capture is not a plan — it is a wish, and it is why most monitoring tables are empty a year later.'));
  out.push('');
  out.push(`| ${t('Indicator')} | ${t('What it answers')} | ${t('Baseline')} | ${t('How to measure')} | ${t('How often')} | ${t('Recorded in')} |`);
  out.push('|-----------|-----------------|----------|----------------|-----------|-------------|');
  for (const r of rows) {
    out.push(`| ${r.indicator} | ${r.question} | ${r.baseline} | ${r.method} | ${r.frequency} | ${r.recordedIn} |`);
  }
  out.push('');
  out.push(t('Take baseline readings before support starts. Label any later or recalled starting figures clearly; compare matching periods and do not attribute every change to the project.'));
  out.push('');
  return out.join('\n');
}
