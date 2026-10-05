import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// These rendered cards replace saved wording; narration and other learner downloads are independent.
const changed = [
  "/course-decks/market-community/st/slide-01.webp",
  "/course-decks/market-community/st/slide-02.webp",
  "/course-decks/market-community/st/slide-05.webp",
  "/course-decks/market-community/st/slide-07.webp",
  "/course-decks/market-community/st/slide-08.webp",
  "/course-decks/market-community/ve/slide-02.webp",
  "/course-decks/market-community/ve/slide-05.webp",
  "/course-decks/market-community/ve/slide-06.webp",
  "/course-decks/market-community/ve/slide-07.webp",
  "/course-decks/market-community/ve/slide-08.webp",
  "/course-decks/market-community/ts/slide-01.webp",
  "/course-decks/market-community/ts/slide-02.webp",
  "/course-decks/market-community/ts/slide-05.webp",
  "/course-decks/market-community/ts/slide-06.webp",
  "/course-decks/market-community/ts/slide-07.webp",
  "/course-decks/market-community/ts/slide-08.webp"
];

test('Market L1 cards refresh exact still variants once and preserve learner audio and later downloads', async () => {
  const source = readFileSync(new URL('../app/sw.js/route.ts', import.meta.url), 'utf8');
  const body = source.match(/async function migrateMarketL1OrdinaryStills\(\) \{([\s\S]*?)\n\}/)?.[1];
  assert.ok(body);
  assert.match(source, /then\(migrateReadingLandscapeFullOrdinaryStills\)\.then\(migrateMarketL1OrdinaryStills\)/);
  const origin = 'https://field.test';
  const obsolete = changed.flatMap(path => [path, `${path}?saved=old`, `${path}?width=390`]);
  const preserve = [
    '/course-audio/market-community/en/slide-07.mp3',
    '/course-audio/intro-permaculture/st/slide-01.mp3',
    '/course-animations/market-community/flow-seed-sharing.mp4',
    '/course-decks/market-community/en/slide-07.jpg',
    '/course-decks/market-community/zu/slide-07.jpg',
    '/course-decks/market-community/st/slide-06.webp',
    '/course-decks/market-community/ve/slide-01.webp',
    '/course-decks/market-community/ts/slide-09.webp',
    '/course-decks/reading-landscape/ts/slide-14.webp',
  ];
  const rows = new Map<string, Response>([...obsolete, ...preserve].map(path => [new URL(path, origin).href, new Response(path)]));
  let deletions = 0;
  let writes = 0;
  const cache = {
    match: async (key: string) => rows.get(new URL(key, origin).href),
    keys: async () => [...rows.keys()].map(url => new Request(url)),
    delete: async (request: Request) => { deletions++; return rows.delete(request.url); },
    put: async (key: string, value: Response) => { writes++; rows.set(new URL(key, origin).href, value); },
  };
  const run = new Function('caches', 'COURSE_CACHE', 'Response', 'return (async () => {' + body + '})()');
  assert.doesNotMatch(body, /\bfetch\s*\(/, 'a migration cannot spend learner airtime');
  await run({ open: async () => cache }, 'imbewu-course-v1', Response);
  for (const path of obsolete) assert.equal(rows.has(new URL(path, origin).href), false, path);
  for (const path of preserve) assert.equal(await rows.get(new URL(path, origin).href)!.text(), path, path);
  assert.equal(deletions, obsolete.length, 'no unrelated cached object is removed');
  assert.equal(writes, 1);
  const replacement = new URL(changed[0] + '?saved=new', origin).href;
  rows.set(replacement, new Response('new learner download'));
  await run({ open: async () => cache }, 'imbewu-course-v1', Response);
  assert.equal(await rows.get(replacement)!.text(), 'new learner download');
  assert.equal(deletions, obsolete.length);
  assert.equal(writes, 1, 'a second activation is inert');
});
