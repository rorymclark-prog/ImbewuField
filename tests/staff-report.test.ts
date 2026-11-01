import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFieldReport } from '../lib/field-report';
import { buildTrainingReport } from '../lib/training-report';
import { aggregateProgrammeBranding, freshEvidenceData } from '../lib/programme-evidence';
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

// ---- isiXhosa reader: the facilitator delivery report ------------------------------------------------
test('isiXhosa reader: the facilitator report body is isiXhosa, every figure and recorded name is unchanged, and every other language is the same English', async () => {
  const { XH_INLINE_SOURCE } = await import('../lib/locales/xh-inline/index');
  const { registerXhInline } = await import('../lib/xh-inline');
  const session = structuredClone(freshEvidenceData().sessions[0]);
  session.attendance.push({ id: 'guest-example', name: 'PRIVATE GUEST', present: true });
  session.presentCount = 3; session.registeredCount = 3; session.assessmentId = 'linked';
  session.feedback = [{ participantId: session.attendance[0].id, consent: true, language: 'en', recordedAt: '2026-08-15', answers: { course_clear: '4', course_change: 'PRIVATE COMMENT' } }];
  const sessions = [session, { ...session, id: 'second', date: '2026-09-01', facilitator: '', nextSteps: '', report: '', assessmentId: '' }];
  const inputs = [
    { ...options },
    { ...options, from: '2026-08-01', to: '2026-09-30', comparePrevious: true, assessments: [{ id: 'linked', title: 'Linked example assessment' }] },
    { ...options, ownerId: session.ownerId, project: session.project },
    { ...options, project: 'No such project' },
  ];
  const everyString = (value: unknown, out: string[] = []): string[] => {
    if (typeof value === 'string') out.push(value);
    else if (Array.isArray(value)) value.forEach(item => everyString(item, out));
    else if (value && typeof value === 'object') Object.entries(value).forEach(([key, item]) => { if (key !== 'url') everyString(item, out); });
    return out;
  };
  const digitsIn = (text: string) => (text.match(/\d+(?:[.,]\d+)?/g) ?? []).join(' ');
  try {
    registerXhInline({}); // the server, or before the isiXhosa drafts load
    for (const input of inputs) assert.deepEqual(buildTrainingReport(sessions, { ...input, language: 'xh' }), buildTrainingReport(sessions, input));
    registerXhInline(XH_INLINE_SOURCE);
    for (const input of inputs) {
      const english = buildTrainingReport(sessions, input);
      for (const language of ['en', 'zu', 'st', 'ts', 've', undefined]) assert.deepEqual(buildTrainingReport(sessions, { ...input, language }), english, `${language}`);
      const xh = buildTrainingReport(sessions, { ...input, language: 'xh' });
      assert.deepEqual(xh.counts, english.counts); assert.deepEqual(xh.sessions, english.sessions);
      assert.equal(xh.filename, english.filename, 'the download name is built from English');
      assert.deepEqual(xh.metrics.length, english.metrics.length);
      assert.deepEqual(xh.tables.map(table => [table.rows.length, table.columns.length, table.columnWeights, table.keepAllRowsInSummary, table.includeInSummary]), english.tables.map(table => [table.rows.length, table.columns.length, table.columnWeights, table.keepAllRowsInSummary, table.includeInSummary]));
      assert.deepEqual(xh.sections.map(section => [section.lines.length, section.references]), english.sections.map(section => [section.lines.length, section.references]));
      assert.notEqual(xh.title, english.title);
      assert.deepEqual(xh.sections.map(section => section.title).filter(title => english.sections.some(section => section.title === title)), [], 'every section title is isiXhosa');
      assert.deepEqual(xh.tables.map(table => table.title).filter(title => english.tables.some(table => table.title === title)), [], 'every table title is isiXhosa');
      assert.deepEqual(xh.metrics.map(metric => metric.label).filter(label => english.metrics.some(metric => metric.label === label)), [], 'every metric label is isiXhosa');
      xh.tables.forEach((table, index) => { assert.notEqual(table.note, english.tables[index].note); table.columns.forEach((column, n) => assert.notEqual(column, english.tables[index].columns[n], `${table.title} column ${n}`)); });
      xh.sections.forEach((section, index) => section.lines.forEach((line, n) => { if (line !== xh.scope) assert.notEqual(line, english.sections[index].lines[n], `${section.title} line ${n}`); }));
      // Every figure is exact, string by string.
      const englishStrings = everyString(english), xhStrings = everyString(xh);
      assert.equal(xhStrings.length, englishStrings.length);
      englishStrings.forEach((text, index) => assert.equal(digitsIn(xhStrings[index]), digitsIn(text), `figures in ${JSON.stringify(text.slice(0, 80))}`));
      // Recorded names and text stay as recorded; private text stays out.
      const text = JSON.stringify(xh);
      for (const recorded of [session.title, session.project, session.facilitator, session.nextSteps, 'Linked example assessment']) if (JSON.stringify(english).includes(recorded)) assert.ok(text.includes(recorded), `${recorded} stays as recorded`);
      assert.ok(!text.includes('PRIVATE GUEST') && !text.includes('PRIVATE COMMENT') && !text.includes(session.attendance[0].name));
    }
    // The survey question is the MEL template's isiXhosa wording, with the same counts.
    const feedback = buildTrainingReport(sessions, { ...options, language: 'xh' }).tables.find(table => table.columns.length === 4 && table.rows.some(row => row[2] === '2 / 6'));
    assert.ok(feedback, 'answered / eligible keeps its figures');
    // The preparation of the isiXhosa PDF works and carries the isiXhosa body.
    const report = buildTrainingReport(sessions, { ...options, language: 'xh' });
    const pdf = await buildProgrammePdf(report.title, false, report.sections, 'full', undefined, [], 'Ubungqina', undefined, { metrics: report.metrics, tables: report.tables, language: 'xh', reportLabel: 'Iirekhodi zokuhanjiswa kweqeqesho' });
    const content = pdfContentStreams(pdf.output('arraybuffer'));
    assert.match(content, /Uphononongo lokuhanjiswa/); assert.ok(!/Delivery review/.test(content));
  } finally { registerXhInline({}); }
});

// ---- Afrikaans reader: the facilitator delivery report (g48-staff-reports.ts) ------------------------------------------------
test('Afrikaans reader: the facilitator report body is Afrikaans, every figure and recorded name is unchanged, and every other language is the same English', async () => {
  const { AF_INLINE_SOURCE } = await import('../lib/locales/af-inline/index');
  const { registerInlineDrafts } = await import('../lib/xh-inline');
  const session = structuredClone(freshEvidenceData().sessions[0]);
  session.attendance.push({ id: 'guest-example', name: 'PRIVATE GUEST', present: true });
  session.presentCount = 3; session.registeredCount = 3; session.assessmentId = 'linked';
  session.feedback = [{ participantId: session.attendance[0].id, consent: true, language: 'en', recordedAt: '2026-08-15', answers: { course_clear: '4', course_change: 'PRIVATE COMMENT' } }];
  const sessions = [session, { ...session, id: 'second', date: '2026-09-01', facilitator: '', nextSteps: '', report: '', assessmentId: '' }];
  const inputs = [
    { ...options },
    { ...options, from: '2026-08-01', to: '2026-09-30', comparePrevious: true, assessments: [{ id: 'linked', title: 'Linked example assessment' }] },
    { ...options, ownerId: session.ownerId, project: session.project },
    { ...options, project: 'No such project' },
  ];
  const everyString = (value: unknown, out: string[] = []): string[] => {
    if (typeof value === 'string') out.push(value);
    else if (Array.isArray(value)) value.forEach(item => everyString(item, out));
    else if (value && typeof value === 'object') Object.entries(value).forEach(([key, item]) => { if (key !== 'url') everyString(item, out); });
    return out;
  };
  const digitsIn = (text: string) => (text.match(/\d+(?:[.,]\d+)?/g) ?? []).join(' ');
  try {
    registerInlineDrafts('af', {}); // the server, or before the Afrikaans drafts load
    for (const input of inputs) assert.deepEqual(buildTrainingReport(sessions, { ...input, language: 'af' }), buildTrainingReport(sessions, input));
    registerInlineDrafts('af', AF_INLINE_SOURCE);
    for (const input of inputs) {
      const english = buildTrainingReport(sessions, input);
      for (const language of ['en', 'zu', 'st', 'ts', 've', 'xh', undefined]) assert.deepEqual(buildTrainingReport(sessions, { ...input, language }), english, `${language}`);
      const af = buildTrainingReport(sessions, { ...input, language: 'af' });
      assert.deepEqual(af.counts, english.counts); assert.deepEqual(af.sessions, english.sessions);
      assert.equal(af.filename, english.filename, 'the download name is built from English');
      assert.deepEqual(af.metrics.length, english.metrics.length);
      assert.deepEqual(af.tables.map(table => [table.rows.length, table.columns.length, table.columnWeights, table.keepAllRowsInSummary, table.includeInSummary]), english.tables.map(table => [table.rows.length, table.columns.length, table.columnWeights, table.keepAllRowsInSummary, table.includeInSummary]));
      assert.deepEqual(af.sections.map(section => [section.lines.length, section.references]), english.sections.map(section => [section.lines.length, section.references]));
      assert.notEqual(af.title, english.title);
      assert.deepEqual(af.sections.map(section => section.title).filter(title => english.sections.some(section => section.title === title)), [], 'every section title is Afrikaans');
      assert.deepEqual(af.tables.map(table => table.title).filter(title => english.tables.some(table => table.title === title)), [], 'every table title is Afrikaans');
      assert.deepEqual(af.metrics.map(metric => metric.label).filter(label => english.metrics.some(metric => metric.label === label)), [], 'every metric label is Afrikaans');
      af.tables.forEach((table, index) => { assert.notEqual(table.note, english.tables[index].note); table.columns.forEach((column, n) => { if (!['Status'].includes(column)) assert.notEqual(column, english.tables[index].columns[n], `${table.title} column ${n}`); }); });
      af.sections.forEach((section, index) => section.lines.forEach((line, n) => { if (line !== af.scope) assert.notEqual(line, english.sections[index].lines[n], `${section.title} line ${n}`); }));
      // Every figure is exact, string by string.
      const englishStrings = everyString(english), afStrings = everyString(af);
      assert.equal(afStrings.length, englishStrings.length);
      englishStrings.forEach((text, index) => assert.equal(digitsIn(afStrings[index]), digitsIn(text), `figures in ${JSON.stringify(text.slice(0, 80))}`));
      // Recorded names and text stay as recorded; private text stays out.
      const text = JSON.stringify(af);
      for (const recorded of [session.title, session.project, session.facilitator, session.nextSteps, 'Linked example assessment']) if (JSON.stringify(english).includes(recorded)) assert.ok(text.includes(recorded), `${recorded} stays as recorded`);
      assert.ok(!text.includes('PRIVATE GUEST') && !text.includes('PRIVATE COMMENT') && !text.includes(session.attendance[0].name));
    }
    // The survey question is the MEL template's Afrikaans wording, with the same counts.
    const feedback = buildTrainingReport(sessions, { ...options, language: 'af' }).tables.find(table => table.columns.length === 4 && table.rows.some(row => row[2] === '2 / 6'));
    assert.ok(feedback, 'answered / eligible keeps its figures');
    // The preparation of the Afrikaans PDF works and carries the Afrikaans body.
    const report = buildTrainingReport(sessions, { ...options, language: 'af' });
    const pdf = await buildProgrammePdf(report.title, false, report.sections, 'full', undefined, [], 'Bewyse', undefined, { metrics: report.metrics, tables: report.tables, language: 'af', reportLabel: 'Opleidingsleweringsrekords' });
    const content = pdfContentStreams(pdf.output('arraybuffer'));
    assert.match(content, /Leweringshersiening/); assert.ok(!/Delivery review/.test(content));
  } finally { registerInlineDrafts('af', {}); }
});
