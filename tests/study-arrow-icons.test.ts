import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

// ux-12 (arrow part): Study buttons and links use a Lucide arrow (components/studies/ArrowLabel.tsx),
// never a text "→" / "←" in JSX text, so the arrow cannot wrap onto a line of its own.
const walk = (dir: string): string[] => readdirSync(dir).flatMap(name => {
  const full = join(dir, name);
  return statSync(full).isDirectory() ? walk(full) : /\.tsx$/.test(name) ? [full] : [];
});
const files = [...walk('app/student'), ...walk('components/studies')].filter(f => !f.endsWith('ArrowLabel.tsx'));

test('no literal arrow glyph in JSX text in app/student or components/studies', () => {
  const offenders: string[] = [];
  for (const file of files) {
    const src = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    // JSX text sits between a closing ">" and the next "<" or "{".
    for (const m of src.matchAll(/>([^<>{}]*[→←][^<>{}]*)(?=[<{])/g)) offenders.push(`${file}: ${m[1].trim()}`);
  }
  assert.deepEqual(offenders, []);
});

test('ArrowLabel renders Lucide icons, hidden from assistive tech, and strips glyphs from strings', () => {
  const src = readFileSync('components/studies/ArrowLabel.tsx', 'utf8');
  assert.match(src, /ArrowRight/);
  assert.match(src, /ArrowLeft/);
  assert.match(src, /aria-hidden/);
  assert.match(src, /whiteSpace: 'nowrap'/);
});

test('DesignDraftCopy routes translated arrows through ArrowLabel', () => {
  const src = readFileSync('components/studies/DesignDraftCopy.tsx', 'utf8');
  assert.match(src, /ArrowLabel/);
  assert.match(src, /stripArrow\(en\)/);
});
