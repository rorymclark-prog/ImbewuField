// Lives outside app/api/contours/route.ts because a Next.js route module may only export its
// handlers and route config — an extra named export fails `next build` (not `tsc`).
// sec-01: the loop itself stops at maxCount — it never builds the full elevation-range array and
// slices afterwards, which is what let a tiny interval burn CPU/memory proportional to
// (max - min) / interval before the old `.slice(0, MAX_THRESHOLDS)` ever ran.
export function buildThresholds(min: number, max: number, interval: number, maxCount: number): number[] {
  const startEle = Math.floor(min / interval) * interval;
  const endEle = Math.ceil(max / interval) * interval;
  const thresholds: number[] = [];
  for (let t = startEle; t <= endEle && thresholds.length < maxCount; t += interval) thresholds.push(t);
  return thresholds;
}
