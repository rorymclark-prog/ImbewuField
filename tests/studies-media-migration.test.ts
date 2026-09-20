import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('updated Studies cannot pair old downloaded speech with corrected teaching; unrelated files survive', async () => {
  const source = readFileSync(new URL('../app/sw.js/route.ts', import.meta.url), 'utf8');
  const body = source.match(/async function migrateStudiesMedia\(\) \{([\s\S]*?)\n\}/)?.[1];
  assert.ok(body);
  assert.match(source, /then\(migrateStudiesMedia\)\.then/);
  const changed = [
    '/course-audio/water-harvesting/en/slide-14.mp3',
    '/course-audio/soil-health/en/slide-19.mp3',
    '/course-audio/food-forest/en/slide-15.mp3',
    '/course-audio/vegetables-staples/en/slide-13.mp3',
    '/course-audio/small-livestock/en/slide-07.mp3',
    '/course-audio/market-community/en/slide-09.mp3',
    '/course-audio/reading-landscape/en/slide-14.mp3',
    '/course-images/water-harvesting/water-harvesting-l3.jpg',
  ];
  const keep = [
    '/course-audio/seeds-sovereignty/en/slide-01.mp3',
    '/course-audio/plant-guilds/en/slide-01.mp3',
    '/course-audio/reading-landscape/en/slide-01.mp3',
    '/course-decks/plant-guilds/en/slide-01.jpg',
  ];
  const rows = new Map([...changed, ...keep].map(path => [path + '?cached=1', new Response('saved')]));
  const fakeCache = {
    match: async (key: string) => rows.get(key),
    keys: async () => [...rows.keys()].map(key => new Request('https://example.com' + key)),
    delete: async (request: Request) => { const url = new URL(request.url); return rows.delete(url.pathname + url.search); },
    put: async (key: string, response: Response) => { rows.set(key, response); },
  };
  const run = new Function('caches', 'COURSE_CACHE', 'Response', 'return (async () => {' + body + '})()');
  await run({ open: async () => fakeCache }, 'imbewu-course-v1', Response);
  for (const path of changed) assert.equal(rows.has(path + '?cached=1'), false, path);
  for (const path of keep) assert.equal(rows.has(path + '?cached=1'), true, path);
  rows.set(changed[0], new Response('new recording'));
  await run({ open: async () => fakeCache }, 'imbewu-course-v1', Response);
  assert.equal(await rows.get(changed[0])!.text(), 'new recording', 'migration must not erase a new download on later activation');
  assert.doesNotMatch(body, /\bfetch\(/, 'updating the app must not silently redownload lessons');
});
