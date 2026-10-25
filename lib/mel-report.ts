import { compatibleMelStages, type MelAssessment, type MelMetric, type MelComparisonMetric, type MelStage } from './mel';
import { milestoneAt, type ProgrammeMilestone } from './programme-evidence';
import { progressValue } from './programme-progress';
import { programmeReportFilename } from './programme-report';
import { numberLabel } from './format-figures';
import type { ReportMetric, ReportSection, ReportTable } from './programme-report-pdf';

export type MelReportAssessment = Pick<MelAssessment, 'id' | 'title' | 'project' | 'stage' | 'published' | 'due' | 'updatedAt'> & { version?: number; state?: MelAssessment['state']; assigned: number; completed: number; metrics?: MelMetric[]; action?: string; actionOwner?: string; actionDue?: string; actionDone?: boolean };
export type MelReportAnalysis = { assessmentId: string; beforeId: string; metrics: MelMetric[]; assigned: number; completed: number; comparison: MelComparisonMetric[] | null; notes?: string[] };
export type MelReportOptions = {
  organisation: string; project: string; funder: boolean; sample: boolean; today: string; asOf: string;
  assessments: MelReportAssessment[]; milestones: ProgrammeMilestone[]; assessmentSource: boolean; milestoneSource: boolean;
  selectedId: string; beforeId: string; analysis: MelReportAnalysis | null; sourceNotes?: string[];
};
export const MEL_STAGE_LABELS: Record<MelStage, string> = { baseline: 'Project baseline', course_before: 'Before training', course_after: 'After training', midpoint: 'Project midpoint', closeout: 'Project closeout', app_midpoint: 'App feedback · midpoint', app_closeout: 'App feedback · closeout' };
const numeric = (value: number | null | undefined) => value === null || value === undefined || !Number.isFinite(value) ? 'Not available' : numberLabel(value, 2);

export function buildMelEvidenceReport(options: MelReportOptions) {
  const { project, asOf, today, funder } = options;
  const assessments = options.assessments.filter(assessment => (!project || assessment.project === project) && (!funder || assessment.published));
  const milestones = options.milestones.filter(milestone => (!project || milestone.project === project) && (!funder || milestone.published));
  const selected = assessments.find(assessment => assessment.id === options.selectedId);
  const before = assessments.find(assessment => assessment.id === options.beforeId);
  // A slow response for the preceding selection cannot label another assessment's numbers.
  const analysis = selected && options.analysis?.assessmentId === selected.id && options.analysis.beforeId === options.beforeId ? options.analysis : null;
  const comparison = before && selected && before.project === selected.project && typeof before.version === 'number' && before.version === selected.version && compatibleMelStages(before.stage, selected.stage) ? analysis?.comparison ?? null : null;
  const sourceNotes = [...new Set([...(options.sourceNotes || []), ...(analysis?.notes || [])])];
  const title = funder ? 'Published MEL evidence report' : 'Programme MEL evidence report';
  const scope = `${options.organisation} · ${project || 'All visible projects'}`;
  const metrics: ReportMetric[] = [
    { label: 'Agreed indicators', value: options.milestoneSource ? String(milestones.length) : 'Not available', detail: 'Visible milestone definitions; not an impact score' },
    { label: 'Indicators with observations', value: options.milestoneSource ? String(milestones.filter(milestone => milestoneAt(milestone, asOf).actual !== null).length) : 'Not available', detail: `Latest dated evidence on or before ${asOf}` },
    { label: 'Assessment responses', value: !options.assessmentSource ? 'Not available' : !selected ? 'Not selected' : analysis ? `${analysis.completed} / ${analysis.assigned}` : 'Not available', detail: selected ? `${selected.title} · current response snapshot` : 'Choose one assessment below' },
    { label: 'Matched measures', value: comparison ? String(comparison.filter(metric => !metric.suppressed && (metric.n ?? 0) > 0).length) : 'Not selected', detail: 'Each measure has its own matched denominator' },
  ];
  const tables: ReportTable[] = [
    { title: 'Agreed indicators & dated evidence', note: `Latest observations dated on or before ${asOf}, using the latest corrected records. This is not a reconstruction of what had been entered then. Baselines, targets and methods are shown as recorded.`, columns: ['Indicator', 'Baseline / target', 'Latest observation', 'Review / status', 'Evidence / method'], columnWeights: [1.5, 1.1, 1.1, 1.2, 2.1], rows: milestones.map(milestone => {
      const result = milestoneAt(milestone, asOf);
      return [`${milestone.title} · ${milestone.project}`, `Baseline: ${progressValue(milestone.baseline, milestone.unit)}; target: ${progressValue(milestone.target, milestone.unit)}`, `${progressValue(result.actual, milestone.unit)} · ${result.observedOn || 'No dated observation'}`, `${milestone.due} · ${result.status}`, `${result.evidence} Method: ${milestone.method}`];
    }) },
    { title: 'Assessment coverage', note: options.assessmentSource ? 'Response counts belong to each assessment. A person can respond at several stages; these rows cannot be added as unique people. Due dates are deadlines, not response-collection dates.' : 'The assessment source is unavailable. An empty table does not mean that no assessments exist.', columns: ['Assessment / project', 'Stage', 'Responses / assigned', 'State / sharing', 'Due / updated'], columnWeights: [1.8, 1.2, 1.1, 1.2, 1.4], rows: assessments.map(assessment => [`${assessment.title} · ${assessment.project}`, MEL_STAGE_LABELS[assessment.stage], `${assessment.completed} / ${assessment.assigned}`, `${assessment.state || 'State not included'} · ${assessment.published ? 'published' : 'internal'}`, `Due ${assessment.due}; updated ${assessment.updatedAt.slice(0, 10)}`]) },
    { title: 'Selected assessment findings', note: selected ? `${selected.title} · ${MEL_STAGE_LABELS[selected.stage]}. Answers remain self-reported. Missing counts here are among submitted responses; assessment coverage above also shows people who have not responded. ${!selected.state ? 'Assessment state is not included in this source; refresh before treating results as final.' : selected.state !== 'closed' ? 'This assessment is still open or draft; findings are provisional.' : ''}` : 'Choose an assessment to include its findings. No assessment is selected.', columns: ['Question', 'Recorded finding', 'Answered / responses', 'No answer among responses'], columnWeights: [2, 2.4, 1.1, 1.1], rows: (analysis?.metrics || []).map(metric => [metric.en, metric.suppressed ? 'Withheld to protect a small group' : metric.mean !== undefined ? `Mean recorded answer: ${numeric(metric.mean)}` : metric.choices?.filter(choice => choice.count > 0).map(choice => `${choice.en}: ${choice.count}`).join('; ') || 'No recorded answer', metric.suppressed ? 'Withheld' : `${metric.n} / ${analysis!.completed}`, metric.suppressed ? 'Withheld' : String(metric.missing)]) },
    { title: 'Matched baseline & follow-up', keepAllRowsInSummary: true, note: before && selected ? `${before.title} → ${selected.title}. Only valid answers from the same consenting participant IDs contribute to each change. Before/after means use that matched set. Unmatched counts describe valid answers excluded from that measure. This does not establish programme causation.` : 'Choose a compatible earlier assessment to include matched change. A difference between separate group averages is not substituted.', columns: ['Measure', 'Matched means · before / after', 'Mean change', 'Matched answers', 'Unmatched valid answers · before / after'], columnWeights: [2.2, 1.3, .9, .9, 1.4], rows: (comparison || []).map(metric => [metric.en + (metric.score && !metric.en.includes('self-reported score') ? ' · self-reported score' : ''), metric.suppressed ? 'Withheld' : `${numeric(metric.beforeMean)} / ${numeric(metric.afterMean)}`, metric.suppressed ? 'Withheld' : metric.n ? `${metric.change! > 0 ? '+' : ''}${numeric(metric.change)}` : 'No matched answers', metric.suppressed ? 'Withheld' : String(metric.n), metric.suppressed ? 'Withheld' : `${(metric.beforeN ?? 0) - (metric.n ?? 0)} / ${(metric.afterN ?? 0) - (metric.n ?? 0)}`]) },
  ];
  if (!funder) tables.push({ title: 'Recorded learning actions', note: 'Actions are current assessment records, with owners and dates only where entered. Completion is the recorded status; supporting evidence must be checked separately.', columns: ['Assessment', 'Agreed change / action', 'Owner / review date', 'Status'], rows: assessments.filter(assessment => assessment.action?.trim()).map(assessment => [assessment.title, assessment.action!, `${assessment.actionOwner || 'Owner needed'} · ${assessment.actionDue || 'Date needed'}`, assessment.actionDone ? 'Recorded complete' : 'Open']) });
  tables.push({ title: 'Wider MEL evidence to agree', note: 'A planning crosswalk informed by FAO and OECD. These are evidence requirements and possible app sources, not measured results, a complete donor framework or a TAPE assessment.', columns: ['Review area', 'Possible existing evidence', 'Further measurement needed'], rows: [
    ['Production & productivity', 'Harvest records; dated growing-area checks', 'Match crop cycles, growing area, units and dates before reporting yield per area.'],
    ['Income & value added', 'Sales, expenses and reported 30-day crop receipts', 'Comparable full costs, household income and valuation methods; sales are revenue.'],
    ['Food access & dietary diversity', 'Reported days eating garden food in the last seven days', 'An appropriate food-access or dietary instrument; garden harvest is not a validated food-security result.'],
    ['Water & resilience', 'Reported 30-day water reliability; dated storage and collection milestones', 'Measured use and comparable seasonal observations; installed capacity is not water supplied.'],
    ['Soil & biodiversity', 'Comparable soil checks, tree follow-ups and restoration milestones', 'Consistent methods, fixed cohorts and ecological observations; a plan is not a field outcome.'],
    ['Learning & practice', 'Before/after responses; course records; mentor skill observations', 'Observed competence and dated later adoption checks; attendance is separate.'],
    ['Reach, inclusion & empowerment', 'Authorised participant and attendance records', 'Distinct households and agreed consented disaggregation; no inference of gender, age or empowerment from names.'],
    ['Employment & decent work', 'Agreed person-day milestones with recorded evidence', 'Verified work/payment registers and agreed decent-work definitions; visits are not payroll evidence.'],
    ['Efficiency & programme finances', 'Agreed delivery targets and source-specific coverage', 'Programme budgets, verified expenditure and comparable outcomes before cost-effectiveness claims.'],
    ['Tenure & pesticide exposure', 'Any explicit project-specific evidence recorded by the team', 'Direct tenure and exposure measurement; no inference from a map or crop list.'],
  ], includeInSummary: false });
  const sections: ReportSection[] = [
    { title: 'Evidence review', lines: [
      options.milestoneSource ? `${milestones.length} visible indicator definitions; ${milestones.filter(milestone => milestoneAt(milestone, asOf).actual !== null).length} have a dated observation by ${asOf}. A missing observation remains unreported.` : 'The milestone source could not be read. No indicator total or progress result is inferred.',
      options.assessmentSource ? `${assessments.length} assessments are available in this project selection. Each has its own population, response coverage and instrument stage.` : 'The assessment source could not be read. No assessment result is inferred.',
      selected && analysis ? `${selected.title}: ${analysis.completed} responses from ${analysis.assigned} assigned participants. Findings describe this response snapshot.` : 'No readable assessment analysis is selected. Choose an assessment to include its findings.',
      comparison ? `${comparison.filter(metric => !metric.suppressed && (metric.n ?? 0) > 0).length} measures have readable matched answers. Read matched and unmatched counts for each measure; they can differ.` : 'Matched change is not included until compatible before/after assessments are selected and readable.',
    ] },
    { title: 'Scope & reporting basis', lines: [scope, `Prepared ${today}. Milestone observation cutoff: ${asOf}. Assessment answers and action status are current snapshots from the latest available records.`,
      funder ? 'Only published evidence from the authorised funder projection is included. Private comments, staff ratings, participant identities and internal action owners are excluded. Matched comparisons require both assessments to be closed and published.' : 'Internal analysis follows the existing organisation permissions. This report omits participant identities and written feedback. Review recorded action owners before external sharing.',
      'Project labels scope each source; they do not prove that a milestone, assessment and portfolio cohort describe the same people or gardens. No automatic join to portfolio totals is made.',
      ...(options.sample ? ['DEMONSTRATION RECORDS: fictional programme evidence; not evidence of real results.'] : []),
      ...sourceNotes,
    ], summaryLines: [scope, `Prepared ${today}; milestone cutoff ${asOf}. Assessments and actions are current snapshots.`, funder ? 'Published, authorised evidence only. Small groups and private information remain withheld.' : 'Internal authorised analysis; identities and written feedback are omitted.', 'Project labels do not establish a common population across sources.', ...(options.sample ? ['DEMONSTRATION RECORDS: fictional evidence, not real results.'] : []), ...sourceNotes] },
    { title: 'Learning & next decisions', lines: [
      'Review unmatched follow-up and missing answers before generalising change to everyone enrolled. State who is absent and what the team will do to improve coverage.',
      'A baseline stage name does not establish that measurement preceded support. Check collection dates, retrospective answers, recall periods and seasonal context.',
      'Self-reported skills and ordinal scores describe respondents’ answers. They are separate from a demonstrated practical task, later adoption and household outcomes.',
      'Agree the next action, owner, review date and evidence of completion in the existing assessment or programme register. Review whether the change helped.',
      'Use the wider evidence crosswalk to agree additional measurement with the programme and donor. This report makes no causal, nutrition, profit or sustainability-score claim.',
    ] },
    { title: 'Sources & method', lines: [
      'Sources: authorised assessment summaries/analysis and programme milestones. Dates, units, baselines, targets and evidence references remain as recorded.',
      'Matched comparisons use the same project and instrument version, compatible stages, the latest consenting response per participant, and valid numeric answers. Not tried / not applicable answers are excluded from numeric comparisons.',
      'Before/after means use the matched set for that question. Unmatched valid answers are shown separately; no percentage change is invented from an ordinal confidence score or a zero baseline.',
      'Published comparisons also suppress small matched groups, small excluded groups and suppressed source distributions. A withheld result is not zero.',
    ], references: [{ label: 'OECD · Evaluation criteria', url: 'https://www.oecd.org/en/topics/sub-issues/development-co-operation-evaluation-and-effectiveness/evaluation-criteria.html' }, { label: 'FAO · Farmer field school MEL toolkit', url: 'https://www.fao.org/family-farming/detail/en/c/1637407/' }, { label: 'FAO · TAPE evidence dimensions', url: 'https://www.fao.org/agroecology/database/tools-tape/how-it-works/en' }] },
  ];
  return { title, scope, metrics, tables, sections, filename: programmeReportFilename({ title: funder ? 'Published MEL' : 'MEL evidence', scope: `${scope} ${selected?.title || 'no assessment'} ${before?.title || ''}`, period: `milestones-${asOf}` }, today) };
}
