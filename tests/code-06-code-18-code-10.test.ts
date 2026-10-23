import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// code-06/code-18/code-10 (2026-10-16 visual/UX audit), owned-files portion:
//   code-06 — status/border ternaries assigned hex literals (even via a named const) stayed
//     light-mode-only regardless of the active theme; component-text-contrast.test.ts only
//     catches a literal `color: '#hex'`, not a ternary or a const assignment.
//   code-18 — ProfileSheet's InitialsAvatar drew its initials in Leaf ('#A8D88A'), a fill colour
//     DESIGN.md says must never be used as type (~1.2:1 on paper, ~3:1 on the forest fill it sat on).
//   code-10 — captions under the 12px floor on routes tests/type-floor.test.ts does not scan
//     (app/community/**, app/contact, components/ConsentPanel.tsx are not in that file's crawl).
//
// Not touched: components/exchange/*, components/prices/*, components/network/FarmerPanel.tsx,
// app/mentor/page.tsx, app/student/page.tsx, components/DataPanel.tsx, components/MyRecords.tsx,
// components/course/OfflineDownload.tsx, components/LifeGuide.tsx — all named in these findings'
// suggested file lists but outside this track's owned files.

const source = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8');

test('code-18: ProfileSheet draws initials in var(--on-forest-800), not Leaf', () => {
  const src = source('../components/ProfileSheet.tsx');
  assert.doesNotMatch(src, /#A8D88A/i, 'Leaf must not be used as text colour anywhere in this file');
  const fnAt = src.indexOf('function InitialsAvatar');
  assert.ok(fnAt > 0);
  const fn = src.slice(fnAt, fnAt + 1300);
  // Wave 16 (dark-forest): the avatar sits on --color-forest-800, which turns light in the dark themes,
  // so its text takes the matching --on-forest-800 pair rather than the always-light --on-forest.
  assert.match(fn, /color: 'var\(--on-forest-800\)'/, 'the initials span must use the themed on-forest token');
});

test('code-06: ProfileSheet toggle/counter ternaries route through theme tokens, not hex literals', () => {
  const src = source('../components/ProfileSheet.tsx');
  assert.doesNotMatch(src, /color: on \? '#fff' : '#5C5040'/);
  assert.doesNotMatch(src, /bioRemaining < 20 \? '#B83A18' : '#755942'/);
  assert.match(src, /bioRemaining < 20 \? 'var\(--danger\)' : 'var\(--text-muted\)'/);
});

test('code-06: PeoplePanel\'s border ternary no longer falls back to a literal hairline hex', () => {
  const src = source('../components/PeoplePanel.tsx');
  assert.doesNotMatch(src, /isCurrentUser \? 'rgba\(31,77,43,0\.3\)' : '#E2D8C4'/);
});

test('code-06: PhotoUpload\'s loading-state ternaries route through theme tokens', () => {
  const src = source('../components/PhotoUpload.tsx');
  assert.doesNotMatch(src, /color: loading \? '#755942' : '#235E86'/);
  assert.match(src, /color: loading \? 'var\(--text-muted\)' : 'var\(--info\)'/);
});

test('code-10: app/community/page.tsx has no sub-12px captions left', () => {
  const src = source('../app/community/page.tsx');
  const fontSizes = [...src.matchAll(/fontSize:\s*([\d.]+)[,}]/g)].map(m => Number(m[1]));
  assert.ok(fontSizes.length > 5, 'expected to find several fontSize declarations');
  for (const size of fontSizes) assert.ok(size >= 12, `found a sub-12px fontSize: ${size}`);
});

test('code-10: app/community/profile/page.tsx has no sub-12px captions left', () => {
  const src = source('../app/community/profile/page.tsx');
  const fontSizes = [...src.matchAll(/fontSize:\s*([\d.]+)[,}]/g)].map(m => Number(m[1]));
  assert.ok(fontSizes.length > 5);
  for (const size of fontSizes) assert.ok(size >= 12, `found a sub-12px fontSize: ${size}`);
});

test('code-10: app/contact/page.tsx has no sub-12px captions left', () => {
  const src = source('../app/contact/page.tsx');
  const fontSizes = [...src.matchAll(/fontSize:\s*([\d.]+)[,}]/g)].map(m => Number(m[1]));
  assert.ok(fontSizes.length > 10);
  for (const size of fontSizes) assert.ok(size >= 12, `found a sub-12px fontSize: ${size}`);
});

test('code-10: ConsentPanel.tsx no longer ships a Tailwind text-[10px] caption', () => {
  const src = source('../components/ConsentPanel.tsx');
  assert.doesNotMatch(src, /text-\[10px\]/);
});
