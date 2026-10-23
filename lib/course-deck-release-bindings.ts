/** A displayed release and a recording are separate inventories. Only an exact pair match
 * can offer an archived voice over a current deck; silent replacements never grant that match. */
export interface CourseDeckReleaseSlide {
  readonly slide: number;
  readonly sourceHeading: string;
  readonly sourceEnglish: readonly string[];
  readonly targetHeading: string;
  readonly targetText: readonly string[];
  readonly sourceHash: string;
  readonly targetHash: string;
  readonly imageUrl: string;
  readonly imageSha256: string;
  readonly imageBytes: number;
  readonly width: number;
  readonly height: number;
}
export interface CourseDeckRelease {
  readonly moduleId: string;
  readonly language: string;
  readonly pairPath: string;
  readonly pairSha256: string;
  readonly reviewStatus: 'unreviewed';
  readonly audioBinding: 'none' | 'recorded-pair';
  readonly slides: readonly CourseDeckReleaseSlide[];
}
export type CourseDeckReleaseRegistry = Readonly<Record<string, CourseDeckRelease>>;
export type DeckReleaseSource = (slide: number) => { heading: string; body: readonly string[] } | undefined;
const SHA = /^[a-f0-9]{64}$/;
const registries = new WeakSet<object>();
const releases = new WeakSet<object>();
const key = (moduleId: string, language: string) => `${moduleId}.${language}`;
const same = (a: readonly string[] | undefined, b: readonly string[]) => Array.isArray(a)
  && a.length === b.length && b.every((text, index) => a[index] === text);

export function createCourseDeckReleaseRegistry(rows: readonly CourseDeckRelease[],
  expectedCounts: Readonly<Record<string, number>>): CourseDeckReleaseRegistry {
  const result: Record<string, CourseDeckRelease> = Object.create(null);
  for (const row of rows) {
    if (!row || !/^[a-z0-9-]+$/.test(row.moduleId) || !/^[a-z]{2}$/.test(row.language)
      || !row.pairPath.startsWith('docs/narration/') || !SHA.test(row.pairSha256)
      || row.reviewStatus !== 'unreviewed' || !['none', 'recorded-pair'].includes(row.audioBinding)
      || !Array.isArray(row.slides) || row.slides.length !== expectedCounts[key(row.moduleId, row.language)]
      || !Number.isSafeInteger(expectedCounts[key(row.moduleId, row.language)])
      || expectedCounts[key(row.moduleId, row.language)] <= 0 || result[key(row.moduleId, row.language)]) {
      throw new Error('Invalid or duplicate current deck release');
    }
    for (const [index, slide] of row.slides.entries()) {
      const texts = [slide.sourceHeading, slide.targetHeading, ...slide.sourceEnglish, ...slide.targetText];
      if (slide.slide !== index + 1 || !slide.sourceEnglish.length || !slide.targetText.length
        || texts.some(text => typeof text !== 'string' || !text.trim())
        || ![slide.sourceHash, slide.targetHash, slide.imageSha256].every(hash => SHA.test(hash))
        || slide.imageUrl !== `/course-decks/${row.moduleId}/${row.language}-silent/slide-${String(slide.slide).padStart(2, '0')}.webp`
        || !Number.isSafeInteger(slide.imageBytes) || slide.imageBytes <= 0
        || slide.width !== 1440 || !Number.isSafeInteger(slide.height) || slide.height < 5400) {
        throw new Error('Invalid current deck release slide identity, text or image');
      }
    }
    result[key(row.moduleId, row.language)] = Object.freeze({ ...row,
      slides: Object.freeze(row.slides.map(slide => Object.freeze({ ...slide,
        sourceEnglish: Object.freeze([...slide.sourceEnglish]), targetText: Object.freeze([...slide.targetText]),
      }))),
    });
    releases.add(result[key(row.moduleId, row.language)]);
  }
  const frozen = Object.freeze(result); registries.add(frozen); return frozen;
}

/** A caller must supply its live canonical text; stale source metadata cannot authorize a view. */
export function resolveCourseDeckRelease(registry: CourseDeckReleaseRegistry, moduleId: string,
  language: string, sourceFor: DeckReleaseSource, targetFor?: DeckReleaseSource): CourseDeckRelease | null {
  if (!registries.has(registry)) return null;
  const row = registry[key(moduleId, language)];
  if (!row || row.slides.some(slide => {
    const live = sourceFor(slide.slide);
    const target = targetFor?.(slide.slide);
    return !live || live.heading !== slide.sourceHeading || !same(live.body, slide.sourceEnglish)
      || (targetFor !== undefined && (!target || target.heading !== slide.targetHeading || !same(target.body, slide.targetText)));
  })) return null;
  return row;
}

export function recordingMatchesDeckRelease(release: CourseDeckRelease | null,
  recordedPairSha256: string | undefined): boolean {
  return !!release && releases.has(release) && release.audioBinding === 'recorded-pair' && SHA.test(recordedPairSha256 ?? '')
    && release.pairSha256 === recordedPairSha256;
}

export interface ReleasePairField { readonly status: string; readonly text?: string }
export interface ReleasePairSlide {
  readonly n: number;
  readonly english: { readonly heading: string; readonly body: readonly string[] };
  readonly target: { readonly heading: ReleasePairField; readonly body: readonly ReleasePairField[] };
}
export interface ReleasePair {
  readonly language: string;
  readonly sourceLanguage: string;
  readonly reviewStatus: string;
  readonly slides: readonly ReleasePairSlide[];
}
function pairedText(field: ReleasePairField, source: string): string | null {
  if (field.status === 'english-hold') return field.text === undefined ? source : null;
  if (field.status !== 'draft' || typeof field.text !== 'string' || !field.text.trim()
    || field.text === source) return null;
  return field.text;
}

/** Compare actual current pair wording and statuses, not a stale copied target digest. */
export function releasePairTarget(pair: ReleasePair, release: CourseDeckRelease, slide: number) {
  if (pair.language !== release.language || pair.sourceLanguage !== 'en' || pair.reviewStatus !== 'unreviewed'
    || pair.slides.length !== release.slides.length || pair.slides.some((row, i) => row.n !== i + 1)) return undefined;
  const actual = pair.slides[slide - 1], expected = release.slides[slide - 1];
  if (!actual || !expected || actual.english.heading !== expected.sourceHeading
    || !same(actual.english.body, expected.sourceEnglish)
    || actual.target.body.length !== actual.english.body.length) return undefined;
  const heading = pairedText(actual.target.heading, actual.english.heading);
  const body = actual.target.body.map((field, i) => pairedText(field, actual.english.body[i]));
  return heading !== null && body.every(text => text !== null)
    ? { heading, body: body as string[] } : undefined;
}

export interface CourseDeckReleaseBindings {
  has(moduleId: string, language: string): boolean;
  resolve(moduleId: string, language: string, sourceFor: DeckReleaseSource): CourseDeckRelease | null;
}
export function createCourseDeckReleaseBindings(rows: readonly CourseDeckRelease[],
  expectedCounts: Readonly<Record<string, number>>, pairFor: (path: string) => ReleasePair | undefined): CourseDeckReleaseBindings {
  let checked: CourseDeckReleaseRegistry;
  try { checked = createCourseDeckReleaseRegistry(rows, expectedCounts); }
  catch { checked = createCourseDeckReleaseRegistry([], expectedCounts); }
  return Object.freeze({
    has(moduleId: string, language: string) { return Object.hasOwn(expectedCounts, key(moduleId, language)); },
    resolve(moduleId: string, language: string, sourceFor: DeckReleaseSource) {
      try {
        const release = checked[key(moduleId, language)];
        const pair = release && pairFor(release.pairPath);
        return pair ? resolveCourseDeckRelease(checked, moduleId, language, sourceFor,
          slide => releasePairTarget(pair, release, slide)) : null;
      } catch { return null; }

    },
  });
}
