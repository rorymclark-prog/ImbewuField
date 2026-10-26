'use client';

import workspace from '@/components/layout/Workspace.module.css';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Camera, Loader2, Check, Trash2, X } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import LanguageDraftNote from '@/components/LanguageDraftNote';
import { translate,useLanguage } from '@/lib/i18n';
import { useAppLevel } from '@/lib/app-level';
import { useAppConfirm } from '@/components/AppConfirm';
import { communityEnabled } from '@/lib/community/flag';
import { uploadPhoto } from '@/lib/db/queries';
import { resizeFileForUpload } from '@/lib/site-evidence';
import {
  getMyCommunityProfile, upsertCommunityProfile, deleteCommunityProfile, jitterToNeighbourhood,
} from '@/lib/db/community-queries';
import TabBar from '@/components/TabBar';
import LessonLink from '@/components/design/LessonLink';
import AppHeader from '@/components/layout/AppHeader';

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
      lang="en"
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

function Toggle({ label, sub, on, onChange }: { label: string; sub?: React.ReactNode; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between" style={{ background: 'rgba(226,216,196,0.3)', borderRadius: 12, padding: '12px 14px', border: '1px solid var(--border)' }}>
      <div className="flex-1 min-w-0 pr-3">
        <div className="font-sans font-semibold" style={{ fontSize: 13.5, color: 'var(--text-primary)' }}>{label}</div>
        {sub && <div className="font-sans" style={{ fontSize: 12, color: 'var(--text-muted)' }}>{sub}</div>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!on)}
        role="switch" aria-checked={on} aria-label={label}
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
  const draft=['zu','st','ts','ve'].includes(lang);
  const paired=(key:string)=><><span lang={t(key)===translate('en',key)?'en':lang}>{t(key)}</span>{draft&&<small lang="en" style={{display:'block',fontSize:12,lineHeight:1.4,marginTop:4}}><span lang={lang}>{t('offlineSourceLabel')}: </span>{translate('en',key)}</small>}</>;
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
  const [errorKey, setErrorKey] = useState<'communityLocationUnsupported'|'communityLocationDenied'|'communityProfileSaveError'|'communityPhotoUploadError'|'communityProfileDeleteError'|null>(null);
  const [loadError,setLoadError]=useState(false);
  const [loadAttempt,setLoadAttempt]=useState(0);
  const [deleting,setDeleting]=useState(false);

  useEffect(() => {
    if (!communityEnabled()) { router.replace('/home'); return; }
    if (!loading && !user) { router.replace('/login'); return; }
    let active=true;
    if (user) {
      setReady(false);setLoadError(false);
      getMyCommunityProfile().then((p) => {
        if(!active)return;
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
          // An acknowledged empty profile must not inherit a previous draft's sharing fields.
          setDisplayName(user.displayName ?? '');
          setAreaText('');setBio('');setCrops([]);setPhotos([]);
          setShowOnMap(false);setCoarseLat(null);setCoarseLon(null);
        }
        setReady(true);
      }).catch(() => {if(active){setLoadError(true);setReady(false);}});
    }
    return()=>{active=false;};
  }, [user, loading, router, loadAttempt]);

  function toggleCrop(c: string) {
    setCrops((prev) => prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]);
  }

  async function handleShowOnMapToggle(next: boolean) {
    setShowOnMap(next);
    if (!next || coarseLat !== null) return;
    if (!navigator.geolocation) { setErrorKey('communityLocationUnsupported'); setShowOnMap(false); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { lat, lon } = jitterToNeighbourhood(pos.coords.latitude, pos.coords.longitude);
        setCoarseLat(lat); setCoarseLon(lon); setLocating(false);
      },
      () => { setErrorKey('communityLocationDenied'); setShowOnMap(false); setLocating(false); },
      { enableHighAccuracy: false, timeout: 8000 },
    );
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || photos.length >= 4) return;
    setUploading(true);setErrorKey(null);
    try {
      const url = await uploadPhoto(await resizeFileForUpload(file), 'community');
      if (url) setPhotos((p) => [...p, url]);else setErrorKey('communityPhotoUploadError');
    } catch {
      setErrorKey('communityPhotoUploadError');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function handleSave() {
    setSaving(true);
    setErrorKey(null);
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
      setErrorKey('communityProfileSaveError');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    const proceed = await appConfirm({
      message:t('communityDeleteProfileConfirm'), confirmLabel:t('communityDeleteProfile'), cancelLabel:t('cancelBtn'),
      language:lang, englishSource:draft?{message:translate('en','communityDeleteProfileConfirm'),confirmLabel:translate('en','communityDeleteProfile'),cancelLabel:translate('en','cancelBtn')}:undefined,
      destructive:true,
    });
    if (!proceed) return;
    setDeleting(true);setErrorKey(null);
    try {await deleteCommunityProfile();router.push('/community');}
    catch {setErrorKey('communityProfileDeleteError');}
    finally {setDeleting(false);}
  }

  const header=<AppHeader backFallback="/community" title={t('communityEditProfileTitle')} right={<LessonLink id="community:profile" label={t('homeLearnAction')}/>}/>;
  const notice=<div className="px-4 pt-3"><LanguageDraftNote lang={lang} scope="community-profile"/></div>;

  if (!ready) {
    return <div lang={lang} className="h-[100dvh] flex flex-col" style={{background:'var(--bg-0)'}}>
      {header}{notice}
      <main className="flex-1 flex flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="font-display font-bold m-0" style={{fontSize:20}}>{t('communityEditProfileTitle')}</h1>
        {loadError?<><p role="alert">{paired('communityProfileLoadError')}</p><button type="button" onClick={()=>setLoadAttempt(n=>n+1)} className="rounded-xl px-4 py-2 font-semibold" style={{minHeight:44,background:'var(--color-forest-800)',color:'var(--on-forest)'}}>{t('communityRetry')}</button></>:<div role="status" aria-label={t('communityLoadingStatus')}><Loader2 size={24} className="animate-spin" style={{color:'var(--color-forest-800)'}} aria-hidden/><p>{t('communityLoadingStatus')}</p></div>}
      </main><TabBar hideAtDesktop/>
    </div>;
  }

  return (
    <div lang={lang} className="h-[100dvh] flex flex-col font-sans" style={{ background: 'var(--bg-0)', color: 'var(--text-primary)' }}>
      {header}{notice}

      <main className={`${workspace.workspace} ${workspace.formWidth} flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6`}>
        {/* nav-17: AppHeader's title is a <span>, not a heading — this page needs its own
            real, visible <h1> now that the old header's h1 is gone. */}
        <h1 className="font-display font-bold m-0" style={{ fontSize: 20, color: 'var(--text-primary)', marginBottom: 12 }}>{t('communityEditProfileTitle')}</h1>
        <p className="font-sans" style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 20 }}>
          {paired('communityEditProfileIntro')}
        </p>

        <div className={workspace.twoColumns}>
          <div>
            <label htmlFor="community-profile-display-name" className="block font-sans uppercase tracking-widest" style={{ fontSize: 'clamp(12px, 0.85vw, 13px)', color: 'var(--text-muted)', letterSpacing: '0.12em', marginBottom: 6 }}>
              {t('communityDisplayNameLabel')}
            </label>
            <input
              id="community-profile-display-name"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={t('communityDisplayNamePlaceholder')}
              className="w-full rounded-xl px-3 py-2.5 font-sans focus-visible:ring-2 focus-visible:ring-[var(--gold)]"
              style={{ fontSize: 14, background: 'var(--bg-1)', border: '1px solid var(--border)', color: 'var(--text-primary)', outline: 'none' }}
            />
          </div>

          <div>
            <label htmlFor="community-profile-area" className="block font-sans uppercase tracking-widest" style={{ fontSize: 'clamp(12px, 0.85vw, 13px)', color: 'var(--text-muted)', letterSpacing: '0.12em', marginBottom: 6 }}>
              {t('communityAreaLabel')}
            </label>
            <input
              id="community-profile-area"
              type="text"
              value={areaText}
              onChange={(e) => setAreaText(e.target.value)}
              placeholder={t('communityAreaPlaceholder')}
              className="w-full rounded-xl px-3 py-2.5 font-sans focus-visible:ring-2 focus-visible:ring-[var(--gold)]"
              style={{ fontSize: 14, background: 'var(--bg-1)', border: '1px solid var(--border)', color: 'var(--text-primary)', outline: 'none' }}
            />
            <div className="font-sans" style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{paired('communityAreaHint')}</div>
          </div>

          <div>
            <label htmlFor="community-profile-bio" className="block font-sans uppercase tracking-widest" style={{ fontSize: 'clamp(12px, 0.85vw, 13px)', color: 'var(--text-muted)', letterSpacing: '0.12em', marginBottom: 6 }}>
              {t('communityBioLabel')}
            </label>
            <textarea
              id="community-profile-bio"
              value={bio}
              onChange={(e) => setBio(e.target.value.slice(0, 240))}
              placeholder={t('communityBioPlaceholder')}
              rows={3}
              className="w-full rounded-xl px-3 py-2.5 font-sans focus-visible:ring-2 focus-visible:ring-[var(--gold)]"
              style={{ fontSize: 14, background: 'var(--bg-1)', border: '1px solid var(--border)', color: 'var(--text-primary)', outline: 'none', resize: 'none', lineHeight: 1.5 }}
            />
          </div>

          <div>
            <div id="community-profile-crops-label" className="font-sans uppercase tracking-widest" style={{ fontSize: 'clamp(12px, 0.85vw, 13px)', color: 'var(--text-muted)', letterSpacing: '0.12em', marginBottom: 8 }}>
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
                <div role="group" aria-labelledby="community-profile-crops-label" className="flex flex-wrap gap-2">
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
                      {t('communityMoreCrops')}
                    </button>
                  )}
                </div>
              );
            })()}
          </div>

          <div>
            <div className="font-sans uppercase tracking-widest" style={{ fontSize: 12, color: 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: 8 }}>
              {t('communityPhotosLabel')} <span style={{ textTransform: 'none', letterSpacing: 0 }}>· {t('communityPhotosHint')}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {photos.map((url, i) => (
                <div key={i} style={{ position: 'relative', width: 72, height: 72, borderRadius: 10, overflow: 'hidden' }}>
                  <img src={url} alt={t('communityProfilePhotoAlt').replace('{number}',String(i+1))} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <button
                    aria-label={t('communityRemovePhotoAria').replace('{number}',String(i+1))}
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
                  disabled={uploading} aria-busy={uploading} aria-label={t(uploading?'communityPhotoUploading':'communityAddPhotoAria')}
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
              label={t('communityShowOnMapLabel')}
              sub={locating?t('communityLocationPending'):paired('communityShowOnMapHint')}
              on={showOnMap}
              onChange={handleShowOnMapToggle}
            />
          </div>

          {errorKey && <p role="alert" className={`${workspace.fullRow} font-sans`} style={{ fontSize: 13, color: 'var(--danger)' }}>{paired(errorKey)}</p>}

          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center justify-center gap-2 font-display font-semibold rounded-xl"
            style={{ background: 'var(--color-forest-800)', color: 'var(--color-canvas)', border: 'none', cursor: 'pointer', padding: '13px 20px', fontSize: 15 }}
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : saved ? <Check size={16} /> : null}
            {t(saved?'communityProfileSaved':'communitySaveProfile')}
          </button>

          <button
            onClick={handleDelete} disabled={deleting} aria-busy={deleting}
            className="flex items-center justify-center gap-2 font-sans font-semibold rounded-xl"
            style={{ background: 'transparent', color: 'var(--danger)', border: '1px solid color-mix(in srgb, var(--danger) 30%, transparent)', cursor: 'pointer', padding: '11px 20px', fontSize: 13.5 }}
          >
            <Trash2 size={14} /> {t(deleting?'communityProfileDeleting':'communityDeleteProfile')}
          </button>
        </div>
      </main>

      <TabBar hideAtDesktop />
    </div>
  );
}
