import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
  MANUAL_CHAPTERS, MANUAL_LANGS, MANUAL_LANG_NAMES, blockShape, chapterTitle, isManualChapter, isManualLang, manualUi,
  parseInline, parseManual, type ManualFigure,
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

test('paused Xitsonga manual drafts stay on disk but are excluded from public routes and pickers', () => {
  assert.deepEqual(MANUAL_LANGS, ['en', 'zu', 'st', 've']);
  assert.deepEqual(Object.keys(MANUAL_LANG_NAMES), MANUAL_LANGS);
  assert.equal(isManualLang('ts'), false, 'the route guard must reject /manual/ts');

  const pausedDrafts = readdirSync(path.join(ROOT, 'content', 'manual', 'ts')).filter(name => name.endsWith('.md'));
  assert.ok(pausedDrafts.length >= 12, 'the existing Xitsonga chapter drafts remain on disk');
  assert.ok(existsSync(file('ts', '00-introduction')), 'the introduction draft remains available for later review');
  assert.ok(existsSync(path.join(ROOT, 'content', 'manual', 'ts', 'ui.json')));

  // Both dynamic routes use this allowlist for static params and reject unknown languages.
  const contentsRoute = readFileSync(path.join(ROOT, 'app', 'manual', '[lang]', 'page.tsx'), 'utf8');
  const chapterRoute = readFileSync(path.join(ROOT, 'app', 'manual', '[lang]', '[slug]', 'page.tsx'), 'utf8');
  assert.match(contentsRoute, /dynamicParams = false/);
  assert.match(contentsRoute, /MANUAL_LANGS\.map\(\(lang\) => \(\{ lang \}\)\)/);
  assert.match(chapterRoute, /dynamicParams = false/);
  assert.match(chapterRoute, /MANUAL_LANGS\.flatMap\(/);
});

test('the menu links to the manual', () => {
  const drawer = readFileSync(path.join(ROOT, 'components', 'NavDrawer.tsx'), 'utf8');
  assert.match(drawer, /href: '\/manual'/);
});

// ── Figures (content/manual/figures.json → public/manual/figures/) ────────────────────────────
//
// An entry whose file is missing is a replacement slot waiting for a picture (the loader hides it),
// so only entries whose file exists are checked against the file.

const figuresDir = path.join(ROOT, 'public', 'manual', 'figures');
const figures = JSON.parse(readFileSync(path.join(ROOT, 'content', 'manual', 'figures.json'), 'utf8')) as ManualFigure[];
const figureFile = (f: ManualFigure) => path.join(ROOT, 'public', f.src.replace(/^\//, ''));

/** Pixel size from a JPEG's SOF marker (baseline, progressive or lossless), or null if not a JPEG. */
function jpegSize(buf: Buffer): { width: number; height: number } | null {
  if (buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < buf.length) {
    if (buf[i] !== 0xff) return null;
    const marker = buf[i + 1];
    if (marker === 0xff) { i++; continue; } // fill byte
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { i += 2; continue; } // no length
    const len = buf.readUInt16BE(i + 2);
    const isSof = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isSof) return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    if (marker === 0xda || marker === 0xd9) return null; // start of scan / end of image before any SOF
    i += 2 + len;
  }
  return null;
}

test('jpegSize reads a baseline SOF0 header', () => {
  const buf = Buffer.from([
    0xff, 0xd8, // SOI
    0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, // APP0, 2 bytes of payload
    0xff, 0xc0, 0x00, 0x0b, 0x08, 0x02, 0x1a, 0x05, 0x78, 0x01, 0x01, 0x11, 0x00, // SOF0: 538 x 1400
  ]);
  assert.deepEqual(jpegSize(buf), { width: 1400, height: 538 });
  assert.equal(jpegSize(Buffer.from('not a jpeg')), null);
});

test('figures.json: unique ids, known chapters, sections that exist, English captions', () => {
  const ids = new Set<string>();
  for (const f of figures) {
    assert.ok(!ids.has(f.id), `duplicate figure id ${f.id}`);
    ids.add(f.id);
    assert.ok(isManualChapter(f.chapter), `${f.id}: unknown chapter ${f.chapter}`);
    const sections = parseManual(read('en', f.chapter)).filter((b) => b.type === 'h2').length;
    assert.ok(Number.isInteger(f.section) && f.section >= -1 && f.section <= sections - 1,
      `${f.id}: section ${f.section} is outside -1..${sections - 1} for ${f.chapter}`);
    assert.ok(typeof f.caption?.en === 'string' && f.caption.en.trim(), `${f.id}: missing English caption`);
    assert.equal(f.src, `/manual/figures/${f.id}.jpg`, `${f.id}: src must be /manual/figures/<id>.jpg`);
    assert.ok(f.width > 0 && f.height > 0, `${f.id}: width/height`);
  }
});

test('figure files: at most 400 KB and the size figures.json says', () => {
  for (const f of figures) {
    const file = figureFile(f);
    if (!existsSync(file)) continue;
    assert.ok(statSync(file).size <= 400 * 1024, `${f.id}: ${Math.round(statSync(file).size / 1024)} KB is over 400 KB`);
    const size = jpegSize(readFileSync(file));
    assert.ok(size, `${f.id}: not a readable JPEG`);
    assert.deepEqual(size, { width: f.width, height: f.height }, `${f.id}: figures.json says ${f.width}x${f.height}`);
  }
});

test('every file in public/manual/figures/ is listed in figures.json', () => {
  if (!existsSync(figuresDir)) return;
  const listed = new Set(figures.map((f) => path.basename(f.src)));
  for (const name of readdirSync(figuresDir)) {
    if (name.startsWith('.')) continue;
    assert.ok(listed.has(name), `public/manual/figures/${name} is not in content/manual/figures.json`);
  }
});
