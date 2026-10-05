import { COURSE_NARRATION, trackTitle } from './course-audio';
import { COURSE_TRANSCRIPTS } from './course-transcripts';
import {
  ISIZULU_DECK_SOURCE_BINDINGS,
  resolveIsiZuluDeckSourcePair,
  type DeckTranscriptRegistry,
  type IsiZuluDeckSourceTitles,
} from './course-deck-source-bindings';

/** Visual correction metadata. This is deliberately not an audio/transcript binding. */
export interface IsiZuluSilentDeckDraft {
  readonly moduleId: string;
  readonly slide: number;
  readonly sourceHeading: string;
  readonly sourceEnglish: readonly string[];
  readonly correctedTitle: string;
  readonly correctedTarget: readonly string[];
  /** The immutable legacy English source digest, not a digest of the new target. */
  readonly sourceHash: string;
  readonly targetHash: string;
  readonly imageUrl: string;
  readonly imageSha256: string;
  readonly imageBytes: number;
  readonly width: number;
  readonly height: number;
  readonly reviewStatus: 'unreviewed';
  readonly audioBinding: 'none';
}

export type IsiZuluSilentDeckDraftInput = IsiZuluSilentDeckDraft;
export type IsiZuluSilentDeckDraftRegistry = Readonly<Record<string, IsiZuluSilentDeckDraft>>;

const SHA256 = /^[a-f0-9]{64}$/;
const positiveInteger = (value: number): boolean => Number.isSafeInteger(value) && value > 0;
const identity = (moduleId: string, slide: number): string => `${moduleId}:${slide}`;
const factoryRegistries = new WeakSet<object>();

function manifestTitles(moduleId: string, slide: number): IsiZuluDeckSourceTitles | null {
  const track = COURSE_NARRATION[moduleId]?.tracks.find((candidate) => candidate.slide === slide);
  if (!track) return null;
  return { en: trackTitle(track, 'en'), zu: trackTitle(track, 'zu') };
}

function sameText(actual: readonly string[], expected: readonly string[]): boolean {
  return Array.isArray(actual) && actual.length === expected.length
    && expected.every((paragraph, index) => actual[index] === paragraph);
}

function validateSilentDraft(
  candidate: IsiZuluSilentDeckDraftInput,
  transcripts: DeckTranscriptRegistry,
  titles: IsiZuluDeckSourceTitles | undefined,
): void {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    throw new Error('IsiZulu silent draft must be an object');
  }
  if (typeof candidate.moduleId !== 'string' || !candidate.moduleId.trim() || !positiveInteger(candidate.slide)) {
    throw new Error('IsiZulu silent draft needs a module id and positive slide number');
  }
  const legacy = ISIZULU_DECK_SOURCE_BINDINGS.find((row) =>
    row.moduleId === candidate.moduleId && row.slide === candidate.slide);
  if (!legacy) throw new Error(`No immutable isiZulu source binding for ${candidate.moduleId} slide ${candidate.slide}`);

  const actualTitles = titles ?? manifestTitles(candidate.moduleId, candidate.slide);
  if (!actualTitles) throw new Error(`No current narration titles for ${candidate.moduleId} slide ${candidate.slide}`);
  const pair = resolveIsiZuluDeckSourcePair(candidate.moduleId, candidate.slide, transcripts, actualTitles);
  if (!pair) throw new Error(`Current isiZulu narration source or title drifted at ${candidate.moduleId} slide ${candidate.slide}`);
  if (candidate.sourceHeading !== pair.sourceHeading || candidate.sourceHeading !== legacy.sourceHeading) {
    throw new Error(`Source heading differs from the immutable title at ${candidate.moduleId} slide ${candidate.slide}`);
  }
  if (!sameText(candidate.sourceEnglish, pair.source) || !sameText(candidate.sourceEnglish, legacy.source)) {
    throw new Error(`English source text or order differs from the immutable pair at ${candidate.moduleId} slide ${candidate.slide}`);
  }
  if (candidate.sourceHash !== legacy.sourceHash) {
    throw new Error(`Source hash differs from the immutable pair at ${candidate.moduleId} slide ${candidate.slide}`);
  }
  if (typeof candidate.correctedTitle !== 'string' || !candidate.correctedTitle.trim() ||
      !Array.isArray(candidate.correctedTarget) || candidate.correctedTarget.length === 0 ||
      candidate.correctedTarget.some((paragraph) => typeof paragraph !== 'string' || !paragraph.trim())) {
    throw new Error(`Corrected isiZulu text is empty at ${candidate.moduleId} slide ${candidate.slide}`);
  }
  if (!SHA256.test(candidate.targetHash)) throw new Error(`Invalid target SHA-256 at ${candidate.moduleId} slide ${candidate.slide}`);
  if (candidate.imageUrl !== `/course-decks/${candidate.moduleId}/zu-silent/slide-${String(candidate.slide).padStart(2, '0')}.webp`) {
    throw new Error(`Silent draft image must use its isiZulu WebP slide path at ${candidate.moduleId} slide ${candidate.slide}`);
  }
  if (!SHA256.test(candidate.imageSha256) || !positiveInteger(candidate.imageBytes)) {
    throw new Error(`Invalid image hash or byte size at ${candidate.moduleId} slide ${candidate.slide}`);
  }
  if (candidate.width !== 1440 || !Number.isSafeInteger(candidate.height) || candidate.height < 5400) {
    throw new Error(`Silent draft image dimensions must be 1440x5400 or taller at ${candidate.moduleId} slide ${candidate.slide}`);
  }
  if (candidate.reviewStatus !== 'unreviewed' || candidate.audioBinding !== 'none') {
    throw new Error(`Silent draft must remain unreviewed and have no audio binding at ${candidate.moduleId} slide ${candidate.slide}`);
  }
}

/**
 * Copy and freeze proposed visual rows only after checking them against the immutable transcript
 * snapshot and current narration titles. This factory does not grant semantic or fluent approval.
 */
export function createIsiZuluSilentDeckDraftRegistry(
  candidates: readonly IsiZuluSilentDeckDraftInput[],
  transcripts: DeckTranscriptRegistry = COURSE_TRANSCRIPTS,
  titleFor?: (moduleId: string, slide: number) => IsiZuluDeckSourceTitles | undefined,
): IsiZuluSilentDeckDraftRegistry {
  if (!Array.isArray(candidates)) throw new Error('IsiZulu silent draft rows must be an array');
  const rows: Record<string, IsiZuluSilentDeckDraft> = Object.create(null);
  for (const candidate of candidates) {
    const key = identity(candidate?.moduleId, candidate?.slide);
    if (Object.hasOwn(rows, key)) throw new Error(`Duplicate isiZulu silent draft identity ${key}`);
    validateSilentDraft(candidate, transcripts, titleFor?.(candidate.moduleId, candidate.slide));
    rows[key] = Object.freeze({
      ...candidate,
      sourceEnglish: Object.freeze([...candidate.sourceEnglish]),
      correctedTarget: Object.freeze([...candidate.correctedTarget]),
    });
  }
  const registry = Object.freeze(rows);
  factoryRegistries.add(registry);
  return registry;
}

/** Resolve only a frozen, checked registry row while the live narration pair still matches. */
export function resolveIsiZuluSilentDeckDraft(
  registry: IsiZuluSilentDeckDraftRegistry,
  moduleId: string,
  slide: number,
  transcripts: DeckTranscriptRegistry = COURSE_TRANSCRIPTS,
  titles?: IsiZuluDeckSourceTitles,
): IsiZuluSilentDeckDraft | null {
  if (!registry || typeof registry !== 'object' || !factoryRegistries.has(registry) || !Object.isFrozen(registry) ||
      !positiveInteger(slide)) return null;
  const candidate = registry[identity(moduleId, slide)];
  if (!candidate || !Object.isFrozen(candidate) || !Object.isFrozen(candidate.sourceEnglish) ||
      !Object.isFrozen(candidate.correctedTarget)) return null;
  try {
    validateSilentDraft(candidate, transcripts, titles ?? manifestTitles(moduleId, slide) ?? undefined);
  } catch {
    return null;
  }
  return candidate;
}
