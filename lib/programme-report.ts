import { numberLabel, randCentsLabel } from './format-figures';
import { portfolioTotals, attentionFlags, type NetworkFarmerSummary } from './network';
import { cohortTraining } from './cohort-report';
import type { CohortSeries } from './cohort-series';
import type { ReportSection, ReportMetric, ReportChart, ReportTable } from './programme-report-pdf';

export type ProgrammeReportKind = 'overview' | 'production' | 'training';
export type ProgrammeReportBasis = 'cumulative' | 'window';
export const PROGRAMME_REPORT_SOURCES = [
  { label: 'OECD · Evaluation criteria', url: 'https://www.oecd.org/en/topics/sub-issues/development-co-operation-evaluation-and-effectiveness/evaluation-criteria.html' },
  { label: 'FAO · Tool for Agroecology Performance Evaluation', url: 'https://www.fao.org/family-farming/detail/en/c/1618512/' },
  { label: 'South African DSD · NPO reporting obligations', url: 'https://www.dsd.gov.za/index.php/16-obligations' },
];
export interface ProgrammeReportOptions {
  rows: NetworkFarmerSummary[];
  monthly: CohortSeries;
  kind: ProgrammeReportKind;
  funder: boolean;
  sample: boolean;
  organisation: string;
  cohortId?: string;
  basis?: ProgrammeReportBasis;
  startMonth?: string;
  endMonth?: string;
  withheldForConsent: number;
  date: string;
}
export interface ProgrammeReportModel {
  title: string;
  subtitle: string;
  period: string;
  scope: string;
  sections: ReportSection[];
  metrics: ReportMetric[];
  tables: ReportTable[];
  chart?: ReportChart;
  coverage: { label: string; available: number; total: number }[];
  rows: NetworkFarmerSummary[];
}
/** Keep a vanished selection visible: a consent/data refresh must not widen a cohort export. */
export function programmeReportCohortChoices(rows: NetworkFarmerSummary[], selectedId = '') {
  const choices = new Map<string, { id: string; label: string; available: boolean }>();
  for (const { farmer } of rows) if (farmer.cohortId) choices.set(farmer.cohortId, {
    id: farmer.cohortId, label: farmer.cohortName || 'Unnamed cohort', available: true,
  });
  if (selectedId && !choices.has(selectedId)) choices.set(selectedId, {
    id: selectedId, label: 'Selected cohort · no visible records', available: false,
  });
  return [...choices.values()];
}

const format = (n: number | null, unit = '') => n === null || !Number.isFinite(n) ? 'Not available' : `${numberLabel(n,2)}${unit}`;
const countedNoun = (n: number, noun: string) => n === 1 ? noun : `${noun}s`;
const money = (n: number | null) => n === null || !Number.isFinite(n) ? 'Not available' : randCentsLabel(n);
const sum = (values: (number | null)[]) => {
  const known = values.filter((v): v is number => v !== null && Number.isFinite(v));
  return known.length ? Math.round(known.reduce((a, b) => a + b, 0) * 100) / 100 : null;
};

/** Snapshot metrics have no event dates. Only the server's dated ledger can answer a period query;
 * a cohort filter must never relabel organisation-wide monthly totals as that cohort's results. */
export function buildProgrammeReport(o: ProgrammeReportOptions): ProgrammeReportModel {
  const rows = o.cohortId ? o.rows.filter(r => r.farmer.cohortId === o.cohortId) : o.rows;
  const totals = portfolioTotals(rows);
  const training = cohortTraining(rows);
  const cohort = o.cohortId ? rows[0]?.farmer.cohortName || 'Selected cohort' : 'All visible cohorts';
  const scoped = o.basis === 'window' && !o.cohortId;
  const months = scoped ? o.monthly.months.filter(m => (!o.startMonth || m.key >= o.startMonth) && (!o.endMonth || m.key <= o.endMonth)) : [];
  const period = scoped ? months.length ? `${months[0].longLabel} to ${months.at(-1)!.longLabel} (UTC event dates)${months.at(-1)!.key === o.date.slice(0,7) ? ` · current month through ${o.date}` : ''}` : 'No months available in the selected range' : 'Cumulative available records · start date not established';
  const scope = `${o.organisation} · ${cohort}`;
  const covered = (field: 'producedKg' | 'soldKg' | 'incomeZar' | 'expensesZar' | 'trainingPct') => rows.filter(r => r.metrics[field] !== null && Number.isFinite(r.metrics[field])).length;
  const coverage = [
    { label: scoped ? 'Harvest ledger' : 'Harvest weight', available: scoped ? o.monthly.productionFarmers : covered('producedKg'), total: rows.length },
    { label: scoped ? 'Sales ledger' : 'Sales weight', available: scoped ? o.monthly.salesFarmers : covered('soldKg'), total: rows.length },
    { label: 'Sales income', available: scoped ? o.monthly.salesFarmers : covered('incomeZar'), total: rows.length },
    { label: 'Costs', available: covered('expensesZar'), total: rows.length },
    { label: 'Learning progress', available: covered('trainingPct'), total: rows.length },
  ];
  const harvest = scoped ? sum(months.map(m => m.producedKg)) : totals.producedKg;
  const sold = scoped ? sum(months.map(m => m.soldKg)) : totals.soldKg;
  const income = scoped ? sum(months.map(m => m.incomeZar)) : totals.incomeZar;
  const expenses = scoped ? sum(months.map(m => m.expensesZar)) : totals.expensesZar;
  const basis = scoped ? 'Selected months' : 'Cumulative records';
  const resultRows = [
    ['Harvest logged', format(harvest, ' kg'), `${coverage[0].available} / ${rows.length}`, 'Production logs; weighed entries only'],
    ['Produce sold', format(sold, ' kg'), `${coverage[1].available} / ${rows.length}`, 'Sales logs; weighed entries only'],
    ['Sales recorded', money(income), `${coverage[2].available} / ${rows.length}`, 'Sales ledger; not grant expenditure'],
    ['Costs recorded', money(expenses), `${coverage[3].available} / ${rows.length}`, scoped ? 'Dated expense logs; coverage is the current readable book count' : 'Expense ledger; reporting may differ from sales'],
  ];
  const metrics: ReportMetric[] = [
    { label: 'Visible farmers', value: format(rows.length), detail: 'Authorised portfolio; not household reach' },
    ...(o.kind === 'training' ? [
      { label: 'Training completion', value: format(totals.averageTrainingPct, '%'), detail: `${coverage[4].available} of ${rows.length} ${countedNoun(rows.length, 'farmer')} · current snapshot` },
      { label: 'Course completed', value: format(training.reporting ? training.finishedCourse : null), detail: `${training.reporting} readable learning ${countedNoun(training.reporting, 'record')} · current snapshot` },
    ] : [
      { label: 'Harvest logged', value: format(harvest, ' kg'), detail: `${coverage[0].available} of ${rows.length} ${scoped ? 'books readable; known weights only' : countedNoun(rows.length, 'farmer')} · ${basis.toLowerCase()}` },
      { label: 'Sales recorded', value: money(income), detail: `${coverage[2].available} of ${rows.length} ${countedNoun(rows.length, 'farmer')} · ${basis.toLowerCase()}` },
    ]),
    { label: 'Cohorts represented', value: format(totals.cohortCount), detail: 'Current membership snapshot' },
  ];
  const flagged = rows.filter(r => attentionFlags(r).length);
  const unknownActivity = rows.filter(r => r.metrics.daysSinceActivity === null).length;
  const partial = coverage.filter(c => c.available < c.total);
  const title = { overview: o.funder ? 'Funder results report' : 'Programme delivery report', production: 'Production & recorded finances', training: 'Learning & participation' }[o.kind];
  const findings = [
    `${rows.length} ${countedNoun(rows.length, 'farmer')} ${rows.length === 1 ? 'is' : 'are'} visible across ${totals.cohortCount} ${countedNoun(totals.cohortCount, 'cohort')} in this selection. This counts portfolio records, not unique households or indirect beneficiaries.`,
    ...(o.kind !== 'training' ? [`Harvest logged: ${format(harvest, ' kg')}. Sales recorded: ${money(income)}. Basis: ${basis.toLowerCase()}. Each measure has its own coverage; no sales-minus-costs or return-on-investment claim is made.`] : [`Average recorded course completion is ${format(totals.averageTrainingPct, '%')} across ${coverage[4].available} ${countedNoun(coverage[4].available, 'farmer')}. ${training.finishedCourse} of ${training.reporting} readable course ${countedNoun(training.reporting, 'record')} ${training.reporting === 1 ? 'shows' : 'show'} the course completed.`]),
    partial.length ? `${partial.length} of the ${coverage.length} evidence measures ${partial.length === 1 ? 'has' : 'have'} incomplete coverage. Unavailable records are excluded from totals, not counted as zero.` : rows.length ? 'Every measure in the evidence coverage table has a value for every visible farmer. Readable records are not independently verified or necessarily complete.' : 'No farmers are visible in this selection. This does not establish that the programme has no participants.',
    `${flagged.length} ${countedNoun(flagged.length, 'farmer')} ${flagged.length === 1 ? 'has' : 'have'} record-based follow-up flags. Flags identify questions to review, not proof of poor performance.`,
  ];
  const sections: ReportSection[] = [
    { title: 'Executive reading', lines: findings },
    { title: 'Scope & reporting basis', lines: [
      `Organisation / selection: ${scope}. Prepared ${o.date}.`, `Ledger period: ${period}.`,
      'Learning, cohort membership, coverage and follow-up flags are current snapshots; they are not period-specific achievements.',
      `${o.withheldForConsent} enrolled ${countedNoun(o.withheldForConsent, 'farmer')} ${o.withheldForConsent === 1 ? 'is' : 'are'} withheld for consent across the organisation. This count is not allocated to the selected cohort. Other access restrictions may also limit the portfolio.`,
      ...(o.sample ? ['DEMONSTRATION RECORDS: all figures in this report are illustrative and must not be used as evidence of real programme results.'] : []),
    ] },
    { title: o.funder ? 'Questions for the next funding review' : 'Delivery priorities for the next review', lines: [
      ...(partial.length ? [`Review missing evidence for ${partial.map(c => `${c.label.toLowerCase()} (${c.available}/${c.total})`).join(', ')}. Confirm whether gaps reflect consent, access, or incomplete recording; do not pressure farmers to share.`] : ['Check record completeness and supporting evidence with the programme team before using these figures externally.']),
      `${flagged.length} ${countedNoun(flagged.length, 'farmer')} ${flagged.length === 1 ? 'has' : 'have'} follow-up flags; ${unknownActivity} ${unknownActivity === 1 ? 'has' : 'have'} no readable activity date. ${o.funder ? 'Ask the implementing organisation for a consent-respecting support plan.' : 'Use the cohort roster to review flagged records, then agree support actions with the mentor and farmer.'}`,
      'Record an action owner, agreed due date and evidence of completion in Progress & milestones. None is assigned automatically by this report.',
      ...(o.kind !== 'training' ? ['Reconcile sales, harvest dates and expense coverage before drawing livelihood or financial conclusions. Produce picked earlier, purchased stock and missing logs can affect the balance.'] : ['Pair course progress with observed practice and participant feedback before claiming improved skills or adoption.']),
    ] },
    { title: 'What these records can establish', lines: [
      'Production and sales logs describe recorded activity. Course completion describes recorded learning progress. Neither establishes an improvement in household income, diet, food security or resilience.',
      'Baseline, follow-up, agreed targets and a suitable evaluation design are needed to assess change and the programme’s contribution. Those comparisons are not available in this portfolio report.',
      'Grant commitments, disbursements, a programme budget and independently verified expenditure are not available here. Farmer sales and costs are not the organisation’s grant accounts.',
      'No extrapolation is made to farmers whose records are missing. Differences in coverage, crop mix, site size and reporting time prevent a fair ranking of farmers.',
    ] },
    { title: 'Sources & method', references: PROGRAMME_REPORT_SOURCES, lines: [
      'Source: shared production, sales and expense books and course records. These are recorded app data, not an independent audit. Consent and account access determine coverage.',
      'Monthly totals use harvest, sale and expense dates in UTC. Readable empty books contribute zero; unreadable books contribute no value. Only known weights are included; counts and packages are not converted.',
      'Training averages use available course percentages; completions use readable module records. Activity means a log within 90 days, not confirmed farm operation.',
      'OECD and FAO TAPE inform the reporting approach. This is not a TAPE assessment or a statutory annual NPO return. Organisation accounts and governance records remain outside scope.',
    ] },
  ];
  sections[0].summaryLines = [findings[0], findings[1], findings[3]];
  sections[1].summaryLines = [
    sections[1].lines[0], sections[1].lines[1],
    'Learning, membership and coverage are current snapshots. Missing values are unavailable, not zero.',
    sections[1].lines[3], ...(o.sample ? [sections[1].lines[4]] : []),
  ];
  sections[2].summaryLines = sections[2].lines.slice(0,3);
  sections[3].summaryLines = [sections[3].lines[0], sections[3].lines[2]];
  sections[4].summaryLines = [
    'Authorised, consent-projected app records; not independently verified. Monthly ledgers use UTC event dates. Known weight only; no estimated conversions from counts or packages.',
    'Measures can cover different farmers. Learning progress is not demonstrated competence. Baselines and follow-up are needed to assess change. This is programme evidence, not a statutory NPO return.',
  ];
  const cohortGroups = new Map<string, NetworkFarmerSummary[]>();
  for (const row of rows) {
    const key = row.farmer.cohortId ?? '';
    cohortGroups.set(key, [...(cohortGroups.get(key) ?? []), row]);
  }
  const tables: ReportTable[] = [];
  if (o.kind !== 'training') tables.push({ title: 'Recorded results', note: `${basis}. ${scoped ? 'Coverage = current readable books / visible farmers; the number contributing known weights in this period is not available.' : 'Coverage = farmers with an available value / visible farmers.'} Readable books do not guarantee complete records.`, columns: ['Measure', 'Recorded value', 'Coverage', 'Evidence / interpretation'], rows: resultRows });
  if (o.kind !== 'production') tables.push({ title: 'Learning & participation', note: 'Current snapshot. Participation and course progress are outputs, not measured livelihood outcomes.', columns: ['Measure', 'Recorded value', 'Coverage / meaning'], rows: [
    ['Average course completion', format(totals.averageTrainingPct, '%'), `${coverage[4].available} / ${rows.length} ${countedNoun(rows.length, 'farmer')}`],
    ['Course completed', format(training.reporting ? training.finishedCourse : null), `${training.reporting} readable course ${countedNoun(training.reporting, 'record')}`],
    ['Modules completed', format(training.reporting ? training.modulesCompleted : null), 'Module completions; not unique people'],
    ['Activity in last 90 days', format(rows.length > unknownActivity ? totals.activeLast90Days : null), `${rows.length - unknownActivity} ${countedNoun(rows.length - unknownActivity, 'farmer')} with a readable activity date`],
  ] });
  tables.push({ title: 'Evidence coverage', note: `${scoped ? 'Ledger counts describe current readable books, not farmers contributing known weights in the selected period. ' : ''}Current availability, not evidence quality. Unavailable can mean unshared, unreadable, or not recorded.`, columns: ['Evidence', 'Available', 'Unavailable', 'Total visible'], rows: coverage.map(c => [c.label, String(c.available), String(Math.max(0, c.total - c.available)), String(c.total)]) });
  const reviewKinds = new Map<string, number>();
  for (const row of rows) for (const flag of attentionFlags(row)) reviewKinds.set(flag.kind, (reviewKinds.get(flag.kind) ?? 0) + 1);
  const reviewCopy: Record<string, [string, string]> = {
    dormant: ['No recent log', 'Ask whether activity has stopped, recording is delayed, or support is needed.'],
    loss_making: ['Recorded costs exceed sales', 'Review the same dates and complete books; setup spending can precede sales.'],
    stalled_setup: ['Setup record incomplete', 'Check the current site stage with the mentor before agreeing the next practical step.'],
    no_survey: ['Site survey incomplete', 'Offer help completing the survey; keep unknown answers blank.'],
    no_data: ['No production or sales book visible', 'Clarify consent and access with the organisation. Missing permission is not poor performance.'],
    under_plan: ['Plan comparison needs review', 'Check the relevant crop cycle and record coverage before interpreting a gap.'],
  };
  tables.push({ includeInSummary:false, title: o.funder ? 'Follow-up questions' : 'Delivery follow-up', note: 'Current record-based flags. One farmer may appear in more than one row; counts must not be added as unique people. Owners and due dates must be agreed with the team.', columns: ['Review area', 'Farmers flagged', 'Suggested next step'], rows: [...reviewKinds].map(([kind,count]) => [reviewCopy[kind]?.[0] ?? kind, String(count), reviewCopy[kind]?.[1] ?? 'Review the record with the programme team.']) });
  if (!scoped) {
    tables.push({ includeInSummary:false, title: 'Cohort breakdown', note: 'Cumulative records. No individual names, identity numbers or coordinates are included.', columns: ['Cohort', 'Farmers', o.kind === 'training' ? 'Training average' : 'Harvest logged', 'Coverage'], rows: [...cohortGroups.values()].map(group => {
      const t = portfolioTotals(group); const key = o.kind === 'training' ? 'trainingPct' : 'producedKg';
      return [group[0].farmer.cohortName || 'Unassigned cohort', String(group.length), format(o.kind === 'training' ? t.averageTrainingPct : t.producedKg, o.kind === 'training' ? '%' : ' kg'), `${group.filter(r => r.metrics[key] !== null).length} / ${group.length}`];
    }) });
  } else tables.push({ includeInSummary:false, title: 'Monthly ledger', note: 'Organisation-wide event-date totals for the selected months. A zero is no recorded quantity; it does not prove no farming took place.', columns: ['Month (UTC)', 'Harvest kg', 'Sales ZAR', 'Costs ZAR'], rows: months.map(m => [m.longLabel, format(m.producedKg), money(m.incomeZar), money(m.expensesZar)]) });
  const chart: ReportChart = o.kind === 'training' ? {
    title: 'Course progress distribution', note: `${training.reporting} of ${rows.length} ${countedNoun(rows.length, 'farmer')} ${training.reporting === 1 ? 'has' : 'have'} readable course records. Counts are current progress, not demonstrated competence.`, suffix: ' farmers', rows: (training.reporting ? training.bands : []).map(b => ({ label: `${b.done} / ${training.modulesTotal} modules`, value: b.farmers, display: `${b.farmers} ${countedNoun(b.farmers, 'farmer')}` })),
  } : scoped ? { title: 'Harvest logged by month', note: `${o.monthly.productionFarmers} readable harvest books. Known weights only; missing months are omitted, not zero.`, suffix: ' kg', rows: months.flatMap(m => m.producedKg === null ? [] : [{ label: m.longLabel, value: m.producedKg }]) } : {
    title: 'Where harvest is recorded', note: 'Cumulative harvest by cohort. Cohorts differ in size, age and record coverage; these totals are not a performance ranking. Coverage is listed in the tables.', suffix: ' kg', rows: [...cohortGroups.values()].flatMap(group => {
      const value = portfolioTotals(group).producedKg;
      return value === null ? [] : [{ label: group[0].farmer.cohortName || 'Unassigned cohort', value }];
    }),
  };
  return { title, subtitle: o.funder ? 'Recorded results, evidence coverage and questions for the next review.' : 'Delivery evidence, reporting gaps and practical follow-up priorities.', period, scope, sections, metrics, tables, chart, coverage, rows };
}

/** Scope in the filename keeps two reports from different cohorts distinguishable after sharing. */
export function programmeReportFilename(report: Pick<ProgrammeReportModel, 'title' | 'scope' | 'period'>, date: string): string {
  const slug = (value: string) => value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const fullIdentity = slug(`${report.title}-${report.scope}`);
  // Long project names can share their first hundred characters. Keep a compact
  // fingerprint of the complete selection so their downloaded files stay distinct.
  let fingerprint = 2166136261;
  for (const char of `${report.title}\u0000${report.scope}`) fingerprint = Math.imul(fingerprint ^ char.charCodeAt(0), 16777619);
  const identity = fullIdentity.length > 80 ? `${fullIdentity.slice(0, 70).replace(/-$/, '')}-${(fingerprint >>> 0).toString(36)}` : fullIdentity;
  const period = report.period.startsWith('Cumulative') ? 'cumulative' : slug(report.period.split('(')[0]).slice(0,50).replace(/-$/,'');
  return `ImbewuField-${identity || 'programme-report'}-${period || 'no-period'}-${/^\d{4}-\d{2}-\d{2}$/.test(date) ? date : 'undated'}`;
}
