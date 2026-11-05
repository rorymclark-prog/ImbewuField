import { createHash } from 'node:crypto';
import { assessMessage } from './coverage';
import { NURSERY_FIELD_PLANTING_REVIEW_SOURCE as binding } from './nursery-field-planting-review-source';
import type { DraftDictionary, DraftMessage, MessageState, SourceMessage } from './types';

export const NURSERY_REVIEW_LOCALES = ['fr', 'es', 'pt-BR', 'sw', 'hi', 'bn', 'id'] as const;
export type NurseryReviewLocale = typeof NURSERY_REVIEW_LOCALES[number];
export interface NurseryReviewRow {
  key: string;
  sourceFile: SourceMessage['sourceFile'];
  frozenEnglish: string;
  currentEnglish: string | null;
  translation: string | null;
  state: MessageState;
  issues: string[];
}
export interface NurseryReviewData {
  sourceSha256: string;
  capturedOn: string;
  issue: string | null;
  sources: { path: string; status: 'matched' | 'changed' | 'unavailable' }[];
  languages: { locale: NurseryReviewLocale; rows: NurseryReviewRow[] }[];
}
export interface NurseryReviewInputs {
  sourceText: string | undefined;
  currentSources: Readonly<Record<string, string | undefined>>;
  packets: Readonly<Partial<Record<NurseryReviewLocale, string>>>;
}
const hash = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex');
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const exactKeys = (value: Record<string, unknown>, keys: string[]) => Object.keys(value).sort().join('|') === [...keys].sort().join('|');
const literals = (text: string) => JSON.stringify(text.match(/DEMO|UTC|\b0\b/g)?.sort() ?? []);
const compact = (text: string) => text.replace(/\s+/g, ' ').trim();
function parse(text: string | undefined): unknown {
  try { return typeof text === 'string' ? JSON.parse(text) : null; } catch { return null; }
}

/** These packets were reviewed as source-paired drafts, not as language support.
 * A live component change must withdraw that binding before a reviewer relies on it. */
export function buildNurseryReviewData(input: NurseryReviewInputs): NurseryReviewData {
  const sources: NurseryReviewData['sources'] = binding.files.map(file => ({ path: file.path,
    status: typeof input.currentSources[file.path] !== 'string' ? 'unavailable'
      : hash(input.currentSources[file.path]!) === file.sha256 ? 'matched' : 'changed' }));
  const base = { sourceSha256: binding.sourceSha256, capturedOn: binding.capturedOn, sources };
  const source = parse(input.sourceText);
  if (typeof input.sourceText !== 'string' || hash(input.sourceText) !== binding.sourceSha256
    || !object(source) || !Array.isArray(source.messages)) return { ...base,
    issue: 'The frozen English packet could not be verified. No draft comparison is available.', languages: [] };
  const messages: SourceMessage[] = [];
  for (const value of source.messages) {
    if (!object(value) || typeof value.key !== 'string' || typeof value.english !== 'string'
      || value.messageSha256 !== hash(value.english) || !Object.hasOwn(binding.messageFiles, value.key)) return { ...base,
      issue: 'The English message binding is incomplete. No draft comparison is available.', languages: [] };
    messages.push({ key: value.key, english: value.english,
      sourceFile: binding.messageFiles[value.key as keyof typeof binding.messageFiles] });
  }
  const current: Record<string, string | undefined> = {};
  for (const message of messages) {
    const text = input.currentSources[message.sourceFile];
    // The file fingerprint binds manually selected JSX fragments, including the
    // two phrases around a dynamic planned date. It never reads that date as text.
    current[message.key] = sources.some(file => file.path === message.sourceFile && file.status === 'matched')
      && typeof text === 'string' && compact(text).includes(compact(message.english)) ? message.english : undefined;
  }
  const languages = NURSERY_REVIEW_LOCALES.map(locale => {
    const packet = parse(input.packets[locale]);
    let problem: string | null = null;
    const dictionary: Record<string, DraftMessage> = {};
    if (!object(packet) || !exactKeys(packet, ['locale', 'sourceSha256', 'status', 'runtimeActivation', 'messages'])
      || packet.locale !== locale || packet.sourceSha256 !== binding.sourceSha256
      || packet.status !== 'unreviewed-ai-draft' || packet.runtimeActivation !== false
      || !Array.isArray(packet.messages) || packet.messages.length !== messages.length) {
      problem = 'The inactive draft packet is missing or does not match this source and locale.';
    } else {
      for (let index = 0; index < messages.length; index++) {
        const value: unknown = packet.messages[index], message = messages[index];
        if (!object(value) || !exactKeys(value, ['key', 'english', 'messageSha256', 'translation'])
          || value.key !== message.key || value.english !== message.english || value.messageSha256 !== hash(message.english)
          || typeof value.translation !== 'string' || literals(value.translation) !== literals(message.english)) {
          problem = 'Draft keys, English, hashes, order or protected literals do not match the frozen packet.';
          break;
        }
        dictionary[message.key] = { key: message.key, sourceEnglish: message.english, text: value.translation,
          provenance: { executor: 'AGY AI draft; coordinator corrections recorded with the packet handoff', method: 'AI draft', createdOn: binding.capturedOn },
          review: { status: 'unreviewed' } };
      }
    }
    return { locale, rows: messages.map(message => {
      const assessment = assessMessage(message, current, (problem ? {} : dictionary) as DraftDictionary, locale);
      return { key: message.key, sourceFile: message.sourceFile, frozenEnglish: message.english,
        currentEnglish: assessment.source ?? null, translation: problem ? null : dictionary[message.key]?.text ?? null,
        state: problem && assessment.state !== 'source-missing' ? 'invalid' as const : assessment.state,
        issues: problem ? [...assessment.issues, problem] : assessment.issues };
    }) };
  });
  return { ...base, issue: null, languages };
}
