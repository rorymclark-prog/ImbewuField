import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Wave 15 isiZulu/records track: code-12 (no font-mono) and code-15 (outline-none keeps a ring)
// in the files this track owns.
const OWNED = [
  'components/DataPanel.tsx', 'components/LifeGuide.tsx', 'components/WaterBalance.tsx',
  'components/MyRecords.tsx', 'app/records/page.tsx', 'components/records/ReceiptPreview.tsx',
  'components/records/RecordQuantityFields.tsx', 'components/CropSelect.tsx', 'components/SavedPlaces.tsx',
  'components/LangSwitcher.tsx', 'app/calendar/page.tsx', 'components/report/SavedReportsList.tsx',
  'app/login/page.tsx', 'app/farmer/page.tsx', 'app/prices/page.tsx', 'components/BrandLogo.tsx',
];

test('owned files carry no font-mono', () => {
  for (const f of OWNED) {
    const src = readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
    assert.doesNotMatch(src, /font-mono|--font-mono/, `${f} still uses font-mono`);
  }
});

test('outline-none is always paired with a focus-visible ring in owned files', () => {
  for (const f of OWNED) {
    const lines = readFileSync(new URL(`../${f}`, import.meta.url), 'utf8').split('\n');
    for (const line of lines) {
      if (/\boutline-none\b/.test(line)) assert.match(line, /focus-visible:ring/, `${f}: ${line.trim().slice(0, 90)}`);
    }
  }
});

test('farmer page saved-site error names the Site reports destination', () => {
  // The English dictionary (lib/i18n.tsx) is hash-pinned whole-file by
  // tests/study-ui-due-unlock-history-checks.ts, so the string stays inline until the integrator
  // re-pins and moves it behind a t() key.
  const src = readFileSync(new URL('../app/farmer/page.tsx', import.meta.url), 'utf8');
  assert.match(src, /Go back to Site reports and choose another site\./);
  assert.doesNotMatch(src, /Return to Site reports/);
});
