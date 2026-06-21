'use client';

import { useState } from 'react';

export default function GatePage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError(false);
    try {
      const res = await fetch('/api/gate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) });
      if (res.ok) {
        const params = new URLSearchParams(window.location.search);
        window.location.href = params.get('from') || '/';
      } else { setError(true); setLoading(false); }
    } catch { setError(true); setLoading(false); }
  }

  return (
    <div className="h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg-0)' }}>
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl p-6"
        style={{ background: 'var(--bg-1)', border: '1px solid var(--border-bright)', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
        <div className="text-center mb-5">
          <div className="text-3xl mb-2">🌿</div>
          <div className="font-display font-bold text-xl text-gradient mb-1">ImbewuField</div>
          <div className="font-display text-sm" style={{ color: 'var(--text-muted)' }}>Private prototype — enter the password to continue.</div>
        </div>
        <input
          type="password"
          autoFocus
          value={password}
          onChange={(e) => { setPassword(e.target.value); setError(false); }}
          placeholder="Password"
          className="w-full text-sm font-display rounded-lg px-3 py-2.5 outline-none mb-2"
          style={{ background: 'var(--bg-3)', border: `1px solid ${error ? 'var(--orange)' : 'var(--border-bright)'}`, color: 'var(--text-primary)' }}
        />
        {error && <p className="text-xs font-mono mb-2" style={{ color: 'var(--orange)' }}>Wrong password — try again.</p>}
        <button type="submit" disabled={loading || !password}
          className="w-full py-2.5 rounded-xl text-sm font-display font-semibold transition-all"
          style={loading ? { background: 'var(--bg-4)', border: '1px solid var(--border)', color: 'var(--text-muted)' } : { background: 'linear-gradient(135deg, rgba(72,168,100,0.25), rgba(72,168,100,0.1))', border: '1px solid rgba(72,168,100,0.5)', color: 'var(--emerald-bright)' }}>
          {loading ? 'Checking…' : 'Enter →'}
        </button>
      </form>
    </div>
  );
}
