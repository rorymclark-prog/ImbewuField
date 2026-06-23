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

    const unsub = onAuthStateChanged(fb.auth, async (firebaseUser) => {
      setUser(firebaseUser);
      await syncProfile(firebaseUser);
      setLoading(false);
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
      return null;
    } catch (err) {
      return friendlyAuthError(err);
    }
  }, []);

  // ── signInWithGoogle ─────────────────────────────────────────────────────
  const signInWithGoogle = useCallback(async (): Promise<string | null> => {
    const fb = getFirebase();
    if (!fb) return 'Firebase is not configured yet.';
    try {
      const provider = new GoogleAuthProvider();
      const cred = await signInWithPopup(fb.auth, provider);
      // Seed profile doc on first Google sign-in
      const existing = await getMyProfile();
      if (!existing) {
        await updateMyProfile({ full_name: cred.user.displayName ?? '', role: 'farmer', language: 'en' });
      }
      return null;
    } catch (err) {
      return friendlyAuthError(err);
    }
  }, []);

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
  };
  return map[code] ?? `Something went wrong (${code || 'unknown error'}).`;
}
