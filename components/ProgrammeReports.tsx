'use client';

import { useState } from 'react';
import { FileText, Sprout, GraduationCap, ShieldCheck, ArrowUpRight, SlidersHorizontal } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useNetworkPortfolio } from '@/lib/use-network-portfolio';
import { buildProgrammeReport, programmeReportCohortChoices, programmeReportFilename, PROGRAMME_REPORT_SOURCES, type ProgrammeReportKind, type ProgrammeReportBasis } from '@/lib/programme-report';
import ReportComposer from './ReportComposer';
import { SAMPLE_BRANDING } from '@/lib/sample-branding';

import styles from './MelDashboard.module.css';
import reports from './ProgrammeReports.module.css';
import { useLanguage } from '@/lib/i18n';
import { inlineText } from '@/lib/xh-inline';

// This portfolio spans several cohorts; a single demonstration garden is not its identity.
const SAMPLE_PORTFOLIO_BRANDING = { ...SAMPLE_BRANDING, garden: { label: '', image: '' } };

export default function ProgrammeReports({ funder = false, onOpenProgress, onOpenCohort }: { funder?: boolean; onOpenProgress?: () => void; onOpenCohort?: () => void }) {
  const { lang } = useLanguage();
  const ui = (en: string, zu: string) => inlineText(lang, en, zu);
  const { user } = useAuth();
  const portfolio = useNetworkPortfolio(Boolean(user));
  const [kind, setKind] = useState<ProgrammeReportKind>('overview');
  const [cohortId, setCohortId] = useState('');
  const [basis, setBasis] = useState<ProgrammeReportBasis>('cumulative');
  const [range, setRange] = useState({ start: '', end: '' });
  const [date] = useState(() => new Date().toISOString().slice(0, 10));
  const cohorts = programmeReportCohortChoices(portfolio.rows, cohortId);
  const selectedCohort = cohortId;
  // The hook clears/reloads after an organisation change. Do not expose the previous
  // organisation's report in the render before that effect has started.
  const scopeReady = portfolio.isDemo || !portfolio.orgId || portfolio.rows.every(row => row.farmer.orgId === portfolio.orgId);
  const months = portfolio.monthly.months;
  const start = months.some(m => m.key === range.start) ? range.start : months[0]?.key ?? '';
  const end = months.some(m => m.key === range.end) ? range.end : months.at(-1)?.key ?? '';
  const organisation = portfolio.isDemo ? 'Demonstration portfolio' : portfolio.orgs.find(o => o.id === portfolio.orgId)?.name ?? 'Authorised organisation';
  const report = buildProgrammeReport({ rows: portfolio.rows, monthly: portfolio.monthly, kind, funder, sample: portfolio.isDemo, organisation,
    cohortId: selectedCohort, basis, startMonth: start, endMonth: end, withheldForConsent: portfolio.withheldForConsent, date });
  const choices = [
    { key: 'overview', Icon: FileText, label: funder ? ui('Results brief', 'Isifinyezo semiphumela') : ui('Programme delivery', 'Ukulethwa kohlelo'), desc: ui('The evidence, its limits and the next decisions.', 'Ubufakazi, imikhawulo yabo nezinqumo ezilandelayo.') },
    { key: 'production', Icon: Sprout, label: ui('Production & finances', 'Ukukhiqiza nezimali'), desc: ui('Recorded harvests, sales and costs with coverage.', 'Izivuno, ukuthengisa nezindleko eziqoshiwe kanye nobubanzi bazo.') },
    { key: 'training', Icon: GraduationCap, label: ui('Learning & participation', 'Ukufunda nokubamba iqhaza'), desc: ui('Course progress, completion and recorded activity.', 'Inqubekelaphambili yezifundo, ukuqedwa nomsebenzi oqoshiwe.') },
  ] as const;
  return <section className={`${styles.root} ${reports.workspace}`} aria-label={ui('Programme reporting workspace', 'Indawo yemibiko yohlelo')}><div className={reports.wrap}>
    <header className={reports.intro}><div><p className={reports.eyebrow}>{ui('EVIDENCE INTO DECISIONS', 'UBUFAKAZI BUBE YIZINQUMO')}</p><h1>{funder ? ui('Funder reports', 'Imibiko yabaxhasi') : ui('Organisation reports', 'Imibiko yenhlangano')}</h1><p>{funder ? ui('A clear account of what is recorded, who it covers and what needs a closer look.', 'Incazelo ecacile yokuqoshiwe, ukuthi kubandakanya bani nokuthi yini edinga ukuhlolwa.') : ui('Bring delivery, learning and reporting gaps into one reviewable record.', 'Hlanganisa ukulethwa, ukufunda nezikhala zemibiko kurekhodi elilodwa.')}</p></div><ShieldCheck size={44} strokeWidth={1.25} aria-hidden="true" /></header>
    {portfolio.isDemo && <p className={reports.sample} role="note"><strong>{ui('Demonstration records', 'Amarekhodi esibonelo')}</strong> · {ui('Illustrative figures, not evidence of real programme results.', 'Amanani ayizibonelo, awubona ubufakazi bemiphumela yohlelo lwangempela.')}</p>}
    {lang === 'zu' && <p className={reports.languageNote} role="note">Izilawuli zalapha zisesiZulu. Umbhalo wokuhlaziya, amathebula nemininingwane ye-PDF kusengesiNgisi. Amagama nobufakazi kugcinwa njengoba kuqoshwe.</p>}
    {lang === 'xh' && <p className={reports.languageNote} role="note">{inlineText(lang, 'The controls here are in isiXhosa. The analysis text, tables and PDF details are still in English. Names and evidence are kept as recorded.')}</p>}
    <div className={reports.choices} aria-label={ui('Report type', 'Uhlobo lombiko')}>{choices.map(({ key, Icon, label, desc }, i) => <button type="button" key={key} className={reports.choice} aria-pressed={key === kind} onClick={() => setKind(key)}><span className={reports.choiceTop}><Icon size={22} aria-hidden="true" /><span>0{i + 1}</span></span><strong>{label}</strong><span>{desc}</span></button>)}</div>
    <section className={reports.scope} aria-labelledby="report-scope-heading"><div className={reports.scopeTitle}><SlidersHorizontal size={18} aria-hidden="true" /><h2 id="report-scope-heading">{ui('Set the scope', 'Khetha ububanzi')}</h2><span>{ui('The preview and PDF use the same selection.', 'Ukubuka kuqala ne-PDF kusebenzisa ukukhetha okufanayo.')}</span></div>
      <div className={reports.filters}>
        <label>{ui('Organisation', 'Inhlangano')}{portfolio.orgs.length ? <select value={portfolio.orgId ?? ''} onChange={e => { portfolio.setOrgId(e.target.value); setCohortId(''); setRange({ start: '', end: '' }); }}>{portfolio.orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select> : <span className={reports.fixedValue}>{organisation}</span>}</label>
        <label>{ui('Cohort', 'Iqembu')}<select value={selectedCohort} onChange={e => { setCohortId(e.target.value); if (e.target.value) setBasis('cumulative'); }}><option value="">{ui('All visible cohorts', 'Wonke amaqembu abonakalayo')}</option>{cohorts.map(({ id, label, available }) => <option key={id} value={id}>{available ? label : ui('Selected cohort · no visible records', 'Iqembu elikhethiwe · awekho amarekhodi abonakalayo')}</option>)}</select></label>
        <label>{ui('Ledger period', 'Isikhathi samarekhodi')}<select value={selectedCohort ? 'cumulative' : basis} onChange={e => setBasis(e.target.value as ProgrammeReportBasis)}><option value="cumulative">{ui('All available records', 'Wonke amarekhodi atholakalayo')}</option><option value="window" disabled={Boolean(selectedCohort) || !months.length}>{ui('Choose recorded months', 'Khetha izinyanga eziqoshiwe')}</option></select></label>
      </div>
      {basis === 'window' && !selectedCohort && <div className={reports.months}><label>{ui('From month', 'Kusukela enyangeni')}<select value={start} onChange={e => setRange({ start: e.target.value, end: end < e.target.value ? e.target.value : end })}>{months.map(m => <option key={m.key} value={m.key}>{m.longLabel}</option>)}</select></label><label>{ui('To month', 'Kuze kube enyangeni')}<select value={end} onChange={e => setRange({ start: start > e.target.value ? e.target.value : start, end: e.target.value })}>{months.filter(m => m.key >= start).map(m => <option key={m.key} value={m.key}>{m.longLabel}</option>)}</select></label></div>}
      <p>{selectedCohort ? ui('Monthly ledgers are available for the whole organisation only. This cohort report uses cumulative records.', 'Amarekhodi ezinyanga atholakala enhlanganweni yonke kuphela. Lo mbiko weqembu usebenzisa amarekhodi aqoqiwe.') : ui('Ledger dates apply to harvest, sales and costs. Learning and membership remain current snapshots.', 'Izinsuku zamarekhodi zisebenza ekuvuneni, ukuthengisa nezindleko. Ukufunda nobulungu kusalokhu kuyimininingwane yamanje.')}</p>
    </section>
    {portfolio.error ? <div className={reports.state} role="alert"><h2>{ui('Report data is unavailable', 'Idatha yombiko ayitholakali')}</h2><p>{portfolio.error}</p><button type="button" onClick={portfolio.reload}>{ui('Try again', 'Zama futhi')}</button></div> : portfolio.loading || !scopeReady ? <div className={reports.state} role="status">{ui('Loading authorised report data…', 'Kusalayishwa idatha yemibiko egunyaziwe…')}</div> : <>
      {!report.rows.length && <p className={reports.sample} role="note">{ui('No farmer records are visible. The report describes this gap; it does not imply zero programme activity.', 'Awekho amarekhodi abalimi abonakalayo. Umbiko uchaza lesi sikhala; awusho ukuthi akukho msebenzi wohlelo.')}</p>}
      <ReportComposer key={`${kind}:${portfolio.orgId}:${selectedCohort}:${basis}:${start}:${end}:${portfolio.isDemo}`} title={report.title} filenameBase={programmeReportFilename(report,date)} branding={portfolio.isDemo ? SAMPLE_PORTFOLIO_BRANDING : undefined} sample={portfolio.isDemo} funder={funder} orgId={portfolio.orgId} sections={report.sections} metrics={report.metrics} chart={report.chart} tables={report.tables} reportDate={date} subtitle={`${report.scope} · ${report.period}`} deviceData={portfolio.deviceData} />
    </>}
    {(onOpenProgress || onOpenCohort) && <section className={reports.nextReview}><div><h2>{ui('Take the review forward', 'Qhubekisela ukubuyekeza phambili')}</h2><p>{ui('Use the existing records and progress workspace to check gaps and agree the next action.', 'Sebenzisa amarekhodi nendawo yenqubekelaphambili ukuhlola izikhala nokuvumelana ngesinyathelo esilandelayo.')}</p></div><div>{onOpenCohort && <button type="button" onClick={onOpenCohort}>{ui('Review cohort records', 'Buyekeza amarekhodi eqembu')} <ArrowUpRight size={16} aria-hidden="true" /></button>}{onOpenProgress && <button type="button" onClick={onOpenProgress}>{funder ? ui('Review shared progress', 'Buyekeza inqubekelaphambili eyabiwe') : ui('Record targets & follow-up', 'Qopha imigomo nokulandelela')} <ArrowUpRight size={16} aria-hidden="true" /></button>}</div></section>}
    <aside className={reports.method}><div><h2>{ui('Designed for an honest review', 'Yenzelwe ukubuyekezwa okuthembekile')}</h2><p>{ui('Evidence comes before claims. These reporting references inform the structure; they do not certify this programme or replace an evaluation.', 'Ubufakazi buza ngaphambi kwezimangalo. Le mithombo isekela ukwakheka kombiko; ayiqinisekisi uhlelo futhi ayithathi indawo yokuhlola.')}</p></div><div>{PROGRAMME_REPORT_SOURCES.map(s => <a href={s.url} target="_blank" rel="noreferrer" key={s.url}>{s.label}<ArrowUpRight size={16} aria-hidden="true" /></a>)}</div></aside>
  </div></section>;
}
