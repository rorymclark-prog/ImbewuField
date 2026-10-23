import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const refresher = read('app/student/teach-the-teachers/Refresher.module.css');
const refresherPage = read('app/student/teach-the-teachers/page.tsx');
const tour = read('app/tour/Tour.module.css');
const pt = read('components/ProductTour.module.css');

test('w18-12 Teach the Teachers uses the app fonts', () => {
  assert.doesNotMatch(refresher, /system-ui|font: 700 clamp\([^;]*Georgia/);
  assert.match(refresher, /\.hero h1 \{[^}]*var\(--font-display\)/);
  assert.match(refresher, /\.time \{[^}]*var\(--font-sans\)/);
});

test('w18-13 session rows have a chevron and numbered steps', () => {
  assert.match(refresherPage, /<ChevronDown className=\{styles\.chevron\}/);
  assert.match(refresher, /\.session\[open\] \.chevron \{ transform: rotate\(180deg\)/);
  assert.match(refresher, /\.sessionBody ol \{[^}]*list-style: decimal/);
});

test('w18-14 hero jump links are outlined and the shell is 1080px', () => {
  assert.match(refresher, /\.heroLinks a \{[^}]*border: 1px solid var\(--border-strong\)[^}]*background: var\(--bg-1\)/);
  assert.match(refresher, /\.main \{ width: min\(100%, 1080px\)/);
});

test('w18-15 tour stop tiles follow the theme', () => {
  assert.doesNotMatch(tour, /#e8f1e8|#27583b|#e7f0f4|#f8efdf/);
  assert.match(tour, /--stop-tint: color-mix\(in srgb, var\(--emerald\) 14%, var\(--bg-1\)\)/);
  assert.match(tour, /var\(--blue\) 14%/);
  assert.match(tour, /var\(--gold\) 14%/);
});

test('w18-16/17/18 tour and tips primary, header scope and title scale', () => {
  assert.match(pt, /\.page \.primary,\.dialog \.primary\{background:var\(--color-forest-800\);color:var\(--on-forest-800\);border-color:transparent/);
  assert.doesNotMatch(pt, /999px;text-decoration/);
  assert.doesNotMatch(pt, /^\.page button,\.page a/m);
  assert.match(pt, /\.scroll button,\.scroll a/);
  assert.match(pt, /\.page h1\{font:600 clamp\(24px,3\.2vw,32px\)[^}]*var\(--font-display\)/);
});
