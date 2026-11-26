// These two media are painted inside a measured path. The same paths still own the edge,
// position and orientation; in particular hatch marks are texture, not extra rows or roof ridges.
export type ExactSurfaceFinish = 'wash' | 'hatch';
type Material = 'crown' | 'bed' | 'roof';

export function isExactSurfaceFinish(finish: string): finish is ExactSurfaceFinish {
  return finish === 'wash' || finish === 'hatch';
}

const PALETTE = {
  crown: { paper: 'rgba(203,222,171,.35)', pigment: '84,133,82', ink: '#486844' },
  bed: { paper: '#F1E3B7', pigment: '125,149,74', ink: '#716043' },
  roof: { paper: '#E7E8E5', pigment: '112,136,148', ink: '#515E63' },
} as const;

export function paintExactSurface(
  ctx: CanvasRenderingContext2D, path: Path2D, material: Material, finish: ExactSurfaceFinish,
  x: number, y: number, width: number, height: number,
): void {
  if (!(width > 0 && height > 0)) return;
  const palette = PALETTE[material];
  const shortSide = Math.min(width, height);
  ctx.save();
  ctx.clip(path);
  if (finish === 'wash') {
    ctx.fillStyle = palette.paper;
    ctx.fillRect(x, y, width, height);
    // Broad pigment pools merge on the paper; the gaps leave overlapping crowns readable.
    ctx.translate(x, y);
    ctx.scale(width, height);
    for (const [cx, cy, radius] of [[0.2, 0.64, 0.46], [0.72, 0.82, 0.54], [0.72, 0.2, 0.32]]) {
      const wash = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
      wash.addColorStop(0, `rgba(${palette.pigment},0.47)`);
      wash.addColorStop(0.78, `rgba(${palette.pigment},0.21)`);
      wash.addColorStop(1, `rgba(${palette.pigment},0)`);
      ctx.fillStyle = wash;
      ctx.fillRect(0, 0, 1, 1);
    }
  } else {
    if (material !== 'crown') {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(x, y, width, height);
    }
    const step = Math.max(3, shortSide / (material === 'bed' ? 5 : 9), Math.max(width, height) / 64);
    ctx.strokeStyle = material === 'roof' ? '#8D8D8D' : '#777777';
    ctx.lineWidth = Math.min(step / 5, Math.max(0.8, shortSide * 0.009));
    ctx.beginPath();
    // Opposite diagonals read distinctly where a crown overlaps a planted bed.
    for (let dx = -height; dx <= width; dx += step) {
      const top = material === 'crown' ? y + height : y;
      const bottom = material === 'crown' ? y : y + height;
      ctx.moveTo(x + dx, top);
      ctx.lineTo(x + dx + height, bottom);
    }
    ctx.stroke();
  }
  ctx.restore();
  // Stroke on the inside, so the outside of the ink is the saved, measurable footprint.
  ctx.save();
  ctx.clip(path);
  ctx.lineWidth = Math.min(shortSide * 0.14, Math.max(1.5, shortSide * 0.028));
  ctx.strokeStyle = finish === 'wash' ? palette.ink : '#303030';
  ctx.stroke(path);
  ctx.restore();
}

export function drawExactBed(
  ctx: CanvasRenderingContext2D, id: string, finish: string,
  x: number, y: number, width: number, height: number, rotation = 0,
): boolean {
  if (!isExactSurfaceFinish(finish) || (id !== 'veg_bed' && id !== 'raised_bed')) return false;
  if (!(width > 0 && height > 0) || ![x, y, width, height, rotation].every(Number.isFinite)) return false;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation * Math.PI / 180);
  const path = new Path2D();
  path.rect(-width / 2, -height / 2, width, height);
  paintExactSurface(ctx, path, 'bed', finish, -width / 2, -height / 2, width, height);
  if (id === 'raised_bed') {
    const rim = Math.min(width, height) * 0.09;
    ctx.strokeStyle = finish === 'wash' ? '#876C47' : '#575757';
    ctx.lineWidth = Math.min(rim * 0.5, 2);
    ctx.strokeRect(-width / 2 + rim, -height / 2 + rim, width - 2 * rim, height - 2 * rim);
  }
  ctx.restore();
  return true;
}
