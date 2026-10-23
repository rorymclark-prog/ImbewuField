import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('saved Soil wording refreshes once while other lessons and narration remain offline', async () => {
  const source = readFileSync(new URL('../app/sw.js/route.ts', import.meta.url), 'utf8');
  const body = source.match(/async function migrateSoilFullerLearnerStills\(\) \{([\s\S]*?)\n\}/)?.[1];
  assert.ok(body);
  assert.match(source, /then\(migrateSoilWaterOrdinaryPairedStills\)\.then\(migrateSoilFullerLearnerStills\)\.then/);
  const origin = 'https://field.test';
  const changed = ["st/04", "ve/04", "ts/04", "st/06", "st/07", "st/08", "st/09", "st/11", "st/12", "st/13", "st/15", "st/16", "st/17", "ve/06", "ve/07", "ve/08", "ve/09", "ve/11", "ve/12", "ve/13", "ve/15", "ve/16", "ve/17", "ve/18", "ts/06", "ts/07", "ts/08", "ts/09", "ts/11", "ts/12", "ts/13", "ts/15", "ts/16", "ts/17"]
    .map(part => { const [language, slide] = part.split('/'); return `/course-decks/soil-health/${language}/slide-${slide}.webp`; });
  const stale = changed.flatMap(path => [path, `${path}?saved=old`, `${path}?width=small`]);
  const preserved = [
    '/course-decks/soil-health/st/slide-18.webp',
    '/course-decks/soil-health/ve/slide-10.webp?cached=1',
    '/course-decks/soil-health/en/slide-15.jpg',
    '/course-decks/soil-health/zu/slide-15.jpg',
    '/course-audio/soil-health/en/slide-15.mp3',
    '/course-audio/intro-permaculture/st/slide-15.mp3',
    '/course-decks/vegetables-staples/ts/slide-15.webp',
    '/course-decks/water-harvesting/ts/slide-15.webp?cached=1',
    '/course-animations/soil-health/flow-soil-reading.mp4',
    '/course-decks/intro-permaculture/st/slide-15.webp',
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
