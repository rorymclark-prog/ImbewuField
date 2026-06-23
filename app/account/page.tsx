'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { isBackendConfigured } from '@/lib/firebase/init';
import TabBar from '@/components/TabBar';
import SettingsButton from '@/components/SettingsButton';
import BrandLogo from '@/components/BrandLogo';
import { Sprout, Mail, Phone, Globe, LogOut, ChevronRight, User, type LucideIcon } from 'lucide-react';
import type { UserRole } from '@/lib/db/types';

const ROLE_LABELS: Record<UserRole, string> = {
  farmer: 'Farmer',
  supervisor: 'Supervisor',
  trainer: 'Trainer',
  student: 'Student',
  ngo: 'NGO coordinator',
  funder: 'Funder',
  admin: 'Admin',
};

const LANG_LABELS: Record<string, string> = {
  en: 'English', zu: 'isiZulu', xh: 'isiXhosa', af: 'Afrikaans',
  st: 'Sesotho', nso: 'Sepedi', tn: 'Setswana', ts: 'Xitsonga',
  ve: 'Tshivenda', ss: 'siSwati', nr: 'isiNdebele',
};

function InitialAvatar({ name, email }: { name: string | null; email: string | null }) {
  const initial = (name ?? email ?? '?')[0].toUpperCase();
  return (
    <div
      className="flex items-center justify-center rounded-full font-display font-bold flex-shrink-0"
      style={{
        width: 64, height: 64, fontSize: 28,
        background: 'linear-gradient(135deg, #1F4D2B, #2D6B3C)',
        color: '#EAF3E2',
      }}
    >
      {initial}
    </div>
  );
}

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

  useEffect(() => {
    if (!loading && !user && isBackendConfigured()) {
      router.replace('/login');
    }
  }, [user, loading, router]);

  async function handleSignOut() {
    setSigningOut(true);
    await signOutUser();
    router.push('/gate');
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
  const langLabel = profile?.language ? (LANG_LABELS[profile.language] ?? profile.language) : null;

  return (
    <div className="flex flex-col" style={{ height: '100dvh', background: '#F7F2E9' }}>
      {/* Header */}
      <header
        className="flex-shrink-0 flex items-center px-4 gap-3"
        style={{ height: 52, background: '#FBF6EC', borderBottom: '1px solid #E2D8C4' }}
      >
        <BrandLogo icon="leaf" />
        <div className="w-px h-5" style={{ background: '#E2D8C4' }} />
        <span className="text-xs font-display" style={{ color: '#5C5040' }}>Account</span>
        <div className="flex-1" />
        <SettingsButton />
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-md mx-auto px-4 py-6 space-y-5">

          {/* Avatar + name card */}
          <div
            className="rounded-2xl p-5 flex items-center gap-4"
            style={{ background: '#FBF6EC', border: '1px solid #E2D8C4' }}
          >
            <InitialAvatar name={displayName} email={user.email} />
            <div className="min-w-0">
              <div className="font-display font-semibold text-lg leading-tight truncate" style={{ color: '#20190F' }}>
                {displayName ?? 'ImbewuField user'}
              </div>
              {roleLabel && (
                <div
                  className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-xs font-display"
                  style={{ background: 'rgba(31,77,43,0.08)', border: '1px solid rgba(31,77,43,0.15)', color: '#1F4D2B' }}
                >
                  <Sprout size={11} />
                  {roleLabel}
                </div>
              )}
            </div>
          </div>

          {/* Details */}
          <div
            className="rounded-2xl px-4"
            style={{ background: '#FBF6EC', border: '1px solid #E2D8C4' }}
          >
            <Row icon={Mail} label="Email" value={user.email} />
            <Row icon={Phone} label="Phone" value={profile?.phone ?? null} />
            <Row icon={Globe} label="Language" value={langLabel} />
            <Row icon={User} label="Role" value={roleLabel} />
          </div>

          {/* Settings shortcut */}
          <button
            onClick={() => {
              // Fire the settings button — navigate to settings via the existing SettingsButton
              // mechanism (ThemePanel is triggered globally)
              const btn = document.querySelector<HTMLButtonElement>('[aria-label="Appearance settings"]');
              btn?.click();
            }}
            className="w-full flex items-center justify-between px-4 py-3.5 rounded-2xl text-sm font-display"
            style={{ background: '#FBF6EC', border: '1px solid #E2D8C4', color: '#20190F', cursor: 'pointer', textAlign: 'left' }}
          >
            <span>Appearance &amp; language</span>
            <ChevronRight size={16} style={{ color: '#8C7A62' }} />
          </button>

          {/* Sign out */}
          <button
            onClick={handleSignOut}
            disabled={signingOut}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-display font-semibold transition-all"
            style={{
              background: signingOut ? '#FBF6EC' : 'rgba(212,110,66,0.06)',
              border: '1px solid rgba(212,110,66,0.25)',
              color: signingOut ? '#8C7A62' : '#B83A18',
              cursor: signingOut ? 'wait' : 'pointer',
            }}
          >
            <LogOut size={15} />
            {signingOut ? 'Signing out…' : 'Sign out'}
          </button>

          <p className="text-center text-xs font-mono" style={{ color: '#8C7A62' }}>
            ImbewuField · growing with you
          </p>
        </div>
      </div>

      <TabBar />
    </div>
  );
}
