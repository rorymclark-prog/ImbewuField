import test from 'node:test';
import { pdfContentStreams } from './pdf-content-streams';
import assert from 'node:assert/strict';
import { buildProgrammeReport, programmeReportCohortChoices, programmeReportFilename, type ProgrammeReportOptions } from '../lib/programme-report';
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
  const longScope = 'An unusually long project and organisation name '.repeat(5);
  assert.notEqual(programmeReportFilename({...report,scope:longScope+'A'},'2026-10-23'),programmeReportFilename({...report,scope:longScope+'B'},'2026-10-23'));
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


test('a cohort that disappears after a consent refresh stays selected instead of widening the export', () => {
  const o=options();
  const id=o.rows[0].farmer.cohortId!;
  const remaining=o.rows.filter(row=>row.farmer.cohortId!==id);
  assert.ok(remaining.length>0,'other cohorts remain visible');
  const choices=programmeReportCohortChoices(remaining,id);
  assert.equal(choices.find(c=>c.id===id)?.available,false);
  const report=buildProgrammeReport({...o,rows:remaining,cohortId:id});
  assert.equal(report.rows.length,0);
  assert.equal(report.metrics.find(m=>m.label==='Harvest logged')!.value,'Not available');
  assert.ok(!report.scope.includes('All visible cohorts'));
});

test('a branded learning report keeps the entire course distribution with its heading', async () => {
  const {SAMPLE_BRANDING}=await import('../lib/sample-branding');
  const report=buildProgrammeReport(options({kind:'training'}));
  const pdf=await buildProgrammePdf(report.title,true,report.sections,'full',{...SAMPLE_BRANDING,garden:{label:'',image:''}},[],'Evidence',undefined,{metrics:report.metrics,chart:report.chart,tables:report.tables,subtitle:report.scope+' · '+report.period,date:'2026-10-23'});
  const pages=(pdf.internal as unknown as {pages:string[][]}).pages;
  const chartPage=pages.find(page=>page?.join('\n').includes(report.chart!.title));
  assert.ok(chartPage,'the chart heading must be present');
  assert.ok(chartPage.join('\n').includes(report.chart!.rows.at(-1)!.label),'partner logos must not separate the final course bands from their heading');
});


test('unreadable activity history is unavailable while a readable old log can establish no recent activity', () => {
  const o = options({ kind: 'training', rows: structuredClone(DEMO_NETWORK.farmers.slice(0,1)) });
  const activity = () => buildProgrammeReport(o).tables.find(t => t.title === 'Learning & participation')!.rows.find(r => r[0] === 'Activity in last 90 days')!;
  o.rows[0].metrics.daysSinceActivity = null;
  assert.equal(activity()[1], 'Not available');
  assert.match(activity()[2], /0 farmers with a readable activity date/);
  o.rows[0].metrics.daysSinceActivity = 91;
  assert.equal(activity()[1], '0');
  o.rows[0].metrics.daysSinceActivity = 1;
  assert.equal(activity()[1], '1');
});

test('language: omitting it, English and isiZulu are byte-identical; isiXhosa translates the fixed wording and keeps every figure', async () => {
  const { XH_INLINE_SOURCE } = await import('../lib/locales/xh-inline/index');
  const { registerXhInline } = await import('../lib/xh-inline');
  const figures = (value: unknown) => (JSON.stringify(value).match(/\d+(?:\.\d+)?/g) ?? []).join(' ');
  const shapes: Partial<ProgrammeReportOptions>[] = [
    {}, { kind: 'production', funder: false }, { kind: 'training', funder: false },
    { basis: 'window', startMonth: DEMO_COHORT_MONTHLY.months[1].key, endMonth: DEMO_COHORT_MONTHLY.months.at(-1)!.key, date: `${DEMO_COHORT_MONTHLY.months.at(-1)!.key}-15` },
    { rows: structuredClone(DEMO_NETWORK.farmers.slice(0, 1)), withheldForConsent: 1 }, { rows: [] },
  ];
  try {
    registerXhInline(XH_INLINE_SOURCE);
    for (const shape of shapes) {
      const plain = buildProgrammeReport(options(shape));
      assert.deepEqual(buildProgrammeReport({ ...options(shape), language: 'en' }), plain);
      assert.deepEqual(buildProgrammeReport({ ...options(shape), language: 'zu' }), plain);
      const xh = buildProgrammeReport({ ...options(shape), language: 'xh' });
      // Data and numbers are untouched: the same figures, the same row/section/table structure, the same cohort and month names.
      assert.equal(figures(xh), figures(plain));
      assert.equal(xh.rows.length, plain.rows.length);
      assert.equal(xh.sections.length, plain.sections.length);
      assert.deepEqual(xh.tables.map(t => t.rows.length), plain.tables.map(t => t.rows.length));
      assert.deepEqual(xh.coverage.map(c => [c.available, c.total]), plain.coverage.map(c => [c.available, c.total]));
      assert.notEqual(xh.title, plain.title);
      assert.notEqual(xh.subtitle, plain.subtitle);
      assert.notEqual(xh.period, plain.period);
      assert.notEqual(xh.chart!.title, plain.chart!.title);
      assert.deepEqual(xh.sections.map(s => s.title).filter(title => plain.sections.some(s => s.title === title)), [], 'every section title is isiXhosa');
      assert.deepEqual(xh.tables.map(t => t.title).filter(title => plain.tables.some(t => t.title === title)), [], 'every table title is isiXhosa');
      assert.ok(xh.sections.every(s => s.lines.every((line, i) => line !== plain.sections[xh.sections.indexOf(s)].lines[i])), 'every section line is isiXhosa');
    }
    // Recorded names stay as data, and the caveats survive in isiXhosa.
    const named = options({ language: 'xh', cohortId: DEMO_NETWORK.farmers[0].farmer.cohortId! });
    const cohortName = named.rows.find(r => r.farmer.cohortId === named.cohortId)!.farmer.cohortName!;
    const report = buildProgrammeReport(named);
    assert.ok(report.scope.includes(cohortName) && report.scope.includes('Example organisation'));
    assert.match(allText(report), /asingo|akuqinisekisi|azizizo|asiziyo/);
    assert.ok(!/not evidence|does not imply/i.test(allText(report)));
  } finally { registerXhInline({}); }
  // Without the isiXhosa drafts loaded (the server, English readers) the English comes back unchanged.
  assert.deepEqual(buildProgrammeReport({ ...options(), language: 'xh' }), buildProgrammeReport(options()));
});

test('Afrikaans reader: the report body is Afrikaans, every figure and recorded name is unchanged, and English is untouched', async () => {
  const { AF_INLINE_SOURCE } = await import('../lib/locales/af-inline/index');
  const { registerInlineDrafts } = await import('../lib/xh-inline');
  const figures = (value: unknown) => (JSON.stringify(value).match(/\d+(?:\.\d+)?/g) ?? []).join(' ');
  const shapes: Partial<ProgrammeReportOptions>[] = [
    {}, { kind: 'production', funder: false }, { kind: 'training', funder: false },
    { basis: 'window', startMonth: DEMO_COHORT_MONTHLY.months[1].key, endMonth: DEMO_COHORT_MONTHLY.months.at(-1)!.key, date: `${DEMO_COHORT_MONTHLY.months.at(-1)!.key}-15` },
    { basis: 'window', comparison: { startMonth: DEMO_COHORT_MONTHLY.months[0].key, endMonth: DEMO_COHORT_MONTHLY.months[1].key }, startMonth: DEMO_COHORT_MONTHLY.months[2].key, endMonth: DEMO_COHORT_MONTHLY.months[3].key, date: `${DEMO_COHORT_MONTHLY.months.at(-1)!.key}-15` },
    { rows: structuredClone(DEMO_NETWORK.farmers.slice(0, 1)), withheldForConsent: 1 }, { rows: [] },
  ];
  // Without the Afrikaans drafts loaded (the server, English readers) the English comes back unchanged.
  assert.deepEqual(buildProgrammeReport({ ...options(), language: 'af' }), buildProgrammeReport(options()));
  try {
    registerInlineDrafts('af', AF_INLINE_SOURCE);
    for (const shape of shapes) {
      const plain = buildProgrammeReport(options(shape));
      // Omitting the language, English and isiZulu stay the English report even with the Afrikaans drafts loaded.
      assert.deepEqual(buildProgrammeReport({ ...options(shape), language: 'en' }), plain);
      assert.deepEqual(buildProgrammeReport({ ...options(shape), language: 'zu' }), plain);
      assert.deepEqual(buildProgrammeReport({ ...options(shape), language: 'xh' }), plain, 'isiXhosa without its drafts is the English report');
      const af = buildProgrammeReport({ ...options(shape), language: 'af' });
      // Data and numbers are untouched: the same figures, the same row/section/table structure, the same cohort and month names.
      assert.equal(figures(af), figures(plain));
      assert.equal(af.rows.length, plain.rows.length);
      assert.deepEqual(af.sections.map(s => s.lines.length), plain.sections.map(s => s.lines.length));
      assert.deepEqual(af.tables.map(t => [t.rows.length, t.columns.length]), plain.tables.map(t => [t.rows.length, t.columns.length]));
      assert.deepEqual(af.coverage.map(c => [c.available, c.total]), plain.coverage.map(c => [c.available, c.total]));
      assert.equal(af.chart!.rows.length, plain.chart!.rows.length);
      assert.deepEqual(af.chart!.rows.map(r => r.value), plain.chart!.rows.map(r => r.value));
      assert.deepEqual(af.metrics.map(m => m.value.match(/\d[\d ,.]*/g)), plain.metrics.map(m => m.value.match(/\d[\d ,.]*/g)), 'metric figures are identical');
      assert.deepEqual(af.comparison, plain.comparison);
      assert.notEqual(af.title, plain.title);
      assert.notEqual(af.subtitle, plain.subtitle);
      assert.notEqual(af.period, plain.period);
      assert.notEqual(af.chart!.title, plain.chart!.title);
      assert.deepEqual(af.sections.map(s => s.title).filter(title => plain.sections.some(s => s.title === title)), [], 'every section title is Afrikaans');
      assert.deepEqual(af.tables.map(t => t.title).filter(title => plain.tables.some(t => t.title === title)), [], 'every table title is Afrikaans');
      assert.deepEqual(af.metrics.map(m => m.label).filter(label => plain.metrics.some(m => m.label === label)), [], 'every metric label is Afrikaans');
      af.sections.forEach((section, i) => section.lines.forEach((line, n) => assert.notEqual(line, plain.sections[i].lines[n], `section line ${i}.${n} is Afrikaans`)));
      af.tables.forEach((table, i) => { assert.notEqual(table.note, plain.tables[i].note); table.columns.forEach((column, n) => assert.notEqual(column, plain.tables[i].columns[n], `${table.title} column ${n}`)); });
    }
    // Recorded names stay as data, and the caveats survive in Afrikaans.
    const named = options({ language: 'af', cohortId: DEMO_NETWORK.farmers[0].farmer.cohortId! });
    const cohortName = named.rows.find(r => r.farmer.cohortId === named.cohortId)!.farmer.cohortName!;
    const report = buildProgrammeReport(named);
    assert.ok(report.scope.includes(cohortName) && report.scope.includes('Example organisation'));
    assert.match(allText(report), /nie|geen/i);
    assert.ok(!/not evidence|does not imply|are visible in this selection/i.test(allText(report)));
  } finally { registerInlineDrafts('af', {}); }
});

test('Afrikaans reader: the PDF headings, metric labels and footer are Afrikaans, figures and recorded text are not, and English/isiZulu/isiXhosa are byte-identical', async () => {
  const { AF_INLINE_SOURCE } = await import('../lib/locales/af-inline/index');
  const { registerInlineDrafts } = await import('../lib/xh-inline');
  const build = async (language: 'en' | 'zu' | 'xh' | 'af' | undefined, format: 'summary' | 'full' = 'summary') => {
    const report = buildProgrammeReport({ ...options(), language: language === 'af' ? 'af' : undefined });
    // A table of recorded rows longer than the brief's five, with an accented recorded name.
    const long = { title: report.tables[0].title, note: report.tables[0].note, columns: report.tables[0].columns, rows: Array.from({ length: 8 }, (_, i) => ['Plot ' + i, String(i * 10), 'Kloof Östra']) };
    const branding = { organisation: { label: 'Example Trust' }, garden: { label: '' }, funder: { label: '' } } as unknown as Parameters<typeof buildProgrammePdf>[4];
    const pdf = await buildProgrammePdf(report.title, true, report.sections, format, branding, [], 'Evidence', undefined, {
      tables: [...report.tables, long], metrics: [...report.metrics, { label: 'Attendance', value: '7 / 9', detail: '78% present' }, { label: 'Harvest logged', value: '12 kg', detail: '3 of 9 farmers · current snapshot' }], chart: report.chart,
      language, date: '2026-10-23',
    });
    return { text: pdfContentStreams(pdf.output('arraybuffer')), pdf };
  };
  try {
    registerInlineDrafts('af', AF_INLINE_SOURCE);
    for (const format of ['summary', 'full'] as const) {
      const english = (await build(undefined, format)).text;
      // Asking for English is the same bytes as omitting the language.
      assert.equal((await build('en', format)).text, english);
      const afText = (await build('af', format)).text;
      assert.notEqual(afText, english);
      assert.match(afText, /Die Afrikaanse opskrifte is nie hersien nie; bewysteks word gehou in die taal waarin dit aangeteken is\./);
      assert.match(afText, /Toerwerkruimte/);
      assert.match(afText, /78% teenwoordig/);
      assert.match(afText, /3 van 9 boere/);
      assert.match(afText, /Programverslag/);
      // 'Geïmplementeer deur' keeps its i-diaeresis (WinAnsi octal 317 once upper-cased by af-ZA) rather than losing the letter.
      assert.match(afText, /GE(?:\\317|\xcf)MPLEMENTEER DEUR/);
      assert.ok(!/DEMONSTRATION RECORDS/.test(afText), 'the demonstration banner is Afrikaans');
      assert.match(afText, /DEMONSTRASIEREKORDS/);
      assert.match(afText, format === 'full' ? /Plot 7/ : /Plot 4/);
      if (format === 'summary') {
        assert.match(afText, /3 verdere rye in die volledige verslag\./);
        assert.match(afText, /Kort opsomming:/);
      }
      // Recorded text is written as recorded (its non-ASCII letter is kept, as in the English PDF).
      assert.match(afText, /Kloof (?:\\326|\xd6)stra/);
    }
    // Afrikaans letters survive pdfSafe (WinAnsi covers them), and unsupported symbols still go.
    const { pdfSafe } = await import('../lib/crop-export-pdf');
    assert.equal(pdfSafe('Geïmplementeer deur · Fasiliteerder, Wêreld, Boë, ôs, é'), 'Geïmplementeer deur - Fasiliteerder, Wêreld, Boë, ôs, é');
    // The footer and report-label rules are the isiZulu/isiXhosa ones: a labelled report keeps its own label.
    const labelled = await buildProgrammePdf('T', false, [], 'full', undefined, [], 'Evidence', undefined, { language: 'af', reportLabel: 'Staff evidence' });
    assert.match(pdfContentStreams(labelled.output('arraybuffer')), /Staff evidence/);
    // Without the Afrikaans drafts loaded the headings are English (the header note too, in English).
    registerInlineDrafts('af', {});
    const unloaded = (await build('af')).text;
    assert.match(unloaded, /The Afrikaans headings are unreviewed/);
    assert.ok(!/Toerwerkruimte|Programverslag/.test(unloaded));
  } finally { registerInlineDrafts('af', {}); }
});
