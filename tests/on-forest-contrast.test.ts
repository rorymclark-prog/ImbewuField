import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const css = readFileSync(join(root, 'app/globals.css'), 'utf8');

function lum(hex: string): number {
  const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function ratio(a: string, b: string): number {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const COLUMNS = [
  'html[data-theme="earth"] {',
  'html[data-theme="earth"].dark {',
  'html[data-theme="slate"] {',
  'html[data-theme="slate"].dark {',
];

function block(open: string): string {
  const start = css.indexOf('\n' + open);
  assert.ok(start >= 0, `theme column ${open} missing`);
  return css.slice(start, css.indexOf('\n}', start));
}

test('--on-forest-800 is declared in every theme column and reads on --color-forest-800', () => {
  for (const col of COLUMNS) {
    const b = block(col);
    const on = b.match(/--on-forest-800:\s*(#[0-9A-Fa-f]{6})/)?.[1];
    // earth light inherits the :root value
    const fill = (b.match(/--color-forest-800:\s*(#[0-9A-Fa-f]{6})/) ?? css.match(/--color-forest-800:\s*(#[0-9A-Fa-f]{6})/))?.[1];
    assert.ok(on, `${col} declares --on-forest-800`);
    assert.ok(fill, `${col} declares --color-forest-800`);
    assert.ok(ratio(on!, fill!) >= 4.5, `${col}: ${on} on ${fill} = ${ratio(on!, fill!).toFixed(2)}`);
  }
});

test('--on-forest itself is unchanged', () => {
  assert.equal((css.match(/--on-forest:\s*#F7F2E9;/g) ?? []).length, 4);
});

const FIXED = [
  'app/account/page.tsx', 'app/community/u/[uid]/page.tsx', 'app/home/page.tsx', 'app/invoice/page.tsx',
  'app/mentor/page.tsx', 'app/ngo/page.tsx', 'app/not-found.tsx', 'app/reports/page.tsx', 'app/updates/page.tsx',
  'components/CropSelect.tsx', 'components/ContactInbox.tsx', 'components/DataPanel.tsx',
  'components/EvidenceSheet.tsx', 'components/EvidenceCatalogue.tsx', 'components/Map.tsx',
  'components/MyRecords.tsx', 'components/PhotoUpload.tsx', 'components/ProfileSheet.tsx',
  'components/atlas/AtlasExplorer.tsx', 'components/community/NearbyMap.tsx',
  'components/exchange/ShareListingButton.tsx', 'components/home/HomeHeroCard.tsx',
  'components/journal/FieldJournal.tsx', 'components/journal/JournalEntrySheet.tsx',
];

test('no line paints var(--on-forest) text on a var(--color-forest-800) background', () => {
  for (const f of FIXED) {
    readFileSync(join(root, f), 'utf8').split('\n').forEach((line, i) => {
      const bgForest = /(background|bg-\[?)[^;]*var\(--color-forest-800\)/.test(line);
      const badText = /var\(--on-forest\)/.test(line.replace(/var\(--on-forest-800, var\(--on-forest\)\)/g, ''));
      assert.ok(!(bgForest && badText), `${f}:${i + 1} pairs forest-800 fill with --on-forest`);
    });
  }
});

test('w16-02: LessonLink and the Design labels paint text with the themed forest token, not the fixed green', () => {
  const lesson = readFileSync(join(root, 'components/design/LessonLink.tsx'), 'utf8');
  assert.match(lesson, /const GREEN = 'var\(--color-forest-800\)'/);
  const design = readFileSync(join(root, 'app/design/page.tsx'), 'utf8');
  assert.match(design, /textTransform: 'uppercase', color: 'var\(--color-forest-800\)'/);
  assert.match(design, /color: 'var\(--color-forest-800\)', fontWeight: 600, flexShrink: 0 \}\}>\{isZulu \? 'Klama →'/);
});
