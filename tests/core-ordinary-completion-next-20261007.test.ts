import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { COURSE_ASSET_SIZES } from '../lib/course-asset-sizes.ts';
import { COURSE_MODULES } from '../lib/course-modules.ts';
import { resolveLearnerLessonPresentation } from '../lib/course-localization.ts';
import { SESOTHO_VEGETABLES_STAPLES_DRAFT as stVegetables } from '../lib/course-translation-drafts-st-vegetables-staples.ts';
import { XITSONGA_VEGETABLES_STAPLES_DRAFT as tsVegetables } from '../lib/course-translation-drafts-ts-vegetables-staples.ts';
import { XITSONGA_MARKET_COMMUNITY_DRAFT as tsMarket } from '../lib/course-translation-drafts-ts-market-community.ts';
import {
  currentBatchProof,
  ensureCurrentBatch,
  followupAssetBefore,
  followupFiles,
  followupNativeBefore,
  followupPairBefore,
  followupPairBeforeHistory,
  followupPresentationBefore,
  followupSourceBefore,
} from './core-reading-vegetables-followup-history-checks.ts';

const folder = 'docs/study-translation-reviews/core-ordinary-completion-next-2026-10-07/';
const sha = (bytes: Uint8Array | string) => createHash('sha256').update(bytes).digest('hex');
const findSlide = (file: string, n: number) => {
  const doc = JSON.parse(readFileSync(file, 'utf8'));
  return { doc, slide: doc.slides.find((row: any) => row.n === n) };
};
const changedStills = [
  '/course-decks/reading-landscape/st/slide-07.webp',
  '/course-decks/reading-landscape/ve/slide-07.webp',
  '/course-decks/reading-landscape/ve/slide-12.webp',
  '/course-decks/vegetables-staples/st/slide-06.webp',
  '/course-decks/vegetables-staples/ts/slide-06.webp',
].sort();

test('complete immutable before and after proof covers the accepted source, learner, manifest, worker, and still batch', () => {
  assert.equal(currentBatchProof.base, '0b611b93de9c998d601c15cbc9a9aa6476f25274');
  ensureCurrentBatch();
  for (const [file, row] of Object.entries(currentBatchProof.files)) {
    assert.equal(sha(row.before), row.beforeSha256, `${file}: complete frozen base bytes`);
    assert.equal(sha(row.after), row.afterSha256, `${file}: complete frozen current bytes`);
    assert.equal(Buffer.byteLength(row.before), row.beforeBytes);
    assert.equal(Buffer.byteLength(row.after), row.afterBytes);
    assert.equal(sha(readFileSync(file)), row.afterSha256, `${file}: actual complete current file`);
    const previous = followupFiles[file];
    if (previous) assert.equal(row.beforeSha256, previous.afterSha256, `${file}: immutable history layers join without a gap`);
  }
  assert.equal(currentBatchProof.pairedFields.length, 5);
  assert.equal(currentBatchProof.assets.length, 5);
  assert.deepEqual(currentBatchProof.assets.map(row => row.url).sort(), changedStills);
  for (const asset of currentBatchProof.assets) {
    const bytes = readFileSync(asset.path);
    assert.equal(bytes.length, asset.afterBytes);
    assert.equal(sha(bytes), asset.afterSha256);
    assert.deepEqual([bytes.readUInt16LE(26) & 0x3fff, bytes.readUInt16LE(28) & 0x3fff], asset.dimensions);
    assert.equal(COURSE_ASSET_SIZES[asset.url], bytes.length, `${asset.url}: complete size manifest matches actual output`);
  }
});

test('the five paired fields change only their exact source-bound target segment', () => {
  const expected = new Map([
    ['docs/narration/reading-landscape.st.paired-draft.json:7:2:1', ['st', 'any water works for the site', 'mosebetsi ofe kapa ofe wa metsi o loketseng setsha']],
    ['docs/narration/reading-landscape.ve.paired-draft.json:7:2:1', ['ve', 'any water works for the site', 'water works dzinwe na dzinwe dzine dza fanelea fhethu hono']],
    ['docs/narration/reading-landscape.ve.paired-draft.json:12:1:0', ['ve', "The direction and strength of damaging wind change with region, season and your site's ridges and gaps. ", 'Thungo na maanḓa a muya une wa tshinyadza zwi shanduka u ya nga vhupo, khalaṅwaha, na dzi-ridges and gaps dza tshitentsi tshaṋu. ']],
    ['docs/narration/vegetables-staples.st.paired-draft.json:6:0:1', ['st', 'They do better', 'Di sebetsa hamolemo']],
    ['docs/narration/vegetables-staples.ts.paired-draft.json:6:0:1', ['ts', 'They do better', 'Swi tirha ku antswa']],
  ]);
  assert.equal(expected.size, currentBatchProof.pairedFields.length);
  for (const row of currentBatchProof.pairedFields) {
    const id = `${row.file}:${row.slide}:${row.bodyIndex}:${row.segmentIndex}`;
    const spec = expected.get(id);
    assert.ok(spec, `${id}: field has an explicit accepted binding`);
    const [language, sourceSpan, targetText] = spec as string[];
    const { doc, slide } = findSlide(row.file, row.slide);
    assert.equal(doc.language, language, `${id}: language code is exact (st=Sesotho, ve=Tshivenda, ts=Xitsonga)`);
    assert.equal(slide.english.body[row.bodyIndex], row.sourceEnglish, `${id}: full English source cell is unchanged`);
    const current = slide.target.body[row.bodyIndex];
    const beforeFile = JSON.parse(currentBatchProof.files[row.file].before);
    const beforeCell = beforeFile.slides.find((candidate: any) => candidate.n === row.slide).target.body[row.bodyIndex];
    assert.deepEqual(current, { ...beforeCell, segments: beforeCell.segments.map((segment: any, index: number) => index === row.segmentIndex ? row.afterSegment : segment) }, `${id}: all non-target segments and provenance are byte-for-byte equivalent after parsing`);
    const segment = current.segments[row.segmentIndex];
    assert.equal(segment.sourceEnglish, sourceSpan, `${id}: source index is exact`);
    assert.equal(segment.text, targetText, `${id}: accepted target is exact`);
    assert.equal(segment.status, 'draft');
    assert.equal(current.segments.map((part: any) => part.sourceEnglish).join(''), slide.english.body[row.bodyIndex], `${id}: source segment order and coverage stay exact`);
    for (const part of current.segments) if (part.status === 'english-hold') assert.equal('text' in part, false, `${id}: held source text is not falsely represented as translation`);
  }

  const stWater = findSlide('docs/narration/reading-landscape.st.paired-draft.json', 7).slide.target.body[2].segments;
  const veWater = findSlide('docs/narration/reading-landscape.ve.paired-draft.json', 7).slide.target.body[2].segments;
  assert.ok(stWater[0].text.endsWith('Kgetha '));
  assert.equal(stWater[1].text, 'mosebetsi ofe kapa ofe wa metsi o loketseng setsha');
  assert.ok(stWater[2].text.startsWith(', mme o rere tsela e sireletsehileng'));
  assert.ok(veWater[0].text.endsWith('Nangani '));
  assert.equal(veWater[1].text, 'water works dzinwe na dzinwe dzine dza fanelea fhethu hono');
  assert.ok(veWater[2].text.startsWith(', nahone ni dzudzanye nḓila yo tsireledzeaho'));

  const wind = findSlide('docs/narration/reading-landscape.ve.paired-draft.json', 12).slide.target.body[1].segments;
  assert.ok(wind[0].text.endsWith(' '), 'site-wind source span keeps the exact trailing separator');
  assert.equal(wind[1].sourceEnglish, 'Walk the land on windy days. ');

  const stSow = findSlide('docs/narration/vegetables-staples.st.paired-draft.json', 6).slide.target.body[0].segments;
  const tsSow = findSlide('docs/narration/vegetables-staples.ts.paired-draft.json', 6).slide.target.body[0].segments;
  for (const segments of [stSow, tsSow]) {
    assert.ok(segments[2].text.includes('jalwa ka kotloloho') || segments[2].text.includes('byariwa hi ku kongoma'));
    assert.equal(segments.at(-1).sourceEnglish, ' belong in that group.');
    assert.equal(segments.at(-1).text.includes('Beans'), false);
    assert.equal(segments.map((part: any) => part.sourceEnglish).join(''), findSlide(segments === stSow ? 'docs/narration/vegetables-staples.st.paired-draft.json' : 'docs/narration/vegetables-staples.ts.paired-draft.json', 6).slide.english.body[0]);
  }
});

test('native learner predicates preserve the general comparative, sale-price comparison, and full trade-off list', () => {
  assert.deepEqual(followupNativeBefore(stVegetables), currentBatchProof.nativeModules.before.st);
  assert.deepEqual(followupNativeBefore(tsVegetables), currentBatchProof.nativeModules.before.ts);
  assert.deepEqual(followupNativeBefore(tsMarket), currentBatchProof.nativeModules.before.mt);
  for (const [file, snapshot] of Object.entries(currentBatchProof.nativeModules.after)) {
    const actual = file === 'st' ? stVegetables : file === 'ts' ? tsVegetables : tsMarket;
    assert.deepEqual(actual, snapshot, `${file}: complete imported registry equals the full after snapshot`);
  }

  const stSource = COURSE_MODULES.find(module => module.id === 'vegetables-staples')!.lessons.find(lesson => lesson.id === 'vegetables-staples-l1')!;
  const stBody = stVegetables.lessons.find(lesson => lesson.id === 'vegetables-staples-l1')!.body.sesothoDraft;
  assert.equal(stVegetables.lessons.find(lesson => lesson.id === 'vegetables-staples-l1')!.body.sourceEnglish, stSource.body);
  assert.match(stBody, /Di sebetsa hamolemo ha di jalwa ka kotloloho moo di tla hola teng\./);
  assert.doesNotMatch(stBody, /Di hola hantle ho feta ha di jalwa/, 'Sesotho keeps general performance instead of narrowing “better” to growth');

  const tsSource = COURSE_MODULES.find(module => module.id === 'vegetables-staples')!.lessons.find(lesson => lesson.id === 'vegetables-staples-l1')!;
  const tsBody = tsVegetables.lessons.find(lesson => lesson.id === 'vegetables-staples-l1')!.body.xitsongaDraft;
  assert.equal(tsVegetables.lessons.find(lesson => lesson.id === 'vegetables-staples-l1')!.body.sourceEnglish, tsSource.body);
  assert.match(tsBody, /Swi tirha ku antswa loko swi byariwa hi ku kongoma laha swi nga ta kula kona\./);

  const marketSource = COURSE_MODULES.find(module => module.id === 'market-community')!.lessons.find(lesson => lesson.id === 'market-community-l2')!;
  const marketBody = tsMarket.lessons.find(lesson => lesson.id === 'market-community-l2')!.body.xitsongaDraft;
  assert.equal(tsMarket.lessons.find(lesson => lesson.id === 'market-community-l2')!.body.sourceEnglish, marketSource.body);
  assert.match(marketBody, /Ku xavisa hi ku kongoma swi nga hlayisa swo tala swa nxavo wo xavisa/);
  for (const tradeoff of ['nkarhi', 'ku paka', 'vutleketli', 'ku khathalela vaxavi']) assert.ok(marketBody.includes(tradeoff), `${tradeoff}: named sale-cost trade-off stays present`);
  assert.equal((marketBody.match(/swi tlhela swi teka nkarhi, ku paka, vutleketli ni ku khathalela vaxavi/g) ?? []).length, 1);

  const corrupted = structuredClone(stVegetables);
  corrupted.description.sesothoDraft += ' unrelated';
  assert.throws(() => followupNativeBefore(corrupted), 'a caller cannot hide unrelated native-module changes behind the scoped predicate projection');
});

test('older history accessors receive only the exact predecessor of this newest batch', () => {
  ensureCurrentBatch();
  for (const [file, row] of Object.entries(currentBatchProof.files)) {
    const expectedPredecessor = followupFiles[file]?.before ?? row.before;
    assert.equal(followupSourceBefore(file, readFileSync(file)).toString(), expectedPredecessor, `${file}: newest and preceding immutable layers compose to the exact predecessor`);
    const changed = Buffer.concat([readFileSync(file), Buffer.from('\ncorruption')]);
    assert.throws(() => followupSourceBefore(file, changed), `${file}: corruption outside the frozen accepted batch is rejected`);
  }
  for (const row of currentBatchProof.pairedFields) {
    const actual = JSON.parse(readFileSync(row.file, 'utf8'));
    const predecessor = followupPairBefore(row.file, actual);
    const expectedPredecessor = JSON.parse(followupFiles[row.file]?.before ?? currentBatchProof.files[row.file].before);
    assert.deepEqual(predecessor, expectedPredecessor, `${row.file}: full pair and older immutable layer predecessor restored`);
    const historyPredecessor = followupPairBeforeHistory(row.file, actual) as any;
    for (const older of JSON.parse(readFileSync('docs/study-translation-reviews/core-reading-vegetables-followup-2026-10-07/accepted-plan.json', 'utf8')).pairedFields.filter((item: any) => item.file === row.file)) {
      assert.deepEqual(historyPredecessor.slides.find((item: any) => item.n === older.slide).target.body[older.bodyIndex].segments[older.segmentIndex], older.oldSegment, `${row.file}:${older.slide}: older history receives its exact prior reviewed segment`);
    }
    const corrupted = structuredClone(actual);
    corrupted.slides[0].english.heading += ' corruption';
    assert.throws(() => followupPairBefore(row.file, corrupted), `${row.file}: unrelated caller edits are rejected`);
  }
  for (const row of currentBatchProof.assets) {
    const actual = readFileSync(row.path);
    const prior = followupAssetBefore(row.path, actual);
    assert.deepEqual({ bytes: prior?.bytes, sha256: prior?.sha256 }, { bytes: row.beforeBytes, sha256: row.beforeSha256 }, `${row.path}: image history receives exact prior image identity`);
    assert.throws(() => followupAssetBefore(row.path, Buffer.concat([actual, Buffer.from('x')])), `${row.path}: changed or appended image bytes are rejected`);
  }
});


test('new native presentation history rewinds only the exact Xitsonga Market predicate', () => {
  const source = COURSE_MODULES.find(module => module.id === 'market-community')!.lessons.find(lesson => lesson.id === 'market-community-l2')!;
  const live = resolveLearnerLessonPresentation(source, 'ts');
  const before = followupPresentationBefore(live, 'market-community-l2', 'ts');
  const expected = structuredClone(live);
  const sourcePair = currentBatchProof.nativeModules.before.mt.lessons.find((lesson: any) => lesson.id === 'market-community-l2').body;
  const oldBody = sourcePair.xitsongaDraft.split('\n\n');
  const previousBody = currentBatchProof.nativeModules.after.mt.lessons.find((lesson: any) => lesson.id === 'market-community-l2').body.xitsongaDraft.split('\n\n');
  const projectedBody = expected.content.body.split('\n\n');
  assert.equal(oldBody[3], 'Ku xavisa hi ku kongoma swi nga retain more of the sale price, kambe swi tlhela swi teka nkarhi, ku paka, vutleketli ni ku khathalela vaxavi.');
  assert.equal(previousBody[3], 'Ku xavisa hi ku kongoma swi nga hlayisa swo tala swa nxavo wo xavisa, kambe swi tlhela swi teka nkarhi, ku paka, vutleketli ni ku khathalela vaxavi.');
  assert.equal(projectedBody[3], previousBody[3]);
  projectedBody[3] = oldBody[3];
  expected.content.body = projectedBody.join('\n\n');
  assert.deepEqual(before, expected, 'all other current presentation fields, including conditional sales and price context, stay exact');
  const corrupted = structuredClone(live);
  corrupted.content.body += '\n\nUnrelated';
  assert.throws(() => followupPresentationBefore(corrupted, 'market-community-l2', 'ts'), 'the full presentation guard rejects unrelated caller changes');
});

test('the selective worker migration expires exactly five old still paths once and preserves other saved media', async () => {
  const source = readFileSync('app/sw.js/route.ts', 'utf8');
  const name = 'migrateCoreOrdinaryCompletionNextStills';
  const body = source.match(/async function migrateCoreOrdinaryCompletionNextStills\(\) \{([\s\S]*?)\n\}/)?.[1];
  assert.ok(body);
  const activation = source.slice(source.indexOf("self.addEventListener('activate'"));
  const chain = [...activation.matchAll(/\.then\((migrate\w+)\)/g)].map(match => match[1]);
  assert.equal(chain.filter(value => value === name).length, 1);
  assert.ok(chain.indexOf(name) > chain.indexOf('migrateCoreReadingVegetablesFollowupStills'));
  assert.ok(activation.indexOf('self.clients.claim()') > activation.indexOf(name));
  assert.doesNotMatch(body, /\bfetch\s*\(/);
  const listed = [...body.matchAll(/\/course-decks\/[\w/-]+\.webp/g)].map(match => match[0]).sort();
  assert.deepEqual(listed, changedStills, 'only the five measured corrected cards are retired');

  const origin = 'https://study.test';
  const stale = changedStills.flatMap(path => [path, `${path}?width=390`, `${path}?saved=old`]);
  const preserved = [
    '/course-audio/reading-landscape/st/slide-07.mp3?saved=1',
    '/course-audio/vegetables-staples/ts/slide-06.mp3?saved=1',
    '/course-animations/reading-landscape/flow.mp4?saved=1',
    '/course-decks/reading-landscape/en/slide-07.jpg?saved=1',
    '/course-decks/reading-landscape/ve/slide-13.webp?saved=1',
    '/course-decks/vegetables-staples/st/slide-07.webp?saved=1',
  ];
  const entries = new Map([...stale, ...preserved].map(path => [new URL(path, origin).href, new Response(path)]));
  let deletes = 0, writes = 0, fetches = 0;
  const cache = {
    match: async (key: string) => entries.get(new URL(key, origin).href),
    keys: async () => [...entries.keys()].map(url => new Request(url)),
    delete: async (request: Request) => { deletes++; return entries.delete(request.url); },
    put: async (key: string, response: Response) => { writes++; entries.set(new URL(key, origin).href, response); },
  };
  const run = new Function('caches', 'COURSE_CACHE', 'Response', 'fetch', `return (async () => {${body}})()`);
  const invoke = () => run({ open: async (key: string) => { assert.equal(key, 'imbewufield-course-v1'); return cache; } }, 'imbewufield-course-v1', Response, () => { fetches++; throw new Error('the migration must not fetch'); });
  await invoke();
  for (const path of stale) assert.equal(entries.has(new URL(path, origin).href), false, `${path}: obsolete still and query forms removed`);
  for (const path of preserved) assert.equal(entries.has(new URL(path, origin).href), true, `${path}: audio, animation, other stills remain`);
  const marker = '/course-decks/.core-ordinary-completion-next-20261007';
  assert.equal(await entries.get(new URL(marker, origin).href)?.text(), 'Refreshed five corrected source-paired ordinary cards');
  assert.equal(deletes, stale.length);
  assert.equal(writes, 1);
  assert.equal(fetches, 0);

  const later = changedStills.map(path => [new URL(`${path}?saved=new`, origin).href, `new pack ${path}`] as const);
  for (const [url, value] of later) entries.set(url, new Response(value));
  await invoke();
  for (const [url, value] of later) assert.equal(await entries.get(url)!.text(), value, `${url}: later saved data is preserved`);
  assert.equal(deletes, stale.length, 'the marker prevents a second purge');
  assert.equal(writes, 1);
  assert.equal(fetches, 0);
});
