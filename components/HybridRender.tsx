'use client';

import { useRef } from 'react';

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
}) {
  const svgRef = useRef<SVGSVGElement>(null);
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
      </svg>
      <div className="flex items-center justify-end">
        <button onClick={download} className="text-xs font-semibold" style={{ color: '#F7C97E', background: 'none', border: 'none', cursor: 'pointer' }}>
          Download ↓
        </button>
      </div>
    </div>
  );
}
