// These are paint profiles in a unit footprint. They describe the light on bare soil, never
// excavation depths or construction dimensions. The saved width and length own the footprint.
export type BasinKind = 'banana_circle' | 'tree_basin';
export type FallVector = readonly [number, number];

export function swaleBankSide(ax: number, ay: number, bx: number, by: number, fall?: FallVector | null): -1 | 0 | 1 {
  if (!fall) return 0;
  const length = Math.hypot(bx - ax, by - ay);
  if (!length) return 0;
  const across = (-(by - ay) * fall[0] + (bx - ax) * fall[1]) / length;
  // If the line runs along the fall, neither shoulder is meaningfully downhill of the other.
  return Math.abs(across) < 0.05 ? 0 : across > 0 ? 1 : -1;
}

function basinRadius(x: number, y: number) {
  const a = Math.atan2(y, x);
  return Math.hypot(x, y) * (1 + .026 * Math.sin(3 * a) + .018 * Math.cos(5 * a) + .013 * Math.sin(8 * a));
}

export function basinSurface(kind: BasinKind, radius: number) {
  const bell = (center: number, width: number) => Math.exp(-(((radius - center) / width) ** 2));
  // Widen the banana bank towards the compost core, inside the same saved outer edge.
  if (kind === 'banana_circle') return .36 * bell(.65, .27) - .22 * bell(0, .34);
  return .28 * bell(0, .30) - .17 * bell(.48, .14) + .23 * bell(.77, .13);
}

const basinStamps = new Map<BasinKind, HTMLCanvasElement>();
export function drawEarthworksBasin(ctx: CanvasRenderingContext2D, kind: BasinKind, w: number, h: number) {
  if (!(w > 0 && h > 0)) return;
  let stamp = basinStamps.get(kind);
  if (!stamp) {
    const size = 192;
    stamp = document.createElement('canvas');
    stamp.width = stamp.height = size;
    const pen = stamp.getContext('2d');
    if (!pen) return;
    const image = pen.createImageData(size, size);
    let seed = 7183;
    for (let j = 0; j < size; j++) {
      for (let i = 0; i < size; i++) {
        const x = (i + .5) * 2 / size - 1, y = (j + .5) * 2 / size - 1;
        const r = basinRadius(x, y);
        if (r >= 1 || x * x + y * y >= 1) continue;
        const z = basinSurface(kind, r);
        // Raking light from the upper left reverses on the two flanks of the mound.
        const step = .012;
        const rise = (basinSurface(kind, basinRadius(x + step, y + step)) -
          basinSurface(kind, basinRadius(x - step, y - step))) / (2 * step);
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        const grain = (seed / 4294967296 - .5) * 19 + 3 * Math.sin(i / 4 + Math.sin(j / 3));
        const light = Math.tanh(rise) * 33 + z * 117 + grain;
        const index = (j * size + i) * 4;
        image.data.set([139 + light, 103 + light * .88, 67 + light * .69,
          Math.round(255 * Math.min(1, (1 - Math.max(r, Math.hypot(x, y))) * 13))], index);
      }
    }
    pen.putImageData(image, 0, 0);
    basinStamps.set(kind, stamp);
  }
  ctx.drawImage(stamp, -w / 2, -h / 2, w, h);
}
