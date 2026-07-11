'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile,
  sendPasswordResetEmail,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  type User,
} from 'firebase/auth';
import { getFirebase, isBackendConfigured } from '@/lib/firebase/init';
import { getMyProfile, updateMyProfile } from '@/lib/db/queries';
import type { Profile, UserRole } from '@/lib/db/types';

// ─── Types ───────────────────────────────────────────────────────────────────

interface AuthContextValue {
  user: User | null;
  profile: Profile | null;
  role: UserRole | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (email: string, password: string, fullName: string, role?: UserRole) => Promise<string | null>;
  signInWithGoogle: () => Promise<string | null>;
  resetPassword: (email: string) => Promise<string | null>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<string | null>;
  refreshProfile: () => Promise<void>;
  signOutUser: () => Promise<void>;
}

// ─── Context ─────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue>({
  user: null,
  profile: null,
  role: null,
  loading: false,
  signIn: async () => 'Backend not configured.',
  signUp: async () => 'Backend not configured.',
  signInWithGoogle: async () => 'Backend not configured.',
  resetPassword: async () => 'Backend not configured.',
  changePassword: async () => 'Backend not configured.',
  refreshProfile: async () => {},
  signOutUser: async () => {},
});

// ─── Provider ────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState<boolean>(isBackendConfigured());

  // Load/refresh profile whenever the Firebase user changes.
  const syncProfile = useCallback(async (firebaseUser: User | null) => {
    if (!firebaseUser) {
      setProfile(null);
      return;
    }
    const p = await getMyProfile();
    setProfile(p);
  }, []);

  useEffect(() => {
    const fb = getFirebase();
    if (!fb) {
      // Backend not wired up yet — stay in guest/sample mode.
      setLoading(false);
      return;
    }

    // Complete a Google redirect sign-in if we're returning from one, seeding
    // the profile doc for a brand-new user (the redirect twin of the popup path).
    getRedirectResult(fb.auth)
      .then(async (result) => {
        if (!result?.user) return;
        const existing = await getMyProfile();
        if (!existing) {
          await updateMyProfile({ full_name: result.user.displayName ?? '', role: 'farmer', language: 'en' });
        }
      })
      .catch((err) => console.error('Google redirect sign-in failed:', err));

    const unsub = onAuthStateChanged(fb.auth, async (firebaseUser) => {
      setUser(firebaseUser);
      try {
        await syncProfile(firebaseUser);
      } catch (err) {
        console.error('syncProfile failed:', err);
        setProfile(null);
      } finally {
        setLoading(false);
      }
    });

    return unsub;
  }, [syncProfile]);

  // ── signIn ──────────────────────────────────────────────────────────────
  const signIn = useCallback(async (email: string, password: string): Promise<string | null> => {
    const fb = getFirebase();
    if (!fb) return 'Firebase is not configured yet — running in sample mode.';
    try {
      await signInWithEmailAndPassword(fb.auth, email, password);
      return null;
    } catch (err) {
      return friendlyAuthError(err);
    }
  }, []);

  // ── signUp ──────────────────────────────────────────────────────────────
  const signUp = useCallback(async (
    email: string,
    password: string,
    fullName: string,
    role: UserRole = 'farmer',
  ): Promise<string | null> => {
    const fb = getFirebase();
    if (!fb) return 'Firebase is not configured yet — running in sample mode.';
    try {
      const cred = await createUserWithEmailAndPassword(fb.auth, email, password);
      await updateProfile(cred.user, { displayName: fullName });
      await updateMyProfile({ full_name: fullName, role, language: 'en' });
      await syncProfile(cred.user);
      return null;
    } catch (err) {
      return friendlyAuthError(err);
    }
  }, [syncProfile]);

  // ── signInWithGoogle ─────────────────────────────────────────────────────
  const signInWithGoogle = useCallback(async (): Promise<string | null> => {
    const fb = getFirebase();
    if (!fb) return 'Firebase is not configured yet.';
    // Google blocks its OAuth screen in in-app browsers — don't spin on a popup
    // that can never resolve; tell the user to open a real browser.
    if (isEmbeddedBrowser()) {
      return 'Google sign-in won\'t open inside this in-app browser. Open imbewufield.vercel.app in Chrome or Safari, or sign in with email + password here.';
    }
    const provider = new GoogleAuthProvider();
    try {
      if (prefersRedirect()) {
        // Full-page redirect — resolves on return via getRedirectResult (below).
        await signInWithRedirect(fb.auth, provider);
        return null; // navigates away; nothing more to do here
      }
      const cred = await signInWithPopup(fb.auth, provider);
      const existing = await getMyProfile();
      if (!existing) {
        await updateMyProfile({ full_name: cred.user.displayName ?? '', role: 'farmer', language: 'en' });
      }
      await syncProfile(cred.user);
      return null;
    } catch (err) {
      // A blocked popup on desktop → fall back to the redirect flow once.
      const code = (err as { code?: string }).code ?? '';
      if (code === 'auth/popup-blocked' || code === 'auth/cancelled-popup-request') {
        try { await signInWithRedirect(fb.auth, provider); return null; } catch (e2) { return friendlyAuthError(e2); }
      }
      return friendlyAuthError(err);
    }
  }, [syncProfile]);

  // ── resetPassword ────────────────────────────────────────────────────────
  const resetPassword = useCallback(async (email: string): Promise<string | null> => {
    const fb = getFirebase();
    if (!fb) return 'Firebase is not configured.';
    try {
      await sendPasswordResetEmail(fb.auth, email);
      return null;
    } catch (err) {
      return friendlyAuthError(err);
    }
  }, []);

  // ── changePassword ───────────────────────────────────────────────────────
  const changePassword = useCallback(async (currentPassword: string, newPassword: string): Promise<string | null> => {
    const fb = getFirebase();
    const currentUser = fb?.auth.currentUser;
    if (!fb || !currentUser || !currentUser.email) return 'Not signed in.';
    const hasPasswordProvider = currentUser.providerData.some((p) => p.providerId === 'password');
    if (!hasPasswordProvider) return 'Your account uses Google sign-in — password changes are not applicable.';
    try {
      const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
      await reauthenticateWithCredential(currentUser, credential);
      await updatePassword(currentUser, newPassword);
      return null;
    } catch (err) {
      return friendlyAuthError(err);
    }
  }, []);

  // ── refreshProfile ───────────────────────────────────────────────────────
  const refreshProfile = useCallback(async (): Promise<void> => {
    const fb = getFirebase();
    if (fb?.auth.currentUser) await syncProfile(fb.auth.currentUser);
  }, [syncProfile]);

  // ── signOutUser ─────────────────────────────────────────────────────────
  const signOutUser = useCallback(async (): Promise<void> => {
    const fb = getFirebase();
    if (!fb) return;
    await signOut(fb.auth);
    setUser(null);
    setProfile(null);
  }, []);

  const role: UserRole | null = profile?.role ?? null;

  return (
    <AuthContext.Provider value={{
      user, profile, role, loading,
      signIn, signUp, signInWithGoogle, resetPassword, changePassword, refreshProfile, signOutUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useAuth() {
  return useContext(AuthContext);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function friendlyAuthError(err: unknown): string {
  const code = (err as { code?: string }).code ?? '';
  const map: Record<string, string> = {
    'auth/invalid-email':                            'That doesn\'t look like a valid email address.',
    'auth/user-disabled':                            'This account has been disabled.',
    'auth/user-not-found':                           'No account found with that email.',
    'auth/wrong-password':                           'Incorrect password — try again.',
    'auth/invalid-credential':                       'Email or password is incorrect.',
    'auth/email-already-in-use':                     'An account with that email already exists.',
    'auth/weak-password':                            'Choose a stronger password (at least 6 characters).',
    'auth/too-many-requests':                        'Too many attempts — wait a moment and try again.',
    'auth/network-request-failed':                   'Network error — check your connection.',
    'auth/popup-closed-by-user':                     'Sign-in was cancelled.',
    'auth/popup-blocked':                            'Pop-up was blocked — allow pop-ups for this site and try again.',
    'auth/account-exists-with-different-credential': 'An account already exists with this email using a different sign-in method.',
    'auth/requires-recent-login':                    'Please sign out and sign back in before changing your password.',
    'auth/operation-not-allowed':                    'Google sign-in isn\'t enabled for this app yet. Use email + password, or ask the admin to enable Google.',
    'auth/unauthorized-domain':                      'This web address isn\'t authorised for Google sign-in yet. Use email + password for now.',
    'auth/cancelled-popup-request':                  'Sign-in was cancelled.',
    'auth/web-storage-unsupported':                  'This browser blocks the storage Google sign-in needs — open the site in Chrome or Safari.',
  };
  return map[code] ?? `Something went wrong (${code || 'unknown error'}).`;
}

// Google's OAuth screen refuses to load inside in-app / embedded browsers
// (Instagram, Facebook, the Claude preview pane, generic WebViews, etc.) —
// it returns "disallowed_useragent". Detect those so we can tell the user to
// open a real browser instead of spinning on a popup that can never resolve.
export function isEmbeddedBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  // Electron / Claude preview pane and the common in-app browsers all run
  // Google's OAuth screen through a WebView it refuses (disallowed_useragent).
  const embedded = /(FBAN|FBAV|Instagram|Line|Twitter|WhatsApp|WebView|; wv\)|GSA\/|Electron|Claude)/i.test(ua);
  const iosInApp = /iPhone|iPod|iPad/.test(ua) && !/Safari/.test(ua);
  return embedded || iosInApp;
}

const prefersRedirect = (): boolean => {
  if (typeof window === 'undefined') return false;
  // Popups are unreliable on touch devices — redirect is the robust path there.
  return window.matchMedia?.('(pointer: coarse)').matches || 'ontouchstart' in window;
};
