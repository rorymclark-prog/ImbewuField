'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FileText, MapPin, Plus, ArrowRight } from 'lucide-react';
import MenuButton from '@/components/MenuButton';
import BackButton from '@/components/BackButton';
import SettingsButton from '@/components/SettingsButton';
import { useAuth } from '@/lib/auth';
import { isBackendConfigured } from '@/lib/firebase/init';
import { isSampleMode } from '@/lib/sample-mode';
import { useRoleNavigation } from '@/lib/use-role-navigation';
import { canSeeWorkspaceLink } from '@/lib/role-navigation';
import { loadPlaces, type SavedPlace } from '@/lib/saved-places';
import { loadReports, reportSiteChoices, type SavedReport } from '@/lib/saved-reports';
import { designSiteIdFromLocation } from '@/lib/design-studio';
import styles from '@/components/MelDashboard.module.css';

const ReportView = dynamic(() => import('@/components/ReportView'), { ssr: false });

export default function ReportsPage() {
  const { user, loading } = useAuth();
  const { navigationRole, sample } = useRoleNavigation();
  return <ReportSites key={`${user?.uid ?? 'guest'}:${navigationRole}:${sample}`} loading={loading} signedIn={!!user} allowed={canSeeWorkspaceLink(navigationRole, '/reports')} />;
}

function ReportSites({ loading, signedIn, allowed }: { loading: boolean; signedIn: boolean; allowed: boolean }) {
  const router = useRouter();
  const [places, setPlaces] = useState<SavedPlace[]>([]);
  const [reports, setReports] = useState<SavedReport[]>([]);
  const [ready, setReady] = useState(false);
  const [sample, setSample] = useState(false);
  const [opened, setOpened] = useState<SavedReport | null>(null);
  const [error, setError] = useState('');
  const [opening, setOpening] = useState(false);
  const [view,setView]=useState<'sites'|'reports'>('sites');
  useEffect(() => {
    if (loading || !allowed) return;
    if (isBackendConfigured() && !signedIn && !isSampleMode()) { router.replace('/login?from=%2Freports'); return; }
    const refresh = () => { setPlaces(loadPlaces()); setReports(loadReports()); setSample(isSampleMode()); setReady(true); };
    refresh();
    window.addEventListener('permamap-places-changed', refresh);
    window.addEventListener('imbewu-reports-changed', refresh);
    window.addEventListener('storage', refresh);
    return () => { window.removeEventListener('permamap-places-changed', refresh); window.removeEventListener('imbewu-reports-changed', refresh); window.removeEventListener('storage', refresh); };
  }, [loading, signedIn, allowed, router]);
  async function openSaved(report: SavedReport) {
    setOpening(true); setError('');
    try { await import('@/components/ReportView'); setOpened(report); }
    catch { setError('The report viewer could not load. Reconnect and try opening the saved report again.'); }
    finally { setOpening(false); }
  }
  const choices = reportSiteChoices(reports, places);
  if (opened) return <ReportView locationData={opened.location} siteData={opened.siteData} waterData={opened.waterData} savedPlaces={places} savedReport={opened} activePlaceId={places.find(p => designSiteIdFromLocation(p) === designSiteIdFromLocation(opened.location))?.id} onClose={() => setOpened(null)} />;
  return <main className={styles.root} style={{ height: '100dvh' }}><div className={styles.wrap}>
    <header className={styles.row}><MenuButton /><BackButton fallback="/home" /><SettingsButton /></header>
    <div className={styles.hero} style={{ marginTop: 20 }}><h1>Saved sites & reports</h1><p>Choose a site to prepare and generate its Site Analysis Report, or reopen a report you have already saved.</p></div>
    {!allowed ? <p>Your funder workspace contains the programme reports shared with you. <Link href="/funder">Open funder view</Link></p> : !ready ? <p>Loading your saved sites…</p> : <>
      {sample && <p className={styles.notice}>Sample workspace · your real sites and saved reports are kept separate.</p>}
      <div className={styles.row} aria-label="Choose sites or reports"><button aria-pressed={view==='sites'} onClick={()=>setView('sites')}>Saved sites · {choices.filter(c=>c.place).length}</button><button aria-pressed={view==='reports'} onClick={()=>setView('reports')}>Saved reports · {reports.length}</button></div>
      <Link href="/farmer?reportSite=new&guided=1" className={styles.card} style={{ display:'flex', gap:14, alignItems:'center', margin:'20px 0' }}><Plus size={28}/><div><h2>Select a new site on the map</h2><p style={{margin:0}}>Search for a place or tap its position, then continue to its report.</p></div><ArrowRight style={{marginLeft:'auto',flexShrink:0}}/></Link>
      {error && <p role="alert" className={styles.error}>{error}</p>}
      {view==='sites'&&<><h2>Saved sites</h2><p>Open a site to generate a report and see which photos, test results, survey details and design work would improve it.</p>
      {!choices.some(c=>c.place) && <div className={styles.card}><h3>No sites saved yet</h3><p>Select a site on the map to begin. Name and save it in the report workspace so you can return here.</p></div>}
      <div className={styles.grid}>{choices.filter(c => c.place).map(choice => { const place=choice.place!; const latest=choice.reports[0]; const href=`/farmer?site=${encodeURIComponent(place.id)}&openReport=1`; return <article className={styles.card} key={choice.siteId}>
        <MapPin size={28} aria-hidden="true"/><h2 style={{marginTop:14}}>{place.name || 'Saved site'}</h2><p>{Math.abs(place.lat).toFixed(5)}°{place.lat<0?'S':'N'} · {Math.abs(place.lon).toFixed(5)}°{place.lon<0?'W':'E'}</p>
        <p>{latest ? `${choice.reports.length} saved report${choice.reports.length===1?'':'s'} · latest ${new Date(latest.savedAt).toLocaleDateString('en-ZA')}` : 'Ready for its first report'}</p>
        <Link href={href} aria-label={`Open report workspace for ${place.name}`} style={{display:'inline-flex',minHeight:44,alignItems:'center',gap:8,fontWeight:600}}><FileText size={18}/>Open site & generate report <ArrowRight size={16}/></Link>
        {latest&&<p><button disabled={opening} onClick={()=>void openSaved(latest)}>Read latest saved report</button></p>}
      </article>; })}</div></>}
      {view==='reports'&&<><h2>Saved reports</h2><p>Open an earlier report without generating it again. Each report retains its saved text and site snapshot.</p>{!reports.length&&<p>{sample?'Sample reports can be viewed and exported. Saving report history is available in your own workspace.':'No saved reports yet. Open a saved site, generate its report and choose Save.'}</p>}{choices.filter(c=>c.reports.length).map(choice=><section className={styles.card} style={{marginBottom:16}} key={choice.siteId}><h3>{choice.place?.name??'Reports from places not saved as sites'}</h3>{!choice.place&&<p>These reports remain available even if their saved pin was removed.</p>}{choice.reports.map(report=><p key={report.id}><button disabled={opening} onClick={()=>void openSaved(report)}>{report.name} · {new Date(report.savedAt).toLocaleString('en-ZA')}</button></p>)}</section>)}</>}
    </>}
  </div></main>;
}
