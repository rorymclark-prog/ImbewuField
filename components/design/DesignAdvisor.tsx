'use client';

// DesignAdvisor — floating advice card over the Design Studio canvas.
//
// Runs evaluateDesign() locally (instant, free) on every state change and shows the
// top advice as a small card. A badge expands the rest, plus an "Ask AI" button that
// calls /api/design-advice for a few extra farmer-friendly suggestions.

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Sparkles, X, ChevronUp, ChevronDown, TriangleAlert, Lightbulb, Loader2 } from 'lucide-react';
import type { DesignCanvasState, PlacedItem, ZoneShape } from '@/lib/design-canvas';
import { pointInRing } from '@/lib/design-canvas';
import { ELEMENTS_BY_ID } from '@/lib/design-elements';
import { evaluateDesign, type Advice } from '@/lib/design-rules';

const GOLD = '#F7C97E';
const GREEN = '#1F4D2B';
const DARK = '#0B120B';

interface DesignAdvisorProps {
  state: DesignCanvasState;
  site: {
    windFromSummer?: string;
    slopeDeg?: number;
    aspectLabel?: string;
    rainfallMm?: number;
    biome?: string;
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

  const zones = effortZones.map((z) => {
    // Rough shoelace area in normalised units, scaled by frame metres for a ballpark m².
    let area2 = 0;
    for (let i = 0, j = z.points.length - 1; i < z.points.length; j = i++) {
      const [xi, yi] = z.points[i];
      const [xj, yj] = z.points[j];
      area2 += xj * yi - xi * yj;
    }
    const normArea = Math.abs(area2) / 2;
    const areaApprox = Math.round(
      normArea * state.frame.imgW * state.frame.mPerPx * state.frame.imgH * state.frame.mPerPx,
    );
    return { zone: z.zone, areaApprox };
  });

  const lineKinds = state.lines.reduce<Record<string, number>>((acc, l) => {
    acc[l.kind] = (acc[l.kind] ?? 0) + 1;
    return acc;
  }, {});

  return {
    items,
    zones,
    lines: lineKinds,
    counts: { items: state.items.length, zones: state.zones.length, lines: state.lines.length },
  };
}

export default function DesignAdvisor({ state, site, houseXY, lastChangeId }: DesignAdvisorProps) {
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

  const top = advice[0];
  const rest = advice.slice(1);
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
        throw new Error(errBody?.error || `Request failed (${res.status})`);
      }
      const data = await res.json();
      const suggestions: string[] = Array.isArray(data?.suggestions) ? data.suggestions : [];
      setAiSuggestions(suggestions.map((msg) => ({ msg })));
      setExpanded(true);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Could not reach the AI advisor.');
    } finally {
      setAiLoading(false);
    }
  }

  // Anchored CENTRE-LEFT and click-through. It used to sit bottom-left, which put it directly on
  // top of the palette's Select/Undo/Delete row with pointer events on — so it physically blocked
  // the tools until dismissed. Centre-left clears both the bottom tool row and the right-edge zoom
  // controls; pointerEvents:'none' on the shell means only the visible chip/card ever takes a tap.
  const shell: CSSProperties = {
    position: 'absolute',
    left: 10,
    top: '50%',
    transform: 'translateY(-50%)',
    zIndex: 40,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 6,
    maxWidth: 300,
    pointerEvents: 'none',
  };
  const inner: CSSProperties = { pointerEvents: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6 };

  if (!top) {
    // No local advice — still offer the AI pill.
    return (
      <div style={shell}>
        <div style={inner}>
          <AskAiButton onClick={askAi} loading={aiLoading} />
          {aiError && <ErrorPill message={aiError} />}
          {aiSuggestions.length > 0 && <AiList suggestions={aiSuggestions} />}
        </div>
      </div>
    );
  }

  if (!tipOpen) {
    // Collapsed — a small chip that says a tip is waiting. Tap to read; never in the way.
    return (
      <div style={shell}>
        <div style={inner}>
          <button
            onClick={() => setTipOpen(true)}
            aria-label={`${advice.length} design tip${advice.length === 1 ? '' : 's'} — tap to read`}
            style={{
              minHeight: 32,
              padding: '4px 10px',
              borderRadius: 999,
              background: 'rgba(11,18,11,0.85)',
              border: `1px solid ${GOLD}`,
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
            {advice.length} tip{advice.length === 1 ? '' : 's'}
          </button>
          <AskAiButton onClick={askAi} loading={aiLoading} />
          {aiError && <ErrorPill message={aiError} />}
          {aiSuggestions.length > 0 && <AiList suggestions={aiSuggestions} />}
        </div>
      </div>
    );
  }

  return (
    <div style={shell}>
      <div style={inner}>
      <div
        style={{
          background: 'rgba(11,18,11,0.92)',
          border: `1px solid ${GOLD}`,
          borderRadius: 12,
          padding: '10px 12px',
          color: '#FBF6EC',
          boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
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
          aria-label="Close tip"
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
            style={{
              minHeight: 32,
              padding: '4px 10px',
              borderRadius: 999,
              background: 'rgba(11,18,11,0.85)',
              border: `1px solid ${GOLD}`,
              color: GOLD,
              fontSize: 12,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              cursor: 'pointer',
            }}
          >
            {moreCount} more
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        )}
        <AskAiButton onClick={askAi} loading={aiLoading} />
      </div>

      {aiError && <ErrorPill message={aiError} />}

      {expanded && (rest.length > 0 || aiSuggestions.length > 0) && (
        <div
          style={{
            background: 'rgba(11,18,11,0.92)',
            border: `1px solid ${GOLD}`,
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

function AskAiButton({ onClick, loading }: { onClick: () => void; loading: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      style={{
        minHeight: 32,
        padding: '4px 10px',
        borderRadius: 999,
        background: GREEN,
        border: `1px solid ${GOLD}`,
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
      Ask AI
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
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        ...(inline ? { borderTop: `1px solid ${DARK}`, paddingTop: 6, marginTop: 2 } : {}),
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
            }}
          >
            AI
          </span>
          <span>{s.msg}</span>
        </div>
      ))}
    </div>
  );
}
