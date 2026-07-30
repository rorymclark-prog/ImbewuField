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
  /** The satellite currently under the design, shown BEHIND the photo while it is being lined
   *  up. Without it "line it up" had nothing to line up against — the photo replaced the view
   *  it was meant to be registered to, so the farmer was matching it from memory
   *  (Rory: "we should be able to make the drons image translucent while we line it up"). */
  satDataUrl?: string | null;
}

type Point = { x: number; y: number }; // in canvas-intrinsic pixel space (0..DEFAULT_IMG_W/H)

function distancePx(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export default function BasePhotoImport({ onApply, onClose, satDataUrl = null }: Props) {
  const { t } = useLanguage();
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [rotationDeg, setRotationDeg] = useState(0); // 0-359, 0 = assume already north-up
  // Alignment controls. Opacity defaults part-way so the satellite shows through the moment the
  // photo lands — the farmer should not have to discover the slider to see what they are aiming at.
  const [photoOpacity, setPhotoOpacity] = useState(0.65);
  const [zoom, setZoom] = useState(1); // multiplier on the cover-fit scale
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 }); // canvas-space pixels
  const [satImg, setSatImg] = useState<HTMLImageElement | null>(null);
  const dragRef = useRef<{ x: number; y: number; panX: number; panY: number; moved: boolean } | null>(null);
  // The SHEET's own position. It opens docked to the bottom; dragging the title bar lifts it so
  // the farmer can see the part of the map they are matching against, and so a short viewport
  // cannot park a control out of reach (Rory: "i cant reach the scale make its so we can move the
  // modal"). Distinct from `pan`, which moves the PHOTO inside the canvas.
  // Placing a scale point is its own MODE, not a gesture guess. Sharing the canvas between
  // "drag to move" and "tap to place" sounded clean and is wrong in the hand: aiming a point
  // precisely means resting a finger and nudging, and a nudge is a drag — so the photo slid out
  // from under the point the farmer was trying to set (Rory: "theres no easy way to add the scale
  // point there must be a button and a undo bitton").
  const [pointMode, setPointMode] = useState(false);
  const [sheetOffset, setSheetOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const sheetDragRef = useRef<{ x: number; y: number; offX: number; offY: number } | null>(null);
  const [points, setPoints] = useState<Point[]>([]);
  const [metres, setMetres] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // The satellite the design currently sits on, decoded once so draw() can paint it behind the
  // photo. Failure is not an error state: without it the aligner simply has no backdrop, which is
  // exactly how this screen behaved before.
  useEffect(() => {
    if (!satDataUrl) { setSatImg(null); return; }
    const image = new Image();
    image.onload = () => setSatImg(image);
    image.onerror = () => setSatImg(null);
    image.src = satDataUrl;
  }, [satDataUrl]);

  // Redraw the baked (rotated + cover-fit) photo plus any calibration markers whenever the
  // source image, rotation, or tapped points change.
  // `forExport` is not a nicety — it is what keeps the SAVED image clean. handleUse bakes this
  // very canvas straight to JPEG, so anything drawn for the farmer's benefit is drawn into their
  // permanent base: the satellite backdrop would ghost through their photo forever, and the two
  // gold calibration dots and the line between them were being burnt in on every single import
  // (calibrationReady requires two points, so they were ALWAYS present at bake time) and then
  // reprinted on every plan sheet.
  const draw = useCallback((forExport = false) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, DEFAULT_IMG_W, DEFAULT_IMG_H);

    // Backdrop: the satellite the design is registered to, so "line it up" has something to line
    // up against. Screen only.
    if (!forExport && satImg) {
      const sw = satImg.naturalWidth || DEFAULT_IMG_W;
      const sh = satImg.naturalHeight || DEFAULT_IMG_H;
      const sScale = Math.max(DEFAULT_IMG_W / sw, DEFAULT_IMG_H / sh);
      ctx.save();
      ctx.translate(DEFAULT_IMG_W / 2, DEFAULT_IMG_H / 2);
      ctx.scale(sScale, sScale);
      ctx.drawImage(satImg, -sw / 2, -sh / 2, sw, sh);
      ctx.restore();
    }
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
    // whatever spills over the edges. The farmer's zoom rides on top of it as a multiplier, so
    // 1 is always "exactly covers" whatever the photo's own proportions are.
    const scale = Math.max(DEFAULT_IMG_W / rotatedW, DEFAULT_IMG_H / rotatedH) * zoom;

    ctx.save();
    // Translucent while aligning, fully opaque in the saved pixels — the farmer is adjusting how
    // they SEE it, never what gets stored.
    if (!forExport) ctx.globalAlpha = photoOpacity;
    ctx.translate(DEFAULT_IMG_W / 2 + pan.x, DEFAULT_IMG_H / 2 + pan.y);
    ctx.rotate(rad);
    ctx.scale(scale, scale);
    ctx.drawImage(img, -w / 2, -h / 2, w, h);
    ctx.restore();

    if (forExport) return;

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
  }, [img, rotationDeg, points, satImg, photoOpacity, zoom, pan]);

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
    setPoints((prev) => {
      if (prev.length >= 2) return prev; // full — Undo is how you change one, not a silent reset
      const next = [...prev, { x, y }];
      // Disarm once both are down, so the farmer is immediately back to adjusting the photo
      // without having to notice a mode is still on.
      if (next.length === 2) setPointMode(false);
      return next;
    });
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
      // Repaint WITHOUT the backdrop, the translucency or the calibration markers before the
      // canvas is read. Both reads below take this same canvas, so anything on it at this instant
      // is what the farmer is stuck with on every plan sheet from now on.
      draw(true);
      const previewDataUrl = canvas.toDataURL('image/jpeg', 0.88);
      const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.88));
      // Put the working view back, so a failed upload leaves the farmer where they were rather
      // than staring at an opaque photo with their alignment markers gone.
      draw();
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
          transform: `translate(${sheetOffset.x}px, ${sheetOffset.y}px)`,
          touchAction: 'pan-y',
        }}
      >
        <div
          // The title bar is the handle. Dragging it moves the sheet; the close button inside it
          // stops propagation so a tap on ✕ is never read as the start of a drag.
          onPointerDown={(e) => {
            (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
            sheetDragRef.current = { x: e.clientX, y: e.clientY, offX: sheetOffset.x, offY: sheetOffset.y };
          }}
          onPointerMove={(e) => {
            const d = sheetDragRef.current;
            if (!d) return;
            // Clamped so the sheet can never be dragged entirely off screen and stranded — the
            // handle always stays reachable, which is the whole point of being able to move it.
            const maxUp = Math.max(0, window.innerHeight - 120);
            setSheetOffset({
              x: d.offX + (e.clientX - d.x),
              y: Math.min(120, Math.max(-maxUp, d.offY + (e.clientY - d.y))),
            });
          }}
          onPointerUp={() => { sheetDragRef.current = null; }}
          onPointerCancel={() => { sheetDragRef.current = null; }}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, cursor: 'grab', touchAction: 'none' }}
        >
          <div style={{ fontWeight: 800, fontSize: 15, color: DARK }}>
            {t('designPhotoTitle')}
            <span style={{ fontWeight: 600, fontSize: 11, color: '#6B6355', marginLeft: 8 }}>⠿ drag to move</span>
          </div>
          <button
            type="button"
            aria-label={t('designClose')}
            onPointerDown={(e) => e.stopPropagation()}
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
                // Drag moves the photo, a tap places a calibration point. No mode switch: the two
                // gestures are already distinct, and making the farmer choose between "move" and
                // "measure" would be a toggle they have to find before the screen works.
                onPointerDown={(e) => {
                  if (!img || pointMode) return; // in point mode the photo must not move at all
                  (e.target as Element).setPointerCapture?.(e.pointerId);
                  dragRef.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y, moved: false };
                }}
                onPointerMove={(e) => {
                  const d = dragRef.current;
                  if (!d) return;
                  const canvas = canvasRef.current;
                  if (!canvas) return;
                  // Client pixels are not canvas pixels — the canvas is laid out at 100% width and
                  // its intrinsic size is fixed, so a drag must be scaled or the photo races the
                  // finger on a wide screen and lags it on a phone.
                  const k = DEFAULT_IMG_W / canvas.getBoundingClientRect().width;
                  const dx = (e.clientX - d.x) * k;
                  const dy = (e.clientY - d.y) * k;
                  if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true;
                  setPan({ x: d.panX + dx, y: d.panY + dy });
                }}
                onPointerUp={() => { dragRef.current = null; }}
                onPointerCancel={() => { dragRef.current = null; }}
                onClick={(e) => {
                  // Only ever places a point while the mode is armed, so an ordinary tap to
                  // reposition the photo can never drop a stray calibration marker.
                  if (!pointMode) return;
                  onCanvasClick(e);
                }}
                style={{
                  width: '100%',
                  height: 'auto',
                  // Capped so the photo cannot push "Set the scale" past the bottom of a short
                  // viewport. The sheet scrolls, but a farmer who cannot SEE a control does not
                  // go looking for it — and the whole screen is useless without the scale step.
                  maxHeight: '42dvh',
                  objectFit: 'contain',
                  aspectRatio: `${DEFAULT_IMG_W} / ${DEFAULT_IMG_H}`,
                  borderRadius: 12,
                  border: `1px solid ${GOLD}`,
                  cursor: !img ? 'default' : pointMode ? 'crosshair' : 'grab',
                  display: 'block',
                  touchAction: 'none', // or the browser pans the sheet instead of the photo
                }}
              />
              {img && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: DARK }}>
                    <span style={{ minWidth: 76 }}>See through</span>
                    <input
                      type="range" min={0.15} max={1} step={0.05}
                      value={photoOpacity}
                      onChange={(e) => setPhotoOpacity(Number(e.target.value))}
                      style={{ flex: 1, accentColor: GREEN }}
                    />
                    <span style={{ minWidth: 38, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>
                      {Math.round(photoOpacity * 100)}%
                    </span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: DARK }}>
                    <span style={{ minWidth: 76 }}>Size</span>
                    <input
                      type="range" min={0.25} max={4} step={0.05}
                      value={zoom}
                      onChange={(e) => setZoom(Number(e.target.value))}
                      style={{ flex: 1, accentColor: GREEN }}
                    />
                    <span style={{ minWidth: 38, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>
                      {Math.round(zoom * 100)}%
                    </span>
                  </label>
                  <div style={{ fontSize: 11.5, color: DARK, opacity: 0.7 }}>
                    {pointMode
                      ? `Tap point ${points.length + 1} of 2 on the photo. The photo will not move while you do.`
                      : 'Drag the photo to move it. Fade it down to match it against the satellite underneath.'}
                  </div>
                  {/* The scale step gets real buttons instead of an unwritten rule about which
                      gesture means what. Undo is per-point: a farmer who mis-taps the second
                      corner should not have to redo the first. */}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => setPointMode((v) => !v)}
                      aria-pressed={pointMode}
                      disabled={points.length >= 2}
                      style={{
                        flex: 1, minWidth: 140, minHeight: 44, borderRadius: 10, cursor: points.length >= 2 ? 'default' : 'pointer',
                        border: pointMode ? `2px solid ${GOLD}` : `1px solid ${GREEN}`,
                        background: pointMode ? GREEN : 'transparent',
                        color: pointMode ? PAPER : GREEN,
                        fontWeight: 800, fontSize: 12.5,
                        opacity: points.length >= 2 ? 0.45 : 1,
                      }}
                    >
                      {pointMode ? '📍 Tapping…' : `📍 Add scale point (${points.length}/2)`}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setPoints((prev) => prev.slice(0, -1)); setPointMode(false); }}
                      disabled={points.length === 0}
                      style={{
                        minHeight: 44, padding: '0 14px', borderRadius: 10,
                        border: '1px solid rgba(0,0,0,0.2)', background: 'transparent', color: DARK,
                        fontWeight: 700, fontSize: 12.5,
                        cursor: points.length ? 'pointer' : 'default',
                        opacity: points.length ? 1 : 0.4,
                      }}
                    >
                      ↩ Undo point
                    </button>
                  </div>
                </div>
              )}
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
