'use client';
import { useState } from 'react';
import { FileText, ChevronDown } from 'lucide-react';
import { useLanguage } from '@/lib/i18n';
import { buildTrainingReport } from '@/lib/training-report';
import { localTodayISODate } from '@/lib/field-teams';
import type { EvidenceData } from '@/lib/programme-evidence';
import ReportComposer from './ReportComposer';
import reports from './ProgrammeReports.module.css';
import styles from './FarmReports.module.css';

export default function FacilitatorReport({ data, project, orgId }: { data: EvidenceData; project: string; orgId: string }) {
  const { lang } = useLanguage();
  const ui = (en: string, zu: string) => lang === 'zu' ? zu : en;
  const [open, setOpen] = useState(false), [from, setFrom] = useState(''), [to, setTo] = useState(''), [ownerId, setOwnerId] = useState('');
  const today = localTodayISODate();
  const [comparePrevious,setComparePrevious]=useState(false);
  const report = buildTrainingReport(data.sessions, { project, from, to, ownerId, today, comparePrevious:Boolean(comparePrevious&&from&&to), assessments: data.assessments });
  const owners = [...new Set(data.sessions.filter(session => !project || session.project === project).map(session => session.ownerId).filter(Boolean))];
  const valid = (!from || !to || from <= to) && (!from || from <= today) && (!to || to <= today);
  return <section className={styles.root} aria-label="Facilitator report workspace">
    <button type="button" className={styles.toggle} aria-expanded={open} aria-controls="facilitator-report-workspace" onClick={() => setOpen(value => !value)}><FileText size={22} aria-hidden="true" /><span><strong>{ui('Facilitator delivery report', 'Umbiko wokulethwa kokuqeqeshwa')}</strong><small>{ui('Review saved sessions, participation, feedback and follow-up.', 'Hlola izikhathi ezilondoloziwe, ukubamba iqhaza, impendulo nokulandelela.')}</small></span><ChevronDown size={20} aria-hidden="true" className={open ? styles.up : undefined} /></button>
    {open && <div id="facilitator-report-workspace" className={reports.workspace}>
      <header className={reports.intro}><div><p className={reports.eyebrow}>DELIVERY, LEARNING & NEXT STEPS</p><h2>{report.title}</h2><p>{ui('The project selected above applies to this report. Only saved sessions are included.', 'Iphrojekthi ekhethwe ngenhla iyasebenza kulo mbiko. Kufakwa kuphela izikhathi ezilondoloziwe.')}</p></div></header>
      <section className={reports.scope} aria-label="Facilitator report scope"><div className={reports.filters}><label>{ui('From session date', 'Kusukela ngosuku lokuqeqesha')}<input type="date" max={today} value={from} onChange={event => setFrom(event.target.value)} /></label><label>{ui('To session date', 'Kuze kube ngosuku lokuqeqesha')}<input type="date" max={today} value={to} onChange={event => setTo(event.target.value)} /></label><label>{ui('Record owner', 'Umnikazi werekhodi')}<select value={ownerId} onChange={event => setOwnerId(event.target.value)}><option value="">{ui('All visible record owners', 'Bonke abanikazi bamarekhodi abonakalayo')}</option>{owners.map((id, index) => <option key={id} value={id}>Owner {index + 1} · {data.sessions.find(session => session.ownerId === id)?.facilitator || 'Name not recorded'}</option>)}{ownerId && !owners.includes(ownerId) && <option value={ownerId}>Selected owner · no records in this project</option>}</select></label></div><p>{report.scope}. {ui('Facilitator names are recorded text; ownership follows the account that saved the session.', 'Amagama abaqeqeshi abhalwe erekhodini; ubunikazi bulandela i-akhawunti elondoloze isikhathi.')}</p></section>
      <label><input type="checkbox" disabled={!from||!to||!valid} checked={Boolean(comparePrevious&&from&&to)} onChange={event=>setComparePrevious(event.target.checked)}/> Compare with the preceding date range</label><p>Choose both session dates to compare equal numbers of calendar days. Record-owner and project filters apply to both periods.</p>
      {!valid ? <p role="alert" className={reports.state}>{ui('Choose dates in order, ending today or earlier.', 'Khetha izinsuku ngokulandelana, ziphele namuhla noma ngaphambi kwalokho.')}</p> : <ReportComposer aggregate key={`${project}:${ownerId}:${from}:${to}:${comparePrevious}`} title={report.title} sample={data.sample} orgId={orgId} branding={data.branding} deviceData={data} reportLabel="Training delivery records" reportDate={today} filenameBase={report.filename} subtitle={report.scope} metrics={report.metrics} tables={report.tables} sections={report.sections} />}
    </div>}
  </section>;
}
