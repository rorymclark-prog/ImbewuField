import { numberLabel, randCentsLabel } from './format-figures';
import { portfolioTotals, attentionFlags, type NetworkFarmerSummary } from './network';
import { cohortTraining } from './cohort-report';
import { inlineTemplate } from './xh-inline';
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
  /** 'xh' reads the isiXhosa drafts for the fixed wording; anything else (or omitted) is the English. */
  language?: string;
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

const format = (n: number | null, unit = '', unavailable = 'Not available') => n === null || !Number.isFinite(n) ? unavailable : `${numberLabel(n,2)}${unit}`;
const money = (n: number | null, unavailable = 'Not available') => n === null || !Number.isFinite(n) ? unavailable : randCentsLabel(n);
const sum = (values: (number | null)[]) => {
  const known = values.filter((v): v is number => v !== null && Number.isFinite(v));
  return known.length ? Math.round(known.reduce((a, b) => a + b, 0) * 100) / 100 : null;
};

/** Snapshot metrics have no event dates. Only the server's dated ledger can answer a period query;
 * a cohort filter must never relabel organisation-wide monthly totals as that cohort's results.
 * `o.language` only changes the fixed wording: 'xh' reads the isiXhosa drafts keyed by each English
 * string (lib/locales/xh-inline/g18-programme-report-body.ts, g16-programme-reports.ts); every other
 * value (names, numbers, dates) is data and stays as recorded, and any other language is English. */
export function buildProgrammeReport(o: ProgrammeReportOptions): ProgrammeReportModel {
  const lang = o.language ?? 'en';
  /** A fixed sentence or label; `{name}` placeholders take the recorded values. */
  const t = (english: string, vars: Record<string, string | number> = {}) => inlineTemplate(lang, english, null, vars);
  const notAvailable = t('Not available');
  const fmt = (n: number | null, unit = '') => format(n, unit, notAvailable);
  const rand = (n: number | null) => money(n, notAvailable);
  const rows = o.cohortId ? o.rows.filter(r => r.farmer.cohortId === o.cohortId) : o.rows;
  const totals = portfolioTotals(rows);
  const training = cohortTraining(rows);
  const cohort = o.cohortId ? rows[0]?.farmer.cohortName || t('Selected cohort') : t('All visible cohorts');
  const unassigned = t('Unassigned cohort');
  const scoped = o.basis === 'window' && !o.cohortId;
  const months = scoped ? o.monthly.months.filter(m => (!o.startMonth || m.key >= o.startMonth) && (!o.endMonth || m.key <= o.endMonth)) : [];
  const period = scoped
    ? months.length
      ? (() => {
        const span = t('{from} to {to} (UTC event dates)', { from: months[0].longLabel, to: months.at(-1)!.longLabel });
        return months.at(-1)!.key === o.date.slice(0,7) ? t('{period} · current month through {date}', { period: span, date: o.date }) : span;
      })()
      : t('No months available in the selected range')
    : t('Cumulative available records · start date not established');
  const scope = `${o.organisation} · ${cohort}`;
  const covered = (field: 'producedKg' | 'soldKg' | 'incomeZar' | 'expensesZar' | 'trainingPct') => rows.filter(r => r.metrics[field] !== null && Number.isFinite(r.metrics[field])).length;
  const coverage = [
    { label: scoped ? t('Harvest ledger') : t('Harvest weight'), available: scoped ? o.monthly.productionFarmers : covered('producedKg'), total: rows.length },
    { label: scoped ? t('Sales ledger') : t('Sales weight'), available: scoped ? o.monthly.salesFarmers : covered('soldKg'), total: rows.length },
    { label: t('Sales income'), available: scoped ? o.monthly.salesFarmers : covered('incomeZar'), total: rows.length },
    { label: t('Costs'), available: covered('expensesZar'), total: rows.length },
    { label: t('Learning progress'), available: covered('trainingPct'), total: rows.length },
  ];
  const harvest = scoped ? sum(months.map(m => m.producedKg)) : totals.producedKg;
  const sold = scoped ? sum(months.map(m => m.soldKg)) : totals.soldKg;
  const income = scoped ? sum(months.map(m => m.incomeZar)) : totals.incomeZar;
  const expenses = scoped ? sum(months.map(m => m.expensesZar)) : totals.expensesZar;
  const basis = scoped ? t('Selected months') : t('Cumulative records');
  const one = rows.length === 1;
  /** "{a} of {n} farmer(s) · <tail>" — the same shapes lib/programme-report-pdf.ts matches for earlier-built metrics. */
  const farmersOf = (tail: 'snapshot' | 'cumulative' | 'months', a: number) => {
    const vars = { a, n: rows.length };
    if (tail === 'snapshot') return one ? t('{a} of {n} farmer · current snapshot', vars) : t('{a} of {n} farmers · current snapshot', vars);
    if (tail === 'cumulative') return one ? t('{a} of {n} farmer · cumulative records', vars) : t('{a} of {n} farmers · cumulative records', vars);
    return one ? t('{a} of {n} farmer · selected months', vars) : t('{a} of {n} farmers · selected months', vars);
  };
  const resultRows = [
    [t('Harvest logged'), fmt(harvest, ' kg'), `${coverage[0].available} / ${rows.length}`, t('Production logs; weighed entries only')],
    [t('Produce sold'), fmt(sold, ' kg'), `${coverage[1].available} / ${rows.length}`, t('Sales logs; weighed entries only')],
    [t('Sales recorded'), rand(income), `${coverage[2].available} / ${rows.length}`, t('Sales ledger; not grant expenditure')],
    [t('Costs recorded'), rand(expenses), `${coverage[3].available} / ${rows.length}`, scoped ? t('Dated expense logs; coverage is the current readable book count') : t('Expense ledger; reporting may differ from sales')],
  ];
  const harvestDetail = scoped
    ? t('{a} of {n} books readable; known weights only · selected months', { a: coverage[0].available, n: rows.length })
    : farmersOf('cumulative', coverage[0].available);
  const salesDetail = farmersOf(scoped ? 'months' : 'cumulative', coverage[2].available);
  const metrics: ReportMetric[] = [
    { label: t('Visible farmers'), value: fmt(rows.length), detail: t('Authorised portfolio; not household reach') },
    ...(o.kind === 'training' ? [
      { label: t('Training completion'), value: fmt(totals.averageTrainingPct, '%'), detail: farmersOf('snapshot', coverage[4].available) },
      { label: t('Course completed'), value: fmt(training.reporting ? training.finishedCourse : null), detail: training.reporting === 1 ? t('{a} readable learning record · current snapshot', { a: training.reporting }) : t('{a} readable learning records · current snapshot', { a: training.reporting }) },
    ] : [
      { label: t('Harvest logged'), value: fmt(harvest, ' kg'), detail: harvestDetail },
      { label: t('Sales recorded'), value: rand(income), detail: salesDetail },
    ]),
    { label: t('Cohorts represented'), value: fmt(totals.cohortCount), detail: t('Current membership snapshot') },
  ];
  const flagged = rows.filter(r => attentionFlags(r).length);
  const unknownActivity = rows.filter(r => r.metrics.daysSinceActivity === null).length;
  const partial = coverage.filter(c => c.available < c.total);
  const title = { overview: o.funder ? t('Funder results report') : t('Programme delivery report'), production: t('Production & recorded finances'), training: t('Learning & participation') }[o.kind];
  const cohortOne = totals.cohortCount === 1;
  const visibleVars = { n: rows.length, c: totals.cohortCount };
  const visibleHead = one
    ? cohortOne ? t('{n} farmer is visible across {c} cohort in this selection.', visibleVars) : t('{n} farmer is visible across {c} cohorts in this selection.', visibleVars)
    : cohortOne ? t('{n} farmers are visible across {c} cohort in this selection.', visibleVars) : t('{n} farmers are visible across {c} cohorts in this selection.', visibleVars);
  const reportingOne = training.reporting === 1;
  const trainingAvailable = coverage[4].available;
  const partialVars = { n: partial.length, total: coverage.length };
  const flaggedVars = { n: flagged.length };
  const findings = [
    `${visibleHead} ${t('This counts portfolio records, not unique households or indirect beneficiaries.')}`,
    ...(o.kind !== 'training'
      ? [t('Harvest logged: {harvest}. Sales recorded: {sales}. Basis: {basis}. Each measure has its own coverage; no sales-minus-costs or return-on-investment claim is made.', { harvest: fmt(harvest, ' kg'), sales: rand(income), basis: basis.toLowerCase() })]
      : [`${trainingAvailable === 1
        ? t('Average recorded course completion is {value} across {n} farmer.', { value: fmt(totals.averageTrainingPct, '%'), n: trainingAvailable })
        : t('Average recorded course completion is {value} across {n} farmers.', { value: fmt(totals.averageTrainingPct, '%'), n: trainingAvailable })} ${reportingOne
        ? t('{done} of {n} readable course record shows the course completed.', { done: training.finishedCourse, n: training.reporting })
        : t('{done} of {n} readable course records show the course completed.', { done: training.finishedCourse, n: training.reporting })}`]),
    partial.length
      ? `${partial.length === 1 ? t('{n} of the {total} evidence measures has incomplete coverage.', partialVars) : t('{n} of the {total} evidence measures have incomplete coverage.', partialVars)} ${t('Unavailable records are excluded from totals, not counted as zero.')}`
      : rows.length ? t('Every measure in the evidence coverage table has a value for every visible farmer. Readable records are not independently verified or necessarily complete.') : t('No farmers are visible in this selection. This does not establish that the programme has no participants.'),
    `${flagged.length === 1 ? t('{n} farmer has record-based follow-up flags.', flaggedVars) : t('{n} farmers have record-based follow-up flags.', flaggedVars)} ${t('Flags identify questions to review, not proof of poor performance.')}`,
  ];
  const withheldVars = { n: o.withheldForConsent };
  const followVars = { n: flagged.length, u: unknownActivity };
  const followHead = flagged.length === 1
    ? unknownActivity === 1 ? t('{n} farmer has follow-up flags; {u} has no readable activity date.', followVars) : t('{n} farmer has follow-up flags; {u} have no readable activity date.', followVars)
    : unknownActivity === 1 ? t('{n} farmers have follow-up flags; {u} has no readable activity date.', followVars) : t('{n} farmers have follow-up flags; {u} have no readable activity date.', followVars);
  const sections: ReportSection[] = [
    { title: t('Executive reading'), lines: findings },
    { title: t('Scope & reporting basis'), lines: [
      t('Organisation / selection: {scope}. Prepared {date}.', { scope, date: o.date }), t('Ledger period: {period}.', { period }),
      t('Learning, cohort membership, coverage and follow-up flags are current snapshots; they are not period-specific achievements.'),
      `${o.withheldForConsent === 1 ? t('{n} enrolled farmer is withheld for consent across the organisation.', withheldVars) : t('{n} enrolled farmers are withheld for consent across the organisation.', withheldVars)} ${t('This count is not allocated to the selected cohort. Other access restrictions may also limit the portfolio.')}`,
      ...(o.sample ? [t('DEMONSTRATION RECORDS: all figures in this report are illustrative and must not be used as evidence of real programme results.')] : []),
    ] },
    { title: o.funder ? t('Questions for the next funding review') : t('Delivery priorities for the next review'), lines: [
      ...(partial.length ? [t('Review missing evidence for {list}. Confirm whether gaps reflect consent, access, or incomplete recording; do not pressure farmers to share.', { list: partial.map(c => `${c.label.toLowerCase()} (${c.available}/${c.total})`).join(', ') })] : [t('Check record completeness and supporting evidence with the programme team before using these figures externally.')]),
      `${followHead} ${o.funder ? t('Ask the implementing organisation for a consent-respecting support plan.') : t('Use the cohort roster to review flagged records, then agree support actions with the mentor and farmer.')}`,
      t('Record an action owner, agreed due date and evidence of completion in Progress & milestones. None is assigned automatically by this report.'),
      ...(o.kind !== 'training' ? [t('Reconcile sales, harvest dates and expense coverage before drawing livelihood or financial conclusions. Produce picked earlier, purchased stock and missing logs can affect the balance.')] : [t('Pair course progress with observed practice and participant feedback before claiming improved skills or adoption.')]),
    ] },
    { title: t('What these records can establish'), lines: [
      t('Production and sales logs describe recorded activity. Course completion describes recorded learning progress. Neither establishes an improvement in household income, diet, food security or resilience.'),
      t('Baseline, follow-up, agreed targets and a suitable evaluation design are needed to assess change and the programme’s contribution. Those comparisons are not available in this portfolio report.'),
      t('Grant commitments, disbursements, a programme budget and independently verified expenditure are not available here. Farmer sales and costs are not the organisation’s grant accounts.'),
      t('No extrapolation is made to farmers whose records are missing. Differences in coverage, crop mix, site size and reporting time prevent a fair ranking of farmers.'),
    ] },
    { title: t('Sources & method'), references: PROGRAMME_REPORT_SOURCES, lines: [
      t('Source: shared production, sales and expense books and course records. These are recorded app data, not an independent audit. Consent and account access determine coverage.'),
      t('Monthly totals use harvest, sale and expense dates in UTC. Readable empty books contribute zero; unreadable books contribute no value. Only known weights are included; counts and packages are not converted.'),
      t('Training averages use available course percentages; completions use readable module records. Activity means a log within 90 days, not confirmed farm operation.'),
      t('OECD and FAO TAPE inform the reporting approach. This is not a TAPE assessment or a statutory annual NPO return. Organisation accounts and governance records remain outside scope.'),
    ] },
  ];
  sections[0].summaryLines = [findings[0], findings[1], findings[3]];
  sections[1].summaryLines = [
    sections[1].lines[0], sections[1].lines[1],
    t('Learning, membership and coverage are current snapshots. Missing values are unavailable, not zero.'),
    sections[1].lines[3], ...(o.sample ? [sections[1].lines[4]] : []),
  ];
  sections[2].summaryLines = sections[2].lines.slice(0,3);
  sections[3].summaryLines = [sections[3].lines[0], sections[3].lines[2]];
  sections[4].summaryLines = [
    t('Authorised, consent-projected app records; not independently verified. Monthly ledgers use UTC event dates. Known weight only; no estimated conversions from counts or packages.'),
    t('Measures can cover different farmers. Learning progress is not demonstrated competence. Baselines and follow-up are needed to assess change. This is programme evidence, not a statutory NPO return.'),
  ];
  const cohortGroups = new Map<string, NetworkFarmerSummary[]>();
  for (const row of rows) {
    const key = row.farmer.cohortId ?? '';
    cohortGroups.set(key, [...(cohortGroups.get(key) ?? []), row]);
  }
  const tables: ReportTable[] = [];
  if (o.kind !== 'training') tables.push({ title: t('Recorded results'), note: `${basis}. ${scoped ? t('Coverage = current readable books / visible farmers; the number contributing known weights in this period is not available.') : t('Coverage = farmers with an available value / visible farmers.')} ${t('Readable books do not guarantee complete records.')}`, columns: [t('Measure'), t('Recorded value'), t('Coverage'), t('Evidence / interpretation')], rows: resultRows });
  if (o.kind !== 'production') {
    const activityKnown = rows.length - unknownActivity;
    tables.push({ title: t('Learning & participation'), note: t('Current snapshot. Participation and course progress are outputs, not measured livelihood outcomes.'), columns: [t('Measure'), t('Recorded value'), t('Coverage / meaning')], rows: [
      [t('Average course completion'), fmt(totals.averageTrainingPct, '%'), one ? t('{a} / {n} farmer', { a: coverage[4].available, n: rows.length }) : t('{a} / {n} farmers', { a: coverage[4].available, n: rows.length })],
      [t('Course completed'), fmt(training.reporting ? training.finishedCourse : null), reportingOne ? t('{n} readable course record', { n: training.reporting }) : t('{n} readable course records', { n: training.reporting })],
      [t('Modules completed'), fmt(training.reporting ? training.modulesCompleted : null), t('Module completions; not unique people')],
      [t('Activity in last 90 days'), fmt(rows.length > unknownActivity ? totals.activeLast90Days : null), activityKnown === 1 ? t('{n} farmer with a readable activity date', { n: activityKnown }) : t('{n} farmers with a readable activity date', { n: activityKnown })],
    ] });
  }
  tables.push({ title: t('Evidence coverage'), note: `${scoped ? `${t('Ledger counts describe current readable books, not farmers contributing known weights in the selected period.')} ` : ''}${t('Current availability, not evidence quality. Unavailable can mean unshared, unreadable, or not recorded.')}`, columns: [t('Evidence'), t('Available'), t('Unavailable'), t('Total visible')], rows: coverage.map(c => [c.label, String(c.available), String(Math.max(0, c.total - c.available)), String(c.total)]) });
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
  tables.push({ includeInSummary:false, title: o.funder ? t('Follow-up questions') : t('Delivery follow-up'), note: t('Current record-based flags. One farmer may appear in more than one row; counts must not be added as unique people. Owners and due dates must be agreed with the team.'), columns: [t('Review area'), t('Farmers flagged'), t('Suggested next step')], rows: [...reviewKinds].map(([kind,count]) => [reviewCopy[kind] ? t(reviewCopy[kind][0]) : kind, String(count), reviewCopy[kind] ? t(reviewCopy[kind][1]) : t('Review the record with the programme team.')]) });
  if (!scoped) {
    tables.push({ includeInSummary:false, title: t('Cohort breakdown'), note: t('Cumulative records. No individual names, identity numbers or coordinates are included.'), columns: [t('Cohort'), t('Farmers'), o.kind === 'training' ? t('Training average') : t('Harvest logged'), t('Coverage')], rows: [...cohortGroups.values()].map(group => {
      const tot = portfolioTotals(group); const key = o.kind === 'training' ? 'trainingPct' : 'producedKg';
      return [group[0].farmer.cohortName || unassigned, String(group.length), fmt(o.kind === 'training' ? tot.averageTrainingPct : tot.producedKg, o.kind === 'training' ? '%' : ' kg'), `${group.filter(r => r.metrics[key] !== null).length} / ${group.length}`];
    }) });
  } else tables.push({ includeInSummary:false, title: t('Monthly ledger'), note: t('Organisation-wide event-date totals for the selected months. A zero is no recorded quantity; it does not prove no farming took place.'), columns: [t('Month (UTC)'), t('Harvest kg'), t('Sales ZAR'), t('Costs ZAR')], rows: months.map(m => [m.longLabel, fmt(m.producedKg), rand(m.incomeZar), rand(m.expensesZar)]) });
  const chartCountVars = { a: training.reporting, n: rows.length };
  const chartHead = reportingOne
    ? one ? t('{a} of {n} farmer has readable course records.', chartCountVars) : t('{a} of {n} farmers has readable course records.', chartCountVars)
    : one ? t('{a} of {n} farmer have readable course records.', chartCountVars) : t('{a} of {n} farmers have readable course records.', chartCountVars);
  const chart: ReportChart = o.kind === 'training' ? {
    title: t('Course progress distribution'), note: `${chartHead} ${t('Counts are current progress, not demonstrated competence.')}`, suffix: ` ${t('farmers')}`, rows: (training.reporting ? training.bands : []).map(b => ({ label: t('{done} / {total} modules', { done: b.done, total: training.modulesTotal }), value: b.farmers, display: b.farmers === 1 ? t('{n} farmer', { n: b.farmers }) : t('{n} farmers', { n: b.farmers }) })),
  } : scoped ? { title: t('Harvest logged by month'), note: `${t('{n} readable harvest books.', { n: o.monthly.productionFarmers })} ${t('Known weights only; missing months are omitted, not zero.')}`, suffix: ' kg', rows: months.flatMap(m => m.producedKg === null ? [] : [{ label: m.longLabel, value: m.producedKg }]) } : {
    title: t('Where harvest is recorded'), note: t('Cumulative harvest by cohort. Cohorts differ in size, age and record coverage; these totals are not a performance ranking. Coverage is listed in the tables.'), suffix: ' kg', rows: [...cohortGroups.values()].flatMap(group => {
      const value = portfolioTotals(group).producedKg;
      return value === null ? [] : [{ label: group[0].farmer.cohortName || unassigned, value }];
    }),
  };
  return { title, subtitle: o.funder ? t('Recorded results, evidence coverage and questions for the next review.') : t('Delivery evidence, reporting gaps and practical follow-up priorities.'), period, scope, sections, metrics, tables, chart, coverage, rows };
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
