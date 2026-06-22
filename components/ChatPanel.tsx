'use client';

import { useState, useRef, useEffect, useCallback, type ChangeEvent } from 'react';
import type { LocationData, SiteData, WaterData } from '@/lib/types';
import { loadReports } from '@/lib/saved-reports';
import { myProduction } from '@/lib/db/queries';
import { loadSampleFarmData, clearSampleFarmData, getLocalProduction, getLocalSales, hasSampleData } from '@/lib/demo-data';

interface Msg { role: 'user' | 'assistant'; content: string; image?: string }

interface Props {
  locationData: LocationData | null;
  siteData?: SiteData | null;
  waterData?: WaterData | null;
  appLang?: string;
}

const SUGGESTIONS = [
  'What should I plant on my site this season?',
  'Which of my crops makes the most money per kg?',
  'How do I build my soil naturally here?',
  'Natural ways to deal with pests & disease?',
  'How do I harvest and store rainwater here?',
];

// Downscale a photo to keep the upload small and within model limits.
function fileToPayload(file: File): Promise<{ data: string; mediaType: string; preview: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const max = 1200;
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('no canvas'));
        ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
        resolve({ data: dataUrl.split(',')[1], mediaType: 'image/jpeg', preview: dataUrl });
      };
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function ChatPanel({ locationData, siteData, waterData, appLang }: Props) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [production, setProduction] = useState<{ crop: string; kg: number }[]>([]);
  const [pendingImage, setPendingImage] = useState<{ data: string; mediaType: string; preview: string } | null>(null);
  const [hasSample, setHasSample] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  useEffect(() => {
    const refresh = () => setHasSample(hasSampleData());
    refresh();
    window.addEventListener('imbewu-farmdata-changed', refresh);
    return () => window.removeEventListener('imbewu-farmdata-changed', refresh);
  }, []);

  // Best-effort load of real production records (signed-in users). No-ops otherwise.
  useEffect(() => {
    let alive = true;
    (async () => {
      try { const rows = await myProduction(); if (alive) setProduction(rows.map((r) => ({ crop: r.crop, kg: r.kg }))); }
      catch { /* not signed in / offline */ }
    })();
    return () => { alive = false; };
  }, []);

  const buildContext = useCallback(() => {
    const reports = loadReports();
    const localProd = getLocalProduction().map((p) => ({ crop: p.crop, kg: p.kg }));
    const sales = getLocalSales().map((s) => ({ crop: s.crop, kg: s.kg, amount: s.amount }));
    const prod = [...production, ...localProd];
    return {
      locationData: locationData ?? undefined,
      siteData: siteData ?? undefined,
      waterData: waterData ?? undefined,
      language: appLang,
      production: prod.length ? prod : undefined,
      sales: sales.length ? sales : undefined,
      reports: reports.length ? reports.map((r, i) => ({ name: r.name, savedAt: r.savedAt, text: i === 0 ? r.report : undefined })) : undefined,
    };
  }, [locationData, siteData, waterData, appLang, production]);

  const send = useCallback(async (text: string) => {
    const q = text.trim();
    const img = pendingImage;
    if ((!q && !img) || loading) return;
    const history = [...messages, { role: 'user' as const, content: q || (img ? 'Please diagnose this photo.' : ''), image: img?.preview }];
    setMessages([...history, { role: 'assistant', content: '' }]);
    setInput('');
    setPendingImage(null);
    setLoading(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: history.map(({ role, content }) => ({ role, content })),
          context: buildContext(),
          image: img ? { data: img.data, mediaType: img.mediaType } : undefined,
        }),
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
  }, [messages, loading, buildContext, pendingImage]);

  const onPickFile = useCallback(async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try { setPendingImage(await fileToPayload(file)); } catch { /* ignore */ }
  }, []);

  return (
    <div className="flex flex-col gap-3">
      {/* Intro / empty state */}
      {messages.length === 0 && (
        <div className="space-y-3">
          <div className="rounded-xl p-3" style={{ background: 'var(--bg-2)', border: '1px solid var(--border)' }}>
            <div className="text-sm font-display font-semibold mb-1" style={{ color: 'var(--emerald-bright)' }}>🌿 Your farm assistant</div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Ask about {locationData ? 'your site' : 'a site you select'}, what to grow, natural pest control, soil & water, the economics of your crops, your reports or your project. Tap 📷 to photograph a plant/pest for a diagnosis. Organic & regenerative only — no chemical sprays.
            </div>
          </div>

          {/* Sample data — so finance/crop answers can be tested without real records */}
          <button
            onClick={() => (hasSample ? clearSampleFarmData() : loadSampleFarmData())}
            className="w-full text-left px-3 py-2 rounded-lg text-xs font-display transition-all"
            style={hasSample
              ? { background: 'rgba(212,168,83,0.15)', border: '1px solid rgba(212,168,83,0.4)', color: 'var(--gold)' }
              : { background: 'rgba(72,168,100,0.12)', border: '1px solid rgba(72,168,100,0.35)', color: 'var(--emerald-bright)' }}>
            {hasSample ? '🧪 Sample farm data loaded — tap to clear' : '🧪 Load sample farm data (to test finance questions)'}
          </button>

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
            {m.image && <img src={m.image} alt="" className="rounded-lg mb-1.5" style={{ maxWidth: 180, maxHeight: 180, objectFit: 'cover' }} />}
            {m.content || (loading && i === messages.length - 1 ? <span className="animate-pulse">…</span> : '')}
          </div>
        </div>
      ))}
      <div ref={endRef} />

      {/* Input — sticks to the bottom of the scrolling panel */}
      <div className="sticky bottom-0 pt-2" style={{ background: 'linear-gradient(to top, var(--bg-1) 70%, transparent)' }}>
        {pendingImage && (
          <div className="flex items-center gap-2 mb-1.5">
            <img src={pendingImage.preview} alt="" className="rounded-lg" style={{ width: 44, height: 44, objectFit: 'cover' }} />
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Photo attached</span>
            <button onClick={() => setPendingImage(null)} className="text-xs" style={{ color: 'var(--orange)' }}>✗ remove</button>
          </div>
        )}
        <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="flex gap-2">
          <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={onPickFile} className="hidden" />
          <button type="button" onClick={() => fileRef.current?.click()} title="Take / attach a photo"
            className="flex-shrink-0 rounded-xl" style={{ minHeight: 46, minWidth: 46, fontSize: 20, background: 'var(--bg-3)', border: '1px solid var(--border-bright)', color: 'var(--text-secondary)' }}>
            📷
          </button>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask anything…"
            className="flex-1 rounded-xl px-3 outline-none min-w-0 font-display"
            style={{ background: 'var(--bg-3)', border: '1px solid var(--border-bright)', color: 'var(--text-primary)', fontSize: 16, minHeight: 46 }}
          />
          <button type="submit" disabled={loading || (!input.trim() && !pendingImage)}
            className="px-4 rounded-xl font-display font-semibold flex-shrink-0 transition-all"
            style={{ minHeight: 46, fontSize: 16,
              background: loading || (!input.trim() && !pendingImage) ? 'var(--bg-3)' : 'rgba(72,168,100,0.25)',
              border: '1px solid rgba(72,168,100,0.5)',
              color: loading || (!input.trim() && !pendingImage) ? 'var(--text-muted)' : 'var(--emerald-bright)' }}>
            {loading ? '⟳' : 'Send'}
          </button>
        </form>
      </div>
    </div>
  );
}
