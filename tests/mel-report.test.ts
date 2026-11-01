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

// ---- isiXhosa reader -------------------------------------------------------------------------------
const donorExample = { funder: 'Fictional donor', agreement: 'TEST-AGREEMENT', code: 'TEST-01', periodStart: '2026-08-01', periodEnd: '2026-09-30', population: 'Six explicitly identified demonstration gardens.', disaggregation: 'No demographic breakdown agreed.', frequency: 'Monthly', basis: 'cumulative' as const };
const xhScenario = (extra: Partial<MelReportOptions> = {}): MelReportOptions => {
  const b = assessment('before', 'baseline'), a = { ...assessment('after', 'midpoint'), action: 'Plant more cover crops', actionOwner: 'PRIVATE OWNER NAME', actionDue: '2026-10-01', state: 'open' as const };
  const afterSummary = analyseAssessment(a, MEL_TEMPLATES.midpoint, responses(a)), beforeSummary = analyseAssessment(b, MEL_TEMPLATES.baseline, responses(b));
  const [first, second] = freshEvidenceData().milestones;
  const milestones = [
    { ...first, project: 'Project', title: 'Fictional agreed output', donor: donorExample, observations: [{ date: '2026-08-15', actual: 2, evidence: 'TEST-EVIDENCE-A', recordedAt: '2026-08-15' }, { date: '2026-09-01', actual: 4, evidence: 'TEST-EVIDENCE-B', recordedAt: '2026-09-01' }] },
    { ...second, project: 'Project', title: 'Fictional unmeasured output', baseline: null, target: null, observations: [] },
  ];
  return reportOptions({ sample: true, comparisonAsOf: '2026-08-31', asOf: '2026-09-30', today: '2026-10-26', donorName: donorExample.funder, donorReference: 'sef', milestones, beforeId: b.id,
    assessments: [{ ...b, ...beforeSummary }, { ...a, ...afterSummary }],
    analysis: { assessmentId: a.id, beforeId: b.id, ...afterSummary, comparison: compare(b, a, responses(b), responses(a, '20').slice(0, 6)), notes: ['Assessment findings: Uses information saved on this device.'] },
    sourceNotes: ['Assessment register: Includes device-saved changes not yet confirmed by the server.'], ...extra });
};
const everyString = (value: unknown, out: string[] = []): string[] => {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) value.forEach(item => everyString(item, out));
  else if (value && typeof value === 'object') Object.entries(value).forEach(([key, item]) => { if (key !== 'url') everyString(item, out); });
  return out;
};
const digitsIn = (text: string) => (text.match(/\d+(?:[.,]\d+)?/g) ?? []).join(' ');

test('isiXhosa reader: the MEL body is isiXhosa, every figure, name and recorded phrase is unchanged, and every other language is the same English', async () => {
  const { XH_INLINE_SOURCE } = await import('../lib/locales/xh-inline/index');
  const { registerXhInline } = await import('../lib/xh-inline');
  const scenarios: Array<[string, MelReportOptions]> = [
    ['staff with donor, sef, history and matched change', xhScenario()],
    ['funder', xhScenario({ funder: true })],
    ['staff, no donor, sources unreadable', xhScenario({ donorName: undefined, donorReference: 'none', comparisonAsOf: undefined, sample: false, assessmentSource: false, milestoneSource: false, analysis: null, assessments: [] })],
  ];
  try {
    registerXhInline({}); // the server, or before the isiXhosa drafts load
    for (const [label, input] of scenarios) {
      const english = buildMelEvidenceReport(input);
      for (const language of ['en', 'zu', 'st', 'xh', undefined]) assert.deepEqual(buildMelEvidenceReport({ ...input, language }), english, `${label}: ${language} before drafts load`);
    }
    registerXhInline(XH_INLINE_SOURCE);
    for (const [label, input] of scenarios) {
      const english = buildMelEvidenceReport(input);
      // Omitting the language or asking for English or isiZulu or Sesotho is the same English report.
      for (const language of ['en', 'zu', 'st', 'ts', 've', undefined]) assert.deepEqual(buildMelEvidenceReport({ ...input, language }), english, `${label}: ${language}`);
      const xh = buildMelEvidenceReport({ ...input, language: 'xh' });
      // Same shape: metrics, tables, rows, columns, sections, lines, references.
      assert.deepEqual(xh.metrics.length, english.metrics.length);
      assert.deepEqual(xh.tables.map(table => [table.rows.length, table.columns.length, table.columnWeights, table.keepAllRowsInSummary, table.includeInSummary]), english.tables.map(table => [table.rows.length, table.columns.length, table.columnWeights, table.keepAllRowsInSummary, table.includeInSummary]), label);
      assert.deepEqual(xh.sections.map(section => [section.lines.length, section.summaryLines?.length]), english.sections.map(section => [section.lines.length, section.summaryLines?.length]), label);
      assert.deepEqual(xh.sections.map(section => section.references), english.sections.map(section => section.references), 'source names and links are unchanged');
      assert.equal(xh.filename, english.filename, 'the download name is built from English');
      // The fixed wording is isiXhosa.
      assert.notEqual(xh.title, english.title);
      assert.deepEqual(xh.sections.map(section => section.title).filter(title => english.sections.some(section => section.title === title)), [], 'every section title is isiXhosa');
      assert.deepEqual(xh.tables.map(table => table.title).filter(title => english.tables.some(table => table.title === title)), [], 'every table title is isiXhosa');
      assert.deepEqual(xh.metrics.map(metric => metric.label).filter(text => english.metrics.some(metric => metric.label === text)), [], 'every metric label is isiXhosa');
      xh.tables.forEach((table, index) => { assert.notEqual(table.note, english.tables[index].note, `${table.title} note`); table.columns.forEach((column, n) => assert.notEqual(column, english.tables[index].columns[n], `${table.title} column ${n}`)); });
      xh.sections.forEach((section, index) => section.lines.forEach((line, n) => { if (line !== xh.scope && !line.startsWith('Assessment register: ') && !line.startsWith('Assessment findings: ')) assert.notEqual(line, english.sections[index].lines[n], `${section.title} line ${n}`); }));
      // Every figure is exact: counts, means, dates and the signed changes, string by string.
      const englishStrings = everyString(english), xhStrings = everyString(xh);
      assert.equal(xhStrings.length, englishStrings.length);
      englishStrings.forEach((text, index) => assert.equal(digitsIn(xhStrings[index]), digitsIn(text), `figures in ${JSON.stringify(text.slice(0, 80))}`));
      // Recorded names, evidence and codes are never translated.
      const text = JSON.stringify(xh);
      for (const recorded of ['Example organisation', 'Fictional donor', 'TEST-AGREEMENT', 'TEST-01', 'Fictional agreed output', 'TEST-EVIDENCE-B', 'Plant more cover crops', 'PRIVATE OWNER NAME']) if (JSON.stringify(english).includes(recorded)) assert.ok(text.includes(recorded), `${recorded} stays as recorded`);
      if (input.funder) for (const privateText of ['PRIVATE OWNER NAME', 'Plant more cover crops']) assert.ok(!text.includes(privateText));
    }
    // Withheld results, matched changes and the unreported markers are said in isiXhosa with the same numbers.
    const withheld = xhScenario({ funder: true }); withheld.analysis!.metrics = [{ id: 'growing_m2', en: 'Area', zu: 'Area', n: 0, missing: 0, mean: 987654321, suppressed: true }];
    const row = buildMelEvidenceReport({ ...withheld, language: 'xh' }).tables.find(table => table.rows[0]?.[1] === 'Kufihliwe ukukhusela iqela elincinci');
    assert.deepEqual(row!.rows[0].slice(1), ['Kufihliwe ukukhusela iqela elincinci', 'Kufihliwe', 'Kufihliwe']);
    assert.ok(!JSON.stringify(buildMelEvidenceReport({ ...withheld, language: 'xh' })).includes('987654321'));
    const changed = buildMelEvidenceReport({ ...xhScenario(), language: 'xh' }).tables.find(table => table.columns.length === 5 && /^[+-]/.test(String(table.rows[0]?.[2])));
    assert.ok(changed, 'the matched change keeps its sign and decimals');
    // The isiXhosa PDF carries the isiXhosa body and the recorded names.
    const report = buildMelEvidenceReport({ ...xhScenario(), language: 'xh' });
    const pdf = await buildProgrammePdf(report.title, false, report.sections, 'full', undefined, [], 'Ubungqina', undefined, { metrics: report.metrics, tables: report.tables, subtitle: report.scope, language: 'xh' });
    const content = pdfContentStreams(pdf.output('arraybuffer'));
    assert.match(content, /Uphononongo lobungqina/); assert.match(content, /Fictional donor/);
    assert.ok(!/Evidence review/.test(content));
  } finally { registerXhInline({}); }
});
