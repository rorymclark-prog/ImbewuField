import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('w22-01: /home computes the day and date after mount, never during the prerendered render', () => {
  const home = read('app/home/page.tsx');
  assert.match(home, /const \[dayDate, setDayDate\] = useState\(''\);/);
  assert.match(home, /useEffect\(\(\) => \{ setDayDate\(getDayDate\(lang\)\); \}, \[lang\]\);/);
  // getDayDate may only be called from that effect; a call in JSX bakes the build day into the HTML.
  const calls = home.match(/getDayDate\(lang\)/g) ?? [];
  assert.equal(calls.length, 1, 'getDayDate(lang) must appear exactly once, inside the effect');
});

test('w22-05/06: isiZulu draft source labels use the secondary text token on tinted panels', () => {
  assert.match(read('app/calendar/page.tsx'), /text-\[var\(--text-secondary\)\]">isiZulu translation pending — English source: /);
  assert.match(read('components/studies/DesignDraftCopy.module.css'), /\.source \{[^}]*color:var\(--text-secondary\);/);
});
