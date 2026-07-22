/**
 * Small, deterministic top-down symbols for water and greywater features.
 * The caller must translate the canvas origin to the item's centre.
 */

export type CartographicWaterSymbolId =
  | 'jojo-tank'
  | 'rain-barrel'
  | 'small-pond'
  | 'dam'
  | 'greywater-basin'
  | 'tree-basin'
  | 'infiltration-basin'
  | 'banana-circle'
  | 'tap'
  | 'borehole'
  | 'trough'
  | 'first-flush'
  | 'pump'
  | 'filter'
  | 'greywater-outlet'
  | 'diverter';

export interface CartographicWaterSymbolOptions {
  ctx: CanvasRenderingContext2D;
  id: string;
  width: number;
  height: number;
  outlineWidth: number;
  seed?: number;
}

const TAU = Math.PI * 2;

function hash(seed: number, index: number): number {
  let value = (Math.imul(seed | 0, 1664525) + 1013904223 + index * 374761393) | 0;
  value ^= value >>> 16;
  return (value >>> 0) / 4294967296;
}

function ellipse(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number): void {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
}

function line(ctx: CanvasRenderingContext2D, points: Array<[number, number]>): void {
  ctx.beginPath();
  points.forEach(([x, y], index) => index ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
  ctx.stroke();
}

function finish(ctx: CanvasRenderingContext2D, fill: string | CanvasGradient | CanvasPattern, stroke: string, width: number): void {
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = width;
  ctx.stroke();
}

function tank(ctx: CanvasRenderingContext2D, w: number, h: number, stroke: number): void {
  const r = Math.min(w, h) * 0.46;
  ctx.save();
  ctx.shadowColor = 'rgba(17,35,38,0.34)';
  ctx.shadowBlur = Math.max(1.5, r * 0.16);
  ctx.shadowOffsetX = Math.max(0.8, r * 0.06);
  ctx.shadowOffsetY = Math.max(0.8, r * 0.08);
  ellipse(ctx, 0, 0, r, r);
  const shell = ctx.createRadialGradient(-r * 0.28, -r * 0.3, r * 0.05, 0, 0, r);
  shell.addColorStop(0, '#B7D8DF');
  shell.addColorStop(0.34, '#5FA0B6');
  shell.addColorStop(0.76, '#37788F');
  shell.addColorStop(1, '#1D4B5B');
  finish(ctx, shell, '#173F4A', stroke);
  ctx.restore();
  for (const scale of [0.78, 0.56]) {
    ellipse(ctx, 0, 0, r * scale, r * scale);
    ctx.strokeStyle = scale > 0.7 ? 'rgba(219,239,239,0.72)' : 'rgba(25,71,82,0.62)';
    ctx.lineWidth = Math.max(0.7, stroke * 0.58);
    ctx.stroke();
  }
  for (let i = 0; i < 12; i += 1) {
    const angle = (i / 12) * TAU;
    line(ctx, [
      [Math.cos(angle) * r * 0.58, Math.sin(angle) * r * 0.58],
      [Math.cos(angle) * r * 0.88, Math.sin(angle) * r * 0.88],
    ]);
  }
  ctx.strokeStyle = 'rgba(219,239,239,0.38)';
  ctx.lineWidth = Math.max(0.55, stroke * 0.4);
  ellipse(ctx, 0, 0, Math.max(stroke, r * 0.13), Math.max(stroke, r * 0.13));
  finish(ctx, '#234F5E', '#D9EAEB', Math.max(0.65, stroke * 0.55));
}

function basin(ctx: CanvasRenderingContext2D, w: number, h: number, stroke: number, seed: number, water: boolean): void {
  const radius = Math.min(w, h) * 0.42;
  ellipse(ctx, 0, 0, radius, radius * 0.82);
  const earth = ctx.createRadialGradient(-radius * 0.18, -radius * 0.2, radius * 0.08, 0, 0, radius);
  earth.addColorStop(0, water ? '#A7CFD1' : '#A9A56A');
  earth.addColorStop(0.58, water ? '#6E9DA5' : '#697F45');
  earth.addColorStop(1, water ? '#466D72' : '#4B5434');
  ctx.fillStyle = earth;
  ctx.fill();
  ctx.strokeStyle = '#405037';
  ctx.lineWidth = stroke;
  ctx.stroke();
  if (water) {
    ellipse(ctx, 0, 0, radius * 0.68, radius * 0.48);
    const pool = ctx.createLinearGradient(-radius, -radius, radius, radius);
    pool.addColorStop(0, '#B9DEDF');
    pool.addColorStop(0.55, '#6BA4AE');
    pool.addColorStop(1, '#3E7F91');
    ctx.fillStyle = pool;
    ctx.fill();
    ctx.strokeStyle = '#356978';
    ctx.lineWidth = stroke * 0.7;
    ctx.stroke();
    for (const scale of [0.42, 0.7]) {
      ctx.beginPath();
      ctx.ellipse(-radius * 0.08, radius * 0.02, radius * scale, radius * scale * 0.48, 0, Math.PI * 0.15, Math.PI * 0.82);
      ctx.strokeStyle = 'rgba(224,244,238,0.62)';
      ctx.lineWidth = Math.max(0.65, stroke * 0.42);
      ctx.stroke();
    }
    return;
  }
  ctx.fillStyle = '#B7C37B';
  for (let i = 0; i < 22; i += 1) {
    const angle = hash(seed, i) * TAU;
    const distance = radius * (0.18 + hash(seed, i + 21) * 0.58);
    ctx.beginPath();
    ctx.arc(Math.cos(angle) * distance, Math.sin(angle) * distance * 0.78, Math.max(stroke * 0.6, radius * 0.06), 0, TAU);
    ctx.fill();
  }
}

function bananaCircle(ctx: CanvasRenderingContext2D, w: number, h: number, stroke: number, seed: number): void {
  const radius = Math.min(w, h) * 0.42;
  ellipse(ctx, 0, 0, radius, radius * 0.82);
  finish(ctx, '#80734b', '#4a432d', stroke);
  ctx.strokeStyle = '#4f783b';
  ctx.lineWidth = Math.max(stroke, radius * 0.05);
  for (let i = 0; i < 10; i += 1) {
    const angle = (i / 10) * TAU + hash(seed, i) * 0.18;
    const inner = radius * 0.15;
    const outer = radius * (0.58 + hash(seed, i + 30) * 0.12);
    line(ctx, [[Math.cos(angle) * inner, Math.sin(angle) * inner * 0.82], [Math.cos(angle) * outer, Math.sin(angle) * outer * 0.82]]);
  }
  ctx.fillStyle = '#354c2d';
  ctx.beginPath();
  ctx.arc(0, 0, Math.max(stroke, radius * 0.08), 0, TAU);
  ctx.fill();
}

function pond(ctx: CanvasRenderingContext2D, w: number, h: number, stroke: number, seed: number): void {
  const rx = w * 0.46;
  const ry = h * 0.44;
  const trace = (scale = 1) => {
    ctx.beginPath();
    for (let i = 0; i < 28; i += 1) {
      const angle = (i / 28) * TAU;
      const wobble = 0.88 + hash(seed, i) * 0.12;
      const x = Math.cos(angle) * rx * wobble * scale;
      const y = Math.sin(angle) * ry * wobble * scale;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
  };
  trace();
  ctx.shadowColor = 'rgba(29,51,47,0.34)';
  ctx.shadowBlur = Math.max(2, Math.min(w, h) * 0.08);
  const water = ctx.createRadialGradient(-rx * 0.25, -ry * 0.3, 1, 0, 0, Math.max(rx, ry));
  water.addColorStop(0, '#B3D9D7');
  water.addColorStop(0.48, '#5B9CAC');
  water.addColorStop(1, '#2F6E79');
  ctx.fillStyle = water;
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = '#D8C99F';
  ctx.lineWidth = stroke * 1.2;
  ctx.stroke();
  for (const scale of [0.36, 0.62]) {
    ctx.beginPath();
    ctx.ellipse(-rx * 0.08, ry * 0.03, rx * scale, ry * scale * 0.6, -0.08, Math.PI * 0.12, Math.PI * 0.88);
    ctx.strokeStyle = 'rgba(224,244,238,0.72)';
    ctx.lineWidth = Math.max(0.7, stroke * 0.5);
    ctx.stroke();
  }
  ctx.fillStyle = '#768B4F';
  for (let i = 0; i < 12; i += 1) {
    const angle = hash(seed, 80 + i) * TAU;
    const x = Math.cos(angle) * rx * (0.79 + hash(seed, 100 + i) * 0.12);
    const y = Math.sin(angle) * ry * (0.79 + hash(seed, 120 + i) * 0.12);
    ctx.beginPath();
    ctx.arc(x, y, Math.max(0.7, stroke * 0.65), 0, TAU);
    ctx.fill();
  }
}

function trough(ctx: CanvasRenderingContext2D, w: number, h: number, stroke: number): void {
  const r = Math.max(1, Math.min(w, h) * 0.16);
  ctx.beginPath();
  ctx.roundRect(-w * 0.46, -h * 0.46, w * 0.92, h * 0.92, r);
  finish(ctx, '#9A9C96', '#303C3D', stroke);
  ctx.beginPath();
  ctx.roundRect(-w * 0.35, -h * 0.35, w * 0.7, h * 0.7, r * 0.65);
  const water = ctx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2);
  water.addColorStop(0, '#B5D8D6');
  water.addColorStop(1, '#4E91A1');
  ctx.fillStyle = water;
  ctx.fill();
  ctx.strokeStyle = '#DCE7DF';
  ctx.lineWidth = Math.max(0.6, stroke * 0.5);
  ctx.stroke();
}

function vetiverBank(ctx: CanvasRenderingContext2D, w: number, h: number, stroke: number, seed: number): void {
  ctx.fillStyle = '#6E5A37';
  ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.strokeStyle = '#D9C899';
  ctx.lineWidth = stroke;
  ctx.strokeRect(-w / 2, -h / 2, w, h);
  const alongX = w >= h;
  const length = alongX ? w : h;
  const count = Math.max(4, Math.min(34, Math.round(length / Math.max(3, stroke * 2.2))));
  for (let i = 0; i < count; i += 1) {
    const t = (i + 0.5) / count - 0.5;
    const bx = alongX ? t * w : (hash(seed, i) - 0.5) * w * 0.26;
    const by = alongX ? (hash(seed, 40 + i) - 0.5) * h * 0.28 : t * h;
    const tuft = Math.min(w, h) * (0.34 + hash(seed, 80 + i) * 0.12);
    ctx.strokeStyle = i % 2 ? '#A9BD67' : '#789A4A';
    ctx.lineWidth = Math.max(0.65, stroke * 0.48);
    for (let blade = -2; blade <= 2; blade += 1) {
      ctx.beginPath();
      ctx.moveTo(bx, by);
      if (alongX) ctx.lineTo(bx + blade * tuft * 0.1, by - tuft + Math.abs(blade) * tuft * 0.08);
      else ctx.lineTo(bx - tuft + Math.abs(blade) * tuft * 0.08, by + blade * tuft * 0.1);
      ctx.stroke();
    }
  }
}

function smallHardware(ctx: CanvasRenderingContext2D, w: number, h: number, stroke: number, kind: string): void {
  const size = Math.min(w, h) * 0.28;
  ctx.fillStyle = kind === 'tap' ? '#8eb4be' : '#84909a';
  ctx.strokeStyle = '#263941';
  ctx.lineWidth = stroke;
  ctx.fillRect(-size, -size * 0.7, size * 2, size * 1.4);
  ctx.strokeRect(-size, -size * 0.7, size * 2, size * 1.4);
  line(ctx, [[0, -size * 0.7], [0, -size * 1.45], [size * 0.65, -size * 1.45], [size * 0.65, -size * 0.95]]);
  if (kind === 'tap') {
    ctx.fillStyle = '#d2e6e5';
    ctx.beginPath();
    ctx.arc(0, size * 0.75, Math.max(stroke, size * 0.18), 0, TAU);
    ctx.fill();
  }
}

export function canonicalCartographicWaterId(raw: string): string {
  const key = raw.toLowerCase().replace(/[_ ]+/g, '-');
  if (/^jojo-\d+$/.test(key)) return 'jojo-tank';
  if (key === 'pond-small') return 'small-pond';
  if (key === 'tap-point') return 'tap';
  if (key === 'water-trough' || key === 'water-trough2') return 'trough';
  if (key === 'pump-filter') return 'pump';
  if (key === 'greywater-diverter') return 'diverter';
  if (key === 'mulch-bank') return 'vetiver-bank';
  return key;
}

export function supportsCartographicWaterSymbol(id: string): boolean {
  return new Set([
    'jojo-tank', 'rain-barrel', 'small-pond', 'dam', 'greywater-basin', 'tree-basin',
    'infiltration-basin', 'banana-circle', 'tap', 'borehole', 'trough', 'first-flush',
    'pump', 'filter', 'greywater-outlet', 'diverter', 'vetiver-bank',
  ]).has(canonicalCartographicWaterId(id));
}

/** Draw one handled symbol; returns false for unknown IDs. */
export function drawCartographicWaterSymbol(options: CartographicWaterSymbolOptions): boolean {
  const { ctx, id, width, height, outlineWidth } = options;
  if (!(width > 0) || !(height > 0) || !Number.isFinite(outlineWidth)) return false;
  const key = canonicalCartographicWaterId(id);
  if (!supportsCartographicWaterSymbol(key)) return false;

  const seed = Number.isFinite(options.seed) ? options.seed as number : 0;
  const inset = Math.max(0, outlineWidth * 0.5);
  ctx.save();
  ctx.beginPath();
  ctx.rect(-width / 2 + inset, -height / 2 + inset, Math.max(0, width - inset * 2), Math.max(0, height - inset * 2));
  ctx.clip();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  if (key === 'jojo-tank' || key === 'rain-barrel') tank(ctx, width, height, outlineWidth);
  else if (key === 'small-pond' || key === 'dam') pond(ctx, width, height, outlineWidth, seed);
  else if (key === 'greywater-basin' || key === 'tree-basin' || key === 'infiltration-basin') basin(ctx, width, height, outlineWidth, seed, false);
  else if (key === 'banana-circle') bananaCircle(ctx, width, height, outlineWidth, seed);
  else if (key === 'trough') trough(ctx, width, height, outlineWidth);
  else if (key === 'vetiver-bank') vetiverBank(ctx, width, height, outlineWidth, seed);
  else if (key === 'tap' || key === 'borehole') smallHardware(ctx, width, height, outlineWidth, key);
  else smallHardware(ctx, width, height, outlineWidth, 'hardware');

  ctx.restore();
  return true;
}
