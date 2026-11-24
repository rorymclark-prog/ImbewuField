'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Onboarding from '@/components/Onboarding';
import PopiaConsent from '@/components/PopiaConsent';
import { useAuth } from '@/lib/auth';
import { isBackendConfigured } from '@/lib/firebase/init';
import { isSampleMode, SAMPLE_MODE_EVENT } from '@/lib/sample-mode';

/**
 * One route-independent gate for language onboarding and per-person POPIA consent.
 * Configured signed-out sessions stay on the login screen, and the in-memory sample
 * needs neither consent nor an account-owned onboarding row.
 */
export default function AccountOnboardingGates() {
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const [sample, setSample] = useState(() => isSampleMode());

  useEffect(() => {
    const refresh = () => setSample(isSampleMode());
    window.addEventListener(SAMPLE_MODE_EVENT, refresh);
    return () => window.removeEventListener(SAMPLE_MODE_EVENT, refresh);
  }, []);

  if (sample) return null;
  if (pathname === '/example') return null;
  if (isBackendConfigured() && (loading || !user)) return null;

  return (
    <>
      <Onboarding />
      <PopiaConsent />
    </>
  );
}
