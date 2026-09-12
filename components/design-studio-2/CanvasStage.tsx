'use client';

// The true-scale placement surface. Pure/presentational by design, mirroring
// components/design/DesignCanvas.tsx's own stated contract ("Owns no persistence — the parent
// supplies `state` and receives changes via `onChange`"): this component only draws what it's
// given and reports gestures upward: StudioShell owns items/lines/layerState.
//
// SCOPE NOTE (report this honestly, don't paper over it): this is NOT the real georeferenced
// canvas — there is no satellite/drone photo, no CanvasFrame, no lat/lng. It draws a fixed
// PX_PER_M scale so every element's REAL wM/hM (from ELEMENT_CATALOG) is still size-accurate
// relative to every other element on screen — a 10 000 L JoJo really does draw bigger than a
// tap point — which is the one part of "true-scale" a demo surface can honestly keep. Wiring
// this shell to the real satellite-backed canvas is future integration work, not this phase.

import { useCallback, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { DesignElementDef } from '@/lib/design-elements';
import type { LayerStateMap, DemoItem, DemoLine, LayerKeyId } from '@/lib/design-studio-shell';
import { waterInfraForLine, subLayerForWaterElement } from '@/lib/design-studio-shell';
import { getElementArt } from '@/lib/design-studio-shell-icons';
import type { LineShape } from '@/lib/design-canvas';
import type { ToolMode } from './StudioShell';

export const PX_PER_M = 16;
const STAGE_W_M = 34;
const STAGE_H_M = 20;
/** True-scale footprint in px at 1:1 zoom — the size every child (grid, boundary, items) is
 *  laid out at. On viewports narrower than this the whole stage is shrunk with a CSS
 *  transform (see `--stage-scale` below) rather than left to overflow/scroll-clip, which is
 *  what was happening on phone: the map rendered at full 544px width inside a ~360px
 *  viewport and got cut off at the right edge instead of framing to the screen. */
const STAGE_PX_W = STAGE_W_M * PX_PER_M;
const STAGE_PX_H = STAGE_H_M * PX_PER_M;
/** Mirrors DesignCanvas.tsx's MIN_ITEM_HIT_PX precedent: a real footprint drawn narrower than
 *  this would be unreadable/untappable, so the DRAWN size is floored — the stored wM/hM (and
 *  therefore the dimension label on the palette card) is never touched. */
const MIN_VISUAL_PX = 22;

const LINE_COLOR: Partial<Record<LineShape['kind'], string>> = {
  pipe: 'var(--info)',
  swale: '#8A6D3B',
  fence: 'var(--ochre)',
};

function visualFor(layerState: LayerStateMap, coarse: LayerKeyId, sub: LayerKeyId | null) {
  const c = layerState[coarse] ?? { visible: true, opacity: 100 };
  const s = sub ? layerState[sub] ?? { visible: true, opacity: 100 } : { visible: true, opacity: 100 };
  return { visible: c.visible && s.visible, opacity: (c.opacity / 100) * (s.opacity / 100) * 100 };
}

interface CanvasStageProps {
  items: DemoItem[];
  lines: DemoLine[];
  defsById: Record<string, DesignElementDef>;
  layerState: LayerStateMap;
  armedDefId: string | null;
  tool: ToolMode;
  drawKind: LineShape['kind'];
  inProgressLine: Array<[number, number]>;
  measurePoints: Array<[number, number]>;
  onPlaceItem: (xM: number, yM: number) => void;
  onDrawPoint: (xM: number, yM: number) => void;
  onMeasurePoint: (xM: number, yM: number) => void;
  onDragItem: (id: string, xM: number, yM: number) => void;
  onFinishLine: () => void;
  onCancelLine: () => void;
  onSetDrawKind: (kind: LineShape['kind']) => void;
}

export default function CanvasStage({
  items, lines, defsById, layerState, armedDefId, tool, drawKind, inProgressLine, measurePoints,
  onPlaceItem, onDrawPoint, onMeasurePoint, onDragItem, onFinishLine, onCancelLine, onSetDrawKind,
}: CanvasStageProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const toMetres = useCallback((clientX: number, clientY: number): [number, number] => {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return [0, 0];
    // rect is the POST-transform (visually scaled) box on phone, so derive px/metre from
    // what's actually on screen rather than assuming the 1:1 PX_PER_M constant — otherwise a
    // tap on a shrunk stage lands at the wrong metre coordinate (and half the map becomes
    // unclickable, clamped short of its real 34x20m extent).
    const scaleX = rect.width / STAGE_PX_W;
    const scaleY = rect.height / STAGE_PX_H;
    const xM = Math.min(STAGE_W_M, Math.max(0, (clientX - rect.left) / (PX_PER_M * scaleX)));
    const yM = Math.min(STAGE_H_M, Math.max(0, (clientY - rect.top) / (PX_PER_M * scaleY)));
    return [Math.round(xM * 10) / 10, Math.round(yM * 10) / 10];
  }, []);

  const handleStageClick = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (draggingId) return;
    const [xM, yM] = toMetres(e.clientX, e.clientY);
    if (tool === 'draw') { onDrawPoint(xM, yM); return; }
    if (tool === 'measure') { onMeasurePoint(xM, yM); return; }
    if (armedDefId) onPlaceItem(xM, yM);
  }, [armedDefId, tool, draggingId, toMetres, onPlaceItem, onDrawPoint, onMeasurePoint]);

  const baseMap = layerState.references ?? { visible: true, opacity: 100 };
  const boundary = layerState.boundary ?? { visible: true, opacity: 100 };
  const labelsOn = (layerState.labels ?? { visible: true, opacity: 100 }).visible;

  const linePath = (pts: Array<[number, number]>) =>
    pts.map(([x, y]) => `${x * PX_PER_M},${y * PX_PER_M}`).join(' ');

  const measureDist = measurePoints.length === 2
    ? Math.hypot(
        (measurePoints[1][0] - measurePoints[0][0]),
        (measurePoints[1][1] - measurePoints[0][1]),
      )
    : null;

  return (
    <div
      className="relative flex-1 overflow-auto p-4"
      style={{
        background: 'var(--bg)',
        // Establishes this div as the query container so `cqw` below measures ITS content
        // width (after padding) — the space actually available to frame the map into.
        containerType: 'inline-size',
        // Shrink past 1:1, never magnify past it: on a phone-width container this comes out
        // < 1 and the transform below scales the true-size stage down to fit; on desktop the
        // container is already wider than the stage so this clamps to exactly 1 (unchanged
        // from before this fix).
        // Dividing a length (100cqw) by a bare number produces a length again, which
        // `scale()` below rejects (it wants a unitless ratio) — dividing length-by-length
        // (100cqw / 544px) is what actually yields a number. Silently invalid CSS like the
        // number-divisor version doesn't error anywhere; it just makes `transform` compute
        // to `none` and the stage renders unscaled — exactly this bug's original shape.
        '--stage-scale': `min(1, calc(100cqw / ${STAGE_PX_W}px))`,
      } as React.CSSProperties}
    >
      {/* Reserves the correctly-scaled box (via aspect-ratio) so the transformed stage below
          doesn't leave dead space or force the parent to overflow — width is real layout,
          not just a visual scale, so the page around it reflows to match. */}
      <div className="relative" style={{ width: '100%', maxWidth: STAGE_PX_W, aspectRatio: `${STAGE_PX_W} / ${STAGE_PX_H}` }}>
        <div
          ref={stageRef}
          onPointerDown={handleStageClick}
          className="relative shrink-0 select-none overflow-hidden rounded-xl border shadow-[var(--shadow-card)]"
          style={{
            width: STAGE_PX_W,
            height: STAGE_PX_H,
            transform: 'scale(var(--stage-scale))',
            transformOrigin: 'top left',
            borderColor: 'var(--border)',
            background: baseMap.visible ? 'var(--surface)' : '#FFFFFF',
            opacity: baseMap.visible ? Math.max(baseMap.opacity / 100, 0.55) : 1,
            cursor: tool === 'draw' || tool === 'measure' || armedDefId ? 'crosshair' : 'default',
          }}
        >
        {/* Base map grid — every 5 m, stands in for the satellite/drone photo underlay. */}
        {baseMap.visible && (
          <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
            {Array.from({ length: Math.ceil(STAGE_W_M / 5) + 1 }, (_, i) => (
              <line key={`v${i}`} x1={i * 5 * PX_PER_M} y1={0} x2={i * 5 * PX_PER_M} y2={STAGE_H_M * PX_PER_M} stroke="var(--border)" strokeWidth={1} />
            ))}
            {Array.from({ length: Math.ceil(STAGE_H_M / 5) + 1 }, (_, i) => (
              <line key={`h${i}`} x1={0} y1={i * 5 * PX_PER_M} x2={STAGE_W_M * PX_PER_M} y2={i * 5 * PX_PER_M} stroke="var(--border)" strokeWidth={1} />
            ))}
          </svg>
        )}

        {/* Boundary — a stand-in property line so the Boundary layer toggle has something real
            to show/hide, same as every other row in the panel. */}
        {boundary.visible && (
          <div
            className="pointer-events-none absolute rounded-md border-2 border-dashed"
            style={{
              inset: 10, borderColor: 'var(--brand)',
              opacity: Math.max(boundary.opacity / 100, 0.25),
            }}
          />
        )}

        {/* Committed lines (pipes/swales placed via Quick Action or Draw). */}
        <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" aria-hidden>
          {lines.map((line) => {
            const sub = waterInfraForLine(line.kind);
            const v = visualFor(layerState, 'water', sub);
            if (!v.visible) return null;
            return (
              <polyline
                key={line.id}
                points={linePath(line.pointsM)}
                fill="none"
                stroke={LINE_COLOR[line.kind] ?? 'var(--text-2)'}
                strokeWidth={4}
                strokeLinecap="round"
                strokeOpacity={v.opacity / 100}
              />
            );
          })}
          {inProgressLine.length > 0 && (
            <polyline
              points={linePath(inProgressLine)}
              fill="none"
              stroke={LINE_COLOR[drawKind] ?? 'var(--text-2)'}
              strokeWidth={3}
              strokeDasharray="6 4"
            />
          )}
          {measurePoints.length > 0 && (
            <polyline points={linePath(measurePoints)} fill="none" stroke="var(--ochre)" strokeWidth={2} strokeDasharray="4 4" />
          )}
        </svg>

        {/* Placed point items. */}
        {items.map((item) => {
          const def = defsById[item.defId];
          if (!def) return null;
          const sub = subLayerForWaterElement(item.defId);
          const v = visualFor(layerState, 'water', sub);
          if (!v.visible) return null;
          const art = getElementArt(def);
          const wPx = Math.max(def.wM * PX_PER_M, MIN_VISUAL_PX);
          const hPx = Math.max(def.hM * PX_PER_M, MIN_VISUAL_PX);
          return (
            <div
              key={item.id}
              onPointerDown={(e) => { e.stopPropagation(); setDraggingId(item.id); }}
              onPointerMove={(e) => {
                if (draggingId !== item.id) return;
                const [xM, yM] = toMetres(e.clientX, e.clientY);
                onDragItem(item.id, xM, yM);
              }}
              onPointerUp={() => setDraggingId(null)}
              className="absolute flex -translate-x-1/2 -translate-y-1/2 cursor-grab flex-col items-center gap-0.5 active:cursor-grabbing"
              style={{ left: item.xM * PX_PER_M, top: item.yM * PX_PER_M, opacity: v.opacity / 100 }}
              title={`${def.name} — ${def.shape === 'circle' ? `Ø${def.wM}m` : `${def.wM}×${def.hM}m`}`}
            >
              <span
                className="flex items-center justify-center rounded-full border-2"
                style={{
                  width: wPx, height: def.shape === 'circle' ? wPx : hPx,
                  borderRadius: def.shape === 'circle' ? '9999px' : 8,
                  borderColor: def.color, background: `${def.color}33`, color: def.color,
                }}
              >
                {art.kind === 'image' ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={art.src} alt="" className="h-1/2 w-1/2 object-contain" />
                ) : (
                  <art.Icon size={Math.min(wPx, hPx) * 0.5} />
                )}
              </span>
              {labelsOn && (
                <span
                  className="rounded px-1 text-[10px] font-semibold shadow-sm"
                  style={{ background: 'var(--surface)', color: 'var(--text)' }}
                >
                  {def.name}
                </span>
              )}
            </div>
          );
        })}
      </div>
      </div>

      {/* Scale bar + north arrow — cheap, honest cartography chrome; PX_PER_M is a real,
          declared constant, so a 5 m bar really does measure 5*PX_PER_M px AT 1:1 ZOOM. On a
          shrunk phone stage the tick is scaled by the same --stage-scale the map itself uses,
          so "5 m" keeps meaning 5 m on screen instead of silently going stale once the stage
          stops rendering at native size. */}
      <div className="mt-2 flex items-center gap-4 text-xs text-ink-muted">
        <div className="flex items-center gap-1.5">
          <span style={{ width: `calc(${5 * PX_PER_M}px * var(--stage-scale))`, height: 3, background: 'var(--text)' }} />
          5 m
        </div>
        <div>N ↑</div>
        {measureDist !== null && (
          <div className="font-semibold" style={{ color: 'var(--ochre)' }}>
            Measured: {measureDist.toFixed(1)} m
          </div>
        )}
        {tool === 'draw' && (
          <div className="flex items-center gap-2" style={{ color: 'var(--info)' }}>
            Drawing:
            {(['pipe', 'swale'] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => onSetDrawKind(k)}
                className="rounded-full px-2 py-0.5 text-xs font-semibold capitalize"
                style={{
                  background: drawKind === k ? 'var(--info)' : 'var(--surface-2)',
                  color: drawKind === k ? '#fff' : 'var(--text-2)',
                }}
              >
                {k}
              </button>
            ))}
            — click the map to add points.
            {inProgressLine.length >= 2 && (
              <>
                <button
                  type="button"
                  onClick={onFinishLine}
                  className="rounded-full px-2.5 py-0.5 text-xs font-semibold text-white"
                  style={{ background: 'var(--brand)' }}
                >
                  Finish line
                </button>
                <button
                  type="button"
                  onClick={onCancelLine}
                  className="rounded-full border px-2.5 py-0.5 text-xs font-semibold"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-2)' }}
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
