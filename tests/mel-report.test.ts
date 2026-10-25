import test from 'node:test';
import assert from 'node:assert/strict';
import { compareAssessmentMeasures, analyseAssessment, type MelAssessment, type MelResponse, type MelStage } from '../lib/mel';
import { MEL_TEMPLATES } from '../lib/mel-templates';
import { buildMelEvidenceReport, type MelReportOptions } from '../lib/mel-report';
import { freshEvidenceData } from '../lib/programme-evidence';
import { buildProgrammePdf } from '../lib/programme-report-pdf';
import { pdfContentStreams } from './pdf-content-streams';
import { freshSampleProgramme, sampleAssessments } from '../lib/sample-programme';

const assessment = (id: string, stage: MelStage, count = 10): MelAssessment => ({ id, orgId: 'org', project: 'Project', title: stage, stage, version: 1, participantIds: Array.from({ length: count }, (_, index) => `person-${index}`), due: '2026-09-01', state: 'closed', published: true, createdAt: '2026-07-01', updatedAt: '2026-09-01', action: '', actionOwner: '', actionDue: '', actionDone: false });
const responses = (a: MelAssessment, answer = '10'): MelResponse[] => a.participantIds.map((participantId, index) => ({ assessmentId: a.id, participantId, orgId: a.orgId, version: 1, consent: true, language: 'en', submittedAt: '2026-09-01', answers: { growing_m2: answer, harvest_kg_30d: String(index + 1), mulching: '1', staff_help: '4' } }));
const compare = (b: MelAssessment, a: MelAssessment, before = responses(b), after = responses(a), funder = false) => compareAssessmentMeasures(b, a, MEL_TEMPLATES[b.stage], MEL_TEMPLATES[a.stage], before, after, funder);

test('a newly shared fictional training baseline enables the same published comparison as real evidence', () => {
  const controls = freshSampleProgramme(); controls.published.push('sample-course_before');
  const records = sampleAssessments(controls);
  const before = records.find(row => row.assessment.stage === 'course_before')!;
  const after = records.find(row => row.assessment.stage === 'course_after')!;
  const result = compare(before.assessment, after.assessment, before.rows, after.rows, true);
  assert.ok(result.length > 0);
  assert.ok(result.every(row => row.n === 16 && !row.suppressed));
});

test('a MEL change uses the same people on both sides and discloses unmatched valid answers', () => {
  const b = assessment('before', 'baseline'), a = assessment('after', 'midpoint');
  const earlier = responses(b, '10'), later = responses(a, '30').slice(0, 6);
  earlier[9].answers.growing_m2 = '1000';
  const metric = compare(b, a, earlier, later).find(row => row.id === 'growing_m2')!;
  assert.equal(metric.n, 6); assert.equal(metric.beforeN, 10); assert.equal(metric.afterN, 6);
  assert.equal(metric.beforeMean, 10); assert.equal(metric.afterMean, 30); assert.equal(metric.change, 20);
});

test('out-of-order duplicate responses use the latest valid response consistently with the existing analysis', () => {
  const b = assessment('before', 'baseline'), a = assessment('after', 'midpoint');
  const before = responses(b), after = responses(a, '20');
  before.push({ ...before[0], submittedAt: '2026-08-01', answers: { growing_m2: '999' } });
  const metric = compare(b, a, before, after).find(row => row.id === 'growing_m2')!;
  assert.equal(metric.beforeMean, analyseAssessment(b, MEL_TEMPLATES.baseline, before).metrics.find(row => row.id === 'growing_m2')!.mean);
  assert.equal(metric.change, 10);
});

test('withdrawn consent, invalid answers and not-tried scores never become matched zeroes', () => {
  const b = assessment('before', 'baseline', 3), a = assessment('after', 'midpoint', 3);
  const before = responses(b), after = responses(a, '20');
  before[0] = { ...before[0], consent: false } as unknown as MelResponse; after[1].answers.growing_m2 = '-5'; before[2].answers.mulching = 'na';
  const rows = compare(b, a, before, after);
  assert.equal(rows.find(row => row.id === 'growing_m2')!.n, 1);
  assert.equal(rows.find(row => row.id === 'mulching')!.n, 1);
});

test('different projects, organisations, stages or versions cannot be compared under a shared label', () => {
  const b = assessment('before', 'baseline'), a = assessment('after', 'midpoint');
  assert.deepEqual(compare(b, { ...a, project: 'Other project' }), []);
  assert.deepEqual(compare(b, { ...a, orgId: 'other-org' }), []);
  assert.deepEqual(compare(b, { ...a, stage: 'course_after' }), []);
  assert.deepEqual(compare(b, { ...a, version: 2 } as unknown as MelAssessment), []);
});

test('a funder cannot compare an unpublished or open baseline even when raw answers were supplied', () => {
  const b = assessment('before', 'baseline'), a = assessment('after', 'midpoint');
  assert.deepEqual(compare({ ...b, published: false }, a, responses(b), responses(a), true), []);
  assert.deepEqual(compare({ ...b, state: 'open' }, a, responses(b), responses(a), true), []);
});

test('a published matched mean suppresses small excluded groups that could be recovered by subtraction', () => {
  const b = assessment('before', 'baseline'), a = assessment('after', 'midpoint');
  const rows = compare(b, a, responses(b), responses(a).slice(0, 9), true);
  const area = rows.find(row => row.id === 'growing_m2')!;
  assert.equal(area.suppressed, true);
  for (const key of ['n', 'beforeN', 'afterN', 'beforeMean', 'afterMean', 'change'] as const) assert.equal(area[key], null);
});

test('published comparisons with sufficient matched and excluded groups remain available', () => {
  const b = assessment('before', 'baseline', 15), a = assessment('after', 'midpoint', 15);
  const area = compare(b, a, responses(b, '10'), responses(a, '20').slice(0, 10), true).find(row => row.id === 'growing_m2')!;
  assert.equal(area.suppressed, false); assert.equal(area.n, 10); assert.equal(area.beforeN, 15); assert.equal(area.afterN, 10); assert.equal(area.change, 10);
});

test('small published answer distributions stay suppressed and private staff ratings stay absent', () => {
  const b = assessment('before', 'midpoint'), a = assessment('after', 'closeout');
  // Midpoint is not a compatible baseline. Use two matching templates with private
  // ratings to verify that private answers cannot enter a public comparison.
  const baseline = assessment('baseline', 'baseline');
  const customBefore = { ...MEL_TEMPLATES.baseline, questions: [...MEL_TEMPLATES.baseline.questions, ...MEL_TEMPLATES.midpoint.questions.filter(question => question.id === 'staff_help')] };
  const result = compareAssessmentMeasures(baseline, a, customBefore, MEL_TEMPLATES.closeout, responses(baseline), responses(a), true);
  assert.ok(!result.some(row => row.id === 'staff_help'));
  const before = responses(baseline), after = responses(assessment('after', 'midpoint'));
  before[0].answers.mulching = '2';
  const rows = compare(baseline, assessment('after', 'midpoint'), before, after, true);
  assert.equal(rows.find(row => row.id === 'mulching')!.suppressed, true);
  assert.deepEqual(compare(b, a), []);
});

const reportOptions = (extra: Partial<MelReportOptions> = {}): MelReportOptions => {
  const a = assessment('after', 'midpoint');
  const summary = analyseAssessment(a, MEL_TEMPLATES.midpoint, responses(a));
  return { organisation: 'Example organisation', project: 'Project', funder: false, sample: false, today: '2026-10-24', asOf: '2026-08-01', assessmentSource: true, milestoneSource: true, assessments: [{ ...a, ...summary }], milestones: [], selectedId: a.id, beforeId: '', analysis: { assessmentId: a.id, beforeId: '', ...summary, comparison: null }, ...extra };
};

test('a MEL PDF keeps the observation cutoff separate from current assessment and action snapshots', () => {
  const milestone = { ...freshEvidenceData().milestones[0], project: 'Project', observations: [{ date: '2026-08-01', actual: 2, evidence: 'Earlier field check', recordedAt: '2026-08-01' }, { date: '2026-09-01', actual: 99, evidence: 'Later check', recordedAt: '2026-09-01' }] };
  const report = buildMelEvidenceReport(reportOptions({ milestones: [milestone] }));
  const row = report.tables[0].rows[0];
  assert.match(row[2], /^2 /); assert.ok(!row[2].includes('99'));
  assert.match(JSON.stringify(report.sections), /Assessment answers and action status are current snapshots/);
  assert.match(JSON.stringify(report.tables), /deadlines, not response-collection dates/);
});

test('unreadable MEL sources remain unavailable instead of becoming an empty successful programme', () => {
  const report = buildMelEvidenceReport(reportOptions({ assessmentSource: false, milestoneSource: false, assessments: [], milestones: [], analysis: null }));
  assert.equal(report.metrics.find(metric => metric.label === 'Agreed indicators')!.value, 'Not available');
  assert.equal(report.metrics.find(metric => metric.label === 'Assessment responses')!.value, 'Not available');
  assert.match(JSON.stringify(report.sections), /No indicator total or progress result is inferred/);
});

test('a stale analysis or a disappeared project cannot acquire another selection’s label', () => {
  const input = reportOptions(); input.analysis!.assessmentId = 'old-selection';
  input.analysis!.metrics[0].en = 'STALE PRIVATE RESULT';
  let report = buildMelEvidenceReport(input);
  assert.ok(!JSON.stringify(report).includes('STALE PRIVATE RESULT'));
  assert.equal(report.tables.find(table => table.title === 'Selected assessment findings')!.rows.length, 0);
  report = buildMelEvidenceReport({ ...input, project: 'Removed project' });
  assert.equal(report.tables.find(table => table.title === 'Assessment coverage')!.rows.length, 0);
  assert.match(report.scope, /Removed project/);
});

test('a funder report excludes private indicators, assessment titles and internal action owners', () => {
  const input = reportOptions({ funder: true });
  input.assessments.push({ ...input.assessments[0], id: 'private', title: 'PRIVATE ASSESSMENT', published: false });
  input.assessments[0].action = 'PRIVATE ACTION'; input.assessments[0].actionOwner = 'PRIVATE OWNER';
  input.milestones = [{ ...freshEvidenceData().milestones[0], project: 'Project', published: false, title: 'PRIVATE INDICATOR' }];
  const report = buildMelEvidenceReport(input);
  const text = JSON.stringify(report);
  for (const privateText of ['PRIVATE ASSESSMENT', 'PRIVATE ACTION', 'PRIVATE OWNER', 'PRIVATE INDICATOR']) assert.ok(!text.includes(privateText));
});

test('a withheld result does not export the source’s hidden number or a zero-looking denominator', () => {
  const input = reportOptions({ funder: true });
  input.analysis!.metrics = [{ id: 'growing_m2', en: 'Area', zu: 'Area', n: 0, missing: 0, mean: 987654321, suppressed: true }];
  const report = buildMelEvidenceReport(input);
  const row = report.tables.find(table => table.title === 'Selected assessment findings')!.rows[0];
  assert.deepEqual(row.slice(1), ['Withheld to protect a small group', 'Withheld', 'Withheld']);
  assert.ok(!JSON.stringify(report).includes('987654321'));
});

test('full and brief MEL exports retain matched coverage, source limitations and device-snapshot disclosure', async () => {
  const b = assessment('before', 'baseline'), a = assessment('after', 'midpoint');
  const input = reportOptions();
  input.beforeId = b.id; input.assessments.unshift({ ...b, ...analyseAssessment(b, MEL_TEMPLATES.baseline, responses(b)) });
  input.analysis!.beforeId = b.id; input.analysis!.comparison = compare(b, a, responses(b), responses(a, '20').slice(0, 6));
  input.analysis!.notes = ['Assessment findings: uses information saved on this device.'];
  const report = buildMelEvidenceReport(input);
  for (const format of ['summary', 'full'] as const) {
    const pdf = await buildProgrammePdf(report.title, false, report.sections, format, undefined, [], 'Evidence', undefined, { metrics: report.metrics, tables: report.tables, subtitle: report.scope });
    const text = pdfContentStreams(pdf.output('arraybuffer'));
    // The caveat may wrap into several PDF text operations; its meaning must
    // survive in both editions without pinning one line-breaking arrangement.
    const visibleText = [...text.matchAll(/\(((?:\\.|[^\\)])*)\)\s*Tj/g)].map(match => match[1].replace(/\\([()\\])/g, '$1')).join(' ');
    assert.match(text, /Matched baseline/); assert.match(text, /Unmatched/);
    assert.match(text, /saved on this device/); assert.match(visibleText, /does not establish programme causation/);
    assert.ok(!/participantIds|person-0/.test(text));
  }
});
