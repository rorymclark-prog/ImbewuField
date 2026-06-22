'use client';

import { useState, useRef, useEffect, useCallback, type ChangeEvent } from 'react';
import { Camera, Send, FlaskConical, Loader2, X } from 'lucide-react';
import type { LocationData, SiteData, WaterData } from '@/lib/types';
import { loadReports } from '@/lib/saved-reports';
import { myProduction } from '@/lib/db/queries';
import { loadSampleFarmData, clearSampleFarmData, getLocalProduction, getLocalSales, getLocalProject, hasSampleData } from '@/lib/demo-data';
import { getLastSite } from '@/lib/last-site';

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
  'What are my contract obligations and am I on track?',
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
    // Live site (from the map) takes priority; otherwise fall back to the last
    // analysed site so the assistant stays site-aware on any page.
    const last = locationData ? null : getLastSite();
    return {
      locationData: locationData ?? last?.locationData ?? undefined,
      siteData: siteData ?? last?.siteData ?? undefined,
      waterData: waterData ?? last?.waterData ?? undefined,
      language: appLang ?? (typeof window !== 'undefined' ? localStorage.getItem('permamap_lang') ?? undefined : undefined),
      production: prod.length ? prod : undefined,
      sales: sales.length ? sales : undefined,
      project: getLocalProject() ?? undefined,
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
      setMessages((m) => { const c = [...m]; c[c.length - 1] = { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' }; return c; });
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

  const isDisabled = loading || (!input.trim() && !pendingImage);

  return (
    <div className="flex flex-col gap-3">
      {/* Intro / empty state */}
      {messages.length === 0 && (
        <div className="space-y-3">
          <div className="rounded-xl p-3" style={{ background: '#FBF6EC', border: '1px solid #E2D8C4' }}>
            <div className="flex items-center gap-1.5 mb-1">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1F4D2B" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 21V11"/><path d="M12 11c0-3.5-2.5-6-6.5-6 0 4 2.5 6 6.5 6Z"/>
                <path d="M12 13c0-3 2.2-5.2 6-5.2 0 3.6-2.2 5.2-6 5.2Z"/>
              </svg>
              <div className="text-sm font-display font-semibold italic" style={{ color: '#1F4D2B' }}>Hi — I&apos;m Lima.</div>
            </div>
            <div className="text-xs" style={{ color: '#5C5040' }}>
              Ask about your site, crops, soil &amp; water, finances, or project. Tap the camera to photograph a plant or pest for a diagnosis. Organic &amp; regenerative only.
            </div>
          </div>

          {/* Sample data — so finance/crop answers can be tested without real records */}
          <button
            onClick={() => (hasSample ? clearSampleFarmData() : loadSampleFarmData())}
            className="w-full text-left px-3 py-2 rounded-lg text-xs font-display transition-all"
            style={hasSample
              ? { background: 'rgba(192,122,30,0.1)', border: '1px solid rgba(192,122,30,0.3)', color: '#C07A1E' }
              : { background: 'rgba(31,77,43,0.08)', border: '1px solid rgba(31,77,43,0.25)', color: '#1F4D2B' }}>
            <FlaskConical size={13} className="inline mr-1" />
            {hasSample ? 'Sample farm data loaded — tap to clear' : 'Load sample farm data (to test finance questions)'}
          </button>

          <div className="flex flex-col gap-1.5">
            {SUGGESTIONS.map((s) => (
              <button key={s} onClick={() => send(s)}
                className="text-left px-3 py-2 rounded-lg font-display hover:bg-[rgba(31,77,43,0.05)] transition-colors"
                style={{ background: '#FBF6EC', border: '1px solid #E2D8C4', color: '#20190F', fontSize: 13 }}>
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      {messages.map((m, i) => (
        <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
          <div className="px-3.5 py-2.5 text-sm"
            style={m.role === 'user'
              ? { maxWidth: '85%', background: 'rgba(31,77,43,0.09)', color: '#20190F', borderRadius: 16, whiteSpace: 'pre-wrap' }
              : { maxWidth: '92%', background: '#FBF6EC', border: '1px solid #E2D8C4', color: '#20190F', borderRadius: 16, whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>
            {m.image && <img src={m.image} alt="" className="rounded-lg mb-1.5" style={{ maxWidth: 180, maxHeight: 180, objectFit: 'cover' }} />}
            {m.role === 'assistant' && m.content.startsWith('Sorry,')
              ? <span style={{ color: '#D4922A' }}>{m.content}</span>
              : m.content || (loading && i === messages.length - 1 ? <span className="animate-pulse">…</span> : '')}
          </div>
        </div>
      ))}
      <div ref={endRef} />

      {/* Input — sticks to the bottom of the scrolling panel */}
      <div className="sticky bottom-0 pt-2" style={{ background: 'linear-gradient(to top, #F7F2E9 70%, transparent)' }}>
        {pendingImage && (
          <div className="flex items-center gap-2 mb-1.5">
            <img src={pendingImage.preview} alt="" className="rounded-lg" style={{ width: 44, height: 44, objectFit: 'cover' }} />
            <span className="text-xs" style={{ color: '#5C5040' }}>Photo attached</span>
            <button onClick={() => setPendingImage(null)} className="flex items-center gap-0.5 text-xs" style={{ color: '#D4922A' }}>
              <X size={12} />remove
            </button>
          </div>
        )}
        <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="flex gap-2">
          <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={onPickFile} className="hidden" />
          <button type="button" onClick={() => fileRef.current?.click()} title="Take / attach a photo"
            className="flex-shrink-0 rounded-xl flex items-center justify-center hover:bg-[rgba(31,77,43,0.08)] transition-colors"
            style={{ minHeight: 46, minWidth: 46, background: 'rgba(226,216,196,0.4)', border: '1px solid #E2D8C4', color: '#5C5040' }}>
            <Camera size={18} />
          </button>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask Lima anything…"
            className="flex-1 rounded-xl px-3 outline-none min-w-0 font-display"
            style={{ background: '#fff', border: '1px solid #E2D8C4', color: '#20190F', fontSize: 16, minHeight: 46, borderRadius: 12 }}
          />
          <button type="submit" disabled={isDisabled}
            className="px-4 rounded-xl font-display font-semibold flex-shrink-0 flex items-center justify-center transition-all"
            style={{ minHeight: 46,
              background: isDisabled ? 'rgba(226,216,196,0.4)' : '#1F4D2B',
              border: isDisabled ? '1px solid #E2D8C4' : 'none',
              color: isDisabled ? '#8C7A62' : '#F7F2E9' }}>
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </form>
      </div>
    </div>
  );
}
