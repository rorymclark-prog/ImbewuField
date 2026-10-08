import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { COURSE_MODULES } from '../lib/course-modules.ts';
import { resolveLearnerLessonPresentation } from '../lib/course-localization.ts';
import { SESOTHO_VEGETABLES_STAPLES_DRAFT } from '../lib/course-translation-drafts-st-vegetables-staples.ts';
import { COURSE_ASSET_SIZES } from '../lib/course-asset-sizes.ts';
import {
  readingTitleLightestNativeBefore,
  readingTitleLightestPairBefore,
} from './reading-title-lightest-next-history-checks.ts';
import { lightestAssetRows, lightestManifestBefore, lightestRenderProof } from './reading-title-lightest-media-history-checks.ts';

const folder = 'docs/study-translation-reviews/reading-title-lightest-next-2026-10-08/';
const pairs = [
  { language: 'st', file: 'docs/narration/reading-landscape.st.paired-draft.json', accepted: 'Thuto 3: Bala Moya, Frost le Letswapo' },
  { language: 've', file: 'docs/narration/reading-landscape.ve.paired-draft.json', accepted: 'Ngudo 3: Vhalani Muya, Frost, na u sendama ha mavu' },
  { language: 'ts', file: 'docs/narration/reading-landscape.ts.paired-draft.json', accepted: 'Dyondzo 3: Hlaya Moya, Frost, na Slope' },
] as const;
const load = (file: string) => JSON.parse(readFileSync(file, 'utf8'));

test('Reading slide 12 uses only the three accepted source-bound imperative headings', () => {
  for (const row of pairs) {
    const current = load(row.file);
    const before = load(folder + `before/${row.file.split('/').at(-1)}`);
    const slide = current.slides.find((item: any) => item.n === 12);
    assert.equal(slide.english.heading, 'Lesson 3: Read Wind, Frost, and Slope');
    assert.deepEqual(slide.target.heading, { ...before.slides.find((item: any) => item.n === 12).target.heading, text: row.accepted });
    assert.equal(slide.target.heading.status, 'draft', 'the title remains an unreviewed draft');
    assert.deepEqual(readingTitleLightestPairBefore(row.file, current), before,
      `${row.language}: the complete current deck rewinds to its exact snapshot with every unlisted field preserved`);
  }
});

test('Sesotho Vegetables translates only the exact least-intensive effective-action phrase', () => {
  const moduleBefore = load(folder + 'before/native-registry-module.json');
  const lessonBefore = moduleBefore.lessons.find((item: any) => item.id === 'vegetables-staples-l4');
  const lesson = SESOTHO_VEGETABLES_STAPLES_DRAFT.lessons.find(item => item.id === 'vegetables-staples-l4')!;
  const canonical = COURSE_MODULES.find(item => item.id === 'vegetables-staples')!.lessons.find(item => item.id === 'vegetables-staples-l4')!;
  const beforeParagraphs = lessonBefore.body.sesothoDraft.split('\n\n');
  const paragraphs = lesson.body.sesothoDraft.split('\n\n');
  const index = 9;
  assert.equal(canonical.body.split('\n\n').length, 12);
  assert.equal(paragraphs.length, 12);
  assert.equal(lesson.body.sourceEnglish, canonical.body);
  assert.equal(lesson.body.reviewStatus, 'machine-draft');
  assert.equal(beforeParagraphs[index].includes('the lightest thing that works.'), true);
  assert.equal(paragraphs[index], beforeParagraphs[index].replace('the lightest thing that works.', 'ketso e bobebe ka ho fetisisa e sebetsang.'));
  assert.equal(paragraphs[index].includes('Physical removal, barriers kapa diphetoho tlhokomelong ya dijalo di ka thusa.'), true);
  assert.equal(paragraphs[index].includes('Netefatsa hore ketso e loketse bothata, mme o behe leihlo sephethong.'), true);
  assert.deepEqual(readingTitleLightestNativeBefore(SESOTHO_VEGETABLES_STAPLES_DRAFT), moduleBefore,
    'the complete native registry projects back with all status, source and unlisted fields intact');

  const paired = load('docs/narration/vegetables-staples.st.paired-draft.json');
  const pairBefore = load(folder + 'before/vegetables-staples.st.paired-draft.json');
  const slide = paired.slides.find((item: any) => item.n === 16);
  const oldPair = pairBefore.slides.find((item: any) => item.n === 16);
  assert.equal(slide.english.body[4], 'Four. Only then, act — and start with the lightest thing that works. Physical removal, barriers or changes in crop care may help. Check that the action suits the problem and monitor the result.');
  assert.equal(slide.target.body[4].segments.map((part: any) => part.sourceEnglish).join(''), slide.english.body[4]);
  assert.deepEqual(slide.target.body[4].segments[2], {
    ...oldPair.target.body[4].segments[2], status: 'draft', text: 'ketso e bobebe ka ho fetisisa e sebetsang.',
  });
  assert.deepEqual(slide.target.body[4].segments.slice(3), oldPair.target.body[4].segments.slice(3),
    'physical removal and all following methods/check clauses remain unchanged');
  assert.deepEqual(readingTitleLightestPairBefore('docs/narration/vegetables-staples.st.paired-draft.json', paired), pairBefore);

  const changedSource = { ...canonical, body: canonical.body.replace('the lightest thing that works.', 'a changed action.') };
  const fallback = resolveLearnerLessonPresentation(changedSource, 'st');
  assert.equal(fallback.status, 'english-fallback', 'source drift withdraws the unreviewed learner text');
  assert.equal(fallback.content.body, changedSource.body);
});

test('source, target, status, index and unlisted drift cannot pass as the accepted full snapshots', () => {
  const cases: Array<[string, (deck: any) => void]> = [
    ['source', deck => { deck.slides.find((item: any) => item.n === 12).english.heading += ' changed'; }],
    ['target', deck => { deck.slides.find((item: any) => item.n === 12).target.heading.text += ' changed'; }],
    ['status', deck => { deck.slides.find((item: any) => item.n === 12).target.heading.status = 'english-hold'; }],
    ['index', deck => { deck.slides.reverse(); }],
    ['unlisted', deck => { deck.slides[0].target.body[0].text += ' changed'; }],
  ];
  for (const [field, mutate] of cases) {
    const current = load(pairs[0].file);
    mutate(current);
    assert.throws(() => readingTitleLightestPairBefore(pairs[0].file, current), `${field} drift must be rejected`);
  }

  const currentNative = structuredClone(SESOTHO_VEGETABLES_STAPLES_DRAFT);
  currentNative.lessons.find(item => item.id === 'vegetables-staples-l4')!.body.reviewStatus = 'hold';
  assert.throws(() => readingTitleLightestNativeBefore(currentNative), 'native status drift must be rejected');
});

test('the four rendered cards and full asset manifest are source-bound to exact compressed outputs', () => {
  assert.equal(lightestRenderProof.outputSize.join('x'), '1440x5400');
  assert.deepEqual(lightestRenderProof.encoding, { format: 'WEBP', quality: 88, method: 6 });
  const rows = lightestAssetRows();
  assert.deepEqual(rows.map(row => row.url).sort(), [
    '/course-decks/reading-landscape/st/slide-12.webp',
    '/course-decks/reading-landscape/ve/slide-12.webp',
    '/course-decks/reading-landscape/ts/slide-12.webp',
    '/course-decks/vegetables-staples/st/slide-16.webp',
  ].sort());
  for (const row of rows) assert.equal(COURSE_ASSET_SIZES[row.url], row.afterBytes, `${row.url}: declared download bytes match actual card`);
  assert.equal(lightestManifestBefore(), readFileSync(folder + 'before/course-asset-sizes.ts', 'utf8'));
});

test('the once-only cache migration deletes exactly four still paths and query variants, never media or later packs', async () => {
  const source = readFileSync('app/sw.js/route.ts', 'utf8');
  const name = 'migrateReadingTitleLightestFourStills';
  const body = source.match(/async function migrateReadingTitleLightestFourStills\(\) \{([\s\S]*?)\n\}/)?.[1];
  assert.ok(body);
  const activation = source.slice(source.indexOf("self.addEventListener('activate'"));
  const migrationChain = [...activation.matchAll(/\.then\((migrate\w+)\)/g)].map(match => match[1]);
  assert.equal(migrationChain.filter(migration => migration === name).length, 1);
  assert.ok(migrationChain.indexOf(name) > migrationChain.indexOf('migrateCoreOrdinaryExpandedNextStills'));
  assert.ok(activation.indexOf('self.clients.claim()') > activation.indexOf(name));
  assert.doesNotMatch(body, /\bfetch\s*\(/, 'migration never downloads replacement media');
  const paths = [...body.matchAll(/\/course-decks\/[\w/-]+\.webp/g)].map(match => match[0]).sort();
  const expected = lightestAssetRows().map(row => row.url).sort();
  assert.deepEqual(paths, expected, 'worker names exactly the four proof-bound still paths');

  const origin = 'https://field.test';
  const stale = paths.flatMap(path => [path, `${path}?saved=old`, `${path}?width=390`]);
  const changed = new Set(paths);
  const otherCards = [
    '/course-decks/reading-landscape/st/slide-11.webp?saved=old',
    '/course-decks/reading-landscape/ve/slide-13.webp?width=390',
    '/course-decks/vegetables-staples/st/slide-15.webp?saved=old',
  ];
  const preservedMedia = [
    '/course-audio/reading-landscape/st/slide-12.mp3?saved=1',
    '/course-audio/vegetables-staples/st/slide-16.mp3?saved=1',
    '/course-animations/reading-landscape/st/wind-flow.mp4?saved=1',
    '/course-decks/reading-landscape/en/slide-12.jpg?saved=1',
    '/course-decks/vegetables-staples/st/slide-16.webp.bak?saved=1',
  ];
  assert.equal(changed.size, 4);
  const entries = new Map([...stale, ...otherCards, ...preservedMedia].map(path => [new URL(path, origin).href, new Response(path)]));
  let deletions = 0, writes = 0, fetches = 0;
  const cache = {
    match: async (key: string) => entries.get(new URL(key, origin).href),
    keys: async () => [...entries.keys()].map(url => new Request(url)),
    delete: async (request: Request) => { deletions++; return entries.delete(request.url); },
    put: async (key: string, response: Response) => { writes++; entries.set(new URL(key, origin).href, response); },
  };
  const run = new Function('caches', 'COURSE_CACHE', 'Response', 'fetch', `return (async () => {${body}})()`);
  const invoke = () => run({ open: async (key: string) => { assert.equal(key, 'imbewufield-course-v1'); return cache; } }, 'imbewufield-course-v1', Response, () => { fetches++; throw new Error('migration must not fetch'); });
  await invoke();
  for (const path of stale) assert.equal(entries.has(new URL(path, origin).href), false, `${path}: obsolete still removed`);
  for (const path of [...otherCards, ...preservedMedia]) assert.equal(entries.has(new URL(path, origin).href), true, `${path}: unlisted card/media preserved`);
  const marker = '/course-decks/.reading-title-lightest-four-stills-20261008';
  assert.equal(await entries.get(new URL(marker, origin).href)?.text(), 'Refreshed four reviewed source-paired learner cards');
  assert.equal(deletions, stale.length);
  assert.equal(writes, 1);
  assert.equal(fetches, 0);

  const laterPack = paths.flatMap((path, index) => [
    [new URL(path, origin).href, `later saved card ${index}`] as const,
    [new URL(`${path}?width=390`, origin).href, `later saved query card ${index}`] as const,
  ]);
  for (const [url, text] of laterPack) entries.set(url, new Response(text));
  await invoke();
  for (const [url, text] of laterPack) assert.equal(await entries.get(url)?.text(), text, `${url}: later pack remains intact`);
  assert.equal(deletions, stale.length, 'the marker prevents a second deletion pass');
  assert.equal(writes, 1);
  assert.equal(fetches, 0);
});
