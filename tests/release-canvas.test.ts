import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { drainCanvasToDataUrl } from '@/lib/release-canvas';

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
});

test('every one-shot canvas on the sheet pipeline is drained, not leaked', () => {
  // The pattern to keep out: `return canvas.toDataURL(` on a locally created canvas. Each of those
  // was a buffer lingering until GC. New code should use drainCanvasToDataUrl — if a canvas
  // genuinely must survive (it is returned, cached, or drawn on later), it will not match this
  // shape and is exempt.
  const glossy = readFileSync(new URL('../components/design/DesignGlossy.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(glossy, /return canvas\.toDataURL\(/,
    'a one-shot canvas is leaking its backing store until GC — use drainCanvasToDataUrl');
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
});
