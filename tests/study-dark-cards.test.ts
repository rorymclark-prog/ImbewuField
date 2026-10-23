import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// w16-04: the Study design/guide CSS modules painted literal light cards under theme text, so in
// dark the text was light-on-light (1.07-1.24:1). Cards must sit on theme tokens.
const MODULES = [
  'components/studies/AppGuide.module.css',
  'components/studies/DesignScalePractice.module.css',
  'components/studies/DesignPortfolio.module.css',
  'components/studies/DesignWorkedDiagram.module.css',
];
const LIGHT_CARDS = ['#E9EFDF', '#F0F3E9', '#EEF2E6', '#FFFEFA', '#E4DCC6'];

for (const rel of MODULES) {
  test(`${rel} paints no literal light card hex`, () => {
    const css = readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');
    for (const hex of LIGHT_CARDS) {
      assert.ok(!css.toLowerCase().includes(hex.toLowerCase()), `${rel} contains ${hex}; use var(--bg-1)/var(--bg-2) or a color-mix tint`);
    }
  });
}

test('AppGuide cards and the leaf tint are token based', () => {
  const css = readFileSync(new URL(`../${MODULES[0]}`, import.meta.url), 'utf8');
  assert.match(css, /\.practice \{[^}]*background: color-mix\(in srgb, var\(--color-leaf-500\) 12%, var\(--bg-1\)\)/);
  assert.match(css, /\.page \{[^}]*color: var\(--text-primary\)/);
});

test('leaf is never used as text colour in the four modules', () => {
  for (const rel of MODULES) {
    const css = readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');
    assert.doesNotMatch(css, /[^-]color:\s*var\(--color-leaf-500\)/, `${rel} paints leaf as text`);
  }
});
