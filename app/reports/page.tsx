'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FileText, MapPin, Plus, ArrowRight } from 'lucide-react';
import MenuButton from '@/components/MenuButton';
import BackButton from '@/components/BackButton';
import SettingsButton from '@/components/SettingsButton';
import SiteCropPlanPreview from '@/components/report/SiteCropPlanPreview';
import { useAuth } from '@/lib/auth';
import { isBackendConfigured } from '@/lib/firebase/init';
import { isSampleMode } from '@/lib/sample-mode';
import { useRoleNavigation } from '@/lib/use-role-navigation';
import { canSeeWorkspaceLink } from '@/lib/role-navigation';
import { loadPlaces, type SavedPlace } from '@/lib/saved-places';
import { loadReports, reportSiteChoices, type SavedReport } from '@/lib/saved-reports';
import { designSiteIdFromLocation } from '@/lib/design-studio';
import styles from '@/components/MelDashboard.module.css';
import { useLanguage } from '@/lib/i18n';

const ReportView = dynamic(() => import('@/components/ReportView'), { ssr: false });

export default function ReportsPage() {
  const { user, loading } = useAuth();
  const { navigationRole, sample } = useRoleNavigation();
  return <ReportSites key={`${user?.uid ?? 'guest'}:${navigationRole}:${sample}`} loading={loading} signedIn={!!user} allowed={canSeeWorkspaceLink(navigationRole, '/reports')} />;
}

function ReportSites({ loading, signedIn, allowed }: { loading: boolean; signedIn: boolean; allowed: boolean }) {
  const { t, lang } = useLanguage();
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
    catch { setError(t('reportsViewerLoadError')); }
    finally { setOpening(false); }
  }
  const choices = reportSiteChoices(reports, places);
  const dateLocale = lang === 'zu' ? 'zu-ZA' : 'en-ZA';
  if (opened) return <ReportView locationData={opened.location} siteData={opened.siteData} waterData={opened.waterData} savedPlaces={places} savedReport={opened} activePlaceId={places.find(p => designSiteIdFromLocation(p) === designSiteIdFromLocation(opened.location))?.id} onClose={() => setOpened(null)} />;
  return <main className={styles.root} style={{ height: '100dvh' }}><div className={styles.wrap}>
    <header className={styles.row}><MenuButton /><BackButton fallback="/home" /><SettingsButton /></header>
    <div className={styles.hero} style={{ marginTop: 20 }}><h1>{t('reportsTitle')}</h1><p>{t('reportsIntro')}</p></div>
    {!allowed ? <p>{t('reportsFunderNotice')} <Link href="/funder">{t('reportsOpenFunderView')}</Link></p> : !ready ? <p>{t('reportsLoading')}</p> : <>
      {sample && <p className={styles.notice}>{t('reportsSampleWorkspaceNotice')}</p>}
      <div className={styles.row} aria-label={t('reportsChooseSitesOrReports')}><button aria-pressed={view==='sites'} onClick={()=>setView('sites')}>{t('reportsSavedSites')} · {choices.filter(c=>c.place).length}</button><button aria-pressed={view==='reports'} onClick={()=>setView('reports')}>{t('reportsSavedReports')} · {reports.length}</button></div>
      <Link href="/farmer?reportSite=new&guided=1" className={styles.card} style={{ display:'flex', gap:14, alignItems:'center', margin:'20px 0' }}><Plus size={28}/><div><h2>{t('reportsSelectNewSite')}</h2><p style={{margin:0}}>{t('reportsSelectNewSiteHelp')}</p></div><ArrowRight style={{marginLeft:'auto',flexShrink:0}}/></Link>
      {error && <p role="alert" className={styles.error}>{error}</p>}
      {view==='sites'&&<><h2>{t('reportsSavedSites')}</h2><p>{t('reportsSitesDescription')}</p>
      {!choices.some(c=>c.place) && <div className={styles.card}><h3>{t('reportsNoSitesTitle')}</h3><p>{t('reportsNoSitesHelp')}</p></div>}
      <div className={styles.grid}>{choices.filter(c => c.place).map(choice => { const place=choice.place!; const latest=choice.reports[0]; const href=`/farmer?site=${encodeURIComponent(place.id)}&openReport=1`; return <article className={styles.card} key={choice.siteId}>
        <MapPin size={28} aria-hidden="true"/><h2 style={{marginTop:14}}>{place.name || t('reportsSavedSiteFallback')}</h2><p>{Math.abs(place.lat).toFixed(5)}°{place.lat<0?'S':'N'} · {Math.abs(place.lon).toFixed(5)}°{place.lon<0?'W':'E'}</p>
        <SiteCropPlanPreview siteId={choice.siteId} siteName={place.name || t('reportsSavedSiteFallback')} />
        <p>{latest ? t(choice.reports.length === 1 ? 'reportsOneSavedReportLatest' : 'reportsManySavedReportsLatest').replace('{count}', String(choice.reports.length)).replace('{date}', new Date(latest.savedAt).toLocaleDateString(dateLocale)) : t('reportsReadyForFirstReport')}</p>
        <Link href={href} aria-label={t('reportsOpenWorkspaceForSite').replace('{site}', place.name || t('reportsSavedSiteFallback'))} style={{display:'inline-flex',minHeight:44,alignItems:'center',gap:8,fontWeight:600}}><FileText size={18}/>{t('reportsOpenGenerateReport')}<ArrowRight size={16}/></Link>
        {latest&&<p><button disabled={opening} onClick={()=>void openSaved(latest)}>{opening ? t('reportsOpening') : t('reportsReadLatest')}</button></p>}
      </article>; })}</div></>}
      {view==='reports'&&<><h2>{t('reportsSavedReports')}</h2><p>{t('reportsEarlierReportsDescription')}</p>{!reports.length&&<p>{t('reportsNoSavedReports')}</p>}{choices.filter(c=>c.reports.length).map(choice=><section className={styles.card} style={{marginBottom:16}} key={choice.siteId}><h3>{choice.place?.name??t('reportsUnlinkedSiteHeading')}</h3>{!choice.place&&<p>{t('reportsRemovedPinNote')}</p>}{choice.reports.map(report=><p key={report.id}><button disabled={opening} onClick={()=>void openSaved(report)}>{report.name} · {new Date(report.savedAt).toLocaleString(dateLocale)}</button></p>)}</section>)}</>}
    </>}
  </div></main>;
}
