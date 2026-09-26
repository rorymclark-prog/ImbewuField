import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
  MANUAL_CHAPTERS, MANUAL_LANGS, blockShape, chapterTitle, manualUi, parseInline, parseManual,
} from '@/lib/manual';

// THE PERMACULTURE MANUAL (app/manual). Chapter text is Markdown in content/manual/<lang>/, written
// by hand and by translation passes, so these checks are what keeps it renderable and honest:
// every chapter exists in English, every translation keeps the English chapter's shape (same
// headings, same number of list items, callouts and table rows — a dropped Safety box or a missing
// step is exactly what a reviewer who cannot read the language would never spot), and nothing the
// renderer does not support sneaks in.

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = (lang: string, slug: string) => path.join(ROOT, 'content', 'manual', lang, `${slug}.md`);
const read = (lang: string, slug: string) => readFileSync(file(lang, slug), 'utf8');

test('inline parser: bold, italic and unmatched markers', () => {
  assert.deepEqual(parseInline('Plant **comfrey** (*Symphytum*) now'), [
    { text: 'Plant ' }, { text: 'comfrey', bold: true }, { text: ' (' }, { text: 'Symphytum', italic: true }, { text: ') now' },
  ]);
  assert.deepEqual(parseInline('2 * 3 = 6'), [{ text: '2 * 3 = 6' }]);
});

test('block parser covers the whole STYLE.md subset', () => {
  const md = [
    '# Title', '', '## Section', '### Sub', '', 'One line', 'continues here.', '',
    '- a', '- b', '', '1. first', '2. second', '', '> **Safety:** cover tanks.', '> Always.', '',
    '| Plant | Use |', '|---|---|', '| Comfrey | mulch |', '| Vetiver | erosion |',
  ].join('\n');
  const blocks = parseManual(md);
  assert.deepEqual(blockShape(blocks), ['h1', 'h2', 'h3', 'p', 'ul:2', 'ol:2', 'callout', 'table:2x2']);
  assert.equal(chapterTitle(md), 'Title');
  const para = blocks[3];
  assert.ok(para.type === 'p' && para.content[0].text === 'One line continues here.');
});

test('every chapter exists in English with a single title', () => {
  for (const slug of MANUAL_CHAPTERS) {
    assert.ok(existsSync(file('en', slug)), `missing content/manual/en/${slug}.md`);
    const titles = parseManual(read('en', slug)).filter((b) => b.type === 'h1');
    assert.equal(titles.length, 1, `${slug}: expected exactly one "# " title`);
  }
});

// Paragraph counts may differ (a translator can split a long sentence); everything else may not.
const structure = (md: string) => blockShape(parseManual(md)).filter((s) => s !== 'p');

// A language may be missing a chapter — the reader shows the English one, marked lang="en" — but a
// chapter that IS translated must match.
test('each translated chapter keeps the English structure', () => {
  for (const lang of MANUAL_LANGS.filter((l) => l !== 'en')) {
    for (const slug of MANUAL_CHAPTERS) {
      if (!existsSync(file(lang, slug))) continue;
      assert.deepEqual(structure(read(lang, slug)), structure(read('en', slug)), `${lang}/${slug} drifted from the English structure`);
    }
  }
});

test('chapter files use only the supported Markdown subset', () => {
  for (const lang of MANUAL_LANGS) {
    for (const slug of MANUAL_CHAPTERS) {
      if (!existsSync(file(lang, slug))) continue;
      const md = read(lang, slug);
      assert.doesNotMatch(md, /<\/?[a-z][^>]*>/i, `${lang}/${slug}: raw HTML`);
      assert.doesNotMatch(md, /!\[|\]\(/, `${lang}/${slug}: images/links are not rendered`);
      assert.doesNotMatch(md, /^```/m, `${lang}/${slug}: code blocks are not rendered`);
      assert.doesNotMatch(md, /\bFig(ure)?\.?\s*\d+\s*:/, `${lang}/${slug}: leftover figure caption`);
      assert.doesNotMatch(md, /[-]/, `${lang}/${slug}: symbol-font bullet from the PDF`);
    }
  }
});

test('Tshivenḓa chapters use the Tshivenḓa letters', () => {
  for (const slug of MANUAL_CHAPTERS) {
    if (!existsSync(file('ve', slug))) continue;
    assert.match(read('ve', slug), /[ḓḽṅṋṱḒḼṄṊṰ]/, `ve/${slug} has no ḓ ḽ ṅ ṋ ṱ — likely typed as plain d l n t`);
  }
});

// Blank values fall back to English per key (lib/manual.ts manualUi), so a language whose chapters
// are translated must have its UI strings filled in too, or its pages would mix languages.
test('UI strings: English complete, translated languages complete, placeholders kept', () => {
  const english = manualUi('en');
  for (const lang of MANUAL_LANGS) {
    const own = JSON.parse(readFileSync(path.join(ROOT, 'content', 'manual', lang, 'ui.json'), 'utf8')) as Record<string, string>;
    assert.deepEqual(Object.keys(own).sort(), Object.keys(english).sort(), `${lang}/ui.json keys differ from English`);
    const hasChapters = MANUAL_CHAPTERS.some((slug) => existsSync(file(lang, slug)));
    if (!hasChapters) continue;
    for (const key of Object.keys(english)) {
      assert.ok(own[key].trim(), `${lang} has translated chapters but ui.json "${key}" is blank`);
    }
    assert.ok(own.minutes.includes('{n}'), `${lang}/ui.json "minutes" must keep the {n} placeholder`);
  }
});

test('the menu links to the manual', () => {
  const drawer = readFileSync(path.join(ROOT, 'components', 'NavDrawer.tsx'), 'utf8');
  assert.match(drawer, /href: '\/manual'/);
});
