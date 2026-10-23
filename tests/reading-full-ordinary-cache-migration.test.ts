import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// These rendered cards replace saved wording; narration and other learner downloads are independent.
const changed = [
  "/course-decks/reading-landscape/st/slide-04.webp",
  "/course-decks/reading-landscape/st/slide-06.webp",
  "/course-decks/reading-landscape/st/slide-07.webp",
  "/course-decks/reading-landscape/st/slide-08.webp",
  "/course-decks/reading-landscape/st/slide-10.webp",
  "/course-decks/reading-landscape/st/slide-12.webp",
  "/course-decks/reading-landscape/st/slide-13.webp",
  "/course-decks/reading-landscape/st/slide-14.webp",
  "/course-decks/reading-landscape/st/slide-16.webp",
  "/course-decks/reading-landscape/st/slide-19.webp",
  "/course-decks/reading-landscape/st/slide-20.webp",
  "/course-decks/reading-landscape/st/slide-21.webp",
  "/course-decks/reading-landscape/ve/slide-01.webp",
  "/course-decks/reading-landscape/ve/slide-02.webp",
  "/course-decks/reading-landscape/ve/slide-03.webp",
  "/course-decks/reading-landscape/ve/slide-04.webp",
  "/course-decks/reading-landscape/ve/slide-06.webp",
  "/course-decks/reading-landscape/ve/slide-07.webp",
  "/course-decks/reading-landscape/ve/slide-08.webp",
  "/course-decks/reading-landscape/ve/slide-09.webp",
  "/course-decks/reading-landscape/ve/slide-10.webp",
  "/course-decks/reading-landscape/ve/slide-11.webp",
  "/course-decks/reading-landscape/ve/slide-12.webp",
  "/course-decks/reading-landscape/ve/slide-13.webp",
  "/course-decks/reading-landscape/ve/slide-14.webp",
  "/course-decks/reading-landscape/ve/slide-16.webp",
  "/course-decks/reading-landscape/ve/slide-17.webp",
  "/course-decks/reading-landscape/ve/slide-18.webp",
  "/course-decks/reading-landscape/ve/slide-19.webp",
  "/course-decks/reading-landscape/ve/slide-20.webp",
  "/course-decks/reading-landscape/ve/slide-21.webp",
  "/course-decks/reading-landscape/ts/slide-01.webp",
  "/course-decks/reading-landscape/ts/slide-02.webp",
  "/course-decks/reading-landscape/ts/slide-03.webp",
  "/course-decks/reading-landscape/ts/slide-04.webp",
  "/course-decks/reading-landscape/ts/slide-06.webp",
  "/course-decks/reading-landscape/ts/slide-07.webp",
  "/course-decks/reading-landscape/ts/slide-08.webp",
  "/course-decks/reading-landscape/ts/slide-09.webp",
  "/course-decks/reading-landscape/ts/slide-10.webp",
  "/course-decks/reading-landscape/ts/slide-11.webp",
  "/course-decks/reading-landscape/ts/slide-12.webp",
  "/course-decks/reading-landscape/ts/slide-13.webp",
  "/course-decks/reading-landscape/ts/slide-14.webp",
  "/course-decks/reading-landscape/ts/slide-16.webp",
  "/course-decks/reading-landscape/ts/slide-17.webp",
  "/course-decks/reading-landscape/ts/slide-19.webp",
  "/course-decks/reading-landscape/ts/slide-20.webp",
  "/course-decks/reading-landscape/ts/slide-21.webp"
];

test('fuller Reading cards refresh exact still variants once and preserve learner audio and later downloads', async () => {
  const source = readFileSync(new URL('../app/sw.js/route.ts', import.meta.url), 'utf8');
  const body = source.match(/async function migrateReadingLandscapeFullOrdinaryStills\(\) \{([\s\S]*?)\n\}/)?.[1];
  assert.ok(body);
  assert.match(source, /then\(migrateStudyOutcomesResidualStills\)\.then\(migrateReadingLandscapeFullOrdinaryStills\)/);
  const origin = 'https://field.test';
  const obsolete = changed.flatMap(path => [path, `${path}?saved=old`, `${path}?width=390`]);
  const preserve = [
    '/course-audio/reading-landscape/en/slide-06.mp3',
    '/course-audio/intro-permaculture/st/slide-01.mp3',
    '/course-animations/reading-landscape/water-flow.mp4',
    '/course-decks/reading-landscape/en/slide-06.jpg',
    '/course-decks/reading-landscape/zu/slide-06.jpg',
    '/course-decks/reading-landscape/st/slide-05.webp',
    '/course-decks/reading-landscape/ve/slide-15.webp',
    '/course-decks/intro-permaculture/st/slide-14.webp',
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
