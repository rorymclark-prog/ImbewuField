// Approximate contour lines for the Design Studio.
//
// HONEST SCOPE: our elevation source (lib/elevation.ts, SRTM 30 m) samples only a few points
// and yields ONE slope + aspect for the whole site — SRTM's 30 m resolution is coarser than a
// typical smallholding, so true surveyed contours aren't derivable. What IS useful for
// permaculture is the CONTOUR DIRECTION: on a uniform slope, contours are parallel lines
// running perpendicular to the downhill (aspect) direction, spaced by a vertical interval.
// That's what a farmer needs to lay swales / vetiver "on contour". These lines are that
// planar approximation — a directional guide, not a survey.

/** A contour line in normalised [0..1] frame coords, with its (approx) elevation label. */
export interface ContourLine {
  a: [number, number];
  b: [number, number];
  elevM: number; // metres relative to the mid line (0 at centre, +uphill)
}

export interface ContourResult {
  lines: ContourLine[];
  intervalM: number; // vertical spacing between lines
  tooFlat: boolean;
}

/**
 * Build parallel contour lines across the property.
 * @param slopeDeg  slope steepness in degrees (from lib/elevation)
 * @param aspectDeg downhill bearing, clockwise from North (0=N, 90=E)
 * @param boundary  property ring in normalised [0..1] coords (for the extent + centre)
 * @param mPerPx    metres per logical pixel of the frame
 * @param imgW,imgH logical pixel size of the frame (so px spacing → normalised)
 */
export function computeContourLines(
  slopeDeg: number,
  aspectDeg: number,
  boundary: Array<[number, number]>,
  mPerPx: number,
  imgW: number,
  imgH: number,
): ContourResult {
  // Below ~1.5° the ground reads as flat — contours would be metres apart and meaningless.
  if (!Number.isFinite(slopeDeg) || slopeDeg < 1.5 || boundary.length < 3) {
    return { lines: [], intervalM: 0, tooFlat: true };
  }

  // Work in logical px so metres↔px is a single mPerPx scale, then normalise at the end.
  const pts = boundary.map(([x, y]) => [x * imgW, y * imgH] as [number, number]);
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const diag = Math.hypot(maxX - minX, maxY - minY);

  const aspectRad = (aspectDeg * Math.PI) / 180;
  // Canvas is y-DOWN, North is up. Downhill unit vector for a compass bearing:
  const dHat: [number, number] = [Math.sin(aspectRad), -Math.cos(aspectRad)];
  // Contours run perpendicular to downhill.
  const perp: [number, number] = [Math.cos(aspectRad), Math.sin(aspectRad)];

  // Extent of the property measured ALONG the downhill direction (px).
  let projMin = Infinity, projMax = -Infinity;
  for (const [px, py] of pts) {
    const proj = (px - cx) * dHat[0] + (py - cy) * dHat[1];
    if (proj < projMin) projMin = proj;
    if (proj > projMax) projMax = proj;
  }
  const rangePx = projMax - projMin;

  // Aim for ~8 lines across the property; round the vertical interval to a friendly step.
  const slopeRad = (slopeDeg * Math.PI) / 180;
  const targetLines = 8;
  const rawIntervalM = (rangePx / targetLines) * mPerPx * Math.tan(slopeRad);
  const intervalM = niceInterval(rawIntervalM);
  const spacingPx = intervalM / mPerPx / Math.tan(slopeRad);
  if (!Number.isFinite(spacingPx) || spacingPx <= 0) return { lines: [], intervalM: 0, tooFlat: true };

  const half = diag; // each line spans well past the bbox; SVG clipPath trims to the boundary
  const lines: ContourLine[] = [];
  const n = Math.ceil(rangePx / spacingPx / 2) + 1;
  for (let i = -n; i <= n; i++) {
    const offset = i * spacingPx;
    // Line centre point, shifted along downhill by `offset`.
    const mx = cx + dHat[0] * offset;
    const my = cy + dHat[1] * offset;
    const a: [number, number] = [(mx - perp[0] * half) / imgW, (my - perp[1] * half) / imgH];
    const b: [number, number] = [(mx + perp[0] * half) / imgW, (my + perp[1] * half) / imgH];
    // Uphill is OPPOSITE the downhill vector, so elevation increases as offset decreases.
    lines.push({ a, b, elevM: Math.round(-i * intervalM * 10) / 10 });
  }
  return { lines, intervalM, tooFlat: false };
}

// Round a raw interval to a tidy 1 / 2 / 5 × 10ⁿ step so labels read cleanly.
function niceInterval(raw: number): number {
  if (!Number.isFinite(raw) || raw <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / pow;
  const step = norm < 1.5 ? 1 : norm < 3.5 ? 2 : norm < 7.5 ? 5 : 10;
  return Math.max(0.5, step * pow);
}
