import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('w18-53/54: atlas search input fills its wrapper and the hint is not half-width', () => {
  const s = read('components/atlas/AtlasExplorer.tsx');
  assert.match(s, /flex flex-1 w-full items-center gap-2 min-w-0/);
  assert.match(s, /className="flex-1 w-full min-w-0 font-sans/);
  assert.match(s, /inset-x-4 mx-auto w-fit max-w-\[calc\(100%-96px\)\]/);
  assert.doesNotMatch(s, /left-1\/2 -translate-x-1\/2 z-10 flex items-center gap-2 px-4 py-2\.5/);
});

test('w18-55: design picker uses theme tokens', () => {
  const s = read('app/design/page.tsx');
  assert.match(s, /<h1 className="t-h1"/);
  assert.match(s, /<MapPin size=\{18\} color="var\(--emerald\)"/);
  assert.match(s, /background: 'var\(--bg-0\)',\n        color: DARK/);
});

test('w18-56: crop plan preview follows the theme', () => {
  const css = read('components/report/SiteCropPlanPreview.module.css');
  assert.doesNotMatch(css, /#[0-9a-fA-F]{3,6}\b/);
  assert.match(css, /var\(--bg-1\)/);
});

test('w18-57/58: example cards use tokens, not tints', () => {
  const s = read('app/example/page.tsx');
  assert.doesNotMatch(s, /rgba\(31,77,43,0\.06\)|rgba\(35,94,134,0\.06\)/);
  assert.match(s, /borderLeft: '3px solid var\(--emerald\)'/);
  assert.match(s, /borderLeft: '3px solid var\(--blue\)'/);
  assert.doesNotMatch(s, /uppercase tracking-wider/);
  assert.doesNotMatch(s, /color: '#9A6018'/);
});

test('w18-59: surveys separator, icon size, caption', () => {
  const s = read('app/surveys/page.tsx');
  assert.doesNotMatch(s, /<>&middot; \{survey\.questions/);
  assert.match(s, /\{' · '\}\{survey\.questions\.length\}/);
  assert.match(s, /<ClipboardList size=\{24\}/);
});
