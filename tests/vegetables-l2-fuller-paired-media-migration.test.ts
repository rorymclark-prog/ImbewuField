import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('Vegetables L2 fuller-card refresh retires only its six stale saved slides once', async () => {
  const source = readFileSync(new URL('../app/sw.js/route.ts', import.meta.url), 'utf8');
  const body = source.match(/async function migrateVegetablesL2FullerOrdinaryPairedStills\(\) \{([\s\S]*?)\n\}/)?.[1];
  assert.ok(body);
  const activation = source.slice(source.indexOf("self.addEventListener('activate'"));
  const migrations = [...activation.matchAll(/\.then\((migrate\w+)\)/g)].map(match => match[1]);
  const previous = migrations.indexOf('migrateVegetablesL4OrdinaryPairedStills');
  const current = migrations.indexOf('migrateVegetablesL2FullerOrdinaryPairedStills');
  const following = migrations.indexOf('migrateReadingLandscapeFrostBodySyncStills');
  assert.equal(migrations.filter(name => name === 'migrateVegetablesL2FullerOrdinaryPairedStills').length, 1);
  assert.ok(previous >= 0 && current > previous && following > current,
    'the six-card refresh runs once after prior Vegetables updates and before later Reading updates');

  const origin = 'https://field.test';
  const changed = [
    '/course-decks/vegetables-staples/st/slide-10.webp',
    '/course-decks/vegetables-staples/ve/slide-08.webp',
    '/course-decks/vegetables-staples/ve/slide-10.webp',
    '/course-decks/vegetables-staples/ts/slide-08.webp',
    '/course-decks/vegetables-staples/ts/slide-09.webp',
    '/course-decks/vegetables-staples/ts/slide-10.webp',
  ];
  const stale = changed.flatMap(path => [path, `${path}?saved=old`, `${path}?width=small`]);
  const preserve = [
    '/course-decks/vegetables-staples/st/slide-08.webp?saved=1',
    '/course-decks/vegetables-staples/ve/slide-09.webp?saved=1',
    '/course-decks/vegetables-staples/ts/slide-11.webp?saved=1',
    '/course-decks/vegetables-staples/en/slide-10.jpg?saved=1',
    '/course-audio/vegetables-staples/en/slide-10.mp3?saved=1',
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
  assert.equal(deletes, stale.length, 'only query variants of the six changed stills are deleted');
  const marker = '/course-decks/vegetables-staples/.l2-fuller-ordinary-paired-stills-20261005';
  assert.equal(rows.has(new URL(marker, origin).href), true);
  assert.equal(writes, 1);
  assert.doesNotMatch(body, /\bfetch\s*\(/, 'activation does not fetch slide media');

  const replacement = new URL(`${changed[0]}?saved=new`, origin).href;
  rows.set(replacement, new Response('learner-selected replacement'));
  await run({ open: async () => cache }, 'imbewu-course-v1', Response);
  assert.equal(await rows.get(replacement)!.text(), 'learner-selected replacement');
  assert.equal(deletes, stale.length, 'later activations keep newly downloaded slides');
  assert.equal(writes, 1);
});
