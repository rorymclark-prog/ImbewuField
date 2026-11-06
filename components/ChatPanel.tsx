'use client';

import { useState, useRef, useEffect, useCallback, type ChangeEvent } from 'react';
import { Camera, Send, FlaskConical, Loader2, X } from 'lucide-react';
import type { LocationData, SiteData, WaterData } from '@/lib/types';
import { loadReports } from '@/lib/saved-reports';
import { getMyConsent, myProduction, mySales } from '@/lib/db/queries';
import { CONSENT_SCOPES, hasConsent, type FarmerConsent } from '@/lib/consent';
import { loadSampleFarmData, clearSampleFarmData, getLocalProduction, getLocalSales, getLocalProject, hasSampleData } from '@/lib/demo-data';
import { getLastSite } from '@/lib/last-site';
import SampleLimaConversation from './SampleLimaConversation';
import { useSampleRole } from '@/lib/use-role-navigation';
import { paidApiHeaders } from '@/lib/api-client-auth';
import { useLanguage } from '@/lib/i18n';
import { isSampleMode } from '@/lib/sample-mode';
import { readLocalAdviceActor, useLocalAdviceContext } from '@/lib/use-local-advice-context';
import { requestLocalAdvice, localAdviceHoldMessage, localAdviceUnavailableMessage, LOCAL_ADVICE_SITE_HOLD, LOCAL_ADVICE_BASIS, LOCAL_ADVICE_GENERAL_BASIS } from '@/lib/local-advice-client';
import type { LocalAdviceMode } from '@/lib/local-advice-types';

// A message's content is never a raw server/JS error — a failed send or an unreadable photo sets
// `error: true` instead, and the bubble renders t('chatErrorMessage')/t('chatPhotoOpenError') for
// it, same in every language. See CLAUDE.md lang-01.
interface Msg { role: 'user' | 'assistant'; content: string; image?: string; error?: boolean; errorKind?: 'photo' }

interface Props {
  locationData: LocationData | null;
  siteData?: SiteData | null;
  waterData?: WaterData | null;
  appLang?: string;
  /** A LimaBar question is retained for review against the current advice scope. */
  initialQuery?: string | null;
  /** LimaBar's camera button (?photo=1) — opens the photo picker automatically once on mount. */
  initialPhoto?: boolean;
  /** Photo selected directly from a user tap, before opening this panel. */
  initialFile?: File | null;
  /** Called once the initialQuery/initialPhoto deep link has been acted on, so the caller can clear it. */
  onInitialConsumed?: () => void;
}

const SUGGESTION_KEYS = [
  'chatSuggestionPlant',
  'chatSuggestionBestCrop',
  'chatSuggestionContract',
  'chatSuggestionPest',
  'chatSuggestionWater',
] as const;

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

export default function ChatPanel(props: Props) {
  const role = useSampleRole();
  return role ? <SampleLimaConversation key={role} role={role}/> : <LiveChatPanel {...props}/>;
}

function LiveChatPanel({ locationData, siteData, waterData, appLang, initialQuery, initialPhoto, initialFile, onInitialConsumed }: Props) {
  const { t, lang } = useLanguage();
  const [adviceMode, setAdviceMode] = useState<LocalAdviceMode>('personal-site');
  const [policyMessage, setPolicyMessage] = useState('');
  const recordOwner = useRef<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [messageKey, setMessageKey] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [production, setProduction] = useState<{ crop: string; kg: number | null; quantity?: number; unit?: string }[]>([]);
  const [salesRows, setSalesRows] = useState<{ crop: string; kg: number | null; quantity?: number; unit?: string; amount: number }[]>([]);
  const [storedConsent, setConsent] = useState<FarmerConsent | null>(null);
  const [storedImage, setPendingImage] = useState<(Awaited<ReturnType<typeof fileToPayload>> & { key: string; actor: string }) | null>(null);
  const [hasSample, setHasSample] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => { abortRef.current?.abort(); }, []);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  useEffect(() => {
    const refresh = () => setHasSample(hasSampleData());
    refresh();
    window.addEventListener('imbewu-farmdata-changed', refresh);
    return () => window.removeEventListener('imbewu-farmdata-changed', refresh);
  }, []);

  const buildContext = useCallback(() => {
    const reports = loadReports();
    const localProd = getLocalProduction().map((p) => ({ crop: p.crop, kg: p.kg }));
    const localSales = getLocalSales().map((s) => ({ crop: s.crop, kg: s.kg, amount: s.amount }));
    const ownRecords = recordOwner.current === readLocalAdviceActor().key;
    const consent = ownRecords ? storedConsent : null;
    const prod = [...(ownRecords ? production : []), ...localProd];
    const sales = [...(ownRecords ? salesRows : []), ...localSales];
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
      // Their own switches, by their own labels — never another farmer's, never a cohort's.
      consent: consent
        ? {
            sharing: CONSENT_SCOPES.filter((s) => hasConsent(consent, s.id)).map((s) => s.label),
            notSharing: CONSENT_SCOPES.filter((s) => !hasConsent(consent, s.id)).map((s) => s.label),
            stoppedAt: consent.revoked_at ?? null,
          }
        : undefined,
      project: getLocalProject() ?? undefined,
      reports: reports.length ? reports.map((r, i) => ({ name: r.name, savedAt: r.savedAt, text: i === 0 ? r.report : undefined })) : undefined,
    };
  }, [locationData, siteData, waterData, appLang, production, salesRows, storedConsent]);

  const context = useLocalAdviceContext(locationData ?? getLastSite()?.locationData ?? null,
    adviceMode === 'general-help' ? { language: appLang ?? lang } : buildContext, adviceMode);
  const contextKey = context.snapshot?.key ?? null;
  const pendingImage = storedImage?.key === contextKey && storedImage.actor === context.actorKey ? storedImage : null;
  const contextRef = useRef(context);
  contextRef.current = context;
  const requestVersion = useRef(0);
  const submittedQuestion = useRef<{ text: string; actor: string; mode: LocalAdviceMode } | null>(null);
  const previousActor = useRef(context.actorKey);
  useEffect(() => {
    ++requestVersion.current;
    abortRef.current?.abort();
    setLoading(false);
    setMessages([]);
    setPendingImage(null);
    setPolicyMessage('');
    if (previousActor.current !== context.actorKey) setInput('');
    else if (submittedQuestion.current?.actor === context.actorKey && submittedQuestion.current.mode === adviceMode) {
      setInput(submittedQuestion.current.text);
    }
    previousActor.current = context.actorKey;
    submittedQuestion.current = null;
  }, [contextKey, context.actorKey, adviceMode]);

  // Best-effort load of the signed-in farmer's real records. No-ops otherwise.
  // Harvests AND sales: for a long time only production was loaded here, so a signed-in farmer's
  // real harvests reached the assistant while their real sales did not — and the `sales` field was
  // filled from the DEMO store alone. Ask "what did I earn from my cabbages" and the answer came
  // back from practice view data, or from nothing, while the rows sat in Firestore.
  useEffect(() => {
    let alive = true;
    const ownerKey = context.actorKey;
    recordOwner.current = ownerKey;
    setProduction([]); setSalesRows([]); setConsent(null);
    const current = () => alive && readLocalAdviceActor().key === ownerKey;
    (async () => {
      try { const rows = await myProduction(); if (current()) setProduction(rows.map((r) => ({ crop: r.crop, kg: r.kg, quantity: r.quantity, unit: r.unit }))); }
      catch { /* not signed in / offline */ }
    })();
    (async () => {
      try { const rows = await mySales(); if (current()) setSalesRows(rows.map((r) => ({ crop: r.crop, kg: r.kg, quantity: r.quantity, unit: r.unit, amount: r.amount }))); }
      catch { /* not signed in / offline */ }
    })();
    // The farmer's own sharing settings, read through the SAME query ConsentPanel uses, so the
    // assistant and the screen can never describe different switches. Sample mode and a farmer who
    // has never opened that screen both come back null — which stays null all the way to the
    // prompt, where "I cannot see your settings, open Account" is the honest answer. Filling in a
    // confident "you are sharing nothing" from a failed read is the one thing not to do here.
    (async () => {
      try { const c = await getMyConsent(); if (current()) setConsent(c); }
      catch { /* not signed in / offline / sample mode */ }
    })();
    return () => { alive = false; };
  }, [context.actorKey]);

  const send = useCallback(async (text: string) => {
    const q = text.trim();
    const img = adviceMode === 'personal-site' ? pendingImage : null;
    if ((!q && !img) || loading) return;
    const snapshot = contextRef.current.snapshot;
    if (!snapshot) { setInput(q); setPolicyMessage(LOCAL_ADVICE_SITE_HOLD); return; }
    const version = ++requestVersion.current;
    const current = () => version === requestVersion.current && contextRef.current.isCurrent(snapshot);
    const history = [...(messageKey === snapshot.key ? messages : []), { role: 'user' as const, content: q || (img ? t('chatDefaultPhotoQuestion') : ''), image: img?.preview }];
    submittedQuestion.current = { text: q, actor: contextRef.current.actorKey, mode: adviceMode };
    setMessageKey(snapshot.key);
    setMessages([...history, { role: 'assistant', content: '' }]);
    setInput(''); setPendingImage(null); setPolicyMessage(''); setLoading(true);
    const controller = new AbortController();
    abortRef.current?.abort(); abortRef.current = controller;
    const result = await requestLocalAdvice({ snapshot, isCurrent: current, signal: controller.signal,
      headers: paidApiHeaders, fetcher: init => fetch('/api/chat', init),
      body: { messages: history.map(({ role, content }) => ({ role, content })),
        context: adviceMode === 'general-help' ? { language: appLang ?? lang } : buildContext(),
        ...(img ? { image: { data: img.data, mediaType: img.mediaType } } : {}) },
    });
    if (!current()) return;
    if (result.status === 'ready') { submittedQuestion.current = null; setMessages([...history, { role: 'assistant', content: result.text }]); }
    else if (result.status === 'held') { setInput(q); setMessages(history); setPolicyMessage(localAdviceHoldMessage(result)); }
    else if (result.status === 'unavailable') { setInput(q); setMessages(history); setPolicyMessage(localAdviceUnavailableMessage(result)); }
    else if (result.status === 'error') setMessages([...history, { role: 'assistant', content: '', error: true }]);
    setLoading(false);
  }, [messages, messageKey, loading, buildContext, pendingImage, t, adviceMode, appLang, lang]);

  const onPickFile = useCallback(async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const version = requestVersion.current, actor = readLocalAdviceActor().key;
    try {
      const image = await fileToPayload(file);
      const key = contextRef.current.snapshot?.key;
      if (key && requestVersion.current === version && readLocalAdviceActor().key === actor) setPendingImage({ ...image, key, actor });
    } catch { /* Ignore a failed or obsolete attachment. */ }
  }, []);

  // Country and account records may still be loading. Retain the question for
  // explicit review rather than spending allowance then consuming a retired intent.
  useEffect(() => {
    if (initialQuery && initialQuery.trim()) {
      setInput(initialQuery);
      setPolicyMessage('Review your question and advice scope, then press Send.');
      onInitialConsumed?.();
    } else if (initialPhoto) {
      fileRef.current?.click();
      onInitialConsumed?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!initialFile) return;
    let active = true;
    const version = requestVersion.current, actor = readLocalAdviceActor().key;
    const current = () => active && requestVersion.current === version && readLocalAdviceActor().key === actor;
    fileToPayload(initialFile).then(
      (image) => { const key = contextRef.current.snapshot?.key; if (current() && key) setPendingImage({ ...image, key, actor }); },
      () => { if (current()) setMessages([{ role: 'assistant', content: '', error: true, errorKind: 'photo' }]); },
    );
    return () => { active = false; };
  }, [initialFile]);

  const isDisabled = loading || !context.snapshot || (!input.trim() && !pendingImage);

  return (
    <div className="flex flex-col gap-3">
      <label lang="en" className="text-sm font-display">
        Help with
        <select value={adviceMode} onChange={event => setAdviceMode(event.target.value as LocalAdviceMode)}
          className="ml-2 rounded-lg border px-2 py-2" style={{ minHeight: 44 }}>
          <option value="personal-site">My saved site</option>
          <option value="general-help">Using the app</option>
        </select>
      </label>
      <p lang="en" className="text-sm font-display" style={{ color: 'var(--text-secondary)' }}>
        {adviceMode === 'general-help' ? LOCAL_ADVICE_GENERAL_BASIS : context.snapshot ? LOCAL_ADVICE_BASIS : LOCAL_ADVICE_SITE_HOLD}
      </p>
      {policyMessage && <p lang="en" role="status" className="text-sm">{policyMessage}</p>}
      {/* Lima "thinking" shimmer — a calm gradient background-clip sweep over the
          placeholder text (spec §6), replacing the old opacity-flash animate-pulse.
          Linear sweep so it never looks "broken" on a slow connection; static
          fallback under prefers-reduced-motion. Keyframes live here because this
          component owns the only surface that uses them. */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
@keyframes limaShimmer { 0% { background-position: 150% 50%; } 100% { background-position: -50% 50%; } }
.lima-shimmer {
  display: inline-block;
  font-weight: 600;
  background: linear-gradient(90deg, var(--text-muted) 25%, var(--brand-light) 50%, var(--text-muted) 75%);
  background-size: 200% 100%;
  -webkit-background-clip: text; background-clip: text;
  -webkit-text-fill-color: transparent; color: transparent;
  animation: limaShimmer 1.6s linear infinite;
}
@media (prefers-reduced-motion: reduce) {
  .lima-shimmer { animation: none; color: var(--text-muted); -webkit-text-fill-color: var(--text-muted); }
}`,
        }}
      />
      {/* Intro / empty state */}
      {messages.length === 0 && !initialFile && (
        <div className="space-y-3">
          {lang === 'zu' && (
            <p role="note" className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('chatZuluDraftNotice')}</p>
          )}
          <div className="rounded-xl p-3" style={{ background: 'var(--bg-1)', border: '1px solid var(--border)' }}>
            <div className="flex items-center gap-1.5 mb-1">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1F4D2B" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 21V11"/><path d="M12 11c0-3.5-2.5-6-6.5-6 0 4 2.5 6 6.5 6Z"/>
                <path d="M12 13c0-3 2.2-5.2 6-5.2 0 3.6-2.2 5.2-6 5.2Z"/>
              </svg>
              <div className="text-sm font-display font-semibold italic" style={{ color: 'var(--color-forest-800)' }}>{t('chatGreeting')}</div>
            </div>
            <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              {t('chatIntro')}
            </div>
          </div>

          {/* Sample data — a tester tool that writes demo records to the device, so it only
              renders in sample mode; a real farmer never sees it. */}
          {isSampleMode() && (
            <button
              onClick={() => (hasSample ? clearSampleFarmData() : loadSampleFarmData())}
              className="w-full text-left px-3 py-2 rounded-lg text-xs font-display transition-all"
              style={hasSample
                ? { background: 'rgba(192,122,30,0.1)', border: '1px solid rgba(192,122,30,0.3)', color: 'var(--gold)' }
                : { background: 'rgba(31,77,43,0.08)', border: '1px solid rgba(31,77,43,0.25)', color: 'var(--color-forest-800)' }}>
              <FlaskConical size={13} className="inline mr-1" />
              {hasSample ? t('chatSampleDataLoaded') : t('chatSampleDataLoad')}
            </button>
          )}

          <div className="flex flex-col gap-1.5">
            {adviceMode === 'personal-site' && SUGGESTION_KEYS.map((key) => (
              <button key={key} onClick={() => send(t(key))}
                className="text-left px-3 py-2 rounded-lg font-display hover:bg-[rgba(31,77,43,0.05)] transition-colors"
                style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: 13 }}>
                {t(key)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      {(messageKey === contextKey ? messages : []).map((m, i) => (
        <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
          <div className="px-3.5 py-2.5 text-sm"
            style={m.role === 'user'
              ? { maxWidth: '85%', background: '#1F4D2B', color: '#F2EBDD', borderRadius: '16px 4px 16px 16px', whiteSpace: 'pre-wrap' }
              : { maxWidth: '92%', background: 'var(--bg-1)', border: '1px solid #E7DDC9', color: 'var(--text-primary)', borderRadius: '4px 16px 16px 16px', whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>
            {m.image && <img src={m.image} alt="" className="rounded-lg mb-1.5" style={{ maxWidth: 180, maxHeight: 180, objectFit: 'cover' }} />}
            {m.role === 'assistant' && m.error
              ? <span style={{ color: 'var(--orange)' }}>{t(m.errorKind === 'photo' ? 'chatPhotoOpenError' : 'chatErrorMessage')}</span>
              : m.content || (loading && i === messages.length - 1 ? <span className="lima-shimmer">{t('chatThinking')}</span> : '')}
          </div>
        </div>
      ))}
      <div ref={endRef} />

      {/* Input — sticks to the bottom of the scrolling panel */}
      <div className="sticky bottom-0 pt-2" style={{ background: 'linear-gradient(to top, var(--bg-0) 70%, transparent)' }}>
        {pendingImage && (
          <div className="flex items-center gap-2 mb-1.5">
            <img src={pendingImage.preview} alt="" className="rounded-lg" style={{ width: 44, height: 44, objectFit: 'cover' }} />
            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{t('chatPhotoAttached')}</span>
            <button onClick={() => setPendingImage(null)} className="flex items-center gap-0.5 text-xs" style={{ color: 'var(--gold)' }}>
              <X size={12} />{t('chatRemovePhoto')}
            </button>
          </div>
        )}
        <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="flex gap-2">
          <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={onPickFile} className="hidden" />
          <button type="button" disabled={adviceMode === 'general-help' || !context.snapshot} onClick={() => fileRef.current?.click()} title={t('chatTakePhotoTitle')}
            className="flex-shrink-0 rounded-xl flex items-center justify-center hover:bg-[rgba(31,77,43,0.08)] transition-colors"
            style={{ minHeight: 46, minWidth: 46, background: 'rgba(226,216,196,0.4)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
            <Camera size={18} />
          </button>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t('chatInputPlaceholder')}
            className="flex-1 rounded-xl px-3 outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold)] min-w-0 font-display"
            style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: 16, minHeight: 46, borderRadius: 12 }}
          />
          <button type="submit" disabled={isDisabled}
            className="px-4 rounded-xl font-display font-semibold flex-shrink-0 flex items-center justify-center transition-all"
            style={{ minHeight: 46,
              background: isDisabled ? 'rgba(226,216,196,0.4)' : '#1F4D2B',
              border: isDisabled ? '1px solid var(--border)' : 'none',
              color: isDisabled ? '#755942' : 'var(--on-forest)' }}>
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </form>
      </div>
    </div>
  );
}
