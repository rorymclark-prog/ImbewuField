// Split out of app/api/contours/route.ts: a Next.js app-router route.ts file may only export the
// recognised route fields (GET, POST, config, runtime, …) — any other named export fails the
// build with "X is not a valid Route export field". buildThresholds needs to be both used by the
// route and unit-testable, so it lives here instead.

// sec-01: the loop itself stops at maxCount — it never builds the full elevation-range array and
// slices afterwards, which is what let a tiny interval burn CPU/memory proportional to
// (max - min) / interval before an after-the-fact `.slice(0, MAX_THRESHOLDS)` would have run.
export function buildThresholds(min: number, max: number, interval: number, maxCount: number): number[] {
  const startEle = Math.floor(min / interval) * interval;
  const endEle = Math.ceil(max / interval) * interval;
  const thresholds: number[] = [];
  for (let t = startEle; t <= endEle && thresholds.length < maxCount; t += interval) thresholds.push(t);
  return thresholds;
}
