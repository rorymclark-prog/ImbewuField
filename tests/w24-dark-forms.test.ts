import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// Wave 24 track A: colours written for the light page that were never checked on the dark one.
const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8');

test('w24-01 NavDrawer active item follows the theme, not literal forest', () => {
  const src = read('../components/NavDrawer.tsx');
  assert.ok(!/#1F4D2B/i.test(src.replace(/\/\/.*$/gm, '')), 'no literal #1F4D2B outside comments');
  assert.ok(!src.includes('rgba(31,77,43'), 'no literal forest tint');
  assert.ok(src.includes('var(--cat-foundation-text)'));
});

test('w24-01 role chip uses a per-theme fill, not a literal pale pill', () => {
  const src = read('../components/RoleSwitcher.tsx');
  assert.ok(!src.includes('#e9f1e9') && src.includes('var(--role-chip-bg)'));
  const css = read('../app/globals.css');
  assert.equal((css.match(/--role-chip-bg:/g) ?? []).length, 4, 'declared in all four theme columns');
});

test('w24-02 VenueLocation panel follows the theme', () => {
  const src = read('../components/VenueLocation.tsx');
  assert.ok(!/#f3f7f1|#b4c6b6/i.test(src));
  assert.ok(src.includes("background: 'var(--bg-1)'") && src.includes("color: 'var(--text-primary)'"));
});

test('w24-03 exchange error text uses a theme-following token', () => {
  const src = read('../components/exchange/theme.ts');
  assert.ok(src.includes("red: 'var(--orange)'"));
  assert.ok(!src.includes("red: 'var(--danger)'"), '--danger is a :root constant');
});

test('w24-04 records Log harvest and invoice links use theme tokens', () => {
  const page = read('../app/records/page.tsx');
  const i = page.indexOf("'Log harvest', 'Rekhoda isivuno'");
  const btn = page.slice(page.lastIndexOf('<button', i), i);
  assert.ok(btn.includes("color: 'var(--blue)'") && !btn.includes('--color-water'));
  const mine = read('../components/MyRecords.tsx');
  assert.ok(!/color: '#315939'/.test(mine), 'invoice links must not hardcode #315939');
});
