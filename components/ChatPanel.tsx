'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import type { LocationData, SiteData, WaterData } from '@/lib/types';
import { loadReports } from '@/lib/saved-reports';
import { myProduction } from '@/lib/db/queries';

interface Msg { role: 'user' | 'assistant'; content: string }

interface Props {
  locationData: LocationData | null;
  siteData?: SiteData | null;
  waterData?: WaterData | null;
  appLang?: string;
}

const SUGGESTIONS = [
  'What should I plant on my site this season?',
  'How do I build my soil naturally here?',
  'Which of my crops is most worth growing?',
  'Natural ways to deal with pests & disease?',
  'How do I harvest and store rainwater here?',
];

export default function ChatPanel({ locationData, siteData, waterData, appLang }: Props) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [production, setProduction] = useState<{ crop: string; kg: number }[]>([]);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // Best-effort load of the farmer's production records (for finance/crop questions).
  // Silently no-ops when Firebase is unconfigured or the user isn't signed in.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const rows = await myProduction();
        if (alive) setProduction(rows.map((r) => ({ crop: r.crop, kg: r.kg })));
      } catch { /* not signed in / offline — fine */ }
    })();
    return () => { alive = false; };
  }, []);

  const buildContext = useCallback(() => {
    const reports = loadReports();
    return {
      locationData: locationData ?? undefined,
      siteData: siteData ?? undefined,
      waterData: waterData ?? undefined,
      language: appLang,
      production: production.length ? production : undefined,
      reports: reports.length
        ? reports.map((r, i) => ({ name: r.name, savedAt: r.savedAt, text: i === 0 ? r.report : undefined }))
        : undefined,
    };
  }, [locationData, siteData, waterData, appLang, production]);

  const send = useCallback(async (text: string) => {
    const q = text.trim();
    if (!q || loading) return;
    const history = [...messages, { role: 'user' as const, content: q }];
    setMessages([...history, { role: 'assistant', content: '' }]);
    setInput('');
    setLoading(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history, context: buildContext() }),
      });
      if (!res.ok || !res.body) throw new Error(`${res.status}`);
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let acc = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += dec.decode(value, { stream: true });
        setMessages((m) => { const c = [...m]; c[c.length - 1] = { role: 'assistant', content: acc }; return c; });
      }
    } catch {
      setMessages((m) => { const c = [...m]; c[c.length - 1] = { role: 'assistant', content: '⚠ Sorry, something went wrong. Please try again.' }; return c; });
    } finally {
      setLoading(false);
    }
  }, [messages, loading, buildContext]);

  return (
    <div className="flex flex-col gap-3">
      {/* Intro / empty state */}
      {messages.length === 0 && (
        <div className="space-y-3">
          <div className="rounded-xl p-3" style={{ background: 'var(--bg-2)', border: '1px solid var(--border)' }}>
            <div className="text-sm font-display font-semibold mb-1" style={{ color: 'var(--emerald-bright)' }}>🌿 Your farm assistant</div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Ask about {locationData ? 'your site' : 'a site you select'}, what to grow, natural pest control, soil & water, the economics of your crops, your reports, or your project. Organic & regenerative only — no chemical sprays.
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            {SUGGESTIONS.map((s) => (
              <button key={s} onClick={() => send(s)}
                className="text-left px-3 py-2 rounded-lg text-sm font-display transition-all"
                style={{ background: 'var(--bg-3)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      {messages.map((m, i) => (
        <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
          <div className="rounded-2xl px-3.5 py-2.5 text-sm"
            style={m.role === 'user'
              ? { maxWidth: '85%', background: 'rgba(72,168,100,0.18)', border: '1px solid rgba(72,168,100,0.4)', color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }
              : { maxWidth: '92%', background: 'var(--bg-2)', border: '1px solid var(--border)', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
            {m.content || (loading && i === messages.length - 1 ? <span className="animate-pulse">…</span> : '')}
          </div>
        </div>
      ))}
      <div ref={endRef} />

      {/* Input — sticks to the bottom of the scrolling panel */}
      <form
        onSubmit={(e) => { e.preventDefault(); send(input); }}
        className="sticky bottom-0 flex gap-2 pt-2"
        style={{ background: 'linear-gradient(to top, var(--bg-1) 70%, transparent)' }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask anything…"
          className="flex-1 rounded-xl px-3 outline-none min-w-0 font-display"
          style={{ background: 'var(--bg-3)', border: '1px solid var(--border-bright)', color: 'var(--text-primary)', fontSize: 16, minHeight: 46 }}
        />
        <button type="submit" disabled={loading || !input.trim()}
          className="px-4 rounded-xl font-display font-semibold flex-shrink-0 transition-all"
          style={{ minHeight: 46, fontSize: 16,
            background: loading || !input.trim() ? 'var(--bg-3)' : 'rgba(72,168,100,0.25)',
            border: '1px solid rgba(72,168,100,0.5)',
            color: loading || !input.trim() ? 'var(--text-muted)' : 'var(--emerald-bright)' }}>
          {loading ? '⟳' : 'Send'}
        </button>
      </form>
    </div>
  );
}
