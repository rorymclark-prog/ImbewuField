import { bearingToUnitVector, type SectorModel } from '@/lib/sector';
import { presentSectorCartography } from '@/lib/sector-cartography';
import type { SunPath } from '@/lib/solar';

export const EDITORIAL_SECTOR_PAGE = { width: 1800, height: 1273, cx: 620, cy: 650, radius: 420 } as const;

/** A circle must never crop a proposed fence tip. Fit the entire saved ring uniformly, with
 * room for post marks and canopy overhang, instead of covering the circular viewport. */
export function fitEditorialSectorMap(width: number, height: number, boundary: Array<[number, number]>) {
  if (![width, height].every(n => Number.isFinite(n) && n > 0)) throw new Error('Invalid Sector image dimensions');
  const ring = boundary.length >= 3 && boundary.every(p => p.every(Number.isFinite))
    ? boundary : [[0, 0], [1, 0], [1, 1], [0, 1]];
  const xs = ring.map(p => p[0] * width), ys = ring.map(p => p[1] * height);
  const x = (Math.min(...xs) + Math.max(...xs)) / 2;
  const y = (Math.min(...ys) + Math.max(...ys)) / 2;
  const reach = Math.max(...ring.map(p => Math.hypot(p[0] * width - x, p[1] * height - y)), 1);
  const scale = EDITORIAL_SECTOR_PAGE.radius * 0.85 / reach;
  return { x: EDITORIAL_SECTOR_PAGE.cx - x * scale, y: EDITORIAL_SECTOR_PAGE.cy - y * scale,
    w: width * scale, h: height * scale, scale };
}

/** Only the three established solar facts are placed here. Intermediate hours are deliberately
 * absent: a decorative curve between those anchors is not an hourly solar-position calculation. */
export function editorialSolarAnchors(path: SunPath) {
  if (path.sunriseAzDeg == null || path.sunsetAzDeg == null || path.noonAltitudeDeg <= 0) return null;
  const point = (bearing: number, radius: number): [number, number] => {
    const [x, y] = bearingToUnitVector(bearing); return [x * radius, y * radius];
  };
  return {
    rise: point(path.sunriseAzDeg, 1), set: point(path.sunsetAzDeg, 1),
    noon: point(path.noonSide === 'S' ? 180 : 0, 1 - Math.min(90, path.noonAltitudeDeg) / 90),
  };
}

const INK = '#25291F', MUTED = '#697064';
const COLORS = { summer: '#BB7A13', winter: '#615AB1', cooling: '#207F70', cold: '#286783', berg: '#B5512E', fire: '#C4352D' };

export function paintEditorialSectorPage(ctx: CanvasRenderingContext2D, input: {
  image: CanvasImageSource; width: number; height: number; boundary: Array<[number, number]>;
  model: SectorModel; placeName?: string; attribution: string; mPerImagePx: number;
  contourNote: string; aiArtwork: boolean;
  paintMapReference: (ctx: CanvasRenderingContext2D, fit: ReturnType<typeof fitEditorialSectorMap>) => void;
}): void {
  const { width: W, height: H, cx, cy, radius: r } = EDITORIAL_SECTOR_PAGE;
  const fit = fitEditorialSectorMap(input.width, input.height, input.boundary);
  ctx.save();
  ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, W, H);
  const circle = (radius: number = r) => { ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); };
  const text = (value: string, x: number, y: number, size = 20, bold = false, color = INK) => {
    ctx.font = `${bold ? 'bold ' : ''}${size}px Arial`; ctx.fillStyle = color; ctx.fillText(value, x, y);
  };
  const lines = (value: string, x: number, y: number, width: number, size = 19, color = MUTED, gap = 25) => {
    ctx.font = `${size}px Arial`; ctx.fillStyle = color;
    let line = '';
    for (const word of value.split(/\s+/)) {
      const next = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(next).width > width) { ctx.fillText(line, x, y); y += gap; line = word; }
      else line = next;
    }
    if (line) { ctx.fillText(line, x, y); y += gap; }
    return y;
  };
  const sun = (x: number, y: number, color: string, size = 16) => {
    ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.arc(x, y, size + 8, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = color; ctx.lineWidth = 2.5;
    for (let i = 0; i < 12; i++) {
      const a = i * Math.PI / 6;
      ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * (size * .72), y + Math.sin(a) * (size * .72));
      ctx.lineTo(x + Math.cos(a) * size, y + Math.sin(a) * size); ctx.stroke();
    }
    ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, size * .53, 0, Math.PI * 2); ctx.fill();
  };
  const card = (title: string, detail: string, x: number, y: number, width: number, color: string) => {
    ctx.fillStyle = '#FFFFFF'; ctx.strokeStyle = '#D6DAD1'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(x, y, width, 66, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = color; ctx.fillRect(x, y + 5, 5, 56);
    text(title, x + 15, y + 27, 21, true);
    text(detail, x + 15, y + 51, 16, false, MUTED);
  };
  const arrow = (bearing: number, color: string, from: number, to: number) => {
    const [dx, dy] = bearingToUnitVector(bearing);
    const x = cx + dx * to, y = cy + dy * to;
    ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 15; ctx.beginPath(); ctx.moveTo(cx + dx * from, cy + dy * from); ctx.lineTo(x, y); ctx.stroke();
    ctx.strokeStyle = color; ctx.lineWidth = 8; ctx.stroke();
    ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(x - dx * 23, y - dy * 23);
    ctx.lineTo(x + dy * 16, y - dx * 16); ctx.lineTo(x - dy * 16, y + dx * 16); ctx.closePath(); ctx.fill();
  };

  // Fit the factual map first; sky geometry is a separate diagram with the same true north.
  ctx.save(); circle(); ctx.clip(); ctx.fillStyle = '#F4F6F1'; ctx.fillRect(0, 0, 1240, H);
  ctx.drawImage(input.image, fit.x, fit.y, fit.w, fit.h); input.paintMapReference(ctx,fit); ctx.restore();
  circle(r + 22); ctx.strokeStyle = '#EBEEE7'; ctx.lineWidth = 40; ctx.stroke();
  const weather = presentSectorCartography(input.model).filter(e => e.icon === 'wind' || e.icon === 'fire');
  for (const wind of input.model.namedWind.filter(w => weather.some(e => e.key === `wind:${w.id}`))) {
    const color = wind.id === 'summer_cooling' ? COLORS.cooling : wind.id === 'cold_front' ? COLORS.cold : COLORS.berg;
    ctx.beginPath(); ctx.arc(cx, cy, r + 22, (wind.bearingDeg - wind.halfWidthDeg - 90) * Math.PI / 180,
      (wind.bearingDeg + wind.halfWidthDeg - 90) * Math.PI / 180);
    ctx.strokeStyle = color; ctx.lineWidth = 40; ctx.stroke();
    arrow(wind.bearingDeg, color, r + 45, r - 78);
    const callout = wind.id === 'summer_cooling' ? { title:'Cooling breeze',x:866,y:155 }
      : wind.id === 'cold_front' ? { title:'Cold front + rain',x:60,y:1100 }
      : { title:'Berg wind',x:60,y:155 };
    card(callout.title, `${wind.fromLabel} · ${wind.season}`,callout.x,callout.y,258,color);
  }
  if (input.model.fire) {
    const fire = input.model.fire;
    for (let bearing = fire.bearingDeg - fire.halfWidthDeg; bearing <= fire.bearingDeg + fire.halfWidthDeg; bearing += 2.5) {
      const a = bearingToUnitVector(bearing), b = bearingToUnitVector(bearing + 1.7);
      ctx.strokeStyle = COLORS.fire; ctx.lineWidth = 3; ctx.beginPath();
      ctx.moveTo(cx + a[0] * (r + 50), cy + a[1] * (r + 50));
      ctx.lineTo(cx + b[0] * (r + 64), cy + b[1] * (r + 64)); ctx.stroke();
    }
  }
  for (let bearing = 0; bearing < 360; bearing += 10) {
    const [dx, dy] = bearingToUnitVector(bearing);
    ctx.strokeStyle = '#9EA697'; ctx.lineWidth = 1; ctx.beginPath();
    ctx.moveTo(cx + dx * (r + 42), cy + dy * (r + 42));
    ctx.lineTo(cx + dx * (r + (bearing % 90 === 0 ? 23 : 34)), cy + dy * (r + (bearing % 90 === 0 ? 23 : 34))); ctx.stroke();
  }
  for (const [label, bearing] of [['N', 0], ['E', 90], ['S', 180], ['W', 270]] as const) {
    const [dx, dy] = bearingToUnitVector(bearing); ctx.textAlign = 'center';
    text(label, cx + dx * (r + 22), cy + dy * (r + 22) + 10, 28, true);
  }
  ctx.textAlign = 'left';
  ctx.fillStyle = INK; ctx.beginPath(); ctx.moveTo(cx, 87); ctx.lineTo(cx - 13, 123); ctx.lineTo(cx, 116); ctx.lineTo(cx + 13, 123); ctx.closePath(); ctx.fill();
  text('true north', cx + 24, 116, 18, true, MUTED);

  let keyY = 264;
  const section = (heading: string) => {
    text(heading, 1294, keyY, 16, true, MUTED); ctx.strokeStyle = '#D6DAD1'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(1294, keyY + 13); ctx.lineTo(1748, keyY + 13); ctx.stroke(); keyY += 48;
  };
  text('02', 1294, 78, 27, true, COLORS.summer);
  ctx.font = 'bold 49px Georgia'; ctx.fillStyle = INK; ctx.fillText('Sector analysis', 1294, 135);
  lines(input.placeName ?? 'Your site', 1294, 178, 454, 22);
  text('EDITORIAL ATLAS', 1294, 220, 14, true, MUTED);
  section('SUN · COMPUTED FROM LATITUDE');
  for (const season of ['summer', 'winter'] as const) {
    const path = input.model.solar[season], anchors = editorialSolarAnchors(path), color = COLORS[season];
    const title = season === 'summer' ? 'Summer' : 'Winter';
    sun(1312, keyY - 7, color, 14);
    text(`${title} solstice`, 1345, keyY, 22, true);
    keyY = lines(anchors ? `Rises ${path.riseLabel16} ${Math.round(path.sunriseAzDeg!)}°; sets ${path.setLabel16} ${Math.round(path.sunsetAzDeg!)}°. Noon ${path.noonAltitudeDeg.toFixed(0)}° above horizon.`
      : 'Sunrise/set path unavailable at this latitude.', 1345, keyY + 26, 400, 18) + 22;
    if (!anchors) continue;
    const p = (v: [number, number]): [number, number] => [cx + v[0] * r, cy + v[1] * r];
    const rise = p(anchors.rise), set = p(anchors.set), noon = p(anchors.noon);
    // The quadratic passes through the actual noon anchor; intermediate points are schematic.
    const control = [2 * noon[0] - (rise[0] + set[0]) / 2, 2 * noon[1] - (rise[1] + set[1]) / 2];
    ctx.beginPath(); ctx.moveTo(...rise); ctx.quadraticCurveTo(control[0], control[1], ...set);
    ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 11; ctx.stroke(); ctx.strokeStyle = color; ctx.lineWidth = 4; ctx.stroke();
    for (const point of [rise, noon, set]) sun(point[0], point[1], color);
    const cardY = Math.max(165, Math.min(1100, noon[1] + (season === 'winter' ? -100 : 45)));
    card(`${title} noon · ${path.noonAltitudeDeg.toFixed(0)}° up`, `${path.noonSide === 'overhead' ? 'Overhead' : `To the ${path.noonSide === 'N' ? 'north' : 'south'}`} · solstice`, cx - 153, cardY, 306, color);
    // Endpoint cards remain outside the map so they cannot hide the proposed boundary.
    const endpointY = Math.max(250, Math.min(1005, rise[1] - 33));
    card('Sunrise', `${title} · ${path.riseLabel16} ${Math.round(path.sunriseAzDeg!)}°`, 1050, endpointY, 195, color);
    card('Sunset', `${title} · ${path.setLabel16} ${Math.round(path.sunsetAzDeg!)}°`, 10, endpointY, 195, color);
  }
  keyY += 3; section('WIND & FIRE · REGIONAL · CONFIRM ON SITE');
  const entries = weather;
  if (!entries.length) keyY = lines('Regional wind and fire directions unavailable here. Confirm locally.', 1294, keyY, 454) + 22;
  for (const entry of entries) {
    const wind = input.model.namedWind.find(w => `wind:${w.id}` === entry.key);
    const color = entry.icon === 'fire' ? COLORS.fire : wind?.id === 'summer_cooling' ? COLORS.cooling : wind?.id === 'cold_front' ? COLORS.cold : COLORS.berg;
    ctx.fillStyle = color; ctx.fillRect(1294, keyY - 15, 28, 13);
    keyY = lines(entry.label, 1345, keyY, 400, 20, INK) + 2;
    const note = wind?.season ?? input.model.fire?.seasonNote;
    if (note) keyY = lines(note, 1345, keyY, 400, 17) + 8;
  }
  section('SITE REFERENCE');
  ctx.strokeStyle = '#657B41'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(1294, keyY - 8); ctx.lineTo(1322, keyY - 8); ctx.stroke();
  for(const x of [1297,1308,1319]){ctx.beginPath();ctx.arc(x,keyY-8,2,0,Math.PI*2);ctx.fillStyle='#FFFFFF';ctx.fill();ctx.stroke();}
  text(input.boundary.length>=3 ? 'Saved proposed boundary' : 'Site boundary unavailable', 1345, keyY, 20, true); keyY += 29;
  keyY = lines(input.contourNote, 1294, keyY, 454, 17) + 12;
  keyY = lines('Detailed elevation, gradient (%) and degrees: see Terrain & Sections. Water-flow routes: see Water.', 1294, keyY, 454, 17) + 10;
  // No general design recommendations or unsourced example numbers are copied from the reference.
  const footer = `${input.aiArtwork ? 'AI illustration: check site features against the exact map. ' : ''}Schematic sun curves join computed sunrise, noon and sunset; not hourly solar tracks. Wind/fire are regional assumptions. Contours are regional DEM estimates, not surveyed levels. ${input.attribution}`;
  lines(footer, 1294, Math.max(1045, keyY), 454, 15, MUTED, 21);
  const mPerPx = input.mPerImagePx / fit.scale;
  if (Number.isFinite(mPerPx) && mPerPx > 0) {
    const wanted = 145 * mPerPx;
    const unit = 10 ** Math.floor(Math.log10(wanted));
    const metres = [1, 2, 5, 10].map(n => n * unit).filter(n => n <= wanted).at(-1)!;
    const length = metres / mPerPx;
    text('0', 45, 1184, 18, true); text(`${metres} m`, 45 + length - 30, 1184, 18, true);
    ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.strokeRect(45, 1197, length, 7);
    ctx.fillStyle = INK; ctx.fillRect(45, 1197, length / 2, 7);
  }
  text('Scale applies to the site image · compass and sun curves are diagrammatic', 45, 1239, 17, false, MUTED);
  ctx.restore();
}
