'use client';

import workspace from '@/components/layout/Workspace.module.css';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { Loader2, MapPin, MessageCircle, Flag, ChevronDown, ChevronUp } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { translate,useLanguage } from '@/lib/i18n';
import LanguageDraftNote from '@/components/LanguageDraftNote';
import { inlineText } from '@/lib/xh-inline';
import { useAppLevel } from '@/lib/app-level';
import { communityEnabled } from '@/lib/community/flag';
import { getCommunityProfile, getOrCreateThread, reportContent } from '@/lib/db/community-queries';
import type { CommunityProfile } from '@/lib/db/types';
import TabBar from '@/components/TabBar';
import LessonLink from '@/components/design/LessonLink';
import AppHeader from '@/components/layout/AppHeader';

export default function PublicCommunityProfilePage() {
  const { user, loading } = useAuth();
  const { t: localeT, lang } = useLanguage();
  // isiXhosa: a key the xh locale has not translated yet falls back to English; show the unreviewed
  // draft keyed by that same English instead (lib/locales/xh-inline). Other languages keep localeT.
  const t = (key: string) => { const text = localeT(key); return (lang === 'xh' || lang === 'af') && text === translate('en', key) ? inlineText(lang, text) : text; };
  const draft=['zu','xh','af','st','ts','ve'].includes(lang);
  const paired=(key:string)=><><span lang={t(key)===translate('en',key)?'en':lang}>{t(key)}</span>{draft&&<small lang="en" style={{display:'block',fontSize:12,lineHeight:1.4,marginTop:4}}><span lang={lang}>{t('offlineSourceLabel')}: </span>{translate('en',key)}</small>}</>;
  const router = useRouter();
  const params = useParams<{ uid: string }>();
  const targetUid = params.uid;
  const simple = useAppLevel() === 'simple';

  const [profile, setProfile] = useState<CommunityProfile | null>(null);
  const [busy, setBusy] = useState(true);
  const [loadError,setLoadError]=useState(false);
  const [loadAttempt,setLoadAttempt]=useState(0);
  const [moreOpen, setMoreOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportSent, setReportSent] = useState(false);
  const [reportBusy, setReportBusy] = useState(false);
  const [reportError, setReportError] = useState(false);
  const [messaging, setMessaging] = useState(false);
  const [messageError, setMessageError] = useState(false);

  useEffect(() => {
    if (!communityEnabled()) { router.replace('/home'); return; }
    if (!loading && !user) { router.replace('/login'); return; }
    let active=true;
    if (user && targetUid) {
      // A failed read is not evidence that a farmer withdrew their profile.
      setBusy(true);setLoadError(false);setProfile(null);
      setReportOpen(false);setReportReason('');setReportSent(false);setReportError(false);setMessageError(false);
      getCommunityProfile(targetUid).then((p) => { if(active){setProfile(p);setBusy(false);} }).catch(() => {if(active){setLoadError(true);setBusy(false);}});
    }
    return()=>{active=false;};
  }, [user, loading, router, targetUid,loadAttempt]);

  // getOrCreateThread() is a Firestore round trip (a query, sometimes a write).
  // On a weak signal it can reject, and an uncaught rejection here used to mean
  // tapping "Message" simply did nothing — no navigation, no error, no way to
  // tell the tap even registered.
  async function handleMessage() {
    if (!profile || messaging) return;
    setMessaging(true);
    setMessageError(false);
    try {
      const id = await getOrCreateThread(profile.uid, profile.display_name);
      if (id) { router.push(`/community/messages/${id}`); return; }
      setMessageError(true);
    } catch (err) {
      console.error('getOrCreateThread failed', err);
      setMessageError(true);
    } finally {
      setMessaging(false);
    }
  }

  async function handleReport() {
    if (!profile || !reportReason.trim() || reportBusy) return;
    setReportBusy(true);
    setReportError(false);
    try {
      await reportContent('profile', profile.uid, profile.uid, reportReason.trim());
      setReportSent(true);
      setReportReason('');
      setTimeout(() => { setReportSent(false); setReportOpen(false); }, 2000);
    } catch (err) {
      console.error('reportContent failed', err);
      setReportError(true);
    } finally {
      setReportBusy(false);
    }
  }

  const header=<AppHeader backFallback="/community" title={t('communityMemberTitle')} right={<LessonLink id="community:profile" label={t('homeLearnAction')}/>}/>;
  const notice=<div className="px-4 pt-3"><LanguageDraftNote lang={lang} scope="community-member"/></div>;
  if (busy || loading || !communityEnabled()) {
    return <div lang={lang} className="h-[100dvh] flex flex-col" style={{background:'var(--bg-0)',color:'var(--text-primary)'}}>{header}{notice}<main className="flex-1 flex flex-col items-center justify-center gap-3 px-6"><h1 className="font-display font-bold" style={{fontSize:20}}>{t('communityMemberTitle')}</h1><div role="status" aria-label={t('communityLoadingStatus')}><Loader2 size={24} className="animate-spin" aria-hidden style={{color:'var(--color-forest-800)'}}/><p>{t('communityLoadingStatus')}</p></div></main><TabBar hideAtDesktop/></div>;
  }

  return (
    <div lang={lang} className="h-[100dvh] flex flex-col font-sans" style={{ background: 'var(--bg-0)', color: 'var(--text-primary)' }}>
      {header}{notice}

      <main className={`${workspace.workspace} ${workspace.readingWidth} flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6`}>
        {loadError?<div className="rounded-2xl px-4 py-10 text-center" style={{background:'var(--bg-1)',border:'1px solid var(--border)'}}><h1 className="font-display font-bold" style={{fontSize:20}}>{t('communityMemberTitle')}</h1><p role="alert">{paired('communityMemberLoadError')}</p><button type="button" onClick={()=>setLoadAttempt(n=>n+1)} className="rounded-xl px-4 py-2 font-semibold" style={{minHeight:44,background:'var(--brand)',color:'var(--on-forest)'}}>{t('communityRetry')}</button></div>:!profile ? (
          <div className="rounded-2xl px-4 py-10 text-center" style={{ background: 'var(--bg-1)', border: '1px solid var(--border)' }}>
            <h1 className="font-display font-bold" style={{fontSize:20}}>{t('communityMemberTitle')}</h1><p className="font-sans" style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{paired('communityProfileUnavailable')}</p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-4" style={{ marginBottom: 18 }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, background: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {profile.photos?.[0]
                  ? <img data-photo-preview src={profile.photos[0]} alt={profile.display_name} lang="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <span style={{ color: 'var(--on-forest)', fontWeight: 700, fontSize: 22 }}>{(profile.display_name?.[0] ?? '?').toUpperCase()}</span>}
              </div>
              <div>
                <h1 lang="" className="font-display font-bold" style={{ margin: 0, fontSize: 20, color: 'var(--text-primary)' }}>{profile.display_name}</h1>
                {profile.area_text && (
                  <div className="flex items-center gap-1.5" style={{ marginTop: 2 }}>
                    <MapPin size={12} style={{ color: 'var(--text-muted)' }} />
                    <span lang="" className="font-sans" style={{ fontSize: 13, color: 'var(--text-muted)' }}>{profile.area_text}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Simple shows name, place and crops plainly; bio, photos and Report are secondary
                detail tucked behind one More disclosure. All tools shows everything, as today. */}
            {simple && (
              <button
                type="button"
                onClick={() => setMoreOpen((s) => !s)}
                aria-expanded={moreOpen}
                className="flex items-center gap-1 font-sans font-semibold"
                style={{ fontSize: 12.5, color: 'var(--color-forest-800)', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, marginBottom: 14 }}
              >
                {moreOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                {moreOpen ? t('communityLessLabel') : t('communityMoreLabel')}
              </button>
            )}

            {(!simple || moreOpen) && profile.bio && (
              <p lang="" className="font-sans max-w-prose" style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 16 }}>{profile.bio}</p>
            )}

            {profile.crops?.length > 0 && (
              <div className="flex flex-wrap gap-2" style={{ marginBottom: 18 }}>
                {profile.crops.map((c) => (
                  <span key={c} lang="" className="font-sans" style={{ fontSize: 12.5, padding: '5px 12px', borderRadius: 999, background: 'rgba(31,77,43,0.08)', color: 'var(--color-forest-800)', border: '1px solid rgba(31,77,43,0.2)' }}>{c}</span>
                ))}
              </div>
            )}

            {(!simple || moreOpen) && profile.photos?.length > 0 && (
              <div className="flex flex-wrap gap-2" style={{ marginBottom: 20 }}>
                {profile.photos.map((url, i) => (
                  <img key={i} src={url} alt={t('communityMemberPhotoAlt').replace(/\{(name|number|total)\}/g,(_,key:string)=>({name:profile.display_name,number:String(i+1),total:String(profile.photos.length)})[key as 'name'|'number'|'total'])} style={{ width: 96, height: 96, objectFit: 'cover', borderRadius: 12 }} />
                ))}
              </div>
            )}

            {user?.uid !== profile.uid && (
              <div className="flex gap-2">
                {/* The forest accent becomes light in dark themes; the stable action fill keeps this caption readable. */}
                <button
                  onClick={handleMessage}
                  disabled={messaging} aria-busy={messaging}
                  className="flex items-center justify-center gap-2 font-display font-semibold rounded-xl"
                  style={{ flex: 1, background: 'var(--color-forest-800)', color: 'var(--on-forest-800)', border: 'none', cursor: messaging ? 'default' : 'pointer', padding: '12px 16px', fontSize: 14, opacity: messaging ? 0.7 : 1 }}
                >
                  {messaging ? <Loader2 size={16} className="animate-spin" /> : <MessageCircle size={16} />}
                  {t('communityMessageButton')}
                </button>
                {(!simple || moreOpen) && (
                  <button
                    onClick={() => setReportOpen((s) => !s)} aria-expanded={reportOpen} aria-controls="community-member-report"
                    className="flex items-center justify-center gap-2 font-sans font-semibold rounded-xl"
                    style={{ background: 'transparent', color: 'var(--text-primary)', border: '1px solid var(--danger)', minHeight:44, cursor: 'pointer', padding: '12px 16px', fontSize: 13 }}
                  >
                    <Flag size={14} /> {t('communityReportButton')}
                  </button>
                )}
              </div>
            )}

            {messageError && (
              <p role="alert" className="font-sans" style={{ fontSize: 12, color: 'var(--text-primary)', borderInlineStart:'3px solid var(--danger)', paddingInlineStart:8, margin: '8px 0 0' }}>
                {paired('communityContactError')}
              </p>
            )}

            {reportOpen && (
              <div id="community-member-report" className="rounded-2xl p-4" style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', marginTop: 12 }}>
                <label htmlFor="community-member-report-reason" className="block font-sans font-semibold mb-2" style={{fontSize:13}}>{paired('communityReportReasonPlaceholder')}</label>
                <textarea
                  id="community-member-report-reason"
                  lang=""
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value.slice(0, 300))}
                  placeholder={t('communityReportReasonPlaceholder')}
                  rows={3}
                  className="w-full rounded-xl px-3 py-2.5 font-sans focus-visible:ring-2 focus-visible:ring-[var(--gold)]"
                  style={{ fontSize: 13.5, background: 'var(--bg-1)', border: '1px solid var(--border-strong)', color: 'var(--text-primary)', outline: 'none', resize: 'none', marginBottom: 10 }}
                />
                <button
                  onClick={handleReport}
                  disabled={!reportReason.trim() || reportBusy} aria-busy={reportBusy}
                  className="font-sans font-semibold rounded-xl"
                  style={{ minHeight:44, padding: '9px 16px', fontSize: 13, background: reportReason.trim() ? 'var(--danger)' : 'rgba(32,25,15,0.1)', color: reportReason.trim() ? '#fff' : 'var(--text-muted)', border: 'none', cursor: reportReason.trim() && !reportBusy ? 'pointer' : 'default' }}
                >
                  <span role={reportSent?'status':undefined}>{reportSent ? t('communityReportSent') : t('communityReportSubmit')}</span>
                </button>
                {reportError && (
                  <p role="alert" className="font-sans" style={{ fontSize: 12, color: 'var(--text-primary)', borderInlineStart:'3px solid var(--danger)', paddingInlineStart:8, margin: '8px 0 0' }}>
                    {paired('communityReportError')}
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </main>

      <TabBar hideAtDesktop />
    </div>
  );
}
