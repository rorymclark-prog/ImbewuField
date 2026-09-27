'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { getFirebase } from '@/lib/firebase/init';
import { isSampleMode } from '@/lib/sample-mode';
import { canOpenTrainingRoute, OFFLINE_STUDY_ACCESS, type AppAccess } from '@/lib/app-access';

type AccessState = { access: AppAccess | null; loading: boolean; error: boolean; uid: string | null };
const Context = createContext<AccessState>({ access: null, loading: true, error: false, uid: null });
export const useTrainingAccess = () => useContext(Context);

export function TrainingAccessProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const pathname = usePathname();
  const [state, setState] = useState<AccessState>({ access: null, loading: true, error: false, uid: null });

  useEffect(() => {
    if (authLoading) return;
    const fb = getFirebase();
    if (!user || !fb) {
      setState({ access: null, loading: false, error: false, uid: null });
      return;
    }
    setState({ access: null, loading: true, error: false, uid: user.uid });
    return onSnapshot(doc(fb.db, 'app_access', user.uid), (snapshot) => {
      setState({ access: snapshot.exists() ? snapshot.data() as AppAccess : snapshot.metadata.fromCache ? OFFLINE_STUDY_ACCESS : null, loading: false, error: false, uid: user.uid });
    }, () => setState({ access: null, loading: false, error: true, uid: user.uid }));
  }, [user?.uid, authLoading]);

  if (!isSampleMode() && user && (authLoading || state.loading || state.uid !== user.uid)) return null;
  if (!isSampleMode() && user && state.error) return <AccessNotice text="Access could not be checked. Reconnect and try again." />;
  if (!isSampleMode() && user && !canOpenTrainingRoute(state.access, pathname)) {
    return <Context.Provider value={state}><AccessNotice text="This tool is not enabled for your course account yet. Your studies and manual remain available." /></Context.Provider>;
  }
  return <Context.Provider value={state}>{children}</Context.Provider>;
}

function AccessNotice({ text }: { text: string }) {
  return <main style={{ maxWidth: 560, margin: '10vh auto', padding: 24 }}>
    <h1 style={{ fontSize: 24, fontWeight: 700 }}>Training access</h1>
    <p style={{ margin: '16px 0' }}>{text}</p>
    <p><Link href="/student">Open studies</Link> · <Link href="/manual">Open manual</Link> · <Link href="/contact">Get help</Link></p>
  </main>;
}
