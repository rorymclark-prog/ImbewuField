import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import './manual-outline-checks.ts';
import { fieldFilmTitle, filmEdition, matchingFilmTime } from '@/lib/field-films';
import { COURSE_ASSET_SIZES } from '@/lib/course-asset-sizes';
import { manualSearchIndex } from '@/lib/manual-search-index';
import { prepareManualSearch, searchManual, type ManualSearchSection } from '@/lib/manual-search';
import { manualGlossaryAnchor, manualOutline } from '@/lib/manual-outline';
import {
  MANUAL_CHAPTERS, MANUAL_LANGS, MANUAL_LANG_NAMES, blockShape, chapterTitle, earthworksFilmPlacements, inlineText, isManualChapter, isManualLang, manualUi,
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

test('each manual search entry opens a chapter, heading, glossary word or field film in its own edition', () => {
  for (const lang of MANUAL_LANGS) {
    const index = manualSearchIndex(lang);
    for (const slug of MANUAL_CHAPTERS) {
      const blocks = parseManual(read(lang, slug));
      const title = blocks.find(block => block.type === 'h1');
      const body = blocks.filter(block => block !== title);
      const anchors = ['chapter-start', ...manualOutline(body).map(heading => heading.anchor)];
      if (slug === '07-earthworks-and-water') {
        const films = index.filter(entry => entry.slug === slug && entry.kind === 'film');
        assert.deepEqual(films.map(entry => entry.anchor), [
          'roof-to-tank-film', 'digging-the-swale-film', 'bottle-irrigation-film', 'drip-irrigation-film', 'check-a-frame', 'peg-a-contour',
        ]);
        const prepared = prepareManualSearch(index);
        for (const [id, anchor] of [['roof', 'roof-to-tank-film'], ['bottle', 'bottle-irrigation-film'], ['drip', 'drip-irrigation-film']] as const) {
          const entry = films.find(film => film.anchor === anchor);
          assert.ok(entry);
          assert.equal(entry.titleLang, lang);
          assert.equal(entry.title, fieldFilmTitle(id, lang));
          assert.equal(searchManual(prepared, entry.title)[0].section, entry);
        }
        const firstPage = searchManual(prepared, 'drip irrigation').slice(0, 6);
        assert.ok(firstPage.some(hit => hit.section.anchor === 'drip-irrigation-film'), `${lang}: find the film using the subsection name`);
        anchors.push(...films.map(entry => entry.anchor));
        assert.ok(films.every(entry => entry.passages.length === 1));
      }
      if (slug === '12-glossary') {
        const glossary = body.find(block => block.type === 'table');
        assert.ok(glossary?.type === 'table');
        for (const [term, ...definition] of glossary.rows) {
          const anchor = manualGlossaryAnchor(inlineText(term));
          anchors.push(anchor);
          const entry: ManualSearchSection | undefined = index.find(item => item.slug === slug && item.anchor === anchor);
          assert.equal(entry?.title, inlineText(term));
          assert.equal(entry?.titleLang, 'en');
          assert.deepEqual(entry?.passages, definition.map(inlineText));
        }
      }
      const entries = index.filter(entry => entry.slug === slug);
      assert.deepEqual(entries.map(entry => entry.anchor).sort(), anchors.sort(), lang + '/' + slug);
      assert.ok(entries.every(entry => entry.lang === lang));
    }
  }
});

test('topic search ranks matching titles and compounds, requires every term and excerpts the matching source text', () => {
  const chapter: ManualSearchSection = {
    slug: '07-earthworks-and-water', chapter: 'Water', lang: 've', anchor: 'chapter-start', title: 'Water', passages: [],
  };
  const exact = { ...chapter, anchor: 'section-1', title: 'Mavu na maḓi', passages: ['A short introduction.'] };
  const quoted = 'Keep the ṱshisima near the bed.';
  const source = 'Read this first. '.repeat(20) + quoted;
  const body = { ...chapter, anchor: 'section-2', title: 'A guide', passages: ['Other text.', source, 'Mavu na maḓi.'] };
  assert.deepEqual(searchManual(prepareManualSearch([body, exact]), '  MAVU–NA madi! ').map(hit => hit.section.anchor), [exact.anchor, body.anchor]);
  const [hit] = searchManual(prepareManualSearch([body]), 'water tshisima');
  assert.ok(hit.excerpt.includes(quoted));
  assert.ok(source.includes(hit.excerpt.replace(/^…|…$/g, '')));
  assert.deepEqual(searchManual(prepareManualSearch([body]), 'water'), []);
  assert.deepEqual(searchManual(prepareManualSearch([body]), 'mavu missing'), []);
  assert.deepEqual(searchManual(prepareManualSearch([body]), '— !'), []);
  const en = prepareManualSearch(manualSearchIndex('en'));
  assert.equal(searchManual(en, 'windbreak')[0].section.anchor, 'term-windbreak');
  assert.equal(searchManual(en, 'A frame')[0].section.anchor, 'check-a-frame');
  assert.ok(searchManual(en, 'digging swales').some(hit => hit.section.title === 'Digging the swale'));
});

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

// Rory's rule (26 Sep 2026): the technical words stay in English in every language, and the
// Glossary's first column is that fixed list. The structure check above only counts rows, so a
// translated or re-ordered word would slip through. Paused languages (Xitsonga) are checked too.
test('every Glossary keeps the English word column exactly', () => {
  const words = (lang: string) => {
    const table = parseManual(read(lang, '12-glossary')).find((b) => b.type === 'table');
    assert.ok(table && table.type === 'table', `${lang}/12-glossary has no table`);
    return table.rows.map((row) => row[0].map((part) => part.text).join('').trim());
  };
  const english = words('en');
  assert.ok(english.length >= 60, 'the English glossary lists the technical words');
  const langs = readdirSync(path.join(ROOT, 'content', 'manual'), { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name !== 'en' && existsSync(file(d.name, '12-glossary')))
    .map((d) => d.name);
  assert.ok(langs.length >= 3, 'the translated glossaries exist');
  for (const lang of langs) assert.deepEqual(words(lang), english, `${lang}/12-glossary changed the English words`);
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
    assert.ok(own.resultCount.includes('{n}'), `${lang}/ui.json search result count must keep the {n} placeholder`);
  }
});

test('all four home languages Rory asked for are public: isiZulu, Sesotho, Tshivenḓa and Xitsonga', () => {
  assert.deepEqual(MANUAL_LANGS, ['en', 'zu', 'st', 've', 'ts']);
  assert.deepEqual(Object.keys(MANUAL_LANG_NAMES), MANUAL_LANGS);
  for (const lang of ['zu', 'st', 've', 'ts']) {
    assert.equal(isManualLang(lang), true, `/manual/${lang} must be served`);
    for (const slug of MANUAL_CHAPTERS) assert.ok(existsSync(file(lang, slug)), `${lang}/${slug} is missing`);
  }

  // Both dynamic routes build every language in MANUAL_LANGS and reject unknown ones.
  const contentsRoute = readFileSync(path.join(ROOT, 'app', 'manual', '[lang]', 'page.tsx'), 'utf8');
  const chapterRoute = readFileSync(path.join(ROOT, 'app', 'manual', '[lang]', '[slug]', 'page.tsx'), 'utf8');
  assert.match(contentsRoute, /dynamicParams = false/);
  assert.match(contentsRoute, /MANUAL_LANGS\.map\(\(lang\) => \(\{ lang \}\)\)/);
  assert.match(chapterRoute, /dynamicParams = false/);
  assert.match(chapterRoute, /MANUAL_LANGS\.flatMap\(/);
});


test('each field film follows its own instruction in all five editions', () => {
  const headings = {
    en: ['Harvesting water from roofs', 'Bottle irrigation', 'Digging the swale', 'Double-reach raised beds', 'Try it'],
    zu: ['Ukuvuna amanzi ophahleni', 'Ukunisela ngebhodlela', 'Ukumba i-swale', 'Imibhede ephakanyisiwe ye-double-reach', 'Zama lokhu'],
    st: ['Ho kotula metsi marulelong', 'Nosetso ka dibotlolo', 'Ho tjheka swale', 'Dibethe tse phahamisitsweng tsa double-reach', 'Leka sena'],
    ve: ['U kuvhanganya maḓi kha mitombo', 'U sheledza nga bodelo', 'U gwa swale', 'Double-reach bed dzo gonyiswaho', 'Lingani'],
    ts: ['Ku hlengeleta mati emalwangwini', 'Ku cheleta hi bodlhela', 'Ku cela swale', 'Ti-double-reach bed leti tlakukeke', 'Ringeta'],
  };
  for (const lang of MANUAL_LANGS) {
    const body = parseManual(read(lang, '07-earthworks-and-water')).filter((b) => b.type !== 'h1');
    const slots = earthworksFilmPlacements(body);
    assert.equal(new Set(slots.map((slot) => slot.anchor)).size, 7, lang);
    const drip = slots.find(slot => slot.anchor === 'drip-irrigation-film');
    assert.ok(drip);
    assert.equal(body[drip.blockIndex - 1].type, 'h3', 'play follows the opening paragraph under the drip heading');
    const locations = slots.map(({ blockIndex, film, afterStep }) => {
      const heading = body.slice(0, blockIndex).reverse().find((b) => b.type === 'h2' || b.type === 'h3');
      assert.ok(heading && 'content' in heading);
      const block = body[blockIndex];
      if (afterStep) assert.ok(block.type === 'ol' && block.items[afterStep - 1]?.length);
      return [film, inlineText(heading.content), block.type, afterStep];
    });
    const [roof, bottle, swale, beds, exercise] = headings[lang];
    assert.deepEqual(locations, [
      ['roof', roof, 'ol', 3],
      ['earth', swale, 'ol', undefined],
      ['earth', beds, 'p', undefined],
      ['bottle', bottle, 'ol', 4],
      ['drip', lang === 'zu' ? 'I-drip irrigation' : 'Drip irrigation', 'p', undefined],
      ['level', exercise, 'ol', 4],
      ['walk', exercise, 'ol', 7],
    ], lang);
  }
});

test('the menu links to the manual', () => {
  const drawer = readFileSync(path.join(ROOT, 'components', 'NavDrawer.tsx'), 'utf8');
  assert.match(drawer, /href: '\/manual'/);
});

test('the My studies introduction links directly to the language-aware manual entry', () => {
  const studies = readFileSync(path.join(ROOT, 'app', 'student', 'page.tsx'), 'utf8');
  const intro = studies.match(/<section[^>]*aria-labelledby="studies-title"[^>]*>([\s\S]*?)<\/section>/)?.[1];
  assert.ok(intro);
  assert.match(intro, /<Link\s+href="\/manual"[^>]*>[\s\S]*?\bt\('navManual'\)[\s\S]*?<\/Link>/);
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

// ManualBlocks puts a section's pictures after its first paragraph, list or table. A section that
// is only headings would drop them without a sound, in any language, so every one must have one.
test('every figure has body text in its section to sit under, in every language', () => {
  const langs = ['en', ...MANUAL_LANGS.filter((l) => l !== 'en')];
  for (const f of figures) {
    for (const lang of langs) {
      if (!existsSync(file(lang, f.chapter))) continue;
      let section = -1;
      let hasBody = false;
      for (const b of parseManual(read(lang, f.chapter))) {
        if (b.type === 'h2') section += 1;
        else if (section === f.section && b.type !== 'h1' && b.type !== 'h3') hasBody = true;
      }
      assert.ok(hasBody, `${f.id}: section ${f.section} of ${lang}/${f.chapter} has no body text, so the picture would never show`);
    }
  }
});

test('every Study module opens its own case, lessons have distinct field tasks, and manual excerpts lead to their exact section in each edition', async () => {
  const { FIELD_CASES, LESSON_FIELD_TASKS } = await import('../lib/study-fieldwork.ts');
  const { COURSE_MODULES } = await import('../lib/course-modules.ts');
  const passages = JSON.parse(readFileSync(path.join(ROOT, 'content/study/manual-passages.json'), 'utf8'));
  const figures: ManualFigure[] = JSON.parse(readFileSync(path.join(ROOT, 'content/manual/figures.json'), 'utf8'));
  const modules = COURSE_MODULES.map(module => module.id).sort();
  const lessons = COURSE_MODULES.flatMap(module => module.lessons.map(lesson => lesson.id)).sort();
  assert.deepEqual(Object.keys(FIELD_CASES).sort(), modules);
  assert.deepEqual(Object.keys(passages).sort(), modules);
  assert.deepEqual(Object.keys(LESSON_FIELD_TASKS).sort(), lessons);
  for (const language of ['en', 'zu'] as const) {
    const tasks = Object.values(LESSON_FIELD_TASKS).map(task => task[language].trim());
    assert.ok(tasks.every(Boolean));
    assert.equal(new Set(tasks).size, lessons.length);
  }
  const editions = MANUAL_LANGS.map(lang => ({ lang, index: manualSearchIndex(lang) }));
  for (const id of modules) {
    const entry = FIELD_CASES[id];
    for (const copy of [entry.title, entry.scene, entry.question, entry.reasoning]) {
      assert.ok(copy.en.trim() && copy.zu.trim() && copy.en !== copy.zu, id);
    }
    if (entry.figure) {
      const figure = figures.find(item => item.id === entry.figure);
      assert.ok(figure && existsSync(path.join(ROOT, 'public', figure.src)), id);
    }
    for (const { lang, index } of editions) {
      const excerpt = passages[id][lang];
      const section = index.find(item => item.slug === entry.chapter && item.anchor === entry.anchor);
      assert.ok(section, `${id}: manual anchor must exist in ${lang}`);
      assert.equal(section.title, excerpt.sectionTitle);
      // The chapter link opens the topic; its example can come from a subheading underneath.
      const withinTopic = index.filter(item => item.slug === entry.chapter
        && (item.anchor === entry.anchor || item.anchor.startsWith(entry.anchor + '-')));
      assert.ok(withinTopic.some(item => item.passages.includes(excerpt.passage)), `${id}: show a complete, current ${lang} passage`);
    }
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

test('each A-frame continuation has the chosen recording or its own timed captions and an accurate data cost', () => {
  for (const lang of MANUAL_LANGS) {
    for (const film of ['level', 'walk'] as const) {
      const edition = filmEdition(film, lang);
      assert.equal(edition.lang, lang);
      assert.equal(edition.captionOnly, !['en', 'zu'].includes(lang));
      assert.equal(edition.bytes, COURSE_ASSET_SIZES[edition.src]);
      assert.match(readFileSync(path.join(ROOT, 'public', edition.track), 'utf8'), /^WEBVTT/);
    }
  }
  for (const film of ['harvest', 'earth'] as const) {
    const english = filmEdition(film, 'zu');
    assert.equal(english.lang, 'en');
    assert.equal(english.bytes, COURSE_ASSET_SIZES[english.src]);
  }
});

test('switching at the halfway mark stays on the halfway mark even when the new narration runs longer', () => {
  const en = filmEdition('level', 'en'), zu = filmEdition('level', 'zu');
  // The halfway shot starts at source frame 396. Its English cut starts at 435.
  assert.equal(matchingFilmTime(en, zu, 440 / 24), 401 / 24);
  assert.equal(matchingFilmTime(zu, en, 401 / 24), 440 / 24);
});

for (const [film, cueEnds] of [
  ['drip', [6, 12, 19, 26, 34, 42]],
  ['roof', [6, 12, 19, 26, 34, 42]],
  ['bottle', [5, 11, 17, 23, 29, 36]],
] as const) {
  test(`all five ${film} editions carry six timed stages and report the delivered media size`, () => {
    const english = filmEdition(film, 'en');
    const sidecars = new Set<string>();
    const titles = new Set<string>();
    const stamp = (seconds: number) => `00:00:${String(seconds).padStart(2, '0')}.000`;
    for (const lang of MANUAL_LANGS) {
      const edition = filmEdition(film, lang);
      assert.deepEqual(edition.languages, MANUAL_LANGS);
      assert.equal(edition.lang, lang);
      const narrated = lang === 'en' || lang === 'zu';
      assert.equal(edition.captionOnly, !narrated);
      assert.equal(edition.src, `/manual/films/${film}/v1/${film}-${narrated ? lang : 'captions'}.mp4`);
      assert.equal(edition.track, `/manual/films/${film}/v1/${film}-${lang}.vtt`);
      assert.equal(edition.seconds, cueEnds[cueEnds.length - 1]);
      const bytes = statSync(path.join(ROOT, 'public', edition.src)).size;
      assert.ok(bytes > 0);
      assert.equal(edition.bytes, bytes);
      assert.equal(edition.size, (bytes / 1_000_000).toFixed(1) + ' MB');
      assert.deepEqual(edition.ends, cueEnds.map(seconds => seconds * 24));
      assert.deepEqual(edition.pictures, edition.ends);
      const vtt = readFileSync(path.join(ROOT, 'public', edition.track), 'utf8');
      const [header, ...blocks] = vtt.trim().split(/\r?\n\s*\r?\n/);
      assert.equal(header, 'WEBVTT');
      assert.equal(blocks.length, cueEnds.length);
      blocks.forEach((block, i) => {
        const [timing, ...lines] = block.split(/\r?\n/);
        const start = cueEnds[i - 1] ?? 0;
        assert.equal(timing, `${stamp(start)} --> ${stamp(cueEnds[i])}`);
        assert.ok(lines.join(' ').trim(), `missing ${lang} caption ${i + 1}`);
        assert.equal(matchingFilmTime(english, edition, start + 0.5), start + 0.5);
      });
      sidecars.add(vtt);
      titles.add(fieldFilmTitle(film, lang));
    }
    assert.equal(sidecars.size, MANUAL_LANGS.length, 'each edition has its own text');
    assert.equal(titles.size, MANUAL_LANGS.length, 'each edition has its own film title');
  });
}
