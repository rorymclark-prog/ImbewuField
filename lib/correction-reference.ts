import type { CorrectionPin } from './map-correction-pins';

/** Only selected pins are sent. The visible ring stays centred even for a pin near the page edge. */
export async function correctionReference(imageUrl: string, pins: CorrectionPin[]): Promise<string> {
  const img = new Image();
  const canvas = document.createElement('canvas');
  try {
    img.src = imageUrl;
    await img.decode();
    const scale = Math.min(1, 1400 / Math.max(img.naturalWidth, img.naturalHeight));
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('The marked illustration could not be prepared.');
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const r = Math.max(9, Math.min(canvas.width, canvas.height) / 65);
    ctx.lineWidth = 2;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = 'bold ' + Math.round(r * 1.25) + 'px sans-serif';
    pins.forEach((pin, i) => {
      const x = pin.x * canvas.width, y = pin.y * canvas.height;
      const cx = Math.max(r+2, Math.min(canvas.width-r-2, x)), cy = Math.max(r+2, Math.min(canvas.height-r-2, y-r*1.6));
      ctx.strokeStyle = '#722756'; ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(x,y); ctx.stroke();
      ctx.beginPath(); ctx.arc(x,y,4,0,2*Math.PI); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx,cy,r,0,2*Math.PI); ctx.fillStyle = '#722756'; ctx.fill();
      ctx.strokeStyle = 'white'; ctx.stroke(); ctx.fillStyle = 'white'; ctx.fillText(String(i+1),cx,cy);
    });
    return canvas.toDataURL('image/jpeg', .87);
  } finally { img.removeAttribute('src'); canvas.width = canvas.height = 1; }
}
