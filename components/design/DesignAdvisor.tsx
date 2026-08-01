'use client';

// DesignAdvisor — floating advice card over the Design Studio canvas.
//
// Runs evaluateDesign() locally (instant, free) on every state change and shows the
// top advice as a small card. A badge expands the rest, plus an "Ask AI" button that
// calls /api/design-advice for a few extra farmer-friendly suggestions.

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Sparkles, X, ChevronUp, ChevronDown, TriangleAlert, Lightbulb, Loader2 } from 'lucide-react';
import type { DesignCanvasState, PlacedItem, ZoneShape } from '@/lib/design-canvas';
import { pointInRing } from '@/lib/design-canvas';
import { ELEMENTS_BY_ID, GROUND_FEATURES } from '@/lib/design-elements';
import { evaluateDesign, type Advice, type AdviceLayer } from '@/lib/design-rules';
import { formatDesignTranslation } from '@/lib/design-studio-i18n';
import { useLanguage } from '@/lib/i18n';

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
}

interface AiSuggestion {
  msg: string;
}

// 8-point compass label for an item's position relative to the frame centre.
function compassEighth(dx: number, dy: number): string {
  // dx, dy in normalised [-0.5..0.5] space; y increases southward (screen convention).
  if (Math.abs(dx) < 0.03 && Math.abs(dy) < 0.03) return 'centre';
  const angle = (Math.atan2(dx, -dy) * 180) / Math.PI; // 0 = north, 90 = east
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const idx = Math.round(((angle % 360) + 360) % 360 / 45) % 8;
  return dirs[idx];
}

function zoneForItem(item: PlacedItem, zones: ZoneShape[]): number | null {
  for (const z of zones) {
    if (z.points.length >= 3 && pointInRing([item.x, item.y], z.points)) return z.zone;
  }
  return null;
}

// Rough shoelace area in normalised units, scaled by frame metres for a ballpark m² — shared by
// the effort-zone and ground-feature summaries below so the two can't compute area two ways.
function ringAreaM2(points: Array<[number, number]>, frame: DesignCanvasState['frame']): number {
  let area2 = 0;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i];
    const [xj, yj] = points[j];
    area2 += xj * yi - xi * yj;
  }
  const normArea = Math.abs(area2) / 2;
  return Math.round(normArea * frame.imgW * frame.mPerPx * frame.imgH * frame.mPerPx);
}

function buildDesignSummary(state: DesignCanvasState) {
  // Ground-feature areas (house/patio/lawn…) ride on ZoneShape but are NOT effort-zones —
  // exclude them from the advisor's zone reasoning.
  const effortZones = state.zones.filter((z) => !z.feature);
  const items = state.items.map((it) => {
    const def = ELEMENTS_BY_ID[it.defId];
    const dx = it.x - 0.5;
    const dy = it.y - 0.5;
    return {
      name: def?.name ?? it.defId,
      zone: zoneForItem(it, effortZones),
      approxPos: compassEighth(dx, dy),
    };
  });

  const zones = effortZones.map((z) => ({ zone: z.zone, areaApprox: ringAreaM2(z.points, state.frame) }));

  // EXISTING SITE FABRIC — the farmer's traced house, patio, driveway, lawn, veg garden, orchard,
  // cleared ground and boundary. Lima answering "where should I put a chicken coop" or "is this a
  // good spot for a food forest" with no idea the farmer already has a lawn there, or where the
  // driveway runs, is exactly the "advice that ignores the actual design" gap this summary exists to
  // close (docs/ACTIVE-MAP-QUALITY-TASKS.md P3: "Give Ask Lima structured design and location
  // context ... existing elements"). Read-only: this only widens what Lima is TOLD, never what it
  // can do — Lima still only proposes, the farmer still places everything themselves.
  const groundFeatures = state.zones
    .filter((z) => z.feature && z.feature !== 'boundary' && z.points.length >= 3)
    .map((z) => ({ kind: GROUND_FEATURES[z.feature!]?.label ?? z.feature, areaApprox: ringAreaM2(z.points, state.frame) }));

  const lineKinds = state.lines.reduce<Record<string, number>>((acc, l) => {
    acc[l.kind] = (acc[l.kind] ?? 0) + 1;
    return acc;
  }, {});

  return {
    currentStep: state.step,
    items,
    zones,
    groundFeatures,
    lines: lineKinds,
    counts: { items: state.items.length, zones: state.zones.length, lines: state.lines.length, groundFeatures: groundFeatures.length },
  };
}

export default function DesignAdvisor({ state, site, houseXY, lastChangeId }: DesignAdvisorProps) {
  const { t } = useLanguage();
  const [advice, setAdvice] = useState<Advice[]>([]);
  // The tip card starts CLOSED and only opens when the farmer taps the chip. It used to open
  // itself, and the effect below reset the dismissal on EVERY edit (lastChangeId is updatedAt,
  // which restamps on every drag/add/delete) — so it reappeared the instant you closed it, on top
  // of the tool row. A tip must never stand between the farmer and their next action.
  const [tipOpen, setTipOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<AiSuggestion[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  // Wraps the whole cluster so an outside tap can dismiss it (below). Lives on the shell — the
  // transparent shell has pointerEvents:'none', so only the visible chip/card counts as "inside".
  const containerRef = useRef<HTMLDivElement | null>(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const next = evaluateDesign(
      state,
      ELEMENTS_BY_ID,
      site
        ? {
            windFromSummer: site.windFromSummer,
            slopeDeg: site.slopeDeg,
            aspectLabel: site.aspectLabel,
            rainfallMm: site.rainfallMm,
            slopePct: site.slopePct,
          }
        : undefined,
      houseXY ? { houseXY } : undefined,
    );
    setAdvice(next);
    // Deliberately does NOT touch tipOpen: refreshing the advice must never force the card back
    // open (that was the "can't move on without closing it" bug), nor slam it shut while the
    // farmer is reading it mid-edit.
    // A fresh state change invalidates any previously-fetched AI suggestions.
    setAiSuggestions([]);
    setAiError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.items.length, state.zones.length, state.lines.length, lastChangeId]);

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

  const designSummary = useMemo(() => buildDesignSummary(state), [state]);

  async function askAi() {
    setAiLoading(true);
    setAiError(null);
    try {
      const res = await fetch('/api/design-advice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ designSummary, site }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody?.error || formatDesignTranslation(t('designAdvisorRequestFailed'), {
          status: res.status,
        }));
      }
      const data = await res.json();
      const suggestions: string[] = Array.isArray(data?.suggestions) ? data.suggestions : [];
      // Drop blank/whitespace suggestions — otherwise they render as bare "LIMA" badges with no
      // text (Rory: "Ask AI does something weird"). If NONE survive, say so instead of showing
      // empty pills.
      const clean = suggestions.map((s) => (typeof s === 'string' ? s.trim() : '')).filter(Boolean);
      setAiSuggestions(clean.map((msg) => ({ msg })));
      if (clean.length === 0) setAiError(t('designAdvisorNothingToAdd'));
      else setExpanded(true);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : t('designAdvisorUnavailable'));
    } finally {
      setAiLoading(false);
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

  if (!top) {
    // No local advice — still offer the AI pill.
    return (
      <div ref={containerRef} style={shell}>
        <div style={inner}>
          <AskAiButton onClick={askAi} loading={aiLoading} label={t('designAdvisorAskLima')} />
          {aiError && <ErrorPill message={aiError} />}
          {aiSuggestions.length > 0 && <AiList suggestions={aiSuggestions} />}
        </div>
      </div>
    );
  }

  if (!tipOpen) {
    // Collapsed — a small chip that says a tip is waiting. Tap to read; never in the way.
    return (
      <div ref={containerRef} style={shell}>
        <div style={inner}>
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
          <AskAiButton onClick={askAi} loading={aiLoading} label={t('designAdvisorAskLima')} />
          {aiError && <ErrorPill message={aiError} />}
          {aiSuggestions.length > 0 && <AiList suggestions={aiSuggestions} />}
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} style={shell}>
      <div style={inner}>
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
        <AskAiButton onClick={askAi} loading={aiLoading} label={t('designAdvisorAskLima')} />
      </div>

      {otherLayerCount > 0 && (
        <div style={{ fontSize: 11, color: '#B9C2C8', paddingLeft: 2 }}>
          {formatDesignTranslation(t('designAdvisorOtherLayers'), {
            count: otherLayerCount,
            tips: t(otherLayerCount === 1 ? 'designAdvisorTip' : 'designAdvisorTips'),
          })}
        </div>
      )}

      {aiError && <ErrorPill message={aiError} />}

      {expanded && (rest.length > 0 || aiSuggestions.length > 0) && (
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
          {aiSuggestions.length > 0 && <AiList suggestions={aiSuggestions} inline />}
        </div>
      )}
      </div>
    </div>
  );
}

function AskAiButton({ onClick, loading, label }: { onClick: () => void; loading: boolean; label: string }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
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
        cursor: loading ? 'default' : 'pointer',
        opacity: loading ? 0.7 : 1,
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

function AiList({ suggestions, inline }: { suggestions: AiSuggestion[]; inline?: boolean }) {
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
