'use client';

import workspace from '@/components/layout/Workspace.module.css';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, Camera, Loader2, Check, Trash2, X } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useLanguage } from '@/lib/i18n';
import { useAppLevel } from '@/lib/app-level';
import { useAppConfirm } from '@/components/AppConfirm';
import { communityEnabled } from '@/lib/community/flag';
import { uploadPhoto } from '@/lib/db/queries';
import { resizeFileForUpload } from '@/lib/site-evidence';
import {
  getMyCommunityProfile, upsertCommunityProfile, deleteCommunityProfile, jitterToNeighbourhood,
} from '@/lib/db/community-queries';
import BrandLogo from '@/components/BrandLogo';
import TabBar from '@/components/TabBar';
import LessonLink from '@/components/design/LessonLink';
import MenuButton from '@/components/MenuButton';
import BackButton from '@/components/BackButton';

const CROP_OPTIONS = [
  'maize', 'beans', 'tomato', 'spinach', 'cabbage', 'potato', 'pumpkin',
  'sweet potato', 'onion', 'chilli', 'herbs', 'fruit trees', 'seedlings', 'seed',
];

// Simple shows the six most commonly grown crops plus a "More crops" opener; the full
// fourteen-chip picker stays exactly as it was for All tools.
const COMMON_CROP_OPTIONS = CROP_OPTIONS.slice(0, 6);

function Chip({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="font-sans font-semibold transition-all"
      style={{
        padding: '7px 14px', borderRadius: 999, fontSize: 13, cursor: 'pointer',
        background: on ? 'var(--color-forest-800)' : 'rgba(226,216,196,0.5)',
        color: on ? 'var(--color-canvas)' : 'var(--text-secondary)',
        border: `1px solid ${on ? 'var(--color-forest-800)' : 'var(--border)'}`,
      }}
    >
      {label}
    </button>
  );
}

function Toggle({ label, sub, on, onChange }: { label: string; sub?: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between" style={{ background: 'rgba(226,216,196,0.3)', borderRadius: 12, padding: '12px 14px', border: '1px solid var(--border)' }}>
      <div className="flex-1 min-w-0 pr-3">
        <div className="font-sans font-semibold" style={{ fontSize: 13.5, color: 'var(--text-primary)' }}>{label}</div>
        {sub && <div className="font-sans" style={{ fontSize: 12, color: 'var(--text-muted)' }}>{sub}</div>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!on)}
        className="flex items-center rounded-full transition-all flex-shrink-0"
        style={{ width: 44, height: 26, padding: 3, background: on ? 'var(--color-forest-800)' : 'rgba(32,25,15,0.15)', justifyContent: on ? 'flex-end' : 'flex-start', border: 'none', cursor: 'pointer' }}
      >
        <span style={{ width: 20, height: 20, borderRadius: '50%', background: '#fff', display: 'block', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
      </button>
    </div>
  );
}

export default function CommunityProfilePage() {
  const { user, loading } = useAuth();
  const { t, lang } = useLanguage();
  const privacyText = (english: string, key: string) => lang === 'zu' ? `${t(key)} / ${english}` : english;
  const appConfirm = useAppConfirm();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const simple = useAppLevel() === 'simple';

  const [ready, setReady] = useState(false);
  const [showAllCrops, setShowAllCrops] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [areaText, setAreaText] = useState('');
  const [bio, setBio] = useState('');
  const [crops, setCrops] = useState<string[]>([]);
  const [photos, setPhotos] = useState<string[]>([]);
  const [showOnMap, setShowOnMap] = useState(false);
  const [coarseLat, setCoarseLat] = useState<number | null>(null);
  const [coarseLon, setCoarseLon] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!communityEnabled()) { router.replace('/home'); return; }
    if (!loading && !user) { router.replace('/login'); return; }
    if (user) {
      getMyCommunityProfile().then((p) => {
        if (p) {
          setDisplayName(p.display_name ?? '');
          setAreaText(p.area_text ?? '');
          setBio(p.bio ?? '');
          setCrops(p.crops ?? []);
          setPhotos(p.photos ?? []);
          setShowOnMap(p.show_on_map ?? false);
          setCoarseLat(p.coarse_lat ?? null);
          setCoarseLon(p.coarse_lon ?? null);
        } else {
          setDisplayName(user.displayName ?? '');
        }
        setReady(true);
      }).catch(() => setReady(true));
    }
  }, [user, loading, router]);

  function toggleCrop(c: string) {
    setCrops((prev) => prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]);
  }

  async function handleShowOnMapToggle(next: boolean) {
    setShowOnMap(next);
    if (!next || coarseLat !== null) return;
    if (!navigator.geolocation) { setError(privacyText('This device can\'t share a location.', 'communityLocationUnsupported')); setShowOnMap(false); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { lat, lon } = jitterToNeighbourhood(pos.coords.latitude, pos.coords.longitude);
        setCoarseLat(lat); setCoarseLon(lon); setLocating(false);
      },
      () => { setError(privacyText('Could not get your location — map visibility left off.', 'communityLocationDenied')); setShowOnMap(false); setLocating(false); },
      { enableHighAccuracy: false, timeout: 8000 },
    );
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || photos.length >= 4) return;
    setUploading(true);
    try {
      const url = await uploadPhoto(await resizeFileForUpload(file), 'community');
      if (url) setPhotos((p) => [...p, url]);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function handleSave() {
    setSaving(true);
    setError('');
    try {
      await upsertCommunityProfile({
        display_name: displayName.trim() || 'A farmer',
        area_text: areaText.trim(),
        bio: bio.trim(),
        crops,
        photos,
        show_on_map: showOnMap,
        coarse_lat: showOnMap ? coarseLat : null,
        coarse_lon: showOnMap ? coarseLon : null,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      setError(lang === 'zu' ? t('communityProfileSaveError') : 'Could not save — try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    const proceed = await appConfirm({
      message: privacyText('Delete your community profile? This removes your profile and map pin. Your board posts stay until you close them individually.', 'communityDeleteProfileConfirm'),
      confirmLabel: privacyText('Delete my community profile', 'communityDeleteProfile'),
      cancelLabel: t('cancelBtn'),
      destructive: true,
    });
    if (!proceed) return;
    await deleteCommunityProfile();
    router.push('/community');
  }

  if (!ready) {
    return (
      <div role="status" aria-label={lang === 'zu' ? t('communityLoadingStatus') : 'Loading community profile'} className="h-[100dvh] flex items-center justify-center" style={{ background: 'var(--bg-0)' }}>
        <Loader2 size={24} className="animate-spin" style={{ color: 'var(--color-forest-800)' }} />
      </div>
    );
  }

  return (
    <div className="h-[100dvh] flex flex-col font-sans" style={{ background: 'var(--bg-0)', color: 'var(--text-primary)' }}>
      <header className="flex-shrink-0 flex items-center gap-3 px-4" style={{ height: 56, borderBottom: '1px solid var(--border)', background: 'var(--bg-1)' }}>
        <MenuButton /><BackButton fallback="/home" />
        <Link href="/community" style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-secondary)', textDecoration: 'none' }}>
          <ChevronLeft size={18} strokeWidth={1.7} />
        </Link>
        <BrandLogo />
        <div style={{ flex: 1 }} />
        <LessonLink id="community:profile" label="Learn" />
        <h1 className="font-display font-semibold m-0" style={{ fontSize: 15, color: 'var(--text-primary)' }}>{t('communityEditProfileTitle')}</h1>
      </header>

      <main className={`${workspace.workspace} ${workspace.formWidth} flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6`}>
        <p className="font-sans" style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 20 }}>
          {lang === 'zu' && <span className="block font-sans" style={{ marginBottom: 8, color: 'var(--text-muted)' }}>{t('communityDraftReviewNotice')} / isiZulu draft — not reviewed by a fluent speaker</span>}
          {privacyText('Share as much or as little as you like. Nothing here is visible until you save it.', 'communityEditProfileIntro')}
        </p>

        <div className={workspace.twoColumns}>
          <div>
            <div className="font-sans uppercase tracking-widest" style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.12em', marginBottom: 6 }}>
              {t('communityDisplayNameLabel')}
            </div>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={t('communityDisplayNamePlaceholder')}
              className="w-full rounded-xl px-3 py-2.5 font-sans"
              style={{ fontSize: 14, background: 'var(--bg-1)', border: '1px solid var(--border)', color: 'var(--text-primary)', outline: 'none' }}
            />
          </div>

          <div>
            <div className="font-sans uppercase tracking-widest" style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.12em', marginBottom: 6 }}>
              {t('communityAreaLabel')}
            </div>
            <input
              type="text"
              value={areaText}
              onChange={(e) => setAreaText(e.target.value)}
              placeholder={t('communityAreaPlaceholder')}
              className="w-full rounded-xl px-3 py-2.5 font-sans"
              style={{ fontSize: 14, background: 'var(--bg-1)', border: '1px solid var(--border)', color: 'var(--text-primary)', outline: 'none' }}
            />
            <div className="font-sans" style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4 }}>{privacyText('Town or district — not your exact address', 'communityAreaHint')}</div>
          </div>

          <div>
            <div className="font-sans uppercase tracking-widest" style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.12em', marginBottom: 6 }}>
              {t('communityBioLabel')}
            </div>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value.slice(0, 240))}
              placeholder={t('communityBioPlaceholder')}
              rows={3}
              className="w-full rounded-xl px-3 py-2.5 font-sans"
              style={{ fontSize: 14, background: 'var(--bg-1)', border: '1px solid var(--border)', color: 'var(--text-primary)', outline: 'none', resize: 'none', lineHeight: 1.5 }}
            />
          </div>

          <div>
            <div className="font-sans uppercase tracking-widest" style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.12em', marginBottom: 8 }}>
              {t('communityCropsLabel')}
            </div>
            {(() => {
              // Simple shows the six commonest crops plus "More crops" — unless a crop from
              // further down the list is already selected, in which case that choice must stay
              // visible rather than silently hiding it. All tools always shows the full picker.
              const cropsExpanded = !simple || showAllCrops
                || crops.some((c) => !COMMON_CROP_OPTIONS.includes(c));
              const visible = cropsExpanded ? CROP_OPTIONS : COMMON_CROP_OPTIONS;
              return (
                <div className="flex flex-wrap gap-2">
                  {visible.map((c) => (
                    <Chip key={c} label={c} on={crops.includes(c)} onClick={() => toggleCrop(c)} />
                  ))}
                  {!cropsExpanded && (
                    <button
                      type="button"
                      onClick={() => setShowAllCrops(true)}
                      className="font-sans font-semibold transition-all"
                      style={{
                        padding: '7px 14px', borderRadius: 999, fontSize: 13, cursor: 'pointer',
                        background: 'transparent', color: 'var(--color-forest-800)', border: '1px dashed var(--color-forest-800)',
                      }}
                    >
                      + More crops
                    </button>
                  )}
                </div>
              );
            })()}
          </div>

          <div>
            <div className="font-sans uppercase tracking-widest" style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.12em', marginBottom: 8 }}>
              {t('communityPhotosLabel')} <span style={{ textTransform: 'none', letterSpacing: 0 }}>· {t('communityPhotosHint')}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {photos.map((url, i) => (
                <div key={i} style={{ position: 'relative', width: 72, height: 72, borderRadius: 10, overflow: 'hidden' }}>
                  <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <button
                    onClick={() => setPhotos((p) => p.filter((_, idx) => idx !== i))}
                    style={{ position: 'absolute', top: 2, right: 2, background: 'rgba(0,0,0,0.55)', border: 'none', borderRadius: '50%', width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                  >
                    <X size={12} color="#fff" />
                  </button>
                </div>
              ))}
              {photos.length < 4 && (
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  style={{ width: 72, height: 72, borderRadius: 10, background: 'var(--bg-1)', border: '1px dashed var(--border-strong)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                >
                  {uploading ? <Loader2 size={18} className="animate-spin" style={{ color: 'var(--text-muted)' }} /> : <Camera size={20} style={{ color: 'var(--text-muted)' }} strokeWidth={1.6} />}
                </button>
              )}
              <input ref={fileRef} type="file" accept="image/*" onChange={handlePhotoUpload} style={{ display: 'none' }} />
            </div>
          </div>

          <div>
            <Toggle
              label={privacyText('Show me on the community map', 'communityShowOnMapLabel')}
              sub={locating ? (lang === 'zu' ? t('communityLocationPending') : 'Getting your approximate area…') : privacyText('Your location shows as an approximate ~1km area, never your exact homestead', 'communityShowOnMapHint')}
              on={showOnMap}
              onChange={handleShowOnMapToggle}
            />
          </div>

          {error && <p className={`${workspace.fullRow} font-sans`} style={{ fontSize: 13, color: 'var(--danger)' }}>{error}</p>}

          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center justify-center gap-2 font-display font-semibold rounded-xl"
            style={{ background: 'var(--color-forest-800)', color: 'var(--color-canvas)', border: 'none', cursor: 'pointer', padding: '13px 20px', fontSize: 15 }}
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : saved ? <Check size={16} /> : null}
            {saved ? (lang === 'zu' ? t('communityProfileSaved') : 'Saved') : t('communitySaveProfile')}
          </button>

          <button
            onClick={handleDelete}
            className="flex items-center justify-center gap-2 font-sans font-semibold rounded-xl"
            style={{ background: 'transparent', color: 'var(--danger)', border: '1px solid color-mix(in srgb, var(--danger) 30%, transparent)', cursor: 'pointer', padding: '11px 20px', fontSize: 13.5 }}
          >
            <Trash2 size={14} /> {privacyText('Delete my community profile', 'communityDeleteProfile')}
          </button>
        </div>
      </main>

      <TabBar />
    </div>
  );
}
