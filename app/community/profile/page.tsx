'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, Camera, Loader2, Check, Trash2, X } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useLanguage } from '@/lib/i18n';
import { useAppConfirm } from '@/components/AppConfirm';
import { communityEnabled } from '@/lib/community/flag';
import { uploadPhoto } from '@/lib/db/queries';
import {
  getMyCommunityProfile, upsertCommunityProfile, deleteCommunityProfile, jitterToNeighbourhood,
} from '@/lib/db/community-queries';
import BrandLogo from '@/components/BrandLogo';
import TabBar from '@/components/TabBar';
import LessonLink from '@/components/design/LessonLink';
import MenuButton from '@/components/MenuButton';

const CROP_OPTIONS = [
  'maize', 'beans', 'tomato', 'spinach', 'cabbage', 'potato', 'pumpkin',
  'sweet potato', 'onion', 'chilli', 'herbs', 'fruit trees', 'seedlings', 'seed',
];

function Chip({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="font-sans font-semibold transition-all"
      style={{
        padding: '7px 14px', borderRadius: 999, fontSize: 13, cursor: 'pointer',
        background: on ? '#1F4D2B' : 'rgba(226,216,196,0.5)',
        color: on ? '#fff' : '#5C5040',
        border: `1px solid ${on ? '#1F4D2B' : '#E2D8C4'}`,
      }}
    >
      {label}
    </button>
  );
}

function Toggle({ label, sub, on, onChange }: { label: string; sub?: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between" style={{ background: 'rgba(226,216,196,0.3)', borderRadius: 12, padding: '12px 14px', border: '1px solid #E2D8C4' }}>
      <div className="flex-1 min-w-0 pr-3">
        <div className="font-sans font-semibold" style={{ fontSize: 13.5, color: '#20190F' }}>{label}</div>
        {sub && <div className="font-sans" style={{ fontSize: 12, color: '#8C7A62' }}>{sub}</div>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!on)}
        className="flex items-center rounded-full transition-all flex-shrink-0"
        style={{ width: 44, height: 26, padding: 3, background: on ? '#1F4D2B' : 'rgba(32,25,15,0.15)', justifyContent: on ? 'flex-end' : 'flex-start', border: 'none', cursor: 'pointer' }}
      >
        <span style={{ width: 20, height: 20, borderRadius: '50%', background: '#fff', display: 'block', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
      </button>
    </div>
  );
}

export default function CommunityProfilePage() {
  const { user, loading } = useAuth();
  const { t } = useLanguage();
  const appConfirm = useAppConfirm();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [ready, setReady] = useState(false);
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
    if (!navigator.geolocation) { setError('This device can\'t share a location.'); setShowOnMap(false); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { lat, lon } = jitterToNeighbourhood(pos.coords.latitude, pos.coords.longitude);
        setCoarseLat(lat); setCoarseLon(lon); setLocating(false);
      },
      () => { setError('Could not get your location — map visibility left off.'); setShowOnMap(false); setLocating(false); },
      { enableHighAccuracy: false, timeout: 8000 },
    );
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || photos.length >= 4) return;
    setUploading(true);
    try {
      const url = await uploadPhoto(file, 'community');
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
      setError('Could not save — try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    const proceed = await appConfirm({
      message: t('communityDeleteProfileConfirm'),
      confirmLabel: t('communityDeleteProfile'),
      cancelLabel: t('cancelBtn'),
      destructive: true,
    });
    if (!proceed) return;
    await deleteCommunityProfile();
    router.push('/community');
  }

  if (!ready) {
    return (
      <div className="h-[100dvh] flex items-center justify-center" style={{ background: '#E4DCC6' }}>
        <Loader2 size={24} className="animate-spin" style={{ color: '#1F4D2B' }} />
      </div>
    );
  }

  return (
    <div className="h-[100dvh] flex flex-col font-sans" style={{ background: '#E4DCC6', color: '#20190F' }}>
      <header className="flex-shrink-0 flex items-center gap-3 px-4" style={{ height: 56, borderBottom: '1px solid #E2D8C4', background: '#FFFEFA' }}>
        <MenuButton />
        <Link href="/community" style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#5C5040', textDecoration: 'none' }}>
          <ChevronLeft size={18} strokeWidth={1.7} />
        </Link>
        <BrandLogo />
        <div style={{ flex: 1 }} />
        <LessonLink id="community:profile" label="Learn" />
        <span className="font-display font-semibold" style={{ fontSize: 15, color: '#20190F' }}>{t('communityEditProfileTitle')}</span>
      </header>

      <main className="flex-1 overflow-y-auto" style={{ padding: '20px 16px', maxWidth: 480, width: '100%', margin: '0 auto' }}>
        <p className="font-sans" style={{ fontSize: 13, color: '#5C5040', lineHeight: 1.5, marginBottom: 20 }}>
          {t('communityEditProfileIntro')}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div>
            <div className="font-sans uppercase tracking-widest" style={{ fontSize: 10, color: '#8C7A62', letterSpacing: '0.12em', marginBottom: 6 }}>
              {t('communityDisplayNameLabel')}
            </div>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={t('communityDisplayNamePlaceholder')}
              className="w-full rounded-xl px-3 py-2.5 font-sans"
              style={{ fontSize: 14, background: '#FFFEFA', border: '1px solid #E2D8C4', color: '#20190F', outline: 'none' }}
            />
          </div>

          <div>
            <div className="font-sans uppercase tracking-widest" style={{ fontSize: 10, color: '#8C7A62', letterSpacing: '0.12em', marginBottom: 6 }}>
              {t('communityAreaLabel')}
            </div>
            <input
              type="text"
              value={areaText}
              onChange={(e) => setAreaText(e.target.value)}
              placeholder={t('communityAreaPlaceholder')}
              className="w-full rounded-xl px-3 py-2.5 font-sans"
              style={{ fontSize: 14, background: '#FFFEFA', border: '1px solid #E2D8C4', color: '#20190F', outline: 'none' }}
            />
            <div className="font-sans" style={{ fontSize: 11.5, color: '#8C7A62', marginTop: 4 }}>{t('communityAreaHint')}</div>
          </div>

          <div>
            <div className="font-sans uppercase tracking-widest" style={{ fontSize: 10, color: '#8C7A62', letterSpacing: '0.12em', marginBottom: 6 }}>
              {t('communityBioLabel')}
            </div>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value.slice(0, 240))}
              placeholder={t('communityBioPlaceholder')}
              rows={3}
              className="w-full rounded-xl px-3 py-2.5 font-sans"
              style={{ fontSize: 14, background: '#FFFEFA', border: '1px solid #E2D8C4', color: '#20190F', outline: 'none', resize: 'none', lineHeight: 1.5 }}
            />
          </div>

          <div>
            <div className="font-sans uppercase tracking-widest" style={{ fontSize: 10, color: '#8C7A62', letterSpacing: '0.12em', marginBottom: 8 }}>
              {t('communityCropsLabel')}
            </div>
            <div className="flex flex-wrap gap-2">
              {CROP_OPTIONS.map((c) => (
                <Chip key={c} label={c} on={crops.includes(c)} onClick={() => toggleCrop(c)} />
              ))}
            </div>
          </div>

          <div>
            <div className="font-sans uppercase tracking-widest" style={{ fontSize: 10, color: '#8C7A62', letterSpacing: '0.12em', marginBottom: 8 }}>
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
                  style={{ width: 72, height: 72, borderRadius: 10, background: '#FFFEFA', border: '1px dashed #C8BCA8', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                >
                  {uploading ? <Loader2 size={18} className="animate-spin" style={{ color: '#8C7A62' }} /> : <Camera size={20} style={{ color: '#8C7A62' }} strokeWidth={1.6} />}
                </button>
              )}
              <input ref={fileRef} type="file" accept="image/*" onChange={handlePhotoUpload} style={{ display: 'none' }} />
            </div>
          </div>

          <div>
            <div className="font-sans uppercase tracking-widest" style={{ fontSize: 10, color: '#8C7A62', letterSpacing: '0.12em', marginBottom: 8 }}>
              {t('communityShowOnMapLabel')}
            </div>
            <Toggle
              label={t('communityShowOnMapLabel')}
              sub={locating ? 'Getting your approximate area…' : t('communityShowOnMapHint')}
              on={showOnMap}
              onChange={handleShowOnMapToggle}
            />
          </div>

          {error && <p className="font-sans" style={{ fontSize: 13, color: '#8B2020' }}>{error}</p>}

          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center justify-center gap-2 font-display font-semibold rounded-xl"
            style={{ background: '#1F4D2B', color: '#F7F2E9', border: 'none', cursor: 'pointer', padding: '13px 20px', fontSize: 15 }}
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : saved ? <Check size={16} /> : null}
            {saved ? 'Saved' : t('communitySaveProfile')}
          </button>

          <button
            onClick={handleDelete}
            className="flex items-center justify-center gap-2 font-sans font-semibold rounded-xl"
            style={{ background: 'transparent', color: '#8B2020', border: '1px solid rgba(139,32,32,0.3)', cursor: 'pointer', padding: '11px 20px', fontSize: 13.5 }}
          >
            <Trash2 size={14} /> {t('communityDeleteProfile')}
          </button>
        </div>
      </main>

      <TabBar />
    </div>
  );
}
