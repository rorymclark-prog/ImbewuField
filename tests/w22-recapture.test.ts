import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('w22-01: /home computes the day and date after mount, never during the prerendered render', () => {
  const home = read('app/home/page.tsx');
  // w23-01 re-pin: computed during render behind a mounted flag (an effect froze the raw keys
  // while the isiZulu dictionary was still loading). Still never part of the prerendered HTML.
  assert.match(home, /const \[mounted, setMounted\] = useState\(false\);/);
  assert.match(home, /useEffect\(\(\) => \{ setMounted\(true\); \}, \[\]\);/);
  assert.match(home, /const dayDate = mounted \? getDayDate\(lang\) : '';/);
  const calls = home.match(/getDayDate\(lang\)/g) ?? [];
  assert.equal(calls.length, 1, 'getDayDate(lang) must appear exactly once, behind the mounted flag');
});

test('w22-05/06: isiZulu draft source labels use the secondary text token on tinted panels', () => {
  assert.match(read('app/calendar/page.tsx'), /text-\[var\(--text-secondary\)\]">isiZulu translation pending — English source: /);
  assert.match(read('components/studies/DesignDraftCopy.module.css'), /\.source \{[^}]*color:var\(--text-secondary\);/);
});

test('w22-08: the Lima launcher parks bottom-right on desktop, except over the /farmer map', () => {
  const w = read('components/ChatWidget.tsx');
  const pos = w.slice(w.indexOf('const FAB_DEFAULT_POS'), w.indexOf('return (', w.indexOf('const FAB_DEFAULT_POS')));
  // phones keep bottom-left on every route
  assert.equal((pos.match(/'bottom-\[\d+px\] left-4 /g) ?? []).length, 3);
  // desktop: right for the default and /invoice branches, left only for /farmer (map zoom owns bottom-right)
  assert.equal((pos.match(/lg:left-auto lg:right-6'/g) ?? []).length, 2);
  assert.match(pos, /\? 'bottom-\[188px\] left-4 lg:bottom-\[100px\] lg:left-4'/);
  assert.match(w, /const fabRightOnDesktop = !pathname\.startsWith\('\/farmer'\);/);
  // the chat panel opens on the same side as its launcher
  assert.match(w, /\$\{fabRightOnDesktop \? 'lg:left-auto lg:right-6' : ''\}/);
  // the top-right network map legend now stops above the launcher instead of growing onto it
  // …but never below a floor: on a short phone map the clearance alone drove it negative and hid
  // the toggle, so the closed legend keeps 48px and an open one keeps up to 240px of the map.
  const map = read('components/network/NetworkMap.tsx');
  assert.match(map, /'max\(min\(240px, calc\(100% - var\(--legend-top, 100px\) - 12px\)\), calc\(100% - var\(--legend-top, 100px\) - var\(--lima-fab-clearance, 0px\)\)\)'/);
  assert.match(map, /: 'max\(48px, calc\(100% - var\(--legend-top, 100px\) - var\(--lima-fab-clearance, 0px\)\)\)',\s*overflowY: 'auto',/);
});
