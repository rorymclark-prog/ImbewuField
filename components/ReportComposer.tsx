'use client';
import { numberLabel } from '@/lib/format-figures';
import { useEffect, useState } from 'react';
import { deliverFile } from '@/lib/file-delivery';
import { useAuth } from '@/lib/auth';
import { useLanguage } from '@/lib/i18n';
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
  const { lang } = useLanguage();
  const zu = lang === 'zu';
  const ui = (en: string, zuText: string) => zu ? zuText : en;
  const localizedPhotoHeading = photoHeading === 'Site photographs' ? ui(photoHeading,'Izithombe zesayithi') : photoHeading;
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
  const zuluMetric = (value: string) => zu ? ({
    'Attendance':'Ukuba khona', 'Signed register':'Uhlu olusayiniwe', 'Feedback':'Impendulo', 'Photographs':'Izithombe',
    'No register yet':'Alukho uhlu okwamanje', 'Attendance signatures':'Amasiginesha okuba khona',
    'Responses / attendees':'Izimpendulo / abebehambele', 'Session evidence':'Ubufakazi beseshini',
    'Programme evidence':'Ubufakazi bohlelo', 'Site photographs':'Izithombe zesayithi',
    'Implemented by':'Kwenziwe ngu', 'Community / project':'Umphakathi / iphrojekthi', 'Supported by':'Kwesekwe ngu',
  } as Record<string,string>)[value] ?? value.replace(/^(\d+)% present$/, '$1% bakhona') : value;
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
      const doc = await buildProgrammePdf(title, sample, sections, format, branding, attached, localizedPhotoHeading, visual, {metrics:reportMetrics,chart:reportChart,session,funder,ink:presentation==='ink',language:zu?'zu':'en'});
      await deliverFile(doc.output('blob'), `ImbewuField-${title.replace(/[^a-zA-Z0-9]+/g, '-')}.pdf`, title);
    } catch { setError('The PDF could not be created. Your records have not changed.'); }
    finally { setBusy(false); }
  }
  if (visuals) return <article className={`${visualStyles.report} ${presentation === 'ink' ? visualStyles.ink : ''}`} aria-label={title} data-report-print={presentation === 'ink' ? 'ink' : 'colour'}>
    <div className={visualStyles.controls}>
      {([['screen', ui('Screen','Isikrini')], ['colour', ui('Print · full colour','Phrinta · umbala ogcwele')], ['ink', ui('Print · save ink','Phrinta · yonga uyinki')]] as const).map(([value, label]) => <button key={value} type="button" aria-pressed={presentation === value} onClick={() => { setPresentation(value); setIncludePhotos(value !== 'ink'); }}>{label}</button>)}
      <button type="button" className={visualStyles.primary} disabled={busy} onClick={() => void download()}>{busy ? ui('Preparing…','Kuyalungiswa…') : presentation === 'ink' ? ui('Download ink-saving PDF','Landa i-PDF eyonga uyinki') : ui('Download full-colour PDF','Landa i-PDF enombala ogcwele')}</button>
    </div>
    <div className={visualStyles.controls}><button type="button" aria-pressed={format === 'summary'} onClick={() => setFormat('summary')}>{ui('Brief summary','Isifinyezo esifushane')}</button><button type="button" aria-pressed={format === 'full'} onClick={() => setFormat('full')}>{ui('Full report','Umbiko ogcwele')}</button>{photos.length > 0 && <label className={visualStyles.option}><input type="checkbox" checked={includePhotos} onChange={e => setIncludePhotos(e.target.checked)} />{ui('Include photographs and layout','Faka izithombe nokuhlelwa')}</label>}</div>
    {zu && <p role="note">Lezi izihloko nezilawuli zesiZulu ezingakabuyekezwa isikhulumi esinolwazi. Umbhalo wobufakazi nezimpendulo zabahlanganyeli ugcinwa ngolimi oqoshwe ngalo.</p>}
    {error && <p role="alert">{ui('The PDF could not be created. Your records have not changed.','I-PDF ayikwazanga ukwenziwa. Amarekhodi akho awashintshanga.')}</p>}
    <ReportVisualOverview visuals={visuals} language={lang} ink={presentation === 'ink'} compact={presentation === 'ink'} image={includePhotos && presentation !== 'ink' ? photos[0]?.image : undefined} imageCaption={photos[0]?.caption} stamp={reportDate} />
      {format === 'summary' && <p className={visualStyles.basis}>{ui('Brief summary: up to five items per section. Use the full report for every item.','Isifinyezo esifushane: kufika ezintweni ezinhlanu esigabeni ngasinye. Khetha umbiko ogcwele ukuze ubone yonke imininingwane.')}</p>}
    <div className={visualStyles.chapters}>{visible.map((section, i) => <div key={section.title}><section className={visualStyles.chapter}><div><h3>{section.title}</h3>{(section.lines.length ? section.lines : [ui('Nothing recorded yet.','Akukho okuqoshiwe okwamanje.')]).map((line, n) => <p key={n}>{line}</p>)}</div></section>{includePhotos && i === 1 && photos.slice(presentation === 'ink' ? 0 : 1).map((photo, n) => <figure key={n} className={visualStyles.evidence}><img data-photo-preview src={photo.image} alt={photo.caption} loading="lazy"/><figcaption>{photo.caption}</figcaption></figure>)}</div>)}</div>
    {branding && <div className={visualStyles.partners}>{(['organisation', 'garden', 'funder'] as const).map(key => branding[key].label || branding[key].image ? <div key={key}>{branding[key].image && <img src={branding[key].image} alt={`${key} logo`} />}<div><small>{ui(key === 'organisation' ? 'Implemented by' : key === 'garden' ? 'Community / project' : 'Supported by',key === 'organisation' ? 'Kwenziwe ngu' : key === 'garden' ? 'Umphakathi / iphrojekthi' : 'Kwesekwe ngu')}</small><p>{branding[key].label}</p></div></div> : null)}</div>}
  </article>;
  return <article className={`${reportStyles.report} ${presentation==='ink'?reportStyles.ink:''}`} aria-label={title}>
    <div className={reportStyles.controls}>{([['screen',ui('Screen','Isikrini')],['colour',ui('Print · full colour','Phrinta · umbala ogcwele')],['ink',ui('Print · save ink','Phrinta · yonga uyinki')]] as const).map(([value,label])=><button key={value} type="button" aria-pressed={presentation===value} onClick={()=>{setPresentation(value);setIncludePhotos(value!=='ink');}}>{label}</button>)}<button type="button" className={styles.primary} disabled={busy} onClick={()=>void download()}>{busy?'Preparing PDF…':ui('Download report PDF','Landa umbiko we-PDF')}</button></div>
    <div className={reportStyles.controls}><button type="button" aria-pressed={format==='summary'} onClick={()=>setFormat('summary')}>{ui('Brief summary','Isifinyezo esifushane')}</button><button type="button" aria-pressed={format==='full'} onClick={()=>setFormat('full')}>{ui('Full report','Umbiko ogcwele')}</button>{photos.length>0&&<label className={styles.option}><input type="checkbox" checked={includePhotos} onChange={e=>setIncludePhotos(e.target.checked)}/>{ui('Include photographs','Faka izithombe')}</label>}</div>
    {zu&&<p role="note">Lezi izihloko nezilawuli zesiZulu ezingakabuyekezwa isikhulumi esinolwazi. Umbhalo wobufakazi nezimpendulo zabahlanganyeli ugcinwa ngolimi oqoshwe ngalo.</p>}
    {error&&<p role="alert" className={styles.error}>{ui('The PDF could not be created. Your records have not changed.','I-PDF ayikwazanga ukwenziwa. Amarekhodi akho awashintshanga.')}</p>}
    <header className={reportStyles.head}><p>{session?`${session.date} · ${session.project}`:`${ui('Programme evidence','Ubufakazi bohlelo')} · ${reportDate??new Date().toISOString().slice(0,10)}`}</p><h2>{session?.title??title}</h2>{session&&<p style={{marginTop:10}}>{session.venue}{session.facilitator?` · ${session.facilitator}`:''}</p>}</header>
    {branding&&<div className={reportStyles.partners}>{(['organisation','garden','funder'] as const).map(key=>branding[key].label||branding[key].image?<div className={reportStyles.partner} key={key}>{branding[key].image&&<img src={branding[key].image} alt={`${key} logo`}/>}<div><small>{ui(key==='organisation'?'Implemented by':key==='garden'?'Community / project':'Supported by',key==='organisation'?'Kwenziwe ngu':key==='garden'?'Umphakathi / iphrojekthi':'Kwesekwe ngu')}</small><p>{branding[key].label}</p></div></div>:null)}</div>}
    {reportMetrics.length>0&&<div className={reportStyles.metrics}>{reportMetrics.map(m=><div key={m.label} className={reportStyles.metric}><span>{zuluMetric(m.label)}</span><strong>{m.value}</strong>{m.detail&&<p>{zuluMetric(m.detail)}</p>}</div>)}</div>}
    <div className={reportStyles.body}>
      {format==='summary'&&<p>{ui('Showing up to five items per section. Select Full report for every record.','Kuboniswa kufika ezintweni ezinhlanu esigabeni ngasinye. Khetha umbiko ogcwele ukuze ubone wonke amarekhodi.')}</p>}
      {reportChart&&<section className={reportStyles.chart}><h3>{reportChart.title}</h3>{(format==='summary'?reportChart.rows.slice(0,5):reportChart.rows).map((r,i)=><div key={i} className={reportStyles.chartRow}><span>{r.label}</span><div className={reportStyles.bar}><span style={{width:`${Math.max(0,r.value)/Math.max(reportChart.minimumScale??1,...reportChart.rows.map(r=>r.value))*100}%`}}/></div><strong>{r.display??`${numberLabel(r.value)}${reportChart.suffix??''}`}</strong></div>)}</section>}
      {session&&<section className={reportStyles.chart}><h3>{ui('Participation','Ukubamba iqhaza')}</h3><div className={reportStyles.chartRow}><span>{ui('Present','Ukhona')}</span><div className={reportStyles.bar}><span style={{width:`${session.registeredCount?session.presentCount/session.registeredCount*100:0}%`}}/></div><strong>{session.presentCount} / {session.registeredCount}</strong></div></section>}
      <div className={reportStyles.chapters}>{visible.map((s,i)=><section key={s.title} className={reportStyles.chapter}><span className={reportStyles.number}>{String(i+1).padStart(2,'0')}</span><h3>{s.title}</h3>{s.lines.length?(s.lines.length>2?<ul>{s.lines.map((line,n)=><li key={n}>{line}</li>)}</ul>:s.lines.map((line,n)=><p key={n}>{line}</p>)):<p>{ui('Nothing recorded yet.','Akukho okuqoshiwe okwamanje.')}</p>}</section>)}</div>
      {session&&!funder&&<section className={reportStyles.chart} style={{marginTop:28}}><h3>{ui('Attendance register','Uhlu lokuba khona')}</h3><div className={reportStyles.tableWrap}><table className={reportStyles.table}><thead><tr><th>{ui('Name','Igama')}</th><th>{ui('ID / reference','I-ID / inkomba')}</th><th>{ui('Attendance','Ukuba khona')}</th><th>{ui('Signature','Isiginesha')}</th><th>{ui('Certificate','Isitifiketi')}</th></tr></thead><tbody>{(format==='summary'?session.attendance.slice(0,5):session.attendance).map(a=><tr key={a.id}><td>{a.name}</td><td>{a.reference||'—'}</td><td>{a.present?ui('Present','Ukhona'):ui('Absent','Akekho')}</td><td>{a.signature?<SignatureImage name={a.name} value={a.signature}/>:a.present?ui('Not signed','Akusayinwanga'):'—'}</td><td>{a.certificate||'—'}</td></tr>)}</tbody></table></div></section>}
      {feedback&&feedback.completed>0&&<section style={{marginTop:24}}><h3>{ui('What participants said','Okushiwo ababambiqhaza')}</h3><p>{ui('{n} responses from {m} attendees.','Izimpendulo ezingu-{n} ezivela kubantu abangu-{m} abebehambele.').replace('{n}',String(feedback.completed)).replace('{m}',String(feedback.assigned))}</p><TrainingFeedbackFindings summary={feedback} zu={zu}/>{!funder&&session?.feedback?.flatMap(f=>Object.entries(f.answers).filter(([k,v])=>['course_change','course_apply'].includes(k)&&v.trim()).map(([k,v])=><blockquote key={`${f.participantId}-${k}`}><strong>{ui(k==='course_apply'?'First action in the garden':'Suggested improvement',k==='course_apply'?'Isenzo sokuqala engadini':'Isiphakamiso sokuthuthukisa')}</strong><p>{v}</p></blockquote>))}</section>}
      {includePhotos&&photos.length>0&&<section><h3 style={{marginTop:28}}>{localizedPhotoHeading}</h3><div className={reportStyles.gallery}>{photos.map((photo,i)=><figure key={i}><img data-photo-preview src={photo.image} alt={photo.caption} loading="lazy" style={photo.kind==='register'||photo.kind==='certificates'?{objectFit:'contain'}:undefined}/><figcaption>{photo.kind&&<strong>{TRAINING_PHOTO_KINDS[photo.kind]} · </strong>}{photo.caption}</figcaption></figure>)}</div></section>}
    </div><footer className={reportStyles.footer}>ImbewuField · {session&&!funder?ui('Internal session record','Irekhodi leseshini yangaphakathi'):ui('Programme report','Umbiko wohlelo')} · {format==='full'?ui('Full report','Umbiko ogcwele'):ui('Brief summary','Isifinyezo esifushane')}</footer>
  </article>;
}
