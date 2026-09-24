'use client';
import { numberLabel } from '@/lib/format-figures';
import { useEffect, useState } from 'react';
import { deliverFile } from '@/lib/file-delivery';
import { useAuth } from '@/lib/auth';
import { fieldApi } from '@/lib/field-api';
import { fieldDataReportNote } from '@/lib/field-request-model';
import { isSampleMode } from '@/lib/sample-mode';
import { sampleRead } from '@/lib/sample-operations';
import { freshEvidenceData, trainingFeedbackSummary, TRAINING_PHOTO_KINDS, type TrainingRecord, type ProgrammeBranding, type VenuePhoto } from '@/lib/programme-evidence';
import styles from './MelDashboard.module.css';
import reportStyles from './ProgrammeReport.module.css';
import { SignatureImage } from './TrainingSignature';
import { TrainingFeedbackFindings } from './TrainingFeedback';
import visualStyles from './report/VisualReport.module.css';
import ReportVisualOverview from './report/ReportVisualOverview';
import type { ReportPresentation, ReportVisuals } from '@/lib/report-visuals';
import { prepareVisualPdfAssets } from '@/lib/report-visual-pdf';

import { buildProgrammePdf, programmeReportMetrics, type ReportMetric, type ReportChart, type ReportSection } from '@/lib/programme-report-pdf';
export type { ReportSection } from '@/lib/programme-report-pdf';
export default function ReportComposer({ title, sample, sections: suppliedSections, deviceData, branding: suppliedBranding, orgId, photos = [], photoHeading = 'Site photographs', photosByDefault = false, visuals, reportDate, metrics, chart, session, funder = false }: { title: string; sample: boolean; sections: ReportSection[]; deviceData?: unknown; branding?: ProgrammeBranding; orgId?: string | null; photos?: VenuePhoto[]; photoHeading?: string; photosByDefault?: boolean; visuals?: ReportVisuals; reportDate?: string; metrics?: ReportMetric[]; chart?: ReportChart; session?: TrainingRecord; funder?: boolean }) {
  const note=fieldDataReportNote(deviceData);
  const sections=note?[{title:'Data availability',lines:[note]},...suppliedSections]:suppliedSections;
  const { profile } = useAuth();
  const [loadedBranding, setLoadedBranding] = useState<ProgrammeBranding>();
  const branding = suppliedBranding ?? loadedBranding;
  useEffect(() => {
    let cancelled = false; setLoadedBranding(undefined);
    if (suppliedBranding) return;
    if (sample && isSampleMode()) { setLoadedBranding(sampleRead('programme-evidence', freshEvidenceData).branding); return; }
    const id = orgId ?? (profile?.role !== 'funder' ? profile?.org_id : null);
    if (!id || sample) return;
    void (async () => { try { const d = await fieldApi(`/api/programme-evidence?org=${encodeURIComponent(id)}&mode=branding`); if (!cancelled) setLoadedBranding(d.branding); } catch { /* The report remains available without optional branding. */ } })();
    return () => { cancelled = true; };
  }, [orgId, profile, sample, suppliedBranding]);
  const [includePhotos, setIncludePhotos] = useState(photosByDefault);
  const [presentation, setPresentation] = useState<ReportPresentation>('screen');
  const [format, setFormat] = useState<'summary' | 'full'>('full');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const reportMetrics=programmeReportMetrics({metrics,session,funder});
  const reportChart=chart;
  const feedback=session?trainingFeedbackSummary(session,funder):null;
  const visible = sections.filter(s=>!session||!['Attendance register','Attendance summary'].includes(s.title)).map(s => ({ ...s, lines: format === 'summary' ? s.lines.slice(0, 5) : s.lines }));
  async function download() {
    setBusy(true); setError('');
    try {
      const attached = includePhotos ? await Promise.all(photos.map(async photo => {
        if (!photo.image.startsWith('/demo/')) return photo;
        const response = await fetch(photo.image);
        if (!response.ok) throw Error('Site photo unavailable');
        const blob = await response.blob();
        const image = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(blob); });
        return { ...photo, image };
      })) : [];
      const visual = visuals && presentation !== 'ink' ? { visuals, assets: await prepareVisualPdfAssets(visuals, attached), date: reportDate ?? new Date().toISOString().slice(0, 10) } : undefined;
      const doc = await buildProgrammePdf(title, sample, sections, format, branding, attached, photoHeading, visual, {metrics:reportMetrics,chart:reportChart,session,funder,ink:presentation==='ink'});
      await deliverFile(doc.output('blob'), `ImbewuField-${title.replace(/[^a-zA-Z0-9]+/g, '-')}.pdf`, title);
    } catch { setError('The PDF could not be created. Your records have not changed.'); }
    finally { setBusy(false); }
  }
  if (visuals) return <article className={`${visualStyles.report} ${presentation === 'ink' ? visualStyles.ink : ''}`} aria-label={title} data-report-print={presentation === 'ink' ? 'ink' : 'colour'}>
    <div className={visualStyles.controls}>
      {([['screen', 'Screen'], ['colour', 'Print · full colour'], ['ink', 'Print · save ink']] as const).map(([value, label]) => <button key={value} type="button" aria-pressed={presentation === value} onClick={() => { setPresentation(value); setIncludePhotos(value !== 'ink'); }}>{label}</button>)}
      <button type="button" className={visualStyles.primary} disabled={busy} onClick={() => void download()}>{busy ? 'Preparing…' : presentation === 'ink' ? 'Download ink-saving PDF' : 'Download full-colour PDF'}</button>
    </div>
    <div className={visualStyles.controls}><button type="button" aria-pressed={format === 'summary'} onClick={() => setFormat('summary')}>Brief summary</button><button type="button" aria-pressed={format === 'full'} onClick={() => setFormat('full')}>Full report</button>{photos.length > 0 && <label className={visualStyles.option}><input type="checkbox" checked={includePhotos} onChange={e => setIncludePhotos(e.target.checked)} />Include photographs and layout</label>}</div>
    {error && <p role="alert">{error}</p>}
    <ReportVisualOverview visuals={visuals} ink={presentation === 'ink'} compact={presentation === 'ink'} image={includePhotos && presentation !== 'ink' ? photos[0]?.image : undefined} imageCaption={photos[0]?.caption} stamp={reportDate} />
    {format === 'summary' && <p className={visualStyles.basis}>Brief summary: up to five items per section. Use the full report for every item.</p>}
    <div className={visualStyles.chapters}>{visible.map((section, i) => <div key={section.title}><section className={visualStyles.chapter}><div><h3>{section.title}</h3>{(section.lines.length ? section.lines : ['Nothing recorded yet.']).map((line, n) => <p key={n}>{line}</p>)}</div></section>{includePhotos && i === 1 && photos.slice(presentation === 'ink' ? 0 : 1).map((photo, n) => <figure key={n} className={visualStyles.evidence}><img data-photo-preview src={photo.image} alt={photo.caption} loading="lazy"/><figcaption>{photo.caption}</figcaption></figure>)}</div>)}</div>
    {branding && <div className={visualStyles.partners}>{(['organisation', 'garden', 'funder'] as const).map(key => branding[key].label || branding[key].image ? <div key={key}>{branding[key].image && <img src={branding[key].image} alt={`${key} logo`} />}<div><small>{key === 'organisation' ? 'Implemented by' : key === 'garden' ? 'Community / project' : 'Supported by'}</small><p>{branding[key].label}</p></div></div> : null)}</div>}
  </article>;
  return <article className={`${reportStyles.report} ${presentation==='ink'?reportStyles.ink:''}`} aria-label={title}>
    <div className={reportStyles.controls}>{([['screen','Screen'],['colour','Print · full colour'],['ink','Print · save ink']] as const).map(([value,label])=><button key={value} type="button" aria-pressed={presentation===value} onClick={()=>{setPresentation(value);setIncludePhotos(value!=='ink');}}>{label}</button>)}<button type="button" className={styles.primary} disabled={busy} onClick={()=>void download()}>{busy?'Preparing PDF…':'Download report PDF'}</button></div>
    <div className={reportStyles.controls}><button type="button" aria-pressed={format==='summary'} onClick={()=>setFormat('summary')}>Brief summary</button><button type="button" aria-pressed={format==='full'} onClick={()=>setFormat('full')}>Full report</button>{photos.length>0&&<label className={styles.option}><input type="checkbox" checked={includePhotos} onChange={e=>setIncludePhotos(e.target.checked)}/>Include photographs</label>}</div>
    {error&&<p role="alert" className={styles.error}>{error}</p>}
    <header className={reportStyles.head}><p>{session?`${session.date} · ${session.project}`:`Programme evidence · ${reportDate??new Date().toISOString().slice(0,10)}`}</p><h2>{session?.title??title}</h2>{session&&<p style={{marginTop:10}}>{session.venue}{session.facilitator?` · ${session.facilitator}`:''}</p>}</header>
    {branding&&<div className={reportStyles.partners}>{(['organisation','garden','funder'] as const).map(key=>branding[key].label||branding[key].image?<div className={reportStyles.partner} key={key}>{branding[key].image&&<img src={branding[key].image} alt={`${key} logo`}/>}<div><small>{key==='organisation'?'Implemented by':key==='garden'?'Community / project':'Supported by'}</small><p>{branding[key].label}</p></div></div>:null)}</div>}
    {reportMetrics.length>0&&<div className={reportStyles.metrics}>{reportMetrics.map(m=><div key={m.label} className={reportStyles.metric}><span>{m.label}</span><strong>{m.value}</strong>{m.detail&&<p>{m.detail}</p>}</div>)}</div>}
    <div className={reportStyles.body}>
      {format==='summary'&&<p>Showing up to five items per section. Select Full report for every record.</p>}
      {reportChart&&<section className={reportStyles.chart}><h3>{reportChart.title}</h3>{(format==='summary'?reportChart.rows.slice(0,5):reportChart.rows).map((r,i)=><div key={i} className={reportStyles.chartRow}><span>{r.label}</span><div className={reportStyles.bar}><span style={{width:`${Math.max(0,r.value)/Math.max(reportChart.minimumScale??1,...reportChart.rows.map(r=>r.value))*100}%`}}/></div><strong>{r.display??`${numberLabel(r.value)}${reportChart.suffix??''}`}</strong></div>)}</section>}
      {session&&<section className={reportStyles.chart}><h3>Participation</h3><div className={reportStyles.chartRow}><span>Present</span><div className={reportStyles.bar}><span style={{width:`${session.registeredCount?session.presentCount/session.registeredCount*100:0}%`}}/></div><strong>{session.presentCount} / {session.registeredCount}</strong></div></section>}
      <div className={reportStyles.chapters}>{visible.map((s,i)=><section key={s.title} className={reportStyles.chapter}><span className={reportStyles.number}>{String(i+1).padStart(2,'0')}</span><h3>{s.title}</h3>{s.lines.length?(s.lines.length>2?<ul>{s.lines.map((line,n)=><li key={n}>{line}</li>)}</ul>:s.lines.map((line,n)=><p key={n}>{line}</p>)):<p>Nothing recorded yet.</p>}</section>)}</div>
      {session&&!funder&&<section className={reportStyles.chart} style={{marginTop:28}}><h3>Attendance register</h3><div className={reportStyles.tableWrap}><table className={reportStyles.table}><thead><tr><th>Name</th><th>ID / reference</th><th>Attendance</th><th>Signature</th><th>Certificate</th></tr></thead><tbody>{(format==='summary'?session.attendance.slice(0,5):session.attendance).map(a=><tr key={a.id}><td>{a.name}</td><td>{a.reference||'—'}</td><td>{a.present?'Present':'Absent'}</td><td>{a.signature?<SignatureImage name={a.name} value={a.signature}/>:a.present?'Not signed':'—'}</td><td>{a.certificate||'—'}</td></tr>)}</tbody></table></div></section>}
      {feedback&&feedback.completed>0&&<section style={{marginTop:24}}><h3>What participants said</h3><p>{feedback.completed} responses from {feedback.assigned} attendees.</p><TrainingFeedbackFindings summary={feedback}/>{!funder&&session?.feedback?.flatMap(f=>Object.entries(f.answers).filter(([k,v])=>['course_change','course_apply'].includes(k)&&v.trim()).map(([k,v])=><blockquote key={`${f.participantId}-${k}`}><strong>{k==='course_apply'?'First action in the garden':'Suggested improvement'}</strong><p>{v}</p></blockquote>))}</section>}
      {includePhotos&&photos.length>0&&<section><h3 style={{marginTop:28}}>{photoHeading}</h3><div className={reportStyles.gallery}>{photos.map((photo,i)=><figure key={i}><img data-photo-preview src={photo.image} alt={photo.caption} loading="lazy" style={photo.kind==='register'||photo.kind==='certificates'?{objectFit:'contain'}:undefined}/><figcaption>{photo.kind&&<strong>{TRAINING_PHOTO_KINDS[photo.kind]} · </strong>}{photo.caption}</figcaption></figure>)}</div></section>}
    </div><footer className={reportStyles.footer}>ImbewuField · {session&&!funder?'Internal session record':'Programme report'} · {format==='full'?'Full report':'Brief summary'}</footer>
  </article>;
}
