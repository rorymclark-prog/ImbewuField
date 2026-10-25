'use client';

import { useState } from 'react';
import { FileText, Sprout, Receipt, ChevronDown, ArrowUpRight } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useLanguage } from '@/lib/i18n';
import { inlineText } from '@/lib/xh-inline';
import type { ExpenseLog, ProductionLog, SalesLog } from '@/lib/db/types';
import type { SavedInvoice } from '@/lib/invoices';
import { buildFarmReport, type FarmReportKind } from '@/lib/farm-report';
import type { FinancePeriod } from '@/lib/farm-metrics';
import { blankBranding } from '@/lib/programme-evidence';
import ReportComposer from './ReportComposer';
import shared from './MelDashboard.module.css';
import reports from './ProgrammeReports.module.css';
import styles from './FarmReports.module.css';

export default function FarmReports({ production, sales, expenses, invoices, sample, loading, readError, online, onRetry }: {
  production: ProductionLog[]; sales: SalesLog[]; expenses: ExpenseLog[]; invoices: SavedInvoice[];
  sample: boolean; loading: boolean; readError: boolean; online: boolean; onRetry: () => void;
}) {
  const { profile, user } = useAuth();
  const { lang } = useLanguage();
  const ui = (en: string, zu: string) => inlineText(lang, en, zu);
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<FarmReportKind>('production');
  const [period, setPeriod] = useState<FinancePeriod>('season');
  const now = new Date();
  const farm = sample ? 'Demonstration farm' : profile?.farm_name?.trim() || user?.displayName || 'My farm';
  const branding = blankBranding();
  branding.organisation = { label: farm, image: sample ? '' : profile?.farm_logo || '' };
  const report = buildFarmReport({ production, sales, expenses, invoices, kind, period, now, farm, sample });
  return <section className={`${shared.root} ${styles.root}`} aria-label={inlineText(lang, 'Farm reports')}>
    <button type="button" className={styles.toggle} aria-expanded={open} aria-controls="farm-report-workspace" onClick={() => setOpen(value => !value)}>
      <FileText size={22} aria-hidden="true" /><span><strong>{ui('Production & finance reports', 'Imibiko yokukhiqiza neyezimali')}</strong><small>{ui('Read, print or download a report from this book.', 'Funda, phrinta noma ulande umbiko wale ncwadi.')}</small></span><ChevronDown size={20} aria-hidden="true" className={open ? styles.up : undefined} />
    </button>
    {open && <div id="farm-report-workspace" className={reports.workspace}>
      <header className={reports.intro}><div><p className={reports.eyebrow}>{ui('YOUR FARM, AS RECORDED', 'IPULAZI LAKHO NGOKWAMAREKHODI')}</p><h2>{ui('Farm reports', 'Imibiko yepulazi')}</h2><p>{ui('Choose a period. The preview and PDF use the same entries.', 'Khetha isikhathi. Ukubuka kuqala ne-PDF kusebenzisa amarekhodi afanayo.')}</p></div></header>
      {lang !== 'en' && <p role="note" className={reports.sample}>{lang === 'zu' ? 'Izilawuli zesiZulu ziyidrafti engakabuyekezwa. Umbhalo wokuhlaziya namathebula kuseNgisini.' : inlineText(lang, 'Report analysis and tables are currently in English. Records keep their original names and units.')} <span lang="en">{lang === 'xh' ? 'The report analysis and tables are in English; isiXhosa controls are an unreviewed draft.' : 'The report analysis and tables are in English; isiZulu controls are an unreviewed draft.'}</span></p>}
      <div className={`${reports.choices} ${styles.choices}`} aria-label={inlineText(lang, 'Farm report type')}>
        {([{ key: 'production', Icon: Sprout, title: ui('Production', 'Ukukhiqiza'), detail: ui('What was picked and recorded as sold.', 'Okuvuniwe nokuqoshwe njengokudayisiwe.') }, { key: 'finance', Icon: Receipt, title: ui('Finances', 'Izimali'), detail: ui('Money received, costs and unpaid invoices.', 'Imali etholiwe, izindleko nama-invoyisi angakhokhiwe.') }] as const).map(({ key, Icon, title, detail }) => <button type="button" key={key} className={reports.choice} aria-label={title} aria-pressed={kind === key} onClick={() => setKind(key)}><span className={reports.choiceTop}><Icon size={22} aria-hidden="true" /></span><strong>{title}</strong><span>{detail}</span></button>)}
      </div>
      <section className={reports.scope} aria-label={inlineText(lang, 'Farm report scope')}><div className={reports.scopeTitle}><h3>{ui('Set the scope', 'Khetha ububanzi')}</h3></div><label>{ui('Reporting period', 'Isikhathi sombiko')}<select value={period} onChange={event => setPeriod(event.target.value as FinancePeriod)}><option value="month">{ui('This month', 'Le nyanga')}</option><option value="season">{ui('This season', 'Le sizini')}</option><option value="year">{ui('This calendar year', 'Lo nyaka wekhalenda')}</option></select></label><p>{report.period}. {ui('All gardens in this book. Planned harvests are outside this report.', 'Zonke izingadi ezikule ncwadi. Izivuno ezihleliwe azifakiwe kulo mbiko.')}</p></section>
      {loading ? <p role="status" className={reports.state}>{ui('Loading your records…', 'Kulayishwa amarekhodi akho…')}</p> : readError ? <div role="alert" className={reports.state}><h3>{ui('Records could not be confirmed', 'Amarekhodi awakwazanga ukuqinisekiswa')}</h3><p>{ui('Some books could not be read. Retry before exporting a report so missing data is not presented as zero.', 'Ezinye izincwadi azifundekanga. Zama futhi ngaphambi kokukhipha umbiko.')}</p><button type="button" onClick={onRetry}>{ui('Retry records', 'Zama amarekhodi futhi')}</button></div> : <>
        {!online && <p role="note" className={reports.sample}>{ui('Offline: this report uses the records currently available on this device. Newer shared records may be missing.', 'Awuxhunyiwe: lo mbiko usebenzisa amarekhodi atholakala kule divayisi. Amarekhodi amasha angase angabi khona.')}</p>}
        <ReportComposer key={`${kind}:${period}`} title={report.title} sample={sample} branding={branding} reportLabel="Farm records" ownerLabel="Farm / business" sections={report.sections.map(section => !online && section.title === 'Scope & reporting basis' ? { ...section, lines: [...section.lines, 'Prepared offline from records available on this device. A successful export does not confirm that shared records are current.'], summaryLines: [...section.lines.slice(0, 4), 'Prepared offline from records available on this device. Newer shared records may be missing.'] } : section)} metrics={report.metrics} chart={report.chart} tables={report.tables} subtitle={`${farm} · ${report.period}`} reportDate={report.date} filenameBase={report.filename} />
        <div className={reports.nextReview}><div><h3>{ui('Make the next entry count', 'Rekhoda umsebenzi olandelayo')}</h3><p>{ui('Check missing records and unpaid invoices before sharing your report.', 'Hlola amarekhodi angekho nama-invoyisi angakhokhiwe ngaphambi kokwabelana ngombiko.')}</p></div><div><button type="button" onClick={() => setOpen(false)}>{ui('Back to this book', 'Buyela kule ncwadi')} <ArrowUpRight size={16} aria-hidden="true" /></button><a href="/invoice">{ui('Review invoices', 'Hlola ama-invoyisi')}</a></div></div>
      </>}
    </div>}
  </section>;
}
