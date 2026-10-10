import test from 'node:test';
import assert from 'node:assert/strict';
import { createCourseDeckReleaseRegistry, resolveCourseDeckRelease, recordingMatchesDeckRelease, releasePairTarget,
  type CourseDeckRelease } from '../lib/course-deck-release-bindings.ts';

// These are explicit factory fixtures, not invented hashes for a published frame. Live release
// data must be generated separately from the approved pair and real compressed image bytes.
const digest = 'a'.repeat(64);
const counts = { 'intro-permaculture.st': 1 };
const fixture = (audioBinding: CourseDeckRelease['audioBinding'] = 'recorded-pair'): CourseDeckRelease => ({
  moduleId: 'intro-permaculture', language: 'st', pairPath: 'docs/narration/fixture.json',
  pairSha256: digest, reviewStatus: 'unreviewed', audioBinding,
  slides: [{ slide: 1, sourceHeading: 'Earth Care', sourceEnglish: ['Protect soil.'],
    targetHeading: 'Tlhokomelo ya Lefatshe', targetText: ['Sireletsa mobu.'],
    sourceHash: digest, targetHash: digest, imageUrl: '/course-decks/intro-permaculture/st-silent/slide-01.webp',
    imageSha256: digest, imageBytes: 123, width: 1440, height: 5402 }],
});
const source = () => ({ heading: 'Earth Care', body: ['Protect soil.'] });
const target = () => ({ heading: 'Tlhokomelo ya Lefatshe', body: ['Sireletsa mobu.'] });

test('a matching recorded pair remains eligible but silent replacements and mismatched recordings cannot borrow its voice', () => {
  const registry = createCourseDeckReleaseRegistry([fixture()], counts);
  const release = resolveCourseDeckRelease(registry, 'intro-permaculture', 'st', source, target);
  assert.ok(release);
  assert.equal(recordingMatchesDeckRelease(release, digest), true);
  assert.equal(recordingMatchesDeckRelease(release, 'b'.repeat(64)), false);
  assert.equal(recordingMatchesDeckRelease(release, undefined), false);
  assert.equal(recordingMatchesDeckRelease(fixture(), digest), false, 'raw unvalidated record cannot authorize audio');
  const silent = createCourseDeckReleaseRegistry([fixture('none')], counts);
  assert.equal(recordingMatchesDeckRelease(resolveCourseDeckRelease(silent, 'intro-permaculture', 'st', source, target), digest), false);
});

test('live source, target, title and order drift withdraw the current pair instead of revealing an archived one', () => {
  const registry = createCourseDeckReleaseRegistry([fixture()], counts);
  for (const liveSource of [() => undefined, () => ({ ...source(), body: ['Protect soil!'] }),
    () => ({ ...source(), heading: 'Earth' }), () => ({ ...source(), body: ['Extra', ...source().body] })]) {
    assert.equal(resolveCourseDeckRelease(registry, 'intro-permaculture', 'st', liveSource, target), null);
  }
  for (const liveTarget of [() => undefined, () => ({ ...target(), body: ['Changed target'] }),
    () => ({ ...target(), heading: 'Changed title' })]) {
    assert.equal(resolveCourseDeckRelease(registry, 'intro-permaculture', 'st', source, liveTarget), null);
  }
  assert.equal(resolveCourseDeckRelease(Object.freeze({}), 'intro-permaculture', 'st', source, target), null);
  assert.equal(resolveCourseDeckRelease(registry, 'intro-permaculture', 've', source, target), null);
});

test('the release factory rejects ambiguous identity, empty wording and invalid media rather than registering plausible metadata', () => {
  assert.throws(() => createCourseDeckReleaseRegistry([fixture(), fixture()], counts), /duplicate/);
  assert.throws(() => createCourseDeckReleaseRegistry([fixture()], { 'intro-permaculture.st': 22 }), /Invalid/,
    'one plausible slide cannot truncate the independently bound22-slide release');
  assert.throws(() => createCourseDeckReleaseRegistry([fixture()], {}), /Invalid/);
  for (const mutate of [
    (r: any) => { r.slides[0].slide = 2; },
    (r: any) => { r.slides[0].targetText = ['']; },
    (r: any) => { r.slides[0].sourceEnglish = [' ']; },
    (r: any) => { r.slides[0].imageUrl = '/course-decks/intro-permaculture/st/slide-01.webp'; },
    (r: any) => { r.slides[0].imageSha256 = 'stale'; },
    (r: any) => { r.slides[0].width = 1439; },
    (r: any) => { r.slides[0].height = 5399; },
    (r: any) => { r.slides[0].imageBytes = 0; },
    (r: any) => { r.reviewStatus = 'reviewed'; },
  ]) {
    const row = structuredClone(fixture()); mutate(row);
    assert.throws(() => createCourseDeckReleaseRegistry([row], counts), /Invalid/);
  }
  const registry = createCourseDeckReleaseRegistry([fixture()], counts);
  assert.ok(Object.isFrozen(registry['intro-permaculture.st'].slides[0].targetText));
});


test('actual pair statuses cannot disguise English identity as draft or preserve a false hold with competing text', () => {
  const release = fixture();
  const pair = { language: 'st', sourceLanguage: 'en', reviewStatus: 'unreviewed', slides: [{ n: 1,
    english: { heading: 'Earth Care', body: ['Protect soil.'] },
    target: { heading: { status: 'draft', text: 'Tlhokomelo ya Lefatshe' },
      body: [{ status: 'draft', text: 'Sireletsa mobu.' }] } }] };
  assert.deepEqual(releasePairTarget(pair, release, 1), target());
  const identity = structuredClone(pair); identity.slides[0].target.body[0].text = 'Protect soil.';
  assert.equal(releasePairTarget(identity, release, 1), undefined);
  const hold = structuredClone(pair); hold.slides[0].target.body[0] = { status: 'english-hold', text: 'Competing' };
  assert.equal(releasePairTarget(hold, release, 1), undefined);
  const sourceDrift = structuredClone(pair); sourceDrift.slides[0].english.body[0] = 'Protect other soil.';
  assert.equal(releasePairTarget(sourceDrift, release, 1), undefined);
  const approved = createCourseDeckReleaseRegistry([fixture()], counts);
  const targetDrift = structuredClone(pair); targetDrift.slides[0].target.body[0].text = 'Different';
  assert.equal(resolveCourseDeckRelease(approved, 'intro-permaculture', 'st', source,
    slide => releasePairTarget(targetDrift, release, slide)), null);
});

test('an active invalid replacement blocks old ST clips and resolves English imagery with an explicit voice choice', async () => {
  const { createCourseDeckReleaseBindings } = await import('../lib/course-deck-release-bindings.ts');
  const { trackUrl, fullNarrationUrl, resolveNarrationLang, requiresExplicitNarrationChoice, availableNarrationLanguages } = await import('../lib/course-audio.ts');
  const { slideImageFor, slideImageUrl } = await import('../lib/course-deck.ts');
  const invalid = createCourseDeckReleaseBindings([fixture()], { 'intro-permaculture.st': 22 }, () => undefined);
  assert.equal(invalid.has('intro-permaculture', 'st'), true);
  assert.equal(trackUrl('intro-permaculture', 'st', 22, invalid), null);
  assert.equal(fullNarrationUrl('intro-permaculture', 'st', invalid), null);
  assert.deepEqual(resolveNarrationLang('intro-permaculture', 'st', invalid), { lang: 'en', exact: false });
  assert.equal(requiresExplicitNarrationChoice('intro-permaculture', 'st', invalid), true);
  assert.equal(availableNarrationLanguages('intro-permaculture', invalid).includes('st'), false);
  assert.equal(trackUrl('intro-permaculture', 'en', 22, invalid), '/course-audio/intro-permaculture/en/slide-22.mp3');
  assert.deepEqual(slideImageFor('intro-permaculture', 'st', 22, invalid), {
    url: slideImageUrl('intro-permaculture', 'en', 22), lang: 'en', exact: false,
  });
});

test('the live silent release recomputes approved pair, wording and real image digests and catches same-size byte corruption', async () => {
  const { readFileSync } = await import('node:fs');
  const { createHash } = await import('node:crypto');
  const { COURSE_DECK_RELEASE_ROWS, COURSE_DECK_RELEASE_EXPECTED_COUNTS } = await import('../lib/course-deck-release-bindings-data.ts');
  const { currentRegionalDeckSlide } = await import('../lib/course-deck.ts');
  const sha = (bytes: Uint8Array | string) => createHash('sha256').update(bytes).digest('hex');
  const release = COURSE_DECK_RELEASE_ROWS.find(row => row.moduleId === 'intro-permaculture' && row.language === 'st');
  assert.ok(release);
  const pairBytes = readFileSync(new URL('../' + release.pairPath, import.meta.url));
  // Five independently checked headings expand the active silent release.
  // Validate the entire new layer before retaining the original full-file hash.
  const { coreHeldOrdinaryPairBytesBefore } = await import('./core-held-ordinary-history-checks.ts');
  assert.equal(sha(coreHeldOrdinaryPairBytesBefore(release.pairPath,pairBytes)), '9c0202a568081156f2f472495fd781e5010d0525978b3fb81b61f8b7b1b6985f');
  assert.equal(release.pairSha256, sha(pairBytes));
  const pair = JSON.parse(pairBytes.toString());
  assert.equal(release.slides.length, 22);
  assert.equal(COURSE_DECK_RELEASE_EXPECTED_COUNTS['intro-permaculture.st'], 22);
  const validateImage = (bytes: Buffer, row: typeof release.slides[number]) => {
    assert.equal(bytes.length, row.imageBytes);
    assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
    assert.equal(bytes.toString('ascii', 8, 12), 'WEBP');
    assert.equal(bytes.toString('ascii', 12, 16), 'VP8 ');
    assert.equal(bytes.readUInt16LE(26) & 0x3fff, row.width);
    assert.equal(bytes.readUInt16LE(28) & 0x3fff, row.height);
    assert.equal(sha(bytes), row.imageSha256);
  };
  for (const row of release.slides) {
    const actual = releasePairTarget(pair, release, row.slide);
    assert.ok(actual);
    assert.equal(row.sourceHash, sha(JSON.stringify([row.sourceHeading, ...row.sourceEnglish])));
    assert.equal(row.targetHash, sha(JSON.stringify([actual.heading, ...actual.body])));
    assert.equal(row.targetHeading, actual.heading);
    assert.deepEqual(row.targetText, actual.body);
    assert.deepEqual(currentRegionalDeckSlide(release.moduleId, release.language, row.slide), row,
      'live canonical title/body and actual current pair must resolve each published slot');
    const bytes = readFileSync(new URL('../public' + row.imageUrl, import.meta.url));
    validateImage(bytes, row);
    const corrupt = Buffer.from(bytes); corrupt[corrupt.length - 20] ^= 1;
    assert.equal(corrupt.length, bytes.length);
    assert.throws(() => validateImage(corrupt, row), /Expected values/, 'same-size compressed corruption cannot pass metadata-only guards');
  }
});

test('the new ST release is silent by default while optional full packs use English and the old recording inventory remains owned', async () => {
  const { COURSE_NARRATION, availableNarrationLanguages, resolveNarrationLang, requiresExplicitNarrationChoice,
    trackUrl, fullNarrationUrl } = await import('../lib/course-audio.ts');
  const { defaultOfflinePackVariant, offlinePack } = await import('../lib/offline-pack.ts');
  assert.ok(COURSE_NARRATION['intro-permaculture'].languages.includes('st'), 'archive membership is preserved');
  assert.equal(availableNarrationLanguages('intro-permaculture').includes('st'), false);
  assert.deepEqual(resolveNarrationLang('intro-permaculture', 'st'), { lang: 'en', exact: false });
  assert.equal(requiresExplicitNarrationChoice('intro-permaculture', 'st'), true);
  assert.equal(trackUrl('intro-permaculture', 'st', 22), null);
  assert.equal(fullNarrationUrl('intro-permaculture', 'st'), null);
  assert.equal(defaultOfflinePackVariant(['intro-permaculture'], 'st'), 'slides');
  const silent = offlinePack('intro-permaculture', 'st', 'standard', 'slides');
  assert.equal(silent.entries.some(row => row.kind === 'audio'), false);
  const full = offlinePack('intro-permaculture', 'st', 'standard', 'full');
  assert.equal(full.entries.filter(row => row.kind === 'audio').length, 22);
  assert.ok(full.entries.filter(row => row.kind === 'audio').every(row => row.url.includes('/en/')));
  assert.equal(full.entries.some(row => row.url.includes('/st/') && row.kind === 'audio'), false);
  assert.equal(requiresExplicitNarrationChoice('intro-permaculture', 'en'), false);
  assert.ok(trackUrl('intro-permaculture', 'en', 22));
});

test('omitted rows and malformed current pairs keep the declared replacement unavailable instead of exposing old assets', async () => {
  const { createCourseDeckReleaseBindings } = await import('../lib/course-deck-release-bindings.ts');
  const omitted = createCourseDeckReleaseBindings([], counts, () => undefined);
  assert.equal(omitted.has('intro-permaculture', 'st'), true);
  assert.equal(omitted.resolve('intro-permaculture', 'st', source), null);
  const malformed = createCourseDeckReleaseBindings([fixture()], counts,
    () => ({ language: 'st', sourceLanguage: 'en', reviewStatus: 'unreviewed', slides: [] }));
  assert.equal(malformed.has('intro-permaculture', 'st'), true);
  assert.equal(malformed.resolve('intro-permaculture', 'st', source), null);
});

test('the complete matching archived ST pair still authorizes its exact old clips in a recorded fixture', async () => {
  const { readFileSync } = await import('node:fs');
  const { createHash } = await import('node:crypto');
  const { COURSE_DECK_RELEASE_ROWS } = await import('../lib/course-deck-release-bindings-data.ts');
  const { createCourseDeckReleaseBindings, releasePairTarget } = await import('../lib/course-deck-release-bindings.ts');
  const { trackUrl, fullNarrationUrl } = await import('../lib/course-audio.ts');
  const pairPath = 'docs/narration/intro-permaculture.st.paired-draft.json';
  const bytes = readFileSync(new URL('../' + pairPath, import.meta.url));
  const sha = createHash('sha256').update(bytes).digest('hex');
  assert.equal(sha, '50ac554323e41921cdfc83dd4b6d6abf18f240d8c416b38dc95e01630d4b3df9');
  const pair = JSON.parse(bytes.toString());
  const recorded = structuredClone(COURSE_DECK_RELEASE_ROWS[0]);
  const fixtureRow: CourseDeckRelease = { ...recorded, pairPath, pairSha256: sha, audioBinding: 'recorded-pair',
    slides: recorded.slides.map(row => {
      const old = releasePairTarget(pair, recorded, row.slide);
      assert.ok(old);
      return { ...row, targetHeading: old.heading, targetText: old.body };
    }),
  };
  // Image metadata is irrelevant to this injected recording fixture; no live row is rebound.
  const bindings = createCourseDeckReleaseBindings([fixtureRow], { 'intro-permaculture.st': 22 }, () => pair);
  assert.equal(trackUrl('intro-permaculture', 'st', 22, bindings), '/course-audio/intro-permaculture/st/slide-22.mp3');
  assert.equal(fullNarrationUrl('intro-permaculture', 'st', bindings), '/course-audio/intro-permaculture/st/full.mp3');
});
