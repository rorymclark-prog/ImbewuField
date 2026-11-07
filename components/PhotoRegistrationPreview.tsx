'use client';
import { useEffect, useRef, useState } from 'react';
import { useLanguage } from '@/lib/i18n';
import { inlineText, inlineTemplate } from '@/lib/xh-inline';

export type RegistrationPreview = { id: string; assetId: string; matrix: [number,number,number,number,number,number]; targetFrame: { imgW: number; imgH: number }; controls: { target: [number,number] }[]; rmsPixels: number; maxErrorPixels: number; note: string; limitation: string; status: string };
type PreviewDesign = { zones: { points: [number,number][] }[]; lines: { points: [number,number][] }[] };
export default function PhotoRegistrationPreview({ originalUrl, registration, design }: { originalUrl: string; registration: RegistrationPreview; design: PreviewDesign | null }) {
  const { lang } = useLanguage();
  const t = (english: string) => inlineText(lang, english);
  const canvas = useRef<HTMLCanvasElement>(null), [error, setError] = useState('');
  useEffect(() => {
    const image = new Image(); let active = true;
    image.onload = () => {
      if (!active || !canvas.current) return;
      const c = canvas.current, ctx = c.getContext('2d'); if (!ctx) { setError('Photo preview is unavailable on this device.'); return; }
      const { imgW: width, imgH: height } = registration.targetFrame;
      c.width = width; c.height = height; ctx.fillStyle = '#f5f3ef'; ctx.fillRect(0,0,width,height);
      ctx.save(); ctx.setTransform(...registration.matrix); ctx.drawImage(image,0,0); ctx.restore();
      for (const [kind, shapes] of [['zones',design?.zones ?? []],['lines',design?.lines ?? []]] as const) {
        for (const shape of shapes) {
          if (!shape.points?.length) continue;
          ctx.beginPath(); shape.points.forEach(([x,y],i) => i ? ctx.lineTo(x*width,y*height) : ctx.moveTo(x*width,y*height)); if (kind === 'zones') ctx.closePath();
          ctx.lineWidth = 4; ctx.strokeStyle = '#ffffff'; ctx.stroke(); ctx.lineWidth = 2; ctx.strokeStyle = '#134e34'; ctx.stroke();
        }
      }
      for (const { target: [x,y] } of registration.controls) { ctx.beginPath(); ctx.arc(x,y,6,0,Math.PI*2); ctx.fillStyle='#ffffff';ctx.fill();ctx.lineWidth=2;ctx.strokeStyle='#111111';ctx.stroke(); }
    };
    image.onerror = () => active && setError('The original photo could not be displayed.'); image.src = originalUrl;
    return () => { active = false; image.onload = null; image.onerror = null; image.src = ''; if (canvas.current) { canvas.current.width=1;canvas.current.height=1; } };
  }, [originalUrl, registration, design]);
  return <figure className="space-y-3 rounded-xl border p-4"><h3 className="text-lg font-semibold">{t('Historical photo registration draft')}</h3>{error && <p role="alert">{t(error)}</p>}<canvas ref={canvas} className="h-auto w-full" aria-label={t('Registered original photograph with saved design outlines and observed control points')} role="img" /><figcaption className="space-y-2"><p>{registration.note}</p><p>{inlineTemplate(lang, 'Matching error: {rms} pixels RMS; {max} pixels maximum.', null, { rms: registration.rmsPixels.toFixed(2), max: registration.maxErrorPixels.toFixed(2) })}</p><p>{t('White circles mark matched controls. Green outlines show the saved design. Empty ground stays blank.')}</p><p>{registration.limitation}</p><p className="font-semibold">{t('Needs visual review · Your current maps and saved geometry are unchanged.')}</p></figcaption></figure>;
}
