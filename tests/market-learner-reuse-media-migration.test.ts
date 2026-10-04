import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('saved Market wording refreshes once while other lessons and narration remain offline', async () => {
  const source = readFileSync(new URL('../app/sw.js/route.ts', import.meta.url), 'utf8');
  const body = source.match(/async function migrateMarketLearnerReuseStills\(\) \{([\s\S]*?)\n\}/)?.[1];
  assert.ok(body);
  assert.match(source, /then\(migrateVegetablesOrdinaryLessonStills\)\.then\(migrateMarketLearnerReuseStills\)\.then/);
  const origin = 'https://field.test';
  const changed = ['st/15', 'st/18', 've/08', 've/15', 've/18', 'ts/15', 'ts/18']
    .map(part => { const [language, slide] = part.split('/'); return `/course-decks/market-community/${language}/slide-${slide}.webp`; });
  const stale = changed.flatMap(path => [path, `${path}?saved=old`, `${path}?width=small`]);
  const preserved = [
    '/course-decks/market-community/st/slide-16.webp',
    '/course-decks/market-community/ve/slide-09.webp?cached=1',
    '/course-decks/market-community/en/slide-15.jpg',
    '/course-decks/market-community/zu/slide-15.jpg',
    '/course-audio/market-community/en/slide-15.mp3',
    '/course-audio/intro-permaculture/st/slide-15.mp3',
    '/course-decks/vegetables-staples/ts/slide-15.webp',
  ];
  const rows = new Map([...stale, ...preserved].map(path => [origin + path, new Response(path)]));
  let writes = 0;
  const cache = {
    match: async (key: string) => rows.get(origin + key),
    keys: async () => [...rows.keys()].map(url => new Request(url)),
    delete: async (request: Request) => rows.delete(request.url),
    put: async (key: string, response: Response) => { writes++; rows.set(origin + key, response); },
  };
  const run = new Function('caches', 'COURSE_CACHE', 'Response', 'return (async () => {' + body + '})()');
  await run({ open: async () => cache }, 'imbewu-course-v1', Response);
  for (const path of stale) assert.equal(rows.has(origin + path), false, path);
  for (const path of preserved) assert.equal(await rows.get(origin + path)!.text(), path, path);
  rows.set(origin + changed[0], new Response('new learner-selected slide'));
  await run({ open: async () => cache }, 'imbewu-course-v1', Response);
  assert.equal(await rows.get(origin + changed[0])!.text(), 'new learner-selected slide');
  assert.equal(writes, 1, 'repeat activation must preserve the newly downloaded frame');
  assert.doesNotMatch(body, /\bfetch\s*\(/, 'refresh never starts a media download');
});
