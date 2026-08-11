import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { drainCanvasToDataUrl, releaseCanvas, releaseImageSource } from '@/lib/release-canvas';

// iOS SAFARI KILLS THE PAGE, NOT THE RENDER. The sheet pipeline builds a parade of full-resolution
// canvases — exact page, label layer, AI composite, protect mask, capped upload copies — each used
// once, converted to a data URL, and dropped. "Dropped" frees only the JS wrapper: WebKit keeps
// the multi-megabyte pixel buffer until GC, and iOS enforces a hard per-page canvas budget. Enough
// lingering buffers and the OS kills and silently reloads the tab, which the farmer experiences as
// the app throwing them back to the start. Rory, on the AI Polished button: "Ai button always
// crashes the app now" … "It goes back to the design screen." Desktop never reproduces it, because
// desktop has no such budget — which is exactly why this is pinned by tests instead of by memory.

test('draining extracts the picture first and releases the buffer after', () => {
  const calls: string[] = [];
  const fake = {
    width: 2880,
    height: 1880,
    toDataURL(type?: string, quality?: number) {
      calls.push(`toDataURL:${type}:${quality}:at ${this.width}x${this.height}`);
      return 'data:image/png;base64,x';
    },
  };
  const url = drainCanvasToDataUrl(fake, 'image/png');
  assert.equal(url, 'data:image/png;base64,x');
  // The read happened BEFORE the release — draining a canvas to 0x0 first would return a blank.
  assert.deepEqual(calls, ['toDataURL:image/png:undefined:at 2880x1880']);
  assert.equal(fake.width, 0, 'the backing store must be released');
  assert.equal(fake.height, 0);
  // JPEG quality passes through — the photo bake depends on it.
  drainCanvasToDataUrl(fake, 'image/jpeg', 0.92);
  assert.match(calls[1], /image\/jpeg:0\.92/);

  const throwing = {
    width: 1920,
    height: 1280,
    toDataURL() { throw new Error('encoder failed'); },
  };
  assert.throws(() => drainCanvasToDataUrl(throwing, 'image/png'), /encoder failed/);
  assert.deepEqual({ width: throwing.width, height: throwing.height }, { width: 0, height: 0 },
    'a failed PNG encode must not retain the largest backing store in the app');
});

test('every one-shot canvas on the sheet pipeline is drained, not leaked', () => {
  // The pattern to keep out: `return canvas.toDataURL(` on a locally created canvas. Each of those
  // was a buffer lingering until GC. New code should use drainCanvasToDataUrl — if a canvas
  // genuinely must survive (it is returned, cached, or drawn on later), it will not match this
  // shape and is exempt.
  const glossy = readFileSync(new URL('../components/design/DesignGlossy.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(glossy, /return canvas\.toDataURL\(/,
    'a one-shot canvas is leaking its backing store until GC — use drainCanvasToDataUrl');
  assert.doesNotMatch(glossy, /\n\s*canvas\.toDataURL\('image\/png'\),/,
    'a map canvas is passed into another full-sheet compositor without being released first');
  assert.doesNotMatch(glossy, /dataUrl:\s*canvas\.toDataURL\(/,
    'multi-sheet export retains each full-size re-encode canvas until garbage collection');
  // The three AI-input builders are the hot path that blew the iOS budget: model composite,
  // protect mask, upload cap.
  for (const fn of ['buildComposite', 'buildProtectMask', 'capForAiInput']) {
    const start = glossy.indexOf(`function ${fn}(`);
    assert.ok(start > 0, `${fn} moved — update this guard, do not delete it`);
    const body = glossy.slice(start, glossy.indexOf('\n}', start));
    assert.match(body, /drainCanvasToDataUrl\(/, `${fn} must release its canvas`);
  }
  // And the largest single canvas in the app — the supersampled photo bake.
  const designCanvas = readFileSync(new URL('../lib/design-canvas.ts', import.meta.url), 'utf8');
  assert.match(designCanvas, /drainCanvasToDataUrl\(canvas, 'image\/jpeg', 0\.92\)/,
    'the photo bake must release its supersampled canvas');

  // The exact master is generated BEFORE the guided paid render. On the failing High-quality
  // iPhone path these three omissions retained roughly another 60–100 MiB before AI preparation
  // even began, so the paid button could crash while it was still saving the free exact sheet.
  const cropStart = glossy.indexOf('async function boundaryPresentationContext(');
  const cropBody = glossy.slice(cropStart, glossy.indexOf('\n/**', cropStart));
  assert.match(cropBody, /satDataUrl = drainCanvasToDataUrl\(cropCanvas, 'image\/png'\)/,
    'the boundary crop keeps its source-resolution backing store alive');

  const blueprintStart = glossy.indexOf('async function buildReferenceBlueprintMap(');
  const blueprintBody = glossy.slice(blueprintStart, glossy.indexOf('\n/**', blueprintStart));
  assert.match(blueprintBody, /const mapDataUrl = drainCanvasToDataUrl\(canvas, 'image\/png'\)/,
    'the exact map canvas survives while the sheet compositor allocates another full raster');
  assert.match(blueprintBody, /return composeStyleSheet\(\s*mapDataUrl,/,
    'the drained exact-map data URL is not the value handed to the compositor');

  const drainSections = [
    ['base sheet', 'export async function buildBlueprintBaseMap(', 'interface ReferencePresentationContext'],
    ['design sheet', 'async function buildReferenceBlueprintMap(', '/**\n * The Water sheet'],
    ['sector sheet', 'async function composeSectorSheet(', '// The exact sheet is composeSectorSheet'],
    ['AI site finisher', 'const finishSiteSheet = useCallback(', '// Sector\'s paid path starts'],
  ] as const;
  for (const [label, startText, endText] of drainSections) {
    const start = glossy.indexOf(startText);
    const section = glossy.slice(start, glossy.indexOf(endText, start));
    assert.match(section, /const mapDataUrl = drainCanvasToDataUrl\(canvas, 'image\/png'\)/,
      `${label} stopped releasing its map before the sheet compositor`);
  }

  const padStart = glossy.indexOf('function padToPaperSheet(');
  const padBody = glossy.slice(padStart, glossy.indexOf('\nasync function composeStyleSheet', padStart));
  const padCopy = padBody.indexOf('ctx.drawImage(');
  const padRelease = padBody.indexOf('releaseCanvas(sheet)');
  assert.ok(padCopy >= 0 && padRelease > padCopy,
    'the unpadded sheet remains allocated beside the final paper canvas');
  assert.match(padBody, /if \(!ctx\)\s*{\s*releaseCanvas\(canvas\)/,
    'a failed paper context leaves its destination allocation alive');

  const renderJobs = readFileSync(new URL('../lib/render-jobs.ts', import.meta.url), 'utf8');
  const maskStart = renderJobs.indexOf('async function maskIsUsable(');
  const maskBody = renderJobs.slice(maskStart, renderJobs.indexOf('\n/** Uploads', maskStart));
  assert.match(maskBody, /finally\s*{[\s\S]*releaseCanvas\(canvas\)/,
    'mask validation retains both its canvas and its ImageData buffer until garbage collection');
  assert.match(maskBody, /finally\s*{[\s\S]*releaseImageSource\(img\)/,
    'mask validation retains its decoded full-size image');

  const composeStart = glossy.indexOf('async function composeStyleSheet(');
  const composeBody = glossy.slice(composeStart, glossy.indexOf('\n/** Extract the map panel', composeStart));
  const mapCopy = composeBody.indexOf('ctx.drawImage(map, gutter, 0)');
  const mapRelease = composeBody.indexOf('releaseImageSource(map)', mapCopy);
  assert.ok(mapCopy >= 0 && mapRelease > mapCopy,
    'the decoded map stays live while the full sheet and paper canvases are allocated');

  for (const fn of [
    'drawBlueprintBase',
    'drawAnalysisBase',
    'buildComposite',
    'capForAiInput',
    'buildHouseOverlay',
    'buildDrivewayOverlay',
    'stackOverlayImages',
  ]) {
    const at = glossy.indexOf(`function ${fn}(`);
    const body = glossy.slice(at, glossy.indexOf('\n}', at) + 2);
    assert.match(body, /releaseImageSource\(/, `${fn} retains its decoded full-size source image`);
  }
});

test('releaseCanvas frees a getImageData-style scratch canvas without an encode', () => {
  // The pixel-comparison paths extract raw RGBA bytes and never need a data URL —
  // drainCanvasToDataUrl there would pay for a PNG encode nobody reads.
  const fake = { width: 1024, height: 724 };
  releaseCanvas(fake);
  assert.equal(fake.width, 0);
  assert.equal(fake.height, 0);
});

test('releaseImageSource detaches a finished decode without requesting another URL', () => {
  const removed: string[] = [];
  const fake = {
    onload: () => undefined,
    onerror: () => undefined,
    removeAttribute: (name: string) => { removed.push(name); },
  };
  releaseImageSource(fake);
  assert.equal(fake.onload, null);
  assert.equal(fake.onerror, null);
  assert.deepEqual(removed, ['src']);
});
