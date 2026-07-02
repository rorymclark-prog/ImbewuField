'use client';

// Design Studio — pure, presentational true-scale canvas.
//
// Renders the satellite underlay + reference outlines (boundary/house/driveway traced
// from the farmer's map), zone polygons, lines (swales/fences/paths/pipes/drip/
// windbreaks), and placed elements at TRUE real-world scale (metres → viewBox px via
// frame.mPerPx). Owns no persistence — the parent supplies `state` and receives changes
// via `onChange`. Pointer-event driven (phone-first); the clientToViewBox conversion
// mirrors HybridRender.tsx's touch-up overlay pattern.

import { useRef, useState } from 'react';
import type { CanvasFrame, DesignCanvasState, LineShape, PlacedItem, ZoneShape } from '@/lib/design-canvas';
import { newId } from '@/lib/design-canvas';
import { ELEMENTS_BY_ID, ZONE_DEFS } from '@/lib/design-elements';

type ToolKind = 'select' | 'place' | 'zone' | 'line';

interface ActiveLayers {
  water: boolean;
  zones: boolean;
  planting: boolean;
  structures: boolean;
  lines: boolean;
}

interface RefLayers {
  boundary: Array<[number, number]>;
  house: Array<[number, number]>;
  driveway: Array<[number, number]>;
}

export interface DesignCanvasProps {
  frame: CanvasFrame;
  state: DesignCanvasState;
  onChange: (next: DesignCanvasState) => void;
  tool: ToolKind;
  placeDefId: string | null;
  zoneDraw: 0 | 1 | 2 | 3 | 4 | 5;
  lineKind: LineShape['kind'];
  activeLayers: ActiveLayers;
  refLayers: RefLayers;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

const GOLD = '#F7C97E';

function ringToPx(ring: Array<[number, number]>, imgW: number, imgH: number): string {
  return ring.map(([x, y]) => `${(x * imgW).toFixed(1)},${(y * imgH).toFixed(1)}`).join(' ');
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

// category → activeLayers key, per spec: water→water, growing→planting,
// structure+animal→structures, access→structures.
function categoryLayerKey(category: string): keyof ActiveLayers | null {
  switch (category) {
    case 'water':
      return 'water';
    case 'growing':
      return 'planting';
    case 'structure':
    case 'animal':
    case 'access':
      return 'structures';
    default:
      return null;
  }
}

function lineStroke(kind: LineShape['kind']): { stroke: string; width: number; dash?: string; opacity?: number } {
  switch (kind) {
    case 'swale':
      return { stroke: '#4EA6D8', width: 3, dash: '6 4' };
    case 'fence':
      return { stroke: '#3A352C', width: 2 };
    case 'path':
      return { stroke: '#E8D9B8', width: 2.5, dash: '4 5' };
    case 'pipe':
      return { stroke: '#8C8577', width: 2 };
    case 'drip':
      return { stroke: '#4EA6D8', width: 1.2, dash: '2 3' };
    case 'windbreak':
      return { stroke: '#2F7A4A', width: 6, opacity: 0.5 };
    default:
      return { stroke: '#8C8577', width: 2 };
  }
}

function polylinePoints(points: Array<[number, number]>, imgW: number, imgH: number): string {
  return points.map(([x, y]) => `${(x * imgW).toFixed(1)},${(y * imgH).toFixed(1)}`).join(' ');
}

function fenceTicks(points: Array<[number, number]>, imgW: number, imgH: number, spacing = 18, half = 5): string {
  let d = '';
  for (let i = 0; i < points.length - 1; i++) {
    const [ax0, ay0] = points[i];
    const [bx0, by0] = points[i + 1];
    const ax = ax0 * imgW;
    const ay = ay0 * imgH;
    const bx = bx0 * imgW;
    const by = by0 * imgH;
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy) || 1;
    const n = Math.max(1, Math.round(len / spacing));
    const px = -dy / len;
    const py = dx / len;
    for (let k = 1; k < n; k++) {
      const t = k / n;
      const cx = ax + dx * t;
      const cy = ay + dy * t;
      d += `M${(cx - px * half).toFixed(1)},${(cy - py * half).toFixed(1)} L${(cx + px * half).toFixed(1)},${(cy + py * half).toFixed(1)} `;
    }
  }
  return d.trim();
}

function ringCentroid(points: Array<[number, number]>): [number, number] {
  if (points.length === 0) return [0.5, 0.5];
  const sum = points.reduce((acc, [x, y]) => [acc[0] + x, acc[1] + y] as [number, number], [0, 0] as [number, number]);
  return [sum[0] / points.length, sum[1] / points.length];
}

export default function DesignCanvas({
  frame,
  state,
  onChange,
  tool,
  placeDefId,
  zoneDraw,
  lineKind,
  activeLayers,
  refLayers,
  selectedId,
  onSelect,
}: DesignCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const { imgW, imgH, mPerPx, satDataUrl } = frame;

  // In-progress draw state for zone/line tools.
  const [draftPoints, setDraftPoints] = useState<Array<[number, number]>>([]);
  // Drag state for moving an existing item.
  const dragItemId = useRef<string | null>(null);

  function clientToNorm(clientX: number, clientY: number): [number, number] | null {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    // The svg fills its container with preserveAspectRatio="meet", so the rendered box
    // may be letterboxed — map through the actual drawn-image scale + offsets, not the
    // raw rect, or taps land off-target whenever the container aspect ≠ viewBox aspect.
    const scale = Math.min(rect.width / imgW, rect.height / imgH);
    const offX = (rect.width - imgW * scale) / 2;
    const offY = (rect.height - imgH * scale) / 2;
    const fx = clamp01((clientX - rect.left - offX) / (imgW * scale));
    const fy = clamp01((clientY - rect.top - offY) / (imgH * scale));
    return [fx, fy];
  }

  function commitZone(points: Array<[number, number]>) {
    if (points.length < 3) return;
    const shape: ZoneShape = { id: newId(), zone: zoneDraw, points };
    onChange({ ...state, zones: [...state.zones, shape] });
    setDraftPoints([]);
  }

  function commitLine(points: Array<[number, number]>) {
    if (points.length < 2) return;
    const shape: LineShape = { id: newId(), kind: lineKind, points };
    onChange({ ...state, lines: [...state.lines, shape] });
    setDraftPoints([]);
  }

  function handleBackgroundPointerDown(e: React.PointerEvent<SVGSVGElement>) {
    // Ignore taps that originated on an item/zone/line handle (they stopPropagation).
    if (tool === 'select') {
      onSelect(null);
      return;
    }
    const pt = clientToNorm(e.clientX, e.clientY);
    if (!pt) return;

    if (tool === 'place' && placeDefId) {
      const def = ELEMENTS_BY_ID[placeDefId];
      if (!def) return;
      const item: PlacedItem = { id: newId(), defId: placeDefId, x: pt[0], y: pt[1] };
      onChange({ ...state, items: [...state.items, item] });
      onSelect(item.id);
      return;
    }

    if (tool === 'zone') {
      setDraftPoints((prev) => {
        const next = [...prev, pt];
        return next;
      });
      return;
    }

    if (tool === 'line') {
      setDraftPoints((prev) => [...prev, pt]);
      return;
    }
  }

  function handleBackgroundDoubleClick() {
    if (tool === 'zone') commitZone(draftPoints);
    if (tool === 'line') commitLine(draftPoints);
  }

  function startDragItem(e: React.PointerEvent, id: string) {
    if (tool !== 'select') return;
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    dragItemId.current = id;
    onSelect(id);
  }

  function moveDragItem(e: React.PointerEvent) {
    const id = dragItemId.current;
    if (!id) return;
    const pt = clientToNorm(e.clientX, e.clientY);
    if (!pt) return;
    onChange({
      ...state,
      items: state.items.map((it) => (it.id === id ? { ...it, x: pt[0], y: pt[1] } : it)),
    });
  }

  function endDragItem() {
    dragItemId.current = null;
  }

  function deleteItem(id: string) {
    onChange({ ...state, items: state.items.filter((it) => it.id !== id) });
    if (selectedId === id) onSelect(null);
  }

  function deleteZone(id: string) {
    onChange({ ...state, zones: state.zones.filter((z) => z.id !== id) });
    if (selectedId === id) onSelect(null);
  }

  function deleteLine(id: string) {
    onChange({ ...state, lines: state.lines.filter((l) => l.id !== id) });
    if (selectedId === id) onSelect(null);
  }

  const armedNonSelect = tool !== 'select';

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      {/* Fill the container BOTH ways (meet = letterbox) so the whole site is always in
          view and the canvas never overflows and pushes the palette off-screen. */}
      <svg
        ref={svgRef}
        viewBox={`0 0 ${imgW} ${imgH}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ display: 'block', width: '100%', height: '100%', touchAction: armedNonSelect ? 'none' : 'auto', background: '#0B120B' }}
        onPointerDown={handleBackgroundPointerDown}
        onPointerMove={moveDragItem}
        onPointerUp={endDragItem}
        onDoubleClick={handleBackgroundDoubleClick}
      >
        {/* Satellite underlay */}
        {satDataUrl ? (
          <image href={satDataUrl} x={0} y={0} width={imgW} height={imgH} preserveAspectRatio="xMidYMid slice" />
        ) : (
          <rect x={0} y={0} width={imgW} height={imgH} fill="#FBF6EC" />
        )}

        {/* Reference outlines: driveway, house, boundary (drawn in this order so boundary reads on top) */}
        {refLayers.driveway.length >= 2 && (
          <polyline
            points={polylinePoints(refLayers.driveway, imgW, imgH)}
            fill="none"
            stroke="#E8D9B8"
            strokeWidth={3}
            strokeDasharray="5 5"
            opacity={0.85}
          />
        )}
        {refLayers.house.length >= 3 && (
          <polygon
            points={ringToPx(refLayers.house, imgW, imgH)}
            fill="rgba(78,166,216,0.15)"
            stroke="#4EA6D8"
            strokeWidth={2}
          />
        )}
        {refLayers.boundary.length >= 3 && (
          <polygon
            points={ringToPx(refLayers.boundary, imgW, imgH)}
            fill="none"
            stroke="#9BE86B"
            strokeWidth={2.5}
          />
        )}

        {/* Zones */}
        {activeLayers.zones &&
          state.zones.map((z) => {
            const def = ZONE_DEFS[z.zone];
            const isSelected = selectedId === z.id;
            const centroid = ringCentroid(z.points);
            return (
              <g key={z.id}>
                <polygon
                  points={ringToPx(z.points, imgW, imgH)}
                  fill={def.color}
                  fillOpacity={0.22}
                  stroke={def.color}
                  strokeWidth={1.5}
                  strokeDasharray="6 4"
                  style={{ cursor: tool === 'select' ? 'pointer' : 'default' }}
                  onPointerDown={(e) => {
                    if (tool !== 'select') return;
                    e.stopPropagation();
                    onSelect(z.id);
                  }}
                />
                <g transform={`translate(${(centroid[0] * imgW).toFixed(1)},${(centroid[1] * imgH).toFixed(1)})`}>
                  <circle r={11} fill={def.color} stroke="#FBF6EC" strokeWidth={1.5} />
                  <text textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={700} fill="#FBF6EC">
                    {z.zone}
                  </text>
                </g>
                {isSelected && (
                  <>
                    <polygon
                      points={ringToPx(z.points, imgW, imgH)}
                      fill="none"
                      stroke={GOLD}
                      strokeWidth={2.5}
                      strokeDasharray="4 3"
                    />
                    {z.points.map(([x, y], i) => (
                      <circle key={i} cx={x * imgW} cy={y * imgH} r={3} fill={GOLD} opacity={0.85} />
                    ))}
                    <g
                      transform={`translate(${(centroid[0] * imgW + 16).toFixed(1)},${(centroid[1] * imgH - 16).toFixed(1)})`}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        deleteZone(z.id);
                      }}
                      style={{ cursor: 'pointer' }}
                    >
                      <circle r={9} fill="#B53A3A" stroke="#FBF6EC" strokeWidth={1.2} />
                      <text textAnchor="middle" dominantBaseline="central" fontSize={11} fill="#FBF6EC">
                        ✕
                      </text>
                    </g>
                  </>
                )}
              </g>
            );
          })}

        {/* Lines */}
        {activeLayers.lines &&
          state.lines.map((line) => {
            const style = lineStroke(line.kind);
            const isSelected = selectedId === line.id;
            const mid = line.points[Math.floor(line.points.length / 2)] ?? line.points[0];
            return (
              <g key={line.id}>
                <polyline
                  points={polylinePoints(line.points, imgW, imgH)}
                  fill="none"
                  stroke={style.stroke}
                  strokeWidth={style.width}
                  strokeDasharray={style.dash}
                  opacity={style.opacity ?? 1}
                  strokeLinecap="round"
                  style={{ cursor: tool === 'select' ? 'pointer' : 'default' }}
                  onPointerDown={(e) => {
                    if (tool !== 'select') return;
                    e.stopPropagation();
                    onSelect(line.id);
                  }}
                />
                {line.kind === 'fence' && (
                  <path d={fenceTicks(line.points, imgW, imgH)} stroke={style.stroke} strokeWidth={1.5} />
                )}
                {isSelected && (
                  <>
                    {line.points.map(([x, y], i) => (
                      <circle key={i} cx={x * imgW} cy={y * imgH} r={3} fill={GOLD} opacity={0.85} />
                    ))}
                    {mid && (
                      <g
                        transform={`translate(${(mid[0] * imgW + 12).toFixed(1)},${(mid[1] * imgH - 12).toFixed(1)})`}
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          deleteLine(line.id);
                        }}
                        style={{ cursor: 'pointer' }}
                      >
                        <circle r={9} fill="#B53A3A" stroke="#FBF6EC" strokeWidth={1.2} />
                        <text textAnchor="middle" dominantBaseline="central" fontSize={11} fill="#FBF6EC">
                          ✕
                        </text>
                      </g>
                    )}
                  </>
                )}
              </g>
            );
          })}

        {/* Draft (in-progress) zone/line while drawing */}
        {tool === 'zone' && draftPoints.length > 0 && (
          <polygon
            points={ringToPx(draftPoints, imgW, imgH)}
            fill={ZONE_DEFS[zoneDraw].color}
            fillOpacity={0.18}
            stroke={ZONE_DEFS[zoneDraw].color}
            strokeWidth={2}
            strokeDasharray="4 3"
          />
        )}
        {tool === 'line' && draftPoints.length > 0 && (
          <polyline
            points={polylinePoints(draftPoints, imgW, imgH)}
            fill="none"
            stroke={lineStroke(lineKind).stroke}
            strokeWidth={2.5}
            strokeDasharray="3 3"
          />
        )}
        {(tool === 'zone' || tool === 'line') &&
          draftPoints.map(([x, y], i) => <circle key={i} cx={x * imgW} cy={y * imgH} r={3.5} fill={GOLD} />)}

        {/* Placed items at true scale */}
        {state.items.map((item) => {
          const def = ELEMENTS_BY_ID[item.defId];
          if (!def) return null;
          const layerKey = categoryLayerKey(def.category);
          if (layerKey && !activeLayers[layerKey]) return null;

          const wM = item.wM ?? def.wM;
          const hM = item.hM ?? def.hM;
          const wPx = Math.max(wM / mPerPx, 6);
          const hPx = Math.max(hM / mPerPx, 6);
          const cx = item.x * imgW;
          const cy = item.y * imgH;
          const isSelected = selectedId === item.id;
          const fontSize = Math.min(22, Math.max(10, Math.min(wPx, hPx) * 0.55));

          return (
            <g
              key={item.id}
              transform={`translate(${cx.toFixed(1)},${cy.toFixed(1)})`}
              onPointerDown={(e) => startDragItem(e, item.id)}
              style={{ cursor: tool === 'select' ? 'grab' : 'default' }}
            >
              {isSelected && (
                <>
                  {def.shape === 'circle' ? (
                    <circle r={Math.max(wPx, hPx) / 2 + 4} fill="none" stroke={GOLD} strokeWidth={2.5} strokeDasharray="4 3" />
                  ) : (
                    <rect
                      x={-wPx / 2 - 4}
                      y={-hPx / 2 - 4}
                      width={wPx + 8}
                      height={hPx + 8}
                      fill="none"
                      stroke={GOLD}
                      strokeWidth={2.5}
                      strokeDasharray="4 3"
                      rx={4}
                    />
                  )}
                </>
              )}
              {def.shape === 'circle' ? (
                <circle r={wPx / 2} fill={def.color} fillOpacity={0.35} stroke={def.color} strokeWidth={1.5} />
              ) : (
                <rect x={-wPx / 2} y={-hPx / 2} width={wPx} height={hPx} fill={def.color} fillOpacity={0.35} stroke={def.color} strokeWidth={1.5} />
              )}
              <text textAnchor="middle" dominantBaseline="central" fontSize={fontSize}>
                {def.icon}
              </text>
              <g transform={`translate(0, ${hPx / 2 + 9})`}>
                <rect x={-1} y={-7} width={1} height={1} fill="none" />
                <foreignObject x={-40} y={-8} width={80} height={16} style={{ overflow: 'visible', pointerEvents: 'none' }}>
                  <div
                    style={{
                      fontSize: 8.5,
                      lineHeight: '13px',
                      textAlign: 'center',
                      color: '#0B120B',
                      background: 'rgba(251,246,236,0.9)',
                      borderRadius: 6,
                      padding: '1px 4px',
                      display: 'inline-block',
                      maxWidth: 80,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      border: '1px solid rgba(0,0,0,0.08)',
                    }}
                  >
                    {item.label ?? def.name}
                  </div>
                </foreignObject>
              </g>
              {isSelected && (
                <g
                  transform={`translate(${wPx / 2 + 6}, ${-hPx / 2 - 6})`}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    deleteItem(item.id);
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  <circle r={9} fill="#B53A3A" stroke="#FBF6EC" strokeWidth={1.2} />
                  <text textAnchor="middle" dominantBaseline="central" fontSize={11} fill="#FBF6EC">
                    ✕
                  </text>
                </g>
              )}
            </g>
          );
        })}
      </svg>

      {(tool === 'zone' || tool === 'line') && draftPoints.length >= (tool === 'zone' ? 3 : 2) && (
        <button
          type="button"
          onClick={() => (tool === 'zone' ? commitZone(draftPoints) : commitLine(draftPoints))}
          style={{
            position: 'absolute',
            bottom: 12,
            right: 12,
            minHeight: 44,
            minWidth: 44,
            padding: '0 16px',
            borderRadius: 22,
            border: 'none',
            background: '#1F4D2B',
            color: '#FBF6EC',
            fontWeight: 700,
            fontSize: 14,
            boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
          }}
        >
          ✓ Finish
        </button>
      )}
      {(tool === 'zone' || tool === 'line') && draftPoints.length > 0 && (
        <button
          type="button"
          onClick={() => setDraftPoints([])}
          style={{
            position: 'absolute',
            bottom: 12,
            left: 12,
            minHeight: 44,
            minWidth: 44,
            padding: '0 16px',
            borderRadius: 22,
            border: '1px solid rgba(0,0,0,0.15)',
            background: 'rgba(251,246,236,0.92)',
            color: '#0B120B',
            fontWeight: 600,
            fontSize: 14,
          }}
        >
          Cancel
        </button>
      )}
    </div>
  );
}
