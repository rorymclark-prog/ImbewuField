import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('Vegetables L1 fuller paired stills retire only their stale cached variants once', async () => {
  const source = readFileSync(new URL('../app/sw.js/route.ts', import.meta.url), 'utf8');
  const body = source.match(/async function migrateVegetablesL1FullerOrdinaryPairedStills\(\) \{([\s\S]*?)\n\}/)?.[1];
  assert.ok(body);
  // 2026-10-05: L4 adds a selective migration between L1 and Reading. Protect
  // activation and relative order without forbidding subsequent scoped updates.
  const activation = source.slice(source.indexOf("self.addEventListener('activate'"));
  const migrations = [...activation.matchAll(/\.then\((migrate\w+)\)/g)].map(match => match[1]);
  const preceding = migrations.indexOf('migrateVegetablesL2OrdinaryPairedStills');
  const current = migrations.indexOf('migrateVegetablesL1FullerOrdinaryPairedStills');
  const following = migrations.indexOf('migrateReadingLandscapeFrostBodySyncStills');
  assert.equal(migrations.filter(name => name === 'migrateVegetablesL1FullerOrdinaryPairedStills').length, 1);
  assert.ok(preceding >= 0 && current > preceding && following > current,
    'L1 refresh runs once after L2 and before the later Reading refresh');

  const origin = 'https://field.test';
  const changed = ['st', 've', 'ts'].flatMap(language => [4, 5, 6, 7].map(slide =>
    `/course-decks/vegetables-staples/${language}/slide-${String(slide).padStart(2, '0')}.webp`));
  const stale = changed.flatMap(path => [path, `${path}?saved=old`, `${path}?width=small`]);
  const preserve = [
    '/course-decks/vegetables-staples/st/slide-03.webp?saved=1',
    '/course-decks/vegetables-staples/ve/slide-08.webp?saved=1',
    '/course-decks/vegetables-staples/ts/slide-12.webp?saved=1',
    '/course-decks/vegetables-staples/en/slide-04.jpg?saved=1',
    '/course-audio/vegetables-staples/st/slide-04.mp3?saved=1',
    '/course-animations/vegetables-staples/ve/clip-01.mp4?saved=1',
  ];
  const rows = new Map([...stale, ...preserve].map(path => [new URL(path, origin).href, new Response(path)]));
  let deletes = 0;
  let writes = 0;
  const cache = {
    match: async (key: string) => rows.get(new URL(key, origin).href),
    keys: async () => [...rows.keys()].map(url => new Request(url)),
    delete: async (request: Request) => { deletes++; return rows.delete(request.url); },
    put: async (key: string, response: Response) => { writes++; rows.set(new URL(key, origin).href, response); },
  };
  const run = new Function('caches', 'COURSE_CACHE', 'Response', 'return (async () => {' + body + '})()');
  await run({ open: async () => cache }, 'imbewu-course-v1', Response);
  for (const path of stale) assert.equal(rows.has(new URL(path, origin).href), false, path);
  for (const path of preserve) assert.equal(rows.has(new URL(path, origin).href), true, path);
  assert.equal(deletes, stale.length, 'only query variants of the twelve changed stills are deleted');
  const marker = '/course-decks/vegetables-staples/.l1-fuller-ordinary-paired-stills-20261005';
  assert.equal(rows.has(new URL(marker, origin).href), true);
  assert.equal(writes, 1);
  assert.doesNotMatch(body, /\bfetch\s*\(/, 'activation does not fetch media');

  const replacement = new URL(`${changed[0]}?saved=new`, origin).href;
  rows.set(replacement, new Response('learner-selected replacement'));
  await run({ open: async () => cache }, 'imbewu-course-v1', Response);
  assert.equal(await rows.get(replacement)!.text(), 'learner-selected replacement');
  assert.equal(deletes, stale.length, 'later activations keep newly downloaded stills');
  assert.equal(writes, 1);
});

test('Vegetables L1 paired update proof binds each target to its complete English row', () => {
  const proof = JSON.parse(readFileSync(new URL('../docs/media/vegetables-staples/l1-fuller-paired-update-2026-10-05.json', import.meta.url), 'utf8'));
  assert.equal(proof.rows.length, 39);
  for (const language of ['st', 've', 'ts']) {
    const deck = JSON.parse(readFileSync(new URL(`../docs/narration/vegetables-staples.${language}.paired-draft.json`, import.meta.url), 'utf8'));
    const rows = proof.rows.filter((row: { language: string }) => row.language === language);
    assert.equal(rows.length, language === 've' ? 14 : language === 'st' ? 13 : 12);
    for (const row of rows) {
      const slide = deck.slides[row.slide - 1];
      assert.equal(slide.english.body[row.bodyIndex], row.sourceEnglish, `${language}/${row.slide}/${row.bodyIndex} source binding`);
      const target = slide.target.body[row.bodyIndex];
      const rendered = target.text ?? target.segments.map((segment: { text?: string; sourceEnglish: string }) => segment.text ?? segment.sourceEnglish).join('');
      assert.equal(rendered, row.target, `${language}/${row.slide}/${row.bodyIndex} target proof`);
    }
  }
  assert.equal(proof.assets.length, 12);
  assert.equal(proof.humanLanguageReview, false);
});
