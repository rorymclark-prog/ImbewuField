import { createHash } from 'node:crypto';
import { rawJsonIsLossless } from '../../lossless-json';
import { assessMessage } from './coverage';
import { MASS_ENTRY_REVIEW_SOURCE as binding } from './mass-entry-review-source';
import { readCurrentSourceLiterals, type SourceLiteralSelector } from './source-reader';
import type { DraftDictionary, DraftMessage, MessageState, SourceMessage } from './types';

export const MASS_ENTRY_REVIEW_LOCALES = ['fr', 'es', 'pt-BR', 'sw', 'hi', 'bn', 'id'] as const;
export type MassEntryReviewLocale = typeof MASS_ENTRY_REVIEW_LOCALES[number];
export interface MassEntryReviewRow {
  key: string;
  sourceFile: SourceMessage['sourceFile'];
  frozenEnglish: string;
  currentEnglish: string | null;
  translation: string | null;
  state: MessageState;
  issues: string[];
}
export interface MassEntryReviewData {
  sourceSha256: string;
  capturedOn: string;
  issue: string | null;
  sources: { path: string; status: 'matched' | 'changed' | 'available' | 'unavailable'; capturedSha256: string | null; currentSha256: string | null }[];
  languages: { locale: MassEntryReviewLocale; rows: MassEntryReviewRow[] }[];
}
export interface MassEntryReviewInputs {
  sourceText: string | undefined;
  currentSources: Readonly<Record<string, string | undefined>>;
  packets: Readonly<Partial<Record<MassEntryReviewLocale, string>>>;
}
const hash = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex');
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const exactKeys = (value: Record<string, unknown>, keys: readonly string[]) => JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort());
const protectedLiterals = (text: string) => JSON.stringify(text.match(/\b(?:kg|lb)\b|≈|→/g)?.sort() ?? []);
function parse(text: string | undefined): unknown {
  try { return rawJsonIsLossless(text) ? JSON.parse(text) : null; } catch { return null; }
}

/** An inspectable comparison, never a runtime dictionary or language approval.
 * Current English comes from named live source roles, not this frozen packet. */
export function buildMassEntryReviewData(input: MassEntryReviewInputs): MassEntryReviewData {
  const sources: MassEntryReviewData['sources'] = binding.files.map(file => {
    const text = input.currentSources[file.path], currentSha256 = typeof text === 'string' ? hash(text) : null;
    return { path: file.path, capturedSha256: file.sha256, currentSha256,
      status: currentSha256 === null ? 'unavailable' : file.sha256 === null ? 'available' : currentSha256 === file.sha256 ? 'matched' : 'changed' };
  });
  const base = { sourceSha256: binding.sourceSha256, capturedOn: binding.capturedOn, sources };
  const source = parse(input.sourceText);
  if (typeof input.sourceText !== 'string' || hash(input.sourceText) !== binding.sourceSha256 || !object(source)
    || !Array.isArray(source.messages) || source.messages.length !== binding.messages.length) {
    return { ...base, issue: 'The frozen English packet could not be verified. No draft comparison is available.', languages: [] };
  }
  const messages: SourceMessage[] = [];
  for (let index = 0; index < binding.messages.length; index++) {
    const value: unknown = source.messages[index], selected = binding.messages[index];
    if (!object(value) || !exactKeys(value, ['key', 'english', 'sha256']) || value.key !== selected.key
      || typeof value.english !== 'string' || value.sha256 !== hash(value.english)) {
      return { ...base, issue: 'The English message binding is incomplete. No draft comparison is available.', languages: [] };
    }
    messages.push({ key: value.key, english: value.english, sourceFile: selected.sourceFile });
  }
  const current: Record<string, string | undefined> = {};
  for (const file of binding.files) {
    const text = input.currentSources[file.path];
    const selectors: Record<string, SourceLiteralSelector> = Object.fromEntries(binding.messages
      .filter(message => message.sourceFile === file.path).map(message => [message.key, message.selector]));
    if (typeof text === 'string') Object.assign(current, readCurrentSourceLiterals(text, selectors));
  }
  const languages = MASS_ENTRY_REVIEW_LOCALES.map(locale => {
    const packet = parse(input.packets[locale]);
    const dictionary: Record<string, DraftMessage> = {};
    let problem: string | null = null;
    if (!object(packet) || !exactKeys(packet, ['locale', 'sourceSha256', 'reviewStatus', 'runtimeActivation', 'messages'])
      || packet.locale !== locale || packet.sourceSha256 !== binding.sourceSha256
      || packet.reviewStatus !== 'unreviewed-ai-draft' || packet.runtimeActivation !== false
      || !Array.isArray(packet.messages) || packet.messages.length !== messages.length) {
      problem = 'The inactive draft packet is missing or does not match this source, locale or unreviewed status.';
    } else {
      for (let index = 0; index < messages.length; index++) {
        const value: unknown = packet.messages[index], message = messages[index];
        if (!object(value) || !exactKeys(value, ['key', 'english', 'sha256', 'translation']) || value.key !== message.key
          || value.english !== message.english || value.sha256 !== hash(message.english) || typeof value.translation !== 'string'
          || protectedLiterals(value.translation) !== protectedLiterals(message.english)) {
          problem = 'Draft keys, English, hashes, order or protected kg/lb/≈/arrow counts do not match the frozen packet.'; break;
        }
        dictionary[message.key] = { key: message.key, sourceEnglish: message.english, text: value.translation,
          provenance: { executor: 'AGY AI draft; source-paired packet, no human language approval', method: 'AI draft', createdOn: binding.capturedOn },
          review: { status: 'unreviewed' } };
      }
    }
    return { locale, rows: messages.map(message => {
      const assessment = assessMessage(message, current, (problem ? {} : dictionary) as DraftDictionary, locale);
      const contextIssue = sources.some(file => file.path === message.sourceFile && file.status === 'changed')
        ? ['The component source changed since capture. Recheck the current wording and context before language review.'] : [];
      return { key: message.key, sourceFile: message.sourceFile, frozenEnglish: message.english,
        currentEnglish: assessment.source ?? null, translation: problem ? null : dictionary[message.key]?.text ?? null,
        state: problem && assessment.state !== 'source-missing' ? 'invalid' as const : assessment.state,
        issues: [...assessment.issues, ...contextIssue, ...(problem ? [problem] : [])] };
    }) };
  });
  return { ...base, issue: null, languages };
}
