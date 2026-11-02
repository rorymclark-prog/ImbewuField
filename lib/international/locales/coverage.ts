import type { DraftDictionary, DraftLanguage, MessageAssessment, SourceDictionary, SourceMessage } from './types';
import { formattingContext } from './formatting';
import { isolateText } from './metadata';

export function placeholders(text: string): string[] {
  return [...text.matchAll(/\{([A-Za-z][A-Za-z0-9_]*)\}/g)].map((match) => match[1]).sort();
}
function samePlaceholders(source: string, draft: string) {
  return JSON.stringify(placeholders(source)) === JSON.stringify(placeholders(draft));
}
function malformedPlaceholders(text: string) {
  return /[{}]/.test(text.replace(/\{[A-Za-z][A-Za-z0-9_]*\}/g, ''));
}
function realCalendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
export function requiredPluralCategories(language: string): Intl.LDMLPluralRule[] | null {
  const context = formattingContext(language);
  return context.status === 'supported' ? new Intl.PluralRules(context.pluralLocale).resolvedOptions().pluralCategories : null;
}

/** Current source is required input: checking a saved snapshot against itself proves nothing. */
export function assessMessage(message: SourceMessage, current: SourceDictionary, dictionary: DraftDictionary, language: string): MessageAssessment {
  const source = Object.hasOwn(current, message.key) ? current[message.key] : undefined;
  const draft = Object.hasOwn(dictionary, message.key) ? dictionary[message.key] : undefined;
  const result = (state: MessageAssessment['state'], issues: string[]): MessageAssessment => ({ key: message.key, state, issues, source, draft });
  if (typeof source !== 'string' || !source.trim()) return result('source-missing', ['Current English source is missing; no translation can be certified.']);
  if (!draft) return result('missing', ['No draft; English fallback is not translated coverage.']);
  if (draft.key !== message.key) return result('invalid', ['Dictionary key and bound message key disagree.']);
  if (draft.sourceEnglish !== source || message.english !== source) return result('stale', ['English source changed; rebind and review the draft.']);
  const issues: string[] = [];
  if (!draft.text.trim()) issues.push('Draft text is empty.');
  if (!samePlaceholders(source, draft.text)) issues.push('Draft placeholders differ from the current source.');
  if (malformedPlaceholders(draft.text)) issues.push('Unsupported or malformed placeholder syntax.');
  if (!draft.provenance.executor.trim() || draft.provenance.method !== 'AI draft' || !realCalendarDate(draft.provenance.createdOn)) issues.push('Translator provenance is incomplete.');
  const categories = requiredPluralCategories(language);
  if (!categories) issues.push('Plural locale is invalid or unavailable in this runtime.');
  if (message.pluralArgument) {
    if (!placeholders(source).includes(message.pluralArgument)) issues.push('Plural argument is absent from the source.');
    for (const category of categories ?? []) {
      const form = draft.pluralForms?.[category];
      if (!form?.trim()) issues.push(`Missing plural category: ${category}.`);
      else if (!samePlaceholders(source, form) || malformedPlaceholders(form)) issues.push(`Plural ${category} placeholders differ from the source or contain malformed syntax.`);
    }
  }
  if (draft.review.status === 'human-reviewed') {
    const formsMatch = JSON.stringify(Object.entries(draft.review.pluralForms ?? {}).sort()) === JSON.stringify(Object.entries(draft.pluralForms ?? {}).sort());
    if (!draft.review.reviewer.trim() || !realCalendarDate(draft.review.reviewedOn)
      || draft.review.sourceEnglish !== source || draft.review.draftText !== draft.text || !formsMatch) issues.push('Human-review evidence does not match this source and draft wording.');
  }
  if (issues.length) return result('invalid', issues);
  return result(draft.review.status === 'human-reviewed' ? 'reviewed' : 'draft', []);
}

export function coverageReport(messages: readonly SourceMessage[], current: SourceDictionary, dictionary: DraftDictionary, language: string) {
  const rows = messages.map((message) => assessMessage(message, current, dictionary, language));
  const counts = { draft: 0, reviewed: 0, missing: 0, 'source-missing': 0, stale: 0, invalid: 0 };
  for (const row of rows) counts[row.state]++;
  const extras = Object.keys(dictionary).filter((key) => !messages.some((message) => message.key === key));
  return { language, total: rows.length, counts, rows, extras, reviewedPercent: rows.length ? counts.reviewed / rows.length * 100 : 0 };
}

/** Draft preview is opt-in. Production-style resolution always keeps unreviewed text in English. */
export function resolveMessage(message: SourceMessage, current: SourceDictionary, dictionary: DraftDictionary, language: DraftLanguage,
  options: { previewDraft?: boolean; values?: Readonly<Record<string, string | number>>; count?: number } = {}) {
  const assessment = assessMessage(message, current, dictionary, language);
  const usable = assessment.state === 'reviewed' || (options.previewDraft === true && assessment.state === 'draft');
  let template = usable ? assessment.draft!.text : assessment.source;
  if (usable && message.pluralArgument) {
    if (!Number.isFinite(options.count) || options.count! < 0) return { text: assessment.source ?? message.key, origin: 'source' as const, assessment, issues: ['A nonnegative finite plural count is required.'] };
    const category = new Intl.PluralRules(language).select(options.count!);
    template = assessment.draft!.pluralForms![category];
  }
  if (!template) return { text: message.key, origin: 'key' as const, assessment, issues: ['English source unavailable.'] };
  const values = { ...options.values, ...(message.pluralArgument && options.count !== undefined ? { [message.pluralArgument]: options.count } : {}) };
  const missing = placeholders(template).filter((key) => !Object.hasOwn(values, key) || values[key] === undefined || (typeof values[key] === 'number' && !Number.isFinite(values[key])));
  if (missing.length) return { text: template, origin: usable ? assessment.state === 'reviewed' ? 'reviewed' as const : 'draft' as const : 'source' as const, assessment, issues: [`Missing interpolation values: ${missing.join(', ')}.`] };
  return { text: template.replace(/\{([A-Za-z][A-Za-z0-9_]*)\}/g, (_, key: string) => isolateText(String(values[key]))),
    origin: usable ? assessment.state === 'reviewed' ? 'reviewed' as const : 'draft' as const : 'source' as const, assessment, issues: [] };
}
