'use client';
import { useEffect, useState } from 'react';
import { deliverFile } from '@/lib/file-delivery';
import { useAuth } from '@/lib/auth';
import { paidApiHeaders } from '@/lib/api-client-auth';
import { isSampleMode } from '@/lib/sample-mode';
import { sampleRead } from '@/lib/sample-operations';
import { freshEvidenceData, type ProgrammeBranding, type VenuePhoto } from '@/lib/programme-evidence';
import styles from './MelDashboard.module.css';
import visualStyles from './report/VisualReport.module.css';
import ReportVisualOverview from './report/ReportVisualOverview';
import type { ReportPresentation, ReportVisuals } from '@/lib/report-visuals';
import { prepareVisualPdfAssets } from '@/lib/report-visual-pdf';

import { buildProgrammePdf, type ReportSection } from '@/lib/programme-report-pdf';
export type { ReportSection } from '@/lib/programme-report-pdf';
export default function ReportComposer({ title, sample, sections, branding: suppliedBranding, orgId, photos = [], photoHeading = 'Site photographs', photosByDefault = false, visuals, reportDate }: { title: string; sample: boolean; sections: ReportSection[]; branding?: ProgrammeBranding; orgId?: string | null; photos?: VenuePhoto[]; photoHeading?: string; photosByDefault?: boolean; visuals?: ReportVisuals; reportDate?: string }) {
  const { profile } = useAuth();
  const [loadedBranding, setLoadedBranding] = useState<ProgrammeBranding>();
  const branding = suppliedBranding ?? loadedBranding;
  useEffect(() => {
    let cancelled = false; setLoadedBranding(undefined);
    if (suppliedBranding) return;
    if (sample && isSampleMode()) { setLoadedBranding(sampleRead('programme-evidence', freshEvidenceData).branding); return; }
    const id = orgId ?? (profile?.role !== 'funder' ? profile?.org_id : null);
    if (!id || sample) return;
    void (async () => { try { const res = await fetch(`/api/programme-evidence?org=${encodeURIComponent(id)}&mode=branding`, { headers: await paidApiHeaders() }); if (res.ok) { const d = await res.json(); if (!cancelled) setLoadedBranding(d.branding); } } catch { /* The report remains available without optional branding. */ } })();
    return () => { cancelled = true; };
  }, [orgId, profile, sample, suppliedBranding]);
  const [includePhotos, setIncludePhotos] = useState(photosByDefault);
  const [presentation, setPresentation] = useState<ReportPresentation>('screen');
  const [format, setFormat] = useState<'summary' | 'full'>(sample ? 'full' : 'summary');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const visible = sections.map(s => ({ ...s, lines: format === 'summary' ? s.lines.slice(0, 5) : s.lines }));
  async function download() {
    setBusy(true); setError('');
    try {
      const attached = includePhotos ? await Promise.all(photos.map(async photo => {
        if (!photo.image.startsWith('/demo/sites/') && !photo.image.startsWith('/demo/reports/')) return photo;
        const response = await fetch(photo.image);
        if (!response.ok) throw Error('Site photo unavailable');
        const blob = await response.blob();
        const image = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(blob); });
        return { ...photo, image };
      })) : [];
      const visual = visuals && presentation !== 'ink' ? { visuals, assets: await prepareVisualPdfAssets(visuals, attached), date: reportDate ?? new Date().toISOString().slice(0, 10) } : undefined;
      const doc = await buildProgrammePdf(title, sample, sections, format, branding, attached, photoHeading, visual);
      await deliverFile(doc.output('blob'), `${sample ? 'Sample-' : ''}ImbewuField-${title.replace(/[^a-zA-Z0-9]+/g, '-')}.pdf`, title);
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
  return <article className={styles.card} style={{ marginTop: 20 }}>
    {branding && <div className={styles.grid} style={{ marginBottom: 20 }}>{(['organisation','garden','funder'] as const).map(key => branding[key].label || branding[key].image ? <div key={key} style={{ display:'flex', alignItems:'center', gap:12 }}>{branding[key].image ? <img src={branding[key].image} alt={`${key} logo`} style={{width:88,height:88,objectFit:'contain'}} /> : <span aria-hidden="true" style={{width:48,height:48,display:'grid',placeItems:'center',borderRadius:12,background:'#e7efe5',color:'#245739',fontWeight:700}}>{key==='organisation'?'O':key==='garden'?'G':'F'}</span>}<div><small style={{fontSize:12,color:'#526454'}}>{key==='organisation'?'Implemented by':key==='garden'?'Community / project':'Supported by'}</small><p style={{margin:0,fontWeight:600}}>{branding[key].label}</p></div></div> : null)}</div>}
    <div className={styles.row}><h2>{title}</h2><span className={styles.tag}>{sample ? 'Fictional sample' : 'Recorded data'}</span></div>
    <div className={styles.row}><button type="button" aria-pressed={format === 'summary'} onClick={() => setFormat('summary')}>Brief summary</button><button type="button" aria-pressed={format === 'full'} onClick={() => setFormat('full')}>Full report</button><button type="button" className={styles.primary} disabled={busy} onClick={() => void download()}>{busy ? 'Preparing…' : sample ? 'Generate new report PDF' : 'Download ink-saving PDF'}</button></div>
    <p>{sample && 'The full sample report is ready below. Generate a new PDF to include your current practice records. '}White paper, dark text and no background pictures. {format === 'summary' ? 'Showing up to five items per section; page count depends on the content.' : 'Includes all items available in this view.'}</p>
    {photos.length > 0 && <label className={styles.option}><input type="checkbox" checked={includePhotos} onChange={e=>setIncludePhotos(e.target.checked)} />Include {photos.length} photos in the PDF (uses more ink)</label>}
    {error && <p role="alert" className={styles.error}>{error}</p>}
    <div className={styles.grid}>{visible.map(s => <section key={s.title} className={styles.card}><h3>{s.title}</h3>{s.lines.length ? s.lines.map((line, i) => <p key={i}>{line}</p>) : <p>Nothing recorded yet.</p>}</section>)}</div>
  </article>;
}
