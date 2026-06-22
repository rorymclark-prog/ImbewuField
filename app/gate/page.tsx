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
        window.location.href = params.get('from') || '/home';
      } else { setError(true); setLoading(false); }
    } catch { setError(true); setLoading(false); }
  }

  return (
    <div className="h-screen flex items-center justify-center p-4" style={{ background: '#F7F2E9' }}>
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl p-6"
        style={{ background: '#FBF6EC', border: '1px solid #E2D8C4', boxShadow: '0 4px 24px rgba(32,25,15,0.10)' }}>
        <div className="text-center mb-5">
          {/* Lima icon */}
          <div className="flex items-center justify-center mb-3">
            <div style={{ width: 44, height: 44, background: '#1F4D2B', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#EAF3E2" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 21V11"/><path d="M12 11c0-3.5-2.5-6-6.5-6 0 4 2.5 6 6.5 6Z"/>
                <path d="M12 13c0-3 2.2-5.2 6-5.2 0 3.6-2.2 5.2-6 5.2Z"/>
              </svg>
            </div>
          </div>
          <div className="font-display font-bold" style={{ fontSize: 22, color: '#20190F', letterSpacing: '-0.02em', marginBottom: 4 }}>ImbewuField</div>
          <div className="font-sans text-sm" style={{ color: '#5C5040' }}>Private prototype — enter the password to continue.</div>
        </div>
        <input
          type="password"
          autoFocus
          value={password}
          onChange={(e) => { setPassword(e.target.value); setError(false); }}
          placeholder="Password"
          className="w-full font-sans rounded-lg px-3 py-2.5 outline-none mb-2"
          style={{ background: '#fff', border: `1px solid ${error ? '#D4922A' : '#E2D8C4'}`, color: '#20190F', fontSize: 16 }}
        />
        {error && <p className="font-sans mb-2" style={{ fontSize: 13, color: '#D4922A' }}>Wrong password — try again.</p>}
        <button type="submit" disabled={loading || !password}
          className="w-full py-2.5 rounded-xl font-sans font-semibold transition-all"
          style={loading
            ? { background: 'rgba(226,216,196,0.6)', border: '1px solid #E2D8C4', color: '#8C7A62', fontSize: 15 }
            : { background: '#1F4D2B', color: '#F7F2E9', fontSize: 15, opacity: !password ? 0.5 : 1 }}>
          {loading ? 'Checking…' : 'Enter →'}
        </button>
      </form>
    </div>
  );
}
