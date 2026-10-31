// Browser tab titles in isiXhosa (components/DocumentTitle.tsx).
//
// The metadata titles in app/**/layout.tsx stay static English (tests/page-titles.test.ts), so
// the translation happens in the browser: a client component mounted once inside the language
// provider rewrites document.title when the language is isiXhosa. This pins that the component
// exists, is mounted, only acts for 'xh', survives Next.js re-setting the title, and that every
// static metadata title has an isiXhosa draft (or is listed as intentionally English).
//
// Run with:
//   node --import ./tests/register-alias.mjs --test tests/xh-document-title.test.ts

import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { XH_INLINE_SOURCE } from '@/lib/locales/xh-inline/index';

const ROOT = new URL('..', import.meta.url).pathname;
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');
const SUFFIX = ' — ImbewuField';

// Page parts that deliberately stay English in the tab: a feature name, not a phrase.
const INTENTIONAL_ENGLISH = new Set<string>([
  'Lima Vision',
]);

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) sourceFiles(path, out);
    else if (/\.tsx$/.test(name)) out.push(path);
  }
  return out;
}

/** Every static (plain string literal) title a route exports as metadata, plus legacy document.title writes. */
function staticTitles(): { file: string; title: string }[] {
  const found: { file: string; title: string }[] = [];
  for (const file of sourceFiles(join(ROOT, 'app'))) {
    const src = readFileSync(file, 'utf8');
    const rel = file.slice(ROOT.length);
    const meta = src.match(/export const metadata(?:: *Metadata)? *= *\{/);
    if (meta && meta.index !== undefined) {
      const after = src.slice(meta.index + meta[0].length);
      const m = after.match(/title: *(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)")/);
      // The first `title:` after the export is the page title (openGraph/twitter titles come later).
      if (m) found.push({ file: rel, title: (m[1] ?? m[2]).replace(/\\'/g, "'").replace(/\\"/g, '"') });
    }
    for (const d of src.matchAll(/document\.title\s*=\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)")/g)) {
      found.push({ file: rel, title: d[1] ?? d[2] });
    }
  }
  return found;
}

test('the component exists and acts only for isiXhosa', () => {
  const src = read('components/DocumentTitle.tsx');
  assert.match(src, /^'use client';/m);
  assert.match(src, /useLanguage\(\)/);
  assert.match(src, /usePathname\(\)/);
  assert.match(src, /lang !== 'xh'/, 'must return early for every language but isiXhosa');
  assert.match(src, /inlineText\('xh'/, 'translates through the inline isiXhosa drafts');
  assert.match(src, /SUFFIX/, 'splits off the shared " — ImbewuField" suffix');
});

test('the component survives Next.js re-setting the title, without looping', () => {
  const src = read('components/DocumentTitle.tsx');
  assert.match(src, /new MutationObserver\(/);
  assert.match(src, /observe\(document\.head/);
  assert.match(src, /disconnect\(\)/);
  assert.match(src, /document\.title !== next/, 'only writes when the title differs, so its own write cannot loop');
  assert.match(src, /applied\.current/, 'remembers its own write');
});

test('it is mounted once, inside the language provider, in the root layout', () => {
  const layout = read('app/layout.tsx');
  assert.match(layout, /import DocumentTitle from '@\/components\/DocumentTitle'/);
  assert.equal(layout.match(/<DocumentTitle \/>/g)?.length, 1);
  const provider = layout.indexOf('<LanguageProvider>');
  const mount = layout.indexOf('<DocumentTitle />');
  const close = layout.indexOf('</LanguageProvider>');
  assert.ok(provider !== -1 && mount > provider && mount < close, 'DocumentTitle must sit inside <LanguageProvider> so useLanguage works');
});

test('the layouts keep their static English titles (page-titles.test.ts depends on them)', () => {
  assert.match(read('app/records/layout.tsx'), /title: 'My records — ImbewuField'/);
  assert.doesNotMatch(read('app/records/layout.tsx'), /DocumentTitle|useLanguage/);
});

test('every static metadata title has an isiXhosa draft, or is listed as intentionally English', () => {
  const titles = staticTitles();
  assert.ok(titles.length > 40, `expected to find the metadata titles, found ${titles.length}`);
  const missing: string[] = [];
  for (const { file, title } of titles) {
    const part = title.endsWith(SUFFIX) ? title.slice(0, -SUFFIX.length) : null;
    const drafted = XH_INLINE_SOURCE[title] !== undefined || (part !== null && XH_INLINE_SOURCE[part] !== undefined);
    const english = part !== null && INTENTIONAL_ENGLISH.has(part);
    if (!drafted && !english) missing.push(`${file}: ${JSON.stringify(title)}`);
  }
  assert.deepEqual(missing, [], 'add these titles (or their page part) to lib/locales/xh-inline/g29-document-titles.ts');
});

test('titles listed as intentionally English really are static titles, and have no draft', () => {
  const parts = new Set(staticTitles().map(({ title }) => (title.endsWith(SUFFIX) ? title.slice(0, -SUFFIX.length) : title)));
  for (const english of INTENTIONAL_ENGLISH) {
    assert.ok(parts.has(english), `${english} is no longer a metadata title; drop it from the list`);
    assert.equal(XH_INLINE_SOURCE[english], undefined, `${english} has a draft now; drop it from the intentional-English list`);
  }
});

test('the drafts the component relies on are present and keep the brand', () => {
  assert.equal(XH_INLINE_SOURCE['My records'], 'Iirekhodi zam');
  assert.equal(XH_INLINE_SOURCE['Home'], 'Ikhaya');
  assert.equal(XH_INLINE_SOURCE['ImbewuField — partner deck'], 'ImbewuField — iislayidi zamaqabane');
  // A whole-title key is looked up before the suffix split, so the brand-first titles work.
  const src = read('components/DocumentTitle.tsx');
  assert.ok(src.indexOf("inlineText('xh', english)") < src.indexOf('english.endsWith(SUFFIX)'));
  // Page parts must never carry the suffix themselves, or the split would never find them.
  for (const key of Object.keys(XH_INLINE_SOURCE)) {
    if (!key.endsWith(SUFFIX)) continue;
    assert.fail(`${key} ends with the shared suffix; key the page part only`);
  }
});
