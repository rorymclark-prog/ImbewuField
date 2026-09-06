'use client';

import workspace from '@/components/layout/Workspace.module.css';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, Loader2, MapPin, MessageCircle, Flag } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useLanguage } from '@/lib/i18n';
import { communityEnabled } from '@/lib/community/flag';
import { getCommunityProfile, getOrCreateThread, reportContent } from '@/lib/db/community-queries';
import type { CommunityProfile } from '@/lib/db/types';
import BrandLogo from '@/components/BrandLogo';
import TabBar from '@/components/TabBar';
import LessonLink from '@/components/design/LessonLink';
import MenuButton from '@/components/MenuButton';
import BackButton from '@/components/BackButton';

export default function PublicCommunityProfilePage() {
  const { user, loading } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();
  const params = useParams<{ uid: string }>();
  const targetUid = params.uid;

  const [profile, setProfile] = useState<CommunityProfile | null>(null);
  const [busy, setBusy] = useState(true);
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
    if (user && targetUid) {
      getCommunityProfile(targetUid).then((p) => { setProfile(p); setBusy(false); }).catch(() => setBusy(false));
    }
  }, [user, loading, router, targetUid]);

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

  if (busy || loading || !communityEnabled()) {
    return (
      <div className="h-[100dvh] flex items-center justify-center" style={{ background: '#E4DCC6' }}>
        <Loader2 size={24} className="animate-spin" style={{ color: '#1F4D2B' }} />
      </div>
    );
  }

  return (
    <div className="h-[100dvh] flex flex-col font-sans" style={{ background: '#E4DCC6', color: '#20190F' }}>
      <header className="flex-shrink-0 flex items-center gap-3 px-4" style={{ height: 56, borderBottom: '1px solid #E2D8C4', background: '#FFFEFA' }}>
        <MenuButton /><BackButton fallback="/home" />
        <Link href="/community" style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#5C5040', textDecoration: 'none' }}>
          <ChevronLeft size={18} strokeWidth={1.7} />
        </Link>
        <BrandLogo />
        <div style={{ flex: 1 }} />
        <LessonLink id="community:profile" label="Learn" />
      </header>

      <main className={`${workspace.workspace} ${workspace.readingWidth} flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6`}>
        {!profile ? (
          <div className="rounded-2xl px-4 py-10 text-center" style={{ background: '#FFFEFA', border: '1px solid #E2D8C4' }}>
            <p className="font-sans" style={{ fontSize: 13, color: '#5C5040' }}>This profile is no longer available.</p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-4" style={{ marginBottom: 18 }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, background: '#1F4D2B', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {profile.photos?.[0]
                  ? <img data-photo-preview src={profile.photos[0]} alt={profile.display_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <span style={{ color: '#F7F2E9', fontWeight: 700, fontSize: 22 }}>{(profile.display_name?.[0] ?? '?').toUpperCase()}</span>}
              </div>
              <div>
                <div className="font-display font-bold" style={{ fontSize: 20, color: '#20190F' }}>{profile.display_name}</div>
                {profile.area_text && (
                  <div className="flex items-center gap-1.5" style={{ marginTop: 2 }}>
                    <MapPin size={12} style={{ color: '#8C7A62' }} />
                    <span className="font-sans" style={{ fontSize: 13, color: '#8C7A62' }}>{profile.area_text}</span>
                  </div>
                )}
              </div>
            </div>

            {profile.bio && (
              <p className="font-sans max-w-prose" style={{ fontSize: 14, color: '#5C5040', lineHeight: 1.6, marginBottom: 16 }}>{profile.bio}</p>
            )}

            {profile.crops?.length > 0 && (
              <div className="flex flex-wrap gap-2" style={{ marginBottom: 18 }}>
                {profile.crops.map((c) => (
                  <span key={c} className="font-sans" style={{ fontSize: 12.5, padding: '5px 12px', borderRadius: 999, background: 'rgba(31,77,43,0.08)', color: '#1F4D2B', border: '1px solid rgba(31,77,43,0.2)' }}>{c}</span>
                ))}
              </div>
            )}

            {profile.photos?.length > 0 && (
              <div className="flex flex-wrap gap-2" style={{ marginBottom: 20 }}>
                {profile.photos.map((url, i) => (
                  <img key={i} src={url} alt="" style={{ width: 96, height: 96, objectFit: 'cover', borderRadius: 12 }} />
                ))}
              </div>
            )}

            {user?.uid !== profile.uid && (
              <div className="flex gap-2">
                <button
                  onClick={handleMessage}
                  disabled={messaging}
                  className="flex items-center justify-center gap-2 font-display font-semibold rounded-xl"
                  style={{ flex: 1, background: '#1F4D2B', color: '#F7F2E9', border: 'none', cursor: messaging ? 'default' : 'pointer', padding: '12px 16px', fontSize: 14, opacity: messaging ? 0.7 : 1 }}
                >
                  {messaging ? <Loader2 size={16} className="animate-spin" /> : <MessageCircle size={16} />}
                  {t('communityMessageButton')}
                </button>
                <button
                  onClick={() => setReportOpen((s) => !s)}
                  className="flex items-center justify-center gap-2 font-sans font-semibold rounded-xl"
                  style={{ background: 'transparent', color: '#8B2020', border: '1px solid rgba(139,32,32,0.3)', cursor: 'pointer', padding: '12px 16px', fontSize: 13 }}
                >
                  <Flag size={14} /> {t('communityReportButton')}
                </button>
              </div>
            )}

            {messageError && (
              <p className="font-sans" style={{ fontSize: 12, color: '#8B2020', margin: '8px 0 0' }}>
                {t('communityContactError')}
              </p>
            )}

            {reportOpen && (
              <div className="rounded-2xl p-4" style={{ background: '#FFFEFA', border: '1px solid #E2D8C4', marginTop: 12 }}>
                <textarea
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value.slice(0, 300))}
                  placeholder={t('communityReportReasonPlaceholder')}
                  rows={3}
                  className="w-full rounded-xl px-3 py-2.5 font-sans"
                  style={{ fontSize: 13.5, background: '#fff', border: '1px solid #D8CBB2', color: '#20190F', outline: 'none', resize: 'none', marginBottom: 10 }}
                />
                <button
                  onClick={handleReport}
                  disabled={!reportReason.trim() || reportBusy}
                  className="font-sans font-semibold rounded-xl"
                  style={{ padding: '9px 16px', fontSize: 13, background: reportReason.trim() ? '#8B2020' : 'rgba(32,25,15,0.1)', color: reportReason.trim() ? '#fff' : '#94876F', border: 'none', cursor: reportReason.trim() && !reportBusy ? 'pointer' : 'default' }}
                >
                  {reportSent ? t('communityReportSent') : t('communityReportSubmit')}
                </button>
                {reportError && (
                  <p className="font-sans" style={{ fontSize: 12, color: '#8B2020', margin: '8px 0 0' }}>
                    {t('communityReportError')}
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </main>

      <TabBar />
    </div>
  );
}
