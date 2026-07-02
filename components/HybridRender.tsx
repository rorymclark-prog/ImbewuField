'use client';

import { useRef, useState } from 'react';

// AI render frame. When a clip frame is supplied, we HARD-CLIP the AI image to the real
// traced boundary: outside the boundary we show the untouched satellite (neighbours stay
// real), inside it the AI design; the crisp boundary line + driveway are redrawn by US on
// top, so they're always exactly where the farmer traced — regardless of what the model
// painted. No clip frame → fall back to the plain AI image.
type ClipFrame = {
  ring: Array<[number, number]>;
  driveway: Array<[number, number]>;
  drivewayClosed?: boolean; // traced as an area → soft filled lane, not a dashed loop
  aspect: number; // w / h of the satellite area
  elements?: Array<{ type: string; icon: string; label: string; x: number; y: number }>; // farmer-placed point elements (normalised [0..1])
};

// Short perpendicular "pickets" along the boundary ring → reads as a strict fence line.
// pts are already in viewBox pixels; returns an SVG path of tick segments.
function fencePicketPath(pts: Array<[number, number]>, spacing: number, half: number): string {
  let d = '';
  for (let i = 0; i < pts.length; i++) {
    const [ax, ay] = pts[i];
    const [bx, by] = pts[(i + 1) % pts.length];
    const dx = bx - ax, dy = by - ay;
    const len = Math.hypot(dx, dy) || 1;
    const px = -dy / len, py = dx / len; // unit perpendicular
    const n = Math.max(1, Math.round(len / spacing));
    for (let k = 1; k < n; k++) {
      const t = k / n;
      const cx = ax + dx * t, cy = ay + dy * t;
      d += `M${(cx - px * half).toFixed(1)},${(cy - py * half).toFixed(1)} L${(cx + px * half).toFixed(1)},${(cy + py * half).toFixed(1)} `;
    }
  }
  return d.trim();
}

export default function HybridRender({
  imageDataUrl,
  placeName,
  mapType,
  biome,
  rainfallMm,
  soilTexture,
  satUrl,
  clip,
  filename,
  onTouchUp,
}: {
  imageDataUrl: string;
  placeName: string;
  mapType?: string;
  biome?: string;
  rainfallMm?: number;
  soilTexture?: string;
  satUrl?: string | null;
  clip?: ClipFrame | null;
  filename: string;
  onTouchUp?: (rectNorm: { x0: number; y0: number; x1: number; y1: number }, promptText: string) => Promise<void>;
}) {
  const svgRef = useRef<SVGSVGElement>(null);

  // --- Touch-up: draw-a-rectangle-and-prompt local UI state (does not touch existing render logic) ---
  const [touchUpMode, setTouchUpMode] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [dragCurrent, setDragCurrent] = useState<{ x: number; y: number } | null>(null);
  const [selectedRect, setSelectedRect] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const [touchUpPrompt, setTouchUpPrompt] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [touchUpError, setTouchUpError] = useState('');
  const overlayRef = useRef<HTMLDivElement>(null);

  // Convert a pointer event's client coords into SVG viewBox units (0..W / 0..H).
  function clientToViewBox(clientX: number, clientY: number): { x: number; y: number } | null {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    const fx = (clientX - rect.left) / rect.width;
    const fy = (clientY - rect.top) / rect.height;
    return { x: Math.min(Math.max(fx * W, 0), W), y: Math.min(Math.max(fy * H, 0), H) };
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (!touchUpMode) return;
    const pt = clientToViewBox(e.clientX, e.clientY);
    if (!pt) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    setSelectedRect(null);
    setTouchUpPrompt('');
    setTouchUpError('');
    setDragStart(pt);
    setDragCurrent(pt);
    setDragging(true);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragging) return;
    const pt = clientToViewBox(e.clientX, e.clientY);
    if (!pt) return;
    setDragCurrent(pt);
  }

  function handlePointerUp() {
    if (!dragging || !dragStart || !dragCurrent) {
      setDragging(false);
      return;
    }
    setDragging(false);
    const x0 = Math.min(dragStart.x, dragCurrent.x);
    const x1 = Math.max(dragStart.x, dragCurrent.x);
    const y0 = Math.min(dragStart.y, dragCurrent.y);
    const y1 = Math.max(dragStart.y, dragCurrent.y);
    const wFrac = (x1 - x0) / W;
    const hFrac = (y1 - y0) / H;
    if (wFrac >= 0.03 && hFrac >= 0.03) {
      setSelectedRect({ x0, y0, x1, y1 });
    } else {
      setSelectedRect(null);
    }
    setDragStart(null);
    setDragCurrent(null);
  }

  function cancelTouchUp() {
    setSelectedRect(null);
    setTouchUpPrompt('');
    setTouchUpError('');
    setDragStart(null);
    setDragCurrent(null);
    setDragging(false);
  }

  async function submitTouchUp() {
    if (!onTouchUp || !selectedRect || !touchUpPrompt.trim()) return;
    const rectNorm = {
      x0: selectedRect.x0 / W,
      y0: selectedRect.y0 / H,
      x1: selectedRect.x1 / W,
      y1: selectedRect.y1 / H,
    };
    setSubmitting(true);
    setTouchUpError('');
    try {
      await onTouchUp(rectNorm, touchUpPrompt.trim());
      setSelectedRect(null);
      setTouchUpPrompt('');
      setTouchUpMode(false);
    } catch (err) {
      setTouchUpError(err instanceof Error ? err.message : 'Touch-up failed. Try again.');
    } finally {
      setSubmitting(false);
    }
  }

  // Live drag rect + committed selection rect, in viewBox px, for the overlay <rect> (dragging only —
  // never rendered into the persistent SVG that download() clones).
  const liveDragRect = dragging && dragStart && dragCurrent
    ? {
        x0: Math.min(dragStart.x, dragCurrent.x),
        y0: Math.min(dragStart.y, dragCurrent.y),
        x1: Math.max(dragStart.x, dragCurrent.x),
        y1: Math.max(dragStart.y, dragCurrent.y),
      }
    : null;
  const overlayRect = liveDragRect || selectedRect;
  const notes = [biome, rainfallMm ? `${rainfallMm} mm/yr` : '', soilTexture ? `${soilTexture} soil` : '']
    .filter(Boolean)
    .join(' · ');
  const subtitle = mapType ? `${mapType} · Permaculture design` : 'Permaculture design map';

  const W = 1000;
  const useClip = !!(clip && satUrl && clip.ring.length >= 3 && Number.isFinite(clip.aspect) && clip.aspect > 0);
  const H = useClip ? Math.round(W / clip!.aspect) : 1000;

  const toPts = (pts: Array<[number, number]>) =>
    pts.map(([nx, ny]) => `${(nx * W).toFixed(1)},${(ny * H).toFixed(1)}`).join(' ');
  const ringPts = useClip ? toPts(clip!.ring) : '';
  const drivePts = useClip && clip!.driveway.length >= 2 ? toPts(clip!.driveway) : '';
  // Pixel ring + fence pickets (strict boundary-fence look).
  const ringPx = useClip ? clip!.ring.map(([nx, ny]) => [nx * W, ny * H] as [number, number]) : [];
  const fencePts = useClip ? fencePicketPath(ringPx, 26, 6) : '';

  const hasNotes = !!notes;
  const headerH = hasNotes ? 92 : 70;

  async function download() {
    const svg = svgRef.current;
    if (!svg) return;
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('width', String(W));
    clone.setAttribute('height', String(H));
    const xml = new XMLSerializer().serializeToString(clone);
    const url = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml;charset=utf-8' }));
    await new Promise<void>((resolve) => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = W * 2;
        c.height = H * 2;
        const ctx = c.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, W * 2, H * 2);
          const a = document.createElement('a');
          a.href = c.toDataURL('image/png');
          a.download = filename;
          a.click();
        }
        URL.revokeObjectURL(url);
        resolve();
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve();
      };
      img.src = url;
    });
  }

  return (
    <div className="space-y-1">
      <div style={{ position: 'relative' }}>
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} width="100%" style={{ borderRadius: 14, border: '2px solid #F7C97E', display: 'block' }}>
        {useClip ? (
          <>
            <defs>
              <clipPath id="imbewu-bnd">
                <polygon points={ringPts} />
              </clipPath>
            </defs>
            {/* Real satellite base — everything OUTSIDE the boundary stays the true photo */}
            <image href={satUrl!} x={0} y={0} width={W} height={H} preserveAspectRatio="none" />
            {/* Recess the neighbours' land slightly so the design reads as the focus */}
            <rect x={0} y={0} width={W} height={H} fill="rgba(10,15,8,0.34)" />
            {/* AI design — HARD-CLIPPED to the traced boundary; can never spill outside */}
            <image href={imageDataUrl} x={0} y={0} width={W} height={H} preserveAspectRatio="none" clipPath="url(#imbewu-bnd)" />
            {/* Crisp boundary FENCE (our vector, always exact): casing + bold line + pickets */}
            <polygon points={ringPts} fill="none" stroke="#0B120B" strokeWidth={6} strokeLinejoin="round" opacity={0.55} />
            <polygon points={ringPts} fill="none" stroke="#9BE86B" strokeWidth={3.5} strokeLinejoin="round" />
            {fencePts && (
              <>
                <path d={fencePts} stroke="#0B120B" strokeWidth={3} strokeLinecap="round" opacity={0.5} fill="none" />
                <path d={fencePts} stroke="#9BE86B" strokeWidth={1.6} strokeLinecap="round" fill="none" />
              </>
            )}
            {/* Driveway — drawn by us so it's always obeyed. An AREA (polygon) renders as a
                soft paved lane; a LINE renders as a dashed track. */}
            {drivePts && (clip!.drivewayClosed ? (
              <polygon points={drivePts} fill="rgba(232,224,206,0.30)" stroke="#E8E0CE" strokeWidth={1.5} strokeLinejoin="round" />
            ) : (
              <>
                <polyline points={drivePts} fill="none" stroke="#0B120B" strokeWidth={6.5} strokeLinecap="round" strokeLinejoin="round" opacity={0.5} />
                <polyline points={drivePts} fill="none" stroke="#F4EDD8" strokeWidth={3} strokeDasharray="11,7" strokeLinecap="round" strokeLinejoin="round" />
              </>
            ))}
            {/* Placed site elements (tanks/taps/boreholes/etc) — drawn by us so they're
                always exactly where the farmer placed them, regardless of what the model painted. */}
            {clip!.elements?.map((el, i) => {
              const ex = el.x * W, ey = el.y * H;
              const text = el.label.length > 22 ? `${el.label.slice(0, 21)}…` : el.label;
              const pillW = Math.min(Math.max(text.length * 6 + 18, 26), 170);
              return (
                <g key={`elem-${i}`}>
                  <circle cx={ex} cy={ey} r="11" fill="rgba(11,18,11,0.85)" stroke="#F4EDD8" strokeWidth="2" />
                  <text x={ex} y={ey + 4.5} textAnchor="middle" fontSize="12">{el.icon}</text>
                  <rect x={ex - pillW / 2} y={ey + 14} width={pillW} height={16} rx="8" fill="rgba(11,18,11,0.85)" />
                  <text
                    x={ex} y={ey + 25.5}
                    textAnchor="middle"
                    fontFamily="Helvetica, Arial, sans-serif"
                    fontSize="9"
                    fontWeight="600"
                    fill="#F4EDD8"
                  >
                    {text}
                  </text>
                </g>
              );
            })}
          </>
        ) : (
          <image href={imageDataUrl} x={0} y={0} width={W} height={H} preserveAspectRatio="xMidYMid slice" />
        )}

        {/* Full-width opaque header bar — covers any title the model baked into the top strip */}
        <rect x={0} y={0} width={W} height={headerH} fill="rgba(11,18,11,0.94)" />
        <text x={22} y={34} fontFamily="Georgia, serif" fontWeight="800" fontSize="24" fill="#FFFFFF">{placeName}</text>
        <text x={22} y={56} fontFamily="Helvetica, Arial, sans-serif" fontSize="12.5" fill="#D9E8C9">{subtitle}</text>
        {hasNotes && <text x={22} y={75} fontFamily="Helvetica, Arial, sans-serif" fontSize="11" fill="#A9C7A0">{notes}</text>}

        {/* One-line footer */}
        <rect x={0} y={H - 36} width={W} height={36} fill="rgba(11,18,11,0.55)" />
        <text x={20} y={H - 13} fontFamily="Helvetica, Arial, sans-serif" fontSize="12" fill="#D9E8C9">AI visualisation — confirm on the ground. The SVG map is the exact version.</text>
        <text x={W - 20} y={H - 13} textAnchor="end" fontFamily="Helvetica, Arial, sans-serif" fontSize="11" fill="#9DB48E">ImbewuField · WGS 84</text>

        {/* Touch-up selection rectangle — only exists while in touch-up mode (dragging or a
            committed selection awaiting a prompt). Never present when touchUpMode is off, so it's
            never baked into a download() export (the Download button is hidden while active anyway). */}
        {touchUpMode && overlayRect && (
          <rect
            x={overlayRect.x0}
            y={overlayRect.y0}
            width={overlayRect.x1 - overlayRect.x0}
            height={overlayRect.y1 - overlayRect.y0}
            fill="rgba(247,201,126,0.25)"
            stroke="#F7C97E"
            strokeWidth={2.5}
            strokeDasharray="8,6"
          />
        )}
      </svg>

      {/* Touch-up pointer-capture layer — HTML, sits on top of the SVG, phone-first (pointer events
          cover mouse + touch + pen). Only active while touchUpMode is on. */}
      {touchUpMode && (
        <div
          ref={overlayRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          style={{
            position: 'absolute',
            inset: 0,
            touchAction: 'none',
            cursor: 'crosshair',
          }}
        />
      )}

      {/* Floating prompt UI — plain HTML, absolutely positioned over the image, OUTSIDE the <svg>
          so it can never end up in the exported PNG. Shown only once a big-enough rect is selected. */}
      {touchUpMode && selectedRect && (
        <div
          style={{
            position: 'absolute',
            left: `${(selectedRect.x0 / W) * 100}%`,
            top: `${Math.min((selectedRect.y1 / H) * 100 + 1, 88)}%`,
            width: `${Math.max(((selectedRect.x1 - selectedRect.x0) / W) * 100, 55)}%`,
            maxWidth: '92%',
            background: 'rgba(11,18,11,0.95)',
            border: '1px solid #F7C97E',
            borderRadius: 10,
            padding: 8,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            zIndex: 5,
          }}
        >
          <input
            type="text"
            value={touchUpPrompt}
            onChange={(e) => setTouchUpPrompt(e.target.value)}
            placeholder="What should change here?"
            disabled={submitting}
            style={{
              fontSize: 12,
              padding: '6px 8px',
              borderRadius: 6,
              border: '1px solid #4A5A44',
              background: '#0B120B',
              color: '#F4EDD8',
            }}
          />
          {touchUpError && (
            <div style={{ fontSize: 11, color: '#E88A6B' }}>{touchUpError}</div>
          )}
          <div className="flex items-center justify-end" style={{ gap: 8 }}>
            <button
              onClick={cancelTouchUp}
              disabled={submitting}
              className="text-xs font-semibold"
              style={{ color: '#D9E8C9', background: 'none', border: 'none', cursor: submitting ? 'default' : 'pointer' }}
            >
              Cancel
            </button>
            <button
              onClick={submitTouchUp}
              disabled={submitting || !touchUpPrompt.trim()}
              className="text-xs font-semibold"
              style={{
                color: '#0B120B',
                background: '#F7C97E',
                border: 'none',
                borderRadius: 6,
                padding: '5px 10px',
                cursor: submitting || !touchUpPrompt.trim() ? 'default' : 'pointer',
                opacity: submitting || !touchUpPrompt.trim() ? 0.6 : 1,
              }}
            >
              {submitting ? 'Redoing…' : 'Redo this area'}
            </button>
          </div>
        </div>
      )}
      </div>
      <div className="flex items-center justify-end" style={{ gap: 14 }}>
        {onTouchUp && (
          <button
            onClick={() => {
              if (!imageDataUrl) return;
              if (touchUpMode) {
                cancelTouchUp();
                setTouchUpMode(false);
              } else {
                setTouchUpMode(true);
              }
            }}
            disabled={!imageDataUrl}
            className="text-xs font-semibold"
            style={{
              color: touchUpMode ? '#0B120B' : '#F7C97E',
              background: touchUpMode ? '#F7C97E' : 'none',
              border: 'none',
              borderRadius: touchUpMode ? 6 : 0,
              padding: touchUpMode ? '3px 8px' : 0,
              cursor: imageDataUrl ? 'pointer' : 'default',
              opacity: imageDataUrl ? 1 : 0.4,
            }}
          >
            {touchUpMode ? 'Exit touch up' : '✏️ Touch up'}
          </button>
        )}
        <button
          onClick={download}
          disabled={touchUpMode}
          title={touchUpMode ? 'Exit touch up before downloading' : undefined}
          className="text-xs font-semibold"
          style={{ color: '#F7C97E', background: 'none', border: 'none', cursor: touchUpMode ? 'default' : 'pointer', opacity: touchUpMode ? 0.4 : 1 }}
        >
          Download ↓
        </button>
      </div>
    </div>
  );
}
