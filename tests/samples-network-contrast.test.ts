import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

// wave 16 (w16-05, w16-06, w16-07): source-text guards for the token swaps on /samples/production,
// /network, /example and the two /farmer lines. Measured, not guessed: dark text on a dark card is
// what the sweep found, so these pin the token that follows the theme instead of the literal hex.

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = (rel: string) => readFileSync(path.join(ROOT, rel), 'utf8');

test('w16-05: the production example module keeps a 12px floor and a self-contained calendar scroller', () => {
  const css = src('app/samples/production/ProductionExample.module.css');
  for (const m of css.matchAll(/font-size:\s*(\d+(?:\.\d+)?)px/g)) assert.ok(Number(m[1]) >= 12, `font-size ${m[1]}px`);
  for (const m of css.matchAll(/font:[^;}]*?\b(\d+(?:\.\d+)?)px/g)) assert.ok(Number(m[1]) >= 12, `font shorthand ${m[1]}px`);
  assert.match(css, /\.page h1,\.page h2,\.page h3,\.page h4 \{ color:var\(--text-primary\)/);
  // The sr-only spans in the table cells are position:absolute; without a positioned scroller they
  // escape its clip and stretch the document to ~750px on a 390px phone.
  assert.match(css, /\.calendarScroll \{ position:relative;/);
  assert.doesNotMatch(css, /[ {;]color:var\(--brand,#1f4d2b\)/);
});

test('w16-06: /network text is 12px+ and ochre/orange text follows the theme', () => {
  for (const rel of ['app/network/page.tsx', 'components/network/NetworkMap.tsx']) {
    const s = src(rel);
    assert.doesNotMatch(s, /fontSize:\s*(?:9|10|11)(?:\.\d+)?\s*[,}]/, `${rel} has sub-12px type`);
    assert.match(s, /const ATTENTION = 'var\(--orange\)'/);
    assert.doesNotMatch(s, /color:\s*'#9E5C08'/);
    assert.doesNotMatch(s, /color:\s*'#7A4A06'/);
  }
  assert.match(src('app/network/page.tsx'), /color: sort === key \? 'var\(--color-forest-800\)'/);
});

test('w16-07: /example paints full-opacity white on the ochre fill and theme tokens for text', () => {
  const s = src('app/example/page.tsx');
  assert.match(s, /background: '#9A6018'/);
  assert.doesNotMatch(s, /rgba\(255,\s*255,\s*255,\s*0\.85\)/);
  assert.doesNotMatch(s, /color: 'var\(--text-muted\)'/);
  assert.doesNotMatch(s, /color: '#235E86'/);
  assert.doesNotMatch(s, /\? '#235E86'/);
  assert.match(s, /minTemp < 2 \? 'var\(--blue\)'/);
});
