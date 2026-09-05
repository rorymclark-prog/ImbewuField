'use client';
import { useEffect, useState } from 'react';
import { deliverFile } from '@/lib/file-delivery';
import { useAuth } from '@/lib/auth';
import { paidApiHeaders } from '@/lib/api-client-auth';
import { isSampleMode } from '@/lib/sample-mode';
import { sampleRead } from '@/lib/sample-operations';
import { freshEvidenceData, type ProgrammeBranding, type VenuePhoto } from '@/lib/programme-evidence';
import styles from './MelDashboard.module.css';

import { buildProgrammePdf, type ReportSection } from '@/lib/programme-report-pdf';
export type { ReportSection } from '@/lib/programme-report-pdf';
export default function ReportComposer({ title, sample, sections, branding: suppliedBranding, orgId, photos = [] }: { title: string; sample: boolean; sections: ReportSection[]; branding?: ProgrammeBranding; orgId?: string | null; photos?: VenuePhoto[] }) {
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
  const [includePhotos, setIncludePhotos] = useState(false);
  const [format, setFormat] = useState<'summary' | 'full'>('summary');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const visible = sections.map(s => ({ ...s, lines: format === 'summary' ? s.lines.slice(0, 5) : s.lines }));
  async function download() {
    setBusy(true); setError('');
    try {
      const doc = await buildProgrammePdf(title, sample, sections, format, branding, includePhotos ? photos : []);
      await deliverFile(doc.output('blob'), `${sample ? 'Sample-' : ''}ImbewuField-${title.replace(/[^a-zA-Z0-9]+/g, '-')}.pdf`, title);
    } catch { setError('The PDF could not be created. Your records have not changed.'); }
    finally { setBusy(false); }
  }
  return <article className={styles.card} style={{ marginTop: 20 }}>
    {branding && <div className={styles.grid} style={{ marginBottom: 20 }}>{(['organisation','garden','funder'] as const).map(key => branding[key].label || branding[key].image ? <div key={key} style={{ display:'flex', alignItems:'center', gap:12 }}>{branding[key].image ? <img src={branding[key].image} alt={`${key} logo`} style={{width:88,height:88,objectFit:'contain'}} /> : <span aria-hidden="true" style={{width:48,height:48,display:'grid',placeItems:'center',borderRadius:12,background:'#e7efe5',color:'#245739',fontWeight:700}}>{key==='organisation'?'O':key==='garden'?'G':'F'}</span>}<div><small style={{fontSize:12,color:'#526454'}}>{key==='organisation'?'Implemented by':key==='garden'?'Community / project':'Supported by'}</small><p style={{margin:0,fontWeight:600}}>{branding[key].label}</p></div></div> : null)}</div>}
    <div className={styles.row}><h2>{title}</h2><span className={styles.tag}>{sample ? 'Fictional sample' : 'Recorded data'}</span></div>
    <div className={styles.row}><button type="button" aria-pressed={format === 'summary'} onClick={() => setFormat('summary')}>Brief summary</button><button type="button" aria-pressed={format === 'full'} onClick={() => setFormat('full')}>Full report</button><button type="button" className={styles.primary} disabled={busy} onClick={() => void download()}>{busy ? 'Preparing…' : 'Download ink-saving PDF'}</button></div>
    <p>White paper, dark text and no background pictures. {format === 'summary' ? 'Showing up to five items per section; page count depends on the content.' : 'Includes all items available in this view.'}</p>
    {photos.length > 0 && <label className={styles.option}><input type="checkbox" checked={includePhotos} onChange={e=>setIncludePhotos(e.target.checked)} />Include {photos.length} venue photos in the PDF (uses more ink)</label>}
    {error && <p role="alert" className={styles.error}>{error}</p>}
    <div className={styles.grid}>{visible.map(s => <section key={s.title} className={styles.card}><h3>{s.title}</h3>{s.lines.length ? s.lines.map((line, i) => <p key={i}>{line}</p>) : <p>Nothing recorded yet.</p>}</section>)}</div>
  </article>;
}
