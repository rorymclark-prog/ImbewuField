'use client';

// Design Studio — pure, presentational true-scale canvas.
//
// Renders the satellite underlay + reference outlines (boundary/house/driveway traced
// from the farmer's map), zone polygons, lines (swales/fences/paths/pipes/drip/
// windbreaks), and placed elements at TRUE real-world scale (metres → viewBox px via
// frame.mPerPx). Owns no persistence — the parent supplies `state` and receives changes
// via `onChange`. Pointer-event driven (phone-first); the clientToViewBox conversion
// mirrors HybridRender.tsx's touch-up overlay pattern.

import { useEffect, useRef, useState } from 'react';
import type { CanvasFrame, DesignCanvasState, DetectSuggestion, LineShape, PlacedItem, ZoneShape } from '@/lib/design-canvas';
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
  suggestions?: DetectSuggestion[];
  onEditItem?: (id: string) => void;
  // Called with 'select' right after a zone/line is committed, so the very next tap on
  // the shape you just drew selects it instead of being swallowed by the still-armed
  // draw tool. Left unset, tool stays whatever the palette last chose (unchanged today).
  onToolChange?: (t: ToolKind) => void;
}

const GOLD = '#F7C97E';
const CYAN = '#22D3EE';
const SCALE_STEPS_M = [5, 10, 20, 50, 100, 200] as const;

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

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

// Crisp fence-line helper (ported from HybridRender.tsx's fencePicketPath) — short
// perpendicular "pickets" along a closed ring, in viewBox px.
function fencePicketPath(pts: Array<[number, number]>, spacing: number, half: number): string {
  let d = '';
  for (let i = 0; i < pts.length; i++) {
    const [ax, ay] = pts[i];
    const [bx, by] = pts[(i + 1) % pts.length];
    const dx = bx - ax, dy = by - ay;
    const len = Math.hypot(dx, dy) || 1;
    const px = -dy / len, py = dx / len;
    const n = Math.max(1, Math.round(len / spacing));
    for (let k = 1; k < n; k++) {
      const t = k / n;
      const cx = ax + dx * t, cy = ay + dy * t;
      d += `M${(cx - px * half).toFixed(1)},${(cy - py * half).toFixed(1)} L${(cx + px * half).toFixed(1)},${(cy + py * half).toFixed(1)} `;
    }
  }
  return d.trim();
}

// Signature of the boundary ring identity — used to key the auto-fit effect so it only
// re-runs when the boundary actually changes (point count + rounded coords), not on
// every render.
function boundarySignature(ring: Array<[number, number]>): string {
  return ring.map(([x, y]) => `${x.toFixed(4)},${y.toFixed(4)}`).join('|');
}

// Pick the largest of the standard step lengths whose pixel span fits within a quarter
// of the image width, so the scale bar reads cleanly at any zoom.
function pickScaleBarM(imgW: number, mPerPx: number): number {
  const maxPx = imgW / 4;
  let chosen: number = SCALE_STEPS_M[0];
  for (const m of SCALE_STEPS_M) {
    if (m / mPerPx <= maxPx) chosen = m;
  }
  return chosen;
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
  suggestions,
  onEditItem,
  onToolChange,
}: DesignCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const { imgW, imgH, mPerPx, satDataUrl } = frame;

  // Zoom/pan view transform — world-space (viewBox px) is drawn inside a single
  // <g transform="translate(tx ty) scale(k)">; fixed overlays (north arrow, scale bar,
  // zoom controls, Finish/Point buttons) stay outside it.
  const [view, setView] = useState<{ k: number; tx: number; ty: number }>({ k: 1, tx: 0, ty: 0 });
  const viewRef = useRef(view);
  viewRef.current = view;

  // In-progress draw state for zone/line tools.
  const [draftPoints, setDraftPoints] = useState<Array<[number, number]>>([]);
  // Drag state for moving an existing item.
  const dragItemId = useRef<string | null>(null);
  // Local preview position while dragging — committed to onChange once on release so a
  // drag emits a single undo entry instead of one per pointermove (see endDragItem).
  const [dragPos, setDragPos] = useState<[number, number] | null>(null);

  // Vertex-drag state for editing a selected zone/line's points. Same local-preview /
  // commit-on-release pattern as item drag — only the dragged vertex previews locally,
  // the rest of the ring/line stays as committed state until pointerup.
  const dragVertex = useRef<{ shapeId: string; kind: 'zone' | 'line'; index: number } | null>(null);
  const [vertexPos, setVertexPos] = useState<[number, number] | null>(null);

  // Resize-handle drag state for a selected item. Local preview (wM/hM) committed once
  // on release via onChange, same single-undo pattern as move/vertex drags.
  const dragResizeId = useRef<string | null>(null);
  const [resizePreview, setResizePreview] = useState<{ wM: number; hM: number } | null>(null);

  // Whole-shape (zone/line) translate drag — press-and-drag the body moves every point by
  // the same delta, mirroring startDragItem's press-drag-moves-the-whole-thing pattern.
  // originPoints is snapshotted at drag start so the delta is always relative to the
  // pre-drag shape, not the (already-translated) preview from the previous pointermove.
  const dragShape = useRef<{ id: string; kind: 'zone' | 'line'; originPoints: Array<[number, number]>; startWorldX: number; startWorldY: number } | null>(null);
  const [shapeDragDelta, setShapeDragDelta] = useState<[number, number] | null>(null);

  // Drag state for a vertex of the IN-PROGRESS (not yet committed) draft shape. Unlike
  // dragVertex below, draftPoints is local-only uncommitted state, so this mutates it
  // directly on every pointermove — no preview-then-commit-on-release dance needed since
  // there's no undo-stack entry to protect yet.
  const dragDraftVertex = useRef<number | null>(null);

  // One-finger background pan. Primed on EVERY tool's background pointerdown (not just
  // 'select'): the tool-specific tap action (place/draft-point/deselect) is deferred to
  // pointerup's "didn't move past threshold" branch, so a genuine tap still does the
  // expected thing but a drag pans the map instead of drawing/placing — see runTapAction.
  const panState = useRef<{ pointerId: number; startX: number; startY: number; startTx: number; startTy: number; moved: boolean; isMiddleButton?: boolean } | null>(null);

  // Active pointers for pinch-zoom (two-pointer gesture on the svg background).
  const activePointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  // Per-FRAME (not gesture-start) previous dist/midpoint, so a pure two-finger drag (no
  // distance change) still pans — anchoring the incremental zoom+translate to the last
  // frame (rather than a frozen gesture-start point) is what makes drift-while-pinching
  // and pure two-finger pan both fall out of the same formula. See handleBackgroundPointerMove.
  const pinchState = useRef<{ prevDist: number; prevMidX: number; prevMidY: number } | null>(null);

  function vbFromClient(clientX: number, clientY: number): [number, number] | null {
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
    const vx = (clientX - rect.left - offX) / scale;
    const vy = (clientY - rect.top - offY) / scale;
    return [vx, vy];
  }

  function clientToNorm(clientX: number, clientY: number): [number, number] | null {
    const vb = vbFromClient(clientX, clientY);
    if (!vb) return null;
    const { k, tx, ty } = viewRef.current;
    const wx = (vb[0] - tx) / k;
    const wy = (vb[1] - ty) / k;
    return [clamp01(wx / imgW), clamp01(wy / imgH)];
  }

  // Like clientToNorm but UNclamped and left in world-space viewBox px (not divided by
  // imgW/imgH) — needed for whole-shape drag deltas, where clamping/normalizing each
  // intermediate point would distort the shape before the final commit.
  function worldFromClient(clientX: number, clientY: number): [number, number] | null {
    const vb = vbFromClient(clientX, clientY);
    if (!vb) return null;
    const { k, tx, ty } = viewRef.current;
    return [(vb[0] - tx) / k, (vb[1] - ty) / k];
  }

  // Computes the auto-fit view for the current boundary: ≥3 points → frame its bbox to
  // ~82% of the canvas; otherwise k=1 centred (no-op translate, since the world origin
  // already sits at the canvas origin).
  function computeAutoFit(): { k: number; tx: number; ty: number } {
    if (refLayers.boundary.length >= 3) {
      const xs = refLayers.boundary.map(([x]) => x * imgW);
      const ys = refLayers.boundary.map(([, y]) => y * imgH);
      const minX = Math.min(...xs), maxX = Math.max(...xs);
      const minY = Math.min(...ys), maxY = Math.max(...ys);
      const bw = Math.max(maxX - minX, 1);
      const bh = Math.max(maxY - minY, 1);
      const bcx = (minX + maxX) / 2;
      const bcy = (minY + maxY) / 2;
      const k = clamp(Math.min(imgW / bw, imgH / bh) * 0.82, 1, 5);
      return { k, tx: imgW / 2 - k * bcx, ty: imgH / 2 - k * bcy };
    }
    return { k: 1, tx: 0, ty: 0 };
  }

  // Auto-fit on load: keyed on a signature of the boundary's points so it only re-runs
  // when the boundary identity actually changes, never on every render (e.g. while
  // panning/zooming).
  const boundarySig = boundarySignature(refLayers.boundary);
  useEffect(() => {
    setView(computeAutoFit());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boundarySig, imgW, imgH]);

  function runAutoFit() {
    setView(computeAutoFit());
  }

  function zoomAbout(vx: number, vy: number, factor: number) {
    setView((prev) => {
      const nextK = clamp(prev.k * factor, 1, 6);
      const ratio = nextK / prev.k;
      const tx = vx - (vx - prev.tx) * ratio;
      const ty = vy - (vy - prev.ty) * ratio;
      return { k: nextK, tx, ty };
    });
  }

  // Native (non-React) wheel listener with { passive: false } — React's onWheel prop is
  // attached passively, so e.preventDefault() inside it throws and never actually stops
  // page scroll (same gotcha documented in FacilitatorCanvas.tsx's zoom effect).
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      // Browsers report a trackpad pinch gesture as a synthetic ctrlKey=true wheel event
      // (also true for a literal Ctrl+scroll) — so ctrlKey distinguishes "pinch" from a
      // plain two-finger trackpad scroll. Tradeoff: a literal mouse's scroll wheel (no
      // ctrlKey) now PANS instead of zooming, matching the owner's "two fingers on the
      // touchpad should pan" ask; zoom is still reachable via pinch, +/-, or fit.
      if (e.ctrlKey) {
        const vb = vbFromClient(e.clientX, e.clientY);
        if (!vb) return;
        zoomAbout(vb[0], vb[1], e.deltaY < 0 ? 1.18 : 1 / 1.18);
        return;
      }
      const rect = svg.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const scale = Math.min(rect.width / imgW, rect.height / imgH);
      setView((prev) => ({ k: prev.k, tx: prev.tx - e.deltaX / scale, ty: prev.ty - e.deltaY / scale }));
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imgW, imgH]);

  // Double-click-to-finish fires 1-2 extra pointerdowns at the tap position before the
  // dblclick handler runs, appending near-duplicate draft points right at the end. Strip
  // any trailing point(s) within ~6 viewBox px of the point before them so a double-tap
  // finish doesn't leave a stray near-duplicate vertex in the committed shape.
  function dropTrailingDuplicates(points: Array<[number, number]>): Array<[number, number]> {
    const cleaned = points.slice();
    while (cleaned.length > 1) {
      const [ax, ay] = cleaned[cleaned.length - 2];
      const [bx, by] = cleaned[cleaned.length - 1];
      const dx = (bx - ax) * imgW;
      const dy = (by - ay) * imgH;
      if (Math.hypot(dx, dy) < 6) {
        cleaned.pop();
      } else {
        break;
      }
    }
    return cleaned;
  }

  function commitZone(points: Array<[number, number]>) {
    const cleaned = dropTrailingDuplicates(points);
    if (cleaned.length < 3) return;
    const shape: ZoneShape = { id: newId(), zone: zoneDraw, points: cleaned };
    onChange({ ...state, zones: [...state.zones, shape] });
    setDraftPoints([]);
    // Auto-select + revert to 'select' so the very next tap (the natural "let me check
    // it" gesture right after Finish) selects/edits the shape instead of being swallowed
    // by the still-armed zone tool as a stray new draft point.
    onSelect(shape.id);
    onToolChange?.('select');
  }

  function commitLine(points: Array<[number, number]>) {
    const cleaned = dropTrailingDuplicates(points);
    if (cleaned.length < 2) return;
    const shape: LineShape = { id: newId(), kind: lineKind, points: cleaned };
    onChange({ ...state, lines: [...state.lines, shape] });
    setDraftPoints([]);
    onSelect(shape.id);
    onToolChange?.('select');
  }

  function handleBackgroundPointerDown(e: React.PointerEvent<SVGSVGElement>) {
    // Middle mouse button always pans, regardless of tool — preventDefault stops the
    // browser's native middle-click auto-scroll cursor from taking over.
    if (e.button === 1) {
      e.preventDefault();
      (e.target as Element).setPointerCapture?.(e.pointerId);
      panState.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        startTx: view.tx,
        startTy: view.ty,
        moved: false,
        isMiddleButton: true,
      };
      return;
    }

    // Track every active pointer on the background for pinch-zoom, regardless of tool.
    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    (e.target as Element).setPointerCapture?.(e.pointerId);

    if (activePointers.current.size === 2) {
      // Entering a two-finger gesture (pinch and/or two-finger pan) — cancel any
      // in-progress one-finger pan.
      panState.current = null;
      const pts = Array.from(activePointers.current.values());
      const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y) || 1;
      const midClientX = (pts[0].x + pts[1].x) / 2;
      const midClientY = (pts[0].y + pts[1].y) / 2;
      const mid = vbFromClient(midClientX, midClientY);
      pinchState.current = {
        prevDist: dist,
        prevMidX: mid ? mid[0] : imgW / 2,
        prevMidY: mid ? mid[1] : imgH / 2,
      };
      return;
    }
    if (activePointers.current.size > 2) return;

    // Single-pointer: prime a potential pan for EVERY tool. The tool-specific tap action
    // (place item / append draft point / deselect) is deferred to pointerup's
    // "didn't move past threshold" branch (runTapAction) — so a clean tap still draws/
    // places/deselects exactly as before, but a drag pans instead.
    panState.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startTx: view.tx,
      startTy: view.ty,
      moved: false,
    };
  }

  function runTapAction(e: React.PointerEvent<SVGSVGElement>) {
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

    if (tool === 'zone' || tool === 'line') {
      setDraftPoints((prev) => [...prev, pt]);
    }
  }

  function handleBackgroundPointerMove(e: React.PointerEvent<SVGSVGElement>) {
    if (activePointers.current.has(e.pointerId)) {
      activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }

    if (pinchState.current && activePointers.current.size >= 2) {
      const pts = Array.from(activePointers.current.values()).slice(0, 2);
      const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y) || 1;
      const midClientX = (pts[0].x + pts[1].x) / 2;
      const midClientY = (pts[0].y + pts[1].y) / 2;
      const mid = vbFromClient(midClientX, midClientY);
      if (!mid) return;
      const ps = pinchState.current;
      const prevK = viewRef.current.k;
      const scaleStep = dist / ps.prevDist;
      const nextK = clamp(prevK * scaleStep, 1, 6);
      // Re-derive the step from the (possibly clamped) k so translate stays consistent
      // with the zoom actually applied, then anchor it to the LAST frame's tx/ty/mid —
      // not the gesture-start values — so a pure two-finger drag (distance unchanged,
      // effectiveStep=1) still carries the midpoint's drift into tx/ty. Pinch-with-drift
      // and pure two-finger pan fall out of this same incremental formula.
      const effectiveStep = nextK / prevK;
      const tx = effectiveStep * (viewRef.current.tx - ps.prevMidX) + mid[0];
      const ty = effectiveStep * (viewRef.current.ty - ps.prevMidY) + mid[1];
      setView({ k: nextK, tx, ty });
      pinchState.current = { prevDist: dist, prevMidX: mid[0], prevMidY: mid[1] };
      return;
    }

    const pan = panState.current;
    if (pan && pan.pointerId === e.pointerId) {
      const dx = e.clientX - pan.startX;
      const dy = e.clientY - pan.startY;
      if (!pan.moved && Math.hypot(dx, dy) < 6) return;
      pan.moved = true;
      // Convert client-space delta to viewBox-space delta (undo the letterbox scale).
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect || rect.width === 0 || rect.height === 0) return;
      const scale = Math.min(rect.width / imgW, rect.height / imgH);
      setView({ k: viewRef.current.k, tx: pan.startTx + dx / scale, ty: pan.startTy + dy / scale });
    }
  }

  function handleBackgroundPointerUp(e: React.PointerEvent<SVGSVGElement>) {
    activePointers.current.delete(e.pointerId);
    if (activePointers.current.size < 2) pinchState.current = null;

    const pan = panState.current;
    if (pan && pan.pointerId === e.pointerId) {
      panState.current = null;
      if (pan.moved || pan.isMiddleButton) return; // a drag (or explicit middle-mouse pan) — no tool action
      runTapAction(e);
    }
  }

  // A gesture interrupted by the OS/browser (app-switch, alert, etc.) fires
  // pointercancel, not pointerup — clear every live drag/pan/pinch ref WITHOUT
  // committing a partial edit, so an interrupted gesture can't leave state half-moved
  // or a ref permanently "stuck" armed.
  function handleBackgroundPointerCancel(e: React.PointerEvent<SVGSVGElement>) {
    activePointers.current.delete(e.pointerId);
    if (activePointers.current.size < 2) pinchState.current = null;
    if (panState.current?.pointerId === e.pointerId) panState.current = null;
    dragItemId.current = null;
    setDragPos(null);
    dragVertex.current = null;
    setVertexPos(null);
    dragResizeId.current = null;
    setResizePreview(null);
    dragShape.current = null;
    setShapeDragDelta(null);
    dragDraftVertex.current = null;
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
    setDragPos(pt);
  }

  function endDragItem() {
    const id = dragItemId.current;
    if (id && dragPos) {
      onChange({
        ...state,
        items: state.items.map((it) => (it.id === id ? { ...it, x: dragPos[0], y: dragPos[1] } : it)),
      });
    }
    dragItemId.current = null;
    setDragPos(null);
  }

  function startDragVertex(e: React.PointerEvent, shapeId: string, kind: 'zone' | 'line', index: number) {
    if (tool !== 'select') return;
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    dragVertex.current = { shapeId, kind, index };
  }

  function moveDragVertex(e: React.PointerEvent) {
    if (!dragVertex.current) return;
    const pt = clientToNorm(e.clientX, e.clientY);
    if (!pt) return;
    setVertexPos(pt);
  }

  function endDragVertex() {
    const dv = dragVertex.current;
    if (dv && vertexPos) {
      if (dv.kind === 'zone') {
        onChange({
          ...state,
          zones: state.zones.map((z) =>
            z.id === dv.shapeId
              ? { ...z, points: z.points.map((p, i) => (i === dv.index ? vertexPos : p)) }
              : z,
          ),
        });
      } else {
        onChange({
          ...state,
          lines: state.lines.map((l) =>
            l.id === dv.shapeId
              ? { ...l, points: l.points.map((p, i) => (i === dv.index ? vertexPos : p)) }
              : l,
          ),
        });
      }
    }
    dragVertex.current = null;
    setVertexPos(null);
  }

  // Whole-shape (zone/line) translate drag: press-and-drag the body moves every point by
  // the same delta in one gesture — mirroring startDragItem's press-drag-moves pattern,
  // which zones/lines previously lacked entirely (only single-vertex drag existed).
  function startDragShape(e: React.PointerEvent, id: string, kind: 'zone' | 'line') {
    if (tool !== 'select') return;
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    onSelect(id);
    const shape = kind === 'zone' ? state.zones.find((z) => z.id === id) : state.lines.find((l) => l.id === id);
    if (!shape) return;
    const w = worldFromClient(e.clientX, e.clientY);
    if (!w) return;
    dragShape.current = { id, kind, originPoints: shape.points, startWorldX: w[0], startWorldY: w[1] };
  }

  function moveDragShape(e: React.PointerEvent) {
    const ds = dragShape.current;
    if (!ds) return;
    const w = worldFromClient(e.clientX, e.clientY);
    if (!w) return;
    // Normalized-space delta, not yet clamped per-point — clamping mid-drag would distort
    // the shape if one vertex reaches the [0..1] edge before the others.
    setShapeDragDelta([(w[0] - ds.startWorldX) / imgW, (w[1] - ds.startWorldY) / imgH]);
  }

  function endDragShape() {
    const ds = dragShape.current;
    if (ds && shapeDragDelta) {
      const [dx, dy] = shapeDragDelta;
      const translated = ds.originPoints.map(([x, y]) => [clamp01(x + dx), clamp01(y + dy)] as [number, number]);
      if (ds.kind === 'zone') {
        onChange({ ...state, zones: state.zones.map((z) => (z.id === ds.id ? { ...z, points: translated } : z)) });
      } else {
        onChange({ ...state, lines: state.lines.map((l) => (l.id === ds.id ? { ...l, points: translated } : l)) });
      }
    }
    dragShape.current = null;
    setShapeDragDelta(null);
  }

  // Vertex drag for the IN-PROGRESS draft shape (mid-draw) — the owner's explicit ask:
  // "if i hover over a point it should be selectable to move even if i haven't completed
  // putting the polygon". draftPoints is local/uncommitted, so this writes through
  // directly on every move rather than the preview-then-commit-on-release pattern used
  // for already-committed shapes above (there's no undo entry to protect yet).
  function startDragDraftVertex(e: React.PointerEvent, index: number) {
    if (tool !== 'zone' && tool !== 'line') return;
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    dragDraftVertex.current = index;
  }

  function moveDragDraftVertex(e: React.PointerEvent) {
    const idx = dragDraftVertex.current;
    if (idx === null) return;
    const pt = clientToNorm(e.clientX, e.clientY);
    if (!pt) return;
    setDraftPoints((prev) => prev.map((p, i) => (i === idx ? pt : p)));
  }

  function endDragDraftVertex() {
    dragDraftVertex.current = null;
  }

  function startDragResize(e: React.PointerEvent, id: string) {
    if (tool !== 'select') return;
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    dragResizeId.current = id;
  }

  function moveDragResize(e: React.PointerEvent) {
    const id = dragResizeId.current;
    if (!id) return;
    const item = state.items.find((it) => it.id === id);
    const def = item && ELEMENTS_BY_ID[item.defId];
    if (!item || !def) return;
    const wM = item.wM ?? def.wM;
    const hM = item.hM ?? def.hM;
    // Item coords are world-space (unscaled viewBox px, inside the <g transform>) — the
    // pointer must be converted through the same inverse view transform as clientToNorm,
    // not compared against raw screen-space viewBox px, or resize drifts while zoomed.
    const centreWorld: [number, number] = [item.x * imgW, item.y * imgH];
    const vb = vbFromClient(e.clientX, e.clientY);
    if (!vb) return;
    const { k, tx, ty } = viewRef.current;
    const pointerWorld: [number, number] = [(vb[0] - tx) / k, (vb[1] - ty) / k];
    const distWorldPx = Math.hypot(pointerWorld[0] - centreWorld[0], pointerWorld[1] - centreWorld[1]);
    const distM = distWorldPx * mPerPx;
    const newWM = clamp(2 * distM, 0.3, 40);
    const newHM = hM * (newWM / wM);
    setResizePreview({ wM: newWM, hM: def.shape === 'circle' ? newWM : newHM });
  }

  function endDragResize() {
    const id = dragResizeId.current;
    if (id && resizePreview) {
      onChange({
        ...state,
        items: state.items.map((it) => (it.id === id ? { ...it, wM: resizePreview.wM, hM: resizePreview.hM } : it)),
      });
    }
    dragResizeId.current = null;
    setResizePreview(null);
  }

  // Add a vertex at the midpoint of edge `afterIndex → afterIndex+1` of a committed shape —
  // the owner's "add another corner" need, which only existed for in-progress drafts before.
  // Emits one onChange (= one undo entry), same commit pattern as endDragVertex.
  function insertZoneVertex(id: string, afterIndex: number) {
    onChange({
      ...state,
      zones: state.zones.map((z) => {
        if (z.id !== id) return z;
        const pts = z.points.slice();
        const a = pts[afterIndex];
        const b = pts[(afterIndex + 1) % pts.length];
        if (!a || !b) return z;
        pts.splice(afterIndex + 1, 0, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]);
        return { ...z, points: pts };
      }),
    });
  }

  // Remove a single vertex — guarded so a zone ring never drops below 3 points (a polygon).
  function removeZoneVertex(id: string, index: number) {
    onChange({
      ...state,
      zones: state.zones.map((z) =>
        z.id === id && z.points.length > 3 ? { ...z, points: z.points.filter((_, i) => i !== index) } : z,
      ),
    });
  }

  function insertLineVertex(id: string, afterIndex: number) {
    onChange({
      ...state,
      lines: state.lines.map((l) => {
        if (l.id !== id) return l;
        const pts = l.points.slice();
        const a = pts[afterIndex];
        const b = pts[afterIndex + 1];
        if (!a || !b) return l;
        pts.splice(afterIndex + 1, 0, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]);
        return { ...l, points: pts };
      }),
    });
  }

  // A line needs at least 2 points to remain a line.
  function removeLineVertex(id: string, index: number) {
    onChange({
      ...state,
      lines: state.lines.map((l) =>
        l.id === id && l.points.length > 2 ? { ...l, points: l.points.filter((_, i) => i !== index) } : l,
      ),
    });
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

  // touchAction 'none' whenever a two-finger pinch could occur (always, so the browser
  // never intercepts the gesture for native pinch-zoom/scroll) — panning/placing rely on
  // preventDefault + our own pointer handlers either way.
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      {/* Fill the container BOTH ways (meet = letterbox) so the whole site is always in
          view and the canvas never overflows and pushes the palette off-screen. */}
      <svg
        ref={svgRef}
        viewBox={`0 0 ${imgW} ${imgH}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ display: 'block', width: '100%', height: '100%', touchAction: 'none', background: '#0B120B' }}
        onPointerDown={handleBackgroundPointerDown}
        onPointerMove={(e) => {
          handleBackgroundPointerMove(e);
          moveDragItem(e);
          moveDragVertex(e);
          moveDragResize(e);
          moveDragShape(e);
          moveDragDraftVertex(e);
        }}
        onPointerUp={(e) => {
          handleBackgroundPointerUp(e);
          endDragItem();
          endDragVertex();
          endDragResize();
          endDragShape();
          endDragDraftVertex();
        }}
        onPointerCancel={handleBackgroundPointerCancel}
        onDoubleClick={handleBackgroundDoubleClick}
      >
        <g transform={`translate(${view.tx.toFixed(2)} ${view.ty.toFixed(2)}) scale(${view.k})`}>
        {/* Satellite underlay */}
        {satDataUrl ? (
          <image href={satDataUrl} x={0} y={0} width={imgW} height={imgH} preserveAspectRatio="xMidYMid slice" />
        ) : (
          <rect x={0} y={0} width={imgW} height={imgH} fill="#FFFEFA" />
        )}

        {/* Reference outlines: driveway, house, boundary (drawn in this order so boundary reads
            on top). Plain thin dashes, butt caps, no vertex dots — these are non-interactive
            traced references, not editable shapes, and must not look draggable. */}
        {refLayers.driveway.length >= 2 && (
          <polyline
            points={polylinePoints(refLayers.driveway, imgW, imgH)}
            fill="none"
            stroke="#E8D9B8"
            strokeWidth={1.5}
            strokeDasharray="4 4"
            strokeLinecap="butt"
            opacity={0.85}
            pointerEvents="none"
          />
        )}
        {refLayers.house.length >= 3 && (
          <polygon
            points={ringToPx(refLayers.house, imgW, imgH)}
            fill="rgba(78,166,216,0.15)"
            stroke="#4EA6D8"
            strokeWidth={1.25}
            strokeDasharray="4 4"
            strokeLinecap="butt"
            pointerEvents="none"
          />
        )}
        {refLayers.boundary.length >= 3 && (() => {
          const boundaryPx = refLayers.boundary.map(([x, y]) => [x * imgW, y * imgH] as [number, number]);
          const boundaryPts = ringToPx(refLayers.boundary, imgW, imgH);
          const picketPath = fencePicketPath(boundaryPx, 26, 6);
          return (
            <g pointerEvents="none">
              {/* Crisp fence style ported from HybridRender.tsx: dark casing + green line + pickets. */}
              <polygon points={boundaryPts} fill="none" stroke="#0B120B" strokeWidth={5} strokeLinejoin="round" opacity={0.5} />
              <polygon points={boundaryPts} fill="none" stroke="#9BE86B" strokeWidth={3} strokeLinejoin="round" />
              <path d={picketPath} stroke="#0B120B" strokeWidth={3} strokeLinecap="round" opacity={0.5} fill="none" />
              <path d={picketPath} stroke="#9BE86B" strokeWidth={1.6} strokeLinecap="round" fill="none" />
            </g>
          );
        })()}

        {/* Zones */}
        {activeLayers.zones &&
          state.zones.map((z) => {
            const def = ZONE_DEFS[z.zone];
            const isSelected = selectedId === z.id;
            const isDraggingVertexOfThisShape = dragVertex.current?.shapeId === z.id && dragVertex.current.kind === 'zone' && vertexPos;
            const isDraggingWholeShape = dragShape.current?.id === z.id && dragShape.current.kind === 'zone' && shapeDragDelta;
            const effectivePoints = isDraggingVertexOfThisShape
              ? z.points.map((p, i) => (i === dragVertex.current!.index ? vertexPos! : p))
              : isDraggingWholeShape
              ? z.points.map(([x, y]) => [clamp01(x + shapeDragDelta![0]), clamp01(y + shapeDragDelta![1])] as [number, number])
              : z.points;
            const centroid = ringCentroid(effectivePoints);
            const onZonePointerDown = (e: React.PointerEvent) => startDragShape(e, z.id, 'zone');
            return (
              <g key={z.id}>
                {/* Invisible fat hit-stroke along the edge — thin/narrow beds have little
                    fill area to tap, so a wide transparent perimeter catches the pointer
                    even when the interior fill is only a sliver. */}
                <polygon
                  points={ringToPx(effectivePoints, imgW, imgH)}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={16}
                  style={{ cursor: tool === 'select' ? 'grab' : 'default', pointerEvents: tool === 'select' ? 'stroke' : 'none' }}
                  onPointerDown={onZonePointerDown}
                />
                <polygon
                  points={ringToPx(effectivePoints, imgW, imgH)}
                  fill={def.color}
                  fillOpacity={0.2}
                  stroke={def.color}
                  strokeWidth={1.5}
                  strokeDasharray="6 4"
                  style={{ cursor: tool === 'select' ? 'grab' : 'default' }}
                  onPointerDown={onZonePointerDown}
                />
                <g
                  transform={`translate(${(centroid[0] * imgW).toFixed(1)},${(centroid[1] * imgH).toFixed(1)})`}
                  onPointerDown={onZonePointerDown}
                  style={{ cursor: tool === 'select' ? 'grab' : 'default' }}
                >
                  <circle r={11} fill={def.color} stroke="#FFFFFF" strokeWidth={2.5} />
                  <text textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={700} fill="#FFFFFF">
                    {z.zone}
                  </text>
                </g>
                {/* Editing handles show only in Select mode — while a draw tool is armed
                    they'd sit on top of the drawing surface and a stray tap on the ✕ (or a
                    vertex) would delete/grab the old zone instead of dropping the next corner
                    of the NEW one. Arming a tool also clears the selection upstream. */}
                {isSelected && tool === 'select' && (
                  <>
                    <polygon
                      points={ringToPx(effectivePoints, imgW, imgH)}
                      fill="none"
                      stroke={GOLD}
                      strokeWidth={2.5}
                      strokeDasharray="4 3"
                    />
                    {/* Edge-midpoint "+" handles — tap to insert a new corner on that edge. */}
                    {effectivePoints.map(([x, y], i) => {
                      const nxt = effectivePoints[(i + 1) % effectivePoints.length];
                      const mx = ((x + nxt[0]) / 2) * imgW;
                      const my = ((y + nxt[1]) / 2) * imgH;
                      return (
                        <g key={`add-${i}`}>
                          <circle
                            cx={mx}
                            cy={my}
                            r={13}
                            fill="transparent"
                            style={{ cursor: 'copy', touchAction: 'none', pointerEvents: 'fill' }}
                            onPointerDown={(e) => {
                              e.stopPropagation();
                              insertZoneVertex(z.id, i);
                            }}
                          />
                          <circle cx={mx} cy={my} r={6} fill="#1F4D2B" stroke="#FFFEFA" strokeWidth={1.5} pointerEvents="none" />
                          <text x={mx} y={my} textAnchor="middle" dominantBaseline="central" fontSize={10} fontWeight={700} fill="#FFFEFA" pointerEvents="none">
                            +
                          </text>
                        </g>
                      );
                    })}
                    {effectivePoints.map(([x, y], i) => (
                      <g key={i}>
                        {/* Invisible enlarged hit circle behind the visible ring — reliable
                            touch target without visually enlarging the handle. */}
                        <circle
                          cx={x * imgW}
                          cy={y * imgH}
                          r={14}
                          fill="transparent"
                          style={{ cursor: 'grab', touchAction: 'none', pointerEvents: 'fill' }}
                          onPointerDown={(e) => startDragVertex(e, z.id, 'zone', i)}
                        />
                        <circle
                          cx={x * imgW}
                          cy={y * imgH}
                          r={7}
                          fill="#FFFEFA"
                          stroke={GOLD}
                          strokeWidth={2}
                          pointerEvents="none"
                        />
                      </g>
                    ))}
                    {/* Per-vertex "−" badges to delete a corner — only while the ring has more
                        than the 3 points a polygon needs, so it can never be made degenerate. */}
                    {effectivePoints.length > 3 &&
                      effectivePoints.map(([x, y], i) => (
                        <g
                          key={`del-${i}`}
                          transform={`translate(${(x * imgW + 13).toFixed(1)},${(y * imgH - 13).toFixed(1)})`}
                          onPointerDown={(e) => {
                            e.stopPropagation();
                            removeZoneVertex(z.id, i);
                          }}
                          style={{ cursor: 'pointer' }}
                        >
                          <circle r={7} fill="#B53A3A" stroke="#FBF6EC" strokeWidth={1.2} />
                          <text textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={700} fill="#FBF6EC" pointerEvents="none">
                            −
                          </text>
                        </g>
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
            const isDraggingVertexOfThisShape = dragVertex.current?.shapeId === line.id && dragVertex.current.kind === 'line' && vertexPos;
            const isDraggingWholeShape = dragShape.current?.id === line.id && dragShape.current.kind === 'line' && shapeDragDelta;
            const effectivePoints = isDraggingVertexOfThisShape
              ? line.points.map((p, i) => (i === dragVertex.current!.index ? vertexPos! : p))
              : isDraggingWholeShape
              ? line.points.map(([x, y]) => [clamp01(x + shapeDragDelta![0]), clamp01(y + shapeDragDelta![1])] as [number, number])
              : line.points;
            const mid = effectivePoints[Math.floor(effectivePoints.length / 2)] ?? effectivePoints[0];
            return (
              <g key={line.id}>
                {/* Invisible fat hit-stroke — thin visible lines are hard to tap precisely,
                    so a wide transparent duplicate underneath catches the pointer instead. */}
                <polyline
                  points={polylinePoints(effectivePoints, imgW, imgH)}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={18}
                  strokeLinecap="round"
                  style={{ cursor: tool === 'select' ? 'grab' : 'default', pointerEvents: 'stroke' }}
                  onPointerDown={(e) => startDragShape(e, line.id, 'line')}
                />
                <polyline
                  points={polylinePoints(effectivePoints, imgW, imgH)}
                  fill="none"
                  stroke={style.stroke}
                  strokeWidth={style.width}
                  strokeDasharray={style.dash}
                  opacity={style.opacity ?? 1}
                  strokeLinecap="round"
                  style={{ pointerEvents: 'none' }}
                />
                {line.kind === 'fence' && (
                  <path d={fenceTicks(effectivePoints, imgW, imgH)} stroke={style.stroke} strokeWidth={1.5} />
                )}
                {isSelected && tool === 'select' && (
                  <>
                    {/* Edge-midpoint "+" handles — tap to insert a new corner on that segment. */}
                    {effectivePoints.slice(0, -1).map(([x, y], i) => {
                      const nxt = effectivePoints[i + 1];
                      const mx = ((x + nxt[0]) / 2) * imgW;
                      const my = ((y + nxt[1]) / 2) * imgH;
                      return (
                        <g key={`add-${i}`}>
                          <circle
                            cx={mx}
                            cy={my}
                            r={13}
                            fill="transparent"
                            style={{ cursor: 'copy', touchAction: 'none', pointerEvents: 'fill' }}
                            onPointerDown={(e) => {
                              e.stopPropagation();
                              insertLineVertex(line.id, i);
                            }}
                          />
                          <circle cx={mx} cy={my} r={6} fill="#1F4D2B" stroke="#FFFEFA" strokeWidth={1.5} pointerEvents="none" />
                          <text x={mx} y={my} textAnchor="middle" dominantBaseline="central" fontSize={10} fontWeight={700} fill="#FFFEFA" pointerEvents="none">
                            +
                          </text>
                        </g>
                      );
                    })}
                    {effectivePoints.map(([x, y], i) => (
                      <g key={i}>
                        <circle
                          cx={x * imgW}
                          cy={y * imgH}
                          r={14}
                          fill="transparent"
                          style={{ cursor: 'grab', touchAction: 'none', pointerEvents: 'fill' }}
                          onPointerDown={(e) => startDragVertex(e, line.id, 'line', i)}
                        />
                        <circle
                          cx={x * imgW}
                          cy={y * imgH}
                          r={7}
                          fill="#FFFEFA"
                          stroke={GOLD}
                          strokeWidth={2}
                          pointerEvents="none"
                        />
                      </g>
                    ))}
                    {/* Per-vertex "−" badges to delete a corner — kept above the 2-point
                        minimum a line needs to stay a line. */}
                    {effectivePoints.length > 2 &&
                      effectivePoints.map(([x, y], i) => (
                        <g
                          key={`del-${i}`}
                          transform={`translate(${(x * imgW + 13).toFixed(1)},${(y * imgH - 13).toFixed(1)})`}
                          onPointerDown={(e) => {
                            e.stopPropagation();
                            removeLineVertex(line.id, i);
                          }}
                          style={{ cursor: 'pointer' }}
                        >
                          <circle r={7} fill="#B53A3A" stroke="#FBF6EC" strokeWidth={1.2} />
                          <text textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={700} fill="#FBF6EC" pointerEvents="none">
                            −
                          </text>
                        </g>
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
        {/* Draft vertex handles — grabbable mid-draw (before the shape is closed/accepted),
            matching the committed-shape handle's visual language so "show all corners"
            reads consistently whether a shape is being drawn or already placed. */}
        {(tool === 'zone' || tool === 'line') &&
          draftPoints.map(([x, y], i) => (
            <g key={i}>
              <circle
                cx={x * imgW}
                cy={y * imgH}
                r={14}
                fill="transparent"
                style={{ cursor: 'grab', touchAction: 'none', pointerEvents: 'fill' }}
                onPointerDown={(e) => startDragDraftVertex(e, i)}
              />
              <circle cx={x * imgW} cy={y * imgH} r={7} fill="#FFFEFA" stroke={GOLD} strokeWidth={2} pointerEvents="none" />
            </g>
          ))}

        {/* Placed items at true scale */}
        {state.items.map((item) => {
          const def = ELEMENTS_BY_ID[item.defId];
          if (!def) return null;
          const layerKey = categoryLayerKey(def.category);
          if (layerKey && !activeLayers[layerKey]) return null;

          const isResizingThis = item.id === dragResizeId.current && resizePreview;
          const wM = isResizingThis ? resizePreview!.wM : item.wM ?? def.wM;
          const hM = isResizingThis ? resizePreview!.hM : item.hM ?? def.hM;
          const wPx = Math.max(wM / mPerPx, 6);
          const hPx = Math.max(hM / mPerPx, 6);
          const isDragging = item.id === dragItemId.current && dragPos;
          const [px, py] = isDragging ? dragPos : [item.x, item.y];
          const cx = px * imgW;
          const cy = py * imgH;
          const isSelected = selectedId === item.id;
          const iconDiscR = clamp(9, Math.min(wPx, hPx) * 0.35, 16);
          const fontSize = iconDiscR * 1.05;
          const labelText = item.label ?? def.name;
          const labelFull = item.note ? `${labelText} · ${item.note}` : labelText;

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
              {/* True-scale footprint (soft fill + stroke) */}
              {def.shape === 'circle' ? (
                <circle r={wPx / 2} fill={def.color} fillOpacity={0.35} stroke={def.color} strokeWidth={1.5} />
              ) : (
                <rect x={-wPx / 2} y={-hPx / 2} width={wPx} height={hPx} fill={def.color} fillOpacity={0.35} stroke={def.color} strokeWidth={1.5} />
              )}
              {/* Centred icon disc: colour-filled, white-stroked, emoji centred */}
              <circle r={iconDiscR} fill={def.color} stroke="#FFFFFF" strokeWidth={2.5} />
              <text textAnchor="middle" dominantBaseline="central" fontSize={fontSize}>
                {def.icon}
              </text>
              {/* Label pill below, app style */}
              <g transform={`translate(0, ${hPx / 2 + 9})`}>
                <foreignObject x={-45} y={-8} width={90} height={16} style={{ overflow: 'visible', pointerEvents: 'none' }}>
                  <div
                    style={{
                      fontSize: 9,
                      lineHeight: '14px',
                      textAlign: 'center',
                      color: '#F4EDD8',
                      background: 'rgba(32,25,15,0.74)',
                      borderRadius: 8,
                      padding: '1px 5px',
                      display: 'inline-block',
                      maxWidth: 90,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {labelFull}
                  </div>
                </foreignObject>
              </g>
              {isSelected && onEditItem && (
                <g
                  transform={`translate(${wPx / 2 + 6}, ${-hPx / 2 - 26})`}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    onEditItem(item.id);
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  <circle r={9} fill="#4EA6D8" stroke="#FBF6EC" strokeWidth={1.2} />
                  <text textAnchor="middle" dominantBaseline="central" fontSize={10} fill="#FBF6EC">
                    ✎
                  </text>
                </g>
              )}
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
              {/* Direct-resize handle — bottom-right corner of the footprint bbox */}
              {isSelected && tool === 'select' && (
                <g>
                  <rect
                    x={wPx / 2 - 5}
                    y={hPx / 2 - 5}
                    width={10}
                    height={10}
                    fill="#FFFFFF"
                    stroke={GOLD}
                    strokeWidth={2}
                    style={{ cursor: 'nwse-resize', touchAction: 'none' }}
                    onPointerDown={(e) => startDragResize(e, item.id)}
                  />
                  {isResizingThis && (
                    <g transform={`translate(${wPx / 2 + 14}, ${hPx / 2 + 14})`} pointerEvents="none">
                      <rect x={-20} y={-9} width={40} height={18} rx={9} fill="rgba(11,18,11,0.85)" stroke={GOLD} strokeWidth={1} />
                      <text textAnchor="middle" dominantBaseline="central" fontSize={9.5} fontWeight={700} fill={GOLD}>
                        {wM.toFixed(1)} m
                      </text>
                    </g>
                  )}
                </g>
              )}
            </g>
          );
        })}

        {/* AI auto-detect ghosts — 'pending' suggestions rendered as dashed outlines.
            pointerEvents none throughout so they never block placing/drawing/selecting. */}
        {suggestions
          ?.filter((s) => s.status === 'pending')
          .map((s) => {
            // Zone suggestions: translucent fill in the target zone's colour + a "Z{n}?" pill
            // at the ring centroid, distinct from the generic vision-kind cyan ghosts.
            if (s.kind === 'zone' && s.points.length >= 3 && s.zone !== undefined) {
              const zoneDef = ZONE_DEFS[s.zone];
              const centroid = ringCentroid(s.points);
              return (
                <g key={s.id} pointerEvents="none" opacity={0.85}>
                  <polygon
                    points={ringToPx(s.points, imgW, imgH)}
                    fill={zoneDef.color}
                    fillOpacity={0.16}
                    stroke={zoneDef.color}
                    strokeWidth={2}
                    strokeDasharray="5 4"
                  />
                  <g transform={`translate(${(centroid[0] * imgW).toFixed(1)},${(centroid[1] * imgH).toFixed(1)})`}>
                    <rect x={-18} y={-9} width={36} height={18} rx={9} fill="rgba(11,18,11,0.85)" stroke={zoneDef.color} strokeWidth={1} />
                    <text textAnchor="middle" dominantBaseline="central" fontSize={9.5} fontWeight={700} fill={zoneDef.color}>
                      Z{s.zone}?
                    </text>
                  </g>
                </g>
              );
            }

            // Point-like local generators (greywater/compost/beehive/veg_bed/nursery): render
            // as a circle ghost at sizeM (default 2m), same cyan-dashed style as vision points.
            const isLocalPoint =
              (s.kind === 'greywater' || s.kind === 'compost' || s.kind === 'beehive' || s.kind === 'veg_bed' || s.kind === 'nursery') &&
              s.points.length >= 1;
            if (isLocalPoint) {
              const [px, py] = s.points[0];
              return (
                <g key={s.id} pointerEvents="none" opacity={0.7}>
                  <circle
                    cx={px * imgW}
                    cy={py * imgH}
                    r={Math.max((s.sizeM ?? 2) / mPerPx / 2, 4)}
                    fill="none"
                    stroke={CYAN}
                    strokeWidth={2}
                    strokeDasharray="5 4"
                  />
                  <g transform={`translate(${(px * imgW).toFixed(1)},${(py * imgH - 12).toFixed(1)})`}>
                    <rect x={-16} y={-9} width={32} height={16} rx={8} fill="rgba(11,18,11,0.85)" stroke={CYAN} strokeWidth={1} />
                    <text textAnchor="middle" dominantBaseline="central" fontSize={9} fontWeight={700} fill={CYAN}>
                      AI?
                    </text>
                  </g>
                </g>
              );
            }

            // 'swale' generator: dashed cyan polyline, same treatment as vision line kinds.
            const isArea = s.kind === 'veg_area' && s.points.length >= 3;
            const isPoint = s.points.length === 1;
            const isLine = !isArea && s.points.length >= 2;
            const labelPt = isPoint ? s.points[0] : ringCentroid(s.points);
            return (
              <g key={s.id} pointerEvents="none" opacity={0.7}>
                {isPoint && (
                  <circle
                    cx={s.points[0][0] * imgW}
                    cy={s.points[0][1] * imgH}
                    r={Math.max((s.sizeM ?? 3) / mPerPx / 2, 4)}
                    fill="none"
                    stroke={CYAN}
                    strokeWidth={2}
                    strokeDasharray="5 4"
                  />
                )}
                {isArea && (
                  <polygon
                    points={ringToPx(s.points, imgW, imgH)}
                    fill={CYAN}
                    fillOpacity={0.1}
                    stroke={CYAN}
                    strokeWidth={2}
                    strokeDasharray="5 4"
                  />
                )}
                {isLine && (
                  <polyline
                    points={polylinePoints(s.points, imgW, imgH)}
                    fill="none"
                    stroke={CYAN}
                    strokeWidth={2.5}
                    strokeDasharray="5 4"
                  />
                )}
                {labelPt && (
                  <g transform={`translate(${(labelPt[0] * imgW).toFixed(1)},${(labelPt[1] * imgH - 12).toFixed(1)})`}>
                    <rect x={-16} y={-9} width={32} height={16} rx={8} fill="rgba(11,18,11,0.85)" stroke={CYAN} strokeWidth={1} />
                    <text textAnchor="middle" dominantBaseline="central" fontSize={9} fontWeight={700} fill={CYAN}>
                      AI?
                    </text>
                  </g>
                )}
              </g>
            );
          })}

        </g>
        {/* End world-space transform group — everything below is a fixed screen-space overlay. */}

        {/* North arrow — top-right, drawn last so it always sits on top. */}
        <g transform={`translate(${imgW - 34}, 34)`} pointerEvents="none">
          <circle r={19} fill="rgba(11,18,11,0.72)" />
          <path d="M0,-12 L6,8 L0,4 L-6,8 Z" fill="#FBF6EC" />
          <text x={0} y={-16} textAnchor="middle" fontSize={10} fontWeight={700} fill="#FBF6EC">
            N
          </text>
        </g>

        {/* Scale bar — bottom-left, drawn last so it always sits on top. Metres-per-viewBox-px
            at the current zoom is mPerPx/k (the world is scaled by k on screen), so the bar
            length for N metres is (N/mPerPx)*k viewBox px. */}
        {(() => {
          const mPerPxOnScreen = mPerPx / view.k;
          const barM = pickScaleBarM(imgW, mPerPxOnScreen);
          const barPx = (barM / mPerPx) * view.k;
          const x0 = 16;
          const y0 = imgH - 20;
          return (
            <g pointerEvents="none">
              <rect
                x={x0 - 8}
                y={y0 - 14}
                width={barPx + 16}
                height={26}
                rx={6}
                fill="rgba(11,18,11,0.72)"
              />
              <line x1={x0} y1={y0} x2={x0 + barPx} y2={y0} stroke="#FBF6EC" strokeWidth={2.5} />
              <line x1={x0} y1={y0 - 4} x2={x0} y2={y0 + 4} stroke="#FBF6EC" strokeWidth={2} />
              <line x1={x0 + barPx} y1={y0 - 4} x2={x0 + barPx} y2={y0 + 4} stroke="#FBF6EC" strokeWidth={2} />
              <text x={x0 + barPx / 2} y={y0 - 8} textAnchor="middle" fontSize={9.5} fontWeight={700} fill="#FBF6EC">
                {barM} m
              </text>
            </g>
          );
        })()}
      </svg>

      {/* Zoom controls — floating column bottom-right, above the scale bar. */}
      <div
        style={{
          position: 'absolute',
          bottom: 56,
          right: 12,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        {[
          { label: '+', onClick: () => zoomAbout(imgW / 2, imgH / 2, 1.3) },
          { label: '−', onClick: () => zoomAbout(imgW / 2, imgH / 2, 1 / 1.3) },
          { label: '⤢', onClick: runAutoFit },
        ].map(({ label, onClick }) => (
          <button
            key={label}
            type="button"
            onClick={onClick}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              border: 'none',
              background: 'rgba(11,18,11,0.82)',
              color: '#FBF6EC',
              fontWeight: 700,
              fontSize: 16,
              boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
              cursor: 'pointer',
            }}
          >
            {label}
          </button>
        ))}
      </div>

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
          onClick={() => setDraftPoints((prev) => prev.slice(0, -1))}
          style={{
            position: 'absolute',
            bottom: 12,
            right: 108,
            minHeight: 44,
            minWidth: 44,
            padding: '0 16px',
            borderRadius: 22,
            border: '1px solid rgba(0,0,0,0.15)',
            background: 'rgba(255,254,250,0.92)',
            color: '#0B120B',
            fontWeight: 600,
            fontSize: 14,
            boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
          }}
        >
          ↩ Point
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
            background: 'rgba(255,254,250,0.92)',
            color: '#0B120B',
            fontWeight: 600,
            fontSize: 14,
          }}
        >
          ✕ Cancel
        </button>
      )}
    </div>
  );
}
