'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, ChevronLeft } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { isBackendConfigured } from '@/lib/firebase/init';

type Mode = 'signin' | 'create';

export default function LoginPage() {
  const router = useRouter();
  const { signIn, signUp } = useAuth();

  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const backendReady = isBackendConfigured();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!backendReady) return;
    setError(null);
    setLoading(true);
    try {
      let err: string | null;
      if (mode === 'signin') {
        err = await signIn(email, password);
      } else {
        err = await signUp(email, password, fullName.trim());
      }
      if (err) {
        setError(err);
      } else {
        router.push('/home');
      }
    } finally {
      setLoading(false);
    }
  }

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
  }

  return (
    <div className="h-screen flex items-center justify-center p-4" style={{ background: '#F7F2E9' }}>
      <div className="w-full max-w-sm rounded-2xl p-6"
        style={{ background: '#FBF6EC', border: '1px solid #E2D8C4', boxShadow: '0 4px 24px rgba(32,25,15,0.10)' }}>
        {/* Header */}
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
            {mode === 'signin' ? 'Sign in to your account.' : 'Create a new account.'}
          </div>
        </div>

        {/* Backend not configured notice */}
        {!backendReady && (
          <div className="rounded-xl px-3 py-2.5 mb-4 font-sans" style={{ fontSize: 13, background: 'rgba(192,122,30,0.08)', border: '1px solid rgba(192,122,30,0.25)', color: '#C07A1E' }}>
            Backend not connected yet — auth is unavailable. The app runs in sample mode.
          </div>
        )}

        {/* Mode toggle */}
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

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-2">
          {mode === 'create' && (
            <input type="text" autoFocus={mode === 'create'} value={fullName}
              onChange={(e) => { setFullName(e.target.value); setError(null); }}
              placeholder="Full name" required disabled={!backendReady}
              className="w-full font-sans rounded-lg px-3 py-2.5 outline-none"
              style={{ background: '#fff', border: '1px solid #E2D8C4', color: '#20190F', fontSize: 16, opacity: backendReady ? 1 : 0.4 }}
            />
          )}
          <input type="email" autoFocus={mode === 'signin'} value={email}
            onChange={(e) => { setEmail(e.target.value); setError(null); }}
            placeholder="Email address" required disabled={!backendReady}
            className="w-full font-sans rounded-lg px-3 py-2.5 outline-none"
            style={{ background: '#fff', border: `1px solid ${error ? '#D4922A' : '#E2D8C4'}`, color: '#20190F', fontSize: 16, opacity: backendReady ? 1 : 0.4 }}
          />
          <input type="password" value={password}
            onChange={(e) => { setPassword(e.target.value); setError(null); }}
            placeholder="Password" required disabled={!backendReady}
            className="w-full font-sans rounded-lg px-3 py-2.5 outline-none"
            style={{ background: '#fff', border: `1px solid ${error ? '#D4922A' : '#E2D8C4'}`, color: '#20190F', fontSize: 16, opacity: backendReady ? 1 : 0.4 }}
          />
          {error && <p className="font-sans" style={{ fontSize: 13, color: '#D4922A' }}>{error}</p>}
          <button type="submit"
            disabled={loading || !backendReady || !email || !password || (mode === 'create' && !fullName.trim())}
            className="w-full py-2.5 rounded-xl font-sans font-semibold transition-all mt-1"
            style={loading || !backendReady
              ? { background: 'rgba(226,216,196,0.6)', border: '1px solid #E2D8C4', color: '#8C7A62', cursor: 'not-allowed', fontSize: 15 }
              : { background: '#1F4D2B', color: '#F7F2E9', cursor: 'pointer', fontSize: 15 }}>
            {loading
              ? mode === 'signin' ? 'Signing in...' : 'Creating account...'
              : <span className="flex items-center justify-center gap-1.5">{mode === 'signin' ? 'Sign in' : 'Create account'}<ArrowRight size={15} /></span>}
          </button>
        </form>

        {/* Back link */}
        <div className="text-center mt-4">
          <a href="/home" className="font-sans transition-opacity hover:opacity-80" style={{ fontSize: 13, color: '#5C5040' }}>
            <span className="flex items-center gap-1"><ChevronLeft size={12} />Back to app</span>
          </a>
        </div>
      </div>
    </div>
  );
}
