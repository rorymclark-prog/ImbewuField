import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');

function tsxFiles(dir: string): string[] {
  return readdirSync(join(root, dir)).flatMap(name => {
    const rel = join(dir, name);
    if (name === 'node_modules' || name.startsWith('.')) return [];
    return statSync(join(root, rel)).isDirectory() ? tsxFiles(rel) : rel.endsWith('.tsx') ? [rel] : [];
  });
}

// A <style> text child is HTML-escaped by the server (">" becomes "&gt;"), but the browser reads
// <style> content raw, so the server copy no longer matches the client and React throws a
// hydration mismatch (#425) on every load. /offline shipped this in wave 18; such CSS has to go
// through dangerouslySetInnerHTML instead.
test('no <style> text child contains characters the server would escape', () => {
  const offenders: string[] = [];
  for (const file of [...tsxFiles('app'), ...tsxFiles('components')]) {
    const src = readFileSync(join(root, file), 'utf8');
    for (const m of src.matchAll(/<style>\{\s*(['"`])([\s\S]*?)\1\s*\}<\/style>/g)) {
      if (/[<>&]/.test(m[2])) offenders.push(`${file}:${src.slice(0, m.index).split('\n').length}`);
    }
  }
  assert.deepEqual(offenders, []);
});

test('/offline keeps its open-state chevron rule in raw HTML', () => {
  const src = readFileSync(join(root, 'app/offline/page.tsx'), 'utf8');
  assert.match(src, /<style dangerouslySetInnerHTML=\{\{__html:'[^']*details\[open\]>\.offline-summary/);
});
