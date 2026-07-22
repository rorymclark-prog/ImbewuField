import type { DesignElementDef, ElementCategory } from '@/lib/design-elements';

export type CartographicSymbolElement = DesignElementDef | string | ElementCategory;

export interface CartographicSymbolOptions {
  seed?: number;
}

type SymbolKind =
  | 'chicken-tractor'
  | 'compost'
  | 'nursery'
  | 'beehive'
  | 'rabbit'
  | 'shade'
  | 'shed'
  | 'kraal'
  | 'trough'
  | 'generic-structure'
  | 'generic-animal';

const ID_KIND: Record<string, SymbolKind> = {
  chicken_tractor: 'chicken-tractor',
  chicken_coop: 'chicken-tractor',
  compost_bay: 'compost',
  nursery_table: 'nursery',
  beehive: 'beehive',
  rabbit_hutch: 'rabbit',
  shade_house: 'shade',
  greenhouse_tunnel: 'shade',
  shed: 'shed',
  kraal: 'kraal',
  water_trough: 'trough',
  water_trough2: 'trough',
};

const CATEGORY_KIND: Partial<Record<ElementCategory, SymbolKind>> = {
  structure: 'generic-structure',
  animal: 'generic-animal',
};

function kindFor(element: CartographicSymbolElement): SymbolKind | undefined {
  if (typeof element === 'object') return ID_KIND[element.id] ?? CATEGORY_KIND[element.category];
  return ID_KIND[element] ?? CATEGORY_KIND[element as ElementCategory];
}

export function supportsCartographicStructureSymbol(element: CartographicSymbolElement): boolean {
  return kindFor(element) != null;
}

function hash(seed: number, n: number): number {
  let x = (seed ^ Math.imul(n + 1, 0x45d9f3b)) | 0;
  x = Math.imul(x ^ (x >>> 16), 0x27d4eb2d);
  return ((x ^ (x >>> 15)) >>> 0) / 4294967296;
}

function rect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill: string, stroke: string, line: number) {
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = line;
  ctx.strokeRect(x, y, w, h);
}

function line(ctx: CanvasRenderingContext2D, points: Array<[number, number]>, color: string, width: number, dash: number[] = []) {
  ctx.beginPath();
  points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.setLineDash(dash);
  ctx.stroke();
  ctx.setLineDash([]);
}

function ellipse(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, fill: string, stroke: string, width: number) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = width;
  ctx.stroke();
}

function drawWoodenFrame(ctx: CanvasRenderingContext2D, w: number, h: number, lineWidth: number, seed: number) {
  rect(ctx, -w / 2, -h / 2, w, h, '#776247', '#2F3029', lineWidth);
  const boards = Math.max(2, Math.round(h / Math.max(8, w * 0.45)));
  for (let i = 1; i < boards; i++) {
    const y = -h / 2 + (h * i) / boards;
    line(ctx, [[-w / 2, y], [w / 2, y]], '#B59A70', Math.max(1, lineWidth * 0.55));
  }
  for (let i = 0; i < 4; i++) {
    const x = -w / 2 + (w * (i + 0.5)) / 4;
    line(ctx, [[x, -h / 2], [x + (hash(seed, i) - 0.5) * w * 0.12, h / 2]], '#574A38', Math.max(1, lineWidth * 0.4));
  }
}

function drawSymbol(ctx: CanvasRenderingContext2D, kind: SymbolKind, w: number, h: number, outline: number, seed: number) {
  const dark = '#30342D';
  const pale = '#E7D5A7';
  const wood = '#806645';
  const green = '#4F6E42';
  const s = Math.max(1, outline);

  switch (kind) {
    case 'chicken-tractor':
      drawWoodenFrame(ctx, w, h, s, seed);
      ctx.fillStyle = 'rgba(225,224,201,0.72)';
      ctx.fillRect(-w * 0.44, -h * 0.42, w * 0.88, h * 0.52);
      line(ctx, [[-w * 0.44, -h * 0.42], [w * 0.44, -h * 0.42]], '#D8D2B9', s * 0.8);
      line(ctx, [[-w * 0.44, h * 0.1], [w * 0.44, h * 0.1]], dark, s * 0.7, [s * 2, s * 2]);
      ellipse(ctx, -w * 0.32, h * 0.44, Math.max(s * 1.4, w * 0.08), Math.max(s * 1.4, w * 0.08), dark, dark, 1);
      ellipse(ctx, w * 0.32, h * 0.44, Math.max(s * 1.4, w * 0.08), Math.max(s * 1.4, w * 0.08), dark, dark, 1);
      break;
    case 'compost':
      for (let i = -1; i <= 1; i++) {
        ctx.save();
        ctx.translate((i * w) / 3.05, 0);
        drawWoodenFrame(ctx, w / 3.25, h * 0.9, s, seed + i + 4);
        ctx.restore();
      }
      break;
    case 'nursery':
      drawWoodenFrame(ctx, w * 0.92, h * 0.72, s, seed);
      for (let row = -1; row <= 1; row++) {
        line(ctx, [[-w * 0.36, row * h * 0.18], [w * 0.36, row * h * 0.18]], '#C0A67A', s * 0.65);
      }
      for (let i = -2; i <= 2; i++) ellipse(ctx, i * w * 0.14, 0, s * 1.7, s * 1.7, green, '#2F4932', s * 0.5);
      break;
    case 'beehive':
      drawWoodenFrame(ctx, w * 0.75, h * 0.9, s, seed);
      for (let y = -h * 0.24; y <= h * 0.24; y += h * 0.16) line(ctx, [[-w * 0.34, y], [w * 0.34, y]], pale, s * 0.7);
      rect(ctx, -w * 0.18, h * 0.24, w * 0.36, h * 0.12, '#2E3B31', '#202820', s * 0.5);
      break;
    case 'rabbit':
      drawWoodenFrame(ctx, w * 0.9, h * 0.62, s, seed);
      ctx.strokeStyle = '#B9B5A0';
      ctx.lineWidth = s * 0.65;
      for (let x = -w * 0.34; x <= w * 0.34; x += w * 0.17) line(ctx, [[x, -h * 0.29], [x, h * 0.29]], '#B9B5A0', s * 0.55);
      line(ctx, [[-w * 0.38, h * 0.32], [-w * 0.38, h * 0.48], [w * 0.38, h * 0.48], [w * 0.38, h * 0.32]], dark, s);
      break;
    case 'shade':
      rect(ctx, -w / 2, -h / 2, w, h, 'rgba(108,132,102,0.38)', dark, s);
      for (let x = -w / 2; x <= w / 2; x += Math.max(8, w / 4)) line(ctx, [[x, -h / 2], [x, h / 2]], '#B8C6A7', s * 0.55);
      for (let y = -h / 2; y <= h / 2; y += Math.max(8, h / 4)) line(ctx, [[-w / 2, y], [w / 2, y]], '#B8C6A7', s * 0.55);
      line(ctx, [[-w / 2, -h / 2], [w / 2, h / 2]], '#D7D7BE', s * 0.65);
      line(ctx, [[w / 2, -h / 2], [-w / 2, h / 2]], '#D7D7BE', s * 0.65);
      break;
    case 'shed':
      drawWoodenFrame(ctx, w * 0.88, h * 0.86, s, seed);
      line(ctx, [[-w * 0.42, -h * 0.42], [0, -h * 0.25], [w * 0.42, -h * 0.42]], '#C1A47A', s);
      rect(ctx, -w * 0.11, h * 0.12, w * 0.22, h * 0.3, '#4A4539', '#222921', s * 0.6);
      break;
    case 'kraal':
      ctx.fillStyle = 'rgba(135,109,67,0.38)';
      ctx.fillRect(-w / 2, -h / 2, w, h);
      for (let x = -w / 2; x <= w / 2; x += Math.max(8, w / 5)) line(ctx, [[x, -h / 2], [x, h / 2]], wood, s * 0.8);
      for (let y = -h / 2; y <= h / 2; y += Math.max(8, h / 5)) line(ctx, [[-w / 2, y], [w / 2, y]], wood, s * 0.8);
      rect(ctx, -w * 0.12, -h / 2, w * 0.24, s * 2, '#C2A06E', dark, s * 0.6);
      break;
    case 'trough':
      rect(ctx, -w / 2, -h / 2, w, h, '#777A73', dark, s);
      rect(ctx, -w * 0.34, -h * 0.34, w * 0.68, h * 0.68, '#9FB4A3', '#D7D5BD', s * 0.65);
      line(ctx, [[-w * 0.3, -h * 0.1], [w * 0.3, -h * 0.1]], '#D9E6D5', s * 0.55);
      break;
    case 'generic-animal':
      rect(ctx, -w / 2, -h / 2, w, h, 'rgba(154,119,70,0.45)', dark, s);
      line(ctx, [[-w / 2, -h / 2], [w / 2, h / 2]], wood, s * 0.65);
      line(ctx, [[w / 2, -h / 2], [-w / 2, h / 2]], wood, s * 0.65);
      break;
    case 'generic-structure':
      rect(ctx, -w / 2, -h / 2, w, h, 'rgba(123,96,63,0.55)', dark, s);
      line(ctx, [[-w / 2, -h / 2], [w / 2, h / 2]], '#B39A71', s * 0.55);
      line(ctx, [[w / 2, -h / 2], [-w / 2, h / 2]], '#B39A71', s * 0.55);
      break;
  }
}

/** Draws a deterministic flat, top-down structure symbol inside the current footprint. */
export function drawCartographicStructureSymbol(
  ctx: CanvasRenderingContext2D,
  element: CartographicSymbolElement,
  width: number,
  height: number,
  outlineWidth: number,
  options: CartographicSymbolOptions = {},
): boolean {
  const kind = kindFor(element);
  if (!kind || width <= 0 || height <= 0) return false;
  const seed = Number.isFinite(options.seed) ? Math.trunc(options.seed as number) : 0;
  ctx.save();
  ctx.beginPath();
  ctx.rect(-width / 2, -height / 2, width, height);
  ctx.clip();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  drawSymbol(ctx, kind, width, height, Math.max(0.5, outlineWidth), seed);
  ctx.restore();
  return true;
}
