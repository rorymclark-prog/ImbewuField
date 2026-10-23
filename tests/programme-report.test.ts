import test from 'node:test';
import { pdfContentStreams } from './pdf-content-streams';
import assert from 'node:assert/strict';
import { buildProgrammeReport, programmeReportFilename, type ProgrammeReportOptions } from '../lib/programme-report';
import { DEMO_NETWORK, DEMO_COHORT_MONTHLY } from '../lib/network-demo';
import { emptyCohortSeries } from '../lib/cohort-series';
import { buildProgrammePdf } from '../lib/programme-report-pdf';

const options = (overrides: Partial<ProgrammeReportOptions> = {}): ProgrammeReportOptions => ({
  rows: structuredClone(DEMO_NETWORK.farmers), monthly: structuredClone(DEMO_COHORT_MONTHLY), kind: 'overview', funder: true,
  sample: true, organisation: 'Example organisation', withheldForConsent: 3, date: '2026-10-23', ...overrides,
});
const allText = (report: ReturnType<typeof buildProgrammeReport>) => JSON.stringify(report.sections) + JSON.stringify(report.tables);

test('a funder brief names the denominator for each result and never exports private identity details', () => {
  const o = options();
  o.rows[0].farmer.name = 'PRIVATE PERSON';
  o.rows[0].metrics.producedKg = null;
  const report = buildProgrammeReport(o);
  const coverage = report.coverage.find(c => c.label === 'Harvest weight')!;
  assert.equal(coverage.available, o.rows.filter(r => r.metrics.producedKg !== null).length);
  assert.equal(coverage.total, o.rows.length);
  assert.ok(!allText(report).includes('PRIVATE PERSON'));
  assert.match(allText(report), /DEMONSTRATION RECORDS/);
  assert.match(allText(report), /3 enrolled farmers are withheld/);
  assert.match(allText(report), /not an independent audit/);
});

test('an unreadable portfolio is unavailable, while a readable empty harvest book is zero', () => {
  const o = options({ rows: structuredClone(DEMO_NETWORK.farmers.slice(0,1)) });
  const m = o.rows[0].metrics;
  m.producedKg = null; m.incomeZar = null; m.expensesZar = null; m.soldKg = null; m.trainingPct = null; m.modulesDone = null;
  let report = buildProgrammeReport(o);
  assert.equal(report.metrics.find(m => m.label === 'Harvest logged')!.value, 'Not available');
  assert.equal(report.metrics.find(m => m.label === 'Sales recorded')!.value, 'Not available');
  m.producedKg = 0;
  report = buildProgrammeReport(o);
  assert.equal(report.metrics.find(m => m.label === 'Harvest logged')!.value, '0 kg');
  assert.equal(report.coverage[0].available, 1);
});

test('a cohort filter cannot borrow the organisation-wide monthly totals', () => {
  const o = options({ basis: 'window' });
  o.cohortId = o.rows[0].farmer.cohortId!;
  const expected = o.rows.filter(r => r.farmer.cohortId === o.cohortId);
  const report = buildProgrammeReport(o);
  assert.equal(report.rows.length, expected.length);
  assert.match(report.period, /Cumulative/);
  assert.ok(!report.tables.some(t => t.title === 'Monthly ledger'));
  assert.equal(report.tables.find(t => t.title === 'Cohort breakdown')!.rows.length, 1);
});

test('selected month boundaries use dated ledger values and keep learning labelled as a snapshot', () => {
  const o = options({ basis: 'window', startMonth: DEMO_COHORT_MONTHLY.months[2].key, endMonth: DEMO_COHORT_MONTHLY.months[3].key });
  const report = buildProgrammeReport(o);
  const ledger = report.tables.find(t => t.title === 'Monthly ledger')!;
  assert.equal(ledger.rows.length, 2);
  assert.equal(ledger.rows[0][0], o.monthly.months[2].longLabel);
  assert.equal(ledger.rows[1][0], o.monthly.months[3].longLabel);
  const kg = o.monthly.months.slice(2,4).reduce((a,m) => a + (m.producedKg ?? 0), 0);
  assert.equal(report.chart!.rows.reduce((a,r) => a+r.value,0), kg);
  assert.match(allText(report), /not period-specific achievements/);
  assert.match(report.period, /UTC event dates/);
});

test('a missing monthly series does not fall back to cumulative results under a period label', () => {
  const report = buildProgrammeReport(options({ basis: 'window', monthly: emptyCohortSeries() }));
  assert.equal(report.metrics.find(m => m.label === 'Harvest logged')!.value, 'Not available');
  assert.equal(report.tables.find(t => t.title === 'Monthly ledger')!.rows.length, 0);
  assert.match(report.period, /No months available/);
});

test('course progress uses a distribution rather than ranking farmers as if their circumstances matched', () => {
  const report = buildProgrammeReport(options({ kind: 'training' }));
  assert.equal(report.chart!.title, 'Course progress distribution');
  assert.equal(report.chart!.rows.reduce((n,r)=>n+r.value,0), report.rows.filter(r=>r.metrics.modulesDone!==null).length);
  assert.ok(report.metrics.find(m=>m.label==='Training completion'));
  assert.match(allText(report), /not independently demonstrated competence|observed practice/);
});

test('both PDF editions retain scope, sample disclosure, evidence tables and missing-value labels', async () => {
  const report = buildProgrammeReport(options());
  for (const format of ['summary','full'] as const) {
    const pdf = await buildProgrammePdf(report.title,true,report.sections,format,undefined,[],'Evidence',undefined,{metrics:report.metrics,chart:report.chart,tables:report.tables,subtitle:report.scope,date:'2026-10-23'});
    const bytes = pdfContentStreams(pdf.output('arraybuffer'));
    assert.match(bytes, /DEMONSTRATION RECORDS/);
    assert.match(bytes, /2026-10-23/);
    assert.match(bytes, /Recorded results/);
    assert.match(bytes, /Evidence coverage/);
    assert.ok(pdf.getNumberOfPages() >= 2);
  }
});

test('a long evidence table paginates with column headings and preserves the final row', async () => {
  const pdf = await buildProgrammePdf('Delivery report',false,[],'full',undefined,[],'Evidence',undefined,{ tables:[{
    title:'Coverage register',note:'Test of a long register',columns:['Cohort','Farmers','Harvest kg','Coverage'],
    rows:Array.from({length:70},(_,i)=>[`Cohort ${i}: ${'long recorded programme name '.repeat(3)}`,String(i),'Not available','Not shared']),
  }] });
  const bytes = pdfContentStreams(pdf.output('arraybuffer'));
  assert.match(bytes,/Cohort 69/);
  assert.ok((bytes.match(/\(Coverage\)/g)??[]).length>1,'column headings must be repeated after page breaks');
  assert.ok(pdf.getNumberOfPages()>2);
});


test('period coverage describes readable books rather than claiming each farmer supplied a known weight', () => {
  const report=buildProgrammeReport(options({basis:'window'}));
  const table=report.tables.find(t=>t.title==='Recorded results')!;
  assert.match(table.note,/number contributing known weights in this period is not available/);
  assert.match(report.metrics.find(m=>m.label==='Harvest logged')!.detail!,/books readable; known weights only/);
});

test('an unavailable learning record does not become a zero course-completion finding', () => {
  const o=options({kind:'training'});
  for(const r of o.rows){r.metrics.modulesDone=null;r.metrics.trainingPct=null;}
  const report=buildProgrammeReport(o);
  assert.equal(report.metrics.find(m=>m.label==='Course completed')!.value,'Not available');
  assert.equal(report.chart!.rows.length,0);
});

test('download names distinguish cohort scopes and do not carry path separators or spreadsheet formulas', () => {
  const report=buildProgrammeReport(options());
  const filename=programmeReportFilename(report,'2026-10-23');
  assert.match(filename,/2026-10-23$/);
  assert.notEqual(filename,programmeReportFilename({...report,scope:'A different cohort'},'2026-10-23'));
  assert.match(programmeReportFilename({...report,scope:'../=HYPERLINK("unsafe")'},'invalid'),/^ImbewuField-[a-z0-9-]+-undated$/);
});

test('the brief export keeps essential evidence notes while reserving detailed breakdowns for the full report', async () => {
  const report=buildProgrammeReport(options());
  const pdf=await buildProgrammePdf(report.title,true,report.sections,'summary',undefined,[],'Evidence',undefined,{tables:report.tables,metrics:report.metrics,chart:report.chart});
  const text=pdfContentStreams(pdf.output('arraybuffer'));
  assert.match(text,/Evidence coverage/);
  assert.match(text,/not a statutory NPO return/);
  assert.ok(!text.includes('(Cohort breakdown)'));
  assert.ok(!text.includes('(Follow-up questions)'));
  assert.ok(!text.includes(`(${report.chart!.title})`));
});


test('the unfinished current month is explicit and two dated scopes have different download names', () => {
  const o=options({basis:'window'});
  o.date=o.monthly.months.at(-1)!.key+'-15';
  const report=buildProgrammeReport(o);
  assert.match(report.period,/current month through/);
  const earlier=buildProgrammeReport({...o,endMonth:o.monthly.months.at(-2)!.key});
  assert.notEqual(programmeReportFilename(report,o.date),programmeReportFilename(earlier,o.date));
});
