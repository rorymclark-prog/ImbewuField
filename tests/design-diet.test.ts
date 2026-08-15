import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// THE PAGE THAT STOPS CRASHING BY WEIGHING LESS.
//
// Every guard in lib/crash-loop.ts and every rescue tried in August treats the symptom: the
// design page is too heavy for the phones farmers own, in two currencies at once — JavaScript
// parsed at startup (698 kB gzipped, measured 15 August) and image pixels held during the base
// bake (a 2880×1920 canvas live TOGETHER with two full decoded photos). Rory: "i want a
// comprehensive fix! so that no matter what things work!" This file pins that fix so neither
// bill quietly grows back.

const source = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8');

test('phone-grade hardware gets capped image work; laptops keep print quality', async () => {
  const mod = await import('../lib/device-grade.ts');
  // On the server (no window) nothing is phone-grade — SSR must never bake down quality.
  assert.equal(mod.phoneGradeDevice(), false);
  assert.equal(mod.deviceBakeScale(3), 3);
  assert.equal(mod.deviceImageryRatio(), 2);

  // A phone: coarse pointer, phone-sized screen.
  const g = globalThis as { window?: unknown };
  g.window = {
    matchMedia: () => ({ matches: true }),
    screen: { width: 390, height: 844 },
  };
  try {
    assert.equal(mod.phoneGradeDevice(), true, 'a 390px coarse-pointer screen is a phone');
    assert.equal(mod.deviceBakeScale(3), 2, 'the bake must drop to 2× on a phone');
    assert.equal(mod.deviceImageryRatio(), 1, 'satellite fetches must drop to @1x on a phone');
    // An iPad landscape (1024 short side… actually 768/834) — the SHORT side decides, so a
    // desktop-sized touch screen keeps full quality.
    (g.window as { screen: { width: number; height: number } }).screen = { width: 1366, height: 1024 };
    assert.equal(mod.phoneGradeDevice(), false, 'big touch screens have laptop-class memory');
  } finally {
    delete g.window;
  }
});

test('the caps are actually wired into the allocations they exist to shrink', () => {
  const canvas = source('../lib/design-canvas.ts');
  assert.match(canvas, /deviceBakeScale\(BASE_PHOTO_EXPORT_SCALE\)/,
    'the base bake no longer asks the device before allocating its biggest canvas');
  assert.match(canvas, /deviceImageryRatio\(\) === 1 \? '' : '@2x'/,
    'the Mapbox still is back to unconditional @2x');
  const basemap = source('../lib/basemap-imagery.ts');
  assert.match(basemap, /deviceImageryRatio\(\)/,
    'the Esri stitch is back to an unconditional retina canvas');
  const importer = source('../components/design/BasePhotoImport.tsx');
  assert.match(importer, /deviceBakeScale\(BASE_PHOTO_EXPORT_SCALE\)/,
    'the photo-import export canvas lost its phone cap');
  assert.match(importer, /sourceSideCap/,
    'a 48-megapixel camera photo is being held at full size for the whole aligning session again');
});

test('the studio arrives in parts: nothing modal or advisory rides the startup chunk', () => {
  const page = source('../app/design/page.tsx');
  // The three deferred parts must not come back as static imports…
  for (const name of ['StepGuide', 'DesignAdvisor', 'BasePhotoImport']) {
    assert.doesNotMatch(page, new RegExp(`import ${name}[ ,]`),
      `${name} is statically imported again — it rides the startup chunk`);
  }
  // …and BasePhotoImport is the load-bearing one: it drags firebase/storage with it.
  assert.match(page, /studioPart\(\(\) => import\('@\/components\/design\/BasePhotoImport'\)\)/);
  assert.match(page, /studioPart\(\(\) => import\('@\/components\/design\/DesignAdvisor'\)\)/);
  assert.match(page, /studioPart\(\(\) => import\('@\/components\/design\/StepGuide'\)\)/);
  // The render sites use the lazy stand-ins.
  assert.match(page, /<DesignAdvisorLazy\b/);
  assert.match(page, /<BasePhotoImportLazy\b/);
  assert.match(page, /<StepGuideLazy\b/);
});
