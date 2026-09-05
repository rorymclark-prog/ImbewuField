'use client';
import { useState, useRef, useCallback, useEffect } from 'react';
import { X, Camera, Check, Loader2, User } from 'lucide-react';
import { uploadProfilePhoto, updateMyProfile } from '@/lib/db/queries';
import type { Profile } from '@/lib/db/types';

const ROLE_LABEL: Record<string, string> = {
  farmer: 'Farmer',
  mentor: 'Mentor',
  student: 'Student',
  ngo: 'NGO Staff',
  funder: 'Funder',
  admin: 'Admin',
};

const ROLE_COLOR: Record<string, string> = {
  farmer: '#1F4D2B',
  mentor: '#235E86',
  student: '#C07A1E',
  ngo: '#6B35A0',
  funder: '#B83A18',
  admin: '#5C5040',
};

const SKILL_OPTIONS = [
  'soil health',
  'water harvesting',
  'agroforestry',
  'livestock',
  'composting',
  'food forest',
  'market gardening',
  'seed saving',
];

interface Props {
  open: boolean;
  onClose: () => void;
  profile: Profile | null;
  mapCenter?: { lat: number; lon: number };
  onSaved?: (updated: Profile) => void;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-sans font-semibold mb-2" style={{ fontSize: 13, color: '#5C5040' }}>
      {children}
    </div>
  );
}

function SkillChip({
  label,
  on,
  onClick,
}: {
  label: string;
  on: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="font-sans font-semibold transition-all"
      style={{
        padding: '8px 16px',
        borderRadius: 999,
        fontSize: 13.5,
        cursor: 'pointer',
        background: on ? '#1F4D2B' : 'rgba(226,216,196,0.5)',
        color: on ? '#fff' : '#5C5040',
        border: `1px solid ${on ? '#1F4D2B' : '#E2D8C4'}`,
      }}
    >
      {label}
    </button>
  );
}

function Toggle({
  label,
  sub,
  on,
  onChange,
}: {
  label: string;
  sub?: string;
  on: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div
      className="flex items-center justify-between"
      style={{
        background: 'rgba(226,216,196,0.3)',
        borderRadius: 12,
        padding: '12px 14px',
        border: '1px solid #E2D8C4',
      }}
    >
      <div className="flex-1 min-w-0 pr-3">
        <div
          className="font-sans font-semibold"
          style={{ fontSize: 13.5, color: '#20190F' }}
        >
          {label}
        </div>
        {sub && (
          <div className="font-sans" style={{ fontSize: 12, color: '#8C7A62' }}>
            {sub}
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={() => onChange(!on)}
        role="switch"
        aria-checked={on}
        aria-label={label}
        className="flex items-center rounded-full transition-all flex-shrink-0"
        style={{
          width: 44,
          height: 26,
          padding: 3,
          background: on ? '#1F4D2B' : 'rgba(32,25,15,0.15)',
          justifyContent: on ? 'flex-end' : 'flex-start',
          border: 'none',
          cursor: 'pointer',
        }}
      >
        <span
          style={{
            width: 20,
            height: 20,
            borderRadius: '50%',
            background: '#fff',
            display: 'block',
            boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
          }}
        />
      </button>
    </div>
  );
}

function InitialsAvatar({ name, size = 80 }: { name: string | null; size?: number }) {
  const initials = name
    ? name
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map(w => w[0].toUpperCase())
        .join('')
    : '?';

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: '#1F4D2B',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <span
        className="font-display font-semibold"
        style={{ fontSize: size * 0.35, color: '#A8D88A', lineHeight: 1 }}
      >
        {initials}
      </span>
    </div>
  );
}

export default function ProfileSheet({ open, onClose, profile, mapCenter, onSaved }: Props) {
  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [skills, setSkills] = useState<string[]>(profile?.skills ?? []);
  const [showOnMap, setShowOnMap] = useState(profile?.showOnMap ?? false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(profile?.photo_url ?? null);

  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const toggleSkill = useCallback((skill: string) => {
    setSkills(prev =>
      prev.includes(skill) ? prev.filter(s => s !== skill) : [...prev, skill]
    );
  }, []);

  const handlePhotoSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setUploading(true);
      try {
        const url = await uploadProfilePhoto(file);
        setPhotoUrl(url);
      } finally {
        setUploading(false);
        // Reset so the same file can be re-selected if needed
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    },
    []
  );

  const handleSave = useCallback(async () => {
    if (!profile) return;
    setSaving(true);
    try {
      const patch: Partial<typeof profile> = {
        full_name: fullName.trim() || null,
        bio: bio.trim() || null,
        skills: skills.length > 0 ? skills : null,
        showOnMap,
        photo_url: photoUrl,
      };

      // If toggling map on and no coords yet, use the current map centre
      if (showOnMap && !profile.mapLat && !profile.mapLon && mapCenter) {
        patch.mapLat = mapCenter.lat;
        patch.mapLon = mapCenter.lon;
      }

      // If toggling map off, clear coordinates
      if (!showOnMap) {
        patch.mapLat = null;
        patch.mapLon = null;
      }

      await updateMyProfile(patch);

      const updated: typeof profile = { ...profile, ...patch };

      setSavedFlash(true);
      onSaved?.(updated);

      setTimeout(() => {
        setSavedFlash(false);
        onClose();
      }, 1200);
    } finally {
      setSaving(false);
    }
  }, [profile, fullName, bio, skills, showOnMap, photoUrl, mapCenter, onSaved, onClose]);

  // Close on Escape — matches every other full-screen sheet in the app (AddSheet, ThemePanel, etc).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const roleColor = ROLE_COLOR[profile?.role ?? 'farmer'] ?? '#5C5040';
  const roleLabel = ROLE_LABEL[profile?.role ?? 'farmer'] ?? profile?.role ?? '';
  const bioRemaining = 200 - bio.length;
  const hasCoords = !!(profile?.mapLat && profile?.mapLon);
  const needsMapCentre = showOnMap && !hasCoords && !mapCenter;

  const isBusy = uploading || saving;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Your profile"
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: '#E4DCC6' }}
    >
      {/* ── Header ── */}
      <div
        className="flex items-center gap-3 px-4 flex-shrink-0"
        style={{ height: 60, background: '#FFFEFA', borderBottom: '1px solid #E2D8C4' }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{
            width: 38,
            height: 38,
            borderRadius: 11,
            background: 'rgba(32,25,15,0.06)',
            border: '1px solid #E2D8C4',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#5C5040',
            flexShrink: 0,
          }}
        >
          <X size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <div
            className="font-display font-semibold"
            style={{ fontSize: 16, color: '#20190F' }}
          >
            Your profile
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div
        className="flex-1 overflow-y-auto"
        style={{ padding: '24px 20px 120px' }}
      >
        <div className="space-y-6">

          {/* ── Photo section ── */}
          <div className="flex flex-col items-center gap-3">
            <div style={{ position: 'relative' }}>
              {photoUrl ? (
                <img data-photo-preview
                  src={photoUrl}
                  alt={fullName || 'Profile photo'}
                  style={{
                    width: 80,
                    height: 80,
                    borderRadius: '50%',
                    objectFit: 'cover',
                    border: '2px solid #E2D8C4',
                  }}
                />
              ) : (
                <InitialsAvatar name={fullName || profile?.full_name || null} size={80} />
              )}
              {uploading && (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    borderRadius: '50%',
                    background: 'rgba(31,77,43,0.55)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Loader2
                    size={22}
                    style={{ color: '#fff', animation: 'spin 1s linear infinite' }}
                  />
                </div>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handlePhotoSelect}
            />
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 font-sans font-semibold transition-all"
              style={{
                padding: '7px 16px',
                borderRadius: 999,
                fontSize: 13,
                cursor: uploading ? 'default' : 'pointer',
                background: 'rgba(226,216,196,0.5)',
                color: '#5C5040',
                border: '1px solid #E2D8C4',
                opacity: uploading ? 0.6 : 1,
              }}
            >
              <Camera size={14} />
              Change photo
            </button>
          </div>

          {/* ── Name ── */}
          <div>
            <SectionLabel>Full name</SectionLabel>
            <input
              type="text"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              placeholder="Your name"
              className="w-full font-sans"
              style={{
                padding: '10px 14px',
                borderRadius: 11,
                background: '#FFFEFA',
                border: '1px solid #E2D8C4',
                fontSize: 14,
                color: '#20190F',
                outline: 'none',
              }}
            />
          </div>

          {/* ── Role chip (non-editable) ── */}
          <div>
            <SectionLabel>Role</SectionLabel>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                className="font-sans font-semibold"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 14px',
                  borderRadius: 999,
                  fontSize: 13,
                  background: roleColor,
                  color: '#fff',
                  letterSpacing: '0.01em',
                }}
              >
                <User size={12} />
                {roleLabel}
              </span>
              <span
                className="font-sans"
                style={{ fontSize: 12, color: '#94876F' }}
              >
                Roles are set by your programme admin
              </span>
            </div>
          </div>

          {/* ── Bio ── */}
          <div>
            <div className="flex items-baseline justify-between mb-2">
              <SectionLabel>About you</SectionLabel>
              <span
                className="font-sans"
                style={{
                  fontSize: 12,
                  color: bioRemaining < 20 ? '#B83A18' : '#94876F',
                }}
              >
                {bioRemaining} left
              </span>
            </div>
            <textarea
              value={bio}
              onChange={e => setBio(e.target.value.slice(0, 200))}
              placeholder="A short introduction — your background, what you grow, what you love about permaculture…"
              rows={3}
              className="w-full font-sans"
              style={{
                padding: '10px 14px',
                borderRadius: 11,
                background: '#FFFEFA',
                border: '1px solid #E2D8C4',
                fontSize: 14,
                color: '#20190F',
                outline: 'none',
                resize: 'none',
                lineHeight: 1.5,
              }}
            />
          </div>

          {/* ── Skills ── */}
          <div>
            <SectionLabel>Skills &amp; interests</SectionLabel>
            <div className="flex flex-wrap gap-2">
              {SKILL_OPTIONS.map(skill => (
                <SkillChip
                  key={skill}
                  label={skill}
                  on={skills.includes(skill)}
                  onClick={() => toggleSkill(skill)}
                />
              ))}
            </div>
          </div>

          {/* ── Show on map toggle ── */}
          <div>
            <SectionLabel>Map visibility</SectionLabel>
            <div className="space-y-2">
              <Toggle
                label="Show my location on the project map"
                on={showOnMap}
                onChange={setShowOnMap}
              />
              {showOnMap && !hasCoords && mapCenter && (
                <div
                  style={{
                    background: 'rgba(31,77,43,0.06)',
                    borderRadius: 11,
                    padding: '10px 14px',
                    border: '1px solid rgba(31,77,43,0.2)',
                  }}
                >
                  <p
                    className="font-sans"
                    style={{ fontSize: 12.5, color: '#1F4D2B', lineHeight: 1.5 }}
                  >
                    Your location will be placed at the current map view centre when you save.
                  </p>
                </div>
              )}
              {needsMapCentre && (
                <div
                  style={{
                    background: 'rgba(192,122,30,0.07)',
                    borderRadius: 11,
                    padding: '10px 14px',
                    border: '1px solid rgba(192,122,30,0.25)',
                  }}
                >
                  <p
                    className="font-sans"
                    style={{ fontSize: 12.5, color: '#C07A1E', lineHeight: 1.5 }}
                  >
                    Pan the map to where you want to appear, then return here to save.
                  </p>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* ── Footer / Save ── */}
      <div
        className="flex-shrink-0"
        style={{
          padding: '14px 20px',
          paddingBottom: 'calc(14px + env(safe-area-inset-bottom))',
          background: '#FFFEFA',
          borderTop: '1px solid #E2D8C4',
        }}
      >
        <button
          type="button"
          onClick={handleSave}
          disabled={isBusy || savedFlash}
          className="w-full flex items-center justify-center gap-2 font-sans font-bold transition-all"
          style={{
            height: 46,
            borderRadius: 13,
            background: savedFlash
              ? '#2D7A42'
              : isBusy
              ? 'rgba(32,25,15,0.1)'
              : '#1F4D2B',
            color: isBusy && !savedFlash ? 'rgba(32,25,15,0.3)' : '#F7F2E9',
            border: 'none',
            fontSize: 15,
            cursor: isBusy ? 'default' : 'pointer',
          }}
        >
          {saving && !savedFlash && (
            <Loader2
              size={17}
              style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }}
            />
          )}
          {savedFlash && <Check size={17} style={{ flexShrink: 0 }} />}
          <span>{savedFlash ? 'Saved!' : 'Save'}</span>
        </button>
      </div>

      {/* Keyframe for spinner */}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
