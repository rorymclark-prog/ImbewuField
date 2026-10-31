import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('w21-01: the 404 page text follows the theme instead of fixed ink hex', () => {
  const nf = read('app/not-found.tsx');
  assert.doesNotMatch(nf, /#20190F|#5C5040|#755942/);
  assert.match(nf, /var\(--text-primary\)/);
  assert.match(nf, /var\(--text-secondary\)/);
});

test('w21-02: /farmer header keeps the 8px gap until lg so the isiZulu bar fits at 768px', () => {
  const f = read('app/farmer/page.tsx');
  assert.match(f, /px-3 md:px-5 gap-2 lg:gap-3 overflow-hidden/);
  assert.doesNotMatch(f, /gap-2 md:gap-3 overflow-hidden/);
});

test('w21-04: the Learn link is translated on /farmer and the community profile', () => {
  for (const p of ['app/farmer/page.tsx', 'app/community/profile/page.tsx']) {
    const src = read(p);
    assert.doesNotMatch(src, /<LessonLink id="[^"]+" label="Learn" \/>/, p);
    // The four-language track routes the community profile through the shared homeLearnAction key,
    // which also covers Sesotho, Xitsonga and Tshivenda; either form keeps the link translated.
    // isiXhosa may read the inline draft of the same English 'Learn'.
    assert.match(src, /label=\{(?:lang === 'zu' \? 'Funda' : (?:'Learn'|inlineText\(lang, 'Learn'\))|(?:lang === 'xh' \? inlineText\(lang, 'Learn'\) : )?t\('homeLearnAction'\))\}/, p);
  }
});

test('w21-05: the coach isiZulu notice and speak button use the muted token', () => {
  const c = read('components/NextStepCoach.tsx');
  assert.doesNotMatch(c, /#775F3E|color="#755942"/);
});

test('w21-06: earth emerald clears 4.5:1 as text on the page', () => {
  const css = read('app/globals.css');
  const earth = css.slice(css.indexOf('html[data-theme="earth"]'));
  assert.match(earth, /--emerald: #346A15;/);
});

test('w21-07/08: Study finance notice, rainfall chart and calendar note use theme tokens', () => {
  assert.doesNotMatch(read('components/studies/FinanceZu.tsx'), /color: '#5C5040'/);
  const rain = read('components/RainfallChart.tsx');
  assert.doesNotMatch(rain, /\btext-text-|\btext-accent-/);
  assert.doesNotMatch(read('app/calendar/page.tsx'), /text-stone-600/);
});

test('w21-11: the pressed MEL toggle tint sits on the opaque input fill, not the forest hero', () => {
  const mel = read('components/MelDashboard.module.css');
  assert.match(mel, /\.root button\[aria-pressed=true\] \{ background:linear-gradient\(var\(--badge-bg\),var\(--badge-bg\)\),var\(--input-bg\);/);
});
