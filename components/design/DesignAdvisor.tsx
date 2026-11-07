'use client';

// DesignAdvisor — floating advice card over the Design Studio canvas.
//
// Regional tips need the current saved-site country basis. Explicit paid requests
// additionally match the displayed semantic source to the caller's saved canvas.

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Sparkles, X, ChevronUp, ChevronDown, TriangleAlert, Lightbulb, Loader2 } from 'lucide-react';
import type { DesignCanvasState } from '@/lib/design-canvas';
import { DESIGN_CANVAS_CHANGED_EVENT, readCanvasSourceReceipt } from '@/lib/design-canvas';
import { ELEMENTS_BY_ID } from '@/lib/design-elements';
import { evaluateDesign, type AdviceLayer } from '@/lib/design-rules';
import { formatDesignTranslation } from '@/lib/design-studio-i18n';
import { useLanguage } from '@/lib/i18n';
import { paidApiHeaders } from '@/lib/api-client-auth';
import { useAuth } from '@/lib/auth';
import { getFirebase } from '@/lib/firebase/init';
import { activeAccountUid } from '@/lib/account-local-storage';
import { isSampleMode, SAMPLE_MODE_EVENT } from '@/lib/sample-mode';
import { currentPlanningSupport } from '@/lib/international/planning-support';
import { DESIGN_ADVICE_DEMO_SITE, inspectDesignAdviceSource } from '@/lib/design-advice-source';
import { requestDesignAdvice, type DesignAdviceClientSnapshot } from '@/lib/design-advice-client';
import { largestStudioRing } from '@/lib/base-layers';
import { ringCentroid } from '@/lib/water-system';

const GOLD = '#F7C97E';
const DARK = '#0B120B';

// Dark warm-glass treatment (spec §6, adapted to green) — a forest-tinted translucent
// surface with backdrop blur, replacing the old near-black hard-bordered HUD. Kept
// dark enough that near-white text stays readable over a bright satellite map even
// where backdrop-filter is unsupported (the translucent fill alone still reads).
const GLASS = 'rgba(18,40,24,0.74)';          // cards / panels
const GLASS_SOFT = 'rgba(18,40,24,0.66)';     // chips / small buttons
const GLASS_BORDER = 'rgba(247,201,126,0.30)'; // softened warm (gold) hairline
const GLASS_SHADOW = '0 8px 28px rgba(9,20,12,0.45)'; // warm, forest-tinted throw
const GLASS_GRAD = 'linear-gradient(135deg, #2D6B3C, #163820)'; // Lima primary action
const glassBlur = { backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)' } as const;

interface DesignAdvisorProps {
  state: DesignCanvasState;
  site: {
    windFromSummer?: string;
    slopeDeg?: number;
    aspectLabel?: string;
    rainfallMm?: number;
    biome?: string;
    slopePct?: number;
  } | null;
  houseXY: [number, number] | null;
  lastChangeId: string | null;
  /** Simple / All tools (lib/app-level.ts). Simple shows only the single top tip — no "N more",
   *  no Ask Lima AI feed. */
  simple?: boolean;
}

interface AiSuggestion {
  msg: string;
}

export default function DesignAdvisor({ state, simple = false }: DesignAdvisorProps) {
  const { t } = useLanguage();
  const { user } = useAuth();
  // The tip card starts CLOSED and only opens when the farmer taps the chip. It used to open
  // itself, and the effect below reset the dismissal on EVERY edit (lastChangeId is updatedAt,
  // which restamps on every drag/add/delete) — so it reappeared the instant you closed it, on top
  // of the tool row. A tip must never stand between the farmer and their next action.
  const [tipOpen, setTipOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [storedSuggestions, setAiSuggestions] = useState<AiSuggestion[]>([]);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [storedError, setAiError] = useState<string | null>(null);
  const [resultKey, setResultKey] = useState<string | null>(null);
  const [, refreshContext] = useState(0);
  const liveState = useRef(state);
  liveState.current = state;
  const requestVersion = useRef(0);
  const pending = useRef<AbortController | null>(null);

  function readContext() {
    try {
      const current = liveState.current, sample = isSampleMode(), ownerUid = activeAccountUid();
      const tokenUser = getFirebase()?.auth.currentUser ?? null;
      const source = inspectDesignAdviceSource(current, current.siteId);
      const support = currentPlanningSupport(current.siteId);
      const reference = sample && current.siteId === DESIGN_ADVICE_DEMO_SITE;
      const receipt = readCanvasSourceReceipt(current.siteId);
      const savedSource = receipt.status === 'ready' ? inspectDesignAdviceSource(receipt.raw, current.siteId) : null;
      const agreesWithDevice = receipt.status === 'ready' && receipt.ownerUid === ownerUid && receipt.sample === sample
        && savedSource?.status === 'ready' && source.status === 'ready' && savedSource.canonical === source.canonical;
      const localReady = source.status === 'ready' && (reference || !sample && agreesWithDevice
        && support.allowCataloguePlanning && support.mode === 'south-african-site');
      const countryFingerprint = reference ? `original-demo-reference:${current.siteId}` : support.fingerprint;
      const key = source.status === 'ready' ? JSON.stringify([ownerUid, tokenUser?.uid ?? null, sample,
        current.siteId, current.step, source.canonical, countryFingerprint]) : null;
      const snapshot: DesignAdviceClientSnapshot | null = localReady && key
        && (reference || !!ownerUid && ownerUid === tokenUser?.uid)
        ? { key, mode: reference ? 'original-demo-reference' : 'personal-site', siteId: current.siteId,
            currentStep: current.step, raw: current, countryFingerprint }
        : null;
      return { localReady, snapshot, tokenUser, reference };
    } catch {
      return { localReady: false, snapshot: null, tokenUser: null, reference: false };
    }
  }
  const context = readContext();
  const contextKey = context.snapshot?.key ?? null;
  const aiSuggestions = resultKey === contextKey && contextKey ? storedSuggestions : [];
  const aiError = resultKey === contextKey && contextKey ? storedError : null;
  const aiLoading = !!contextKey && loadingKey === contextKey;
  const askLabel = context.reference ? 'Ask Lima about the original sample layout' : t('designAdvisorAskLima');
  const referenceBasis = <div lang="en" style={{ color: '#FBF6EC', fontSize: 11, background: GLASS, borderRadius: 8, padding: '5px 8px' }}>
    {context.reference ? 'South African sample reference' : 'Existing South African references · grower-confirmed country; local agronomy is unverified.'}
    {!context.snapshot && <div>Sign in and save this site’s country details to ask Lima.</div>}
  </div>;
  const unavailable = 'Local design advice needs a supported saved site and current country details. Your drawing remains available.';
  // These props previously had no source identity. A roof traced on this admitted
  // canvas is usable; the old fetched site and map-only roof props are unbound.
  const advice = useMemo(() => {
    if (!context.localReady) return [];
    const house = largestStudioRing(state, 'house');
    return evaluateDesign(state, ELEMENTS_BY_ID, undefined, house ? { houseXY: ringCentroid(house) } : undefined);
  }, [state, context.localReady]);
  // Wraps the whole cluster so an outside tap can dismiss it (below). Lives on the shell — the
  // transparent shell has pointerEvents:'none', so only the visible chip/card counts as "inside".
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let active = true;
    let refreshQueued = false;
    let latestInvalidationVersion = 0;
    function invalidate() {
      latestInvalidationVersion = ++requestVersion.current;
      pending.current?.abort();
      // Navigation saves dispatch while the parent's state updater is rendering.
      // Revoke advice now; only React's refresh waits until that render is over.
      if (refreshQueued) return;
      refreshQueued = true;
      queueMicrotask(() => {
        if (!active) return;
        refreshQueued = false;
        const invalidationVersion = latestInvalidationVersion;
        // A new Ask can start before this refresh, or while React queues its setter.
        setLoadingKey(current => requestVersion.current === invalidationVersion ? null : current);
        refreshContext(value => value + 1);
      });
    }
    const events = ['permamap-places-changed', DESIGN_CANVAS_CHANGED_EVENT, SAMPLE_MODE_EVENT, 'storage'];
    for (const event of events) window.addEventListener(event, invalidate);
    return () => {
      active = false;
      ++requestVersion.current;
      pending.current?.abort();
      for (const event of events) window.removeEventListener(event, invalidate);
    };
  }, []);
  useEffect(() => {
    ++requestVersion.current;
    pending.current?.abort();
    setLoadingKey(null);
    setAiSuggestions([]);
    setAiError(null);
    setResultKey(null);
  }, [contextKey, user?.uid]);

  // Dismiss on a tap/click ANYWHERE outside the cluster (Rory: "i cant close lima if i click
  // anywhere — it should close auto"), plus Escape. Only armed while something is open, so the
  // resting chip/"Ask Lima" button keep working. Capture phase so it fires before other handlers.
  const isOpen = tipOpen || expanded || aiSuggestions.length > 0 || !!aiError;
  useEffect(() => {
    if (!isOpen) return;
    function close() {
      setTipOpen(false);
      setExpanded(false);
      setAiSuggestions([]);
      setAiError(null);
    }
    function onPointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) close();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') close();
    }
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [isOpen]);

  // Lima only surfaces tips for the LAYER the farmer is working on — a zones-step advisor showing
  // tank/shade tips is noise (Rory). Advice carries a `layer` tag (lib/design-rules.ts). The Base/
  // Review steps have no single layer, so they show everything.
  const stepLayer: AdviceLayer | null =
    state.step === 'water' ? 'water'
    : state.step === 'earthworks' ? 'earthworks'
    : state.step === 'zones' ? 'zones'
    : state.step === 'planting' ? 'planting'
    : state.step === 'structures' ? 'structures'
    : null;
  const layerName =
    stepLayer === 'water' ? t('designAdvisorLayerWater')
    : stepLayer === 'earthworks' ? t('designStepEarthworks')
    : stepLayer === 'zones' ? t('designAdvisorLayerZones')
    : stepLayer === 'planting' ? t('designAdvisorLayerPlanting')
    : stepLayer === 'structures' ? t('designAdvisorLayerStructures')
    : null;
  // On a specific step: this layer's tips (+ general/untagged ones) here; everything else demoted
  // to a "+N on other layers" line so a real warning is never fully hidden, just moved down.
  const forThisLayer = stepLayer
    ? advice.filter((a) => a.layer === stepLayer || a.layer === 'general' || !a.layer)
    : advice;
  const otherLayerCount = stepLayer ? advice.length - forThisLayer.length : 0;

  const top = forThisLayer[0];
  const rest = forThisLayer.slice(1);
  const moreCount = rest.length;

  async function askAi() {
    const captured = readContext(), snapshot = captured.snapshot;
    if (!snapshot) return;
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    const version = ++requestVersion.current;
    const isCurrent = () => {
      const next = readContext();
      return requestVersion.current === version && next.snapshot?.key === snapshot.key && next.tokenUser === captured.tokenUser;
    };
    setLoadingKey(snapshot.key);
    setResultKey(snapshot.key);
    setAiError(null);
    setAiSuggestions([]);
    const result = await requestDesignAdvice({ snapshot, isCurrent, signal: controller.signal,
      headers: () => paidApiHeaders(captured.tokenUser), fetcher: init => fetch('/api/design-advice', init) });
    if (!isCurrent() || result.status === 'stale') return;
    setLoadingKey(null);
    if (result.status === 'error') setAiError(result.error ?? t('designAdvisorUnavailable'));
    else {
      setAiSuggestions(result.suggestions.map(msg => ({ msg })));
      if (!result.suggestions.length) setAiError(t('designAdvisorNothingToAdd'));
      else setExpanded(true);
    }
  }

  // Anchored BOTTOM-LEFT of the canvas area and click-through. The advisor now renders INSIDE the
  // canvas container (page.tsx), whose bottom edge sits directly above the status bar + element
  // palette — so bottom-anchoring here guarantees the cluster can never overlap those bottom bars
  // (Rory: "lima bubble must move out of the way automatically"). It grows UPWARD into the free map
  // area, and the tall panels (expanded / AI list) cap their own height + scroll. maxHeight keeps
  // the whole cluster within the canvas. pointerEvents:'none' on the shell means only the visible
  // chip/card ever takes a tap.
  const shell: CSSProperties = {
    position: 'absolute',
    left: 10,
    bottom: 10,
    zIndex: 40,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 6,
    maxWidth: 300,
    maxHeight: 'calc(100% - 20px)',
    pointerEvents: 'none',
  };
  const inner: CSSProperties = { pointerEvents: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6 };

  if (!context.localReady) {
    return <div ref={containerRef} style={shell}><div style={inner} lang="en"><ErrorPill message={unavailable} /></div></div>;
  }

  if (!top) {
    // No local advice — still offer the AI pill. Simple has no AI suggestion feed: nothing to
    // show yet means nothing renders.
    if (simple) return null;
    return (
      <div ref={containerRef} style={shell}>
        <div style={inner}>
          {referenceBasis}
          <AskAiButton onClick={askAi} loading={aiLoading} label={askLabel} disabled={!context.snapshot} english={context.reference} />
          {aiError && <ErrorPill message={aiError} />}
          {aiSuggestions.length > 0 && <AiList reference={context.reference} suggestions={aiSuggestions} />}
        </div>
      </div>
    );
  }

  if (!tipOpen) {
    // Collapsed — a small chip that says a tip is waiting. Tap to read; never in the way.
    return (
      <div ref={containerRef} style={shell}>
        <div style={inner}>
          {referenceBasis}
          <button
            onClick={() => setTipOpen(true)}
            aria-label={formatDesignTranslation(t('designAdvisorTapToRead'), {
              count: forThisLayer.length,
              layer: layerName ?? t('designAdvisorDesign'),
              tips: t(forThisLayer.length === 1 ? 'designAdvisorTip' : 'designAdvisorTips'),
            })}
            style={{
              minHeight: 32,
              padding: '4px 11px',
              borderRadius: 999,
              background: GLASS_SOFT,
              ...glassBlur,
              border: `1px solid ${GLASS_BORDER}`,
              color: GOLD,
              fontSize: 12,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              cursor: 'pointer',
            }}
          >
            {top.severity === 'warn' ? <TriangleAlert size={14} color="#E8974A" /> : <Lightbulb size={14} color="#7ED694" />}
            Lima · {forThisLayer.length}{layerName ? ` ${layerName}` : ''}{' '}
            {t(forThisLayer.length === 1 ? 'designAdvisorTip' : 'designAdvisorTips')}
          </button>
          {!simple && <AskAiButton onClick={askAi} loading={aiLoading} label={askLabel} disabled={!context.snapshot} english={context.reference} />}
          {!simple && aiError && <ErrorPill message={aiError} />}
          {!simple && aiSuggestions.length > 0 && <AiList reference={context.reference} suggestions={aiSuggestions} />}
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} style={shell}>
      <div style={inner}>
      {referenceBasis}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: GOLD, fontSize: 11, fontWeight: 800, letterSpacing: 0.3, paddingLeft: 2 }}>
        <Sparkles size={12} /> LIMA{layerName ? ` · ${layerName.toUpperCase()}` : ''}
      </div>
      <div
        style={{
          background: GLASS,
          ...glassBlur,
          border: `1px solid ${GLASS_BORDER}`,
          borderRadius: 12,
          padding: '10px 12px',
          color: '#FBF6EC',
          boxShadow: GLASS_SHADOW,
          display: 'flex',
          alignItems: 'flex-start',
          gap: 8,
        }}
      >
        <span style={{ fontSize: 16, lineHeight: '20px' }}>
          {top.severity === 'warn' ? (
            <TriangleAlert size={18} color="#E8974A" />
          ) : (
            <Lightbulb size={18} color="#7ED694" />
          )}
        </span>
        <div style={{ flex: 1, fontSize: 13, lineHeight: 1.35 }}>{top.msg}</div>
        <button
          onClick={() => setTipOpen(false)}
          aria-label={t('designAdvisorCloseTip')}
          style={{
            minWidth: 28,
            minHeight: 28,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'transparent',
            border: 'none',
            color: '#FBF6EC',
            opacity: 0.7,
            cursor: 'pointer',
          }}
        >
          <X size={16} />
        </button>
      </div>

      {/* Simple shows only the single top tip — no "N more" expansion, no Ask Lima AI feed. */}
      {!simple && (
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {moreCount > 0 && (
          <button
            onClick={() => setExpanded((e) => !e)}
            aria-expanded={expanded}
            style={{
              minHeight: 32,
              padding: '4px 10px',
              borderRadius: 999,
              background: GLASS_SOFT,
              ...glassBlur,
              border: `1px solid ${GLASS_BORDER}`,
              color: GOLD,
              fontSize: 12,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              cursor: 'pointer',
            }}
          >
            {formatDesignTranslation(t('designAdvisorMore'), { count: moreCount })}
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        )}
        <AskAiButton onClick={askAi} loading={aiLoading} label={askLabel} disabled={!context.snapshot} english={context.reference} />
      </div>
      )}

      {otherLayerCount > 0 && (
        <div style={{ fontSize: 11, color: '#B9C2C8', paddingLeft: 2 }}>
          {formatDesignTranslation(t('designAdvisorOtherLayers'), {
            count: otherLayerCount,
            tips: t(otherLayerCount === 1 ? 'designAdvisorTip' : 'designAdvisorTips'),
          })}
        </div>
      )}

      {!simple && aiError && <ErrorPill message={aiError} />}

      {!simple && expanded && (rest.length > 0 || aiSuggestions.length > 0) && (
        <div
          style={{
            background: GLASS,
            ...glassBlur,
            border: `1px solid ${GLASS_BORDER}`,
            borderRadius: 12,
            padding: '8px 10px',
            color: '#FBF6EC',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            maxHeight: 220,
            overflowY: 'auto',
          }}
        >
          {rest.map((a, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, fontSize: 12.5, lineHeight: 1.3, alignItems: 'flex-start' }}>
              <span style={{ flexShrink: 0, marginTop: 1 }}>
                {a.severity === 'warn' ? (
                  <TriangleAlert size={14} color="#E8974A" />
                ) : (
                  <Lightbulb size={14} color="#7ED694" />
                )}
              </span>
              <span>{a.msg}</span>
            </div>
          ))}
          {aiSuggestions.length > 0 && <AiList reference={context.reference} suggestions={aiSuggestions} inline />}
        </div>
      )}
      </div>
    </div>
  );
}

function AskAiButton({ onClick, loading, label, disabled = false, english = false }: { onClick: () => void; loading: boolean; label: string; disabled?: boolean; english?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={loading || disabled}
      lang={english ? 'en' : undefined}
      style={{
        minHeight: 32,
        padding: '4px 10px',
        borderRadius: 999,
        background: GLASS_GRAD,
        border: `1px solid ${GLASS_BORDER}`,
        color: '#FBF6EC',
        fontSize: 12,
        fontWeight: 600,
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        cursor: loading || disabled ? 'default' : 'pointer',
        opacity: loading || disabled ? 0.7 : 1,
      }}
    >
      {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} color={GOLD} />}
      {label}
    </button>
  );
}

function ErrorPill({ message }: { message: string }) {
  return (
    <div
      style={{
        background: 'rgba(120,30,30,0.9)',
        border: '1px solid #E8974A',
        borderRadius: 10,
        padding: '6px 10px',
        color: '#FBF6EC',
        fontSize: 12,
      }}
    >
      {message}
    </div>
  );
}

function AiList({ suggestions, inline, reference }: { suggestions: AiSuggestion[]; inline?: boolean; reference?: boolean }) {
  // Standalone (non-inline) use renders directly over the satellite map — without an opaque
  // card behind it the text read as messy, low-contrast overlay text that also crowded the
  // "Lima · N tips" / "Ask Lima" chips right above it. Give it the same solid dark card
  // treatment as the other advisor bubbles. The `inline` variant already sits inside such a
  // card (the "expanded" panel below), so it only needs a divider from the rows above it.
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        ...(inline
          ? { borderTop: `1px solid ${DARK}`, paddingTop: 6, marginTop: 2 }
          : {
              background: GLASS,
              ...glassBlur,
              border: `1px solid ${GLASS_BORDER}`,
              borderRadius: 12,
              padding: '8px 10px',
              color: '#FBF6EC',
              boxShadow: GLASS_SHADOW,
              // Cap the standalone list so a long reply scrolls within the free canvas area rather
              // than growing the cluster down over the bottom bars.
              maxHeight: 200,
              overflowY: 'auto',
            }),
      }}
    >
      {reference && <div lang="en" style={{ fontSize: 12, fontWeight: 700 }}>Original sample layout reference — your edits were not analysed.</div>}
      {suggestions.map((s, i) => (
        <div key={i} style={{ display: 'flex', gap: 6, fontSize: 12.5, lineHeight: 1.3 }}>
          <span
            style={{
              fontSize: 9,
              fontWeight: 700,
              color: DARK,
              background: GOLD,
              borderRadius: 4,
              padding: '1px 4px',
              alignSelf: 'flex-start',
              marginTop: 2,
              letterSpacing: 0.3,
            }}
          >
            LIMA
          </span>
          <span>{s.msg}</span>
        </div>
      ))}
    </div>
  );
}
