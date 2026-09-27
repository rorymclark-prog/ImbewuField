import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// design-07: the on-screen sheet picker in DesignPrint.tsx rendered its nine sheet names
// (`{l.no} · {l.label}` — "Existing Site & Base", "Sector Analysis", etc.) straight from
// PrintLayer.label with no t() call at all. That label is ALSO the title painted onto the
// exported PDF/PNG (ctx.fillText in renderPage) — a document that gets printed, filed and sent
// to a funder, and tests/design-studio-i18n.test.ts already pins that nothing painted onto an
// exported sheet may come from the UI translator. So the fix adds a separate `labelKey` used only
// by the on-screen picker; `label` (and the 'Your design' placeName fallback used by the same
// canvas title) must keep flowing into ctx.fillText untranslated.

const SOURCE = readFileSync(new URL('../components/design/DesignPrint.tsx', import.meta.url), 'utf8');

test('the on-screen sheet picker reads its names through t(), not raw PrintLayer.label', () => {
  assert.match(SOURCE, /\{l\.no\} · \{t\(l\.labelKey\)\}/,
    'the sheet-picker buttons must render the translated labelKey, not the raw English label');
  assert.doesNotMatch(SOURCE, /\{l\.no\} · \{l\.label\}/,
    'sheet-picker regressed to the raw English label');

  for (const key of [
    'designPrintSheetBase', 'designPrintSheetSector', 'designPrintSheetZones',
    'designPrintSheetWater', 'designPrintSheetEarthworks', 'designPrintSheetPlanting',
    'designPrintSheetStructures', 'designPrintSheetAll', 'designPrintSheetImplementation',
  ]) {
    assert.match(SOURCE, new RegExp(`labelKey: '${key}'`), `PRINT_LAYERS is missing labelKey ${key}`);
  }
});

test('the exported sheet title still paints the fixed-language label, never a translated one', () => {
  // The load-bearing guard already lives in tests/design-studio-i18n.test.ts
  // ("localising UI chrome does not translate load-bearing text painted onto exported sheets");
  // this test pins the specific fields that must keep feeding it.
  assert.match(SOURCE, /ctx\.fillText\(`\$\{layer\.no\} — \$\{layer\.label\}`/,
    'the printed title block must keep painting layer.label (English, fixed), not a translated labelKey');
  assert.doesNotMatch(SOURCE, /ctx\.fillText\(`\$\{layer\.no\} — \$\{t\(/,
    'the printed title block must not paint a translated sheet name onto the exported sheet');
  assert.match(SOURCE, /placeName \|\| 'Your design'/,
    '\'Your design\' is the English fallback painted onto the exported sheet title and must stay fixed-language');
});
