import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
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

// w17-01: widened guard. Scans every *.tsx and *.module.css under app/ and components/ and fails when
// a forest-800 or emerald fill is paired with plain var(--on-forest) in the same CSS rule or the same
// inline style object / line. Codex-owned crop paths are excluded.
const EXCLUDED = [/^app\/facilitator\/crops\//, /^app\/cropplan\//, /^app\/plan\//, /^components\/crop[^/]*\//];
// owned by another track, wave 17: add "file:line" entries here with that comment
const ALLOW: string[] = [
  'app/community/messages/[threadId]/page.tsx:232', // owned by another track, wave 17
  'app/design/page.tsx:586', // owned by another track, wave 17
  'app/design/page.tsx:4487', // owned by another track, wave 17
  'components/SiteManageMenu.tsx:67', // owned by another track, wave 17
];

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(join(root, dir))) {
    const rel = `${dir}/${name}`;
    if (statSync(join(root, rel)).isDirectory()) walk(rel, out);
    else if (/\.tsx$|\.module\.css$/.test(name) && !EXCLUDED.some(r => r.test(rel))) out.push(rel);
  }
  return out;
}

const FILL = /(background(-color)?\s*[:=]|\bbg-\[)[^;}]*var\(--(color-forest-800|emerald)\)|background(Color)?:\s*(FOREST|GREEN)\b/;
const PLAIN = /(?<![\w-])(color\s*[:=]|text-\[)[^;}]*var\(--on-forest\)/;
const PLAIN_ANY = /var\(--on-forest\)/;

test('w17-01: no forest-800/emerald fill is paired with plain --on-forest text (all tsx + module.css)', () => {
  const hits: string[] = [];
  for (const f of [...walk('app'), ...walk('components')]) {
    const src = readFileSync(join(root, f), 'utf8').replace(/var\(--on-forest-800, var\(--on-forest\)\)/g, 'OK');
    const isCss = f.endsWith('.css');
    // CSS: per rule. TSX: per line (style objects here are single-line or one declaration per line, so also scan 6-line windows).
    const units: { text: string; line: number }[] = isCss
      ? [...src.matchAll(/[^{}]*\{[^{}]*\}/g)].map(m => ({ text: m[0], line: src.slice(0, m.index).split('\n').length }))
      : src.split('\n').map((_, i, a) => ({ text: a.slice(i, i + 6).join('\n'), line: i + 1 }));
    for (const u of units) {
      const lines = isCss ? [u.text] : [u.text.split('\n')[0]];
      const body = isCss ? u.text : lines[0];
      const windowText = isCss ? u.text : u.text;
      if (!(FILL.test(isCss ? body : windowText.split('\n').slice(0, 1).join('')) || (!isCss && FILL.test(body)))) continue;
      const scope = isCss ? body : windowText.slice(0, windowText.indexOf('}') >= 0 ? windowText.indexOf('}') : undefined);
      if (PLAIN_ANY.test(scope) && (isCss ? PLAIN.test(scope) : true)) {
        const key = `${f}:${u.line}`;
        if (!ALLOW.includes(key)) hits.push(key);
      }
    }
  }
  assert.deepEqual(hits, [], `forest-800/emerald fill with plain --on-forest text:\n${hits.join('\n')}`);
});
