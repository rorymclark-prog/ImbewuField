import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('the two-card text refresh retires only its saved still URL variants once', async () => {
  const source = readFileSync(new URL('../app/sw.js/route.ts', import.meta.url), 'utf8');
  const body = source.match(/async function migrateVegetablesTwoOrdinaryResidualStills\(\) \{([\s\S]*?)\n\}/)?.[1];
  assert.ok(body);
  const activation = source.slice(source.indexOf("self.addEventListener('activate'"));
  const migrations = [...activation.matchAll(/\.then\((migrate\w+)\)/g)].map(match => match[1]);
  assert.equal(migrations.filter(name => name === 'migrateVegetablesTwoOrdinaryResidualStills').length, 1);
  assert.ok(migrations.indexOf('migrateVegetablesTwoOrdinaryResidualStills') > migrations.indexOf('migrateCoreOrdinaryExpandedNextStills'));

  const origin = 'https://field.test';
  const changed = [
    '/course-decks/vegetables-staples/ve/slide-10.webp',
    '/course-decks/vegetables-staples/ts/slide-12.webp',
  ];
  const stale = changed.flatMap(path => [path, `${path}?saved=old`, `${path}?width=small`]);
  const preserve = [
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
  assert.equal(deletes, stale.length, 'only query variants of the two changed stills are deleted');
  const marker = '/course-decks/vegetables-staples/.two-ordinary-residual-20261008';
  assert.equal(rows.has(new URL(marker, origin).href), true);
  assert.equal(writes, 1);
  assert.doesNotMatch(body, /\bfetch\s*\(/, 'activation does not fetch slide media');

  rows.set(new URL(`${changed[0]}?saved=new`, origin).href, new Response('learner-selected replacement'));
  await run({ open: async () => cache }, 'imbewu-course-v1', Response);
  assert.equal(await rows.get(new URL(`${changed[0]}?saved=new`, origin).href)!.text(), 'learner-selected replacement');
  assert.equal(deletes, stale.length, 'later activations preserve replacements downloaded after migration');
  assert.equal(writes, 1);
});
