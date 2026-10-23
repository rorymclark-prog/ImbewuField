import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// ux-14/desk-10/nav-14 (2026-10-16 visual/UX audit): when the map cannot start (no WebGL, an
// old phone/browser, a locked-down machine), the map area used to be plain blank paper (light)
// or a solid black slab (dark) with no message, icon or next step — "Map is not supported by
// this browser" only ever reached the console. components/Map.tsx (used by app/farmer/page.tsx)
// now checks mapboxgl.supported() and renders the shared EmptyState in its place.

const map = readFileSync(new URL('../components/Map.tsx', import.meta.url), 'utf8');
const emptyState = readFileSync(new URL('../components/EmptyState.tsx', import.meta.url), 'utf8');

test('Map.tsx checks mapboxgl.supported() once on mount', () => {
  assert.match(map, /mapboxgl\.supported\(\)/, 'the capability check must exist');
  assert.match(map, /const \[mapSupported, setMapSupported\] = useState\(true\)/, 'default to supported so the real map still mounts everywhere it always has');
});

test('an unsupported device gets the shared EmptyState with an icon and a next step, not a blank div', () => {
  const guardAt = map.indexOf('if (!mapSupported) {');
  assert.ok(guardAt > 0, 'the fallback branch is gone; this test needs rewriting rather than deleting');
  const guardBlock = map.slice(guardAt, guardAt + 1200);
  assert.match(guardBlock, /<EmptyState/, 'must use the shared EmptyState component, not a bespoke blank card');
  assert.match(guardBlock, /icon=\{MapPinOff\}/, 'must pass an icon — the finding is explicitly that there was none');
  assert.match(guardBlock, /href="\/reports"/, 'must offer a next step: the site report still works without a map');
});

test('EmptyState accepts an optional icon and actions without changing its default rendering', () => {
  assert.match(emptyState, /icon\?:\s*LucideIcon/, 'icon must be optional so existing callers are unaffected');
  assert.match(emptyState, /actions\?:\s*ReactNode/, 'actions must be optional so existing callers are unaffected');
  assert.match(emptyState, /Icon \? \(/, 'must fall back to the original sprout illustration when no icon is passed');
});
