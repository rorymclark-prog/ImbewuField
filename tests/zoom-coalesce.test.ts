import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// A pinch or scroll zoom fires react-map-gl's onZoom on every animation frame — dozens of times a
// second. The original handler pushed React state straight from the event
// (`onZoom={(e) => setZoom(e.viewState.zoom)}`), re-rendering the whole map subtree that often —
// on a cheap Android phone that's the difference between a map that moves and one that stutters.
//
// onMove already solves this two lines below with a pending ref + requestAnimationFrame: defer the
// setState out of react-map-gl's own render pass and coalesce to one update per frame. onZoom needs
// the same treatment — and `zoom` has to STAY real React state throughout: it drives the
// fine-contour Source swap and the +/- zoom buttons, so an imperative ref read would silently break
// both.

const source = readFileSync(new URL('../components/Map.tsx', import.meta.url), 'utf8');

function propBlock(prop: string): string {
  const at = source.indexOf(`${prop}={`);
  assert.ok(at > 0, `${prop} prop not found on the map`);
  return source.slice(at, at + 700);
}

test('zoom stays React state, driving the fine-contour source swap and the zoom buttons', () => {
  assert.match(source, /const \[zoom, setZoom\] = useState/, 'zoom must stay React state, not become a ref');
  assert.match(source, /zoom < FINE_CONTOUR_MIN_ZOOM/, 'the fallback contour Source still reads zoom from state');
  assert.match(source, /zoom >= FINE_CONTOUR_MIN_ZOOM/, 'the fine contour Source still reads zoom from state');
  assert.match(source, /zoom \+ 1/, 'the + zoom button still reads zoom from state');
  assert.match(source, /zoom - 1/, 'the - zoom button still reads zoom from state');
});

test('onZoom coalesces to one setZoom per animation frame, like onMove does', () => {
  const zoomBlock = propBlock('onZoom');
  assert.match(
    zoomBlock,
    /requestAnimationFrame/,
    "onZoom must defer its setState via requestAnimationFrame, matching onMove's pattern",
  );
  assert.match(
    zoomBlock,
    /zoomPending\.current/,
    'onZoom needs its own pending ref — zoom must not share onMove\'s movePending, which gates an unrelated update',
  );
  assert.doesNotMatch(
    source,
    /onZoom=\{\(e\) => setZoom\(e\.viewState\.zoom\)\}/,
    'onZoom must not push setZoom straight from the event on every frame',
  );
});

test('zoomPending is declared as a ref, next to movePending', () => {
  assert.match(
    source,
    /const zoomPending = useRef\(false\)/,
    'zoomPending must be a ref, not React state — it only gates the coalescing and never itself renders',
  );
});
