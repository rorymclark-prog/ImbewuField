import { introFullMediaBeforeEarlierProof } from './intro-full-ordinary-media-history-checks.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { introOrdinaryRead as text, introOrdinaryDigest as digest, introOrdinaryPacket as packet, introOrdinaryChanged as changed, readCurrentIntroDecks as current, validateAndRewindIntroOrdinary as validateAndRewind, type Segment } from './intro-ordinary-paired-history-checks.ts';

test('Intro applies only the 54 reviewed targets and preserves exact source, conditions and all unlisted pairs', () => {
  validateAndRewind();
  const rows = packet.verdicts;
  const get = (language: string, slide: number, field: string) => rows.find((row: { language: string; slide: number; field: string }) =>
    row.language === language && row.slide === slide && row.field === field).recommendedTarget as string;
  for (const language of ['ve', 'ts']) {
    assert.ok(get(language, 1, 'B1').includes('Three ethics, a set of design principles,'));
    assert.ok(get(language, 6, 'B1').includes('return the surplus to the system —'));
    assert.ok(get(language, 8, 'B1').includes('A flood damages your swales.'));
    assert.ok(get(language, 18, 'B2').includes('Nearby weather-station records'));
    assert.ok(get(language, 19, 'B0').includes('north-west'));
    assert.ok(get(language, 22, 'B3').includes('older neighbour') && get(language, 22, 'B3').includes('worst wind'));
  }
  assert.ok(get('ts', 15, 'B3').includes('occasional attention'), 'repair the inherited every-time ambiguity without changing the source timing');
  assert.ok(get('ve', 19, 'B4').includes('where to plant'), 'preserve broad plant scope rather than silently narrowing to cultivation');
});

test('Intro layer guards reject changed English, wrong numbering, unlisted changes and false English draft status', () => {
  for (const mutate of [
    (d: ReturnType<typeof current>) => { d.ve.slides[0].english.body[1] += ' Changed.'; },
    (d: ReturnType<typeof current>) => { d.ts.slides[0].n = 2; },
    (d: ReturnType<typeof current>) => { d.ve.slides[6].target.body[0].text = 'Unapproved'; },
    (d: ReturnType<typeof current>) => { d.ve.slides[0].target.body[1].segments[1] = { sourceEnglish: 'Three ethics, a set of design principles,', status: 'draft', text: 'Three ethics, a set of design principles,', reason: 'false translation' }; },
    (d: ReturnType<typeof current>) => { d.ts.slides[14].target.body[3].segments.find((s: Segment) => s.sourceEnglish === 'occasional attention').sourceEnglish = 'daily attention'; },
  ]) {
    const changedDeck = current(); mutate(changedDeck);
    assert.throws(() => validateAndRewind(changedDeck), 'a historical reconstruction must first reject actual drift');
  }
});

test('Intro protects all unlisted media and the exact ST22 narration/still binding before selected renders', () => {
  const frames = new Set<string>(packet.verdicts.filter((row: { id: string }) => changed.has(row.id))
    .map((row: { language: string; slide: number }) => `public/course-decks/intro-permaculture/${row.language}/slide-${String(row.slide).padStart(2, '0')}.webp`));
  const assets = JSON.parse(text('intro-assets-before.json')) as { path: string; sha256: string; bytes: number }[];
  assert.equal(digest(text('intro-assets-before.json')), '7c43e0d55641518535eb70e96a88721437fbfe09c0d717a481c497522ee858fd');
  for (const asset of assets.filter(asset => !frames.has(asset.path))) {
    const bytes = readFileSync(new URL(`../${asset.path}`, import.meta.url));
    // The complete later Intro layer is verified before these exact dated unlisted descriptors.
    const later = introFullMediaBeforeEarlierProof(asset.path);
    assert.equal(later?.bytes ?? bytes.length, asset.bytes, asset.path);
    assert.equal(later?.sha256 ?? digest(bytes), asset.sha256, asset.path);
  }
  assert.equal(assets.find(a => a.path === 'public/course-audio/intro-permaculture/st/slide-22.mp3')!.sha256,
    '38a4980a865fbde9541176d1d4d42eac0c4699448a7026c21c4fd8294d508cd6');
  assert.equal(assets.find(a => a.path === 'public/course-decks/intro-permaculture/st/slide-22.webp')!.sha256,
    '96bfd69d4d9f270f1511afda15cf69c8c3e9eb8c99a49b83d0b252e32de70537');
});
