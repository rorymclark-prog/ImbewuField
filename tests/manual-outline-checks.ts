import assert from 'node:assert/strict';
import test from 'node:test';
import { inlineText, MANUAL_CHAPTERS, MANUAL_LANGS, parseManual, type ManualChapter, type ManualLang } from '@/lib/manual';
import { readChapter } from '@/lib/manual-content';
import { manualGlossaryAnchor, manualOutline } from '@/lib/manual-outline';

function chapterBody(lang: ManualLang, slug: ManualChapter) {
  const markdown = readChapter(lang, slug) ?? readChapter('en', slug);
  assert.ok(markdown, slug);
  const blocks = parseManual(markdown);
  const title = blocks.find((block) => block.type === 'h1');
  return blocks.filter((block) => block !== title);
}

test('outline anchors follow heading structure, including repeated names and leading subheadings', () => {
  const body = parseManual('### First\n\nA paragraph\n\n## Name\n\n### Name\n\n### Name\n\n## Last');
  assert.deepEqual(manualOutline(body).map(({ anchor, blockIndex }) => [anchor, blockIndex]), [
    ['section-0-1', 0], ['section-1', 2], ['section-1-1', 3], ['section-1-2', 4], ['section-2', 5],
  ]);
  const expanded = [...parseManual('Another paragraph'), ...body];
  assert.deepEqual(manualOutline(expanded).map((h) => h.anchor), manualOutline(body).map((h) => h.anchor));
});

test('every translated outline points to the local heading at the same chapter anchor', () => {
  for (const slug of MANUAL_CHAPTERS) {
    const english = manualOutline(chapterBody('en', slug));
    const anchors = english.map((h) => h.anchor);
    assert.equal(new Set(anchors).size, anchors.length);
    for (const lang of MANUAL_LANGS) {
      const body = chapterBody(lang, slug);
      const outline = manualOutline(body);
      assert.deepEqual(outline.map((h) => h.anchor), anchors, `${lang}/${slug}`);
      for (const { blockIndex, title, level } of outline) {
        const block = body[blockIndex];
        assert.ok(block.type === 'h2' || block.type === 'h3');
        assert.equal(block.type, `h${level}`);
        assert.equal(title, inlineText(block.content));
      }
    }
  }
});

test('individual glossary terms have unique, shareable anchors in all five editions', () => {
  const terms = (lang: ManualLang) => {
    const table = chapterBody(lang, '12-glossary').find((block) => block.type === 'table');
    assert.ok(table?.type === 'table');
    return table.rows.map((row) => manualGlossaryAnchor(inlineText(row[0])));
  };
  const anchors = terms('en');
  assert.equal(new Set(anchors).size, anchors.length);
  assert.ok(anchors.every((id) => /^term-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)));
  assert.ok(anchors.includes('term-first-flush-diverter'));
  assert.ok(anchors.includes('term-ph'));
  for (const lang of MANUAL_LANGS) assert.deepEqual(terms(lang), anchors);
});
