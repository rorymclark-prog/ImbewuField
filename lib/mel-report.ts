import { compatibleMelStages, type MelAssessment, type MelMetric, type MelComparisonMetric, type MelStage } from './mel';
import { milestoneAt, validEvidenceDate, type ProgrammeMilestone } from './programme-evidence';
import { progressValue } from './programme-progress';
import { programmeReportFilename } from './programme-report';
import { numberLabel } from './format-figures';
import { inlineText, inlineTemplate } from './xh-inline';
import type { ReportMetric, ReportSection, ReportTable } from './programme-report-pdf';

export type MelReportAssessment = Pick<MelAssessment, 'id' | 'title' | 'project' | 'stage' | 'published' | 'due' | 'updatedAt'> & { version?: number; state?: MelAssessment['state']; assigned: number; completed: number; metrics?: MelMetric[]; action?: string; actionOwner?: string; actionDue?: string; actionDone?: boolean };
export type MelReportAnalysis = { assessmentId: string; beforeId: string; metrics: MelMetric[]; assigned: number; completed: number; comparison: MelComparisonMetric[] | null; notes?: string[] };
export type MelReportOptions = {
  organisation: string; project: string; funder: boolean; sample: boolean; today: string; asOf: string;
  assessments: MelReportAssessment[]; milestones: ProgrammeMilestone[]; assessmentSource: boolean; milestoneSource: boolean;
  selectedId: string; beforeId: string; analysis: MelReportAnalysis | null; sourceNotes?: string[];
  comparisonAsOf?: string; donorName?: string; donorReference?: 'none' | 'sef';
  /** 'xh' reads the isiXhosa drafts (lib/locales/xh-inline/g45-mel-report.ts) for the fixed wording; any other value is the English report, byte for byte. Names, figures, units, dates and recorded evidence stay as recorded. */
  language?: string;
};
export const SEF_REPORTING_SOURCE = 'https://www-idc-co-za.b-cdn.net/wp-content/uploads/2025/05/Terms-of-Reference-Strategic-Implementing-Partners-Open-Call-2025.pdf';
export const MEL_STAGE_LABELS: Record<MelStage, string> = { baseline: 'Project baseline', course_before: 'Before training', course_after: 'After training', midpoint: 'Project midpoint', closeout: 'Project closeout', app_midpoint: 'App feedback · midpoint', app_closeout: 'App feedback · closeout' };

export function buildMelEvidenceReport(options: MelReportOptions) {
  const { project, asOf, today, funder } = options;
  if(!validEvidenceDate(asOf) || asOf>today || options.comparisonAsOf && (!validEvidenceDate(options.comparisonAsOf) || options.comparisonAsOf>=asOf)) throw Error('Choose valid milestone cutoffs in order, ending today or earlier.');
  const lang = options.language ?? 'en';
  /** A fixed sentence or label in the reader's language; `{name}` placeholders take the recorded values. English (and every language but isiXhosa) is the original text, byte for byte. */
  const t = (english: string, vars: Record<string, string | number> = {}) => inlineTemplate(lang, english, null, vars);
  const english = (text: string, vars: Record<string, string | number> = {}) => inlineTemplate('en', text, null, vars);
  /** A fixed word from the data (a stage, a status, a survey question or answer option): its isiXhosa draft, else as given. */
  const tr = (text: string) => inlineText(lang, text);
  const notAvailable = t('Not available');
  const numeric = (value: number | null | undefined) => value === null || value === undefined || !Number.isFinite(value) ? notAvailable : numberLabel(value, 2);
  const pv = (value: number | null, unit = '') => value === null ? t('Not reported') : progressValue(value, unit);
  // The default wording milestoneAt writes when no observation exists; a recorded evidence note stays as typed.
  const evidenceText = (text: string) => text === 'No observation by this date' ? t('No observation by this date') : text;
  const assessments = options.assessments.filter(assessment => (!project || assessment.project === project) && (!funder || assessment.published));
  const milestones = options.milestones.filter(milestone => (!project || milestone.project === project) && (!funder || milestone.published) && (!options.donorName || milestone.donor?.funder === options.donorName));
  const selected = assessments.find(assessment => assessment.id === options.selectedId);
  const before = assessments.find(assessment => assessment.id === options.beforeId);
  // A slow response for the preceding selection cannot label another assessment's numbers.
  const analysis = selected && options.analysis?.assessmentId === selected.id && options.analysis.beforeId === options.beforeId ? options.analysis : null;
  const comparison = before && selected && before.project === selected.project && typeof before.version === 'number' && before.version === selected.version && compatibleMelStages(before.stage, selected.stage) ? analysis?.comparison ?? null : null;
  const sourceNotes = [...new Set([...(options.sourceNotes || []), ...(analysis?.notes || [])])];
  const title = funder ? t('Published MEL evidence report') : t('Programme MEL evidence report');
  const scopeIn = (say: (text: string, vars?: Record<string, string | number>) => string) => `${options.organisation} · ${project || say('All visible projects')}${options.donorName ? ` · ${say('indicator donor: {name}', { name: options.donorName })}` : ''}`;
  const scope = scopeIn(t);
  const metrics: ReportMetric[] = [
    { label: t('Agreed indicators'), value: options.milestoneSource ? String(milestones.length) : notAvailable, detail: t('Visible milestone definitions; not an impact score') },
    { label: t('Indicators with observations'), value: options.milestoneSource ? String(milestones.filter(milestone => milestoneAt(milestone, asOf).actual !== null).length) : notAvailable, detail: t('Latest dated evidence on or before {date}', { date: asOf }) },
    { label: t('Assessment responses'), value: !options.assessmentSource ? notAvailable : !selected ? t('Not selected') : analysis ? `${analysis.completed} / ${analysis.assigned}` : notAvailable, detail: selected ? t('{title} · current response snapshot', { title: selected.title }) : t('Choose one assessment below') },
    { label: t('Matched measures'), value: comparison ? String(comparison.filter(metric => !metric.suppressed && (metric.n ?? 0) > 0).length) : t('Not selected'), detail: t('Each measure has its own matched denominator') },
  ];
  const tables: ReportTable[] = [
    { title: t('Agreed indicators & dated evidence'), note: t('Latest observations dated on or before {date}, using the latest corrected records. This is not a reconstruction of what had been entered then. Baselines, targets and methods are shown as recorded.', { date: asOf }), columns: [t('Indicator'), t('Baseline / target'), t('Latest observation'), t('Review / status'), t('Evidence / method')], columnWeights: [1.5, 1.1, 1.1, 1.2, 2.1], rows: milestones.map(milestone => {
      const result = milestoneAt(milestone, asOf);
      return [`${milestone.title} · ${milestone.project}`, t('Baseline: {baseline}; target: {target}', { baseline: pv(milestone.baseline, milestone.unit), target: pv(milestone.target, milestone.unit) }), `${pv(result.actual, milestone.unit)} · ${result.observedOn || t('No dated observation')}`, `${milestone.due} · ${tr(result.status)}`, t('{evidence} Method: {method}', { evidence: evidenceText(result.evidence), method: milestone.method })];
    }) },
    { title: t('Assessment coverage'), note: options.assessmentSource ? t('Response counts belong to each assessment. A person can respond at several stages; these rows cannot be added as unique people. Due dates are deadlines, not response-collection dates.') : t('The assessment source is unavailable. An empty table does not mean that no assessments exist.'), columns: [t('Assessment / project'), t('Stage'), t('Responses / assigned'), t('State / sharing'), t('Due / updated')], columnWeights: [1.8, 1.2, 1.1, 1.2, 1.4], rows: assessments.map(assessment => [`${assessment.title} · ${assessment.project}`, tr(MEL_STAGE_LABELS[assessment.stage]), `${assessment.completed} / ${assessment.assigned}`, `${assessment.state ? tr(assessment.state) : t('State not included')} · ${assessment.published ? tr('published') : tr('internal')}`, t('Due {due}; updated {updated}', { due: assessment.due, updated: assessment.updatedAt.slice(0, 10) })]) },
    { title: t('Selected assessment findings'), note: selected ? t('{title} · {stage}. Answers remain self-reported. Missing counts here are among submitted responses; assessment coverage above also shows people who have not responded. {state}', { title: selected.title, stage: tr(MEL_STAGE_LABELS[selected.stage]), state: !selected.state ? t('Assessment state is not included in this source; refresh before treating results as final.') : selected.state !== 'closed' ? t('This assessment is still open or draft; findings are provisional.') : '' }) : t('Choose an assessment to include its findings. No assessment is selected.'), columns: [t('Question'), t('Recorded finding'), t('Answered / responses'), t('No answer among responses')], columnWeights: [2, 2.4, 1.1, 1.1], rows: (analysis?.metrics || []).map(metric => [tr(metric.en), metric.suppressed ? t('Withheld to protect a small group') : metric.mean !== undefined ? t('Mean recorded answer: {mean}', { mean: numeric(metric.mean) }) : metric.choices?.filter(choice => choice.count > 0).map(choice => `${tr(choice.en)}: ${choice.count}`).join('; ') || t('No recorded answer'), metric.suppressed ? t('Withheld') : `${metric.n} / ${analysis!.completed}`, metric.suppressed ? t('Withheld') : String(metric.missing)]) },
    { title: t('Matched baseline & follow-up'), keepAllRowsInSummary: true, note: before && selected ? t('{before} → {after}. Only valid answers from the same consenting participant IDs contribute to each change. Before/after means use that matched set. Unmatched counts describe valid answers excluded from that measure. This does not establish programme causation.', { before: before.title, after: selected.title }) : t('Choose a compatible earlier assessment to include matched change. A difference between separate group averages is not substituted.'), columns: [t('Measure'), t('Matched means · before / after'), t('Mean change'), t('Matched answers'), t('Unmatched valid answers · before / after')], columnWeights: [2.2, 1.3, .9, .9, 1.4], rows: (comparison || []).map(metric => [tr(metric.en) + (metric.score && !metric.en.includes('self-reported score') ? ` · ${t('self-reported score')}` : ''), metric.suppressed ? t('Withheld') : `${numeric(metric.beforeMean)} / ${numeric(metric.afterMean)}`, metric.suppressed ? t('Withheld') : metric.n ? `${metric.change! > 0 ? '+' : ''}${numeric(metric.change)}` : t('No matched answers'), metric.suppressed ? t('Withheld') : String(metric.n), metric.suppressed ? t('Withheld') : `${(metric.beforeN ?? 0) - (metric.n ?? 0)} / ${(metric.afterN ?? 0) - (metric.n ?? 0)}`]) },
  ];
  if (options.comparisonAsOf) {
    const earlier = options.comparisonAsOf;
    if (earlier >= asOf) throw Error('Choose an earlier milestone comparison date.');
    tables.unshift({ title: t('Historical milestone comparison'), keepAllRowsInSummary: true,
      note: t('Cutoffs {earlier} → {date}. Uses the latest corrected observation histories and current definitions, targets and sharing permissions. These are readings by each cutoff, not a reconstruction of past access or records. A carried-forward reading is not evidence of no activity.', { earlier, date: asOf }),
      columns: [t('Indicator / basis'), t('Earlier reading'), t('Selected reading'), t('Difference / interpretation')], columnWeights:[1.6,1,1,1.8], rows:milestones.map(m=>{
        const b=milestoneAt(m,earlier), a=milestoneAt(m,asOf), d=m.donor;
        const withinPeriod=!d || b.observedOn! >= d.periodStart && a.observedOn! <= d.periodEnd;
        const comparable=b.actual!==null && a.actual!==null && b.observedOn!==a.observedOn && withinPeriod;
        const interpretation=d?.basis==='cumulative' ? t('Change in recorded cumulative total; corrections may change it.') : d?.basis==='period' ? t('Difference between separately defined period totals; check period lengths and scope.') : t('Difference in readings; not output during the interval.');
        const difference=b.actual===null || a.actual===null ? t('No observation at one cutoff; change withheld.') : !withinPeriod ? t('Outside the agreed measurement period; change withheld.') : b.observedOn===a.observedOn ? t('No new dated observation; change withheld.') : interpretation;
        return [`${m.title}${d?` · ${d.code} · ${tr(d.basis)}`:''}`,`${pv(b.actual,m.unit)} · ${b.observedOn || t('unreported')}`,`${pv(a.actual,m.unit)} · ${a.observedOn || t('unreported')}`,`${comparable?`${a.actual!-b.actual!>0?'+':''}${pv(a.actual!-b.actual!,m.unit)}. `:''}${difference}`];
      }) });
  }
  const linked = milestones.filter(m=>m.donor);
  if(linked.length || options.donorName) {
    tables.unshift({title:t('Donor indicator agreement'),keepAllRowsInSummary:true,
      note:options.milestoneSource?t('Programme-entered commitments, not donor certification. Each row retains its own measurement period and population. Donor filters apply to milestones only; assessment findings retain their selected project scope.'):t('Milestone source unavailable; no donor reporting completeness is inferred.'),
      columns:[t('Donor / agreement / code'),t('Indicator / measurement period'),t('Definition of population'),t('Disaggregation / frequency')],columnWeights:[1.3,1.4,1.7,1.7],rows:linked.map(m=>{const d=m.donor!;return [`${d.funder} · ${d.agreement} · ${d.code}`,t('{title} · {start} to {end} · {basis}',{title:m.title,start:d.periodStart,end:d.periodEnd,basis:tr(d.basis)}),d.population,t('{disaggregation} Frequency: {frequency}',{disaggregation:d.disaggregation,frequency:d.frequency})];})});
    tables.splice(1,0,{title:t('Donor results & evidence checks'),keepAllRowsInSummary:true,note:t('No results are inferred from an indicator code. A dated result must fall inside its agreed measurement period. Baselines, targets and methods require review against the agreement; this table is not a compliance score.'),columns:[t('Indicator code / project'),t('Baseline / target'),t('Dated result'),t('Evidence / measurement checks')],columnWeights:[1.2,1,1.2,2.5],rows:linked.map(m=>{const d=m.donor!,v=milestoneAt({...m,observations:m.observations.filter(o=>o.date>=d.periodStart&&o.date<=d.periodEnd)},asOf),inside=v.observedOn && v.observedOn>=d.periodStart && v.observedOn<=d.periodEnd;return [`${d.code} · ${m.project}`,`${pv(m.baseline,m.unit)} / ${pv(m.target,m.unit)}`,inside?`${pv(v.actual,m.unit)} · ${v.observedOn}`:t('No observation in the agreed period'),`${t('{evidence} Method: {method}',{evidence:inside?evidenceText(v.evidence):t('Check the measurement dates and collect period evidence.'),method:m.method})} ${m.baseline===null?`${t('Baseline missing.')} `:''}${m.target===null?`${t('Target not entered.')} `:''}`];})});
  }
  if(options.donorReference==='sef') tables.push({title:t('IDC / SEF reporting reference'),keepAllRowsInSummary:true,note:t('Public May 2025 call, sections 7.1–7.2. Check the signed agreement and current instructions. This planning reference does not establish eligibility, approval or submission readiness.'),columns:[t('Reporting area'),t('Evidence to review / obtain')],rows:[
    [t('Delivery and learning'),t('Review agreed outcomes, implementation narrative, risks, mitigation and lessons.')],
    [t('Programme finances'),t('Obtain verified actual and forecast spending by budget category. Farmer sales and costs cannot substitute.')],
    [t('Employment'),t('Use the designated employment/payment system and authorised demographic/financial summaries. Visits and class attendance are separate.')],
    [t('Common-good contribution'),t('Agree context-specific indicators, baselines and methods; link their codes to the programme register.')],
    [t('Organisation capacity'),t('Agree inception indicators with partners and retain supporting evidence.')],
    [t('Participant capabilities'),t('Use the agreed measures and IDC survey process; app self-reports do not replace it.')],
  ]});
  if (!funder) tables.push({ title: t('Recorded learning actions'), note: t('Actions are current assessment records, with owners and dates only where entered. Completion is the recorded status; supporting evidence must be checked separately.'), columns: [t('Assessment'), t('Agreed change / action'), t('Owner / review date'), t('Status')], rows: assessments.filter(assessment => assessment.action?.trim()).map(assessment => [assessment.title, assessment.action!, `${assessment.actionOwner || t('Owner needed')} · ${assessment.actionDue || t('Date needed')}`, assessment.actionDone ? t('Recorded complete') : t('Open')]) });
  tables.push({ title: t('Wider MEL evidence to agree'), note: t('A planning crosswalk informed by FAO and OECD. These are evidence requirements and possible app sources, not measured results, a complete donor framework or a TAPE assessment.'), columns: [t('Review area'), t('Possible existing evidence'), t('Further measurement needed')], rows: [
    [t('Production & productivity'), t('Harvest records; dated growing-area checks'), t('Match crop cycles, growing area, units and dates before reporting yield per area.')],
    [t('Income & value added'), t('Sales, expenses and reported 30-day crop receipts'), t('Comparable full costs, household income and valuation methods; sales are revenue.')],
    [t('Food access & dietary diversity'), t('Reported days eating garden food in the last seven days'), t('An appropriate food-access or dietary instrument; garden harvest is not a validated food-security result.')],
    [t('Water & resilience'), t('Reported 30-day water reliability; dated storage and collection milestones'), t('Measured use and comparable seasonal observations; installed capacity is not water supplied.')],
    [t('Soil & biodiversity'), t('Comparable soil checks, tree follow-ups and restoration milestones'), t('Consistent methods, fixed cohorts and ecological observations; a plan is not a field outcome.')],
    [t('Learning & practice'), t('Before/after responses; course records; mentor skill observations'), t('Observed competence and dated later adoption checks; attendance is separate.')],
    [t('Reach, inclusion & empowerment'), t('Authorised participant and attendance records'), t('Distinct households and agreed consented disaggregation; no inference of gender, age or empowerment from names.')],
    [t('Employment & decent work'), t('Agreed person-day milestones with recorded evidence'), t('Verified work/payment registers and agreed decent-work definitions; visits are not payroll evidence.')],
    [t('Efficiency & programme finances'), t('Agreed delivery targets and source-specific coverage'), t('Programme budgets, verified expenditure and comparable outcomes before cost-effectiveness claims.')],
    [t('Tenure & pesticide exposure'), t('Any explicit project-specific evidence recorded by the team'), t('Direct tenure and exposure measurement; no inference from a map or crop list.')],
  ], includeInSummary: false });
  const sections: ReportSection[] = [
    { title: t('Evidence review'), lines: [
      options.milestoneSource ? t('{n} visible indicator definitions; {observed} have a dated observation by {date}. A missing observation remains unreported.', { n: milestones.length, observed: milestones.filter(milestone => milestoneAt(milestone, asOf).actual !== null).length, date: asOf }) : t('The milestone source could not be read. No indicator total or progress result is inferred.'),
      options.assessmentSource ? t('{n} assessments are available in this project selection. Each has its own population, response coverage and instrument stage.', { n: assessments.length }) : t('The assessment source could not be read. No assessment result is inferred.'),
      selected && analysis ? t('{title}: {completed} responses from {assigned} assigned participants. Findings describe this response snapshot.', { title: selected.title, completed: analysis.completed, assigned: analysis.assigned }) : t('No readable assessment analysis is selected. Choose an assessment to include its findings.'),
      comparison ? t('{n} measures have readable matched answers. Read matched and unmatched counts for each measure; they can differ.', { n: comparison.filter(metric => !metric.suppressed && (metric.n ?? 0) > 0).length }) : t('Matched change is not included until compatible before/after assessments are selected and readable.'),
    ] },
    { title: t('Scope & reporting basis'), lines: [scope, t('Prepared {today}. Milestone observation cutoff: {date}. Assessment answers and action status are current snapshots from the latest available records.', { today, date: asOf }),
      funder ? t('Only published evidence from the authorised funder projection is included. Private comments, staff ratings, participant identities and internal action owners are excluded. Matched comparisons require both assessments to be closed and published.') : t('Internal analysis follows the existing organisation permissions. This report omits participant identities and written feedback. Review recorded action owners before external sharing.'),
      t('Project labels scope each source; they do not prove that a milestone, assessment and portfolio cohort describe the same people or gardens. No automatic join to portfolio totals is made.'),
      ...(options.donorName ? [t('Donor filter: {name}, applied only to linked indicator definitions. Assessment scope is unchanged.', { name: options.donorName })] : []),
      ...(options.comparisonAsOf ? [t('Historical milestone cutoffs: {earlier} and {date}. Current definitions and corrected histories are used; assessment responses and action status are not historical snapshots.', { earlier: options.comparisonAsOf, date: asOf })] : []),
      ...(options.sample ? [t('DEMONSTRATION RECORDS: fictional programme evidence; not evidence of real results.')] : []),
      ...sourceNotes,
    ], summaryLines: [scope, t('Prepared {today}; milestone cutoff {date}. Assessments and actions are current snapshots.', { today, date: asOf }), funder ? t('Published, authorised evidence only. Small groups and private information remain withheld.') : t('Internal authorised analysis; identities and written feedback are omitted.'), t('Project labels do not establish a common population across sources.'), ...(options.sample ? [t('DEMONSTRATION RECORDS: fictional evidence, not real results.')] : []), ...sourceNotes] },
    { title: t('Learning & next decisions'), lines: [
      t('Review unmatched follow-up and missing answers before generalising change to everyone enrolled. State who is absent and what the team will do to improve coverage.'),
      t('A baseline stage name does not establish that measurement preceded support. Check collection dates, retrospective answers, recall periods and seasonal context.'),
      t('Self-reported skills and ordinal scores describe respondents’ answers. They are separate from a demonstrated practical task, later adoption and household outcomes.'),
      t('Agree the next action, owner, review date and evidence of completion in the existing assessment or programme register. Review whether the change helped.'),
      t('Use the wider evidence crosswalk to agree additional measurement with the programme and donor. This report makes no causal, nutrition, profit or sustainability-score claim.'),
    ] },
    { title: t('Sources & method'), lines: [
      t('Sources: authorised assessment summaries/analysis and programme milestones. Dates, units, baselines, targets and evidence references remain as recorded.'),
      t('Matched comparisons use the same project and instrument version, compatible stages, the latest consenting response per participant, and valid numeric answers. Not tried / not applicable answers are excluded from numeric comparisons.'),
      t('Before/after means use the matched set for that question. Unmatched valid answers are shown separately; no percentage change is invented from an ordinal confidence score or a zero baseline.'),
      t('Published comparisons also suppress small matched groups, small excluded groups and suppressed source distributions. A withheld result is not zero.'),
    ], references: [{ label: 'OECD · Evaluation criteria', url: 'https://www.oecd.org/en/topics/sub-issues/development-co-operation-evaluation-and-effectiveness/evaluation-criteria.html' }, { label: 'FAO · Farmer field school MEL toolkit', url: 'https://www.fao.org/family-farming/detail/en/c/1637407/' }, { label: 'FAO · TAPE evidence dimensions', url: 'https://www.fao.org/agroecology/database/tools-tape/how-it-works/en' }, ...(options.donorReference==='sef'?[{label:'IDC · SEF May 2025 reporting requirements',url:SEF_REPORTING_SOURCE}]:[])] },
  ];
  // The download file name is built from the English wording so it is the same in every language.
  return { title, scope, metrics, tables, sections, filename: programmeReportFilename({ title: funder ? 'Published MEL' : 'MEL evidence', scope: `${scopeIn(english)} ${selected?.title || 'no assessment'} ${before?.title || ''} ${options.donorReference || ''}`, period: `milestones-${options.comparisonAsOf || ''}-${asOf}` }, today) };
}
