'use client';

import { Suspense, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, ChevronLeft, Mail, Check } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { isBackendConfigured } from '@/lib/firebase/init';
import type { UserRole } from '@/lib/db/types';

type Mode = 'signin' | 'create' | 'reset';

const SIGNUP_ROLES: { value: UserRole; label: string }[] = [
  { value: 'farmer',  label: 'Farmer' },
  { value: 'mentor',  label: 'Mentor (trainer / field supervisor)' },
  { value: 'student', label: 'Student' },
  { value: 'ngo',     label: 'NGO coordinator' },
  { value: 'funder',  label: 'Funder / donor' },
];

// Google icon (verbatim SVG — no Lucide equivalent)
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z" fill="#EA4335"/>
    </svg>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginPageInner />
    </Suspense>
  );
}

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Deep-link target to return to after sign-in (e.g. /farmer?panel=Water). Only
  // honour it when it's a same-app relative path — never an absolute/external URL.
  const fromParam = searchParams.get('from');
  const from = fromParam && fromParam.startsWith('/') ? fromParam : null;
  const { signIn, signUp, signInWithGoogle, resetPassword } = useAuth();

  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<UserRole>('farmer');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const backendReady = isBackendConfigured();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!backendReady) return;
    setError(null);
    setLoading(true);
    try {
      if (mode === 'reset') {
        const err = await resetPassword(email);
        if (err) { setError(err); } else { setResetSent(true); }
        return;
      }
      const err = mode === 'signin'
        ? await signIn(email, password)
        : await signUp(email, password, fullName.trim(), role);
      if (err) { setError(err); } else { router.push(from ?? '/home'); }
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    if (!backendReady) return;
    setError(null);
    setGoogleLoading(true);
    try {
      const err = await signInWithGoogle();
      if (err) { setError(err); } else { router.push(from ?? '/home'); }
    } finally {
      setGoogleLoading(false);
    }
  }

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setResetSent(false);
  }

  const card: React.CSSProperties = {
    background: '#FBF6EC',
    border: '1px solid #E2D8C4',
    boxShadow: '0 4px 24px rgba(32,25,15,0.10)',
  };
  const inputStyle = (hasError = false): React.CSSProperties => ({
    background: '#fff',
    border: `1px solid ${hasError ? '#D4922A' : '#E2D8C4'}`,
    color: '#20190F',
    fontSize: 16,
    opacity: backendReady ? 1 : 0.4,
  });

  return (
    <div className="h-screen flex items-center justify-center p-4" style={{ background: '#F7F2E9' }}>
      <div className="w-full max-w-sm rounded-2xl p-6" style={card}>

        {/* Logo */}
        <div className="text-center mb-5">
          <div className="flex items-center justify-center mb-3">
            <div style={{ width: 44, height: 44, background: '#1F4D2B', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#EAF3E2" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 21V11"/><path d="M12 11c0-3.5-2.5-6-6.5-6 0 4 2.5 6 6.5 6Z"/>
                <path d="M12 13c0-3 2.2-5.2 6-5.2 0 3.6-2.2 5.2-6 5.2Z"/>
              </svg>
            </div>
          </div>
          <div className="font-display font-bold" style={{ fontSize: 22, color: '#20190F', letterSpacing: '-0.02em', marginBottom: 4 }}>ImbewuField</div>
          <div className="font-sans text-sm" style={{ color: '#5C5040' }}>
            {mode === 'signin' && 'Sign in to your account.'}
            {mode === 'create' && 'Create a new account.'}
            {mode === 'reset' && 'Reset your password.'}
          </div>
          {from && (
            <div className="font-sans text-xs mt-1" style={{ color: '#8C7A62' }}>
              Sign in to continue to your map
            </div>
          )}
        </div>

        {/* Backend not configured notice */}
        {!backendReady && (
          <div className="rounded-xl px-3 py-2.5 mb-4 font-sans" style={{ fontSize: 13, background: 'rgba(192,122,30,0.08)', border: '1px solid rgba(192,122,30,0.25)', color: '#C07A1E' }}>
            Backend not connected yet — auth is unavailable. The app runs in sample mode.
          </div>
        )}

        {/* Mode toggle — signin / create (not shown for reset) */}
        {mode !== 'reset' && (
          <div className="flex rounded-xl p-0.5 mb-4 gap-0.5" style={{ background: 'rgba(226,216,196,0.5)', border: '1px solid #E2D8C4' }}>
            {(['signin', 'create'] as Mode[]).map((m) => (
              <button key={m} type="button" onClick={() => switchMode(m)}
                className="flex-1 py-1.5 rounded-lg font-sans font-semibold transition-all"
                style={mode === m
                  ? { background: '#1F4D2B', color: '#F7F2E9', fontSize: 13 }
                  : { color: '#5C5040', fontSize: 13, border: '1px solid transparent' }}>
                {m === 'signin' ? 'Sign in' : 'Create account'}
              </button>
            ))}
          </div>
        )}

        {/* ── Reset success ── */}
        {mode === 'reset' && resetSent ? (
          <div className="rounded-xl px-4 py-5 text-center space-y-3" style={{ background: 'rgba(31,77,43,0.06)', border: '1px solid rgba(31,77,43,0.15)' }}>
            <div className="flex items-center justify-center">
              <div className="flex items-center justify-center w-10 h-10 rounded-full" style={{ background: 'rgba(31,77,43,0.12)' }}>
                <Check size={20} style={{ color: '#1F4D2B' }} />
              </div>
            </div>
            <p className="font-display text-sm" style={{ color: '#20190F' }}>Reset email sent to <strong>{email}</strong>.</p>
            <p className="font-sans text-xs" style={{ color: '#5C5040' }}>Check your inbox and follow the link to set a new password.</p>
            <button type="button" onClick={() => switchMode('signin')}
              className="font-sans text-sm font-semibold"
              style={{ color: '#1F4D2B', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
              Back to sign in
            </button>
          </div>
        ) : (
          /* ── Forms ── */
          <form onSubmit={handleSubmit} className="flex flex-col gap-2">
            {mode === 'create' && (
              <input type="text" autoFocus value={fullName}
                onChange={(e) => { setFullName(e.target.value); setError(null); }}
                placeholder="Full name" required disabled={!backendReady}
                className="w-full font-sans rounded-lg px-3 py-2.5 outline-none"
                style={inputStyle()} />
            )}

            <input type="email" autoFocus={mode !== 'create'} value={email}
              onChange={(e) => { setEmail(e.target.value); setError(null); }}
              placeholder="Email address" required disabled={!backendReady}
              className="w-full font-sans rounded-lg px-3 py-2.5 outline-none"
              style={inputStyle(!!error && mode !== 'create')} />

            {mode !== 'reset' && (
              <input type="password" value={password}
                onChange={(e) => { setPassword(e.target.value); setError(null); }}
                placeholder="Password" required disabled={!backendReady}
                className="w-full font-sans rounded-lg px-3 py-2.5 outline-none"
                style={inputStyle(!!error)} />
            )}

            {mode === 'create' && (
              <select value={role} onChange={(e) => setRole(e.target.value as UserRole)}
                disabled={!backendReady}
                className="w-full font-sans rounded-lg px-3 py-2.5 outline-none appearance-none"
                style={inputStyle()}>
                {SIGNUP_ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            )}

            {error && <p className="font-sans" style={{ fontSize: 13, color: '#D4922A' }}>{error}</p>}

            <button type="submit"
              disabled={loading || !backendReady || !email || (mode !== 'reset' && !password) || (mode === 'create' && !fullName.trim())}
              className="w-full py-2.5 rounded-xl font-sans font-semibold transition-all mt-1"
              style={loading || !backendReady
                ? { background: 'rgba(226,216,196,0.6)', border: '1px solid #E2D8C4', color: '#8C7A62', cursor: 'not-allowed', fontSize: 15 }
                : { background: '#1F4D2B', color: '#F7F2E9', cursor: 'pointer', fontSize: 15 }}>
              {loading ? (
                mode === 'signin' ? 'Signing in...' :
                mode === 'create' ? 'Creating account...' : 'Sending...'
              ) : mode === 'reset' ? (
                <span className="flex items-center justify-center gap-1.5"><Mail size={15} />Send reset email</span>
              ) : (
                <span className="flex items-center justify-center gap-1.5">
                  {mode === 'signin' ? 'Sign in' : 'Create account'}<ArrowRight size={15} />
                </span>
              )}
            </button>

            {/* Forgot password link — only on sign-in */}
            {mode === 'signin' && (
              <button type="button" onClick={() => switchMode('reset')}
                className="font-sans text-center transition-opacity hover:opacity-80"
                style={{ fontSize: 13, color: '#5C5040', background: 'none', border: 'none', cursor: 'pointer', marginTop: 2 }}>
                Forgot your password?
              </button>
            )}

            {mode === 'reset' && (
              <button type="button" onClick={() => switchMode('signin')}
                className="font-sans text-center transition-opacity hover:opacity-80"
                style={{ fontSize: 13, color: '#5C5040', background: 'none', border: 'none', cursor: 'pointer', marginTop: 2 }}>
                <span className="flex items-center justify-center gap-1"><ChevronLeft size={12} />Back to sign in</span>
              </button>
            )}
          </form>
        )}

        {/* Google sign-in — only on sign-in / create (not reset) */}
        {mode !== 'reset' && !resetSent && backendReady && (
          <>
            <div className="flex items-center gap-3 my-4">
              <div className="flex-1 h-px" style={{ background: '#E2D8C4' }} />
              <span className="font-sans text-xs" style={{ color: '#8C7A62' }}>or</span>
              <div className="flex-1 h-px" style={{ background: '#E2D8C4' }} />
            </div>
            <button type="button" onClick={handleGoogle} disabled={googleLoading}
              className="w-full flex items-center justify-center gap-2.5 py-2.5 rounded-xl font-sans font-semibold transition-all"
              style={{
                background: '#fff',
                border: '1px solid #E2D8C4',
                color: '#20190F',
                fontSize: 15,
                cursor: googleLoading ? 'wait' : 'pointer',
                opacity: googleLoading ? 0.6 : 1,
              }}>
              <GoogleIcon />
              {googleLoading ? 'Connecting...' : 'Continue with Google'}
            </button>
          </>
        )}

        {/* Back link */}
        <div className="text-center mt-4">
          <a href="/home" className="font-sans transition-opacity hover:opacity-80" style={{ fontSize: 13, color: '#5C5040' }}>
            <span className="flex items-center justify-center gap-1"><ChevronLeft size={12} />Back to app</span>
          </a>
        </div>
      </div>
    </div>
  );
}
