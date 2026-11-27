import { correctionCrop, validCorrectionFrame } from './local-map-correction';
import { correctionArea, type CorrectionPin } from './map-correction-pins';

/** Only selected pins are sent. The visible ring stays centred even for a pin near the page edge. */
export async function correctionReference(imageUrl: string, pins: CorrectionPin[], scheduleStart?: number) {
  const img = new Image();
  const canvas = document.createElement('canvas');
  try {
    img.src = imageUrl;
    await img.decode();
    const frame = {version:1 as const, width:img.naturalWidth, height:img.naturalHeight, areas:pins.map(correctionArea)};
    if (!validCorrectionFrame(frame)) throw new Error('Choose an edit area on the illustration.');
    const crop = correctionCrop(frame);
    const scale = Math.min(1, 1400 / Math.max(crop.width,crop.height));
    canvas.width = Math.max(1, Math.round(crop.width * scale));
    canvas.height = Math.max(1, Math.round(crop.height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('The marked illustration could not be prepared.');
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, crop.x, crop.y, crop.width, crop.height, 0, 0, canvas.width, canvas.height);
    const sx = canvas.width / crop.width, sy = canvas.height / crop.height;
    const xAt = (x:number) => (x*frame.width-crop.x)*sx;
    const yAt = (y:number) => (y*frame.height-crop.y)*sy;
    if (scheduleStart !== undefined) {
      // Even the context around a pin near sheet 09's edge must omit its private schedule.
      const left = Math.max(0,Math.floor(xAt(scheduleStart))-1);
      ctx.fillStyle = 'white';
      if (left < canvas.width) ctx.fillRect(left,0,canvas.width-left,canvas.height);
    }
    const clean = canvas.toDataURL('image/png');
    const r = Math.max(9, Math.min(canvas.width, canvas.height) / 65);
    ctx.lineWidth = 2;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = 'bold ' + Math.round(r * 1.25) + 'px sans-serif';
    pins.forEach((pin, i) => {
      const area = correctionArea(pin);
      ctx.save(); ctx.strokeStyle = '#722756'; ctx.setLineDash([5,4]);
      ctx.strokeRect(xAt(area.left), yAt(area.top), (area.right-area.left)*frame.width*sx, (area.bottom-area.top)*frame.height*sy);
      ctx.restore();
      const x = xAt(pin.x), y = yAt(pin.y);
      const cx = Math.max(r+2, Math.min(canvas.width-r-2, x)), cy = Math.max(r+2, Math.min(canvas.height-r-2, y-r*1.6));
      ctx.strokeStyle = '#722756'; ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(x,y); ctx.stroke();
      ctx.beginPath(); ctx.arc(x,y,4,0,2*Math.PI); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx,cy,r,0,2*Math.PI); ctx.fillStyle = '#722756'; ctx.fill();
      ctx.strokeStyle = 'white'; ctx.stroke(); ctx.fillStyle = 'white'; ctx.fillText(String(i+1),cx,cy);
    });
    return {clean, marked:canvas.toDataURL('image/jpeg', .87), frame};
  } finally { img.removeAttribute('src'); canvas.width = canvas.height = 1; }
}
