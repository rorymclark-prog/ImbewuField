'use client';

// Design Studio — the STRICT final "glossy" render. Composites the farmer's exact
// design (satellite + zones + lines + items) into an image, builds a protect-mask that
// pixel-locks every farmer feature, then sends both to the AI render pipeline so the AI
// may only repaint background texture — never move, add, or remove anything the farmer
// placed.

import { useCallback, useRef, useState } from 'react';
import { Download, RefreshCw, Sparkles, Gem } from 'lucide-react';

import type { CanvasFrame, DesignCanvasState } from '@/lib/design-canvas';
import { ELEMENTS_BY_ID } from '@/lib/design-elements';
import { ZONE_DEFS } from '@/lib/design-elements';
import { requestRender, stripDataUrl } from '@/lib/ai-render-client';

const PAPER = '#FBF6EC';
const GOLD = '#F7C97E';
const GREEN = '#1F4D2B';
const DARK = '#0B120B';

const STRICT_PROMPT =
  'Repaint ONLY the unprotected background as a beautiful hand-illustrated permaculture map ' +
  '(soft earth tones, gentle textures, subtle grass/soil detail). This design was drawn by the ' +
  'farmer: do NOT add, move, remove, resize or restyle ANY element, zone, line or label — every ' +
  'feature stays exactly where and how it is.';

const LINE_COLORS: Record<string, string> = {
  swale: '#4EA6D8',
  fence: '#8C8577',
  path: '#C9A227',
  pipe: '#2B6FA6',
  drip: '#4E8B3B',
  windbreak: '#2F7A4A',
};

export interface DesignGlossyProps {
  state: DesignCanvasState;
  frame: CanvasFrame;
  refLayers: {
    boundary: Array<[number, number]>;
    house: Array<[number, number]>;
    driveway: Array<[number, number]>;
  };
  site: { biome?: string; rainfallMm?: number } | null;
  placeName?: string;
}

const SCALE = 2;

function drawMarks(ctx: CanvasRenderingContext2D, state: DesignCanvasState, refLayers: DesignGlossyProps['refLayers'], imgW: number, imgH: number) {
  const px = (n: number) => n * imgW;
  const py = (n: number) => n * imgH;

  // Boundary ring
  if (refLayers.boundary.length >= 3) {
    ctx.beginPath();
    refLayers.boundary.forEach(([x, y], i) => {
      const fn = i === 0 ? ctx.moveTo : ctx.lineTo;
      fn.call(ctx, px(x), py(y));
    });
    ctx.closePath();
    ctx.strokeStyle = 'rgba(140,235,106,0.9)';
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  // House ring
  if (refLayers.house.length >= 3) {
    ctx.beginPath();
    refLayers.house.forEach(([x, y], i) => {
      const fn = i === 0 ? ctx.moveTo : ctx.lineTo;
      fn.call(ctx, px(x), py(y));
    });
    ctx.closePath();
    ctx.fillStyle = 'rgba(58,53,44,0.55)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(58,53,44,0.95)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // Driveway
  if (refLayers.driveway.length >= 2) {
    ctx.beginPath();
    refLayers.driveway.forEach(([x, y], i) => {
      const fn = i === 0 ? ctx.moveTo : ctx.lineTo;
      fn.call(ctx, px(x), py(y));
    });
    ctx.strokeStyle = 'rgba(217,145,51,0.85)';
    ctx.lineWidth = 8;
    ctx.stroke();
  }

  // Zones — translucent fill
  for (const zone of state.zones) {
    if (zone.points.length < 3) continue;
    const def = ZONE_DEFS[zone.zone];
    ctx.beginPath();
    zone.points.forEach(([x, y], i) => {
      const fn = i === 0 ? ctx.moveTo : ctx.lineTo;
      fn.call(ctx, px(x), py(y));
    });
    ctx.closePath();
    ctx.fillStyle = `${def.color}33`;
    ctx.fill();
    ctx.strokeStyle = `${def.color}CC`;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // Lines
  for (const line of state.lines) {
    if (line.points.length < 2) continue;
    ctx.beginPath();
    line.points.forEach(([x, y], i) => {
      const fn = i === 0 ? ctx.moveTo : ctx.lineTo;
      fn.call(ctx, px(x), py(y));
    });
    ctx.strokeStyle = LINE_COLORS[line.kind] ?? '#8C8577';
    ctx.lineWidth = line.kind === 'fence' ? 2 : 4;
    if (line.kind === 'fence') ctx.setLineDash([6, 4]);
    else ctx.setLineDash([]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Items — footprint + emoji label. NB: this canvas may be SCALE× the logical frame
  // (imgW = frame.imgW × SCALE), so convert metres → CANVAS px via the canvas's own
  // width — sizing in logical px here would draw every footprint at half scale.
  const pxPerM = imgW / (state.frame.imgW * state.frame.mPerPx);
  for (const item of state.items) {
    const def = ELEMENTS_BY_ID[item.defId];
    if (!def) continue;
    const wM = item.wM ?? def.wM;
    const hM = item.hM ?? def.hM;
    const wLogical = wM * pxPerM;
    const hLogical = hM * pxPerM;
    const cx = px(item.x);
    const cy = py(item.y);
    ctx.fillStyle = `${def.color}55`;
    ctx.strokeStyle = def.color;
    ctx.lineWidth = 2;
    if (def.shape === 'circle') {
      ctx.beginPath();
      ctx.arc(cx, cy, wLogical / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.rect(cx - wLogical / 2, cy - hLogical / 2, wLogical, hLogical);
      ctx.fill();
      ctx.stroke();
    }
    ctx.font = `${Math.max(14, Math.min(28, wLogical * 0.6))}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#0B120B';
    ctx.fillText(def.icon, cx, cy);
  }
}

async function buildComposite(state: DesignCanvasState, frame: CanvasFrame, refLayers: DesignGlossyProps['refLayers']): Promise<string> {
  const imgW = frame.imgW * SCALE;
  const imgH = frame.imgH * SCALE;
  const canvas = document.createElement('canvas');
  canvas.width = imgW;
  canvas.height = imgH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');

  if (frame.satDataUrl) {
    const img = await loadImage(frame.satDataUrl);
    ctx.drawImage(img, 0, 0, imgW, imgH);
  } else {
    ctx.fillStyle = '#CBB98A';
    ctx.fillRect(0, 0, imgW, imgH);
  }

  drawMarks(ctx, state, refLayers, imgW, imgH);

  return canvas.toDataURL('image/jpeg', 0.9);
}

async function buildProtectMask(state: DesignCanvasState, frame: CanvasFrame, refLayers: DesignGlossyProps['refLayers']): Promise<string> {
  const imgW = frame.imgW * SCALE;
  const imgH = frame.imgH * SCALE;
  const canvas = document.createElement('canvas');
  canvas.width = imgW;
  canvas.height = imgH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');

  // Fully transparent = editable everywhere, by default.
  ctx.clearRect(0, 0, imgW, imgH);

  const px = (n: number) => n * imgW;
  const py = (n: number) => n * imgH;
  ctx.fillStyle = '#FFFFFF';
  ctx.strokeStyle = '#FFFFFF';

  // Whole house polygon protected.
  if (refLayers.house.length >= 3) {
    ctx.beginPath();
    refLayers.house.forEach(([x, y], i) => {
      const fn = i === 0 ? ctx.moveTo : ctx.lineTo;
      fn.call(ctx, px(x), py(y));
    });
    ctx.closePath();
    ctx.fill();
  }

  // Boundary ring stroke band.
  if (refLayers.boundary.length >= 3) {
    ctx.beginPath();
    refLayers.boundary.forEach(([x, y], i) => {
      const fn = i === 0 ? ctx.moveTo : ctx.lineTo;
      fn.call(ctx, px(x), py(y));
    });
    ctx.closePath();
    ctx.lineWidth = 8 * SCALE;
    ctx.stroke();
  }

  // Driveway stroke band.
  if (refLayers.driveway.length >= 2) {
    ctx.beginPath();
    refLayers.driveway.forEach(([x, y], i) => {
      const fn = i === 0 ? ctx.moveTo : ctx.lineTo;
      fn.call(ctx, px(x), py(y));
    });
    ctx.lineWidth = 10 * SCALE;
    ctx.stroke();
  }

  // Zone ring stroke bands (edges locked; interior remains editable background).
  for (const zone of state.zones) {
    if (zone.points.length < 3) continue;
    ctx.beginPath();
    zone.points.forEach(([x, y], i) => {
      const fn = i === 0 ? ctx.moveTo : ctx.lineTo;
      fn.call(ctx, px(x), py(y));
    });
    ctx.closePath();
    ctx.lineWidth = 8 * SCALE;
    ctx.stroke();
  }

  // Line strokes.
  for (const line of state.lines) {
    if (line.points.length < 2) continue;
    ctx.beginPath();
    line.points.forEach(([x, y], i) => {
      const fn = i === 0 ? ctx.moveTo : ctx.lineTo;
      fn.call(ctx, px(x), py(y));
    });
    ctx.lineWidth = 10 * SCALE;
    ctx.stroke();
  }

  // Item footprints (+25% margin). Same canvas-scale-aware conversion as the composite:
  // metres → CANVAS px (the mask is SCALE× the logical frame, and it MUST protect the
  // full true-scale footprint, not half of it).
  const maskPxPerM = imgW / (state.frame.imgW * state.frame.mPerPx);
  for (const item of state.items) {
    const def = ELEMENTS_BY_ID[item.defId];
    if (!def) continue;
    const wM = (item.wM ?? def.wM) * 1.25;
    const hM = (item.hM ?? def.hM) * 1.25;
    const wLogical = wM * maskPxPerM;
    const hLogical = hM * maskPxPerM;
    const cx = px(item.x);
    const cy = py(item.y);
    ctx.beginPath();
    if (def.shape === 'circle') {
      ctx.arc(cx, cy, wLogical / 2, 0, Math.PI * 2);
    } else {
      ctx.rect(cx - wLogical / 2, cy - hLogical / 2, wLogical, hLogical);
    }
    ctx.fill();
  }

  return canvas.toDataURL('image/png');
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not load image'));
    img.src = src;
  });
}

export default function DesignGlossy({ state, frame, refLayers, site, placeName }: DesignGlossyProps) {
  const [loading, setLoading] = useState<'gemini' | 'falgpt' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const generate = useCallback(
    async (provider: 'gemini' | 'falgpt') => {
      setLoading(provider);
      setError(null);
      try {
        const composite = await buildComposite(state, frame, refLayers);
        let image: string;
        if (provider === 'falgpt') {
          const mask = await buildProtectMask(state, frame, refLayers);
          image = await requestRender({
            imageBase64: stripDataUrl(composite),
            maskBase64: stripDataUrl(mask),
            provider: 'falgpt',
            context: {},
            touchupPrompt: STRICT_PROMPT,
          });
        } else {
          image = await requestRender({
            imageBase64: stripDataUrl(composite),
            provider: 'gemini',
            geminiModel: 'pro-preview',
            context: {
              placeName,
              layer: 'overall',
              biome: site?.biome,
              rainfallMm: site?.rainfallMm,
            },
          });
        }
        setResultImage(image.startsWith('data:') ? image : `data:image/jpeg;base64,${image}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Render failed.');
      } finally {
        setLoading(null);
      }
    },
    [state, frame, refLayers, site, placeName],
  );

  const handleDownload = useCallback(() => {
    if (!resultImage) return;
    const img = new Image();
    img.onload = () => {
      const canvas = canvasRef.current ?? document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(img, 0, 0);
      const link = document.createElement('a');
      link.download = `imbewu-design-${placeName ?? 'site'}.png`.replace(/[^a-z0-9.\-]+/gi, '_');
      link.href = canvas.toDataURL('image/png');
      link.click();
    };
    img.src = resultImage;
  }, [resultImage, placeName]);

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        overflowY: 'auto',
        background: PAPER,
        color: DARK,
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {!resultImage && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ fontSize: 14, lineHeight: 1.5, opacity: 0.85 }}>
            Generate an artist&apos;s impression of your exact design. The AI can only repaint the
            background — every item, zone, and line you placed stays locked in place.
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              onClick={() => generate('gemini')}
              disabled={loading !== null}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                minHeight: 44,
                padding: '10px 18px',
                borderRadius: 12,
                border: 'none',
                background: GOLD,
                color: DARK,
                fontWeight: 700,
                opacity: loading && loading !== 'gemini' ? 0.5 : 1,
              }}
            >
              <Sparkles size={18} />
              {loading === 'gemini' ? 'Generating…' : 'Gemini (fast)'}
            </button>
            <button
              onClick={() => generate('falgpt')}
              disabled={loading !== null}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                minHeight: 44,
                padding: '10px 18px',
                borderRadius: 12,
                border: `2px solid ${GREEN}`,
                background: 'transparent',
                color: GREEN,
                fontWeight: 700,
                opacity: loading && loading !== 'falgpt' ? 0.5 : 1,
              }}
            >
              <Gem size={18} />
              {loading === 'falgpt' ? 'Generating… 30–90s' : 'GPT-2 strict (best)'}
            </button>
          </div>
          {error && <p style={{ color: '#B53A3A', fontSize: 13 }}>{error}</p>}
        </div>
      )}

      {resultImage && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div
            style={{
              border: `4px solid ${GOLD}`,
              borderRadius: 16,
              overflow: 'hidden',
              background: DARK,
            }}
          >
            <div style={{ padding: '10px 14px', background: DARK, color: GOLD, fontWeight: 700, fontSize: 14 }}>
              {placeName ?? 'Your design'}
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={resultImage} alt="AI artist's impression of the design" style={{ width: '100%', display: 'block' }} />
            <div style={{ padding: '10px 14px', background: DARK, color: PAPER, fontSize: 12, opacity: 0.75 }}>
              AI artist&apos;s impression of YOUR design — the canvas is the exact version.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              onClick={handleDownload}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                minHeight: 44,
                padding: '10px 18px',
                borderRadius: 12,
                border: 'none',
                background: GREEN,
                color: PAPER,
                fontWeight: 700,
              }}
            >
              <Download size={18} />
              Download
            </button>
            <button
              onClick={() => {
                setResultImage(null);
                setError(null);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                minHeight: 44,
                padding: '10px 18px',
                borderRadius: 12,
                border: `1px solid ${DARK}33`,
                background: 'transparent',
                color: DARK,
                fontWeight: 600,
              }}
            >
              <RefreshCw size={16} />
              Regenerate
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
