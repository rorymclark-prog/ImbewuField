'use client';

// "Import your own photo" — lets a farmer use a drone/aerial photo of their own land as the
// Design Studio's base image instead of the fetched satellite tile. v1 scope, deliberately:
//   - Two-point DISTANCE calibration (tap two points a known real-world distance apart, type
//     the metres) to derive mPerPx. NOT GPS/geo-rectification — corner-pinning this photo
//     against the real satellite tile is a substantially harder computer-vision problem and is
//     explicitly out of scope for this pass.
//   - A single rotation control, baked into the image pixels ONCE at this step (not stored as a
//     live transform) — see the CustomBaseImage doc comment in lib/design-canvas.ts for why.
//
// The canvas here is drawn at the exact same intrinsic size (DEFAULT_IMG_W x DEFAULT_IMG_H) every
// satellite-fitted CanvasFrame already uses, with the same rotate+cover-fit transform the SVG
// satellite <image> gets via preserveAspectRatio="xMidYMid slice" — so what the farmer taps on
// here is pixel-for-pixel what every renderer will later draw. That also means there is no
// separate "bake" step: canvas.toBlob() on this same canvas at "Use this photo" IS the final image.

import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, Loader2, RotateCcw, RotateCw, X } from 'lucide-react';
import { DEFAULT_IMG_W, DEFAULT_IMG_H } from '@/lib/design-canvas';
import { uploadPhoto } from '@/lib/db/queries';
import { formatDesignTranslation } from '@/lib/design-studio-i18n';
import { useLanguage } from '@/lib/i18n';

const PAPER = '#FFFEFA';
const GOLD = '#F7C97E';
const GREEN = '#1F4D2B';
const OCHRE = '#C07A1E';
const DARK = '#0B120B';

export interface BasePhotoApplyResult {
  url: string; // Storage download URL — what gets persisted
  mPerPx: number;
  previewDataUrl: string; // this device's own baked pixels, for an instant preview (no refetch)
}

interface Props {
  onApply: (result: BasePhotoApplyResult) => void;
  onClose: () => void;
}

type Point = { x: number; y: number }; // in canvas-intrinsic pixel space (0..DEFAULT_IMG_W/H)

function distancePx(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export default function BasePhotoImport({ onApply, onClose }: Props) {
  const { t } = useLanguage();
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [rotationDeg, setRotationDeg] = useState(0); // 0-359, 0 = assume already north-up
  const [points, setPoints] = useState<Point[]>([]);
  const [metres, setMetres] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Redraw the baked (rotated + cover-fit) photo plus any calibration markers whenever the
  // source image, rotation, or tapped points change.
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, DEFAULT_IMG_W, DEFAULT_IMG_H);
    if (!img) return;

    const rad = (rotationDeg * Math.PI) / 180;
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    const cos = Math.abs(Math.cos(rad));
    const sin = Math.abs(Math.sin(rad));
    const rotatedW = w * cos + h * sin;
    const rotatedH = w * sin + h * cos;
    // "Cover" fit — same idea as the SVG satellite <image>'s preserveAspectRatio="xMidYMid
    // slice": scale up until the rotated photo fully covers the frame, centred, cropping
    // whatever spills over the edges.
    const scale = Math.max(DEFAULT_IMG_W / rotatedW, DEFAULT_IMG_H / rotatedH);

    ctx.save();
    ctx.translate(DEFAULT_IMG_W / 2, DEFAULT_IMG_H / 2);
    ctx.rotate(rad);
    ctx.scale(scale, scale);
    ctx.drawImage(img, -w / 2, -h / 2, w, h);
    ctx.restore();

    // Calibration markers on top, in un-rotated canvas space (screen space), so they always sit
    // exactly where the farmer tapped regardless of the photo's rotation.
    if (points.length) {
      ctx.save();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = GOLD;
      ctx.fillStyle = GOLD;
      if (points.length === 2) {
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        ctx.lineTo(points[1].x, points[1].y);
        ctx.stroke();
      }
      for (const p of points) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(p.x, p.y, 7, 0, Math.PI * 2);
        ctx.strokeStyle = DARK;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      ctx.restore();
    }
  }, [img, rotationDeg, points]);

  useEffect(() => {
    draw();
  }, [draw]);

  function onPickFile(file: File) {
    setError('');
    if (!file.type.startsWith('image/')) {
      setError(t('designPhotoNotImage'));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => setError(t('designPhotoReadError'));
    reader.onload = (e) => {
      const image = new Image();
      image.onerror = () => setError(t('designPhotoOpenError'));
      image.onload = () => {
        setImg(image);
        setRotationDeg(0);
        setPoints([]);
        setMetres('');
      };
      image.src = e.target!.result as string;
    };
    reader.readAsDataURL(file);
  }

  function onCanvasClick(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!img) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = DEFAULT_IMG_W / rect.width;
    const scaleY = DEFAULT_IMG_H / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    setPoints((prev) => (prev.length >= 2 ? [{ x, y }] : [...prev, { x, y }]));
  }

  const metresNum = parseFloat(metres);
  const pxDist = points.length === 2 ? distancePx(points[0], points[1]) : 0;
  const calibrationReady = points.length === 2 && Number.isFinite(metresNum) && metresNum > 0 && pxDist > 1;
  const mPerPx = calibrationReady ? metresNum / pxDist : null;

  async function handleUse() {
    if (!img || !calibrationReady || !mPerPx) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    setBusy(true);
    setError('');
    try {
      const previewDataUrl = canvas.toDataURL('image/jpeg', 0.88);
      const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.88));
      if (!blob) throw new Error(t('designPhotoPrepareError'));
      const file = new File([blob], `site-photo-${Date.now()}.jpg`, { type: 'image/jpeg' });
      const url = await uploadPhoto(file, 'design-base');
      if (!url) throw new Error(t('designPhotoSaveError'));
      onApply({ url, mPerPx, previewDataUrl });
    } catch (err) {
      setError(err instanceof Error ? err.message : t('designPhotoUnknownError'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(11,18,11,0.55)',
        zIndex: 200,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 480,
          maxHeight: '92dvh',
          overflowY: 'auto',
          background: PAPER,
          borderRadius: '20px 20px 0 0',
          padding: '16px 16px 20px',
          boxShadow: '0 -4px 24px rgba(0,0,0,0.3)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ fontWeight: 800, fontSize: 15, color: DARK }}>{t('designPhotoTitle')}</div>
          <button
            type="button"
            aria-label={t('designClose')}
            onClick={onClose}
            style={{ border: 'none', background: 'transparent', color: '#6B6355', cursor: 'pointer', padding: 4 }}
          >
            <X size={20} />
          </button>
        </div>

        {!img && (
          <>
            <p style={{ fontSize: 12.5, color: '#5C5040', marginBottom: 10 }}>
              {t('designPhotoIntro')}
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              style={{ display: 'none' }}
              onChange={(e) => e.target.files?.[0] && onPickFile(e.target.files[0])}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              style={{
                width: '100%',
                minHeight: 110,
                borderRadius: 14,
                border: '1.5px dashed rgba(31,77,43,0.4)',
                background: 'rgba(31,77,43,0.04)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                color: GREEN,
                cursor: 'pointer',
              }}
            >
              <Camera size={28} />
              <span style={{ fontSize: 13, fontWeight: 700 }}>{t('designPhotoChoose')}</span>
            </button>
          </>
        )}

        {img && (
          <>
            <div style={{ position: 'relative', width: '100%', marginBottom: 10 }}>
              <canvas
                ref={canvasRef}
                width={DEFAULT_IMG_W}
                height={DEFAULT_IMG_H}
                onClick={onCanvasClick}
                style={{
                  width: '100%',
                  height: 'auto',
                  aspectRatio: `${DEFAULT_IMG_W} / ${DEFAULT_IMG_H}`,
                  borderRadius: 12,
                  border: `1px solid ${GOLD}`,
                  cursor: 'crosshair',
                  display: 'block',
                }}
              />
            </div>

            {/* Rotation */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: DARK, marginBottom: 4 }}>
                {t('designPhotoNorth')}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  type="button"
                  aria-label={t('designPhotoRotateLeft')}
                  onClick={() => setRotationDeg((r) => (r + 270) % 360)}
                  style={rotateBtnStyle}
                >
                  <RotateCcw size={16} />
                </button>
                <input
                  type="range"
                  min={0}
                  max={359}
                  value={rotationDeg}
                  onChange={(e) => setRotationDeg(Number(e.target.value))}
                  style={{ flex: 1 }}
                  aria-label={t('designPhotoFineRotation')}
                />
                <button
                  type="button"
                  aria-label={t('designPhotoRotateRight')}
                  onClick={() => setRotationDeg((r) => (r + 90) % 360)}
                  style={rotateBtnStyle}
                >
                  <RotateCw size={16} />
                </button>
              </div>
              <div style={{ fontSize: 11, color: '#8C7A62', marginTop: 2 }}>
                {rotationDeg === 0
                  ? t('designPhotoNotTurned')
                  : formatDesignTranslation(t('designPhotoTurned'), { degrees: rotationDeg })}
              </div>
            </div>

            {/* Scale calibration */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: DARK, marginBottom: 4 }}>
                {t('designPhotoSetScale')}
              </div>
              <div style={{ fontSize: 11.5, color: '#5C5040', marginBottom: 6 }}>
                {t('designPhotoScaleHelp')} {points.length === 0 && t('designPhotoFirstPoint')}
                {points.length === 1 && t('designPhotoSecondPoint')}
                {points.length === 2 && t('designPhotoEnterDistance')}
              </div>
              {points.length === 2 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.1"
                    placeholder={t('designPhotoDistanceExample')}
                    value={metres}
                    onChange={(e) => setMetres(e.target.value)}
                    style={{
                      width: 90,
                      padding: '8px 10px',
                      borderRadius: 10,
                      border: '1px solid #E2D8C4',
                      fontSize: 14,
                    }}
                  />
                  <span style={{ fontSize: 13, color: '#5C5040' }}>{t('designPhotoMetresApart')}</span>
                  <button
                    type="button"
                    onClick={() => { setPoints([]); setMetres(''); }}
                    style={{ marginLeft: 'auto', border: 'none', background: 'transparent', color: OCHRE, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                  >
                    {t('designPhotoRetap')}
                  </button>
                </div>
              )}
            </div>

            {error && <p style={{ fontSize: 12, color: OCHRE, marginBottom: 8 }}>{error}</p>}

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={() => { setImg(null); setPoints([]); setMetres(''); setRotationDeg(0); }}
                style={{ flex: 1, padding: '10px 12px', borderRadius: 12, border: '1px solid #E2D8C4', background: PAPER, color: '#5C5040', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
              >
                {t('designPhotoChooseDifferent')}
              </button>
              <button
                type="button"
                disabled={!calibrationReady || busy}
                onClick={handleUse}
                style={{
                  flex: 1,
                  padding: '10px 12px',
                  borderRadius: 12,
                  border: 'none',
                  background: calibrationReady && !busy ? GREEN : 'rgba(226,216,196,0.6)',
                  color: calibrationReady && !busy ? PAPER : '#8C7A62',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: calibrationReady && !busy ? 'pointer' : 'default',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                {busy ? <><Loader2 size={14} className="animate-spin" /> {t('designPhotoSaving')}</> : t('designPhotoUse')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const rotateBtnStyle: React.CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 18,
  border: '1px solid #E2D8C4',
  background: '#FFFEFA',
  color: '#1F4D2B',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  flexShrink: 0,
};
