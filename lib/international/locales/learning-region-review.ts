import { createHash } from 'node:crypto';
import { rawJsonIsLossless } from '../../lossless-json';
import { assessMessage } from './coverage';
import { readCurrentBoundSourceNodes, type BoundSourceNode } from './source-reader';
import { LEARNING_REGION_REVIEW_SOURCE as binding, LEARNING_REGION_REVIEW_LOCALES, type LearningReviewLocale } from './learning-region-review-source';
import type { DraftMessage, MessageState, SourceMessage } from './types';

export { LEARNING_REGION_REVIEW_LOCALES, type LearningReviewLocale } from './learning-region-review-source';
export interface LearningNodeBinding extends Omit<BoundSourceNode, 'english'> {
  file: typeof binding.sourceFile;
  fileSha256: string;
  fileBytes: number;
  sourceCommit: null;
  sourceState: string;
}
export interface LearningFrozenMessage {
  key: string;
  english: string;
  sha256: string;
  fragment: boolean;
  contextRequired: boolean;
  contextNote: string;
  translationConstraint: 'preserve-meaning-and-boundary' | 'exact-English-echo';
  bindings: LearningNodeBinding[];
}
export interface LearningReviewRow extends LearningFrozenMessage {
  kind: 'ai-draft' | 'fixed-literal';
  currentEnglish: string | null;
  translation: string | null;
  state: MessageState | 'fixed-literal';
  issues: string[];
}
export interface LearningReviewData {
  sourceSha256: string;
  sourceCommit: null;
  capturedOn: string;
  issue: string | null;
  source: { path: string; status: 'matched' | 'changed' | 'unavailable' | 'invalid'; capturedSha256: string; currentSha256: string | null };
  languages: { locale: LearningReviewLocale; packetStatus: 'valid' | 'missing' | 'invalid'; issue: string | null; rows: LearningReviewRow[] }[];
}
export interface LearningReviewInputs {
  sourceText: string | undefined;
  currentSourceText: string | undefined;
  packets: Readonly<Partial<Record<LearningReviewLocale, string>>>;
}
const hash = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex');
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const exactKeys = (value: Record<string, unknown>, keys: readonly string[]) => JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort());
const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
function parse(text: string | undefined): unknown {
  try { return rawJsonIsLossless(text) ? JSON.parse(text) : null; } catch { return null; }
}
const messageFields = ['key', 'english', 'sha256', 'fragment', 'contextRequired', 'contextNote', 'translationConstraint', 'bindings'] as const;
const bindingFields = ['file', 'fileSha256', 'fileBytes', 'nodeKind', 'startUtf16', 'endUtf16', 'startByte', 'endByte', 'line', 'column', 'selector', 'rawSource', 'sourceCommit', 'sourceState'] as const;
const protectedTokens = (text: string) => JSON.stringify(text.match(/DEMO|\d+(?:[.,]\d+)?|\{[^{}]*\}/g)?.sort() ?? []);
const leadingSpace = (text: string) => text.match(/^\s*/u)![0];
const trailingSpace = (text: string) => text.match(/\s*$/u)![0];
const punctuation = (text: string) => [text.trim().match(/^[.,:;!?()]+/u)?.[0] ?? '', text.trim().match(/[.,:;!?()]+$/u)?.[0] ?? ''];

function translationMatches(message: LearningFrozenMessage, text: unknown): text is string {
  return typeof text === 'string' && !!text.trim() && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(text)
    && protectedTokens(text) === protectedTokens(message.english)
    && leadingSpace(text) === leadingSpace(message.english) && trailingSpace(text) === trailingSpace(message.english)
    && (message.translationConstraint !== 'exact-English-echo' || text === message.english)
    // Internal possessive grammar is free; only the captured fragment edges bind.
    && (!message.fragment || equal(punctuation(text), punctuation(message.english)));
}

/** Known inactive packets only. Whole-byte identities preserve campaign metadata;
 * row equality retains every context/AST field instead of coercing nursery schema.
 * Only authored phrases enter assessMessage. Fixed copies make no AI/review claim. */
export function buildLearningRegionReviewData(input: LearningReviewInputs): LearningReviewData {
  const currentSha256 = typeof input.currentSourceText === 'string' ? hash(input.currentSourceText) : null;
  const source: LearningReviewData['source'] = { path: binding.sourceFile, capturedSha256: binding.sourceFileSha256, currentSha256,
    status: currentSha256 === null ? 'unavailable' : currentSha256 === binding.sourceFileSha256 ? 'matched' : 'changed' };
  const base = { sourceSha256: binding.sourceSha256, sourceCommit: null, capturedOn: binding.capturedOn, source };
  // A file hash alone cannot establish the AST binding when its packet is held.
  function held(issue: string): LearningReviewData { source.status = 'invalid'; return { ...base, issue, languages: [] }; }
  const frozen = parse(input.sourceText);
  if (typeof input.sourceText !== 'string' || hash(input.sourceText) !== binding.sourceSha256 || !object(frozen)
    || frozen.sourceCommit !== null || frozen.sourceState !== binding.sourceState || frozen.sourceFile !== binding.sourceFile
    || frozen.sourceFileSha256 !== binding.sourceFileSha256 || frozen.sourceFileBytes !== binding.sourceFileBytes
    || !Array.isArray(frozen.messages) || frozen.messages.length !== binding.messageCount) {
    return held('Frozen English source packet could not be verified. Comparison is held.');
  }
  const messages: LearningFrozenMessage[] = [];
  for (let index = 0; index < frozen.messages.length; index++) {
    const row: unknown = frozen.messages[index];
    if (!object(row) || !exactKeys(row, messageFields) || row.key !== `learningRegionUi${String(index + 1).padStart(3, '0')}`
      || typeof row.english !== 'string' || row.sha256 !== hash(row.english) || typeof row.fragment !== 'boolean'
      || row.contextRequired !== row.fragment || typeof row.contextNote !== 'string' || !row.contextNote.trim()
      || !['preserve-meaning-and-boundary', 'exact-English-echo'].includes(String(row.translationConstraint))
      || !Array.isArray(row.bindings) || row.bindings.length !== 1 || !object(row.bindings[0]) || !exactKeys(row.bindings[0], bindingFields)
      || row.bindings[0].file !== binding.sourceFile || row.bindings[0].fileSha256 !== binding.sourceFileSha256
      || row.bindings[0].fileBytes !== binding.sourceFileBytes || row.bindings[0].sourceCommit !== null || row.bindings[0].sourceState !== binding.sourceState) {
      return held('Frozen English metadata or AST bindings could not be verified. Comparison is held.');
    }
    messages.push(row as unknown as LearningFrozenMessage);
  }
  if (messages.filter(row => row.fragment).length !== binding.fragmentCount
    || !equal(messages.filter(row => row.translationConstraint === 'exact-English-echo').map(row => row.key), binding.fixedLiteralKeys)) {
    return held('Frozen fragment or fixed-literal metadata is inconsistent. Comparison is held.');
  }
  let current: Record<string, string | undefined> = {};
  if (source.status === 'matched' && typeof input.currentSourceText === 'string' && Buffer.byteLength(input.currentSourceText, 'utf8') === binding.sourceFileBytes) {
    current = readCurrentBoundSourceNodes(input.currentSourceText, Object.fromEntries(messages.map(row => [row.key, { ...row.bindings[0], english: row.english }])));
    if (!messages.every(row => current[row.key] === row.english)) { source.status = 'invalid'; current = {}; }
  }
  const sourceIssue = source.status === 'matched' ? null : source.status === 'changed'
    ? 'Current component changed. Its captured English/context binding is stale; current English is not verified.'
    : 'Current component or its AST binding is unavailable. Frozen English is a historical snapshot, not verified current wording.';
  const languages = LEARNING_REGION_REVIEW_LOCALES.map(locale => {
    const packetText = input.packets[locale], packet = parse(packetText);
    const asia = ['hi', 'bn', 'id'].includes(locale), europe = ['de', 'it', 'nl', 'pl'].includes(locale);
    const rootFields = ['locale', 'sourceSha256', 'sourceCommit', 'sourceState', 'sourceFileSha256', 'reviewStatus', 'runtimeActivation', 'humanReview', 'counts', 'messages',
      ...(asia || europe ? ['targetContractSha256', 'activeOrderSha256', 'sourceCampaignLocales', 'sourceCampaignCounts'] : []), ...(europe ? ['preparedContractSha256', 'targetLocales'] : [])];
    let problem: string | null = packetText === undefined ? 'Inactive draft packet is missing. No older draft is substituted.' : null;
    const packetStatus: 'missing' | 'invalid' = packetText === undefined ? 'missing' : 'invalid';
    if (!problem && (hash(packetText!) !== binding.packetSha256[locale] || !object(packet) || !exactKeys(packet, rootFields)
      || packet.locale !== locale || packet.sourceSha256 !== binding.sourceSha256 || packet.sourceCommit !== null
      || packet.sourceState !== binding.sourceState || packet.sourceFileSha256 !== binding.sourceFileSha256
      || packet.reviewStatus !== 'unreviewed-ai-draft' || packet.runtimeActivation !== false || packet.humanReview !== false
      || !Array.isArray(packet.messages) || packet.messages.length !== messages.length)) {
      problem = 'Inactive packet identity, locale or unreviewed metadata is invalid. Draft text is withheld; no older draft is substituted.';
    }
    const translations: Record<string, string> = {};
    if (!problem && object(packet) && Array.isArray(packet.messages)) {
      for (let index = 0; index < messages.length; index++) {
        const row: unknown = packet.messages[index], message = messages[index];
        if (!object(row) || !exactKeys(row, [...messageFields, 'translation'])) { problem = 'Draft row schema is invalid.'; break; }
        const { translation, ...metadata } = row;
        if (!equal(metadata, message) || !translationMatches(message, translation)) {
          problem = 'Draft English/hash/context/AST metadata, order, protected tokens or fragment edges are invalid.'; break;
        }
        translations[message.key] = translation;
      }
    }
    return { locale, packetStatus: problem ? packetStatus : 'valid' as const, issue: problem,
      rows: messages.map(message => {
        const kind = message.translationConstraint === 'exact-English-echo' ? 'fixed-literal' as const : 'ai-draft' as const;
        const translation = problem ? null : translations[message.key];
        const issues = [...(sourceIssue ? [sourceIssue] : []), ...(problem ? [problem] : [])];
        const held: MessageState = problem ? packetStatus === 'missing' ? 'missing' : 'invalid' : source.status === 'changed' ? 'stale' : 'source-missing';
        if (source.status !== 'matched' || problem) return { ...message, kind, currentEnglish: current[message.key] ?? null, translation, state: held, issues };
        if (kind === 'fixed-literal') return { ...message, kind, currentEnglish: current[message.key]!, translation, state: 'fixed-literal' as const, issues };
        const descriptor: SourceMessage = { key: message.key, sourceFile: binding.sourceFile, english: message.english };
        const draft: DraftMessage = { key: message.key, sourceEnglish: message.english, text: translation!,
          provenance: { executor: 'AI draft; coordinator-paired inactive packet', method: 'AI draft', createdOn: binding.capturedOn }, review: { status: 'unreviewed' } };
        const assessment = assessMessage(descriptor, current, { [message.key]: draft }, locale);
        return { ...message, kind, currentEnglish: assessment.source ?? null, translation, state: assessment.state, issues: [...issues, ...assessment.issues] };
      }) };
  });
  return { ...base, issue: null, languages };
}
