import kenyaSource from '@/docs/international/reference-card-language-packets/kenya-source.json' with { type: 'json' };
import kenyaDrafts from '@/docs/international/reference-card-language-packets/kenya-drafts.json' with { type: 'json' };
import ukSource from '@/docs/international/reference-card-language-packets/uk-source.json' with { type: 'json' };
import ukDrafts from '@/docs/international/reference-card-language-packets/uk-drafts.json' with { type: 'json' };
import usSource from '@/docs/international/reference-card-language-packets/us-source.json' with { type: 'json' };
import usDrafts from '@/docs/international/reference-card-language-packets/us-drafts.json' with { type: 'json' };
import manifest from '@/docs/international/reference-card-language-packets/manifest.json' with { type: 'json' };

export const REFERENCE_REVIEW_LANGUAGES = [
  ['en', 'English source'], ['fr', 'French'], ['es', 'Spanish'], ['pt-BR', 'Brazilian Portuguese'], ['sw', 'Swahili'],
] as const;
export type ReferenceReviewLanguage = typeof REFERENCE_REVIEW_LANGUAGES[number][0];

interface SourceRow { readonly key: string; readonly english: string; readonly sha256: string }
interface DraftRow extends SourceRow { readonly translation: string }
interface ReferenceReviewPacket {
  readonly label: string;
  readonly source: { readonly sourceCommit: string; readonly messages: readonly SourceRow[] };
  readonly drafts: { readonly sourceSha256: string; readonly reviewStatus: string; readonly runtimeActivation: boolean;
    readonly locales: Readonly<Record<string, readonly DraftRow[]>> };
  readonly binding: { readonly sourceSha256: string; readonly literals: readonly string[] };
}

export const REFERENCE_REVIEW_PACKETS = {
  kenya: { label: 'Kenya · Kiambu bulletin', source: kenyaSource, drafts: kenyaDrafts, binding: manifest.kenya },
  uk: { label: 'United Kingdom · Yeovilton records', source: ukSource, drafts: ukDrafts, binding: manifest.uk },
  us: { label: 'United States · public station observations', source: usSource, drafts: usDrafts, binding: manifest.us },
} satisfies Record<string, ReferenceReviewPacket>;

/** Only this review surface can display these candidates. A damaged binding
 * falls back to captured English and never counts as translated coverage. */
export function referenceReviewRows(packet: ReferenceReviewPacket, language: ReferenceReviewLanguage) {
  const { source, drafts, binding } = packet;
  const candidates = language !== 'en' && drafts.sourceSha256 === binding.sourceSha256
    && drafts.reviewStatus === 'unreviewed-ai-draft' && drafts.runtimeActivation === false
    && drafts.locales && Object.hasOwn(drafts.locales, language) ? drafts.locales[language] : undefined;
  return source.messages.map((row, index) => {
    if (language === 'en') return { ...row, text: row.english, origin: 'english' as const };
    const draft = Array.isArray(candidates) && candidates.length === source.messages.length ? candidates[index] : undefined;
    if (draft?.key !== row.key || draft.english !== row.english || draft.sha256 !== row.sha256
      || typeof draft.translation !== 'string' || !draft.translation.trim()
      || binding.literals.some(literal => row.english.split(literal).length !== draft.translation.split(literal).length)) {
      return { ...row, text: row.english, origin: 'fallback' as const };
    }
    return { ...row, text: draft.translation, origin: 'draft' as const };
  });
}
