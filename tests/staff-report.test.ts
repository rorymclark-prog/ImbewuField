import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFieldReport } from '../lib/field-report';
import { buildTrainingReport } from '../lib/training-report';
import { aggregateProgrammeBranding, freshEvidenceData, validTrainingRecord } from '../lib/programme-evidence';
import type { FieldWorkspace } from '../lib/field-teams';
import { buildProgrammePdf } from '../lib/programme-report-pdf';
import { pdfContentStreams } from './pdf-content-streams';

const field = (): FieldWorkspace => ({ sample: false, canManage: false, selfId: 'mentor', people: [{ id: 'p1', name: 'Participant one', role: 'farmer', gardenName: 'Garden one' }, { id: 'p2', name: 'Participant two', role: 'farmer' }], teams: [{ mentorId: 'mentor', location: 'Example group', farmerIds: ['p1', 'p2'], guidance: '', updatedAt: '2026-10-01' }], visits: [{ id: 'v1', mentorId: 'mentor', farmerId: 'p1', date: '2026-09-10', notes: 'Recorded visit', observations: 'Practical record check', practicalSkill: 'Record a harvest', skillResult: 'demonstrated', agreedAction: 'Review the missing record', responsiblePerson: '', followUpDate: '2026-09-20' }] });
const options = { today: '2026-10-24' };

test('mentor coverage counts people separately from visits and reveals assignments without a selected visit', () => {
  const data = field(); data.visits.push({ ...data.visits[0], id: 'v2', date: '2026-10-10' });
  const report = buildFieldReport(data, options);
  assert.equal(report.metrics.find(metric => metric.label === 'Visits recorded')!.value, '2');
  assert.equal(report.metrics.find(metric => metric.label === 'Assigned people visited')!.value, '1 / 2');
  assert.equal(report.tables[0].rows.find(row => row[0] === 'Participant two')![3], 'No visit in selection');
  assert.match(JSON.stringify(report.sections), /1 current assignments have no recorded visit/);
});

test('mentor action dates and missing owners remain visible and a completed action stays a current status', () => {
  const data = field();
  let report = buildFieldReport(data, { ...options, from: '2026-09-01', to: '2026-09-30' });
  assert.deepEqual(report.tables.find(table => table.title === 'Open follow-up actions')!.rows[0].slice(2), ['Owner needed', '2026-09-20', 'Overdue']);
  data.visits[0].actionCompletedOn = '2026-10-20'; data.visits[0].actionOutcome = 'The missing entry was checked';
  report = buildFieldReport(data, { ...options, from: '2026-09-01', to: '2026-09-30' });
  assert.equal(report.tables.find(table => table.title === 'Open follow-up actions')!.rows.length, 0);
  assert.equal(report.tables.find(table => table.title === 'Completed support actions')!.rows[0][2], '2026-10-20');
  assert.match(JSON.stringify(report.sections), /does not reconstruct their status/);
});

test('mentor skill observations do not turn an unassessed visit into competence', () => {
  const data = field(); data.visits[0].skillResult = 'not-assessed';
  const report = buildFieldReport(data, options);
  assert.equal(report.tables.find(table => table.title.includes('practical-skill'))!.rows[0][3], 'Not assessed');
  assert.match(JSON.stringify(report.sections), /later application separately/);
});

test('the full mentor evidence retains requested support, original notes and organisation guidance', () => {
  const data = field(); data.visits[0].supportRequested = 'Help with the missing receipt'; data.visits[0].originalNotes = 'Original observation before cleanup'; data.teams[0].guidance = 'Review the paper book together';
  const report = buildFieldReport(data, options);
  const evidence = JSON.stringify(report.tables.filter(table => table.includeInSummary === false));
  for (const recorded of [data.visits[0].supportRequested, data.visits[0].originalNotes, data.teams[0].guidance]) assert.ok(evidence.includes(recorded));
});

test('a selected participant that is no longer assigned cannot widen to everyone else', () => {
  const report = buildFieldReport(field(), { ...options, farmerId: 'removed-person' });
  assert.equal(report.metrics.find(metric => metric.label === 'Visits recorded')!.value, '0');
  assert.equal(report.tables.find(table => table.title === 'Support coverage')!.rows.length, 0);
  assert.match(report.scope, /^Former team member/);
});

test('facilitator reports distinguish repeated attendances, stable learners and unlinked guests', () => {
  const session = structuredClone(freshEvidenceData().sessions[0]);
  session.attendance.push({ id: 'guest-example', name: 'PRIVATE GUEST', present: true });
  session.presentCount = 3; session.registeredCount = 3;
  const report = buildTrainingReport([session, { ...session, id: 'second', date: '2026-09-01' }], options);
  assert.equal(report.metrics.find(metric => metric.label === 'Attendances')!.value, '6');
  assert.equal(report.metrics.find(metric => metric.label === 'Identified learners')!.value, '2');
  assert.match(report.metrics.find(metric => metric.label === 'Identified learners')!.detail!, /2 guest attendances/);
  assert.ok(!JSON.stringify(report).includes('PRIVATE GUEST'));
});

test('facilitator filters use project and record owner rather than a typed name that can be shared', () => {
  const session = freshEvidenceData().sessions[0];
  const report = buildTrainingReport([session, { ...session, id: 'other', ownerId: 'another-account', facilitator: session.facilitator }], { ...options, ownerId: session.ownerId, project: session.project });
  assert.equal(report.sessions.length, 1);
  assert.equal(buildTrainingReport([session], { ...options, ownerId: 'removed-owner' }).sessions.length, 0);
  assert.equal(buildTrainingReport([session], { ...options, project: 'Other project' }).sessions.length, 0);
});

test('facilitator feedback reports missing responses and omits private written feedback and named attendance', () => {
  const session = structuredClone(freshEvidenceData().sessions[0]);
  session.feedback = [{ participantId: session.attendance[0].id, consent: true, language: 'en', recordedAt: '2026-08-15', answers: { course_clear: '4', course_change: 'PRIVATE COMMENT' } }];
  const report = buildTrainingReport([session], options);
  const clarity = report.tables.find(table => table.title === 'Participant feedback')!.rows.find(row => row[0].includes('explanations'))!;
  assert.equal(clarity[2], '1 / 2'); assert.equal(clarity[3], '1');
  assert.ok(!JSON.stringify(report.tables).includes('PRIVATE COMMENT'));
  assert.ok(!JSON.stringify(report.tables).includes(session.attendance[0].name));
  assert.match(JSON.stringify(report.sections), /not turn satisfaction/);
});

test('future sessions and repeated source IDs cannot inflate a facilitator delivery result', () => {
  const session = freshEvidenceData().sessions[0];
  const report = buildTrainingReport([session, structuredClone(session), { ...session, id: 'future', date: '2027-01-01' }], options);
  assert.equal(report.sessions.length, 1);
});

test('mentor and facilitator PDFs carry evidence tables and audience-specific report labels', async () => {
  const reports = [buildFieldReport(field(), options), buildTrainingReport(freshEvidenceData().sessions, options)];
  for (const report of reports) {
    const pdf = await buildProgrammePdf(report.title, false, report.sections, 'full', undefined, [], 'Evidence', undefined, { metrics: report.metrics, tables: report.tables, reportLabel: 'Staff evidence' });
    const text = pdfContentStreams(pdf.output('arraybuffer'));
    assert.match(text, /Staff evidence/);
    assert.match(text, /Scope & reporting basis/);
    assert.ok(text.includes(report.tables[0].title));
    assert.ok(pdf.getNumberOfPages() > 1);
  }
});

test('an aggregate report cannot acquire one garden’s identity or mutate saved partner branding', () => {
  const branding = freshEvidenceData().branding;
  const original = structuredClone(branding);
  const aggregate = aggregateProgrammeBranding(branding);
  assert.deepEqual(aggregate.garden, { label: '', image: '' });
  assert.deepEqual(aggregate.organisation, original.organisation);
  assert.deepEqual(aggregate.funder, original.funder);
  assert.deepEqual(branding, original);
});

test('partial mentor history cannot produce a complete-looking report', () => {
  assert.throws(() => buildFieldReport({ ...field(), visitCursor: 'more-records' }, options), /complete authorised visit history/);
});

test('a chart that fits one fresh page keeps its last observation with its heading after partner marks', async () => {
  const chart = { title: 'Recorded grouped observations', note: 'Recorded support observations, with source labels retained.', rows: Array.from({ length: 8 }, (_, index) => ({ label: index === 7 ? 'Final observed group' : `Observation group ${index} with a longer recorded description for this field check, discussed with the participant and mentor during the follow-up observation`, value: index + 1 })) };
  const pdf = await buildProgrammePdf('Field evidence report', false, [], 'full', aggregateProgrammeBranding(freshEvidenceData().branding), [], 'Evidence', undefined, { chart, metrics: Array.from({ length: 4 }, (_, index) => ({ label: `Recorded measure ${index}`, value: '10', detail: 'The complete evidence coverage and period are stated in the recorded field check.' })), tables: [{ title: 'Evidence', note: '', columns: ['Source', 'Value', 'Meaning'], rows: [] }] });
  const pages = (pdf.internal as unknown as { pages: string[][] }).pages;
  const chartPage = pages.find(page => page?.join('\n').includes(chart.title));
  assert.ok(chartPage?.join('\n').includes('Final observed group'), 'the final observation must stay with the heading when the whole chart fits one page');
});

test('a valid long training title stays complete above the date on colour and ink covers', async () => {
  const session = structuredClone(freshEvidenceData().sessions[0]);
  session.title = 'Community learning and practical observation workshop with participants and facilitators from neighbouring gardens, including a review of records and next steps';
  assert.equal(validTrainingRecord(session, '2026-10-29'), true);
  for (const language of ['en', 'zu'] as const) for (const ink of [false, true]) for (const format of ['summary', 'full'] as const) {
    const pdf = await buildProgrammePdf('Session report', false, [], format, undefined, [], 'Evidence', undefined, { session, language, ink, date: '2026-10-29' });
    pdf.setFont('times', 'normal'); pdf.setFontSize(24);
    const titleRows = pdf.splitTextToSize(session.title, 174) as string[];
    assert.ok(titleRows.length > 2, 'exercise the cover that previously discarded remaining title rows');
    const page = (pdf.internal as unknown as { pages: string[][] }).pages[1].join('\n');
    for (const row of titleRows) assert.ok(page.includes(row), `${language}/${ink}: missing title row ${row}`);
    const blocks = [...page.matchAll(/BT\n([\s\S]*?)\nET/g)].map(match => match[1]);
    const title = blocks.find(block => titleRows.every(row => block.includes(row)))!;
    const date = blocks.find(block => block.includes('2026-10-29'))!;
    const baseline = (block: string) => Number(/[-\d.]+ ([-\d.]+) Td/.exec(block)![1]);
    const leading = Number(/([-\d.]+) TL/.exec(title)![1]);
    assert.ok(baseline(date) < baseline(title) - (titleRows.length - 1) * leading - 9,
      'the date must sit below the complete title with readable separation');
  }
});

test('pasted line breaks in a saved title cannot push its PDF cover off the paper', async () => {
  const session = structuredClone(freshEvidenceData().sessions[0]);
  session.title = Array.from({ length: 25 }, () => 'Visit').join('\n');
  assert.equal(validTrainingRecord(session, '2026-10-29'), true);
  const pdf = await buildProgrammePdf('Session report', false, [], 'full', undefined, [], 'Evidence', undefined, { session, date: '2026-10-29' });
  const page = (pdf.internal as unknown as { pages: string[][] }).pages[1].join('\n');
  const titleBlock = [...page.matchAll(/BT\n([\s\S]*?)\nET/g)].map(match => match[1]).find(block => block.includes('Visit'))!;
  assert.equal((titleBlock.match(/Visit/g) ?? []).length, 25);
  assert.ok(titleBlock.split('T*').length < 10, 'render title whitespace as spaces rather than twenty-five empty cover lines');
  assert.equal(session.title.split('\n').length, 25, 'the saved record remains unchanged');
});
