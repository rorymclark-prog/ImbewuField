'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { isBackendConfigured } from '@/lib/firebase/init';
import { canAccessRolePage } from '@/lib/role-access';
import { ngoDashboardV2Enabled } from '@/lib/ngo-dashboard-v2-flag';
import BrandLogo from '@/components/BrandLogo';
import MenuButton from '@/components/MenuButton';
import AdminPanel from '@/components/AdminPanel';
import type { UserRole } from '@/lib/db/types';

// Platform-superadmin-only: role + org assignment, org creation, funder->NGO grants. Not linked
// from RoleSwitcher/nav anywhere — reached by URL only, matching the plan's "Rory-only, no public
// nav entry" scope. Gated by both the role check (canAccessRolePage) and the ngo_dashboard_v2
// feature flag; an unauthenticated visit or the flag being off both look identical to the page
// not existing (a silent redirect to /home), same as app/community/page.tsx's pattern.

const ADMIN_ALLOWED_ROLES = new Set<UserRole>(['admin']);

function Spinner() {
  return (
    <div className="h-[100dvh] flex items-center justify-center" style={{ background: 'var(--bg-0)' }}>
      <Loader2 size={24} className="animate-spin" style={{ color: '#1F4D2B' }} />
    </div>
  );
}

export default function AdminPage() {
  const { user, role, loading } = useAuth();
  const router = useRouter();
  const isLive = isBackendConfigured();
  const flagOn = ngoDashboardV2Enabled();

  useEffect(() => {
    if (!flagOn) { router.replace('/home'); return; }
    if (!loading && !user && isLive) router.replace('/login');
  }, [flagOn, user, loading, router, isLive]);

  if (!flagOn) return <Spinner />;
  if (loading || (!user && isLive)) return <Spinner />;

  if (isLive && !canAccessRolePage(role, ADMIN_ALLOWED_ROLES)) {
    return (
      <div className="flex h-screen items-center justify-center px-4" style={{ background: 'var(--bg-0)' }}>
        <div className="rounded-2xl px-6 py-8 text-center max-w-xs" style={{ background: '#FFFEFA', border: '1px solid #E2D8C4' }}>
          <p className="text-sm font-display font-semibold mb-1" style={{ color: '#20190F' }}>Platform admin only</p>
          <p className="text-xs font-sans leading-relaxed" style={{ color: '#8C7A62' }}>This area is restricted to ImbewuField&rsquo;s platform administrator.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col overflow-hidden" style={{ height: '100dvh', background: 'var(--bg-0)' }}>
      <header className="flex-shrink-0 flex items-center px-3 md:px-5 gap-2 md:gap-4" style={{ height: 52, background: '#FFFEFA', borderBottom: '1px solid #E2D8C4' }}>
        <MenuButton />
        <BrandLogo />
        <div className="w-px h-5" style={{ background: 'var(--border-bright)', opacity: 0.5 }} />
        <span className="text-xs font-display" style={{ color: '#5C5040' }}>Platform admin</span>
      </header>
      <div className="flex-1 overflow-y-auto">
        <AdminPanel />
      </div>
    </div>
  );
}
