'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
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
        router.push('/');
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
    <div
      className="h-screen flex items-center justify-center p-4"
      style={{ background: 'var(--bg-0)' }}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-6"
        style={{
          background: 'var(--bg-1)',
          border: '1px solid var(--border-bright)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        }}
      >
        {/* Header */}
        <div className="text-center mb-5">
          <div className="text-3xl mb-2">🌿</div>
          <div className="font-display font-bold text-xl text-gradient mb-1">ImbewuField</div>
          <div className="font-display text-sm" style={{ color: 'var(--text-muted)' }}>
            {mode === 'signin' ? 'Sign in to your account.' : 'Create a new account.'}
          </div>
        </div>

        {/* Backend not configured notice */}
        {!backendReady && (
          <div
            className="rounded-xl px-3 py-2.5 mb-4 text-xs font-mono"
            style={{
              background: 'rgba(251,191,36,0.08)',
              border: '1px solid rgba(251,191,36,0.3)',
              color: 'var(--gold)',
            }}
          >
            Backend not connected yet — auth is unavailable. The app runs in sample mode.
          </div>
        )}

        {/* Mode toggle */}
        <div
          className="flex rounded-xl p-0.5 mb-4 gap-0.5"
          style={{ background: 'var(--bg-3)', border: '1px solid var(--border)' }}
        >
          {(['signin', 'create'] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => switchMode(m)}
              className="flex-1 py-1.5 rounded-lg text-xs font-display font-semibold transition-all"
              style={
                mode === m
                  ? {
                      background: 'linear-gradient(135deg, rgba(72,168,100,0.25), rgba(72,168,100,0.1))',
                      border: '1px solid rgba(72,168,100,0.4)',
                      color: 'var(--emerald-bright)',
                    }
                  : { color: 'var(--text-muted)', border: '1px solid transparent' }
              }
            >
              {m === 'signin' ? 'Sign in' : 'Create account'}
            </button>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-2">
          {mode === 'create' && (
            <input
              type="text"
              autoFocus={mode === 'create'}
              value={fullName}
              onChange={(e) => { setFullName(e.target.value); setError(null); }}
              placeholder="Full name"
              required
              disabled={!backendReady}
              className="w-full text-sm font-display rounded-lg px-3 py-2.5 outline-none"
              style={{
                background: 'var(--bg-3)',
                border: '1px solid var(--border-bright)',
                color: 'var(--text-primary)',
                opacity: backendReady ? 1 : 0.4,
              }}
            />
          )}

          <input
            type="email"
            autoFocus={mode === 'signin'}
            value={email}
            onChange={(e) => { setEmail(e.target.value); setError(null); }}
            placeholder="Email address"
            required
            disabled={!backendReady}
            className="w-full text-sm font-display rounded-lg px-3 py-2.5 outline-none"
            style={{
              background: 'var(--bg-3)',
              border: `1px solid ${error ? 'var(--orange)' : 'var(--border-bright)'}`,
              color: 'var(--text-primary)',
              opacity: backendReady ? 1 : 0.4,
            }}
          />

          <input
            type="password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(null); }}
            placeholder="Password"
            required
            disabled={!backendReady}
            className="w-full text-sm font-display rounded-lg px-3 py-2.5 outline-none"
            style={{
              background: 'var(--bg-3)',
              border: `1px solid ${error ? 'var(--orange)' : 'var(--border-bright)'}`,
              color: 'var(--text-primary)',
              opacity: backendReady ? 1 : 0.4,
            }}
          />

          {error && (
            <p className="text-xs font-mono" style={{ color: 'var(--orange)' }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !backendReady || !email || !password || (mode === 'create' && !fullName.trim())}
            className="w-full py-2.5 rounded-xl text-sm font-display font-semibold transition-all mt-1"
            style={
              loading || !backendReady
                ? {
                    background: 'var(--bg-4)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-muted)',
                    cursor: 'not-allowed',
                  }
                : {
                    background: 'linear-gradient(135deg, rgba(72,168,100,0.25), rgba(72,168,100,0.1))',
                    border: '1px solid rgba(72,168,100,0.5)',
                    color: 'var(--emerald-bright)',
                    cursor: 'pointer',
                  }
            }
          >
            {loading
              ? mode === 'signin' ? 'Signing in…' : 'Creating account…'
              : mode === 'signin' ? 'Sign in →' : 'Create account →'}
          </button>
        </form>

        {/* Back link */}
        <div className="text-center mt-4">
          <a
            href="/"
            className="text-xs font-mono transition-opacity hover:opacity-80"
            style={{ color: 'var(--text-muted)' }}
          >
            ← Back to app
          </a>
        </div>
      </div>
    </div>
  );
}
