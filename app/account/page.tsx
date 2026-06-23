'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { isBackendConfigured } from '@/lib/firebase/init';
import { updateMyProfile } from '@/lib/db/queries';
import { APP_LANGS } from '@/lib/i18n';
import TabBar from '@/components/TabBar';
import BrandLogo from '@/components/BrandLogo';
import ThemePanel from '@/components/ThemePanel';
import { Settings, Sprout, Mail, Phone, Globe, LogOut, ChevronRight, User, Pencil, Check, X, type LucideIcon } from 'lucide-react';
import type { UserRole } from '@/lib/db/types';

const ROLE_LABELS: Record<UserRole, string> = {
  farmer: 'Farmer', supervisor: 'Supervisor', trainer: 'Trainer',
  student: 'Student', ngo: 'NGO coordinator', funder: 'Funder', admin: 'Admin',
};

function Row({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="flex items-center gap-3 py-3" style={{ borderBottom: '1px solid #E2D8C4' }}>
      <Icon size={16} style={{ color: '#8C7A62', flexShrink: 0 }} />
      <div className="flex-1 min-w-0">
        <div className="text-xs font-mono uppercase tracking-wider" style={{ color: '#8C7A62' }}>{label}</div>
        <div className="text-sm font-display mt-0.5" style={{ color: '#20190F' }}>{value}</div>
      </div>
    </div>
  );
}

export default function AccountPage() {
  const { user, profile, signOutUser, loading } = useAuth();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', language: 'en' });

  useEffect(() => {
    if (!loading && !user && isBackendConfigured()) router.replace('/login');
  }, [user, loading, router]);

  useEffect(() => {
    if (profile) setForm({ name: profile.full_name ?? '', phone: profile.phone ?? '', language: profile.language ?? 'en' });
  }, [profile]);

  async function handleSignOut() {
    setSigningOut(true);
    await signOutUser();
    router.push('/gate');
  }

  async function saveProfile() {
    setSaving(true);
    await updateMyProfile({ full_name: form.name.trim() || undefined, phone: form.phone.trim() || null, language: form.language });
    setSaving(false);
    setEditing(false);
  }

  if (loading || !user) {
    return (
      <div className="flex flex-col" style={{ height: '100dvh', background: '#F7F2E9' }}>
        <div className="flex-1 flex items-center justify-center">
          <Sprout size={32} style={{ color: '#1F4D2B', opacity: 0.4 }} />
        </div>
        <TabBar />
      </div>
    );
  }

  const displayName = profile?.full_name ?? user.displayName;
  const roleLabel = profile?.role ? ROLE_LABELS[profile.role] : null;
  const langLabel = profile?.language ? (APP_LANGS.find((l) => l.code === profile.language)?.label ?? profile.language) : null;

  return (
    <div className="flex flex-col" style={{ height: '100dvh', background: '#F7F2E9' }}>
      <header className="flex-shrink-0 flex items-center px-4 gap-3" style={{ height: 52, background: '#FBF6EC', borderBottom: '1px solid #E2D8C4' }}>
        <BrandLogo />
        <div className="w-px h-5" style={{ background: '#E2D8C4' }} />
        <span className="text-xs font-display" style={{ color: '#5C5040' }}>Account</span>
        <div className="flex-1" />
        <button onClick={() => setSettingsOpen(true)} aria-label="Settings"
          className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-display"
          style={{ background: '#FBF6EC', border: '1px solid #E2D8C4', color: '#20190F', cursor: 'pointer' }}>
          <Settings size={13} strokeWidth={1.7} />
          <span className="hidden sm:inline">Settings</span>
        </button>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-md mx-auto px-4 py-6 space-y-5">

          {/* Avatar + name */}
          <div className="rounded-2xl p-5 flex items-center gap-4" style={{ background: '#FBF6EC', border: '1px solid #E2D8C4' }}>
            <div className="flex items-center justify-center rounded-full font-display font-bold flex-shrink-0"
              style={{ width: 64, height: 64, fontSize: 28, background: 'linear-gradient(135deg, #1F4D2B, #2D6B3C)', color: '#EAF3E2' }}>
              {(displayName ?? user.email ?? '?')[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-display font-semibold text-lg leading-tight truncate" style={{ color: '#20190F' }}>
                {displayName ?? 'ImbewuField user'}
              </div>
              {roleLabel && (
                <div className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-xs font-display"
                  style={{ background: 'rgba(31,77,43,0.08)', border: '1px solid rgba(31,77,43,0.15)', color: '#1F4D2B' }}>
                  <Sprout size={11} />{roleLabel}
                </div>
              )}
            </div>
            {!editing && (
              <button onClick={() => setEditing(true)} title="Edit profile"
                className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-display"
                style={{ background: 'rgba(31,77,43,0.08)', border: '1px solid rgba(31,77,43,0.15)', color: '#1F4D2B', cursor: 'pointer' }}>
                <Pencil size={12} />Edit
              </button>
            )}
          </div>

          {/* Edit form */}
          {editing ? (
            <div className="rounded-2xl px-4 py-4 space-y-3" style={{ background: '#FBF6EC', border: '1px solid #E2D8C4' }}>
              <div className="text-xs font-mono uppercase tracking-wider mb-1" style={{ color: '#8C7A62' }}>Edit profile</div>

              <label className="block">
                <div className="text-xs font-mono mb-1" style={{ color: '#8C7A62' }}>Full name</div>
                <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Your full name"
                  className="w-full text-sm font-display outline-none rounded-xl px-3 py-2.5"
                  style={{ background: '#fff', border: '1px solid #D8CBB2', color: '#20190F' }} />
              </label>

              <label className="block">
                <div className="text-xs font-mono mb-1" style={{ color: '#8C7A62' }}>Phone</div>
                <input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="+27 ..."
                  type="tel"
                  className="w-full text-sm font-display outline-none rounded-xl px-3 py-2.5"
                  style={{ background: '#fff', border: '1px solid #D8CBB2', color: '#20190F' }} />
              </label>

              <label className="block">
                <div className="text-xs font-mono mb-1" style={{ color: '#8C7A62' }}>Language</div>
                <select value={form.language} onChange={(e) => setForm((f) => ({ ...f, language: e.target.value }))}
                  className="w-full text-sm font-display outline-none rounded-xl px-3 py-2.5 appearance-none"
                  style={{ background: '#fff', border: '1px solid #D8CBB2', color: '#20190F' }}>
                  {APP_LANGS.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
                </select>
              </label>

              <div className="flex gap-2 pt-1">
                <button onClick={saveProfile} disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-display font-semibold"
                  style={{ background: '#1F4D2B', color: '#F7F2E9', border: 'none', cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.7 : 1 }}>
                  <Check size={14} />{saving ? 'Saving...' : 'Save'}
                </button>
                <button onClick={() => setEditing(false)} disabled={saving}
                  className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-display"
                  style={{ background: '#FBF6EC', border: '1px solid #E2D8C4', color: '#5C5040', cursor: 'pointer' }}>
                  <X size={14} />Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl px-4" style={{ background: '#FBF6EC', border: '1px solid #E2D8C4' }}>
              <Row icon={Mail} label="Email" value={user.email} />
              <Row icon={Phone} label="Phone" value={profile?.phone ?? null} />
              <Row icon={Globe} label="Language" value={langLabel} />
              <Row icon={User} label="Role" value={roleLabel} />
            </div>
          )}

          {/* Settings shortcut */}
          <button onClick={() => setSettingsOpen(true)}
            className="w-full flex items-center justify-between px-4 py-3.5 rounded-2xl text-sm font-display"
            style={{ background: '#FBF6EC', border: '1px solid #E2D8C4', color: '#20190F', cursor: 'pointer', textAlign: 'left' }}>
            <span>Appearance &amp; language</span>
            <ChevronRight size={16} style={{ color: '#8C7A62' }} />
          </button>

          {/* Sign out */}
          <button onClick={handleSignOut} disabled={signingOut}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-display font-semibold transition-all"
            style={{ background: signingOut ? '#FBF6EC' : 'rgba(212,110,66,0.06)', border: '1px solid rgba(212,110,66,0.25)', color: signingOut ? '#8C7A62' : '#B83A18', cursor: signingOut ? 'wait' : 'pointer' }}>
            <LogOut size={15} />
            {signingOut ? 'Signing out...' : 'Sign out'}
          </button>

          <p className="text-center text-xs font-mono" style={{ color: '#8C7A62' }}>
            ImbewuField · growing with you
          </p>
        </div>
      </div>

      <TabBar />
      <ThemePanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
