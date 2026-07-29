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
  | 'diverter'
  | 'vetiver-bank'
  | 'half-moon'
  | 'berm'
  | 'terrace'
  | 'unknown-water';

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
  shell.addColorStop(0, '#D5F0F3');
  shell.addColorStop(0.32, '#66B9D0');
  shell.addColorStop(0.72, '#197FA3');
  shell.addColorStop(1, '#0B425B');
  finish(ctx, shell, '#082F43', stroke * 1.15);
  ctx.restore();
  for (const scale of [0.78, 0.56]) {
    ellipse(ctx, 0, 0, r * scale, r * scale);
    ctx.strokeStyle = scale > 0.7 ? 'rgba(235,250,249,0.9)' : 'rgba(8,62,80,0.74)';
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
  ctx.strokeStyle = 'rgba(235,250,249,0.56)';
  ctx.lineWidth = Math.max(0.55, stroke * 0.4);
  ellipse(ctx, 0, 0, Math.max(stroke, r * 0.13), Math.max(stroke, r * 0.13));
  // Keep the tank edge dark and integrated with the map; bright white rings read as halos.
  finish(ctx, '#0D5873', '#082F43', Math.max(0.7, stroke * 0.62));
}

type BasinKind = 'greywater-basin' | 'tree-basin' | 'infiltration-basin';

function basin(ctx: CanvasRenderingContext2D, w: number, h: number, stroke: number, seed: number, kind: BasinKind): void {
  const radius = Math.min(w, h) * 0.42;
  ellipse(ctx, 0, 0, radius, radius * 0.82);
  const earth = ctx.createRadialGradient(-radius * 0.18, -radius * 0.2, radius * 0.08, 0, 0, radius);
  earth.addColorStop(0, '#B4A16F');
  earth.addColorStop(0.58, '#816D47');
  earth.addColorStop(1, '#4C4631');
  ctx.fillStyle = earth;
  ctx.fill();
  ctx.strokeStyle = '#D0BD8E';
  ctx.lineWidth = stroke;
  ctx.stroke();

  if (kind === 'tree-basin') {
    // A tree basin is a mulch moat around a raised centre mound, never a tree in a wet dish.
    ellipse(ctx, 0, 0, radius * 0.72, radius * 0.52);
    finish(ctx, '#5B4A32', '#3D3528', Math.max(0.65, stroke * 0.58));
    ellipse(ctx, 0, 0, radius * 0.39, radius * 0.31);
    const mound = ctx.createRadialGradient(-radius * 0.1, -radius * 0.1, 1, 0, 0, radius * 0.4);
    mound.addColorStop(0, '#A7A06A');
    mound.addColorStop(1, '#657047');
    finish(ctx, mound, '#C4B17F', Math.max(0.6, stroke * 0.52));
    for (let i = 0; i < 14; i += 1) {
      const angle = hash(seed, i) * TAU;
      const distance = radius * (0.46 + hash(seed, 30 + i) * 0.16);
      ctx.beginPath();
      ctx.arc(Math.cos(angle) * distance, Math.sin(angle) * distance * 0.72, Math.max(0.55, stroke * 0.34), 0, TAU);
      ctx.fillStyle = i % 2 ? '#B39866' : '#78613E';
      ctx.fill();
    }
    return;
  }

  ellipse(ctx, 0, 0, radius * 0.7, radius * 0.5);
  if (kind === 'greywater-basin') {
    const mulch = ctx.createRadialGradient(-radius * 0.12, -radius * 0.12, 1, 0, 0, radius * 0.72);
    mulch.addColorStop(0, '#77855A');
    mulch.addColorStop(0.55, '#5E6642');
    mulch.addColorStop(1, '#4B4430');
    finish(ctx, mulch, '#B79B68', Math.max(0.65, stroke * 0.58));
  } else {
    const dish = ctx.createLinearGradient(-radius, -radius, radius, radius);
    dish.addColorStop(0, '#A9B783');
    dish.addColorStop(0.55, '#718B6E');
    dish.addColorStop(1, '#55706A');
    finish(ctx, dish, '#506552', Math.max(0.65, stroke * 0.58));
    ctx.save();
    ctx.setLineDash([Math.max(1.2, stroke), Math.max(1, stroke * 0.8)]);
    ellipse(ctx, 0, 0, radius * 0.48, radius * 0.31);
    ctx.strokeStyle = 'rgba(218,226,185,0.7)';
    ctx.lineWidth = Math.max(0.55, stroke * 0.4);
    ctx.stroke();
    ctx.restore();
  }
  for (let i = 0; i < 24; i += 1) {
    const angle = hash(seed, i) * TAU;
    const distance = radius * (0.12 + hash(seed, i + 21) * 0.5);
    ctx.beginPath();
    ctx.arc(Math.cos(angle) * distance, Math.sin(angle) * distance * 0.72, Math.max(stroke * 0.34, radius * 0.028), 0, TAU);
    ctx.fillStyle = kind === 'greywater-basin'
      ? (i % 3 ? '#8E7A4F' : '#B3A16D')
      : (i % 2 ? '#7E8C60' : '#A7B27B');
    ctx.fill();
  }
  if (kind === 'greywater-basin') {
    // Short reed-like tufts signal a planted mulch basin without inventing a separate crop.
    ctx.strokeStyle = '#7FA064';
    ctx.lineWidth = Math.max(0.55, stroke * 0.36);
    for (let i = 0; i < 8; i += 1) {
      const angle = (i / 8) * TAU + hash(seed, 90 + i) * 0.2;
      const bx = Math.cos(angle) * radius * 0.42;
      const by = Math.sin(angle) * radius * 0.34;
      line(ctx, [[bx, by], [bx + Math.cos(angle) * radius * 0.18, by + Math.sin(angle) * radius * 0.18]]);
    }
  }
}

function bananaCircle(ctx: CanvasRenderingContext2D, w: number, h: number, stroke: number, seed: number): void {
  const radius = Math.min(w, h) * 0.42;
  ellipse(ctx, 0, 0, radius, radius * 0.82);
  finish(ctx, '#796243', '#433B2A', stroke);
  for (let i = 0; i < 9; i += 1) {
    const angle = (i / 9) * TAU + hash(seed, i) * 0.16;
    ctx.save();
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.ellipse(0, -radius * 0.45, radius * (0.11 + hash(seed, 30 + i) * 0.035), radius * 0.42, 0, 0, TAU);
    const leaf = ctx.createLinearGradient(0, -radius * 0.85, 0, -radius * 0.08);
    leaf.addColorStop(0, i % 2 ? '#A1B96A' : '#8AA858');
    leaf.addColorStop(1, '#3E6B3A');
    finish(ctx, leaf, '#315631', Math.max(0.55, stroke * 0.42));
    line(ctx, [[0, -radius * 0.77], [0, -radius * 0.14]]);
    ctx.restore();
  }
  ellipse(ctx, 0, 0, radius * 0.2, radius * 0.15);
  ctx.fillStyle = '#3B3327';
  ctx.fill();
  ctx.strokeStyle = '#B49A66';
  ctx.lineWidth = Math.max(0.6, stroke * 0.45);
  ctx.stroke();
  ctx.fillStyle = '#C8A970';
  for (let i = 0; i < 7; i += 1) {
    ctx.beginPath();
    ctx.arc((hash(seed, 70 + i) - 0.5) * radius * 0.25, (hash(seed, 80 + i) - 0.5) * radius * 0.18, Math.max(0.45, stroke * 0.3), 0, TAU);
    ctx.fill();
  }
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
  const alongX = w >= h;
  const cross = Math.max(1, Math.min(w, h));
  const length = Math.max(w, h);
  const bankWash = alongX
    ? ctx.createLinearGradient(0, -h / 2, 0, h / 2)
    : ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
  bankWash.addColorStop(0, '#31482E');
  bankWash.addColorStop(0.5, '#657944');
  bankWash.addColorStop(1, '#354E31');
  ctx.fillStyle = bankWash;
  ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.strokeStyle = '#9EB56A';
  ctx.lineWidth = stroke;
  ctx.strokeRect(-w / 2, -h / 2, w, h);
  const count = Math.max(5, Math.min(52, Math.round(length / Math.max(3.5, cross * 0.56))));
  for (let i = 0; i < count; i += 1) {
    const t = (i + 0.5) / count - 0.5;
    const bx = alongX ? t * w : (hash(seed, i) - 0.5) * cross * 0.12;
    const by = alongX ? (hash(seed, 40 + i) - 0.5) * cross * 0.12 : t * h;
    ctx.lineWidth = Math.max(0.6, stroke * 0.42);
    for (let blade = -3; blade <= 3; blade += 1) {
      const spread = (blade / 3) * cross * (0.34 + hash(seed, 80 + i + blade) * 0.1);
      const alongJitter = (hash(seed, 130 + i * 7 + blade) - 0.5) * cross * 0.22;
      const tipX = alongX ? bx + alongJitter : bx + spread;
      const tipY = alongX ? by + spread : by + alongJitter;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.quadraticCurveTo(
        (bx + tipX) / 2 + (alongX ? 0 : spread * 0.08),
        (by + tipY) / 2 + (alongX ? spread * 0.08 : 0),
        tipX,
        tipY,
      );
      ctx.strokeStyle = blade % 2 ? '#B0C67A' : '#789A50';
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(bx, by, Math.max(0.55, stroke * 0.38), 0, TAU);
    ctx.fillStyle = '#263D29';
    ctx.fill();
  }
}

function earthwork(ctx: CanvasRenderingContext2D, w: number, h: number, stroke: number, kind: 'half-moon' | 'berm' | 'terrace'): void {
  const dark = '#4E4937';
  const pale = '#D7C79B';
  if (kind === 'half-moon') {
    const r = Math.min(w, h) * 0.44;
    ctx.beginPath();
    ctx.arc(0, 0, r, Math.PI * 0.08, Math.PI * 0.92);
    ctx.arc(0, r * 0.18, r * 0.62, Math.PI * 0.92, Math.PI * 0.08, true);
    ctx.closePath();
    finish(ctx, '#90714A', pale, stroke);
    ctx.beginPath();
    ctx.arc(0, r * 0.08, r * 0.38, Math.PI * 0.12, Math.PI * 0.88);
    ctx.strokeStyle = '#6E8A4B';
    ctx.lineWidth = Math.max(0.7, stroke * 0.55);
    ctx.stroke();
    return;
  }

  const wash = w >= h
    ? ctx.createLinearGradient(0, -h / 2, 0, h / 2)
    : ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
  wash.addColorStop(0, kind === 'berm' ? '#9A8057' : '#796D52');
  wash.addColorStop(0.5, kind === 'berm' ? '#C1A46D' : '#A69772');
  wash.addColorStop(1, kind === 'berm' ? '#715B3D' : '#655B46');
  ctx.fillStyle = wash;
  ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.strokeStyle = pale;
  ctx.lineWidth = stroke;
  ctx.strokeRect(-w / 2, -h / 2, w, h);
  const alongX = w >= h;
  const cross = Math.min(w, h);
  const count = Math.max(2, Math.min(9, Math.floor(cross / Math.max(3, stroke * 1.8))));
  for (let i = 1; i <= count; i += 1) {
    const offset = -cross / 2 + (i / (count + 1)) * cross;
    ctx.beginPath();
    if (alongX) {
      ctx.moveTo(-w / 2 + 2, offset);
      ctx.lineTo(w / 2 - 2, offset);
    } else {
      ctx.moveTo(offset, -h / 2 + 2);
      ctx.lineTo(offset, h / 2 - 2);
    }
    ctx.strokeStyle = kind === 'berm' ? 'rgba(77,73,55,0.55)' : 'rgba(225,215,184,0.52)';
    ctx.lineWidth = Math.max(0.55, stroke * 0.38);
    ctx.stroke();
  }
  if (kind === 'terrace') {
    ctx.beginPath();
    if (alongX) {
      ctx.moveTo(-w / 2, 0);
      ctx.lineTo(w / 2, 0);
    } else {
      ctx.moveTo(0, -h / 2);
      ctx.lineTo(0, h / 2);
    }
    ctx.strokeStyle = dark;
    ctx.lineWidth = Math.max(1, stroke * 0.75);
    ctx.stroke();
  }
}

function unknownWater(ctx: CanvasRenderingContext2D, w: number, h: number, stroke: number): void {
  const r = Math.max(2, Math.min(w, h) * 0.16);
  ctx.beginPath();
  ctx.roundRect(-w * 0.46, -h * 0.46, w * 0.92, h * 0.92, r);
  ctx.fillStyle = 'rgba(94,145,158,0.22)';
  ctx.fill();
  ctx.strokeStyle = '#6F9DA6';
  ctx.lineWidth = stroke;
  ctx.setLineDash([stroke * 2, stroke * 1.6]);
  ctx.stroke();
  ctx.setLineDash([]);
  ellipse(ctx, 0, 0, Math.max(stroke * 1.4, r * 0.42), Math.max(stroke * 1.4, r * 0.42));
  finish(ctx, '#D9E7E4', '#315A64', Math.max(0.65, stroke * 0.55));
}

function smallHardware(ctx: CanvasRenderingContext2D, w: number, h: number, stroke: number, kind: string): void {
  const size = Math.min(w, h) * 0.28;
  const dark = '#263941';
  const pale = '#D8E6DF';
  ctx.strokeStyle = dark;
  ctx.lineWidth = stroke;
  if (kind === 'borehole') {
    ellipse(ctx, 0, 0, size * 1.12, size * 1.12);
    finish(ctx, '#D6D1BE', dark, stroke);
    ellipse(ctx, 0, 0, size * 0.52, size * 0.52);
    finish(ctx, '#355D68', pale, Math.max(0.55, stroke * 0.48));
    line(ctx, [[-size * 0.78, 0], [size * 0.78, 0]]);
    line(ctx, [[0, -size * 0.78], [0, size * 0.78]]);
    return;
  }
  if (kind === 'first-flush') {
    ctx.beginPath();
    ctx.roundRect(-size * 0.54, -size * 1.28, size * 1.08, size * 2.3, size * 0.35);
    finish(ctx, '#78949A', dark, stroke);
    ellipse(ctx, 0, -size * 1.03, size * 0.42, size * 0.18);
    finish(ctx, '#B9CFCD', pale, Math.max(0.5, stroke * 0.42));
    ellipse(ctx, 0, size * 0.78, size * 0.34, size * 0.22);
    finish(ctx, '#6D543A', '#443629', Math.max(0.5, stroke * 0.4));
    line(ctx, [[0, -size * 1.28], [0, -size * 1.65], [size * 0.82, -size * 1.65]]);
    return;
  }
  if (kind === 'pump' || kind === 'filter') {
    ctx.beginPath();
    ctx.roundRect(-size * 1.38, -size * 0.92, size * 2.76, size * 1.84, size * 0.28);
    finish(ctx, '#A59E86', dark, stroke);
    ellipse(ctx, -size * 0.52, 0, size * 0.58, size * 0.58);
    finish(ctx, '#4E7073', pale, Math.max(0.55, stroke * 0.5));
    ellipse(ctx, size * 0.62, 0, size * 0.42, size * 0.68);
    finish(ctx, '#7E9086', pale, Math.max(0.55, stroke * 0.48));
    line(ctx, [[-size * 1.38, 0], [-size * 1.78, 0]]);
    line(ctx, [[size * 1.38, 0], [size * 1.78, 0]]);
    return;
  }
  if (kind === 'greywater-outlet') {
    ctx.fillStyle = '#9A9587';
    ctx.fillRect(-size * 1.2, -size * 0.9, size * 0.65, size * 1.8);
    ctx.strokeRect(-size * 1.2, -size * 0.9, size * 0.65, size * 1.8);
    ctx.strokeStyle = '#8E6FBF';
    ctx.lineWidth = Math.max(stroke, size * 0.25);
    line(ctx, [[-size * 0.55, 0], [size * 0.55, 0], [size * 0.82, size * 0.38]]);
    ellipse(ctx, size * 0.84, size * 0.4, size * 0.2, size * 0.2);
    finish(ctx, '#C8B7D7', '#5D486D', Math.max(0.5, stroke * 0.45));
    return;
  }
  if (kind === 'diverter') {
    ctx.strokeStyle = '#8E6FBF';
    ctx.lineWidth = Math.max(stroke, size * 0.24);
    line(ctx, [[0, 0], [0, -size * 1.45]]);
    line(ctx, [[0, 0], [-size * 1.2, size * 0.85]]);
    line(ctx, [[0, 0], [size * 1.2, size * 0.85]]);
    ellipse(ctx, 0, 0, size * 0.62, size * 0.62);
    finish(ctx, '#B39AC1', '#4C3D56', stroke);
    line(ctx, [[-size * 0.36, 0], [size * 0.36, 0]]);
    return;
  }
  if (kind === 'tap') {
    // Directly overhead outdoor standpipe. The previous rectangular fallback read as a desktop
    // monitor at print size; the round valve, cross handle and offset spout remain recognisable
    // even when the painted reference asset has not loaded yet.
    ellipse(ctx, 0, 0, size * 0.82, size * 0.82);
    finish(ctx, '#287CA5', '#173F53', stroke);
    ellipse(ctx, 0, 0, size * 0.42, size * 0.42);
    finish(ctx, '#D0A45B', '#5B4528', Math.max(0.65, stroke * 0.58));
    ctx.strokeStyle = '#F1D28F';
    ctx.lineWidth = Math.max(0.8, stroke * 0.62);
    line(ctx, [[-size * 0.68, 0], [size * 0.68, 0]]);
    line(ctx, [[0, -size * 0.68], [0, size * 0.68]]);
    ctx.strokeStyle = '#173F53';
    ctx.lineWidth = Math.max(stroke, size * 0.24);
    line(ctx, [[size * 0.72, 0], [size * 1.34, 0], [size * 1.34, size * 0.62]]);
    ellipse(ctx, size * 1.34, size * 0.72, size * 0.22, size * 0.28);
    finish(ctx, '#4CA9CB', '#173F53', Math.max(0.55, stroke * 0.5));
    return;
  }
  ctx.fillStyle = '#84909a';
  ctx.lineWidth = stroke;
  ctx.fillRect(-size, -size * 0.7, size * 2, size * 1.4);
  ctx.strokeRect(-size, -size * 0.7, size * 2, size * 1.4);
  line(ctx, [[0, -size * 0.7], [0, -size * 1.45], [size * 0.65, -size * 1.45], [size * 0.65, -size * 0.95]]);
}

export function canonicalCartographicWaterId(raw: string): string {
  const key = raw.trim().toLowerCase().replace(/[_\s-]+/g, '-');
  if (/^jojo-\d+$/.test(key)) return 'jojo-tank';
  if (key === 'pond-small') return 'small-pond';
  if (key === 'tap-point') return 'tap';
  if (key === 'water-trough' || key === 'water-trough2') return 'trough';
  if (key === 'pump-filter') return 'pump';
  if (key === 'greywater-diverter') return 'diverter';
  if (key === 'mulch-bank') return 'vetiver-bank';
  if (key === 'duck-pond') return 'small-pond';
  if (key === 'other-water') return 'unknown-water';
  return key;
}

export function supportsCartographicWaterSymbol(id: string): boolean {
  return new Set([
    'jojo-tank', 'rain-barrel', 'small-pond', 'dam', 'greywater-basin', 'tree-basin',
    'infiltration-basin', 'banana-circle', 'tap', 'borehole', 'trough', 'first-flush',
    'pump', 'filter', 'greywater-outlet', 'diverter', 'vetiver-bank', 'half-moon',
    'berm', 'terrace', 'unknown-water',
  ]).has(canonicalCartographicWaterId(id));
}

/** Draw one handled symbol; returns false for unknown IDs. */
export function drawCartographicWaterSymbol(options: CartographicWaterSymbolOptions): boolean {
  const { ctx, id, width, height, outlineWidth } = options;
  if (
    !Number.isFinite(width)
    || !Number.isFinite(height)
    || !Number.isFinite(outlineWidth)
    || width <= 0
    || height <= 0
    || outlineWidth < 0
  ) return false;
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
  else if (key === 'greywater-basin' || key === 'tree-basin' || key === 'infiltration-basin') basin(ctx, width, height, outlineWidth, seed, key);
  else if (key === 'banana-circle') bananaCircle(ctx, width, height, outlineWidth, seed);
  else if (key === 'trough') trough(ctx, width, height, outlineWidth);
  else if (key === 'vetiver-bank') vetiverBank(ctx, width, height, outlineWidth, seed);
  else if (key === 'half-moon' || key === 'berm' || key === 'terrace') earthwork(ctx, width, height, outlineWidth, key);
  else if (key === 'unknown-water') unknownWater(ctx, width, height, outlineWidth);
  else if (key === 'tap' || key === 'borehole' || key === 'first-flush' || key === 'pump' || key === 'filter' || key === 'greywater-outlet' || key === 'diverter') {
    smallHardware(ctx, width, height, outlineWidth, key);
  } else smallHardware(ctx, width, height, outlineWidth, 'hardware');

  ctx.restore();
  return true;
}
